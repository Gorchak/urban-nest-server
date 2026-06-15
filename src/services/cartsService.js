const { ObjectId } = require('mongodb');
const { collections } = require('../config/collections');
const ApiError = require('../middleware/ApiError');
const { normalizeCartItem, validateCartItem } = require('../models/cartModel');
const { normalizeMerchandiseItem } = require('../models/merchandiseModel');

const itemKey = (item) => `${item.merchandiseId}:${item.inventoryValueKey || ''}`;
const ownerFilter = (userId, guestId) => userId ? { userId } : { userId: null, guestId };

const hydrateCart = async (cart) => {
  if (!cart) return null;
  const ids = cart.items
    .map((item) => item.merchandiseId)
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  const products = ids.length
    ? await collections.MERCHANDISE.find({ _id: { $in: ids }, deletedAt: null }).toArray()
    : [];
  const productMap = new Map(products.map((product) => [String(product._id), normalizeMerchandiseItem(product)]));

  return {
    ...cart,
    items: cart.items.map((item) => ({ ...item, product: productMap.get(item.merchandiseId) || null })),
  };
};

const getByOwner = async (userId, guestId) => hydrateCart(
  await collections.CARTS.findOne({ ...ownerFilter(userId, guestId), deletedAt: null })
);

const getOrCreate = async (userId, guestId, user = {}) => {
  const owner = ownerFilter(userId, guestId);
  const existing = await collections.CARTS.findOne({ ...owner, deletedAt: null });
  if (existing) {
    if (user.email && existing.user?.email !== user.email) {
      existing.user = { userId, email: user.email };
      await collections.CARTS.updateOne({ _id: existing._id }, { $set: { user: existing.user, updatedAt: new Date() } });
    }
    return hydrateCart(existing);
  }
  const now = new Date();
  const cart = { userId: userId || null, guestId: userId ? null : guestId, user: { userId: userId || '', email: user.email || '' }, items: [], createdAt: now, updatedAt: now, deletedAt: null };
  const result = await collections.CARTS.insertOne(cart);
  return hydrateCart({ ...cart, _id: result.insertedId });
};

const addItem = async (userId, guestId, input, user = {}) => {
  const item = normalizeCartItem(input);
  const errors = validateCartItem(item);
  if (errors.length) throw new ApiError(errors.join(', '), 400);
  if (!ObjectId.isValid(item.merchandiseId)) throw new ApiError('Invalid merchandiseId', 400);

  const product = await collections.MERCHANDISE.findOne({
    _id: new ObjectId(item.merchandiseId), deletedAt: null, isActive: true, isVisible: true,
  });
  if (!product) throw new ApiError('Merchandise not found', 404);
  const inventory = normalizeMerchandiseItem(product).inventory;
  if (inventory.tracked_attribute && !item.inventoryValueKey) {
    throw new ApiError('Select a product option', 400);
  }
  const maxQuantity = inventory.tracked_attribute
    ? inventory.attribute_quantities.find((row) => row.value_key === item.inventoryValueKey)?.quantity ?? 0
    : inventory.total_quantity;
  if (maxQuantity < 1) throw new ApiError('Product is out of stock', 400);

  const cart = await getOrCreate(userId, guestId, user);
  const key = itemKey(item);
  const items = cart.items.map(({ product: _product, ...stored }) => stored);
  const index = items.findIndex((existing) => itemKey(existing) === key);
  if (index >= 0) items[index].quantity = Math.min(maxQuantity, items[index].quantity + item.quantity);
  else items.push({ ...item, quantity: Math.min(maxQuantity, item.quantity) });

  const updated = await collections.CARTS.findOneAndUpdate(
    { ...ownerFilter(userId, guestId), deletedAt: null },
    { $set: { items, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return hydrateCart(updated);
};

const updateItem = async (userId, guestId, key, updates) => {
  const cart = await collections.CARTS.findOne({ ...ownerFilter(userId, guestId), deletedAt: null });
  if (!cart) throw new ApiError('Cart not found', 404);
  const items = cart.items.map((item) => ({ ...item }));
  const index = items.findIndex((item) => itemKey(item) === key);
  if (index < 0) throw new ApiError('Cart item not found', 404);
  const product = await collections.MERCHANDISE.findOne({
    _id: new ObjectId(items[index].merchandiseId), deletedAt: null, isActive: true, isVisible: true,
  });
  if (!product) throw new ApiError('Merchandise not found', 404);
  const inventory = normalizeMerchandiseItem(product).inventory;
  const maxQuantity = inventory.tracked_attribute
    ? inventory.attribute_quantities.find((row) => row.value_key === items[index].inventoryValueKey)?.quantity ?? 0
    : inventory.total_quantity;
  if (maxQuantity < 1) throw new ApiError('Product is out of stock', 400);
  const quantity = Math.min(maxQuantity, Math.max(1, Math.floor(Number(updates.quantity) || 1)));
  items[index].quantity = quantity;
  const updated = await collections.CARTS.findOneAndUpdate(
    { _id: cart._id },
    { $set: { items, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return hydrateCart(updated);
};

const removeItem = async (userId, guestId, key) => {
  const cart = await collections.CARTS.findOne({ ...ownerFilter(userId, guestId), deletedAt: null });
  if (!cart) throw new ApiError('Cart not found', 404);
  const items = cart.items.filter((item) => itemKey(item) !== key);
  const updated = await collections.CARTS.findOneAndUpdate(
    { _id: cart._id },
    { $set: { items, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return hydrateCart(updated);
};

const clear = async (userId, guestId) => {
  const cart = await collections.CARTS.findOneAndUpdate(
    { ...ownerFilter(userId, guestId), deletedAt: null },
    { $set: { items: [], updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return hydrateCart(cart);
};

const remove = async (userId, guestId) => {
  await collections.CARTS.updateOne(
    { ...ownerFilter(userId, guestId), deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } }
  );
};

module.exports = { getByOwner, getOrCreate, addItem, updateItem, removeItem, clear, remove };
