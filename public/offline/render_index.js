// =============================================================================
// Offline Index Page Renderer
// Loads article cards from cache and displays them
// Renders both desktop (card) and mobile (card_sm) versions for responsive display
// =============================================================================

const DB_NAME = 'storypile_offline';
const DB_VERSION = 1;
const ARTICLES_STORE = 'articles';
const PAGES_CACHE = 'storypile-pages-v1';

/**
 * Initialize the offline index page
 */
async function initOfflineIndex() {
  console.log('[Offline] Initializing offline index page...');
  
  const container = document.getElementById('articles-container');
  if (!container) {
    console.error('[Offline] Articles container not found');
    return;
  }
  
  try {
    // Get all articles from IndexedDB
    const articles = await getAllArticles();
    console.log(`[Offline] Found ${articles.length} articles in IndexedDB`);
    
    if (articles.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="fa-solid fa-cloud-slash fa-3x text-muted mb-3"></i>
          <h5 class="text-muted">No articles available offline</h5>
          <p class="text-muted">
            Connect to the internet and sync your articles to read them offline.
          </p>
        </div>
      `;
      return;
    }
    
    // Sort by created_at descending (newest first)
    articles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Filter out archived articles
    const visibleArticles = articles.filter(a => !a.archived);
    
    // Load and display cards
    await displayArticleCards(container, visibleArticles);
    
  } catch (error) {
    console.error('[Offline] Error loading articles:', error);
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="fa-solid fa-exclamation-triangle fa-3x text-warning mb-3"></i>
        <h5 class="text-muted">Error loading articles</h5>
        <p class="text-muted">${error.message}</p>
      </div>
    `;
  }
}

/**
 * Display article cards by loading cached HTML fragments
 * Renders both desktop and mobile versions for each article (responsive)
 */
async function displayArticleCards(container, articles) {
  // Clear the loading state
  container.innerHTML = '';
  
  // Open the pages cache
  const cache = await caches.open(PAGES_CACHE);
  
  let loadedCount = 0;
  
  for (const article of articles) {
    try {
      // Load desktop card (hidden on mobile)
      const desktopCard = await loadCard(cache, article, 'card', 'col-12 col-sm-4 d-none d-md-block');
      if (desktopCard) {
        container.appendChild(desktopCard);
      }
      
      // Load mobile card (hidden on desktop)
      const mobileCard = await loadCard(cache, article, 'card_sm', 'col-12 d-block d-md-none');
      if (mobileCard) {
        container.appendChild(mobileCard);
      }
      
      loadedCount++;
      
    } catch (error) {
      console.warn(`[Offline] Error loading cards for article ${article.id}:`, error);
      // Create placeholders for both views
      container.appendChild(createPlaceholderCard(article, 'col-12 col-sm-4 d-none d-md-block'));
      container.appendChild(createPlaceholderCardSmall(article, 'col-12 d-block d-md-none'));
      loadedCount++;
    }
  }
  
  console.log(`[Offline] Loaded ${loadedCount}/${articles.length} article cards`);
}

/**
 * Load a specific card type from cache
 */
async function loadCard(cache, article, cardType, wrapperClass) {
  const cardUrl = `/articles/${article.id}/${cardType}`;
  
  try {
    const cardRequest = new Request(cardUrl);
    const cachedResponse = await cache.match(cardRequest);
    
    if (cachedResponse) {
      const cardHtml = await cachedResponse.text();
      
      // Create wrapper with appropriate responsive class
      const wrapper = document.createElement('div');
      wrapper.className = wrapperClass;
      wrapper.innerHTML = cardType === 'card' 
        ? `<div class="article-card-wrapper">${cardHtml}</div>`
        : cardHtml;
      
      // Disable interactive buttons that require network
      disableNetworkButtons(wrapper);
      
      return wrapper;
    } else {
      // Card not cached, show a placeholder
      console.warn(`[Offline] ${cardType} not cached: ${cardUrl}`);
      if (cardType === 'card') {
        return createPlaceholderCard(article, wrapperClass);
      } else {
        return createPlaceholderCardSmall(article, wrapperClass);
      }
    }
  } catch (error) {
    console.warn(`[Offline] Error loading ${cardType} for article ${article.id}:`, error);
    if (cardType === 'card') {
      return createPlaceholderCard(article, wrapperClass);
    } else {
      return createPlaceholderCardSmall(article, wrapperClass);
    }
  }
}

/**
 * Create a placeholder desktop card when cached HTML is not available
 */
function createPlaceholderCard(article, wrapperClass) {
  const wrapper = document.createElement('div');
  wrapper.className = wrapperClass;
  
  const imageHtml = article.image_link 
    ? `<img src="${escapeHtml(article.image_link)}" class="w-100 h-100 object-fit-cover" alt="" onerror="this.parentElement.innerHTML='<div class=\\'w-100 h-100 bg-light d-flex align-items-center justify-content-center\\'><i class=\\'fa-solid fa-newspaper text-muted fa-2x\\'></i></div>'">`
    : `<div class="w-100 h-100 bg-light d-flex align-items-center justify-content-center">
         <i class="fa-solid fa-newspaper text-muted fa-2x"></i>
       </div>`;
  
  const createdDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  wrapper.innerHTML = `
    <div class="article-card-wrapper">
      <div class="card shadow-sm">
        <div class="position-relative" style="aspect-ratio: 2/1; overflow: hidden;">
          ${imageHtml}
          ${article.favourited ? `
            <span class="position-absolute top-0 end-0 m-2 badge rounded-3 bg-light border" style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;">
              <i class="fa-solid fa-heart text-muted fa-lg"></i>
            </span>
          ` : ''}
        </div>
        
        <a href="/articles/${article.id}" class="text-decoration-none text-reset">
          <div class="d-flex flex-column justify-content-between card-body bg-white h-100">
            <div><h5 class="card-title mb-1">${escapeHtml(article.headline || 'Untitled')}</h5></div>
            <div><small class="text-muted">Created: ${createdDate}</small></div>
          </div>
        </a>
        
        <div class="card-footer bg-white border-top d-flex justify-content-end gap-2">
          <span class="text-muted small">
            <i class="fa-solid fa-cloud-slash me-1"></i> Offline
          </span>
        </div>
      </div>
    </div>
  `;
  
  return wrapper;
}

/**
 * Create a placeholder mobile/small card when cached HTML is not available
 */
function createPlaceholderCardSmall(article, wrapperClass) {
  const wrapper = document.createElement('div');
  wrapper.className = wrapperClass;
  
  const imageHtml = article.image_link 
    ? `<img src="${escapeHtml(article.image_link)}" class="w-100 h-100 object-fit-cover rounded" alt="" onerror="this.parentElement.innerHTML='<div class=\\'w-100 h-100 bg-light d-flex align-items-center justify-content-center rounded\\'><i class=\\'fa-solid fa-newspaper text-muted\\'></i></div>'">`
    : `<div class="w-100 h-100 bg-light d-flex align-items-center justify-content-center rounded">
         <i class="fa-solid fa-newspaper text-muted"></i>
       </div>`;
  
  const createdDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  wrapper.innerHTML = `
    <div class="card h-100 shadow-sm">
      <div class="row g-0 align-items-center flex-nowrap">
        <div class="col overflow-hidden">
          <a href="/articles/${article.id}" class="text-decoration-none text-reset">
            <div class="p-2">
              <h6 class="card-title mb-1 line-clamp-2">${escapeHtml(article.headline || 'Untitled')}</h6>
              <small class="text-muted">${createdDate}</small>
            </div>
          </a>
        </div>
        
        <div class="col-auto d-flex flex-column align-items-end p-2 flex-shrink-0">
          <div style="width: 120px; aspect-ratio: 2/1; overflow: hidden;">
            ${imageHtml}
          </div>
          
          <div class="d-flex gap-1 pt-1">
            <span class="text-muted small">
              <i class="fa-solid fa-cloud-slash me-1"></i> Offline
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  return wrapper;
}

/**
 * Disable buttons that require network connectivity
 */
function disableNetworkButtons(element) {
  // Disable all form buttons (archive, delete, favourite)
  const forms = element.querySelectorAll('form');
  forms.forEach(form => {
    form.style.display = 'none';
  });
  
  // Hide elements marked as offline-hide
  element.querySelectorAll('[data-offline-hide]').forEach(el => {
    el.classList.add('d-none');
  });
  
  // Show elements marked as offline-show
  element.querySelectorAll('[data-offline-show]').forEach(el => {
    el.classList.remove('d-none');
  });
  
  // Add offline indicator to footer if forms were removed and no indicator exists
  const footer = element.querySelector('.card-footer');
  if (footer && forms.length > 0 && !footer.querySelector('[data-offline-show]')) {
    const existingIndicator = footer.querySelector('.fa-cloud-slash');
    if (!existingIndicator) {
      const offlineIndicator = document.createElement('span');
      offlineIndicator.className = 'text-muted small';
      offlineIndicator.innerHTML = '<i class="fa-solid fa-cloud-slash me-1"></i> Offline';
      footer.appendChild(offlineIndicator);
    }
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =============================================================================
// IndexedDB Functions
// =============================================================================

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(ARTICLES_STORE)) {
        const store = db.createObjectStore(ARTICLES_STORE, { keyPath: 'id' });
        store.createIndex('updated_at', 'updated_at', { unique: false });
      }
    };
  });
}

async function getAllArticles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARTICLES_STORE], 'readonly');
    const store = transaction.objectStore(ARTICLES_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

// =============================================================================
// Initialize on page load
// =============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOfflineIndex);
} else {
  initOfflineIndex();
}
