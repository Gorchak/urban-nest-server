const crypto = require('crypto');
const ApiError = require('./ApiError');
const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

let cachedJwks = null;
let cachedJwksExpiresAt = 0;

const base64UrlDecode = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
};

const parseJwt = (token) => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new ApiError('Invalid authorization token', 401);

  return {
    header: JSON.parse(base64UrlDecode(parts[0]).toString('utf8')),
    payload: JSON.parse(base64UrlDecode(parts[1]).toString('utf8')),
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: base64UrlDecode(parts[2]),
  };
};

const getAuth0RuntimeConfig = () => {
  const domain = process.env.AUTH0_DOMAIN;
  const spaClientId = process.env.AUTH0_SPA_CLIENT_ID || process.env.AUTH0_PUBLIC_CLIENT_ID;

  if (!domain || !spaClientId) {
    throw new ApiError('Auth0 API auth is not configured. Set AUTH0_DOMAIN and AUTH0_SPA_CLIENT_ID.', 500);
  }

  return {
    domain,
    spaClientId,
    issuer: `https://${domain}/`,
  };
};

const getJwks = async () => {
  const now = Date.now();
  if (cachedJwks && cachedJwksExpiresAt > now) return cachedJwks;

  const { domain } = getAuth0RuntimeConfig();
  const response = await fetch(`https://${domain}/.well-known/jwks.json`);
  if (!response.ok) throw new ApiError('Unable to load Auth0 signing keys', 503);

  cachedJwks = await response.json();
  cachedJwksExpiresAt = now + 60 * 60 * 1000;
  return cachedJwks;
};

const verifyAuth0Token = async (token) => {
  const { header, payload, signingInput, signature } = parseJwt(token);
  const { issuer, spaClientId } = getAuth0RuntimeConfig();

  if (header.alg !== 'RS256') throw new ApiError('Unsupported authorization token algorithm', 401);
  if (payload.iss !== issuer) throw new ApiError('Invalid authorization token issuer', 401);
  if (payload.aud !== spaClientId && !(Array.isArray(payload.aud) && payload.aud.includes(spaClientId))) {
    throw new ApiError('Invalid authorization token audience', 401);
  }
  if (!payload.sub) throw new ApiError('Authorization token subject is missing', 401);
  if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new ApiError('Authorization token expired', 401);

  const jwks = await getJwks();
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new ApiError('Auth0 signing key not found', 401);

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signingInput);
  verifier.end();

  if (!verifier.verify(publicKey, signature)) throw new ApiError('Invalid authorization token signature', 401);

  return payload;
};

const protectAuth0 = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return next(new ApiError('Потрібно залогінитись', 401));

  const payload = await verifyAuth0Token(token);
  req.auth = { sub: payload.sub, email: payload.email || null };
  next();
});

const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.auth?.sub) return next(new ApiError('Потрібно залогінитись', 401));

  const user = await userService.getById(req.auth.sub);
  req.currentUser = user;

  if (user.appMetadata?.isAdmin !== true) {
    return next(new ApiError('Немає прав на перегляд цих сторінок', 403));
  }

  next();
});

module.exports = { protectAuth0, requireAdmin };
