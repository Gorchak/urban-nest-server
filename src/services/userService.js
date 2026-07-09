const ApiError = require('../middleware/ApiError');
const crypto = require('crypto');

const AUTH0_TIMEOUT_MS = 15000;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

const getAuth0Config = () => {
  const domain = process.env.AUTH0_DOMAIN;
  const spaClientId = process.env.AUTH0_SPA_CLIENT_ID || process.env.AUTH0_PUBLIC_CLIENT_ID;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const audience = process.env.AUTH0_AUDIENCE || (domain ? `https://${domain}/api/v2/` : '');
  const connection = process.env.AUTH0_DB_CONNECTION || 'Username-Password-Authentication';

  if (!domain || !clientId || !clientSecret) {
    throw new ApiError(
      'Auth0 Management API is not configured. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET.',
      500
    );
  }

  return { domain, spaClientId, clientId, clientSecret, audience, connection };
};

const getSmsConnection = () => process.env.AUTH0_SMS_CONNECTION || 'sms';
const PHONE_ONLY_EMAIL_DOMAIN = process.env.AUTH0_PHONE_ONLY_EMAIL_DOMAIN || 'uliastore.com.ua';

const normalizePhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+38${digits}`;
  if (digits.length === 12 && digits.startsWith('380')) return `+${digits}`;
  return String(value || '').trim();
};

const phoneOnlyEmail = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return `phone-${digits || crypto.randomBytes(6).toString('hex')}@${PHONE_ONLY_EMAIL_DOMAIN}`;
};

const requestJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH0_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      throw new ApiError(
        payload?.message || payload?.error_description || payload?.error || 'Auth0 request failed',
        response.status
      );
    }

    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') throw new ApiError('Auth0 request timed out', 504);
    throw new ApiError(err.message || 'Auth0 request failed', 502);
  } finally {
    clearTimeout(timer);
  }
};

const getManagementToken = async () => {
  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt > now + 60000) return cachedToken;

  const { domain, clientId, clientSecret, audience } = getAuth0Config();
  const payload = await requestJson(`https://${domain}/oauth/token`, {
    method: 'POST',
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience,
    }),
  });

  cachedToken = payload.access_token;
  cachedTokenExpiresAt = now + (payload.expires_in || 3600) * 1000;
  return cachedToken;
};

