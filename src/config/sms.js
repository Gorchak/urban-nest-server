const DEFAULT_ORDER_SMS_RECIPIENT = '+380679403549';
const DEFAULT_ADMIN_SALES_URL = 'https://urban-nest-dev.netlify.app/admin/sales';

const normalizePhone = (value = DEFAULT_ORDER_SMS_RECIPIENT) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+38${digits}`;
  if (digits.length === 12 && digits.startsWith('380')) return `+${digits}`;
  return String(value || DEFAULT_ORDER_SMS_RECIPIENT).trim();
};

const getSmsConfig = () => ({
  enabled: process.env.SMS_ENABLED !== 'false',
  providerUrl: process.env.SMS_PROVIDER_URL || '',
  apiToken: process.env.SMS_API_TOKEN || '',
  authHeader: process.env.SMS_AUTH_HEADER || 'Authorization',
  sender: process.env.SMS_SENDER || '',
  orderRecipient: normalizePhone(process.env.ORDER_SMS_RECIPIENT || DEFAULT_ORDER_SMS_RECIPIENT),
  adminSalesUrl: process.env.ADMIN_SALES_URL || DEFAULT_ADMIN_SALES_URL,
});

const getMissingSmsConfig = (config = getSmsConfig()) => {
  if (!config.enabled) return [];
  return [
    ['SMS_PROVIDER_URL', config.providerUrl],
    ['SMS_API_TOKEN', config.apiToken],
    ['ORDER_SMS_RECIPIENT', config.orderRecipient],
  ].filter(([, value]) => !value).map(([name]) => name);
};

module.exports = {
  DEFAULT_ORDER_SMS_RECIPIENT,
  DEFAULT_ADMIN_SALES_URL,
  normalizePhone,
  getSmsConfig,
  getMissingSmsConfig,
};
