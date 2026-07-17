const DEFAULT_BASE_URL = 'https://api.checkbox.ua';

const isEnabled = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const getCheckboxConfig = () => ({
  baseUrl: (process.env.CHECKBOX_API_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
  cashierLogin: process.env.CHECKBOX_CASHIER_LOGIN || '',
  cashierPassword: process.env.CHECKBOX_CASHIER_PASSWORD || '',
  cashierPin: process.env.CHECKBOX_CASHIER_PIN || '',
  licenseKey: process.env.CHECKBOX_LICENSE_KEY || '',
  accessKey: process.env.CHECKBOX_ACCESS_KEY || '',
  clientName: process.env.CHECKBOX_CLIENT_NAME || 'Urban Nest',
  clientVersion: process.env.CHECKBOX_CLIENT_VERSION || '1.0.0',
  autoFiscalize: isEnabled(process.env.CHECKBOX_AUTO_FISCALIZE),
});

const getMissingCheckboxConfig = (config = getCheckboxConfig()) => [
  !config.cashierPin && !config.cashierLogin && 'CHECKBOX_CASHIER_LOGIN або CHECKBOX_CASHIER_PIN',
  !config.cashierPin && !config.cashierPassword && 'CHECKBOX_CASHIER_PASSWORD або CHECKBOX_CASHIER_PIN',
  !config.licenseKey && 'CHECKBOX_LICENSE_KEY',
].filter(Boolean);

module.exports = { getCheckboxConfig, getMissingCheckboxConfig };
