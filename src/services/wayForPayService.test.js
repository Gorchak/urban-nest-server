const crypto = require('crypto');
const { buildSignature } = require('./wayForPayService');

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
});
