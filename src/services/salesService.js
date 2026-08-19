const { ObjectId } = require('mongodb');
const { collections } = require('../config/collections');
const ApiError = require('../middleware/ApiError');
const { normalizeSale, validateSale } = require('../models/saleModel');
const { normalizeInventory, calculateDiscountedPrice } = require('../models/merchandiseModel');
const novaPoshtaService = require('./novaPoshtaService');
const mailService = require('./mailService');
const smsService = require('./smsService');
const userService = require('./userService');

const isValidId = (id) => ObjectId.isValid(id);

const getCategoryFilterIds = async (categoryId) => {
  if (!categoryId) return [];
  if (!isValidId(categoryId)) throw new ApiError('Invalid categoryId format', 400);

  const categoryObjectId = new ObjectId(categoryId);
  const categories = await collections.CATEGORIES
    .find({
      deletedAt: null,
      $or: [{ _id: categoryObjectId }, { parentId: categoryObjectId }],
    })
    .project({ _id: 1 })
    .toArray();

  return categories.map((category) => category._id);
};

const getMerchandiseIdsByCategory = async (categoryId) => {
  const categoryIds = await getCategoryFilterIds(categoryId);
  if (!categoryIds.length) return [];

  const merchandise = await collections.MERCHANDISE
    .find({ deletedAt: null, categoryId: { $in: categoryIds } })
    .project({ _id: 1 })
    .toArray();

  return merchandise.map((item) => String(item._id));
};

const hydrateSaleItems = async (sales = []) => {
  const merchandiseIds = [
    ...new Set(sales.flatMap((sale) =>
      (sale.items || [])
        .map((item) => item.merchandiseId)
        .filter((id) => id && isValidId(id))
    )),
  ];

  if (!merchandiseIds.length) return sales;

  const merchandise = await collections.MERCHANDISE
    .find({ _id: { $in: merchandiseIds.map((id) => new ObjectId(id)) } })
    .project({ slug: 1, categoryId: 1, categorySlug: 1 })
    .toArray();
  const merchandiseById = new Map(merchandise.map((item) => [String(item._id), item]));

  return sales.map((sale) => ({
    ...sale,
    items: (sale.items || []).map((item) => {
      const product = item.merchandiseId ? merchandiseById.get(String(item.merchandiseId)) : null;
      if (!product) return item;

      return {
        ...item,
        merchandiseSlug: item.merchandiseSlug || product.slug || null,
        categoryId: item.categoryId || (product.categoryId ? String(product.categoryId) : null),
        categorySlug: item.categorySlug || product.categorySlug || null,
      };
    }),
  }));
};

const buildFilter = async (query = {}) => {
  const includeDeleted = query.includeDeleted === true || query.includeDeleted === 'true';
  const filter = includeDeleted ? {} : { deletedAt: null };

  if (query.userId) filter.userId = query.userId;
  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter['payment.status'] = query.paymentStatus;
  if (query.categoryId) {
    const merchandiseIds = await getMerchandiseIdsByCategory(query.categoryId);
    filter['items.merchandiseId'] = merchandiseIds.length ? { $in: merchandiseIds } : { $in: ['__no_merchandise__'] };
  }
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { orderNumber: re },
      { 'customer.firstName': re },
      { 'customer.lastName': re },
      { 'customer.phone': re },
      { 'customer.email': re },
    ];
  }

  return filter;
};

const getSalesList = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const filter = await buildFilter(query);

  const cursor = collections.SALES
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const [items, total, totals] = await Promise.all([
    cursor.toArray(),
    collections.SALES.countDocuments(filter),
    collections.SALES.aggregate([
      { $match: filter },
      { $group: { _id: null, grandTotal: { $sum: '$grandTotal' } } },
    ]).toArray(),
  ]);

  return {
    data: await hydrateSaleItems(items),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      grandTotal: totals[0]?.grandTotal || 0,
    },
  };
};

