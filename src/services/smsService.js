const { getSmsConfig, getMissingSmsConfig } = require('../config/sms');

const formatPrice = (value, currency = 'UAH') =>
  `${Number(value || 0).toLocaleString('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).replace(/\u00a0/g, ' ')} ${currency}`;

const deliveryNames = {
  nova_poshta: 'Нова пошта',
  courier: 'Кур’єр',
  pickup: 'Самовивіз',
};

const renderDeliveryAddress = (address = {}) => [
  address.region,
  address.city,
  address.warehouse,
  address.street,
  address.building,
  address.apartment,
  address.postalCode,
].filter(Boolean).join(', ');

const renderOrderSmsText = (sale, config = getSmsConfig()) => {
  const deliveryService = sale.shippingAddress?.deliveryService || '';
  const deliveryName = deliveryNames[deliveryService] || deliveryService || 'не вказано';
  const address = renderDeliveryAddress(sale.shippingAddress) || 'не вказано';
  const items = (sale.items || [])
    .map((item) => {
      const option = item.inventoryValueLabel ? ` (${item.inventoryValueLabel})` : '';
      return `- ${item.name || item.sku || 'Товар'}${option}: ${item.quantity} шт.`;
    })
    .join('\n');

  return [
    `Оформлено замовлення ${sale.orderNumber}`,
    items,
    `Сума: ${formatPrice(sale.grandTotal, sale.currency)}`,
    '',
    `Замовник: ${sale.customer?.firstName || ''} ${sale.customer?.lastName || ''}`.trim(),
    `Телефон: ${sale.customer?.phone || 'не вказано'}`,
    `Доставка: ${deliveryName}`,
    `Адреса: ${address}`,
    '',
    config.adminSalesUrl,
  ].filter((line) => line !== null && line !== undefined).join('\n');
};

const parseProviderResponse = (responseText) => {
  try {
    return responseText ? JSON.parse(responseText) : null;
  } catch (_) {
    return responseText;
  }
};

const sendOrderSmsNotification = async (sale) => {
  const config = getSmsConfig();
  if (!config.enabled) {
    return { sent: false, reason: 'disabled', recipient: config.orderRecipient };
  }

  const missing = getMissingSmsConfig(config);
  if (missing.length) {
    console.warn(`Order SMS skipped: missing configuration: ${missing.join(', ')}`);
    return { sent: false, reason: 'not_configured', missing, recipient: config.orderRecipient };
  }

  const text = renderOrderSmsText(sale, config);
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (config.apiToken) headers[config.authHeader] = `Bearer ${config.apiToken}`;

  const response = await fetch(config.providerUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: config.orderRecipient,
      phone: config.orderRecipient,
      recipient: config.orderRecipient,
      text,
      message: text,
      sender: config.sender || undefined,
      orderNumber: sale.orderNumber,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`SMS provider responded with ${response.status}: ${responseText.slice(0, 300)}`);
  }

  return {
    sent: true,
    recipient: config.orderRecipient,
    providerResponse: parseProviderResponse(responseText),
  };
};

module.exports = { sendOrderSmsNotification, renderOrderSmsText };
