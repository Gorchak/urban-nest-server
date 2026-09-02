const WAYFORPAY_FEE_RATE = 0.02;
const CASH_ON_DELIVERY_DEPOSIT = 300;

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const calculateWayForPayFee = (amount) => roundMoney(Math.max(0, Number(amount) || 0) * WAYFORPAY_FEE_RATE);

const calculateCheckoutPayment = (orderTotal, paymentMethod) => {
  const normalizedOrderTotal = roundMoney(Math.max(0, Number(orderTotal) || 0));
  const isCashOnDelivery = paymentMethod === 'cash_on_delivery';
  const basePaymentAmount = isCashOnDelivery
    ? CASH_ON_DELIVERY_DEPOSIT
    : normalizedOrderTotal;
  const serviceFee = calculateWayForPayFee(basePaymentAmount);
  const chargedAmount = roundMoney(basePaymentAmount + serviceFee);

  return {
    basePaymentAmount,
    serviceFee,
    chargedAmount,
    orderTotal: roundMoney(normalizedOrderTotal + serviceFee),
    balanceDue: isCashOnDelivery ? roundMoney(Math.max(0, normalizedOrderTotal - basePaymentAmount)) : 0,
  };
};

module.exports = {
  WAYFORPAY_FEE_RATE,
  CASH_ON_DELIVERY_DEPOSIT,
  calculateWayForPayFee,
  calculateCheckoutPayment,
};
