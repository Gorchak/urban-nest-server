/**
 * Merchandise Model
 *
 * Schema definition + validation helpers for the merchandise collection.
 * Architecture: no hardcoded specifications — all characteristics work
 * dynamically through references and category.specifications.
 */

const VALID_CURRENCIES = ['UAH', 'USD', 'EUR'];

const VALID_OWNERSHIP_TYPES = ['owned', 'consignment', 'dropshipping', 'partner', 'rental'];

const MerchandiseSchema = {
  baseFields: {
    sku: { type: 'string', required: true, maxLength: 100 },
    name: { type: 'string', required: true, maxLength: 255 },
    slug: { type: 'string', required: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    categoryId: { type: 'string', required: true, format: 'objectId' },
    categorySlug: { type: 'string', required: true },
    description: { type: 'text', maxLength: 10000 },
    shortDescription: { type: 'string', maxLength: 1000 },
    images: { type: 'array', items: { type: 'string' }, default: [] },
    stockQuantity: { type: 'number', min: 0, default: 0 },
    purchasePrice: { type: 'decimal', min: 0, default: 0 },
    salePrice: { type: 'decimal', min: 0, default: 0 },
    retailPrice: { type: 'decimal', min: 0, default: 0 },
    currency: { type: 'string', enum: VALID_CURRENCIES, default: 'UAH' },
    isActive: { type: 'boolean', default: true },
    isVisible: { type: 'boolean', default: true },
    ownershipType: { type: 'string', enum: VALID_OWNERSHIP_TYPES, default: 'owned' },
    createdAt: { type: 'datetime' },
    updatedAt: { type: 'datetime' },
    deletedAt: { type: 'datetime', nullable: true },
  },
  specificationsField: {
    specifications: {
      type: 'array',
      default: [],
      items: {
        referenceId: { type: 'string', required: true },
        slug: { type: 'string', required: true },
        type: { type: 'string', required: true },
        value: { type: 'mixed', nullable: true },
      },
    },
  },
  seoFields: {
    seoTitle: { type: 'string', maxLength: 255 },
    seoDescription: { type: 'text', maxLength: 500 },
    seoKeywords: { type: 'array', items: { type: 'string' } },
    canonicalUrl: { type: 'string', maxLength: 2048 },
    ogImage: { type: 'string', maxLength: 2048 },
  },
};

// ─── Slug generation ────────────────────────────────────────────────────────

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

// ─── Specification value validation ─────────────────────────────────────────

/**
 * Validates a single specification value against the reference type rules.
 * Returns null if valid, or an error message string if invalid.
 */
const validateSpecValue = (type, value, referenceSlug) => {
  if (value === null || value === undefined) {
    return null; // nullability handled by required check
  }

  switch (type) {
    case 'string':
    case 'text':
    case 'select':
      if (typeof value !== 'string') {
        return `Specification "${referenceSlug}" must be a string`;
      }
      break;

    case 'number':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return `Specification "${referenceSlug}" must be an integer`;
      }
      break;

    case 'decimal':
      if (typeof value !== 'number') {
        return `Specification "${referenceSlug}" must be a number`;
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Specification "${referenceSlug}" must be a boolean`;
      }
      break;

    case 'multiselect':
    case 'color':
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        return `Specification "${referenceSlug}" must be an array of strings`;
      }
      break;

    case 'date':
      if (typeof value !== 'string' || isNaN(Date.parse(value))) {
        return `Specification "${referenceSlug}" must be a valid date string`;
      }
      break;

    case 'json':
      // any value acceptable for json type
      break;

    default:
      break;
  }
  return null;
};

// ─── Dynamic specification validation ───────────────────────────────────────

/**
 * Validates merchandise specifications against the category's specification definitions.
 *
 * Flow:
 *  1. categorySpecs = category.specifications (full snapshots stored on category)
 *  2. For each required + active spec → ensure merchandise has a non-null value
 *  3. For each merchandise spec → validate value type matches reference type
 *
 * @param {Array} merchandiseSpecs  - specifications from incoming payload
 * @param {Array} categorySpecs     - specifications stored on the category document
 * @returns {string[]} array of error messages (empty = valid)
 */
const validateSpecifications = (merchandiseSpecs, categorySpecs) => {
  const errors = [];

  if (!Array.isArray(merchandiseSpecs)) {
    return ['Specifications must be an array'];
  }

  const activeSpecs = (categorySpecs || []).filter((s) => s.isActive !== false);

  // Build map of incoming merchandise spec values keyed by referenceId
  const valueMap = new Map();
  for (const spec of merchandiseSpecs) {
    if (spec.referenceId) {
      valueMap.set(spec.referenceId, spec);
    }
  }

  // 1. Check required specs
  for (const catSpec of activeSpecs) {
    if (!catSpec.isRequired) continue;
    const incoming = valueMap.get(catSpec.referenceId);
    const val = incoming ? incoming.value : undefined;
    if (val === null || val === undefined || val === '') {
      errors.push(
        `Specification "${catSpec.slug || catSpec.referenceId}" is required`
      );
    }
  }

  // 2. Validate value types for all provided specs
  for (const spec of merchandiseSpecs) {
    if (!spec.referenceId || typeof spec.referenceId !== 'string') {
      errors.push('Each specification must have a valid referenceId');
      continue;
    }
    if (!spec.slug || typeof spec.slug !== 'string') {
      errors.push('Each specification must have a slug');
      continue;
    }
    if (!spec.type || typeof spec.type !== 'string') {
      errors.push(`Specification "${spec.slug}" must have a type`);
      continue;
    }

    // Only validate non-null values
    if (spec.value !== null && spec.value !== undefined) {
      const err = validateSpecValue(spec.type, spec.value, spec.slug);
      if (err) errors.push(err);
    }
  }

  return errors;
};

// ─── Main validation ─────────────────────────────────────────────────────────

/**
 * Validates the base merchandise fields (excluding dynamic specifications).
 * @param {Object} data - raw incoming payload
 * @returns {string[]} array of error messages
 */
const validateMerchandise = (data) => {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Merchandise name is required');
  }
  if (data.name && data.name.length > 255) {
    errors.push('Merchandise name must be less than 255 characters');
  }

  if (!data.sku || typeof data.sku !== 'string' || data.sku.trim().length === 0) {
    errors.push('SKU is required');
  }
  if (data.sku && data.sku.length > 100) {
    errors.push('SKU must be less than 100 characters');
  }

  if (!data.categoryId) {
    errors.push('categoryId is required');
  }

  if (data.shortDescription && data.shortDescription.length > 1000) {
    errors.push('Short description must be less than 1000 characters');
  }
  if (data.description && data.description.length > 10000) {
    errors.push('Description must be less than 10000 characters');
  }

  if (data.stockQuantity !== undefined && data.stockQuantity !== null) {
    if (typeof data.stockQuantity !== 'number' || data.stockQuantity < 0) {
      errors.push('stockQuantity must be a non-negative number');
    }
  }

  for (const priceField of ['purchasePrice', 'salePrice', 'retailPrice']) {
    if (data[priceField] !== undefined && data[priceField] !== null) {
      if (typeof data[priceField] !== 'number' || data[priceField] < 0) {
        errors.push(`${priceField} must be a non-negative number`);
      }
    }
  }

  if (data.currency && !VALID_CURRENCIES.includes(data.currency)) {
    errors.push(`currency must be one of: ${VALID_CURRENCIES.join(', ')}`);
  }

  if (data.ownershipType && !VALID_OWNERSHIP_TYPES.includes(data.ownershipType)) {
    errors.push(`ownershipType must be one of: ${VALID_OWNERSHIP_TYPES.join(', ')}`);
  }

  if (data.images !== undefined && !Array.isArray(data.images)) {
    errors.push('images must be an array');
  }

  if (data.seoTitle && data.seoTitle.length > 255) {
    errors.push('SEO title must be less than 255 characters');
  }
  if (data.seoDescription && data.seoDescription.length > 500) {
    errors.push('SEO description must be less than 500 characters');
  }
  if (data.seoKeywords && !Array.isArray(data.seoKeywords)) {
    errors.push('SEO keywords must be an array');
  }

  return errors;
};

module.exports = {
  MerchandiseSchema,
  VALID_CURRENCIES,
  VALID_OWNERSHIP_TYPES,
  generateSlug,
  validateMerchandise,
  validateSpecifications,
  validateSpecValue,
};