const getFinanceTotalList = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;
  const filter = { deletedAt: null };

  if (query.fromDate) {
    filter.createdAt = filter.createdAt || {};
    filter.createdAt.$gte = new Date(query.fromDate);
  }
  if (query.toDate) {
    filter.createdAt = filter.createdAt || {};
    filter.createdAt.$lte = new Date(query.toDate);
  }

  const cursor = collections.SALES
    .find(filter)
    .project({ grandTotal: 1, createdAt: 1, 'payment.status': 1 })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const [items, total] = await Promise.all([
    cursor.toArray(),
    collections.SALES.countDocuments(filter),
  ]);

  return {
    data: items.map((item) => ({
      _id: String(item._id),
      grandTotal: Number(item.grandTotal) || 0,
      paymentStatus: item.payment?.status || 'unpaid',
      createdAt: item.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

const getUserSalesList = async (userId, query = {}) => {
  if (!userId) throw new ApiError('Authentication required', 401);
  return getSalesList({ ...query, userId });
};

const getSaleById = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid sale ID format', 400);
  const item = await collections.SALES.findOne({ _id: new ObjectId(id), deletedAt: null });
  if (!item) throw new ApiError('Sale not found', 404);
  return item;
};

const getAdjustmentState = (sale) => sale?.inventoryAdjustment?.state || 'none';

const DEDUCTED_STATUSES = new Set(['shipped', 'delivered']);

const determineInventoryAction = (previousSale, nextSale) => {
  const previousState = getAdjustmentState(previousSale);

  if (DEDUCTED_STATUSES.has(nextSale.status) && previousState !== 'deducted') {
    return 'deduct';
  }

  if (!DEDUCTED_STATUSES.has(nextSale.status) && previousState === 'deducted') {
    return 'return';
  }

  return null;
};

const shouldCreateNovaPoshtaDocument = (sale) =>
  sale.shippingAddress?.deliveryService === 'nova_poshta' &&
  DEDUCTED_STATUSES.has(sale.status) &&
  sale.shippingAddress?.warehouseRef &&
  !sale.shippingAddress?.trackingNumber;

const ensureNovaPoshtaDocument = async (sale) => {
  if (!shouldCreateNovaPoshtaDocument(sale)) return sale;
  if (!novaPoshtaService.hasSenderConfig()) {
    return {
      ...sale,
      shippingAddress: {
        ...sale.shippingAddress,
        novaPoshtaDocumentStatus: 'sender_config_missing',
        novaPoshtaDocumentError: `Missing sender config: ${novaPoshtaService.getMissingSenderConfig().join(', ')}`,
      },
    };
  }

  const document = await novaPoshtaService.createInternetDocumentForSale(sale);
  return {
    ...sale,
    shippingAddress: {
      ...sale.shippingAddress,
      trackingNumber: document.IntDocNumber || sale.shippingAddress.trackingNumber,
      novaPoshtaDocumentRef: document.Ref || '',
      novaPoshtaCostOnSite: document.CostOnSite || '',
      novaPoshtaEstimatedDeliveryDate: document.EstimatedDeliveryDate || '',
    },
  };
};

const applyInventoryAction = async (sale, action) => {
  if (!action) return sale.inventoryAdjustment || { state: 'none', updatedAt: null };

  const direction = action === 'deduct' ? -1 : 1;

  for (const item of sale.items) {
    if (!item.merchandiseId) continue;
    if (!isValidId(item.merchandiseId)) {
      throw new ApiError(`Invalid merchandiseId for "${item.name || item.sku}"`, 400);
    }

    const merchandise = await collections.MERCHANDISE.findOne({
      _id: new ObjectId(item.merchandiseId),
      deletedAt: null,
    });
    if (!merchandise) {
      throw new ApiError(`Merchandise "${item.name || item.merchandiseId}" not found`, 404);
    }

    const inventory = normalizeInventory(merchandise);
    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));

    if (inventory.tracked_attribute) {
      if (!item.inventoryValueKey) {
        throw new ApiError(`Inventory value is required for "${item.name || merchandise.name}"`, 400);
      }

      const rowIndex = inventory.attribute_quantities.findIndex(
        (row) => row.value_key === item.inventoryValueKey
      );
      if (rowIndex === -1) {
        throw new ApiError(`Inventory value "${item.inventoryValueLabel || item.inventoryValueKey}" was not found for "${merchandise.name}"`, 400);
      }

      const current = inventory.attribute_quantities[rowIndex].quantity;
      const next = current + direction * quantity;
      if (next < 0) {
        throw new ApiError(`Not enough stock for "${merchandise.name}" (${inventory.attribute_quantities[rowIndex].value_label})`, 400);
      }

      inventory.attribute_quantities[rowIndex] = {
        ...inventory.attribute_quantities[rowIndex],
        quantity: next,
      };
      inventory.total_quantity = inventory.attribute_quantities.reduce(
        (sum, row) => sum + row.quantity,
        0
      );
    } else {
      const next = inventory.total_quantity + direction * quantity;
      if (next < 0) {
        throw new ApiError(`Not enough stock for "${merchandise.name}"`, 400);
      }
      inventory.total_quantity = next;
    }

    await collections.MERCHANDISE.updateOne(
      { _id: merchandise._id },
      { $set: { inventory, stockQuantity: inventory.total_quantity, updatedAt: new Date() } }
    );
  }

  return {
    state: action === 'deduct' ? 'deducted' : 'returned',
    updatedAt: new Date(),
  };
};

const createSale = async (data) => {
  const normalized = normalizeSale(data);
  const errors = validateSale(normalized);
  if (errors.length) throw new ApiError(errors.join(', '), 400);

  const existing = await collections.SALES.findOne({
    orderNumber: normalized.orderNumber,
    deletedAt: null,
  });
  if (existing) throw new ApiError(`Sale "${normalized.orderNumber}" already exists`, 409);

  const now = new Date();
  const saleWithDelivery = await ensureNovaPoshtaDocument(normalized);
  const inventoryAdjustment = await applyInventoryAction(
    saleWithDelivery,
    determineInventoryAction(null, saleWithDelivery)
  );
  const doc = { ...saleWithDelivery, inventoryAdjustment, createdAt: now, updatedAt: now, deletedAt: null };
  const result = await collections.SALES.insertOne(doc);
  let created = { ...doc, _id: result.insertedId };
  try {
    const notification = await mailService.sendOrderNotification(created);
    const emailNotification = {
      status: notification.sent ? 'sent' : notification.reason,
      sentAt: notification.sent ? new Date() : null,
      messageId: notification.messageId || null,
      recipient: notification.recipient || null,
      customerSent: notification.customerSent || false,
      customerMessageId: notification.customerMessageId || null,
      customerRecipient: notification.customerRecipient || null,
      missingConfig: notification.missing || [],
    };
    await collections.SALES.updateOne({ _id: result.insertedId }, { $set: { emailNotification } });
    created = { ...created, emailNotification };
  } catch (error) {
    const emailNotification = { status: 'failed', sentAt: null, error: error.message };
    await collections.SALES.updateOne({ _id: result.insertedId }, { $set: { emailNotification } });
    created = { ...created, emailNotification };
    console.error(`Order email failed: ${error.message}`);
  }
  try {
    const notification = await smsService.sendOrderSmsNotification(created);
    const smsNotification = {
      status: notification.sent ? 'sent' : notification.reason,
      sentAt: notification.sent ? new Date() : null,
      recipient: notification.recipient || null,
      missingConfig: notification.missing || [],
      providerResponse: notification.providerResponse || null,
    };
    await collections.SALES.updateOne({ _id: result.insertedId }, { $set: { smsNotification } });
    created = { ...created, smsNotification };
  } catch (error) {
    const smsNotification = { status: 'failed', sentAt: null, error: error.message };
    await collections.SALES.updateOne({ _id: result.insertedId }, { $set: { smsNotification } });
    created = { ...created, smsNotification };
    console.error(`Order SMS failed: ${error.message}`);
  }
  return created;
};

const createPaymentIntent = async (data, owner = {}) => {
  const normalized = normalizeSale(data);
  const errors = validateSale(normalized);
  if (errors.length) throw new ApiError(errors.join(', '), 400);

  const existingSale = await collections.SALES.findOne({
    orderNumber: normalized.orderNumber,
    deletedAt: null,
  });
  if (existingSale) throw new ApiError(`Sale "${normalized.orderNumber}" already exists`, 409);

  const now = new Date();
  const intent = {
    orderNumber: normalized.orderNumber,
    status: 'pending',
    sale: normalized,
    owner: {
      userId: owner.userId || null,
      guestId: owner.guestId || null,
    },
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  };
  try {
    await collections.PAYMENT_INTENTS.insertOne(intent);
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(`Payment intent "${normalized.orderNumber}" already exists`, 409);
    throw error;
  }
  return intent;
};

const getPaymentIntentStatus = async (orderNumber) => {
  const sale = await collections.SALES.findOne({ orderNumber, deletedAt: null });
  if (sale?.payment?.status === 'paid') {
    return { orderReference: orderNumber, status: 'approved' };
  }
  const intent = await collections.PAYMENT_INTENTS.findOne({ orderNumber });
  if (!intent) return { orderReference: orderNumber, status: 'not_found' };
  return {
    orderReference: orderNumber,
    status: intent.status === 'completed' ? 'approved' : intent.status,
    reason: intent.reason || null,
  };
};

const failPaymentIntent = async (orderNumber, reason) => {
  await collections.PAYMENT_INTENTS.updateOne(
    { orderNumber, status: { $ne: 'completed' } },
    {
      $set: {
        status: 'declined',
        reason: String(reason || 'Payment initialization failed'),
        updatedAt: new Date(),
      },
    }
  );
};

const completeWayForPayPayment = async (payload = {}) => {
  const orderNumber = String(payload.orderReference || '');
  const existingSale = await collections.SALES.findOne({ orderNumber, deletedAt: null });
  if (existingSale?.payment?.status === 'paid') {
    return { item: existingSale, owner: null, alreadyCompleted: true };
  }

  const intent = await collections.PAYMENT_INTENTS.findOne({ orderNumber });
  if (!intent) return { item: await applyWayForPayCallback(payload), owner: null, alreadyCompleted: true };

  const callbackAmount = Math.round((Number(payload.amount) || 0) * 100);
  const intentAmount = Math.round((Number(intent.sale.grandTotal) || 0) * 100);
  if (callbackAmount !== intentAmount || String(payload.currency || '') !== intent.sale.currency) {
    throw new ApiError('WayForPay payment amount or currency does not match the order', 400);
  }

  if (payload.transactionStatus !== 'Approved') {
    await collections.PAYMENT_INTENTS.updateOne(
      { _id: intent._id, status: { $ne: 'completed' } },
      {
        $set: {
          status: 'declined',
          reason: payload.reason || 'Payment was not approved',
          reasonCode: payload.reasonCode || null,
          updatedAt: new Date(),
        },
      }
    );
    return { item: null, owner: intent.owner, alreadyCompleted: false };
  }

  const staleCompletionBefore = new Date(Date.now() - 2 * 60 * 1000);
  const claimed = await collections.PAYMENT_INTENTS.findOneAndUpdate(
    {
      _id: intent._id,
      $or: [
        { status: { $in: ['pending', 'declined'] } },
        { status: 'completing', updatedAt: { $lt: staleCompletionBefore } },
      ],
    },
    { $set: { status: 'completing', updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!claimed) {
    const completedSale = await collections.SALES.findOne({ orderNumber, deletedAt: null });
    return { item: completedSale, owner: intent.owner, alreadyCompleted: true };
  }

  try {
    const item = await createSale({
      ...claimed.sale,
      status: 'processing',
      payment: {
        ...claimed.sale.payment,
        method: 'wayforpay',
        status: 'paid',
        transactionId: payload.authCode || orderNumber,
        paidAt: new Date(),
        cardNetwork: payload.cardType || null,
        cardDetails: payload.cardPan || null,
      },
    });
    await collections.PAYMENT_INTENTS.updateOne(
      { _id: claimed._id },
      { $set: { status: 'completed', completedAt: new Date(), updatedAt: new Date() } }
    );
    return { item, owner: claimed.owner, alreadyCompleted: false };
  } catch (error) {
    await collections.PAYMENT_INTENTS.updateOne(
      { _id: claimed._id },
      { $set: { status: 'pending', completionError: error.message, updatedAt: new Date() } }
    );
    throw error;
  }
};

const createQuickOrder = async (data = {}) => {
  const phone = userService.normalizePhone(data.phone || '');
  if (!phone) throw new ApiError('Phone is required', 400);
  if (!data.merchandiseId || !isValidId(data.merchandiseId)) {
    throw new ApiError('Valid merchandiseId is required', 400);
  }

  const product = await collections.MERCHANDISE.findOne({
    _id: new ObjectId(data.merchandiseId),
    deletedAt: null,
    isActive: true,
    isVisible: true,
  });
  if (!product) throw new ApiError('Merchandise not found', 404);

  const inventory = normalizeInventory(product);
  const variant = data.inventoryValueKey
    ? inventory.attribute_quantities.find((row) => row.value_key === data.inventoryValueKey)
    : null;
  if (inventory.tracked_attribute && !variant) {
    throw new ApiError('Product option is required', 400);
  }

  const available = inventory.tracked_attribute ? Number(variant?.quantity || 0) : Number(inventory.total_quantity || 0);
  if (available < 1) throw new ApiError('Product is out of stock', 400);

  const user = await userService.findOrCreateByPhone(phone);
  const listUnitPrice = Math.max(0, Number(product.salePrice) || 0);
  const discountPercentage = Math.min(100, Math.max(0, Number(product.discountPercentage) || 0));
  const unitPrice = calculateDiscountedPrice(listUnitPrice, discountPercentage);
  const item = {
    merchandiseId: String(product._id),
    merchandiseSlug: product.slug || null,
    categoryId: product.categoryId ? String(product.categoryId) : null,
    categorySlug: product.categorySlug || null,
    sku: product.sku,
    name: product.name,
    image: product.images?.[0] || null,
    selectedAttributes: variant
      ? [{ label: inventory.tracked_attribute?.attribute_label || '', value: variant.value_label }]
      : [],
    inventoryAttributeKey: inventory.tracked_attribute?.attribute_key || null,
    inventoryAttributeLabel: inventory.tracked_attribute?.attribute_label || null,
    inventoryValueKey: variant?.value_key || null,
    inventoryValueLabel: variant?.value_label || null,
    quantity: 1,
    listUnitPrice,
    discountPercentage,
    discountAmount: Math.round((listUnitPrice - unitPrice) * 100) / 100,
    unitPrice,
    totalPrice: unitPrice,
  };

  return createSale({
    orderNumber: data.orderNumber || `QO-${Date.now().toString(36).toUpperCase()}`,
    userId: user.userId,
    status: 'processing',
    customer: { firstName: '', lastName: '', phone, email: '' },
    shippingAddress: { country: 'Ukraine' },
    payment: { method: 'cash_on_delivery', status: 'unpaid' },
    items: [item],
    subtotal: unitPrice,
    discountTotal: 0,
    shippingCost: 0,
    grandTotal: unitPrice,
    currency: product.currency || 'UAH',
    notes: 'Швидке замовлення: Купити в 1 клік',
  });
};

const setCheckboxFiscalization = async (id, checkboxFiscalization) => {
  const objectId = id instanceof ObjectId ? id : new ObjectId(id);
  await collections.SALES.updateOne(
    { _id: objectId, deletedAt: null },
    { $set: { checkboxFiscalization, updatedAt: new Date() } }
  );
};

const applyWayForPayCallback = async (payload = {}) => {
  const orderNumber = String(payload.orderReference || '');
  const existing = await collections.SALES.findOne({ orderNumber, deletedAt: null });
  if (!existing) throw new ApiError('Sale not found', 404);

  const callbackAmount = Math.round((Number(payload.amount) || 0) * 100);
  const saleAmount = Math.round((Number(existing.grandTotal) || 0) * 100);
  if (callbackAmount !== saleAmount || String(payload.currency || '') !== existing.currency) {
    throw new ApiError('WayForPay payment amount or currency does not match the order', 400);
  }

  if (payload.transactionStatus !== 'Approved') return existing;
  if (existing.payment?.status === 'paid') return existing;

  return updateSale(existing._id, {
    ...existing,
    status: 'processing',
    payment: {
      ...existing.payment,
      status: 'paid',
      transactionId: payload.authCode || orderNumber,
      paidAt: new Date(),
      cardNetwork: payload.cardType || null,
      cardDetails: payload.cardPan || null,
    },
  });
};

const updateSale = async (id, updates) => {
  if (!isValidId(id)) throw new ApiError('Invalid sale ID format', 400);
  const existing = await getSaleById(id);
  const normalized = normalizeSale({ ...existing, ...updates });
  const errors = validateSale(normalized);
  if (errors.length) throw new ApiError(errors.join(', '), 400);

  if (normalized.orderNumber !== existing.orderNumber) {
    const duplicate = await collections.SALES.findOne({
      orderNumber: normalized.orderNumber,
      deletedAt: null,
      _id: { $ne: new ObjectId(id) },
    });
    if (duplicate) throw new ApiError(`Sale "${normalized.orderNumber}" already exists`, 409);
  }

  const saleWithDelivery = await ensureNovaPoshtaDocument(normalized);

  saleWithDelivery.inventoryAdjustment = await applyInventoryAction(
    saleWithDelivery,
    determineInventoryAction(existing, saleWithDelivery)
  );

  const result = await collections.SALES.findOneAndUpdate(
    { _id: new ObjectId(id), deletedAt: null },
    { $set: { ...saleWithDelivery, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('Sale not found', 404);
  return result;
};

const deleteSale = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid sale ID format', 400);
  const existing = await getSaleById(id);
  const inventoryAdjustment = getAdjustmentState(existing) === 'deducted'
    ? await applyInventoryAction(existing, 'return')
    : existing.inventoryAdjustment;
  const result = await collections.SALES.findOneAndUpdate(
    { _id: new ObjectId(id), deletedAt: null },
    { $set: { inventoryAdjustment, deletedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) throw new ApiError('Sale not found', 404);
  return result;
};

module.exports = {
  getSalesList,
  getFinanceTotalList,
  getUserSalesList,
  getSaleById,
  createSale,
  createPaymentIntent,
  failPaymentIntent,
  getPaymentIntentStatus,
  completeWayForPayPayment,
  createQuickOrder,
  setCheckboxFiscalization,
  applyWayForPayCallback,
  updateSale,
  deleteSale,
};
