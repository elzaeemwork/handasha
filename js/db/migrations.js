/**
 * migrations.js - Schema Migrations for HANDASHA App
 * Manages database version upgrades and schema evolution.
 * @module db/migrations
 */

/** Current schema version */
export const SCHEMA_VERSION = 1;

/**
 * Migration registry: maps version numbers to migration functions.
 * Each function receives the IDBDatabase and the IDBVersionChangeEvent transaction.
 *
 * To add a new migration:
 *   1. Increment SCHEMA_VERSION above
 *   2. Add a new entry here with the target version as key
 *   3. Update DB_VERSION in database.js to match SCHEMA_VERSION
 *
 * @type {Object.<number, function(IDBDatabase, IDBTransaction): void>}
 */
const migrations = {
  /**
   * Version 1 → Initial schema creation.
   * All stores are created in database.js onupgradeneeded handler.
   * This entry exists as a placeholder for documentation.
   */
  1: (_db, _tx) => {
    // Initial schema — stores created by database.js openDB()
  },

  // Future migrations go here, e.g.:
  // 2: (db, tx) => {
  //   // Example: Add a new store
  //   if (!db.objectStoreNames.contains('studyPlans')) {
  //     const store = db.createObjectStore('studyPlans', { keyPath: 'id' });
  //     store.createIndex('subjectId', 'subjectId', { unique: false });
  //     store.createIndex('createdAt', 'createdAt', { unique: false });
  //   }
  // },
  //
  // 3: (db, tx) => {
  //   // Example: Add a new index to an existing store
  //   const store = tx.objectStore('tasks');
  //   if (!store.indexNames.contains('completedAt')) {
  //     store.createIndex('completedAt', 'completedAt', { unique: false });
  //   }
  // },
};

/**
 * Run all pending migrations between oldVersion and newVersion.
 * Called from the onupgradeneeded event of IndexedDB open request.
 *
 * @param {IDBDatabase} db - The database being upgraded
 * @param {IDBTransaction} tx - The versionchange transaction
 * @param {number} oldVersion - Previous database version (0 if new)
 * @param {number} newVersion - Target database version
 */
export function runMigrations(db, tx, oldVersion, newVersion) {
  for (let version = oldVersion + 1; version <= newVersion; version++) {
    const migrate = migrations[version];
    if (typeof migrate === 'function') {
      try {
        migrate(db, tx);
      } catch (err) {
        console.error(`خطأ في ترحيل قاعدة البيانات إلى الإصدار ${version}:`, err);
        throw err;
      }
    }
  }
}

/**
 * Get the list of all registered migration versions.
 * @returns {number[]}
 */
export function getRegisteredVersions() {
  return Object.keys(migrations).map(Number).sort((a, b) => a - b);
}

/**
 * Check if the current schema version has a registered migration.
 * @param {number} version
 * @returns {boolean}
 */
export function hasMigration(version) {
  return typeof migrations[version] === 'function';
}
