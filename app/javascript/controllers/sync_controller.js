import { Controller } from "@hotwired/stimulus"

// =============================================================================
// SyncController
// Handles syncing articles from server to IndexedDB for offline access
// Also caches HTML pages and images for full offline reading
// =============================================================================

// IndexedDB configuration
const DB_NAME = 'storypile_offline';
const DB_VERSION = 1;
const ARTICLES_STORE = 'articles';
const META_STORE = 'meta';

// Cache names (must match service-worker.js)
const CACHE_NAMES = {
  pages: 'storypile-pages-v1',
  images: 'storypile-images-v1'
};

export default class extends Controller {
  static targets = ["status", "progress"]
  
  // Track sync state to prevent concurrent syncs
  syncing = false
  
  connect() {
    console.log('[Sync] Controller connected')
    
    // Check and sync on connect if online
    if (navigator.onLine) {
      this.checkAndSync()
    }
    
    // Listen for online event to re-sync
    this.boundOnline = this.handleOnline.bind(this)
    window.addEventListener('online', this.boundOnline)
    
    // Listen for offline event
    this.boundOffline = this.handleOffline.bind(this)
    window.addEventListener('offline', this.boundOffline)
  }
  
  disconnect() {
    window.removeEventListener('online', this.boundOnline)
    window.removeEventListener('offline', this.boundOffline)
  }
  
  handleOnline() {
    console.log('[Sync] Back online, checking for changes')
    this.checkAndSync()
  }
  
  handleOffline() {
    console.log('[Sync] Gone offline')
    this.updateStatus('offline')
  }
  
