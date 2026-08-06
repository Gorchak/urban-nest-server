const crypto = require('crypto');
const { buildSignature, buildHostedPayment, normalizeIpv4, validatePurchaseRequest } = require('./wayForPayService');

describe('wayForPayService', () => {
  test('builds the documented purchase signature in the required field order', () => {
    const request = {
      merchantAccount: 'merchant',
      merchantDomainName: 'shop.example',
      orderReference: 'UN-1',
      orderDate: 1700000000,
      amount: '1547.36',
      currency: 'UAH',
      productName: ['First', 'Second'],
      productCount: [1, 2],
      productPrice: ['1000.00', '273.68'],
    };
    const base = 'merchant;shop.example;UN-1;1700000000;1547.36;UAH;First;Second;1;2;1000.00;273.68';
    const expected = crypto.createHmac('md5', 'secret').update(base, 'utf8').digest('hex');

    expect(buildSignature(request, 'secret')).toBe(expected);
  });

  test('builds a complete PURCHASE form with every mandatory WayForPay field', () => {
    const previous = {
      account: process.env.WAYFORPAY_MERCHANT_ACCOUNT,
      secret: process.env.WAYFORPAY_MERCHANT_SECRET_KEY,
      domain: process.env.WAYFORPAY_MERCHANT_DOMAIN,
    };
    process.env.WAYFORPAY_MERCHANT_ACCOUNT = ' merchant ';
    process.env.WAYFORPAY_MERCHANT_SECRET_KEY = ' secret ';
    process.env.WAYFORPAY_MERCHANT_DOMAIN = 'https://www.shop.example/checkout';

    try {
      const payment = buildHostedPayment({
        orderReference: 'UN-1',
        amount: 1200,
        currency: 'UAH',
        items: [{ name: 'Товар', unitPrice: 600, quantity: 2 }],
        customer: { firstName: 'Петро', lastName: 'Горчак', email: 'test@example.com', phone: '+380679403549' },
      });
      const fields = new Map();
      payment.fields.forEach(({ name, value }) => {
        if (!fields.has(name)) fields.set(name, []);
        fields.get(name).push(value);
      });

      expect(payment).toMatchObject({ action: 'https://secure.wayforpay.com/pay', method: 'POST' });
      expect(fields.get('merchantAccount')).toEqual(['merchant']);
      expect(fields.get('merchantDomainName')).toEqual(['www.shop.example']);
      expect(fields.get('merchantTransactionSecureType')).toEqual(['AUTO']);
      expect(fields.get('orderReference')).toEqual(['UN-1']);
      expect(fields.get('amount')).toEqual(['1200']);
      expect(fields.get('currency')).toEqual(['UAH']);
      expect(fields.get('productName[]')).toEqual(['Товар']);
      expect(fields.get('productCount[]')).toEqual(['2']);
      expect(fields.get('productPrice[]')).toEqual(['600']);
      expect(fields.get('merchantSignature')?.[0]).toMatch(/^[a-f0-9]{32}$/);
    } finally {
      const restore = (name, value) => {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      };
      restore('WAYFORPAY_MERCHANT_ACCOUNT', previous.account);
      restore('WAYFORPAY_MERCHANT_SECRET_KEY', previous.secret);
      restore('WAYFORPAY_MERCHANT_DOMAIN', previous.domain);
    }
  });

  test('rejects an incomplete PURCHASE request before redirecting the customer', () => {
    expect(() => validatePurchaseRequest({
      merchantAccount: 'merchant',
      merchantDomainName: 'shop.example',
      merchantTransactionSecureType: 'AUTO',
      orderReference: 'UN-1',
      orderDate: 1700000000,
      amount: '100',
      currency: 'UAH',
      productName: [],
      productCount: [],
      productPrice: [],
    })).toThrow('WayForPay purchase must contain products');
  });

  test.each([
    [['203.0.113.42'], '203.0.113.42'],
    [['::ffff:203.0.113.42'], '203.0.113.42'],
    [['203.0.113.42:54321'], '203.0.113.42'],
    [['2001:db8::1', '198.51.100.7, 10.0.0.1'], '198.51.100.7'],
    [['2001:db8::1'], null],
  ])('normalizes a WayForPay-compatible IPv4 address', (sources, expected) => {
    expect(normalizeIpv4(sources)).toBe(expected);
  });
});
