const { ObjectId } = require('mongodb');
const { collections, COLLECTIONS } = require('../config/collections');
const ApiError = require('../middleware/ApiError');

const isValidId = (id) => ObjectId.isValid(id);

const getAll = async (query = {}, options = {}) => {
  const { page = 1, limit = 10, sort = { createdAt: -1 }, select = {} } = options;
  const skip = (page - 1) * limit;

  const cursor = collections.USERS.find(query, { skip, limit }).project(select).sort(sort);
  const users = await cursor.toArray();
  const total = await collections.USERS.countDocuments(query);

  return {
    data: users,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / limit),
    },
  };
};

const getById = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid user ID format', 400);

  const user = await collections.USERS.findOne({ _id: new ObjectId(id) });
  if (!user) throw new ApiError('User not found', 404);
  return user;
};

const getByEmail = async (email) => {
  return collections.USERS.findOne({ email });
};

const create = async (userData) => {
  const now = new Date();
  const newUser = {
    ...userData,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collections.USERS.insertOne(newUser);
  return { ...newUser, _id: result.insertedId };
};

const update = async (id, updates) => {
  if (!isValidId(id)) throw new ApiError('Invalid user ID format', 400);

  updates.updatedAt = new Date();

  const result = await collections.USERS.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('User not found', 404);
  return result;
};

const remove = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid user ID format', 400);

  const user = await collections.USERS.findOneAndDelete({ _id: new ObjectId(id) });
  if (!user) throw new ApiError('User not found', 404);
  return user;
};

const existsByEmail = async (email) => {
  const user = await collections.USERS.findOne({ email }, { projection: { _id: 1 } });
  return !!user;
};

module.exports = {
  getAll,
  getById,
  getByEmail,
  create,
  update,
  remove,
  existsByEmail,
};
