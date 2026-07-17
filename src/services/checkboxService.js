const crypto = require('crypto');
const ApiError = require('../middleware/ApiError');
const { getCheckboxConfig, getMissingCheckboxConfig } = require('../config/checkbox');

let tokenCache = { token: null, expiresAt: 0, fingerprint: '' };

const cents = (value) => Math.round(Math.max(0, Number(value) || 0) * 100);
const money = (value) => Math.round((Number(value) || 0)) / 100;
const quantityFromCheckbox = (value) => Math.max(0, (Number(value) || 0) / 1000);
const uuidFromValue = (value) => {
  const hex = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
};

const configFingerprint = (config) =>
  `${config.baseUrl}|${config.cashierLogin}|${config.cashierPassword}|${config.cashierPin}|${config.licenseKey}`;

const parseApiError = async (response) => {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const message = body?.message || body?.detail?.[0]?.msg || `Checkbox API returned ${response.status}`;
  return new ApiError(message, response.status >= 500 ? 502 : response.status);
};

const assertConfigured = () => {
  const config = getCheckboxConfig();
  const missing = [
    !config.cashierPin && !config.cashierLogin && 'CHECKBOX_CASHIER_LOGIN або CHECKBOX_CASHIER_PIN',
    !config.cashierPin && !config.cashierPassword && 'CHECKBOX_CASHIER_PASSWORD або CHECKBOX_CASHIER_PIN',
    config.cashierPin && !config.licenseKey && 'CHECKBOX_LICENSE_KEY',
  ].filter(Boolean);
  if (missing.length) {
    throw new ApiError(`Checkbox is not configured. Missing: ${missing.join(', ')}`, 503);
  }
  return config;
};

const baseHeaders = (config) => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-Client-Name': config.clientName,
  'X-Client-Version': config.clientVersion,
  ...(config.accessKey ? { 'X-Access-Key': config.accessKey } : {}),
});

const signIn = async (config) => {
  const usePin = Boolean(config.cashierPin);
  const response = await fetch(`${config.baseUrl}/api/v1/cashier/${usePin ? 'signinPinCode' : 'signin'}`, {
    method: 'POST',
    headers: {
      ...baseHeaders(config),
      ...(usePin ? { 'X-License-Key': config.licenseKey } : {}),
    },
    body: JSON.stringify(usePin
      ? { pin_code: config.cashierPin }
      : { login: config.cashierLogin, password: config.cashierPassword }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw await parseApiError(response);
  const payload = await response.json();
  if (!payload.access_token) throw new ApiError('Checkbox did not return an access token', 502);

  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
    fingerprint: configFingerprint(config),
  };
  return tokenCache.token;
};

const getToken = async (config, forceRefresh = false) => {
  const fingerprint = configFingerprint(config);
  if (!forceRefresh && tokenCache.token && tokenCache.expiresAt > Date.now() && tokenCache.fingerprint === fingerprint) {
    return tokenCache.token;
  }
  return signIn(config);
};

const checkboxRequest = async (path, options = {}, retry = true) => {
  const config = assertConfigured();
  const token = await getToken(config);
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      ...baseHeaders(config),
      Authorization: `Bearer ${token}`,
      ...(options.licenseKey ? { 'X-License-Key': config.licenseKey } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20000),
  });

  if (response.status === 401 && retry) {
    await getToken(config, true);
    return checkboxRequest(path, options, false);
  }
  if (!response.ok) throw await parseApiError(response);
  if (response.status === 204) return null;
  return response.json();
};

const paginationFromPayload = (payload, page, limit, itemCount) => {
  const meta = payload?.meta || {};
  const explicitTotal = meta.total ?? meta.count ?? meta.total_count;
  const offset = (page - 1) * limit;
  // Checkbox returns only limit/offset in pagination metadata. Keep one
  // synthetic next record while a full page is returned so PrimeNG can page on.
  const inferredTotal = offset + itemCount + (itemCount === limit ? 1 : 0);
  const total = explicitTotal === undefined ? inferredTotal : Number(explicitTotal) || 0;
  return { total, page, limit, pages: Math.ceil(total / limit) };
};

