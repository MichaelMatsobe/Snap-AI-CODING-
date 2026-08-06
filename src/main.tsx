import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA offline support — register the service worker in production builds only.
// The worker precaches the app shell and caches assets stale-while-revalidate,
// so the IDE keeps working after the app is installed / when offline.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW unsupported or blocked — the app still works online */
    });
  });
}