const managementRequest = async (path, options = {}) => {
  const { domain } = getAuth0Config();
  const token = await getManagementToken();
  return requestJson(`https://${domain}/api/v2${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
};

const normalizeUser = (user) => ({
  userId: user.user_id,
  email: user.app_metadata?.phoneOnly ? '' : user.email || '',
  emailVerified: Boolean(user.email_verified),
  phoneNumber: user.phone_number || user.user_metadata?.phone || '',
  phoneVerified: Boolean(user.phone_verified),
  name: user.name || '',
  nickname: user.nickname || '',
  picture: user.user_metadata?.avatarUrl || user.picture || '',
  createdAt: user.created_at,
  updatedAt: user.updated_at,
  lastLogin: user.last_login || null,
  loginsCount: user.logins_count || 0,
  identities: (user.identities || []).map((identity) => ({
    provider: identity.provider,
    connection: identity.connection,
    user_id: identity.user_id,
    isSocial: identity.isSocial,
  })),
  userMetadata: user.user_metadata || {},
  appMetadata: user.app_metadata || {},
});

const encodeUserId = (id) => encodeURIComponent(id);

const canUpdateRootProfileAttributes = (user) => {
  const provider = user.identities?.[0]?.provider;
  return provider === 'auth0' || provider === 'email' || provider === 'sms';
};

const getAll = async (query = {}, options = {}) => {
  const page = Math.max(parseInt(options.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(options.limit || '20', 10), 1), 100);
  const search = query.search || options.search || '';
  const params = new URLSearchParams({
    page: String(page - 1),
    per_page: String(limit),
    include_totals: 'true',
    sort: options.sort || 'created_at:-1',
  });

  if (search) {
    const escaped = String(search).replace(/"/g, '\\"');
    params.set('q', `email:*${escaped}* OR name:*${escaped}* OR nickname:*${escaped}* OR phone_number:*${escaped}* OR user_metadata.phone:*${escaped}*`);
    params.set('search_engine', 'v3');
  }

  const result = await managementRequest(`/users?${params.toString()}`);

  return {
    data: (result.users || []).map(normalizeUser),
    pagination: {
      total: result.total || 0,
      page,
      limit,
      pages: Math.ceil((result.total || 0) / limit),
    },
  };
};

const getById = async (id) => {
  if (!id) throw new ApiError('User ID is required', 400);
  return normalizeUser(await managementRequest(`/users/${encodeUserId(id)}`));
};

const buildUserMetadata = (data = {}) => ({
  ...(data.userMetadata || {}),
  firstName: data.userMetadata?.firstName || data.firstName || '',
  lastName: data.userMetadata?.lastName || data.lastName || '',
  middleName: data.userMetadata?.middleName || data.middleName || '',
  phone: normalizePhone(data.userMetadata?.phone || data.phone || ''),
  residentialAddress: data.userMetadata?.residentialAddress || data.residentialAddress || '',
  avatarUrl: data.userMetadata?.avatarUrl || data.avatarUrl || '',
  delivery: data.userMetadata?.delivery || {},
});

const create = async (data = {}) => {
  const email = String(data.email || '').trim();
  const phone = normalizePhone(data.phone || data.userMetadata?.phone || '');
  if (!email && !phone) throw new ApiError('Email or phone is required', 400);

  const userMetadata = buildUserMetadata({ ...data, phone });
  const appMetadata = data.appMetadata && typeof data.appMetadata === 'object' ? data.appMetadata : {};
  const body = email
    ? {
        connection: getAuth0Config().connection,
        email,
        email_verified: false,
        password: data.password || crypto.randomBytes(18).toString('base64url'),
        name: data.name || [userMetadata.firstName, userMetadata.lastName].filter(Boolean).join(' ').trim() || email,
        user_metadata: userMetadata,
        app_metadata: appMetadata,
      }
    : {
        connection: getSmsConnection(),
        phone_number: phone,
        phone_verified: false,
        user_metadata: userMetadata,
        app_metadata: appMetadata,
      };

  try {
    return normalizeUser(await managementRequest('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }));
  } catch (error) {
    if (email || !/connection does not exist/i.test(error.message || '')) throw error;

    const fallbackBody = {
      connection: getAuth0Config().connection,
      email: phoneOnlyEmail(phone),
      email_verified: false,
      password: data.password || crypto.randomBytes(18).toString('base64url'),
      name: phone,
      user_metadata: userMetadata,
      app_metadata: { ...appMetadata, phoneOnly: true },
    };
    return normalizeUser(await managementRequest('/users', {
      method: 'POST',
      body: JSON.stringify(fallbackBody),
    }));
  }
};

const findByPhone = async (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const escaped = normalized.replace(/"/g, '\\"');
  const params = new URLSearchParams({
    q: `phone_number:"${escaped}" OR user_metadata.phone:"${escaped}"`,
    search_engine: 'v3',
    per_page: '1',
  });
  const result = await managementRequest(`/users?${params.toString()}`);
  const user = Array.isArray(result) ? result[0] : result?.users?.[0];
  return user ? normalizeUser(user) : null;
};

const findOrCreateByPhone = async (phone) => {
  const existing = await findByPhone(phone);
  if (existing) return existing;
  return create({ phone });
};

const update = async (id, updates) => {
  if (!id) throw new ApiError('User ID is required', 400);

  const body = {};
  let currentUser = null;
  if (typeof updates.email === 'string' && updates.email.trim()) {
    currentUser = await managementRequest(`/users/${encodeUserId(id)}`);
    if ((currentUser.email || '').toLowerCase() !== updates.email.trim().toLowerCase()) {
      if (!canUpdateRootProfileAttributes(currentUser)) {
        throw new ApiError('Auth0 does not allow changing email for this identity provider.', 400);
      }
      body.email = updates.email.trim();
    }
  }
  if (typeof updates.name === 'string' && updates.name.trim()) {
    currentUser = currentUser || await managementRequest(`/users/${encodeUserId(id)}`);
    if (canUpdateRootProfileAttributes(currentUser)) body.name = updates.name.trim();
  }
  if (updates.userMetadata && typeof updates.userMetadata === 'object') {
    body.user_metadata = updates.userMetadata;
  }
  if (updates.appMetadata && typeof updates.appMetadata === 'object') {
    body.app_metadata = updates.appMetadata;
  }

  if (!Object.keys(body).length) throw new ApiError('No user profile changes provided', 400);

  return normalizeUser(await managementRequest(`/users/${encodeUserId(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }));
};

const updatePassword = async (id, password) => {
  if (!id) throw new ApiError('User ID is required', 400);
  if (!password || String(password).length < 8) {
    throw new ApiError('Password must contain at least 8 characters', 400);
  }

  const { connection } = getAuth0Config();
  return normalizeUser(await managementRequest(`/users/${encodeUserId(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ password, connection }),
  }));
};

const sendPasswordReset = async (id) => {
  const user = await getById(id);
  if (!user.email) throw new ApiError('User email is required for password reset', 400);

  const { domain, spaClientId, clientId, connection } = getAuth0Config();
  await requestJson(`https://${domain}/dbconnections/change_password`, {
    method: 'POST',
    body: JSON.stringify({
      client_id: spaClientId || clientId,
      email: user.email,
      connection,
    }),
  });

  return { email: user.email };
};

module.exports = {
  getAll,
  getById,
  create,
  findByPhone,
  findOrCreateByPhone,
  update,
  updatePassword,
  sendPasswordReset,
  normalizePhone,
};