const mapGood = (good = {}) => ({
  _id: `checkbox:${good.id}`,
  source: 'checkbox',
  externalId: good.id,
  sku: good.code || good.barcode || '',
  barcode: good.barcode || '',
  name: good.name || '',
  slug: '',
  categoryId: '',
  categorySlug: good.group_name || '',
  brandId: null,
  brandSlug: null,
  description: good.group_description || null,
  shortDescription: good.short_name || null,
  specifications: [],
  images: good.image_url ? [good.image_url] : [],
  inventory: { total_quantity: quantityFromCheckbox(good.count), tracked_attribute: null, attribute_quantities: [] },
  purchasePrice: 0,
  salePrice: money(good.price),
  discountPercentage: 0,
  retailPrice: money(good.price),
  currency: 'UAH',
  isActive: true,
  isVisible: true,
  isNewArrival: false,
  ownershipType: 'owned',
  seoTitle: null,
  seoDescription: null,
  seoKeywords: [],
  canonicalUrl: null,
  ogImage: null,
  checkbox: {
    type: good.type || null,
    groupId: good.group_id || null,
    groupName: good.group_name || null,
    taxes: good.taxes || [],
    isWeight: Boolean(good.is_weight),
  },
  createdAt: good.created_at || null,
  updatedAt: good.updated_at || good.created_at || null,
  deletedAt: null,
});

const getGoods = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const params = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit) });
  if (query.search) params.set('query', query.search);
  const payload = await checkboxRequest(`/api/v1/goods?${params}`);
  const results = Array.isArray(payload) ? payload : payload?.results || [];
  return { data: results.map(mapGood), pagination: paginationFromPayload(payload, page, limit, results.length) };
};

const normalizeGoodId = (value) => String(value || '').replace(/^checkbox:/, '');

const getGood = async (goodId) => {
  const id = normalizeGoodId(goodId);
  if (!id) throw new ApiError('Checkbox good ID is required', 400);
  const [raw, leftovers] = await Promise.all([
    checkboxRequest(`/api/v1/goods/${encodeURIComponent(id)}`),
    checkboxRequest('/api/v1/goods/leftovers-by-id', {
      method: 'POST',
      body: { good_ids: [id] },
    }),
  ]);
  return { product: mapGood(raw), raw, leftovers: Array.isArray(leftovers) ? leftovers : [] };
};

const editableGoodFields = [
  'name', 'short_name', 'type', 'code', 'is_weight', 'barcode', 'barcodes',
  'uktzed', 'group', 'tax_codes', 'children', 'position', 'branches_info',
  'external_id', 'source',
];

const buildEditGoodPayload = (data = {}) => {
  const payload = {};
  for (const field of editableGoodFields) {
    if (data[field] !== undefined) payload[field] = data[field];
  }
  if (data.price !== undefined) payload.price = cents(data.price);
  return payload;
};

