const VALID_SALE_STATUSES = [
  'pending_payment',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

const VALID_PAYMENT_METHODS = [
  'card',
  'cash_on_delivery',
  'bank_transfer',
  'online',
];

const VALID_PAYMENT_STATUSES = ['unpaid', 'paid', 'partially_paid', 'refunded'];

const SaleSchema = {
  fields: {
    orderNumber: { type: 'string', required: true },
    status: { type: 'string', enum: VALID_SALE_STATUSES, default: 'pending_payment' },
    customer: { type: 'object', required: true },
    shippingAddress: { type: 'object', required: true },
    payment: { type: 'object', required: true },
    items: { type: 'array', required: true },
    inventoryAdjustment: { type: 'object', nullable: true },
    subtotal: { type: 'number', min: 0, default: 0 },
    discountTotal: { type: 'number', min: 0, default: 0 },
    shippingCost: { type: 'number', min: 0, default: 0 },
    grandTotal: { type: 'number', min: 0, default: 0 },
    currency: { type: 'string', default: 'UAH' },
    notes: { type: 'text', nullable: true },
    createdAt: { type: 'datetime' },
    updatedAt: { type: 'datetime' },
    deletedAt: { type: 'datetime', nullable: true },
  },
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
};

const buildSaleItem = (item = {}) => {
  const quantity = Math.max(1, Math.floor(toNumber(item.quantity, 1)));
  const unitPrice = toNumber(item.unitPrice);
  const totalPrice = toNumber(item.totalPrice, quantity * unitPrice);

  return {
    merchandiseId: item.merchandiseId || null,
    sku: item.sku || '',
    name: item.name || '',
    image: item.image || null,
    selectedAttributes: Array.isArray(item.selectedAttributes) ? item.selectedAttributes : [],
    inventoryAttributeKey: item.inventoryAttributeKey || null,
    inventoryAttributeLabel: item.inventoryAttributeLabel || null,
    inventoryValueKey: item.inventoryValueKey || null,
    inventoryValueLabel: item.inventoryValueLabel || null,
    quantity,
    unitPrice,
    totalPrice,
  };
};

const normalizeSale = (data = {}) => {
  const items = Array.isArray(data.items) ? data.items.map(buildSaleItem) : [];
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountTotal = toNumber(data.discountTotal);
  const shippingCost = toNumber(data.shippingCost);

  return {
    orderNumber: data.orderNumber || '',
    status: data.status || 'pending_payment',
    customer: {
      firstName: data.customer?.firstName || '',
      lastName: data.customer?.lastName || '',
      phone: data.customer?.phone || '',
      email: data.customer?.email || '',
    },
    shippingAddress: {
      country: data.shippingAddress?.country || 'Ukraine',
      city: data.shippingAddress?.city || '',
      region: data.shippingAddress?.region || '',
      street: data.shippingAddress?.street || '',
      building: data.shippingAddress?.building || '',
      apartment: data.shippingAddress?.apartment || '',
      postalCode: data.shippingAddress?.postalCode || '',
      deliveryService: data.shippingAddress?.deliveryService || '',
      warehouse: data.shippingAddress?.warehouse || '',
      trackingNumber: data.shippingAddress?.trackingNumber || '',
    },
    payment: {
      method: data.payment?.method || 'card',
      status: data.payment?.status || 'unpaid',
      transactionId: data.payment?.transactionId || '',
      paidAt: data.payment?.paidAt ? new Date(data.payment.paidAt) : null,
    },
    items,
    subtotal,
    discountTotal,
    shippingCost,
    grandTotal: toNumber(data.grandTotal, Math.max(0, subtotal - discountTotal + shippingCost)),
    currency: data.currency || 'UAH',
    notes: data.notes || null,
    inventoryAdjustment: data.inventoryAdjustment || { state: 'none', updatedAt: null },
  };
};

const validateSale = (data = {}) => {
  const errors = [];

  if (!data.orderNumber || typeof data.orderNumber !== 'string') {
    errors.push('orderNumber is required');
  }
  if (!VALID_SALE_STATUSES.includes(data.status || 'pending_payment')) {
    errors.push(`status must be one of: ${VALID_SALE_STATUSES.join(', ')}`);
  }
  if (!data.customer?.firstName) errors.push('customer.firstName is required');
  if (!data.customer?.phone) errors.push('customer.phone is required');
  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push('items must contain at least one product');
  }
  if (data.payment?.method && !VALID_PAYMENT_METHODS.includes(data.payment.method)) {
    errors.push(`payment.method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
  }
  if (data.payment?.status && !VALID_PAYMENT_STATUSES.includes(data.payment.status)) {
    errors.push(`payment.status must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`);
  }

  return errors;
};

module.exports = {
  SaleSchema,
  VALID_SALE_STATUSES,
  VALID_PAYMENT_METHODS,
  VALID_PAYMENT_STATUSES,
  normalizeSale,
  validateSale,
};
