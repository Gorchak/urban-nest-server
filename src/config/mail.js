const DEFAULT_ADMIN_ORDER_EMAIL = 'Uliaconcept@gmail.com';

const getMailConfig = () => ({
  adminOrderEmail: process.env.ADMIN_ORDER_EMAIL || process.env.ORDER_NOTIFICATION_EMAIL || DEFAULT_ADMIN_ORDER_EMAIL,
  apiKey: process.env.RESEND_API_KEY || '',
  from: process.env.RESEND_FROM_EMAIL || '',
  newsletterFrom: process.env.NEWSLETTER_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || '',
});

const getMissingMailConfig = (config = getMailConfig()) => [
  ['ADMIN_ORDER_EMAIL', config.adminOrderEmail],
  ['RESEND_API_KEY', config.apiKey],
  ['RESEND_FROM_EMAIL', config.from],
].filter(([, value]) => !value).map(([name]) => name);

module.exports = { DEFAULT_ADMIN_ORDER_EMAIL, getMailConfig, getMissingMailConfig };
