const {
  calculateCheckoutPayment,
  calculateWayForPayFee,
} = require('./paymentPricing');

describe('payment pricing', () => {
  test('adds a 2% fee to a full WayForPay payment', () => {
    expect(calculateCheckoutPayment(1250, 'wayforpay')).toEqual({
      basePaymentAmount: 1250,
      serviceFee: 25,
      chargedAmount: 1275,
      orderTotal: 1275,
      balanceDue: 0,
    });
  });

  test('charges a 300 UAH deposit plus a 2% fee for cash on delivery', () => {
    expect(calculateCheckoutPayment(1250, 'cash_on_delivery')).toEqual({
      basePaymentAmount: 300,
      serviceFee: 6,
      chargedAmount: 306,
      orderTotal: 1256,
      balanceDue: 950,
    });
  });

  test('keeps the required deposit fixed at 300 UAH', () => {
    expect(calculateCheckoutPayment(200, 'cash_on_delivery')).toMatchObject({
      basePaymentAmount: 300,
      serviceFee: 6,
      chargedAmount: 306,
      balanceDue: 0,
    });
  });

  test('rounds the fee to kopiykas', () => {
    expect(calculateWayForPayFee(333.33)).toBe(6.67);
  });
});
