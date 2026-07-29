const crypto = require('crypto');
const ApiError = require('../middleware/ApiError');
const { getWayForPayConfig, getMissingWayForPayConfig } = require('../config/wayForPay');

const hmacMd5 = (value, key) => crypto.createHmac('md5', key).update(value, 'utf8').digest('hex');
const money = (value) => Math.max(0, Number(value) || 0).toFixed(2);

const buildSignature = (request, secretKey) => hmacMd5([
  request.merchantAccount,
  request.merchantDomainName,
  request.orderReference,
  request.orderDate,
  money(request.amount),
  request.currency,
  ...request.productName,
  ...request.productCount,
  ...request.productPrice.map(money),
].join(';'), secretKey);

const chargeGooglePay = async ({ orderReference, amount, currency, items, customer, clientIp, googlePay }) => {
  const missing = getMissingWayForPayConfig();
  if (missing.length) throw new ApiError(`WayForPay config missing: ${missing.join(', ')}`, 503);
  if (!googlePay?.token) throw new ApiError('Google Pay token is required', 400);

  const config = getWayForPayConfig();
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
    clientIpAddress: clientIp || '',
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

module.exports = { buildSignature, chargeGooglePay };
