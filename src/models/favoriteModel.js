const pickProductSnapshot = (product = {}) => ({
  merchandiseId: String(product._id || product.merchandiseId || ''),
  sku: String(product.sku || ''),
  name: String(product.name || ''),
  slug: String(product.slug || ''),
  categoryId: product.categoryId ? String(product.categoryId) : '',
  categorySlug: String(product.categorySlug || ''),
  image: product.images?.[0] || product.image || null,
  images: Array.isArray(product.images) ? product.images : [],
  salePrice: Number(product.salePrice) || 0,
  discountPercentage: Number(product.discountPercentage) || 0,
  currency: product.currency || 'UAH',
});

const normalizeFavorite = (data = {}) => ({
  userId: String(data.userId || ''),
  user: {
    userId: String(data.user?.userId || data.userId || ''),
    email: String(data.user?.email || ''),
  },
  merchandiseId: String(data.merchandiseId || data.product?.merchandiseId || ''),
  product: pickProductSnapshot(data.product || data),
});

const validateFavorite = (favorite = {}) => {
  const errors = [];
  if (!favorite.userId) errors.push('userId is required');
  if (!favorite.merchandiseId) errors.push('merchandiseId is required');
  return errors;
};

module.exports = { normalizeFavorite, pickProductSnapshot, validateFavorite };
