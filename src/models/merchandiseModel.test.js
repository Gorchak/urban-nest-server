const {
  calculateDiscountedPrice,
  normalizeInventory,
  validateMerchandise,
} = require('./merchandiseModel');

describe('merchandise discounts', () => {
  test('calculates and rounds a discounted price', () => {
    expect(calculateDiscountedPrice(999.99, 15)).toBe(849.99);
  });

  test('accepts a percentage from 0 to 100', () => {
    const validItem = {
      name: 'Test item',
      sku: 'TEST-1',
      categoryId: '507f1f77bcf86cd799439011',
      discountPercentage: 25,
    };

    expect(validateMerchandise(validItem)).toEqual([]);
  });

  test.each([-1, 101, '20'])('rejects invalid discount %p', (discountPercentage) => {
    const errors = validateMerchandise({
      name: 'Test item',
      sku: 'TEST-1',
      categoryId: '507f1f77bcf86cd799439011',
      discountPercentage,
    });

    expect(errors).toContain('discountPercentage must be a number between 0 and 100');
  });
});

describe('merchandise inventory', () => {
  test('prefers an explicit inventory quantity over a legacy stock quantity', () => {
    expect(normalizeInventory({
      stockQuantity: 2,
      inventory: {
        total_quantity: 0,
        tracked_attribute: null,
        attribute_quantities: [],
      },
    })).toEqual({
      total_quantity: 0,
      tracked_attribute: null,
      attribute_quantities: [],
    });
  });
});

describe('merchandise structured product data', () => {
  const item = { name: 'Test item', sku: 'TEST-1', categoryId: '507f1f77bcf86cd799439011' };

  test('accepts a valid aggregate rating and review', () => {
    expect(validateMerchandise({
      ...item,
      aggregateRating: { ratingValue: 4.8, reviewCount: 12 },
      review: { author: 'Покупець', reviewBody: 'Чудовий товар', ratingValue: 5, datePublished: '2026-09-01' },
    })).toEqual([]);
  });

  test('rejects incomplete or invalid rating data', () => {
    const errors = validateMerchandise({
      ...item,
      aggregateRating: { ratingValue: 6, reviewCount: 0 },
      review: { author: '', reviewBody: '', ratingValue: 0 },
    });
    expect(errors).toContain('aggregateRating.ratingValue must be a number between 1 and 5');
    expect(errors).toContain('aggregateRating.reviewCount must be a positive integer');
    expect(errors).toContain('review.author is required');
  });
});
