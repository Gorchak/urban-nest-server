const CategorySchema = {
  specificationsFields: {
    specifications: {
      type: 'array',
      default: [],
      items: {
        referenceId: { type: 'string', required: true },
        slug: { type: 'string', required: true },
        isRequired: { type: 'boolean', default: false },
        sortOrder: { type: 'number', default: 0 },
      },
    },
  },
  baseFields: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', required: true, minLength: 1, maxLength: 255 },
    slug: { type: 'string', required: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    description: { type: 'text', maxLength: 5000 },
    shortDescription: { type: 'string', maxLength: 500 },
    parentId: { type: 'string', format: 'uuid', nullable: true },
    level: { type: 'number', default: 0, min: 0 },
    path: { type: 'string', maxLength: 1000 },
    sortOrder: { type: 'number', default: 0 },
    isActive: { type: 'boolean', default: true },
    isVisible: { type: 'boolean', default: true },
    isFeatured: { type: 'boolean', default: false },
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
  imageFields: {
    image: { type: 'string', maxLength: 2048 },
    coverImage: { type: 'string', maxLength: 2048 },
    bannerImage: { type: 'string', maxLength: 2048 },
    icon: { type: 'string', maxLength: 2048 },
    images: { type: 'array', items: { type: 'string' }, default: [] },
  },
};

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const generatePath = (parentPath, slug) => {
  return parentPath ? `${parentPath}/${slug}` : slug;
};

const calculateLevel = (parentCategory) => {
  return parentCategory ? (parentCategory.level || 0) + 1 : 0;
};

const validateCategory = (data) => {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Category name is required');
  }

  if (data.name && data.name.length > 255) {
    errors.push('Category name must be less than 255 characters');
  }

  if (data.shortDescription && data.shortDescription.length > 500) {
    errors.push('Short description must be less than 500 characters');
  }

  if (data.description && data.description.length > 5000) {
    errors.push('Description must be less than 5000 characters');
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

  if (data.images !== undefined && !Array.isArray(data.images)) {
    errors.push('images must be an array');
  }

  if (data.specifications !== undefined && data.specifications !== null) {
    if (!Array.isArray(data.specifications)) {
      errors.push('Specifications must be an array');
    } else {
      data.specifications.forEach((spec, i) => {
        // Accept full reference object (has _id) OR slim object (has referenceId)
        const refId = spec.referenceId || (spec._id ? String(spec._id) : null);
        if (!refId || typeof refId !== 'string') {
          errors.push(`Specification[${i}]: referenceId (or _id) is required`);
        }
      });
    }
  }

  return errors;
};

module.exports = {
  CategorySchema,
  generateSlug,
  generatePath,
  calculateLevel,
  validateCategory,
};
