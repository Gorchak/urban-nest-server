const { normalizeEmail, validateEmail } = require('./newsletterSubscriberModel');

describe('newsletter subscriber model', () => {
  test('normalizes email before persistence', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });
  test.each(['user@example.com', 'name+news@sub.example.ua'])('accepts %s', (email) => {
    expect(validateEmail(email)).toBe(true);
  });
  test.each(['', 'missing-at.example.com', 'a@b', 'a b@example.com'])('rejects %s', (email) => {
    expect(validateEmail(email)).toBe(false);
  });
});
