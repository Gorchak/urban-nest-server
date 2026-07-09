const { ObjectId } = require('mongodb');
const { collections } = require('../config/collections');
const ApiError = require('../middleware/ApiError');
const { normalizeMerchandiseItem } = require('../models/merchandiseModel');
const { normalizeFavorite, pickProductSnapshot, validateFavorite } = require('../models/favoriteModel');

const hydrateFavorites = async (favorites = []) => {
  const ids = favorites
    .map((item) => item.merchandiseId)
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  const products = ids.length
    ? await collections.MERCHANDISE.find({ _id: { $in: ids }, deletedAt: null, isActive: true, isVisible: true }).toArray()
    : [];
  const productMap = new Map(products.map((product) => [String(product._id), normalizeMerchandiseItem(product)]));

  return favorites.map((favorite) => ({
    ...favorite,
    product: productMap.get(favorite.merchandiseId) || favorite.product || null,
  }));
};

const getByUser = async (userId) => {
  if (!userId) throw new ApiError('Authentication required', 401);
  const favorites = await collections.FAVORITES
    .find({ userId, deletedAt: null })
    .sort({ createdAt: -1 })
    .toArray();
  return hydrateFavorites(favorites);
};

const add = async (userId, input = {}, user = {}) => {
  if (!userId) throw new ApiError('Authentication required', 401);
  const merchandiseId = String(input.merchandiseId || '');
  if (!ObjectId.isValid(merchandiseId)) throw new ApiError('Invalid merchandiseId', 400);

  const product = await collections.MERCHANDISE.findOne({
    _id: new ObjectId(merchandiseId),
    deletedAt: null,
    isActive: true,
    isVisible: true,
  });
  if (!product) throw new ApiError('Merchandise not found', 404);

  const now = new Date();
  const favorite = normalizeFavorite({
    userId,
    user: { userId, email: user.email || '' },
    merchandiseId,
    product: pickProductSnapshot(product),
  });
  const errors = validateFavorite(favorite);
  if (errors.length) throw new ApiError(errors.join(', '), 400);

  await collections.FAVORITES.updateOne(
    { userId, merchandiseId },
    {
      $set: {
        ...favorite,
        deletedAt: null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  const saved = await collections.FAVORITES.findOne({ userId, merchandiseId, deletedAt: null });
  return (await hydrateFavorites([saved]))[0];
};

const remove = async (userId, merchandiseId) => {
  if (!userId) throw new ApiError('Authentication required', 401);
  if (!ObjectId.isValid(merchandiseId)) throw new ApiError('Invalid merchandiseId', 400);

  await collections.FAVORITES.updateOne(
    { userId, merchandiseId, deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } }
  );
};

module.exports = { getByUser, add, remove };
