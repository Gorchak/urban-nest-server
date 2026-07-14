const BRAND_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const BrandSchema = {
  baseFields: {
    name: { type: 'string', required: true, maxLength: 255 },
    slug: { type: 'string', required: true, pattern: BRAND_SLUG_PATTERN },
    logo: { type: 'string', maxLength: 2048 },
    description: { type: 'text', maxLength: 10000 },
    categoryIds: { type: 'array', items: { type: 'objectId' }, default: [] },
    website: { type: 'string', maxLength: 2048 },
    sortOrder: { type: 'number', default: 0 },
    isFeatured: { type: 'boolean', default: false },
    isActive: { type: 'boolean', default: true },
    isVisible: { type: 'boolean', default: true },
    createdAt: { type: 'datetime' },
    updatedAt: { type: 'datetime' },
    deletedAt: { type: 'datetime', nullable: true },
  },
  seoFields: {
    seoTitle: { type: 'string', maxLength: 255 },
    seoDescription: { type: 'text', maxLength: 500 },
    seoKeywords: { type: 'array', items: { type: 'string' } },
    canonicalUrl: { type: 'string', maxLength: 2048 },
    ogImage: { type: 'string', maxLength: 2048 },
  },
};

const generateSlug = (name = '') => String(name)
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/[\s_]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const validateBrand = (data) => {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('Brand name is required');
  if (data.name?.length > 255) errors.push('Brand name must be less than 255 characters');
  if (data.slug && !BRAND_SLUG_PATTERN.test(data.slug)) errors.push('Brand slug must contain only lowercase Latin letters, numbers and hyphens');
  if (data.description?.length > 10000) errors.push('Description must be less than 10000 characters');
  if (data.categoryIds !== undefined && !Array.isArray(data.categoryIds)) errors.push('categoryIds must be an array');
  if (data.seoKeywords !== undefined && !Array.isArray(data.seoKeywords)) errors.push('seoKeywords must be an array');
  return errors;
};

module.exports = { BrandSchema, BRAND_SLUG_PATTERN, generateSlug, validateBrand };
