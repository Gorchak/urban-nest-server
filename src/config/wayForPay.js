const getWayForPayConfig = () => ({
  apiUrl: process.env.WAYFORPAY_API_URL || 'https://api.wayforpay.com/api',
  merchantAccount: process.env.WAYFORPAY_MERCHANT_ACCOUNT || '',
  merchantSecretKey: process.env.WAYFORPAY_MERCHANT_SECRET_KEY || '',
  merchantDomainName: process.env.WAYFORPAY_MERCHANT_DOMAIN || '',
});

const getMissingWayForPayConfig = () => {
  const config = getWayForPayConfig();
  return Object.entries(config)
    .filter(([key, value]) => key !== 'apiUrl' && !value)
    .map(([key]) => key);
};

module.exports = { getWayForPayConfig, getMissingWayForPayConfig };
