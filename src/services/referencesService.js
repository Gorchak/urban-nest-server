const { ObjectId } = require('mongodb');
const { collections } = require('../config/collections');
const ApiError = require('../middleware/ApiError');
const { generateSlug, validateReference } = require('../models/referenceModel');

const isValidId = (id) => ObjectId.isValid(id);

/**
 * Generates a unique string ID for embedded option objects.
 */
const generateOptionId = () => new ObjectId().toHexString();

/**
 * Normalises inbound option data and assigns a new id when missing.
 */
const buildOption = (opt, existingId = null) => ({
  id: existingId || opt.id || generateOptionId(),
  label: opt.label.trim(),
  value: opt.value.trim(),
  colorHex: opt.colorHex || null,
  sortOrder: typeof opt.sortOrder === 'number' ? opt.sortOrder : 0,
  isActive: opt.isActive !== undefined ? Boolean(opt.isActive) : true,
});

// ---------------------------------------------------------------------------
// getAll
// ---------------------------------------------------------------------------
const getAll = async (query = {}, options = {}) => {
  const {
    page = 1,
    limit = 50,
    sort = { sortOrder: 1, createdAt: -1 },
    select = {},
  } = options;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const filter = { ...query, deletedAt: null };

  const cursor = collections.REFERENCES
    .find(filter)
    .project(select)
    .sort(sort)
    .skip(skip)
    .limit(limitNum);

  const data = await cursor.toArray();
  const total = await collections.REFERENCES.countDocuments(filter);

  return {
    data,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  };
};

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------
const getById = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid reference ID format', 400);

  const item = await collections.REFERENCES.findOne({
    _id: new ObjectId(id),
    deletedAt: null,
  });

  if (!item) throw new ApiError('Reference not found', 404);
  return item;
};

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
const create = async (data) => {
  const errors = validateReference(data);
  if (errors.length > 0) throw new ApiError(errors.join('; '), 400);

  // Slug uniqueness check
  const slug = data.slug || generateSlug(data.name);
  const slugExists = await collections.REFERENCES.findOne({ slug, deletedAt: null });
  if (slugExists) throw new ApiError(`Slug "${slug}" is already in use`, 409);

  const now = new Date();

  const options = Array.isArray(data.options)
    ? data.options.map((opt) => buildOption(opt))
    : [];

  const newDoc = {
    name: data.name.trim(),
    slug,
    description: data.description || null,
    type: data.type,
    isRequired: Boolean(data.isRequired ?? false),
    isFilterable: Boolean(data.isFilterable ?? true),
    isVariant: Boolean(data.isVariant ?? false),
    isActive: Boolean(data.isActive ?? true),
    placeholder: data.placeholder || null,
    helperText: data.helperText || null,
    icon: data.icon || null,
    unit: data.unit || null,
    min: data.min !== undefined ? data.min : null,
    max: data.max !== undefined ? data.max : null,
    minLength: data.minLength !== undefined ? data.minLength : null,
    maxLength: data.maxLength !== undefined ? data.maxLength : null,
    regex: data.regex || null,
    defaultValue: data.defaultValue !== undefined ? data.defaultValue : null,
    options,
    sortOrder: data.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const result = await collections.REFERENCES.insertOne(newDoc);
  return { ...newDoc, _id: result.insertedId };
};

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------
const update = async (id, data) => {
  if (!isValidId(id)) throw new ApiError('Invalid reference ID format', 400);

  const existing = await collections.REFERENCES.findOne({
    _id: new ObjectId(id),
    deletedAt: null,
  });
  if (!existing) throw new ApiError('Reference not found', 404);

  // Merge then validate
  const merged = { ...existing, ...data };
  const errors = validateReference(merged);
  if (errors.length > 0) throw new ApiError(errors.join('; '), 400);

  // Slug uniqueness (exclude the current document)
  if (data.slug && data.slug !== existing.slug) {
    const slugExists = await collections.REFERENCES.findOne({
      slug: data.slug,
      deletedAt: null,
      _id: { $ne: new ObjectId(id) },
    });
    if (slugExists) throw new ApiError(`Slug "${data.slug}" is already in use`, 409);
  }

  const updatedFields = { updatedAt: new Date() };

  if (data.name !== undefined) updatedFields.name = data.name.trim();
  if (data.slug !== undefined) updatedFields.slug = data.slug;
  if (data.description !== undefined) updatedFields.description = data.description || null;
  if (data.type !== undefined) updatedFields.type = data.type;
  if (data.isRequired !== undefined) updatedFields.isRequired = Boolean(data.isRequired);
  if (data.isFilterable !== undefined) updatedFields.isFilterable = Boolean(data.isFilterable);
  if (data.isVariant !== undefined) updatedFields.isVariant = Boolean(data.isVariant);
  if (data.isActive !== undefined) updatedFields.isActive = Boolean(data.isActive);
  if (data.placeholder !== undefined) updatedFields.placeholder = data.placeholder || null;
  if (data.helperText !== undefined) updatedFields.helperText = data.helperText || null;
  if (data.icon !== undefined) updatedFields.icon = data.icon || null;
  if (data.unit !== undefined) updatedFields.unit = data.unit || null;
  if (data.min !== undefined) updatedFields.min = data.min;
  if (data.max !== undefined) updatedFields.max = data.max;
  if (data.minLength !== undefined) updatedFields.minLength = data.minLength;
  if (data.maxLength !== undefined) updatedFields.maxLength = data.maxLength;
  if (data.regex !== undefined) updatedFields.regex = data.regex || null;
  if (data.defaultValue !== undefined) updatedFields.defaultValue = data.defaultValue;
  if (data.sortOrder !== undefined) updatedFields.sortOrder = data.sortOrder;

  if (Array.isArray(data.options)) {
    // Preserve existing option ids where the client sends them, generate new ones otherwise
    const existingOptionsMap = new Map(
      (existing.options || []).map((o) => [o.id, o])
    );
    updatedFields.options = data.options.map((opt) => {
      const existingOpt = opt.id ? existingOptionsMap.get(opt.id) : null;
      return buildOption(opt, existingOpt ? existingOpt.id : null);
    });
  }

  const result = await collections.REFERENCES.findOneAndUpdate(
    { _id: new ObjectId(id), deletedAt: null },
    { $set: updatedFields },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('Reference not found', 404);
  return result;
};

// ---------------------------------------------------------------------------
// remove  (soft delete)
// ---------------------------------------------------------------------------
const remove = async (id) => {
  if (!isValidId(id)) throw new ApiError('Invalid reference ID format', 400);

  const result = await collections.REFERENCES.findOneAndUpdate(
    { _id: new ObjectId(id), deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!result) throw new ApiError('Reference not found', 404);
  return result;
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
