import { Controller } from "@hotwired/stimulus"

// =============================================================================
// OfflineIndicatorController
// Shows/hides elements based on online/offline status
// Displays a banner when offline and disables network-dependent features
// =============================================================================

export default class extends Controller {
  static targets = ["banner", "hideWhenOffline", "showWhenOffline", "disableWhenOffline"]
  
  connect() {
    console.log('[Offline] Indicator controller connected')
    
    // Set initial state
    this.updateStatus()
    
    // Listen for online/offline events
    this.boundOnline = this.handleOnline.bind(this)
    this.boundOffline = this.handleOffline.bind(this)
    
    window.addEventListener('online', this.boundOnline)
    window.addEventListener('offline', this.boundOffline)
  }
  
  disconnect() {
    window.removeEventListener('online', this.boundOnline)
    window.removeEventListener('offline', this.boundOffline)
  }
  
  handleOnline() {
    console.log('[Offline] Back online')
    this.updateStatus()
  }
  
  handleOffline() {
    console.log('[Offline] Gone offline')
    this.updateStatus()
  }
  
  updateStatus() {
    const isOffline = !navigator.onLine
    
    // Update banner visibility
    if (this.hasBannerTarget) {
      this.bannerTarget.classList.toggle('d-none', !isOffline)
    }
    
    // Hide elements when offline (e.g., forms, delete buttons)
    this.hideWhenOfflineTargets.forEach(el => {
      el.classList.toggle('d-none', isOffline)
    })
    
    // Show elements when offline (e.g., offline notices)
    this.showWhenOfflineTargets.forEach(el => {
      el.classList.toggle('d-none', !isOffline)
    })
    
    // Disable interactive elements when offline
    this.disableWhenOfflineTargets.forEach(el => {
      el.disabled = isOffline
      el.classList.toggle('disabled', isOffline)
      if (isOffline) {
        el.setAttribute('title', 'Unavailable offline')
      } else {
        el.removeAttribute('title')
      }
    })
    
    // Also find and handle elements with data attributes (for elements outside targets)
    this.updateGlobalElements(isOffline)
  }
  
  updateGlobalElements(isOffline) {
    // Hide elements with data-offline-hide attribute
    document.querySelectorAll('[data-offline-hide]').forEach(el => {
      el.classList.toggle('d-none', isOffline)
    })
    
    // Show elements with data-offline-show attribute
    document.querySelectorAll('[data-offline-show]').forEach(el => {
      el.classList.toggle('d-none', !isOffline)
    })
    
    // Disable elements with data-offline-disable attribute
    document.querySelectorAll('[data-offline-disable]').forEach(el => {
      el.disabled = isOffline
      el.classList.toggle('disabled', isOffline)
    })
  }
  
  // Manual check method (can be called from other controllers)
  check() {
    this.updateStatus()
  }
  
  // Getter for other controllers to check status
  get isOffline() {
    return !navigator.onLine
  }
}
