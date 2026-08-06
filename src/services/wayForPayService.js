const crypto = require('crypto');
const net = require('net');
const ApiError = require('../middleware/ApiError');
const { getWayForPayConfig, getMissingWayForPayConfig } = require('../config/wayForPay');

const hmacMd5 = (value, key) => crypto.createHmac('md5', key).update(value, 'utf8').digest('hex');
const money = (value) => Math.max(0, Number(value) || 0)
  .toFixed(2)
  .replace(/\.?0+$/, '');

const normalizeIpv4 = (...sources) => {
  const candidates = sources
    .flat(Infinity)
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim().replace(/^"|"$/g, ''));

  for (let candidate of candidates) {
    if (candidate.startsWith('::ffff:')) candidate = candidate.slice(7);
    if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
      candidate = candidate.slice(0, candidate.lastIndexOf(':'));
    }
    if (net.isIPv4(candidate)) return candidate;
  }

  return null;
};

const buildSignature = (request, secretKey) => hmacMd5([
  request.merchantAccount,
  request.merchantDomainName,
  request.orderReference,
  request.orderDate,
  request.amount,
  request.currency,
  ...request.productName,
  ...request.productCount,
  ...request.productPrice,
].join(';'), secretKey);

const validatePurchaseRequest = (request) => {
  const required = [
    'merchantAccount',
    'merchantDomainName',
    'merchantTransactionSecureType',
    'orderReference',
    'orderDate',
    'amount',
    'currency',
  ];
  const missing = required.filter((field) => request[field] === undefined || request[field] === null || request[field] === '');
  if (missing.length) throw new ApiError(`WayForPay purchase fields missing: ${missing.join(', ')}`, 503);
  if (!(Number(request.amount) > 0)) throw new ApiError('WayForPay purchase amount must be greater than zero', 400);

  const arrays = [request.productName, request.productCount, request.productPrice];
  if (arrays.some((values) => !Array.isArray(values) || values.length === 0)) {
    throw new ApiError('WayForPay purchase must contain products', 400);
  }
  if (new Set(arrays.map((values) => values.length)).size !== 1) {
    throw new ApiError('WayForPay product arrays must have equal length', 400);
  }
  if (request.productName.some((value) => !String(value || '').trim())) {
    throw new ApiError('WayForPay product names are required', 400);
  }
  if (request.productCount.some((value) => !(Number(value) > 0))) {
    throw new ApiError('WayForPay product counts must be greater than zero', 400);
  }
  if (request.productPrice.some((value) => !(Number(value) >= 0))) {
    throw new ApiError('WayForPay product prices are invalid', 400);
  }
};

const buildHostedPayment = ({ orderReference, amount, currency, items, customer }) => {
  const missing = getMissingWayForPayConfig();
  if (missing.length) throw new ApiError(`WayForPay config missing: ${missing.join(', ')}`, 503);

  const config = getWayForPayConfig();
  const request = {
    merchantAccount: config.merchantAccount,
    merchantAuthType: 'SimpleSignature',
    merchantDomainName: config.merchantDomainName,
    merchantTransactionType: 'SALE',
    merchantTransactionSecureType: 'AUTO',
    orderReference,
    orderDate: Math.floor(Date.now() / 1000),
    amount: money(amount),
    currency: currency || 'UAH',
    apiVersion: 1,
    language: 'UA',
    serviceUrl: config.serviceUrl,
    productName: items.map((item) => item.name),
    productPrice: items.map((item) => money(item.unitPrice)),
    productCount: items.map((item) => item.quantity),
    clientFirstName: String(customer?.firstName || '').trim(),
    clientLastName: String(customer?.lastName || '').trim(),
    clientEmail: String(customer?.email || '').trim(),
    clientPhone: String(customer?.phone || '').replace(/\D/g, ''),
  };
  if (config.returnUrl) request.returnUrl = config.returnUrl;
  validatePurchaseRequest(request);
  request.merchantSignature = buildSignature(request, config.merchantSecretKey);

  const fields = Object.entries(request).flatMap(([name, value]) => {
    if (!Array.isArray(value)) return [{ name, value: String(value) }];
    return value.map((entry) => ({ name: `${name}[]`, value: String(entry) }));
  });

  return { action: config.paymentUrl, method: 'POST', fields };
};

const callbackSignatureBase = (payload) => [
  payload.merchantAccount,
  payload.orderReference,
  payload.amount,
  payload.currency,
  payload.authCode || '',
  payload.cardPan || '',
  payload.transactionStatus,
  payload.reasonCode,
].join(';');

const signaturesEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyCallback = (payload = {}) => {
  const config = getWayForPayConfig();
  if (!config.merchantAccount || payload.merchantAccount !== config.merchantAccount) return false;
  const expected = hmacMd5(callbackSignatureBase(payload), config.merchantSecretKey);
  return signaturesEqual(payload.merchantSignature, expected);
};

const buildCallbackAcceptance = (orderReference) => {
  const config = getWayForPayConfig();
  const time = Math.floor(Date.now() / 1000);
  const status = 'accept';
  return {
    orderReference,
    status,
    time,
    signature: hmacMd5(`${orderReference};${status};${time}`, config.merchantSecretKey),
  };
};

const chargeGooglePay = async ({ orderReference, amount, currency, items, customer, clientIp, googlePay }) => {
  const missing = getMissingWayForPayConfig();
  if (missing.length) throw new ApiError(`WayForPay config missing: ${missing.join(', ')}`, 503);
  if (!googlePay?.token) throw new ApiError('Google Pay token is required', 400);

  const config = getWayForPayConfig();
  const normalizedClientIp = normalizeIpv4(clientIp);
  const request = {
    apiVersion: 1,
    transactionType: 'CHARGE',
    merchantAccount: config.merchantAccount,
    merchantDomainName: config.merchantDomainName,
    orderReference,
    orderDate: Math.floor(Date.now() / 1000),
    amount: money(amount),
    currency: currency || 'UAH',
    productName: items.map((item) => item.name),
    productPrice: items.map((item) => money(item.unitPrice)),
    productCount: items.map((item) => item.quantity),
    clientFirstName: customer?.firstName || '',
    clientLastName: customer?.lastName || '',
    clientCountry: 'UKR',
    clientEmail: customer?.email || '',
    clientPhone: customer?.phone || '',
    ...(normalizedClientIp ? { clientIpAddress: normalizedClientIp } : {}),
    merchantTransactionType: 'SALE',
    merchantTransactionSecureType: 'NON3DS',
    gpApiVersionMinor: Number(googlePay.apiVersionMinor) || 0,
    gpApiVersion: Number(googlePay.apiVersion) || 2,
    gpPMDescription: googlePay.description || '',
    gpPMType: googlePay.paymentMethodType || 'CARD',
    gpPMTCardNetwork: googlePay.cardNetwork || '',
    gpPMTCardDetails: googlePay.cardDetails || '',
    gpTokenizationType: googlePay.tokenizationType || 'PAYMENT_GATEWAY',
    gpToken: googlePay.token,
  };
  request.merchantSignature = buildSignature(request, config.merchantSecretKey);

  let response;
  try {
    response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new ApiError(`WayForPay is unavailable: ${error.message}`, 502);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.transactionStatus !== 'Approved') {
    throw new ApiError(result.reason || 'WayForPay payment was declined', 402);
  }
  return result;
};

module.exports = {
  buildSignature,
  buildHostedPayment,
  validatePurchaseRequest,
  verifyCallback,
  buildCallbackAcceptance,
  chargeGooglePay,
  normalizeIpv4,
};
