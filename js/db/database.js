/**
 * database.js - IndexedDB Wrapper for HANDASHA App
 * Provides async CRUD operations for all app data stores.
 * @module db/database
 */

const DB_NAME = 'handasha-db';
const DB_VERSION = 1;

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID() with a fallback for older browsers.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Schema definition for all object stores and their indexes.
 * Each entry maps a store name to its keyPath and index definitions.
 */
const SCHEMA = {
  subjects: {
    keyPath: 'id',
    indexes: [
      { name: 'status', keyPath: 'status', options: { unique: false } },
      { name: 'name', keyPath: 'name', options: { unique: false } },
      { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
    ],
  },
  files: {
    keyPath: 'id',
    indexes: [
      { name: 'subjectId', keyPath: 'subjectId', options: { unique: false } },
      { name: 'category', keyPath: 'category', options: { unique: false } },
      { name: 'favorite', keyPath: 'favorite', options: { unique: false } },
      { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
    ],
  },
  schedule: {
    keyPath: 'id',
    indexes: [
      { name: 'subjectId', keyPath: 'subjectId', options: { unique: false } },
      { name: 'dayOfWeek', keyPath: 'dayOfWeek', options: { unique: false } },
    ],
  },
  tasks: {
    keyPath: 'id',
    indexes: [
      { name: 'subjectId', keyPath: 'subjectId', options: { unique: false } },
      { name: 'status', keyPath: 'status', options: { unique: false } },
      { name: 'priority', keyPath: 'priority', options: { unique: false } },
      { name: 'deadline', keyPath: 'deadline', options: { unique: false } },
    ],
  },
  exams: {
    keyPath: 'id',
    indexes: [
      { name: 'subjectId', keyPath: 'subjectId', options: { unique: false } },
      { name: 'type', keyPath: 'type', options: { unique: false } },
      { name: 'date', keyPath: 'date', options: { unique: false } },
    ],
  },
  reminders: {
    keyPath: 'id',
    indexes: [
      { name: 'eventId', keyPath: 'eventId', options: { unique: false } },
      { name: 'eventType', keyPath: 'eventType', options: { unique: false } },
      { name: 'remindAt', keyPath: 'remindAt', options: { unique: false } },
      { name: 'isFired', keyPath: 'isFired', options: { unique: false } },
    ],
  },
  notes: {
    keyPath: 'id',
    indexes: [
      { name: 'subjectId', keyPath: 'subjectId', options: { unique: false } },
      { name: 'pinned', keyPath: 'pinned', options: { unique: false } },
      { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
    ],
  },
  flashcardDecks: {
    keyPath: 'id',
    indexes: [
      { name: 'subjectId', keyPath: 'subjectId', options: { unique: false } },
    ],
  },
  flashcards: {
    keyPath: 'id',
    indexes: [
      { name: 'deckId', keyPath: 'deckId', options: { unique: false } },
      { name: 'status', keyPath: 'status', options: { unique: false } },
    ],
  },
  quizzes: {
    keyPath: 'id',
    indexes: [
      { name: 'subjectId', keyPath: 'subjectId', options: { unique: false } },
    ],
  },
  quizQuestions: {
    keyPath: 'id',
    indexes: [
      { name: 'quizId', keyPath: 'quizId', options: { unique: false } },
    ],
  },
  mindmaps: {
    keyPath: 'id',
    indexes: [
      { name: 'subjectId', keyPath: 'subjectId', options: { unique: false } },
    ],
  },
  focusSessions: {
    keyPath: 'id',
    indexes: [
      { name: 'subjectId', keyPath: 'subjectId', options: { unique: false } },
      { name: 'startedAt', keyPath: 'startedAt', options: { unique: false } },
    ],
  },
  settings: {
    keyPath: 'key',
    indexes: [],
  },
  notifications: {
    keyPath: 'id',
    indexes: [
      { name: 'isRead', keyPath: 'isRead', options: { unique: false } },
      { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
    ],
  },
};

/**
 * Opens (or creates) the IndexedDB database with the defined schema.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      for (const [storeName, config] of Object.entries(SCHEMA)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, {
            keyPath: config.keyPath,
          });
          for (const idx of config.indexes) {
            store.createIndex(idx.name, idx.keyPath, idx.options);
          }
        }
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error(`فشل فتح قاعدة البيانات: ${event.target.error?.message || 'خطأ غير معروف'}`));
    };

    request.onblocked = () => {
      reject(new Error('قاعدة البيانات محظورة. أغلق علامات التبويب الأخرى وحاول مجدداً.'));
    };
  });
}

/** Cached database instance promise (singleton) */
let dbInstance = null;

/**
 * Get the database instance (creates it on first call).
 * @returns {Promise<IDBDatabase>}
 */
export function getDB() {
  if (!dbInstance) {
    dbInstance = openDB();
    // Reset cache if db is closed unexpectedly
    dbInstance.then((db) => {
      db.onclose = () => {
        dbInstance = null;
      };
    });
  }
  return dbInstance;
}

/** Exported db promise for direct access when needed */
export const db = getDB();

/**
 * Execute a transaction operation on a given store.
 * @param {string} storeName - Object store name
 * @param {'readonly'|'readwrite'} mode - Transaction mode
 * @param {function(IDBObjectStore): IDBRequest} callback - Receives the store, returns a request
 * @returns {Promise<*>}
 */
async function withStore(storeName, mode, callback) {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = database.transaction(storeName, mode);
    } catch (err) {
      // If db connection was lost, retry once
      dbInstance = null;
      getDB()
        .then((freshDb) => {
          const retryTx = freshDb.transaction(storeName, mode);
          const store = retryTx.objectStore(storeName);
          const request = callback(store);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () =>
            reject(new Error(`خطأ في العملية على "${storeName}": ${request.error?.message || 'خطأ غير معروف'}`));
        })
        .catch(reject);
      return;
    }

    const store = tx.objectStore(storeName);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error(`خطأ في العملية على "${storeName}": ${request.error?.message || 'خطأ غير معروف'}`));
  });
}

