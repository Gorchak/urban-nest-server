/**
 * Merchandise Service
 *
 * CRUD operations + filtering/sorting/pagination for the merchandise collection.
 * Dynamic specification validation is performed against category.specifications.
 */

const { ObjectId } = require('mongodb');
const { collections } = require('../config/collections');
const ApiError = require('../middleware/ApiError');
const categoriesService = require('./categoriesService');
const {
  generateSlug,
  validateMerchandise,
  validateSpecifications,
  normalizeInventory,
  normalizeMerchandiseItem,
} = require('../models/merchandiseModel');

const isValidId = (id) => ObjectId.isValid(id);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalises a single specification item to its stored shape.
 */
const mapSpec = (s) => ({
  referenceId: String(s.referenceId),
  slug: String(s.slug || ''),
  type: String(s.type || ''),
  value: s.value !== undefined ? s.value : null,
});

/**
 * Builds the MongoDB filter object from supported query params.
 */
const buildFilter = async (query) => {
  const filter = { deletedAt: null };
  const andClauses = [];

  if (query.categoryId) {
    if (!isValidId(query.categoryId)) throw new ApiError('Invalid categoryId format', 400);
    if (query.includeChildren === 'true' || query.includeChildren === true) {
      // Include items from parent category and all its children
      // First get all child category IDs
      const childCategories = await collections.CATEGORIES.find({
        $or: [
          { _id: new ObjectId(query.categoryId) },
          { parentId: new ObjectId(query.categoryId) },
        ],
        deletedAt: null,
      }).toArray();
      const childIds = childCategories.map(c => c._id);
      filter.categoryId = { $in: childIds };
    } else {
      filter.categoryId = new ObjectId(query.categoryId);
    }
  }
  if (query.categorySlug) {
    filter.categorySlug = query.categorySlug;
  }
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }
  if (query.isVisible !== undefined) {
    filter.isVisible = query.isVisible === 'true' || query.isVisible === true;
  }
  if (query.isNewArrival !== undefined) {
    filter.isNewArrival = query.isNewArrival === 'true' || query.isNewArrival === true;
  }
  if (query.inStock === 'true' || query.inStock === true) {
    andClauses.push({
      $or: [
        { 'inventory.total_quantity': { $gt: 0 } },
        { stockQuantity: { $gt: 0 } },
        { quantity: { $gt: 0 } },
      ],
    });
  }
  if (query.outOfStock === 'true') {
    andClauses.push({
      $or: [
        { 'inventory.total_quantity': { $lte: 0 } },
        { inventory: { $exists: false }, stockQuantity: { $lte: 0 } },
        { inventory: { $exists: false }, quantity: { $lte: 0 } },
      ],
    });
  }
  if (query.inventoryAttributeKey) {
    filter['inventory.tracked_attribute.attribute_key'] = query.inventoryAttributeKey;
  }
  if (query.inventoryValueKey) {
    filter['inventory.attribute_quantities'] = {
      $elemMatch: {
        value_key: query.inventoryValueKey,
        ...(query.inventoryInStock === 'true' || query.inventoryInStock === true
          ? { quantity: { $gt: 0 } }
          : {}),
      },
    };
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.salePrice = {};
    if (query.minPrice !== undefined) filter.salePrice.$gte = Number(query.minPrice);
    if (query.maxPrice !== undefined) filter.salePrice.$lte = Number(query.maxPrice);
  }
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    andClauses.push({ $or: [{ name: re }, { sku: re }] });
  }
  if (query.fromDate) {
    filter.createdAt = filter.createdAt || {};
    filter.createdAt.$gte = new Date(query.fromDate);
  }
  if (query.toDate) {
    filter.createdAt = filter.createdAt || {};
    filter.createdAt.$lte = new Date(query.toDate);
  }
  if (andClauses.length) filter.$and = andClauses;
  return filter;
};

/**
 * Builds the MongoDB sort object from supported query params.
 * Defaults to newest first.
 */
const buildSort = (sortBy, sortOrder) => {
  const SORT_FIELD_MAP = {
    createdAt: 'createdAt',
    name: 'name',
    salePrice: 'salePrice',
    stockQuantity: 'inventory.total_quantity',
    totalQuantity: 'inventory.total_quantity',
    updatedAt: 'updatedAt',
  };
  const field = SORT_FIELD_MAP[sortBy] || 'createdAt';
  const order = sortOrder === 'asc' ? 1 : -1;
  return { [field]: order };
};

// ─── Service methods ──────────────────────────────────────────────────────────

/**
 * Returns a paginated, filtered, sorted list of merchandise.
 */
