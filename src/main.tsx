import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { App } from './App';
import { init } from './lib/store';
import { registerSW } from 'virtual:pwa-register';

void init();

// Die Tastaturmarke in Übungen nur zeigen, solange mit der Tastatur gearbeitet wird.
const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', ' ']);
window.addEventListener('keydown', (e) => {
  if (NAV_KEYS.has(e.key)) document.documentElement.classList.add('kbd-nav');
}, true);
window.addEventListener('pointerdown', () => document.documentElement.classList.remove('kbd-nav'), true);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