  /**
   * Check if sync is needed, then sync only if there are changes
   */
  async checkAndSync() {
    if (this.syncing) {
      console.log('[Sync] Sync already in progress, skipping')
      return
    }
    
    this.syncing = true
    
    try {
      // Fetch current articles from API
      console.log('[Sync] Checking for changes...')
      const response = await fetch('/api/articles', {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      })
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }
      
      const serverArticles = await response.json()
      
      // Get current state from IndexedDB
      const localArticles = await this.getAllArticles()
      
      // Check what's different
      const changes = this.detectChanges(serverArticles, localArticles)
      
      if (changes.hasChanges) {
        console.log('[Sync] Changes detected:', changes.summary)
        await this.performSync(serverArticles, changes)
      } else {
        console.log('[Sync] No changes, skipping sync')
        // Silently do nothing - no UI update needed
      }
      
    } catch (error) {
      console.error('[Sync] Check failed:', error)
      // Don't show error for silent checks - only matters if user triggered it
    } finally {
      this.syncing = false
    }
  }
  
  /**
   * Detect what's changed between server and local
   */
  detectChanges(serverArticles, localArticles) {
    const serverIds = new Set(serverArticles.map(a => a.id))
    const localIds = new Set(localArticles.map(a => a.id))
    const localMap = new Map(localArticles.map(a => [a.id, a]))
    
    // Find new articles (on server but not local)
    const newArticles = serverArticles.filter(a => !localIds.has(a.id))
    
    // Find deleted articles (local but not on server)
    const deletedIds = [...localIds].filter(id => !serverIds.has(id))
    
    // Find updated articles (different updated_at timestamp)
    const updatedArticles = serverArticles.filter(serverArticle => {
      const localArticle = localMap.get(serverArticle.id)
      if (!localArticle) return false
      return serverArticle.updated_at !== localArticle.updated_at
    })
    
    const hasChanges = newArticles.length > 0 || deletedIds.length > 0 || updatedArticles.length > 0
    
    return {
      hasChanges,
      newArticles,
      deletedIds,
      updatedArticles,
      summary: `${newArticles.length} new, ${updatedArticles.length} updated, ${deletedIds.length} deleted`
    }
  }
  
  /**
   * Perform the actual sync (only called when changes detected)
   */
  async performSync(serverArticles, changes) {
    this.updateStatus('syncing', changes)
    
    try {
      // Delete removed articles (from IndexedDB and caches)
      if (changes.deletedIds.length > 0) {
        console.log(`[Sync] Deleting ${changes.deletedIds.length} removed articles`)
        await this.deleteArticles(changes.deletedIds)
        await this.deleteCachedPages(changes.deletedIds)
      }
      
      // Save new and updated articles to IndexedDB
      const articlesToSave = [...changes.newArticles, ...changes.updatedArticles]
      if (articlesToSave.length > 0) {
        console.log(`[Sync] Saving ${articlesToSave.length} articles to IndexedDB`)
        await this.saveArticles(articlesToSave)
      }
      
      // Cache HTML pages and images for new/updated articles
      const articlesToCache = [...changes.newArticles, ...changes.updatedArticles]
      if (articlesToCache.length > 0) {
        console.log(`[Sync] Caching ${articlesToCache.length} article pages...`)
        await this.cacheArticlePages(articlesToCache)
      }
      
      // Update last sync time
      await this.setLastSyncTime(new Date().toISOString())
      
      console.log('[Sync] Sync complete')
      this.updateStatus('complete', changes)
      
      // Dispatch custom event for other components
      this.dispatch('complete', { 
        detail: { 
          newCount: changes.newArticles.length,
          updatedCount: changes.updatedArticles.length,
          deletedCount: changes.deletedIds.length
        } 
      })
      
    } catch (error) {
      console.error('[Sync] Sync failed:', error)
      this.updateStatus('error', error.message)
      this.dispatch('error', { detail: { error: error.message } })
    }
  }
  
  // ===========================================================================
  // HTML Page & Image Caching
  // ===========================================================================
  
  /**
   * Cache article pages, cards, and images for offline access
   */
  async cacheArticlePages(articles) {
    const pagesCache = await caches.open(CACHE_NAMES.pages)
    const imagesCache = await caches.open(CACHE_NAMES.images)
    
    // First, cache the articles index page
    try {
      const indexUrl = '/articles'
      const indexResponse = await fetch(indexUrl, { credentials: 'same-origin' })
      if (indexResponse.ok) {
        const indexRequest = new Request(indexUrl)
        await pagesCache.put(indexRequest, indexResponse.clone())
        console.log(`[Sync] Cached index page: ${indexUrl}`)
      }
    } catch (error) {
      console.warn('[Sync] Failed to cache index page:', error.message)
    }
    
    let cached = 0
    const total = articles.length
    
    for (const article of articles) {
      try {
        // Cache the full article page
        const pageUrl = `/articles/${article.id}`
        const pageResponse = await fetch(pageUrl, { credentials: 'same-origin' })
        if (pageResponse.ok) {
          // Create a new request with just the pathname to ensure consistent cache keys
          const cacheRequest = new Request(pageUrl)
          await pagesCache.put(cacheRequest, pageResponse.clone())
          console.log(`[Sync] Cached page: ${pageUrl}`)
        }
        
        // Cache the article card fragment (desktop)
        const cardUrl = `/articles/${article.id}/card`
        const cardResponse = await fetch(cardUrl, { credentials: 'same-origin' })
        if (cardResponse.ok) {
          const cardRequest = new Request(cardUrl)
          await pagesCache.put(cardRequest, cardResponse.clone())
          console.log(`[Sync] Cached card: ${cardUrl}`)
        }
        
        // Cache the article card fragment (mobile/small)
        const cardSmUrl = `/articles/${article.id}/card_sm`
        const cardSmResponse = await fetch(cardSmUrl, { credentials: 'same-origin' })
        if (cardSmResponse.ok) {
          const cardSmRequest = new Request(cardSmUrl)
          await pagesCache.put(cardSmRequest, cardSmResponse.clone())
          console.log(`[Sync] Cached card_sm: ${cardSmUrl}`)
        }
        
        // Cache the article image if present
        if (article.image_link) {
          await this.cacheImage(imagesCache, article.image_link)
        }
        
        cached++
        this.updateProgress(cached, total)
        
      } catch (error) {
        console.warn(`[Sync] Failed to cache article ${article.id}:`, error.message)
        // Continue with other articles even if one fails
      }
    }
    
    console.log(`[Sync] Cached ${cached}/${total} article pages`)
  }
  
  /**
   * Cache a single image, handling CORS for external images
   */
  async cacheImage(cache, imageUrl) {
    try {
      // Check if already cached
      const existing = await cache.match(imageUrl)
      if (existing) {
        return // Already cached
      }
      
      // Try to fetch the image
      // For external images, we use no-cors which gives us an opaque response
      const isExternal = !imageUrl.startsWith('/') && !imageUrl.startsWith(window.location.origin)
      
      const response = await fetch(imageUrl, {
        mode: isExternal ? 'no-cors' : 'cors',
        credentials: 'omit'
      })
      
      // Opaque responses have status 0 but can still be cached and used
      if (response.ok || response.type === 'opaque') {
        await cache.put(imageUrl, response)
        console.log(`[Sync] Cached image: ${imageUrl.substring(0, 50)}...`)
      }
    } catch (error) {
      // Image caching is best-effort, don't fail the whole sync
      console.warn(`[Sync] Could not cache image: ${imageUrl.substring(0, 50)}...`, error.message)
    }
  }
  
  /**
   * Delete cached pages for removed articles
   */
  async deleteCachedPages(articleIds) {
    try {
      const pagesCache = await caches.open(CACHE_NAMES.pages)
      
      for (const id of articleIds) {
        // Delete the full page
        const pageUrl = `/articles/${id}`
        const pageRequest = new Request(pageUrl)
        const pageDeleted = await pagesCache.delete(pageRequest)
        if (pageDeleted) {
          console.log(`[Sync] Removed cached page: ${pageUrl}`)
        }
        
        // Delete the card fragment (desktop)
        const cardUrl = `/articles/${id}/card`
        const cardRequest = new Request(cardUrl)
        const cardDeleted = await pagesCache.delete(cardRequest)
        if (cardDeleted) {
          console.log(`[Sync] Removed cached card: ${cardUrl}`)
        }
        
        // Delete the card fragment (mobile/small)
        const cardSmUrl = `/articles/${id}/card_sm`
        const cardSmRequest = new Request(cardSmUrl)
        const cardSmDeleted = await pagesCache.delete(cardSmRequest)
        if (cardSmDeleted) {
          console.log(`[Sync] Removed cached card_sm: ${cardSmUrl}`)
        }
      }
      
      // Note: We don't delete images because they might be used by other articles
      // or the same image URL might be reused. The browser/service worker will
      // handle cache eviction if storage gets tight.
      
    } catch (error) {
      console.warn('[Sync] Error cleaning up cached pages:', error.message)
    }
  }
  
  // ===========================================================================
  // UI Updates
  // ===========================================================================
  
  updateStatus(status, detail = null) {
    if (!this.hasStatusTarget) return
    
    switch (status) {
      case 'syncing':
        const syncMsg = this.buildSyncMessage(detail)
        this.statusTarget.innerHTML = `<i class="fa-solid fa-sync fa-spin me-1"></i> ${syncMsg}`
        this.statusTarget.className = 'badge bg-warning text-dark'
        break
        
      case 'complete':
        const completeMsg = this.buildCompleteMessage(detail)
        this.statusTarget.innerHTML = `<i class="fa-solid fa-check me-1"></i> ${completeMsg}`
        this.statusTarget.className = 'badge bg-success'
        // Hide after 3 seconds
        setTimeout(() => {
          this.statusTarget.innerHTML = ''
          this.statusTarget.className = ''
        }, 3000)
        break
        
      case 'error':
        this.statusTarget.innerHTML = '<i class="fa-solid fa-exclamation-triangle me-1"></i> Sync failed'
        this.statusTarget.className = 'badge bg-danger'
        break
        
      case 'offline':
        this.statusTarget.innerHTML = '<i class="fa-solid fa-cloud-slash me-1"></i> Offline'
        this.statusTarget.className = 'badge bg-secondary'
        break
    }
  }
  
  updateProgress(current, total) {
    if (this.hasProgressTarget) {
      this.progressTarget.textContent = `${current}/${total}`
    }
  }
  
  buildSyncMessage(changes) {
    if (!changes) return 'Syncing...'
    
    const parts = []
    if (changes.newArticles?.length > 0) {
      parts.push(`${changes.newArticles.length} new`)
    }
    if (changes.updatedArticles?.length > 0) {
      parts.push(`${changes.updatedArticles.length} updated`)
    }
    if (changes.deletedIds?.length > 0) {
      parts.push(`${changes.deletedIds.length} removed`)
    }
    
    return parts.length > 0 ? `Syncing ${parts.join(', ')}...` : 'Syncing...'
  }
  
  buildCompleteMessage(changes) {
    if (!changes) return 'Synced'
    
    const total = (changes.newArticles?.length || 0) + 
                  (changes.updatedArticles?.length || 0) + 
                  (changes.deletedIds?.length || 0)
    
    if (total === 1) {
      if (changes.newArticles?.length === 1) return '1 article added'
      if (changes.updatedArticles?.length === 1) return '1 article updated'
      if (changes.deletedIds?.length === 1) return '1 article removed'
    }
    
    return `${total} changes synced`
  }
  
  // ===========================================================================
  // IndexedDB Methods
  // ===========================================================================
  
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        if (!db.objectStoreNames.contains(ARTICLES_STORE)) {
          const store = db.createObjectStore(ARTICLES_STORE, { keyPath: 'id' })
          store.createIndex('updated_at', 'updated_at', { unique: false })
        }
        
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' })
        }
      }
    })
  }
  
  async getAllArticles() {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ARTICLES_STORE], 'readonly')
      const store = transaction.objectStore(ARTICLES_STORE)
      const request = store.getAll()
      
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
      
      transaction.oncomplete = () => db.close()
    })
  }
  
  async saveArticles(articles) {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ARTICLES_STORE], 'readwrite')
      const store = transaction.objectStore(ARTICLES_STORE)
      
      articles.forEach(article => store.put(article))
      
      transaction.oncomplete = () => {
        db.close()
        resolve(articles.length)
      }
      transaction.onerror = () => {
        db.close()
        reject(transaction.error)
      }
    })
  }
  
  async deleteArticles(ids) {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ARTICLES_STORE], 'readwrite')
      const store = transaction.objectStore(ARTICLES_STORE)
      
      ids.forEach(id => store.delete(id))
      
      transaction.oncomplete = () => {
        db.close()
        resolve(ids.length)
      }
      transaction.onerror = () => {
        db.close()
        reject(transaction.error)
      }
    })
  }
  
  async setLastSyncTime(timestamp) {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([META_STORE], 'readwrite')
      const store = transaction.objectStore(META_STORE)
      
      store.put({ key: 'lastSyncTime', value: timestamp })
      
      transaction.oncomplete = () => {
        db.close()
        resolve(timestamp)
      }
      transaction.onerror = () => {
        db.close()
        reject(transaction.error)
      }
    })
  }
  
  // ===========================================================================
  // Manual sync trigger (bypasses check, forces full cache refresh)
  // ===========================================================================
  
  async forceSync(event) {
    if (event) event.preventDefault()
    
    if (this.syncing) {
      console.log('[Sync] Sync already in progress')
      return
    }
    
    console.log('[Sync] Manual sync triggered')
    this.syncing = true
    this.updateStatus('syncing')
    
    try {
      const response = await fetch('/api/articles', {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      })
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }
      
      const serverArticles = await response.json()
      const localArticles = await this.getAllArticles()
      const changes = this.detectChanges(serverArticles, localArticles)
      
      if (changes.hasChanges) {
        await this.performSync(serverArticles, changes)
      } else {
        // Even if no data changes, re-cache all pages on manual sync
        // This helps ensure pages are fresh
        console.log('[Sync] No data changes, refreshing page cache...')
        await this.cacheArticlePages(serverArticles)
        
        this.statusTarget.innerHTML = '<i class="fa-solid fa-check me-1"></i> Up to date'
        this.statusTarget.className = 'badge bg-success'
        setTimeout(() => {
          this.statusTarget.innerHTML = ''
          this.statusTarget.className = ''
        }, 3000)
      }
      
    } catch (error) {
      console.error('[Sync] Manual sync failed:', error)
      this.updateStatus('error', error.message)
    } finally {
      this.syncing = false
    }
  }
}
