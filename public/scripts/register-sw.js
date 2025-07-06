// Service Worker Registration Script
// Safe implementation without XSS risks

(function() {
  'use strict';
  
  // Check if service workers are supported
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      // Register the service worker
      navigator.serviceWorker.register('/sw.js')
        .then(function(registration) {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
          
          // Handle service worker updates
          registration.addEventListener('updatefound', function() {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', function() {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available, inform the user
                  console.log('New content is available and will be used when all tabs for this page are closed.');
                }
              });
            }
          });
        })
        .catch(function(err) {
          console.log('ServiceWorker registration failed: ', err);
        });
    });
  } else {
    console.log('Service Workers are not supported in this browser.');
  }
})();