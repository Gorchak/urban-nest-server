const ApiError = require('../middleware/ApiError');

const API_URL = 'https://api.novaposhta.ua/v2.0/json/';
const API_KEY = process.env.NOVA_POSHTA_API_KEY || 'f07fa36452e9f238ceed8385f2cf1cfa';

const callNovaPoshta = async (modelName, calledMethod, methodProperties = {}) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: API_KEY,
      modelName,
      calledMethod,
      methodProperties,
    }),
  });

  if (!response.ok) {
    throw new ApiError(`Nova Poshta request failed with ${response.status}`, 502);
  }

  const payload = await response.json();
  if (!payload.success) {
    const message = [
      ...(payload.translatedErrors || []),
      ...(payload.errors || []),
      ...(payload.warnings || []),
    ].filter(Boolean).join(', ');
    throw new ApiError(message || 'Nova Poshta API returned an error', 400);
  }

  return payload.data || [];
};

const getAreas = () => callNovaPoshta('Address', 'getAreas');

const getCities = ({ areaRef, search, page = 1, limit = 500 } = {}) =>
  callNovaPoshta('Address', 'getCities', {
    Page: String(page),
    Limit: String(limit),
    ...(areaRef ? { AreaRef: areaRef } : {}),
    ...(search ? { FindByString: search } : {}),
  });

const getWarehouses = ({ cityRef, search, page = 1, limit = 500 } = {}) => {
  if (!cityRef) throw new ApiError('cityRef is required', 400);

  return callNovaPoshta('Address', 'getWarehouses', {
    CityRef: cityRef,
    Page: String(page),
    Limit: String(limit),
    ...(search ? { FindByString: search } : {}),
  });
};

const requiredSenderConfig = [
  'NOVA_POSHTA_SENDER_CITY_REF',
  'NOVA_POSHTA_SENDER_REF',
  'NOVA_POSHTA_SENDER_ADDRESS_REF',
  'NOVA_POSHTA_SENDER_CONTACT_REF',
  'NOVA_POSHTA_SENDER_PHONE',
];

const getMissingSenderConfig = () => requiredSenderConfig.filter((key) => !process.env[key]);

const hasSenderConfig = () => getMissingSenderConfig().length === 0;

const assertSenderConfig = () => {
  const missing = getMissingSenderConfig();
  if (missing.length) {
    throw new ApiError(`Nova Poshta sender config is missing: ${missing.join(', ')}`, 400);
  }
};

const normalizePhone = (phone = '') => phone.replace(/[^\d]/g, '');

const createInternetDocumentForSale = async (sale) => {
  assertSenderConfig();

  const recipientName = [
    sale.customer?.lastName,
    sale.customer?.firstName,
  ].filter(Boolean).join(' ').trim() || sale.customer?.firstName || 'Recipient';
  const description = sale.items?.map((item) => item.name).filter(Boolean).join(', ') || 'Urban Nest order';
  const cost = Math.max(1, Math.round(Number(sale.grandTotal || sale.subtotal || 1)));

  const data = await callNovaPoshta('InternetDocument', 'save', {
    PayerType: process.env.NOVA_POSHTA_PAYER_TYPE || 'Recipient',
    PaymentMethod: process.env.NOVA_POSHTA_PAYMENT_METHOD || 'Cash',
    DateTime: new Intl.DateTimeFormat('uk-UA').format(new Date()),
    CargoType: process.env.NOVA_POSHTA_CARGO_TYPE || 'Parcel',
    Weight: process.env.NOVA_POSHTA_DEFAULT_WEIGHT || '1',
    ServiceType: process.env.NOVA_POSHTA_SERVICE_TYPE || 'WarehouseWarehouse',
    SeatsAmount: process.env.NOVA_POSHTA_DEFAULT_SEATS || '1',
    Description: description.slice(0, 100),
    Cost: String(cost),
    CitySender: process.env.NOVA_POSHTA_SENDER_CITY_REF,
    Sender: process.env.NOVA_POSHTA_SENDER_REF,
    SenderAddress: process.env.NOVA_POSHTA_SENDER_ADDRESS_REF,
    ContactSender: process.env.NOVA_POSHTA_SENDER_CONTACT_REF,
    SendersPhone: normalizePhone(process.env.NOVA_POSHTA_SENDER_PHONE),
    CityRecipient: sale.shippingAddress.cityRef,
    RecipientAddress: sale.shippingAddress.warehouseRef,
    RecipientType: 'PrivatePerson',
    RecipientName: recipientName,
    RecipientsPhone: normalizePhone(sale.customer?.phone),
  });

  if (!data[0]?.IntDocNumber) {
    throw new ApiError('Nova Poshta did not return tracking number', 502);
  }

  return data[0];
};

module.exports = {
  getAreas,
  getCities,
  getWarehouses,
  hasSenderConfig,
  getMissingSenderConfig,
  createInternetDocumentForSale,
};
