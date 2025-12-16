// =============================================================================
// StoryPile Offline Storage
// IndexedDB wrapper for storing article data offline
// =============================================================================

const DB_NAME = 'storypile_offline';
const DB_VERSION = 1;
const ARTICLES_STORE = 'articles';
const META_STORE = 'meta';

/**
 * Open the IndexedDB database
 * Creates object stores if they don't exist
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineStorage] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create articles store with id as key
      if (!db.objectStoreNames.contains(ARTICLES_STORE)) {
        const articlesStore = db.createObjectStore(ARTICLES_STORE, { keyPath: 'id' });
        articlesStore.createIndex('updated_at', 'updated_at', { unique: false });
        articlesStore.createIndex('headline', 'headline', { unique: false });
        console.log('[OfflineStorage] Created articles store');
      }

      // Create meta store for sync timestamps and other metadata
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
        console.log('[OfflineStorage] Created meta store');
      }
    };
  });
}

/**
 * Save a single article to IndexedDB
 */
async function saveArticle(article) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARTICLES_STORE], 'readwrite');
    const store = transaction.objectStore(ARTICLES_STORE);
    
    const request = store.put(article);
    
    request.onsuccess = () => {
      resolve(article);
    };
    
    request.onerror = () => {
      console.error('[OfflineStorage] Failed to save article:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Save multiple articles to IndexedDB
 */
async function saveArticles(articles) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARTICLES_STORE], 'readwrite');
    const store = transaction.objectStore(ARTICLES_STORE);
    
    let savedCount = 0;
    
    articles.forEach(article => {
      const request = store.put(article);
      request.onsuccess = () => {
        savedCount++;
      };
      request.onerror = () => {
        console.error('[OfflineStorage] Failed to save article:', article.id, request.error);
      };
    });
    
    transaction.oncomplete = () => {
      console.log(`[OfflineStorage] Saved ${savedCount} articles`);
      db.close();
      resolve(savedCount);
    };
    
    transaction.onerror = () => {
      console.error('[OfflineStorage] Transaction failed:', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Get a single article by ID
 */
async function getArticle(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARTICLES_STORE], 'readonly');
    const store = transaction.objectStore(ARTICLES_STORE);
    
    const request = store.get(id);
    
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    
    request.onerror = () => {
      console.error('[OfflineStorage] Failed to get article:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Get all articles from IndexedDB
 */
async function getAllArticles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARTICLES_STORE], 'readonly');
    const store = transaction.objectStore(ARTICLES_STORE);
    
    const request = store.getAll();
    
    request.onsuccess = () => {
      resolve(request.result || []);
    };
    
    request.onerror = () => {
      console.error('[OfflineStorage] Failed to get all articles:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Get all article IDs from IndexedDB
 */
async function getAllArticleIds() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARTICLES_STORE], 'readonly');
    const store = transaction.objectStore(ARTICLES_STORE);
    
    const request = store.getAllKeys();
    
    request.onsuccess = () => {
      resolve(request.result || []);
    };
    
    request.onerror = () => {
      console.error('[OfflineStorage] Failed to get article IDs:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Delete a single article by ID
 */
async function deleteArticle(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARTICLES_STORE], 'readwrite');
    const store = transaction.objectStore(ARTICLES_STORE);
    
    const request = store.delete(id);
    
    request.onsuccess = () => {
      console.log(`[OfflineStorage] Deleted article ${id}`);
      resolve(true);
    };
    
    request.onerror = () => {
      console.error('[OfflineStorage] Failed to delete article:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Delete multiple articles by ID
 */
async function deleteArticles(ids) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARTICLES_STORE], 'readwrite');
    const store = transaction.objectStore(ARTICLES_STORE);
    
    let deletedCount = 0;
    
    ids.forEach(id => {
      const request = store.delete(id);
      request.onsuccess = () => {
        deletedCount++;
      };
    });
    
    transaction.oncomplete = () => {
      console.log(`[OfflineStorage] Deleted ${deletedCount} articles`);
      db.close();
      resolve(deletedCount);
    };
    
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

/**
 * Get the last sync timestamp
 */
async function getLastSyncTime() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([META_STORE], 'readonly');
    const store = transaction.objectStore(META_STORE);
    
    const request = store.get('lastSyncTime');
    
    request.onsuccess = () => {
      resolve(request.result?.value || null);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Set the last sync timestamp
 */
async function setLastSyncTime(timestamp) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([META_STORE], 'readwrite');
    const store = transaction.objectStore(META_STORE);
    
    const request = store.put({ key: 'lastSyncTime', value: timestamp });
    
    request.onsuccess = () => {
      resolve(timestamp);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Clear all data (useful for debugging or logout)
 */
async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARTICLES_STORE, META_STORE], 'readwrite');
    
    transaction.objectStore(ARTICLES_STORE).clear();
    transaction.objectStore(META_STORE).clear();
    
    transaction.oncomplete = () => {
      console.log('[OfflineStorage] Cleared all data');
      db.close();
      resolve(true);
    };
    
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

/**
 * Get storage statistics
 */
async function getStats() {
  const articles = await getAllArticles();
  const lastSync = await getLastSyncTime();
  
  return {
    articleCount: articles.length,
    lastSyncTime: lastSync,
    articles: articles.map(a => ({ id: a.id, headline: a.headline }))
  };
}

// Export for use in other scripts
// When used in a module context (Stimulus controller), import these
// When used in a non-module context (offline shell), they're available globally
if (typeof window !== 'undefined') {
  window.OfflineStorage = {
    openDB,
    saveArticle,
    saveArticles,
    getArticle,
    getAllArticles,
    getAllArticleIds,
    deleteArticle,
    deleteArticles,
    getLastSyncTime,
    setLastSyncTime,
    clearAll,
    getStats
  };
}

// Also export for ES modules
export {
  openDB,
  saveArticle,
  saveArticles,
  getArticle,
  getAllArticles,
  getAllArticleIds,
  deleteArticle,
  deleteArticles,
  getLastSyncTime,
  setLastSyncTime,
  clearAll,
  getStats
};
