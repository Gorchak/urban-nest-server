const clean = (value) => String(value || '').trim();
const normalizeReturnUrl = (value) => {
  const configured = clean(value);
  if (!configured) return 'https://api.uliastore.com.ua/api/sales/wayforpay/return';
  if (/^https?:\/\/(?:www\.)?uliastore\.com\.ua\/checkout\/?$/i.test(configured)) {
    return 'https://api.uliastore.com.ua/api/sales/wayforpay/return';
  }
  if (/^http:\/\/localhost:4200\/checkout\/?$/i.test(configured)) {
    return 'http://localhost:3000/api/sales/wayforpay/return';
  }
  return configured;
};

const getWayForPayConfig = () => ({
  apiUrl: process.env.WAYFORPAY_API_URL || 'https://api.wayforpay.com/api',
  merchantAccount: clean(process.env.WAYFORPAY_MERCHANT_ACCOUNT),
  merchantSecretKey: clean(process.env.WAYFORPAY_MERCHANT_SECRET_KEY),
  merchantDomainName: clean(process.env.WAYFORPAY_MERCHANT_DOMAIN)
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, ''),
  paymentUrl: process.env.WAYFORPAY_PAYMENT_URL || 'https://secure.wayforpay.com/pay',
  serviceUrl: process.env.WAYFORPAY_SERVICE_URL
    || 'https://api.uliastore.com.ua/api/sales/wayforpay/callback',
  returnUrl: normalizeReturnUrl(process.env.WAYFORPAY_RETURN_URL),
});

const getMissingWayForPayConfig = () => {
  const config = getWayForPayConfig();
  return Object.entries(config)
    .filter(([key, value]) => !['apiUrl', 'paymentUrl', 'returnUrl'].includes(key) && !value)
    .map(([key]) => key);
};

module.exports = { getWayForPayConfig, getMissingWayForPayConfig };
