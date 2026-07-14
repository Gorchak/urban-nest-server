const { ObjectId } = require('mongodb');
const { collections } = require('../config/collections');
const ApiError = require('../middleware/ApiError');
const { generateSlug, validateBrand } = require('../models/brandModel');

const isValidId = (id) => ObjectId.isValid(id);
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalize = (item) => item ? {
  ...item,
  _id: String(item._id),
  categoryIds: (item.categoryIds || []).map(String),
} : item;

const getAll = async (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const filter = { deletedAt: null };
  if (query.isActive !== undefined) filter.isActive = query.isActive === true || query.isActive === 'true';
  if (query.isVisible !== undefined) filter.isVisible = query.isVisible === true || query.isVisible === 'true';
  if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured === true || query.isFeatured === 'true';
  if (query.search) filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
  const [items, total] = await Promise.all([
    collections.BRANDS.find(filter).sort({ sortOrder: 1, name: 1 }).skip((page - 1) * limit).limit(limit).toArray(),
    collections.BRANDS.countDocuments(filter),
  ]);
  return { data: items.map(normalize), pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

const getById = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid brand ID format', 400);
  const item = await collections.BRANDS.findOne({ _id: new ObjectId(id), deletedAt: null });
  if (!item) throw new ApiError('Brand not found', 404);
  return normalize(item);
};

const getBySlug = async (slug) => {
  const item = await collections.BRANDS.findOne({ slug, deletedAt: null });
  if (!item) throw new ApiError('Brand not found', 404);
  return normalize(item);
};

const categoryIds = (values = []) => values.map((id) => {
  if (!isValidId(id)) throw new ApiError(`Invalid category ID: ${id}`, 400);
  return new ObjectId(id);
});

const create = async (data) => {
  const slug = data.slug || generateSlug(data.name);
  const errors = validateBrand({ ...data, slug });
  if (errors.length) throw new ApiError(errors.join(', '), 400);
  if (!slug) throw new ApiError('Brand slug is required', 400);
  if (await collections.BRANDS.findOne({ slug, deletedAt: null })) throw new ApiError(`Slug "${slug}" already exists`, 409);
  const now = new Date();
  const item = {
    name: data.name.trim(), slug, logo: data.logo || null, description: data.description || null,
    categoryIds: categoryIds(data.categoryIds), website: data.website || null,
    sortOrder: Number(data.sortOrder) || 0, isFeatured: data.isFeatured === true,
    isActive: data.isActive !== false, isVisible: data.isVisible !== false,
    seoTitle: data.seoTitle || null, seoDescription: data.seoDescription || null,
    seoKeywords: Array.isArray(data.seoKeywords) ? data.seoKeywords : [],
    canonicalUrl: data.canonicalUrl || null, ogImage: data.ogImage || null,
    createdAt: now, updatedAt: now, deletedAt: null,
  };
  const result = await collections.BRANDS.insertOne(item);
  return normalize({ ...item, _id: result.insertedId });
};

const update = async (id, data) => {
  const existing = await getById(id);
  const slug = data.slug ?? (data.name ? generateSlug(data.name) : existing.slug);
  const errors = validateBrand({ ...existing, ...data, slug });
  if (errors.length) throw new ApiError(errors.join(', '), 400);
  const duplicate = await collections.BRANDS.findOne({ slug, deletedAt: null, _id: { $ne: new ObjectId(id) } });
  if (duplicate) throw new ApiError(`Slug "${slug}" already exists`, 409);
  const allowed = ['name', 'logo', 'description', 'website', 'sortOrder', 'isFeatured', 'isActive', 'isVisible', 'seoTitle', 'seoDescription', 'seoKeywords', 'canonicalUrl', 'ogImage'];
  const fields = { slug, updatedAt: new Date() };
  allowed.forEach((key) => { if (data[key] !== undefined) fields[key] = key === 'name' ? data[key].trim() : data[key]; });
  if (data.categoryIds !== undefined) fields.categoryIds = categoryIds(data.categoryIds);
  const item = await collections.BRANDS.findOneAndUpdate({ _id: new ObjectId(id), deletedAt: null }, { $set: fields }, { returnDocument: 'after' });
  return normalize(item);
};

const remove = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid brand ID format', 400);
  const result = await collections.BRANDS.updateOne({ _id: new ObjectId(id), deletedAt: null }, { $set: { deletedAt: new Date(), updatedAt: new Date(), isActive: false } });
  if (!result.matchedCount) throw new ApiError('Brand not found', 404);
};

module.exports = { getAll, getById, getBySlug, create, update, remove };
