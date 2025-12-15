// =============================================================================
// Offline Article Show Page Renderer
// Loads article from IndexedDB and renders with TTS support
// =============================================================================

const DB_NAME = 'storypile_offline';
const DB_VERSION = 1;
const ARTICLES_STORE = 'articles';

// =============================================================================
// Initialize
// =============================================================================

async function initOfflineShow() {
  console.log('[Offline] Initializing offline article page...');
  
  const container = document.getElementById('article-container');
  if (!container) {
    console.error('[Offline] Article container not found');
    return;
  }
  
  // Extract article ID from URL
  const articleId = getArticleIdFromUrl();
  if (!articleId) {
    container.innerHTML = renderError('Invalid article URL');
    return;
  }
  
  console.log(`[Offline] Loading article ${articleId} from IndexedDB...`);
  
  try {
    const article = await getArticle(articleId);
    
    if (!article) {
      container.innerHTML = renderError('Article not found in offline storage');
      return;
    }
    
    console.log(`[Offline] Found article: ${article.headline}`);
    container.innerHTML = renderArticle(article);
    
    // Initialize TTS after rendering
    initTTS(article);
    
  } catch (error) {
    console.error('[Offline] Error loading article:', error);
    container.innerHTML = renderError(error.message);
  }
}

// =============================================================================
// URL Parsing
// =============================================================================

function getArticleIdFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/articles\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// =============================================================================
// Article Rendering
// =============================================================================

function renderArticle(article) {
  const createdDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Parse domain from link
  let domain = 'Source';
  try {
    domain = new URL(article.link).hostname;
  } catch (e) {}
  
  return `
    <!-- Article Header -->
    <h1 class="mb-2">${escapeHtml(article.headline || 'Untitled')}</h1>
    
    ${article.subheadline ? `
      <p class="lead text-muted mb-3">${escapeHtml(article.subheadline)}</p>
    ` : ''}
    
    <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
      ${article.link ? `
        <a href="${escapeHtml(article.link)}" 
           target="_blank" 
           rel="noopener" 
           class="btn btn-secondary btn-sm disabled" 
           title="Links disabled offline">
          ${escapeHtml(domain)}
        </a>
      ` : ''}
      
      ${article.tags ? renderTags(article.tags) : ''}
      
      <small class="text-muted">Saved: ${createdDate}</small>
    </div>
    
    ${article.image_link ? `
      <div class="mb-3" style="aspect-ratio: 2/1; overflow: hidden;">
        <img src="${escapeHtml(article.image_link)}" 
             class="w-100 h-100 rounded" 
             style="object-fit: cover;"
             alt=""
             onerror="this.parentElement.innerHTML='<div class=\\'w-100 h-100 bg-light d-flex align-items-center justify-content-center rounded\\'><i class=\\'fa-solid fa-image text-muted fa-3x\\'></i></div>'">
      </div>
    ` : ''}
    
    ${article.summary ? `
      <div class="card mb-3">
        <div class="card-body bg-light">
          <h6 class="card-title">
            <i class="fa-solid fa-brain me-1"></i> AI Summary
          </h6>
          <p class="card-text mb-0">${escapeHtml(article.summary)}</p>
        </div>
      </div>
    ` : ''}
    
    <!-- TTS Player -->
    <div class="card mb-3" id="tts-player">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="card-title mb-0">
            <i class="fa-solid fa-headphones me-1"></i> Listen
          </h6>
        </div>
        
        <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
          <div class="d-flex align-items-center gap-2">
            <small class="text-muted">Voice:</small>
            <select class="form-select form-select-sm" id="tts-voice" style="width: auto; max-width: 200px;">
              <option value="">Loading voices...</option>
            </select>
          </div>
          
          <div class="d-flex align-items-center gap-2">
            <small class="text-muted">Speed:</small>
            <input type="range" class="form-range" id="tts-rate" 
                   style="width: 80px;" min="0.5" max="2.0" step="0.25" value="1.0">
            <small class="text-muted" id="tts-rate-label" style="width: 40px;">1.0x</small>
          </div>
        </div>
        
        <!-- Progress bar -->
        <div class="progress mb-3" style="height: 6px;">
          <div class="progress-bar" id="tts-progress" style="width: 0%; transition: width 0.05s linear;"></div>
        </div>
        
        <!-- Controls -->
        <div class="d-flex justify-content-center gap-2">
          <button type="button" class="btn btn-outline-secondary btn-sm" id="tts-rewind" title="Previous sentence">
            <i class="fa-solid fa-backward"></i>
          </button>
          
          <button type="button" class="btn btn-primary btn-sm px-3" id="tts-play" title="Play/Pause">
            <i class="fa-solid fa-play" id="tts-play-icon"></i>
          </button>
          
          <button type="button" class="btn btn-outline-secondary btn-sm" id="tts-stop" title="Stop">
            <i class="fa-solid fa-stop"></i>
          </button>
          
          <button type="button" class="btn btn-outline-secondary btn-sm" id="tts-forward" title="Next sentence">
            <i class="fa-solid fa-forward"></i>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Full Article Body -->
    <div class="card">
      <div class="card-body bg-white">
        <h5 class="card-title">Full Article</h5>
        <div id="article-body">
          ${formatBody(article.body)}
        </div>
      </div>
    </div>
    
    <!-- Offline notice -->
    <div class="alert alert-warning mt-3" role="alert">
      <i class="fa-solid fa-cloud-slash me-1"></i>
      <strong>Offline Mode:</strong> Some features are unavailable (AI chat, regenerate summary, archive/favourite).
    </div>
  `;
}