/**
 * Add a new record to a store. Auto-generates an `id` if the store
 * uses 'id' as keyPath and no id is provided.
 * @param {string} storeName - Target object store
 * @param {Object} data - Record to add
 * @returns {Promise<string>} The key of the added record
 */
export async function add(storeName, data) {
  const schema = SCHEMA[storeName];
  if (!schema) {
    throw new Error(`المخزن "${storeName}" غير موجود في المخطط.`);
  }

  const record = { ...data };

  // Auto-generate id if keyPath is 'id' and none provided
  if (schema.keyPath === 'id' && !record.id) {
    record.id = generateId();
  }

  // Auto-set createdAt if the store has a createdAt index and it's not set
  const hasCreatedAt = schema.indexes.some((idx) => idx.name === 'createdAt');
  if (hasCreatedAt && !record.createdAt) {
    record.createdAt = new Date().toISOString();
  }

  await withStore(storeName, 'readwrite', (store) => store.add(record));
  return record[schema.keyPath];
}

/**
 * Get a single record by its key.
 * @param {string} storeName - Target object store
 * @param {*} id - Primary key value
 * @returns {Promise<Object|undefined>}
 */
export async function get(storeName, id) {
  if (id === undefined || id === null) {
    throw new Error('يجب تحديد المعرّف للبحث.');
  }
  return withStore(storeName, 'readonly', (store) => store.get(id));
}

/**
 * Get all records from a store.
 * @param {string} storeName - Target object store
 * @returns {Promise<Array<Object>>}
 */
export async function getAll(storeName) {
  return withStore(storeName, 'readonly', (store) => store.getAll());
}

/**
 * Update (put) a record in a store. The record must include the keyPath field.
 * @param {string} storeName - Target object store
 * @param {Object} data - Record to update (must contain key)
 * @returns {Promise<*>} The key of the updated record
 */
export async function update(storeName, data) {
  const schema = SCHEMA[storeName];
  if (!schema) {
    throw new Error(`المخزن "${storeName}" غير موجود في المخطط.`);
  }
  if (data[schema.keyPath] === undefined) {
    throw new Error(`يجب أن يحتوي السجل على الحقل "${schema.keyPath}" للتحديث.`);
  }

  // Auto-set updatedAt timestamp
  const record = { ...data, updatedAt: new Date().toISOString() };

  return withStore(storeName, 'readwrite', (store) => store.put(record));
}

