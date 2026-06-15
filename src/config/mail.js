const DEFAULT_ADMIN_ORDER_EMAIL = 'gorchakua@gmail.com';

const getMailConfig = () => ({
  adminOrderEmail: process.env.ADMIN_ORDER_EMAIL || process.env.ORDER_NOTIFICATION_EMAIL || DEFAULT_ADMIN_ORDER_EMAIL,
  from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
});

const getMissingMailConfig = (config = getMailConfig()) => [
  ['ADMIN_ORDER_EMAIL', config.adminOrderEmail],
  ['SMTP_HOST', config.host],
  ['SMTP_USER', config.user],
  ['SMTP_PASS', config.pass],
].filter(([, value]) => !value).map(([name]) => name);

module.exports = { DEFAULT_ADMIN_ORDER_EMAIL, getMailConfig, getMissingMailConfig };
