const { MongoClient, ServerApiVersion } = require('mongodb');

let client;
let db;

const connectDB = async () => {
  try {
    // MONGODB_URI is the canonical setting documented by this project.
    // MONGO_URI remains a fallback so existing local environments keep working.
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!uri) {
      throw new Error('MONGODB_URI (or legacy MONGO_URI) is not defined in environment variables');
    }

    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      tls: true,
      tlsAllowInvalidCertificates: false,
      minPoolSize: 1,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });

    await client.connect();

    await client.db('admin').command({ ping: 1 });
    console.log('MongoDB Connected: You successfully connected to MongoDB!');

    db = client.db('urban-nest');

    return { client, db };
  } catch (error) {
    console.error(`Failed to connect to MongoDB: ${error.message}`);
    if (error.code === 8000 || /authentication failed|bad auth/i.test(error.message)) {
      console.error('MongoDB authentication failed. Verify the MONGODB_URI database-user credentials in the hosting environment.');
    }
    process.exit(1);
  }
};

const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
};

const getCollection = (collectionName) => {
  return getDb().collection(collectionName);
};

const ensurePerformanceIndexes = async () => {
  const database = getDb();
  await Promise.all([
    database.collection('merchandise').createIndexes([
      { key: { slug: 1, deletedAt: 1 }, name: 'slug_active' },
      { key: { deletedAt: 1, isActive: 1, isVisible: 1, createdAt: -1 }, name: 'public_catalog' },
      { key: { deletedAt: 1, isActive: 1, isVisible: 1, isNewArrival: 1, createdAt: -1 }, name: 'new_arrivals' },
      { key: { categoryId: 1, deletedAt: 1, isActive: 1, isVisible: 1, createdAt: -1 }, name: 'category_catalog' },
      { key: { brandSlug: 1, deletedAt: 1, isActive: 1, isVisible: 1, createdAt: -1 }, name: 'brand_catalog' },
    ]),
    database.collection('categories').createIndex(
      { deletedAt: 1, isActive: 1, isVisible: 1, sortOrder: 1 },
      { name: 'visible_categories' }
    ),
    database.collection('brands').createIndex(
      { deletedAt: 1, isActive: 1, isVisible: 1, sortOrder: 1 },
      { name: 'visible_brands' }
    ),
  ]);
};

const closeDB = async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
};

module.exports = {
  connectDB,
  getDb,
  getCollection,
  ensurePerformanceIndexes,
  closeDB,
};