const updateGood = async (goodId, data = {}) => {
  const id = normalizeGoodId(goodId);
  if (!id) throw new ApiError('Checkbox good ID is required', 400);
  const payload = buildEditGoodPayload(data);
  if (!Object.keys(payload).length) throw new ApiError('No supported Checkbox fields to update', 400);
  const raw = await checkboxRequest(`/api/v1/goods/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
  });
  return { product: mapGood(raw), raw, leftovers: [] };
};

const mapReceipt = (receipt = {}) => {
  const goods = Array.isArray(receipt.goods) ? receipt.goods : [];
  const payment = receipt.payments?.[0] || {};
  const createdAt = receipt.fiscal_date || receipt.created_at || null;
  return {
    _id: `checkbox:${receipt.id}`,
    source: 'checkbox',
    externalId: receipt.id,
    orderNumber: receipt.fiscal_code || `CHK-${receipt.serial ?? receipt.id}`,
    userId: null,
    status: receipt.type === 'RETURN' ? 'refunded' : receipt.status === 'DONE' ? 'delivered' : 'processing',
    customer: { firstName: 'Checkbox', lastName: '', phone: '', email: '' },
    shippingAddress: { country: 'Ukraine', city: '', region: '', street: '', building: '', apartment: '', postalCode: '', deliveryService: '', warehouse: '', trackingNumber: '' },
    payment: {
      method: payment.type === 'CASH' ? 'cash_on_delivery' : 'card',
      status: receipt.status === 'DONE' ? 'paid' : 'unpaid',
      transactionId: payment.transaction_id || '',
      paidAt: receipt.status === 'DONE' ? createdAt : null,
    },
    items: goods.map((row) => ({
      merchandiseId: null,
      sku: row.good?.code || '',
      name: row.good?.name || '',
      image: null,
      selectedAttributes: [],
      quantity: quantityFromCheckbox(row.quantity),
      unitPrice: money(row.good?.price),
      totalPrice: money(row.sum ?? row.total_sum),
    })),
    subtotal: money(receipt.total_sum),
    discountTotal: 0,
    shippingCost: 0,
    grandTotal: money(receipt.total_sum),
    currency: 'UAH',
    notes: null,
    checkbox: {
      fiscalCode: receipt.fiscal_code || null,
      fiscalDate: receipt.fiscal_date || null,
      receiptStatus: receipt.status || null,
      receiptType: receipt.type || null,
      taxUrl: receipt.tax_url || null,
      sentToDps: Boolean(receipt.is_sent_dps),
      context: receipt.context || null,
    },
    createdAt,
    updatedAt: receipt.updated_at || createdAt,
    deletedAt: null,
  };
};

const getReceipts = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const params = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit), desc: 'true' });
  if (query.fromDate) params.set('from_date', query.fromDate);
  if (query.toDate) params.set('to_date', query.toDate);
  const payload = await checkboxRequest(`/api/v1/receipts/search?${params}`);
  const results = Array.isArray(payload) ? payload : payload?.results || [];
  const filtered = query.search
    ? results.filter((item) => JSON.stringify(item).toLowerCase().includes(String(query.search).toLowerCase()))
    : results;
  return { data: filtered.map(mapReceipt), pagination: paginationFromPayload(payload, page, limit, filtered.length) };
};

const mapFinanceReceipts = (sales = []) => sales
    .filter((sale) => sale.checkbox?.receiptStatus === 'DONE')
    .filter((sale) => ['SELL', 'RETURN'].includes(sale.checkbox?.receiptType))
    .filter((sale) => sale.checkbox?.context?.source !== 'urban-nest')
    .map((sale) => {
      const isReturn = sale.checkbox.receiptType === 'RETURN';
      return {
        _id: sale._id,
        source: 'checkbox',
        grandTotal: isReturn ? -Math.abs(sale.grandTotal) : Math.abs(sale.grandTotal),
        paymentStatus: isReturn ? 'refunded' : 'paid',
        createdAt: sale.createdAt,
        fiscalCode: sale.checkbox.fiscalCode,
      };
    });

const getFinanceTotals = async (query = {}) => {
  const result = await getReceipts(query);
  const data = mapFinanceReceipts(result.data);
  return { data, pagination: result.pagination };
};

const buildReceiptPayload = (sale, receiptId = uuidFromValue(sale._id || sale.orderNumber)) => {
  const goods = (sale.items || []).map((item) => ({
    good: { code: item.sku || String(item.merchandiseId || ''), name: item.name, price: cents(item.unitPrice) },
    quantity: Math.max(1, Math.round((Number(item.quantity) || 1) * 1000)),
    total_sum: cents(item.totalPrice),
  }));
  if (Number(sale.shippingCost) > 0) {
    goods.push({ good: { code: 'DELIVERY', name: 'Доставка', price: cents(sale.shippingCost) }, quantity: 1000, total_sum: cents(sale.shippingCost) });
  }
  const targetTotal = cents(sale.grandTotal);
  const currentTotal = goods.reduce((sum, row) => sum + row.total_sum, 0);
  if (goods.length && currentTotal < targetTotal) {
    goods[goods.length - 1].total_sum += targetTotal - currentTotal;
  } else if (goods.length && currentTotal > targetTotal) {
    let reduction = currentTotal - targetTotal;
    for (let index = goods.length - 1; index >= 0 && reduction > 0; index -= 1) {
      const applied = Math.min(goods[index].total_sum, reduction);
      goods[index].total_sum -= applied;
      reduction -= applied;
    }
  }
  const isCash = sale.payment?.method === 'cash_on_delivery';
  return {
    id: receiptId,
    goods,
    delivery: {
      ...(sale.customer?.email ? { emails: [sale.customer.email] } : {}),
      ...(String(sale.customer?.phone || '').match(/^\+?380\d{9}$/) ? { phone: sale.customer.phone } : {}),
    },
    payments: [{ type: isCash ? 'CASH' : 'CASHLESS', value: cents(sale.grandTotal) }],
    context: { source: 'urban-nest', order_number: sale.orderNumber },
  };
};

const fiscalizeSale = async (sale, receiptId) => {
  if (!sale?.items?.length) throw new ApiError('Sale has no items to fiscalize', 400);
  if (sale.payment?.status !== 'paid') throw new ApiError('Only fully paid sales can be fiscalized', 400);
  const id = receiptId || uuidFromValue(sale._id || sale.orderNumber);
  const receipt = await checkboxRequest('/api/v1/receipts/sell', { method: 'POST', body: buildReceiptPayload(sale, id) });
  return { id, receipt, mapped: mapReceipt(receipt) };
};

const getStatus = () => {
  const config = getCheckboxConfig();
  const missing = getMissingCheckboxConfig(config);
  return { configured: missing.length === 0, autoFiscalize: config.autoFiscalize, missing };
};

module.exports = { getGoods, getGood, updateGood, getReceipts, getFinanceTotals, fiscalizeSale, getStatus, mapGood, mapReceipt, mapFinanceReceipts, buildEditGoodPayload, buildReceiptPayload };
