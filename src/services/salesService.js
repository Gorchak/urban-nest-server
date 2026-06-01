const { ObjectId } = require('mongodb');
const { collections } = require('../config/collections');
const ApiError = require('../middleware/ApiError');
const { normalizeSale, validateSale } = require('../models/saleModel');
const { normalizeInventory } = require('../models/merchandiseModel');
const novaPoshtaService = require('./novaPoshtaService');

const isValidId = (id) => ObjectId.isValid(id);

const buildFilter = (query = {}) => {
  const filter = { deletedAt: null };

  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter['payment.status'] = query.paymentStatus;
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
  const filter = buildFilter(query);

  const cursor = collections.SALES
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const [items, total] = await Promise.all([
    cursor.toArray(),
    collections.SALES.countDocuments(filter),
  ]);

  return {
    data: items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
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
  return { ...doc, _id: result.insertedId };
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
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
};
