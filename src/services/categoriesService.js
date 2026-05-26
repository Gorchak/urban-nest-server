const { ObjectId } = require('mongodb');
const { collections, COLLECTIONS } = require('../config/collections');
const ApiError = require('../middleware/ApiError');
const { generateSlug, generatePath, calculateLevel, validateCategory } = require('../models/categoryModel');

const isValidId = (id) => ObjectId.isValid(id);

/**
 * Maps a specification item from the request payload into the stored document shape.
 * Accepts both slim objects { referenceId, slug, isRequired, sortOrder }
 * and full reference snapshots (all ReferenceDefinition fields).
 * The _id field of the reference (if present) is stored as referenceId.
 */
const mapSpecification = (s) => ({
  referenceId: s.referenceId || (s._id ? String(s._id) : null),
  name: s.name || null,
  slug: s.slug || '',
  type: s.type || null,
  description: s.description || null,
  isRequired: Boolean(s.isRequired ?? false),
  sortOrder: s.sortOrder ?? 0,
  isFilterable: s.isFilterable ?? false,
  isVariant: s.isVariant ?? false,
  isActive: s.isActive ?? true,
  placeholder: s.placeholder || null,
  helperText: s.helperText || null,
  icon: s.icon || null,
  unit: s.unit || null,
  min: s.min ?? null,
  max: s.max ?? null,
  minLength: s.minLength ?? null,
  maxLength: s.maxLength ?? null,
  regex: s.regex || null,
  defaultValue: s.defaultValue ?? null,
  options: Array.isArray(s.options) ? s.options : [],
  createdAt: s.createdAt || null,
  updatedAt: s.updatedAt || null,
});

const getAll = async (query = {}, options = {}) => {
  const { page = 1, limit = 10, sort = { sortOrder: 1, createdAt: -1 }, select = {} } = options;
  const skip = (page - 1) * limit;

  const filter = { ...query, deletedAt: null };
  const cursor = collections.CATEGORIES.find(filter, { skip, limit }).project(select).sort(sort);
  const categories = await cursor.toArray();
  const total = await collections.CATEGORIES.countDocuments(filter);

  return {
    data: categories,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / limit),
    },
  };
};

const getById = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid category ID format', 400);

  const item = await collections.CATEGORIES.findOne({ _id: new ObjectId(id), deletedAt: null });
  if (!item) throw new ApiError('Category not found', 404);
  return item;
};