const getMerchandiseList = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = await buildFilter(query);
  const sort = buildSort(query.sortBy, query.sortOrder);

  const cursor = collections.MERCHANDISE.find(filter).sort(sort).skip(skip).limit(limit);
  const [items, total] = await Promise.all([
    cursor.toArray(),
    collections.MERCHANDISE.countDocuments(filter),
  ]);

  return {
    data: items.map(normalizeMerchandiseItem),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

const getFinancePriceList = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;
  const filter = { deletedAt: null };

  if (query.fromDate) {
    filter.createdAt = filter.createdAt || {};
    filter.createdAt.$gte = new Date(query.fromDate);
  }
  if (query.toDate) {
    filter.createdAt = filter.createdAt || {};
    filter.createdAt.$lte = new Date(query.toDate);
  }

  const cursor = collections.MERCHANDISE
    .find(filter)
    .project({ purchasePrice: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const [items, total] = await Promise.all([
    cursor.toArray(),
    collections.MERCHANDISE.countDocuments(filter),
  ]);

  return {
    data: items.map((item) => ({
      _id: String(item._id),
      purchasePrice: Number(item.purchasePrice) || 0,
      createdAt: item.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Returns merchandise items filtered by categoryId or categorySlug.
 * Uses the same underlying getMerchandiseList with category filter applied.
 */
const getMerchandiseByCategory = async (categoryIdentifier, isId, extraQuery = {}) => {
  const query = { ...extraQuery };
  if (isId) {
    query.categoryId = categoryIdentifier;
  } else {
    query.categorySlug = categoryIdentifier;
  }
  return getMerchandiseList(query);
};

/**
 * Returns a single merchandise item by _id.
 */
const getMerchandiseById = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid merchandise ID format', 400);

  const item = await collections.MERCHANDISE.findOne({ _id: new ObjectId(id), deletedAt: null });
  if (!item) throw new ApiError('Merchandise not found', 404);
  return normalizeMerchandiseItem(item);
};

const getMerchandiseBySlug = async (slug) => {
  const item = await collections.MERCHANDISE.findOne({ slug, deletedAt: null });
  if (!item) throw new ApiError('Merchandise not found', 404);
  return normalizeMerchandiseItem(item);
};

/**
 * Creates a new merchandise document.
 * Validates base fields and dynamic specifications against category rules.
 */
const createMerchandise = async (data) => {
  // 1. Base field validation
  const errors = validateMerchandise(data);
  if (errors.length > 0) throw new ApiError(errors.join(', '), 400);

  // 2. Resolve category
  if (!isValidId(data.categoryId)) throw new ApiError('Invalid categoryId format', 400);
  let category;
  try {
    category = await categoriesService.getById(data.categoryId);
  } catch (err) {
    if (err.statusCode === 404) throw new ApiError('Category not found', 404);
    throw err;
  }

  // 3. Check SKU uniqueness
  const existingSku = await collections.MERCHANDISE.findOne({
    sku: data.sku,
    deletedAt: null,
  });
  if (existingSku) throw new ApiError(`SKU "${data.sku}" already exists`, 409);

  // 4. Dynamic specification validation
  const specErrors = validateSpecifications(
    data.specifications || [],
    category.specifications || []
  );
  if (specErrors.length > 0) throw new ApiError(specErrors.join(', '), 400);

  const now = new Date();
  const slug = data.slug || generateSlug(data.name);

  // 5. Check slug uniqueness
  const existingSlug = await collections.MERCHANDISE.findOne({ slug, deletedAt: null });
  if (existingSlug) throw new ApiError(`Slug "${slug}" already exists`, 409);

  const newItem = {
    sku: data.sku.trim(),
    name: data.name.trim(),
    slug,
    categoryId: new ObjectId(data.categoryId),
    categorySlug: category.slug,
    description: data.description || null,
    shortDescription: data.shortDescription || null,
    specifications: Array.isArray(data.specifications)
      ? data.specifications.map(mapSpec)
      : [],
    images: Array.isArray(data.images) ? data.images.filter(Boolean) : [],
    inventory: normalizeInventory(data),
    purchasePrice: data.purchasePrice ?? 0,
    salePrice: data.salePrice ?? 0,
    discountPercentage: data.discountPercentage ?? 0,
    retailPrice: data.retailPrice ?? 0,
    currency: data.currency || 'UAH',
    isActive: data.isActive ?? true,
    isVisible: data.isVisible ?? true,
    isNewArrival: data.isNewArrival ?? false,
    ownershipType: data.ownershipType || 'owned',
    seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null,
    seoKeywords: Array.isArray(data.seoKeywords) ? data.seoKeywords : [],
    canonicalUrl: data.canonicalUrl || null,
    ogImage: data.ogImage || null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const result = await collections.MERCHANDISE.insertOne(newItem);
  return normalizeMerchandiseItem({ ...newItem, _id: result.insertedId });
};

/**
 * Updates an existing merchandise document by _id.
 */
const updateMerchandise = async (id, updates) => {
  if (!isValidId(id)) throw new ApiError('Invalid merchandise ID format', 400);

  const existing = await collections.MERCHANDISE.findOne({ _id: new ObjectId(id), deletedAt: null });
  if (!existing) throw new ApiError('Merchandise not found', 404);

  // Merge for base validation
  const merged = { ...existing, ...updates };
  const errors = validateMerchandise(merged);
  if (errors.length > 0) throw new ApiError(errors.join(', '), 400);

  // Resolve category (may change on update)
  let category = null;
  const categoryId = updates.categoryId !== undefined ? updates.categoryId : String(existing.categoryId);
  if (!isValidId(categoryId)) throw new ApiError('Invalid categoryId format', 400);
  try {
    category = await categoriesService.getById(categoryId);
  } catch (err) {
    if (err.statusCode === 404) throw new ApiError('Category not found', 404);
    throw err;
  }

  // Check SKU uniqueness (allow same SKU on same doc)
  if (updates.sku && updates.sku !== existing.sku) {
    const existingSku = await collections.MERCHANDISE.findOne({
      sku: updates.sku,
      deletedAt: null,
      _id: { $ne: new ObjectId(id) },
    });
    if (existingSku) throw new ApiError(`SKU "${updates.sku}" already exists`, 409);
  }

  // Dynamic specification validation when specs are being updated
  if (updates.specifications !== undefined) {
    const specErrors = validateSpecifications(
      updates.specifications || [],
      category.specifications || []
    );
    if (specErrors.length > 0) throw new ApiError(specErrors.join(', '), 400);
  }

  // Check slug uniqueness
  if (updates.slug && updates.slug !== existing.slug) {
    const existingSlug = await collections.MERCHANDISE.findOne({
      slug: updates.slug,
      deletedAt: null,
      _id: { $ne: new ObjectId(id) },
    });
    if (existingSlug) throw new ApiError(`Slug "${updates.slug}" already exists`, 409);
  }

  const updatedFields = { updatedAt: new Date() };

  if (updates.sku !== undefined) updatedFields.sku = updates.sku.trim();
  if (updates.name !== undefined) updatedFields.name = updates.name.trim();
  if (updates.slug !== undefined) {
    updatedFields.slug = updates.slug;
  } else if (updates.name !== undefined) {
    updatedFields.slug = generateSlug(updates.name);
  }
  if (updates.categoryId !== undefined) {
    updatedFields.categoryId = new ObjectId(updates.categoryId);
    updatedFields.categorySlug = category.slug;
  }
  if (updates.description !== undefined) updatedFields.description = updates.description;
  if (updates.shortDescription !== undefined) updatedFields.shortDescription = updates.shortDescription;
  if (updates.specifications !== undefined) {
    updatedFields.specifications = Array.isArray(updates.specifications)
      ? updates.specifications.map(mapSpec)
      : [];
  }
  if (updates.images !== undefined) {
    updatedFields.images = Array.isArray(updates.images) ? updates.images.filter(Boolean) : [];
  }
  if (
    updates.inventory !== undefined ||
    updates.stockQuantity !== undefined ||
    updates.quantity !== undefined
  ) {
    updatedFields.inventory = normalizeInventory({ ...existing, ...updates });
  }
  if (updates.purchasePrice !== undefined) updatedFields.purchasePrice = updates.purchasePrice;
  if (updates.salePrice !== undefined) updatedFields.salePrice = updates.salePrice;
  if (updates.discountPercentage !== undefined) updatedFields.discountPercentage = updates.discountPercentage;
  if (updates.retailPrice !== undefined) updatedFields.retailPrice = updates.retailPrice;
  if (updates.currency !== undefined) updatedFields.currency = updates.currency;
  if (updates.isActive !== undefined) updatedFields.isActive = updates.isActive;
  if (updates.isVisible !== undefined) updatedFields.isVisible = updates.isVisible;
  if (updates.isNewArrival !== undefined) updatedFields.isNewArrival = updates.isNewArrival;
  if (updates.ownershipType !== undefined) updatedFields.ownershipType = updates.ownershipType;
  if (updates.seoTitle !== undefined) updatedFields.seoTitle = updates.seoTitle;
  if (updates.seoDescription !== undefined) updatedFields.seoDescription = updates.seoDescription;
  if (updates.seoKeywords !== undefined) updatedFields.seoKeywords = updates.seoKeywords;
  if (updates.canonicalUrl !== undefined) updatedFields.canonicalUrl = updates.canonicalUrl;
  if (updates.ogImage !== undefined) updatedFields.ogImage = updates.ogImage;

  const result = await collections.MERCHANDISE.findOneAndUpdate(
    { _id: new ObjectId(id), deletedAt: null },
    { $set: updatedFields },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('Merchandise not found', 404);
  return normalizeMerchandiseItem(result);
};

/**
 * Soft-deletes a merchandise item by _id.
 */
const deleteMerchandise = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid merchandise ID format', 400);

  const result = await collections.MERCHANDISE.findOneAndUpdate(
    { _id: new ObjectId(id), deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('Merchandise not found', 404);
  return result;
};

module.exports = {
  getMerchandiseList,
  getFinancePriceList,
  getMerchandiseById,
  getMerchandiseBySlug,
  getMerchandiseByCategory,
  createMerchandise,
  updateMerchandise,
  deleteMerchandise,
};