function renderTags(tagsString) {
  if (!tagsString) return '';
  
  const tags = tagsString.split(',').map(t => t.trim()).filter(t => t);
  if (tags.length === 0) return '';
  
  return tags.map(tag => `
    <span class="badge bg-secondary">${escapeHtml(tag)}</span>
  `).join('');
}

function formatBody(body) {
  if (!body) return '<p class="text-muted">No content available.</p>';
  
  // Split by double newlines for paragraphs
  const paragraphs = body.split(/\n\n+/);
  return paragraphs
    .map(p => p.trim())
    .filter(p => p)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('');
}

function renderError(message) {
  return `
    <div class="text-center py-5">
      <i class="fa-solid fa-exclamation-triangle fa-3x text-warning mb-3"></i>
      <h5 class="text-muted">Unable to load article</h5>
      <p class="text-muted">${escapeHtml(message)}</p>
      <a href="/articles" class="btn btn-primary">Back to Articles</a>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =============================================================================
// Text-to-Speech
// =============================================================================

let ttsState = {
  utterance: null,
  sentences: [],
  currentIndex: 0,
  isPlaying: false,
  isPaused: false,
  selectedVoice: null,
  rate: 1.0
};

function initTTS(article) {
  if (!('speechSynthesis' in window)) {
    document.getElementById('tts-player').innerHTML = `
      <div class="card-body">
        <p class="text-muted mb-0">
          <i class="fa-solid fa-exclamation-circle me-1"></i>
          Text-to-speech is not supported in this browser.
        </p>
      </div>
    `;
    return;
  }
  
  // Parse sentences from article body
  ttsState.sentences = parseSentences(article.body || '');
  console.log(`[TTS] Parsed ${ttsState.sentences.length} sentences`);
  
  // Load voices
  loadVoices();
  
  // Voice change might fire async
  speechSynthesis.onvoiceschanged = loadVoices;
  
  // Set up event listeners
  document.getElementById('tts-play').addEventListener('click', togglePlayPause);
  document.getElementById('tts-stop').addEventListener('click', stopTTS);
  document.getElementById('tts-rewind').addEventListener('click', rewindTTS);
  document.getElementById('tts-forward').addEventListener('click', forwardTTS);
  document.getElementById('tts-voice').addEventListener('change', changeVoice);
  document.getElementById('tts-rate').addEventListener('input', changeRate);
}

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  const select = document.getElementById('tts-voice');
  
  if (voices.length === 0) return;
  
  // Filter to English voices and sort
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  const sortedVoices = englishVoices.length > 0 ? englishVoices : voices;
  
  select.innerHTML = sortedVoices.map((voice, i) => `
    <option value="${i}" ${voice.default ? 'selected' : ''}>
      ${voice.name} (${voice.lang})
    </option>
  `).join('');
  
  // Set default voice
  const defaultIndex = sortedVoices.findIndex(v => v.default) || 0;
  ttsState.selectedVoice = sortedVoices[defaultIndex];
  select.value = defaultIndex;
  
  // Store voices for later access
  ttsState.voices = sortedVoices;
}

function parseSentences(text) {
  if (!text) return [];
  
  // Split on sentence boundaries
  const raw = text.split(/(?<=[.!?])\s+/);
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

function togglePlayPause() {
  if (ttsState.isPlaying && !ttsState.isPaused) {
    // Pause
    speechSynthesis.pause();
    ttsState.isPaused = true;
    updatePlayIcon();
  } else if (ttsState.isPaused) {
    // Resume
    speechSynthesis.resume();
    ttsState.isPaused = false;
    updatePlayIcon();
  } else {
    // Start playing
    playSentence(ttsState.currentIndex);
  }
}

function playSentence(index) {
  if (index >= ttsState.sentences.length) {
    // Finished all sentences
    stopTTS();
    return;
  }
  
  // Cancel any current speech
  speechSynthesis.cancel();
  
  const sentence = ttsState.sentences[index];
  const utterance = new SpeechSynthesisUtterance(sentence);
  
  if (ttsState.selectedVoice) {
    utterance.voice = ttsState.selectedVoice;
  }
  utterance.rate = ttsState.rate;
  
  utterance.onend = () => {
    ttsState.currentIndex++;
    updateProgress();
    if (ttsState.isPlaying && !ttsState.isPaused) {
      playSentence(ttsState.currentIndex);
    }
  };
  
  utterance.onerror = (e) => {
    console.error('[TTS] Error:', e);
    if (e.error !== 'canceled') {
      stopTTS();
    }
  };
  
  ttsState.utterance = utterance;
  ttsState.currentIndex = index;
  ttsState.isPlaying = true;
  ttsState.isPaused = false;
  
  speechSynthesis.speak(utterance);
  updatePlayIcon();
  updateProgress();
}

function stopTTS() {
  speechSynthesis.cancel();
  ttsState.isPlaying = false;
  ttsState.isPaused = false;
  ttsState.currentIndex = 0;
  updatePlayIcon();
  updateProgress();
}

function rewindTTS() {
  const newIndex = Math.max(0, ttsState.currentIndex - 1);
  if (ttsState.isPlaying) {
    playSentence(newIndex);
  } else {
    ttsState.currentIndex = newIndex;
    updateProgress();
  }
}

function forwardTTS() {
  const newIndex = Math.min(ttsState.sentences.length - 1, ttsState.currentIndex + 1);
  if (ttsState.isPlaying) {
    playSentence(newIndex);
  } else {
    ttsState.currentIndex = newIndex;
    updateProgress();
  }
}

function changeVoice(e) {
  const index = parseInt(e.target.value, 10);
  ttsState.selectedVoice = ttsState.voices[index];
  
  // If playing, restart current sentence with new voice
  if (ttsState.isPlaying) {
    playSentence(ttsState.currentIndex);
  }
}

function changeRate(e) {
  ttsState.rate = parseFloat(e.target.value);
  document.getElementById('tts-rate-label').textContent = `${ttsState.rate.toFixed(1)}x`;
  
  // If playing, restart current sentence with new rate
  if (ttsState.isPlaying) {
    playSentence(ttsState.currentIndex);
  }
}

function updatePlayIcon() {
  const icon = document.getElementById('tts-play-icon');
  if (ttsState.isPlaying && !ttsState.isPaused) {
    icon.className = 'fa-solid fa-pause';
  } else {
    icon.className = 'fa-solid fa-play';
  }
}

function updateProgress() {
  const progress = document.getElementById('tts-progress');
  const percent = ttsState.sentences.length > 0 
    ? (ttsState.currentIndex / ttsState.sentences.length) * 100 
    : 0;
  progress.style.width = `${percent}%`;
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
        db.createObjectStore(ARTICLES_STORE, { keyPath: 'id' });
      }
    };
  });
}

async function getArticle(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARTICLES_STORE], 'readonly');
    const store = transaction.objectStore(ARTICLES_STORE);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

// =============================================================================
// Initialize on page load
// =============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOfflineShow);
} else {
  initOfflineShow();
}
