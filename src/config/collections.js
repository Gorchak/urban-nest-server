const { getCollection } = require('./database');

const COLLECTIONS = {
  USERS: 'users',
  CLOTHES: 'clothes',
  REFERENCES: 'references',
  CATEGORIES: 'categories',
  MERCHANDISE: 'merchandise',
  SALES: 'sales',
  PAYMENT_INTENTS: 'payment_intents',
  EXPENSES: 'expenses',
  CARTS: 'carts',
  FAVORITES: 'favorites',
  BRANDS: 'brands',
};

const collections = {};

Object.keys(COLLECTIONS).forEach((key) => {
  Object.defineProperty(collections, key, {
    get: () => getCollection(COLLECTIONS[key]),
  });
});

module.exports = { COLLECTIONS, collections };
