// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"
import "@popperjs/core"
import "bootstrap"


// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function(registration) {
        console.log('ServiceWorker registered: ', registration.scope);
      })
      .catch(function(error) {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

// PWA install prompt
let deferredPrompt;

function showInstallButtons() {
  if (!deferredPrompt) return;

  const menuItems = ['install-menu-item', 'install-menu-item-desktop'];
  const buttons = ['install-button-mobile', 'install-button-desktop'];

  menuItems.forEach(id => {
    const item = document.getElementById(id);
    if (item) item.style.display = 'block';
  });

  buttons.forEach(id => {
    const button = document.getElementById(id);
    if (button && !button.dataset.listenerAttached) {
      button.dataset.listenerAttached = 'true';
      button.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('User accepted install');
          }
          deferredPrompt = null;
          menuItems.forEach(id => {
            const item = document.getElementById(id);
            if (item) item.style.display = 'none';
          });
        });
      });
    }
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButtons();
});

// Re-show buttons after Turbo navigation
document.addEventListener('turbo:load', () => {
  showInstallButtons();
});

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  deferredPrompt = null;
});
