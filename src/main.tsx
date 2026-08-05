import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import MobileScannerApp from './MobileScannerApp.tsx';

// Register Service Worker for PWA Capability
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch((err) => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MobileScannerApp />
  </StrictMode>
);
