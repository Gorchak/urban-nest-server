const VALID_REFERENCE_TYPES = [
  'string',
  'text',
  'number',
  'decimal',
  'boolean',
  'select',
  'multiselect',
  'color',
  'date',
  'json',
];

const OPTIONS_TYPES = ['select', 'multiselect', 'color'];
const NUMERIC_TYPES = ['number', 'decimal'];

const ReferenceSchema = {
  fields: {
    name: { type: 'string', required: true, minLength: 2, maxLength: 255 },
    slug: { type: 'string', required: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    description: { type: 'text', nullable: true },
    type: { type: 'enum', values: VALID_REFERENCE_TYPES, required: true },
    isRequired: { type: 'boolean', default: false },
    isFilterable: { type: 'boolean', default: true },
    isVariant: { type: 'boolean', default: false },
    isActive: { type: 'boolean', default: true },
    placeholder: { type: 'string', nullable: true },
    helperText: { type: 'string', nullable: true },
    icon: { type: 'string', nullable: true },
    unit: { type: 'string', nullable: true },
    min: { type: 'number', nullable: true },
    max: { type: 'number', nullable: true },
    minLength: { type: 'number', nullable: true },
    maxLength: { type: 'number', nullable: true },
    regex: { type: 'string', nullable: true },
    defaultValue: { type: 'mixed', nullable: true },
    options: { type: 'array', default: [] },
    sortOrder: { type: 'number', default: 0 },
    createdAt: { type: 'datetime' },
    updatedAt: { type: 'datetime' },
    deletedAt: { type: 'datetime', nullable: true },
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

const validateSlug = (slug) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);

const validateRegex = (pattern) => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

const validateOption = (option, index) => {
  const errors = [];
  if (!option.label || typeof option.label !== 'string' || option.label.trim().length === 0) {
    errors.push(`Option[${index}]: label is required`);
  }
  if (!option.value || typeof option.value !== 'string' || option.value.trim().length === 0) {
    errors.push(`Option[${index}]: value is required`);
  }
  return errors;
};

const validateReference = (data) => {
  const errors = [];

  // name
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required');
  } else if (data.name.length < 2) {
    errors.push('Name must be at least 2 characters');
  } else if (data.name.length > 255) {
    errors.push('Name must be less than 255 characters');
  }

  // slug
  if (!data.slug || typeof data.slug !== 'string' || data.slug.trim().length === 0) {
    errors.push('Slug is required');
  } else if (!validateSlug(data.slug)) {
    errors.push('Slug must contain only lowercase letters, numbers and hyphens (kebab-case)');
  }

  // type
  if (!data.type) {
    errors.push('Type is required');
  } else if (!VALID_REFERENCE_TYPES.includes(data.type)) {
    errors.push(`Type must be one of: ${VALID_REFERENCE_TYPES.join(', ')}`);
  }

  // min/max
  if (data.min !== null && data.min !== undefined && data.max !== null && data.max !== undefined) {
    if (typeof data.min !== 'number' || typeof data.max !== 'number') {
      errors.push('Min and max must be numbers');
    } else if (data.min > data.max) {
      errors.push('Min must be less than or equal to max');
    }
  }

  // minLength/maxLength
  if (data.minLength !== null && data.minLength !== undefined &&
      data.maxLength !== null && data.maxLength !== undefined) {
    if (data.minLength > data.maxLength) {
      errors.push('MinLength must be less than or equal to maxLength');
    }
  }

  // regex
  if (data.regex && !validateRegex(data.regex)) {
    errors.push('Regex is not a valid regular expression pattern');
  }

  // options validation — validate each option's fields if any are provided
  if (Array.isArray(data.options) && data.options.length > 0) {
    data.options.forEach((opt, i) => {
      const optErrors = validateOption(opt, i);
      errors.push(...optErrors);
    });
  }

  return errors;
};

module.exports = {
  ReferenceSchema,
  VALID_REFERENCE_TYPES,
  OPTIONS_TYPES,
  NUMERIC_TYPES,
  generateSlug,
  validateSlug,
  validateReference,
};