const create = async (categoryData) => {
  const errors = validateCategory(categoryData);
  if (errors.length > 0) {
    throw new ApiError(errors.join(', '), 400);
  }

  const now = new Date();
  let parentCategory = null;

  if (categoryData.parentId) {
    if (!isValidId(categoryData.parentId)) {
      throw new ApiError('Invalid parent category ID format', 400);
    }
    parentCategory = await collections.CATEGORIES.findOne({
      _id: new ObjectId(categoryData.parentId),
      deletedAt: null,
    });
    if (!parentCategory) {
      throw new ApiError('Parent category not found', 404);
    }
  }

  const slug = categoryData.slug || generateSlug(categoryData.name);
  const level = calculateLevel(parentCategory);
  const parentPath = parentCategory ? parentCategory.path : '';
  const path = generatePath(parentPath, slug);

  const newItem = {
    name: categoryData.name,
    slug,
    description: categoryData.description || null,
    shortDescription: categoryData.shortDescription || null,
    parentId: categoryData.parentId ? new ObjectId(categoryData.parentId) : null,
    level,
    path,
    sortOrder: categoryData.sortOrder ?? 0,
    isActive: categoryData.isActive ?? true,
    isVisible: categoryData.isVisible ?? true,
    isFeatured: categoryData.isFeatured ?? false,
    seoTitle: categoryData.seoTitle || null,
    seoDescription: categoryData.seoDescription || null,
    seoKeywords: categoryData.seoKeywords || [],
    canonicalUrl: categoryData.canonicalUrl || null,
    ogImage: categoryData.ogImage || null,
    image: categoryData.image || null,
    coverImage: categoryData.coverImage || null,
    bannerImage: categoryData.bannerImage || null,
    icon: categoryData.icon || null,
    images: Array.isArray(categoryData.images) ? categoryData.images : [],
    specifications: Array.isArray(categoryData.specifications)
      ? categoryData.specifications.map((s) => mapSpecification(s))
      : [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const result = await collections.CATEGORIES.insertOne(newItem);
  return { ...newItem, _id: result.insertedId };
};

const update = async (id, updates) => {
  if (!isValidId(id)) throw new ApiError('Invalid category ID format', 400);

  const existing = await collections.CATEGORIES.findOne({ _id: new ObjectId(id), deletedAt: null });
  if (!existing) throw new ApiError('Category not found', 404);

  const errors = validateCategory({ ...existing, ...updates });
  if (errors.length > 0) {
    throw new ApiError(errors.join(', '), 400);
  }

  let parentCategory = null;
  const newParentId = updates.parentId !== undefined ? updates.parentId : existing.parentId;

  if (newParentId) {
    if (!isValidId(newParentId)) {
      throw new ApiError('Invalid parent category ID format', 400);
    }
    if (newParentId === id) {
      throw new ApiError('Category cannot be its own parent', 400);
    }
    parentCategory = await collections.CATEGORIES.findOne({
      _id: new ObjectId(newParentId),
      deletedAt: null,
    });
    if (!parentCategory) {
      throw new ApiError('Parent category not found', 404);
    }
  }

  const slug = updates.slug !== undefined ? updates.slug : (updates.name ? generateSlug(updates.name) : existing.slug);
  const level = calculateLevel(parentCategory);
  const parentPath = parentCategory ? parentCategory.path : '';
  const path = generatePath(parentPath, slug);

  const updatedFields = {
    updatedAt: new Date(),
  };

  if (updates.name !== undefined) updatedFields.name = updates.name;
  if (updates.slug !== undefined || updates.name !== undefined) updatedFields.slug = slug;
  if (updates.description !== undefined) updatedFields.description = updates.description;
  if (updates.shortDescription !== undefined) updatedFields.shortDescription = updates.shortDescription;
  if (updates.parentId !== undefined) updatedFields.parentId = updates.parentId ? new ObjectId(updates.parentId) : null;
  if (updates.parentId !== undefined || updates.name !== undefined) {
    updatedFields.level = level;
    updatedFields.path = path;
  }
  if (updates.sortOrder !== undefined) updatedFields.sortOrder = updates.sortOrder;
  if (updates.isActive !== undefined) updatedFields.isActive = updates.isActive;
  if (updates.isVisible !== undefined) updatedFields.isVisible = updates.isVisible;
  if (updates.isFeatured !== undefined) updatedFields.isFeatured = updates.isFeatured;
  if (updates.seoTitle !== undefined) updatedFields.seoTitle = updates.seoTitle;
  if (updates.seoDescription !== undefined) updatedFields.seoDescription = updates.seoDescription;
  if (updates.seoKeywords !== undefined) updatedFields.seoKeywords = updates.seoKeywords;
  if (updates.canonicalUrl !== undefined) updatedFields.canonicalUrl = updates.canonicalUrl;
  if (updates.ogImage !== undefined) updatedFields.ogImage = updates.ogImage;
  if (updates.image !== undefined) updatedFields.image = updates.image;
  if (updates.coverImage !== undefined) updatedFields.coverImage = updates.coverImage;
  if (updates.bannerImage !== undefined) updatedFields.bannerImage = updates.bannerImage;
  if (updates.icon !== undefined) updatedFields.icon = updates.icon;
  if (updates.images !== undefined) updatedFields.images = Array.isArray(updates.images) ? updates.images : [];
  if (updates.specifications !== undefined) {
    updatedFields.specifications = Array.isArray(updates.specifications)
      ? updates.specifications.map((s) => mapSpecification(s))
      : [];
  }

  const result = await collections.CATEGORIES.findOneAndUpdate(
    { _id: new ObjectId(id), deletedAt: null },
    { $set: updatedFields },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('Category not found', 404);
  return result;
};

const remove = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid category ID format', 400);

  const result = await collections.CATEGORIES.findOneAndUpdate(
    { _id: new ObjectId(id), deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('Category not found', 404);
  return result;
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
