const admin = require('firebase-admin');

// Initialize Firebase Admin (for production, use service account)
// For development, we'll use a simple in-memory storage
let db = null;

try {
  if (process.env.FIREBASE_PROJECT_ID) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log('Firebase initialized successfully');
  } else {
    console.log('Firebase credentials not found, using in-memory storage');
  }
} catch (error) {
  console.log('Firebase initialization failed, using in-memory storage:', error.message);
}

// In-memory storage for development (fallback)
const memoryStore = {
  users: new Map(),
  expenses: new Map(),
  lastExpenseId: 0,
  lastUserId: 0,
};

// Database helper functions
const getDb = () => {
  if (db) {
    return {
      type: 'firestore',
      db,
    };
  }
  return {
    type: 'memory',
    db: memoryStore,
  };
};

module.exports = { getDb };