/**
 * Remove a record by its key.
 * @param {string} storeName - Target object store
 * @param {*} id - Primary key value to delete
 * @returns {Promise<void>}
 */
export async function remove(storeName, id) {
  if (id === undefined || id === null) {
    throw new Error('يجب تحديد المعرّف للحذف.');
  }
  return withStore(storeName, 'readwrite', (store) => store.delete(id));
}

/**
 * Query records from a store using an index and an exact value.
 * @param {string} storeName - Target object store
 * @param {string} indexName - Index to query
 * @param {*} value - Exact value to match
 * @returns {Promise<Array<Object>>}
 */
export async function query(storeName, indexName, value) {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    let index;
    try {
      index = store.index(indexName);
    } catch (err) {
      reject(new Error(`الفهرس "${indexName}" غير موجود في المخزن "${storeName}".`));
      return;
    }
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () =>
      reject(new Error(`خطأ في الاستعلام: ${request.error?.message || 'خطأ غير معروف'}`));
  });
}

/**
 * Get all records from a store filtered by an index value.
 * Alias for query() for semantic clarity.
 * @param {string} storeName - Target object store
 * @param {string} indexName - Index to filter by
 * @param {*} value - Value to match
 * @returns {Promise<Array<Object>>}
 */
export async function getAllFromIndex(storeName, indexName, value) {
  return query(storeName, indexName, value);
}

/**
 * Query records using an index with an IDBKeyRange for range queries.
 * @param {string} storeName - Target object store
 * @param {string} indexName - Index to query
 * @param {IDBKeyRange} range - IDBKeyRange instance (e.g., IDBKeyRange.bound(...))
 * @returns {Promise<Array<Object>>}
 */
export async function getByIndex(storeName, indexName, range) {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    let index;
    try {
      index = store.index(indexName);
    } catch (err) {
      reject(new Error(`الفهرس "${indexName}" غير موجود في المخزن "${storeName}".`));
      return;
    }
    const request = index.getAll(range);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () =>
      reject(new Error(`خطأ في استعلام النطاق: ${request.error?.message || 'خطأ غير معروف'}`));
  });
}

/**
 * Count the number of records in a store.
 * @param {string} storeName - Target object store
 * @returns {Promise<number>}
 */
export async function count(storeName) {
  return withStore(storeName, 'readonly', (store) => store.count());
}

/**
 * Clear all records from a store.
 * @param {string} storeName - Target object store
 * @returns {Promise<void>}
 */
export async function clear(storeName) {
  return withStore(storeName, 'readwrite', (store) => store.clear());
}

/**
 * Perform a batch add of multiple records into a store within a single transaction.
 * @param {string} storeName - Target object store
 * @param {Array<Object>} records - Records to add
 * @returns {Promise<Array<string>>} Array of generated keys
 */
export async function addBatch(storeName, records) {
  const schema = SCHEMA[storeName];
  if (!schema) {
    throw new Error(`المخزن "${storeName}" غير موجود في المخطط.`);
  }

  const database = await getDB();
  const hasCreatedAt = schema.indexes.some((idx) => idx.name === 'createdAt');
  const keys = [];

  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const data of records) {
      const record = { ...data };
      if (schema.keyPath === 'id' && !record.id) {
        record.id = generateId();
      }
      if (hasCreatedAt && !record.createdAt) {
        record.createdAt = new Date().toISOString();
      }
      keys.push(record[schema.keyPath]);
      store.add(record);
    }

    tx.oncomplete = () => resolve(keys);
    tx.onerror = () =>
      reject(new Error(`خطأ في الإضافة الجماعية: ${tx.error?.message || 'خطأ غير معروف'}`));
  });
}

/**
 * Delete the entire database (for reset/testing).
 * @returns {Promise<void>}
 */
export async function deleteDatabase() {
  // Close existing connection first
  if (dbInstance) {
    const database = await dbInstance;
    database.close();
    dbInstance = null;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(new Error(`فشل حذف قاعدة البيانات: ${request.error?.message || 'خطأ غير معروف'}`));
  });
}
