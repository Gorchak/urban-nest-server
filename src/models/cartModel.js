const normalizeCartItem = (item = {}) => ({
  merchandiseId: String(item.merchandiseId || ''),
  inventoryValueKey: item.inventoryValueKey ? String(item.inventoryValueKey) : null,
  inventoryValueLabel: item.inventoryValueLabel ? String(item.inventoryValueLabel) : null,
  quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
});

const normalizeCart = (data = {}) => ({
  userId: data.userId ? String(data.userId) : null,
  guestId: data.guestId ? String(data.guestId) : null,
  user: {
    userId: String(data.user?.userId || data.userId || ''),
    email: String(data.user?.email || ''),
  },
  items: Array.isArray(data.items) ? data.items.map(normalizeCartItem) : [],
});

const validateCartItem = (item = {}) => {
  const errors = [];
  if (!item.merchandiseId) errors.push('merchandiseId is required');
  if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
    errors.push('quantity must be a positive integer');
  }
  return errors;
};

module.exports = { normalizeCart, normalizeCartItem, validateCartItem };
