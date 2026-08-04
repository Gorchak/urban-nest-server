const salesService = require('../services/salesService');
const { ApiResponse } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const cartsService = require('../services/cartsService');
const userService = require('../services/userService');
const ApiError = require('../middleware/ApiError');
const { calculateDiscountedPrice } = require('../models/merchandiseModel');
const checkboxService = require('../services/checkboxService');
const { getCheckboxConfig } = require('../config/checkbox');
const wayForPayService = require('../services/wayForPayService');

const getSales = asyncHandler(async (req, res) => {
  const result = await salesService.getSalesList(req.query);
  res.status(200).json(ApiResponse.success(result.data, 'Sales retrieved successfully', result.pagination));
});

const getFinanceTotals = asyncHandler(async (req, res) => {
  const result = await salesService.getFinanceTotalList(req.query);
  res.status(200).json(ApiResponse.success(result.data, 'Sales totals retrieved successfully', result.pagination));
});

const getMySales = asyncHandler(async (req, res) => {
  const result = await salesService.getUserSalesList(req.auth.sub, req.query);
  res.status(200).json(ApiResponse.success(result.data, 'Sales retrieved successfully', result.pagination));
});

const getSaleById = asyncHandler(async (req, res) => {
  const item = await salesService.getSaleById(req.params.id);
  res.status(200).json(ApiResponse.success(item, 'Sale retrieved successfully'));
});

const createSale = asyncHandler(async (req, res) => {
  const item = await salesService.createSale(req.body);
  res.status(201).json(ApiResponse.success(item, 'Sale created successfully'));
});

const quickOrder = asyncHandler(async (req, res) => {
  const item = await salesService.createQuickOrder(req.body);
  res.status(201).json(ApiResponse.success(item, 'Quick order created successfully'));
});

const checkout = asyncHandler(async (req, res) => {
  const userId = req.auth?.sub || null;
  const guestId = userId ? null : String(req.body.guestId || '');
  if (!userId && !guestId) throw new ApiError('guestId is required', 400);
  const cart = await cartsService.getByOwner(userId, guestId);
  const availableItems = (cart?.items || []).filter((cartItem) => cartItem.product);
  if (!availableItems.length) {
    throw new ApiError('Cart is empty', 400);
  }
  const items = availableItems.map((cartItem) => {
    const listUnitPrice = Math.max(0, Number(cartItem.product.salePrice) || 0);
    const discountPercentage = Math.min(100, Math.max(0, Number(cartItem.product.discountPercentage) || 0));
    const unitPrice = calculateDiscountedPrice(listUnitPrice, discountPercentage);
    return {
      merchandiseId: cartItem.merchandiseId,
      merchandiseSlug: cartItem.product.slug || null,
      categoryId: cartItem.product.categoryId ? String(cartItem.product.categoryId) : null,
      categorySlug: cartItem.product.categorySlug || null,
      sku: cartItem.product.sku,
      name: cartItem.product.name,
      image: cartItem.product.images?.[0] || null,
      selectedAttributes: cartItem.inventoryValueLabel
        ? [{ label: cartItem.product.inventory?.tracked_attribute?.attribute_label || '', value: cartItem.inventoryValueLabel }]
        : [],
      inventoryAttributeKey: cartItem.product.inventory?.tracked_attribute?.attribute_key || null,
      inventoryAttributeLabel: cartItem.product.inventory?.tracked_attribute?.attribute_label || null,
      inventoryValueKey: cartItem.inventoryValueKey,
      inventoryValueLabel: cartItem.inventoryValueLabel,
      quantity: cartItem.quantity,
      listUnitPrice,
      discountPercentage,
      discountAmount: Math.round((listUnitPrice - unitPrice) * cartItem.quantity * 100) / 100,
      unitPrice,
      totalPrice: Math.round(unitPrice * cartItem.quantity * 100) / 100,
    };
  });
  availableItems.forEach((cartItem) => {
    const inventory = cartItem.product.inventory;
    const available = inventory.tracked_attribute
      ? inventory.attribute_quantities.find((row) => row.value_key === cartItem.inventoryValueKey)?.quantity ?? 0
      : inventory.total_quantity;
    if (cartItem.quantity > available) {
      throw new ApiError(`Not enough stock for "${cartItem.product.name}"`, 400);
    }
  });
  const subtotal = items.reduce((sum, saleItem) => sum + saleItem.totalPrice, 0);
  const saleUserId = userId || (req.body.quickOrder && req.body.customer?.phone
    ? (await userService.findOrCreateByPhone(req.body.customer.phone)).userId
    : null);
  const orderNumber = req.body.orderNumber || `UN-${Date.now().toString(36).toUpperCase()}`;
  let payment = { ...req.body.payment, status: 'unpaid', transactionId: '', paidAt: null };
  let status = req.body.status;

  if (req.body.payment?.method === 'google_pay') {
    const charge = await wayForPayService.chargeGooglePay({
      orderReference: orderNumber,
      amount: subtotal + Math.max(0, Number(req.body.shippingCost || 0)),
      currency: req.body.currency || 'UAH',
      items,
      customer: req.body.customer,
      clientIp: [req.ip, req.ips, req.socket?.remoteAddress],
      googlePay: req.body.payment.googlePay,
    });
    payment = {
      ...payment,
      status: 'paid',
      transactionId: charge.authCode || charge.orderReference || orderNumber,
      paidAt: new Date(),
      cardNetwork: charge.cardType || req.body.payment.googlePay?.cardNetwork || null,
      cardDetails: charge.cardPan || req.body.payment.googlePay?.cardDetails || null,
      tokenizationType: req.body.payment.googlePay?.tokenizationType || null,
    };
    status = 'processing';
  }

  const item = await salesService.createSale({
    ...req.body,
    userId: saleUserId,
    orderNumber,
    status,
    payment,
    items,
    subtotal,
    discountTotal: 0,
    grandTotal: subtotal + Math.max(0, Number(req.body.shippingCost || 0)),
  });
  if (getCheckboxConfig().autoFiscalize && item.payment?.status === 'paid') {
    try {
      const fiscalized = await checkboxService.fiscalizeSale(item);
      await salesService.setCheckboxFiscalization(item._id, {
        status: fiscalized.receipt?.status || 'CREATED',
        receiptId: fiscalized.id,
        fiscalCode: fiscalized.receipt?.fiscal_code || null,
        fiscalizedAt: fiscalized.receipt?.fiscal_date || null,
        updatedAt: new Date(),
      });
    } catch (error) {
      await salesService.setCheckboxFiscalization(item._id, {
        status: 'failed',
        receiptId: null,
        fiscalCode: null,
        fiscalizedAt: null,
        error: error.message,
        updatedAt: new Date(),
      });
      console.error(`Checkbox fiscalization failed for ${item.orderNumber}: ${error.message}`);
    }
  }
  await cartsService.clear(userId, guestId);
  res.status(201).json(ApiResponse.success(item, 'Order created successfully'));
});

const updateSale = asyncHandler(async (req, res) => {
  const item = await salesService.updateSale(req.params.id, req.body);
  res.status(200).json(ApiResponse.success(item, 'Sale updated successfully'));
});

const deleteSale = asyncHandler(async (req, res) => {
  await salesService.deleteSale(req.params.id);
  res.status(200).json(ApiResponse.success(null, 'Sale deleted successfully'));
});

module.exports = {
  getSales,
  getFinanceTotals,
  getMySales,
  getSaleById,
  createSale,
  quickOrder,
  checkout,
  updateSale,
  deleteSale,
};
