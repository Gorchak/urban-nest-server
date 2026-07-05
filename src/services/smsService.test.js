const { normalizePhone } = require('../config/sms');
const { renderOrderSmsText } = require('./smsService');

describe('order SMS notifications', () => {
  test.each([
    ['0679403549', '+380679403549'],
    ['380679403549', '+380679403549'],
    ['+380679403549', '+380679403549'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  test('renders order details for admin SMS', () => {
    const text = renderOrderSmsText({
      orderNumber: 'UN-123',
      customer: {
        firstName: 'Олена',
        lastName: 'Коваль',
        phone: '+380679403549',
      },
      shippingAddress: {
        deliveryService: 'nova_poshta',
        region: 'Київська',
        city: 'Київ',
        warehouse: 'Відділення 1',
      },
      items: [
        { name: 'Стіл Loft', quantity: 1, inventoryValueLabel: 'Дуб' },
        { name: 'Стілець Nordic', quantity: 4 },
      ],
      grandTotal: 12500,
      currency: 'UAH',
    }, {
      adminSalesUrl: 'https://urban-nest-dev.netlify.app/admin/sales',
    });

    expect(text).toContain('Оформлено замовлення UN-123');
    expect(text).toContain('- Стіл Loft (Дуб): 1 шт.');
    expect(text).toContain('- Стілець Nordic: 4 шт.');
    expect(text).toContain('Сума: 12 500 UAH');
    expect(text).toContain('Телефон: +380679403549');
    expect(text).toContain('Доставка: Нова пошта');
    expect(text).toContain('Адреса: Київська, Київ, Відділення 1');
    expect(text).toContain('https://urban-nest-dev.netlify.app/admin/sales');
  });
});
