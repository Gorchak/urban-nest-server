const clean = (value) => String(value || '').trim();

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
  returnUrl: process.env.WAYFORPAY_RETURN_URL || 'https://uliastore.com.ua/checkout',
});

const getMissingWayForPayConfig = () => {
  const config = getWayForPayConfig();
  return Object.entries(config)
    .filter(([key, value]) => !['apiUrl', 'paymentUrl', 'returnUrl'].includes(key) && !value)
    .map(([key]) => key);
};

module.exports = { getWayForPayConfig, getMissingWayForPayConfig };
