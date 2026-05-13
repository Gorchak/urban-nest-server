const { MongoClient, ServerApiVersion } = require('mongodb');

let client;
let db;

const connectDB = async () => {
  try {
    // Accept both MONGO_URI (Render convention) and MONGODB_URI (legacy)
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGO_URI (or MONGODB_URI) is not defined in environment variables');
    }

    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await client.connect();

    await client.db('admin').command({ ping: 1 });
    console.log('MongoDB Connected: You successfully connected to MongoDB!');

    db = client.db('urban-nest');

    return { client, db };
  } catch (error) {
    console.error(`Failed to connect to MongoDB: ${error.message}`);
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
  closeDB,
};
