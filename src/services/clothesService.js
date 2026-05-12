const { ObjectId } = require('mongodb');
const { collections, COLLECTIONS } = require('../config/collections');
const ApiError = require('../middleware/ApiError');

const isValidId = (id) => ObjectId.isValid(id);

const getAll = async (query = {}, options = {}) => {
  const { page = 1, limit = 10, sort = { createdAt: -1 }, select = {} } = options;
  const skip = (page - 1) * limit;

  const cursor = collections.CLOTHES.find(query, { skip, limit }).project(select).sort(sort);
  const clothes = await cursor.toArray();
  const total = await collections.CLOTHES.countDocuments(query);

  return {
    data: clothes,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / limit),
    },
  };
};

const getById = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid clothes ID format', 400);

  const item = await collections.CLOTHES.findOne({ _id: new ObjectId(id) });
  if (!item) throw new ApiError('Clothes item not found', 404);
  return item;
};

const create = async (clothesData) => {
  const now = new Date();
  const newItem = {
    ...clothesData,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collections.CLOTHES.insertOne(newItem);
  return { ...newItem, _id: result.insertedId };
};

const update = async (id, updates) => {
  if (!isValidId(id)) throw new ApiError('Invalid clothes ID format', 400);

  updates.updatedAt = new Date();

  const result = await collections.CLOTHES.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('Clothes item not found', 404);
  return result;
};

const remove = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid clothes ID format', 400);

  const item = await collections.CLOTHES.findOneAndDelete({ _id: new ObjectId(id) });
  if (!item) throw new ApiError('Clothes item not found', 404);
  return item;
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
