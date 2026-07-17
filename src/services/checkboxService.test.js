const { buildReceiptPayload, buildEditGoodPayload, mapGood, mapReceipt, mapFinanceReceipts } = require('./checkboxService');

describe('checkboxService mappings', () => {
  test('maps Checkbox integer money and quantity units', () => {
    const product = mapGood({ id: 'g1', code: 'SKU-1', name: 'Сукня', price: 129900, count: 3000, created_at: '2026-01-01' });
    expect(product.source).toBe('checkbox');
    expect(product.salePrice).toBe(1299);
    expect(product.inventory.total_quantity).toBe(3);

    const sale = mapReceipt({
      id: 'r1', status: 'DONE', type: 'SELL', total_sum: 259800,
      goods: [{ good: { code: 'SKU-1', name: 'Сукня', price: 129900 }, quantity: 2000, sum: 259800 }],
      payments: [{ type: 'CASHLESS' }], created_at: '2026-01-01',
    });
    expect(sale.source).toBe('checkbox');
    expect(sale.grandTotal).toBe(2598);
    expect(sale.items[0].quantity).toBe(2);
    expect(sale.checkbox.context).toBeNull();
  });

  test('builds an idempotent receipt payload in Checkbox minor units', () => {
    const sale = {
      _id: '507f1f77bcf86cd799439011', orderNumber: 'UN-1', grandTotal: 1050, shippingCost: 50,
      payment: { status: 'paid', method: 'card' }, customer: { email: 'buyer@example.com', phone: '+380501234567' },
      items: [{ sku: 'SKU-1', name: 'Товар', quantity: 1, unitPrice: 1100, totalPrice: 1100 }],
    };
    const first = buildReceiptPayload(sale);
    const second = buildReceiptPayload(sale);
    expect(first.id).toBe(second.id);
    expect(first.payments[0]).toEqual({ type: 'CASHLESS', value: 105000 });
    expect(first.goods.reduce((sum, row) => sum + row.total_sum, 0)).toBe(105000);
  });

  test('PIN-only configuration is reported as complete', () => {
    const previous = {
      pin: process.env.CHECKBOX_CASHIER_PIN,
      login: process.env.CHECKBOX_CASHIER_LOGIN,
      password: process.env.CHECKBOX_CASHIER_PASSWORD,
      license: process.env.CHECKBOX_LICENSE_KEY,
    };
    process.env.CHECKBOX_CASHIER_PIN = '1234';
    process.env.CHECKBOX_CASHIER_LOGIN = '';
    process.env.CHECKBOX_CASHIER_PASSWORD = '';
    process.env.CHECKBOX_LICENSE_KEY = 'license';
    jest.resetModules();
    const { getStatus } = require('./checkboxService');
    expect(getStatus()).toEqual({ configured: true, autoFiscalize: false, missing: [] });
    const restore = (name, value) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('CHECKBOX_CASHIER_PIN', previous.pin);
    restore('CHECKBOX_CASHIER_LOGIN', previous.login);
    restore('CHECKBOX_CASHIER_PASSWORD', previous.password);
    restore('CHECKBOX_LICENSE_KEY', previous.license);
  });

  test('finance uses external sales, subtracts returns and skips site-linked receipts', () => {
    const base = {
      source: 'checkbox', grandTotal: 100, payment: { status: 'paid' }, createdAt: '2026-07-01',
      checkbox: { receiptStatus: 'DONE', receiptType: 'SELL', fiscalCode: '1', context: null },
    };
    const result = mapFinanceReceipts([
      { ...base, _id: 'sell' },
      { ...base, _id: 'return', grandTotal: 40, checkbox: { ...base.checkbox, receiptType: 'RETURN' } },
      { ...base, _id: 'site', checkbox: { ...base.checkbox, context: { source: 'urban-nest' } } },
      { ...base, _id: 'pending', checkbox: { ...base.checkbox, receiptStatus: 'CREATED' } },
    ]);
    expect(result.map((item) => item.grandTotal)).toEqual([100, -40]);
  });

  test('builds a whitelisted Checkbox edit payload and converts price to kopiykas', () => {
    expect(buildEditGoodPayload({
      name: 'Нова назва', price: 125.5, is_weight: false, count: 999, unknown: 'ignored',
    })).toEqual({ name: 'Нова назва', price: 12550, is_weight: false });
  });
});
