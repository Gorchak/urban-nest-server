const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn(() => ({
    emails: { send: mockSend },
  })),
}));

const { Resend } = require('resend');
const { sendOrderNotification, renderOrderEmail } = require('./mailService');

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
    mockSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });

    await expect(sendOrderNotification(sale)).resolves.toEqual({
      sent: true,
      messageId: 'email-id',
      recipient: 'admin@example.com',
    });

    expect(Resend).toHaveBeenCalledWith('re_test');
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Urban Nest <orders@uliastore.com.ua>',
      to: 'admin@example.com',
      replyTo: 'buyer@example.com',
      subject: expect.stringContaining('UN-123'),
      html: expect.stringContaining('UN-123'),
    }), { idempotencyKey: 'order-UN-123' });
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
});
