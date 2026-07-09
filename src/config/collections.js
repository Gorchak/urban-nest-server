const { getCollection } = require('./database');

const COLLECTIONS = {
  USERS: 'users',
  CLOTHES: 'clothes',
  REFERENCES: 'references',
  CATEGORIES: 'categories',
  MERCHANDISE: 'merchandise',
  SALES: 'sales',
  EXPENSES: 'expenses',
  CARTS: 'carts',
  FAVORITES: 'favorites',
};

const collections = {};

Object.keys(COLLECTIONS).forEach((key) => {
  Object.defineProperty(collections, key, {
    get: () => getCollection(COLLECTIONS[key]),
  });
});

module.exports = { COLLECTIONS, collections };
