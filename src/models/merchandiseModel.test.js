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
