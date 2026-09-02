const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const validateEmail = (value) => {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_PATTERN.test(email);
};

module.exports = { normalizeEmail, validateEmail };
