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
const { calculateCheckoutPayment } = require('../utils/paymentPricing');

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
  const requestedPaymentMethod = req.body.payment?.method;
  const hostedOnlinePayment = ['wayforpay', 'cash_on_delivery'].includes(requestedPaymentMethod);
  const checkoutTotal = subtotal + Math.max(0, Number(req.body.shippingCost || 0));
  const paymentPricing = hostedOnlinePayment
    ? calculateCheckoutPayment(checkoutTotal, requestedPaymentMethod)
    : null;
  const payment = {
    ...req.body.payment,
    method: requestedPaymentMethod,
    status: 'unpaid',
    transactionId: '',
    paidAt: null,
    googlePay: undefined,
    ...(paymentPricing || {}),
  };
  const status = hostedOnlinePayment ? 'pending_payment' : req.body.status;
  const paymentItems = requestedPaymentMethod === 'cash_on_delivery'
    ? [
      { name: 'Передоплата за замовлення', unitPrice: paymentPricing.basePaymentAmount, quantity: 1 },
      { name: 'Комісія WayForPay 2%', unitPrice: paymentPricing.serviceFee, quantity: 1 },
    ]
    : [
      ...items,
      ...(Number(req.body.shippingCost) > 0
        ? [{ name: 'Доставка', unitPrice: Math.max(0, Number(req.body.shippingCost)), quantity: 1 }]
        : []),
      { name: 'Комісія WayForPay 2%', unitPrice: paymentPricing?.serviceFee || 0, quantity: 1 },
    ];
  const paymentRedirect = hostedOnlinePayment
    ? wayForPayService.buildHostedPayment({
      orderReference: orderNumber,
      amount: paymentPricing.chargedAmount,
      currency: req.body.currency || 'UAH',
      items: paymentItems,
      customer: req.body.customer,
    })
    : null;

  const saleData = {
    ...req.body,
    userId: saleUserId,
    orderNumber,
    status,
    payment,
    items,
    subtotal,
    discountTotal: 0,
    grandTotal: paymentPricing?.orderTotal ?? checkoutTotal,
  };

  if (hostedOnlinePayment) {
    await salesService.createPaymentIntent(saleData, { userId, guestId });
    let paymentUrl;
    try {
      paymentUrl = await wayForPayService.createHostedPaymentUrl(paymentRedirect);
    } catch (error) {
      await salesService.failPaymentIntent(orderNumber, error.message);
      throw error;
    }
    return res.status(201).json(ApiResponse.success({
      orderNumber,
      status: 'pending_payment',
      payment,
      paymentRedirect: { url: paymentUrl },
    }, 'Payment initialized successfully'));
  }

  const item = await salesService.createSale(saleData);
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
  res.status(201).json(ApiResponse.success(
    paymentRedirect ? { ...item, paymentRedirect } : item,
    'Order created successfully'
  ));
});

const processWayForPayResult = async (payload) => {
  if (!wayForPayService.verifyCallback(payload)) {
    throw new ApiError('Invalid WayForPay callback signature', 400);
  }
  const result = await salesService.completeWayForPayPayment(payload);
  const item = result.item;
  if (item && !result.alreadyCompleted && result.owner) {
    await cartsService.clear(result.owner.userId, result.owner.guestId);
  }
  if (
    item
    && payload.transactionStatus === 'Approved'
    && getCheckboxConfig().autoFiscalize
    && !item.checkboxFiscalization?.receiptId
  ) {
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
      console.error(`Checkbox fiscalization failed for ${item.orderNumber}: ${error.message}`);
    }
  }
  return result;
};

const wayForPayCallback = asyncHandler(async (req, res) => {
  await processWayForPayResult(req.body);
  res.status(200).json(wayForPayService.buildCallbackAcceptance(req.body.orderReference));
});

const getWayForPayStatus = asyncHandler(async (req, res) => {
  const orderReference = String(req.params.orderReference || '');
  let result = await salesService.getPaymentIntentStatus(orderReference);
  if (['pending', 'completing'].includes(result.status)) {
    try {
      const providerResult = await wayForPayService.checkPaymentStatus(orderReference);
      if (providerResult.transactionStatus) {
        await processWayForPayResult(providerResult);
        result = await salesService.getPaymentIntentStatus(orderReference);
      }
    } catch (error) {
      // A temporary CHECK_STATUS failure must not hide the locally known state.
      console.error(`WayForPay status reconciliation failed for ${orderReference}: ${error.message}`);
    }
  }
  res.status(200).json(ApiResponse.success(result, 'Payment status retrieved successfully'));
});

const wayForPayReturn = asyncHandler(async (req, res) => {
  const returnPayload = { ...req.query, ...req.body };
  const orderReference = String(
    returnPayload.orderReference
    || ''
  ).trim();
  const clientUrl = process.env.CLIENT_URL
    || (process.env.NODE_ENV === 'production' ? 'https://uliastore.com.ua' : 'http://localhost:4200');
  const checkoutUrl = new URL('/checkout', clientUrl);
  checkoutUrl.searchParams.set('payment', 'return');
  if (orderReference) checkoutUrl.searchParams.set('orderReference', orderReference);

  // During local development WayForPay cannot call a localhost serviceUrl.
  // Its browser POST to returnUrl still contains the signed payment result, so
  // process that result before redirecting the customer back to Angular.
  if (req.method === 'POST' && returnPayload.transactionStatus) {
    try {
      await processWayForPayResult(returnPayload);
    } catch (error) {
      console.error(`WayForPay return processing failed for ${orderReference || 'unknown order'}: ${error.message}`);
      checkoutUrl.searchParams.set(
        'paymentError',
        error.statusCode === 400
          ? 'Не вдалося перевірити відповідь WayForPay.'
          : 'Не вдалося обробити результат оплати WayForPay.'
      );
    }
  } else if (returnPayload.reason && returnPayload.reason !== 'Ok') {
    checkoutUrl.searchParams.set(
      'paymentError',
      `WayForPay відхилив платіж: ${String(returnPayload.reason).slice(0, 160)}`
    );
  }
  res.redirect(303, checkoutUrl.toString());
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
  wayForPayCallback,
  getWayForPayStatus,
  wayForPayReturn,
  updateSale,
  deleteSale,
};
