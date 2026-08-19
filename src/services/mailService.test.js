const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn(() => ({
    emails: { send: mockSend },
  })),
}));

const { Resend } = require('resend');
const { sendOrderNotification, renderOrderEmail, renderCustomerOrderEmail } = require('./mailService');

const sale = {
  orderNumber: 'UN-123',
  customer: {
    firstName: 'Олена',
    lastName: 'Петренко',
    phone: '+380501234567',
    email: 'buyer@example.com',
  },
  shippingAddress: {
    deliveryService: 'nova_poshta',
    city: 'Київ',
    warehouse: 'Відділення №1',
  },
  payment: { method: 'card' },
  items: [{ name: 'Стілець', quantity: 2, totalPrice: 2400 }],
  grandTotal: 2400,
  currency: 'UAH',
};

describe('Resend order email notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_ORDER_EMAIL = 'admin@example.com';
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'Urban Nest <orders@uliastore.com.ua>';
  });

  test('sends the existing order template through Resend', async () => {
    mockSend
      .mockResolvedValueOnce({ data: { id: 'admin-email-id' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'customer-email-id' }, error: null });

    await expect(sendOrderNotification(sale)).resolves.toEqual({
      sent: true,
      messageId: 'admin-email-id',
      recipient: 'admin@example.com',
      customerSent: true,
      customerMessageId: 'customer-email-id',
      customerRecipient: 'buyer@example.com',
    });

    expect(Resend).toHaveBeenCalledWith('re_test');
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Urban Nest <orders@uliastore.com.ua>',
      to: 'admin@example.com',
      replyTo: 'buyer@example.com',
      subject: expect.stringContaining('UN-123'),
      html: expect.stringContaining('UN-123'),
    }), { idempotencyKey: 'order-UN-123' });
    expect(mockSend).toHaveBeenNthCalledWith(2, expect.objectContaining({
      from: 'Urban Nest <orders@uliastore.com.ua>',
      to: 'buyer@example.com',
      subject: 'Ваше замовлення UN-123 успішно оформлено',
      text: expect.stringContaining('Разом:'),
      html: expect.stringContaining('Замовлення успішно оформлено'),
    }), { idempotencyKey: 'order-UN-123-customer' });
  });

  test('surfaces Resend API errors', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'Domain is not verified' } });

    await expect(sendOrderNotification(sale))
      .rejects.toThrow('Resend API error: Domain is not verified');
  });

  test('keeps customer data escaped in the HTML template', () => {
    const html = renderOrderEmail({
      ...sale,
      customer: { ...sale.customer, firstName: '<script>alert(1)</script>' },
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('renders product details and total in the customer template', () => {
    const html = renderCustomerOrderEmail(sale);

    expect(html).toContain('Стілець');
    expect(html).toContain('2 &#1096;&#1090;.');
    expect(html).toMatch(/2[\s\u00a0]400 UAH/);
  });

  test('skips the customer email when no customer email was provided', async () => {
    mockSend.mockResolvedValue({ data: { id: 'admin-email-id' }, error: null });

    await expect(sendOrderNotification({
      ...sale,
      customer: { ...sale.customer, email: '' },
    })).resolves.toEqual(expect.objectContaining({
      customerSent: false,
      customerMessageId: null,
      customerRecipient: null,
    }));
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
