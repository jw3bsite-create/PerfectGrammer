import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Kurzkennung der Version: aus Git, sonst aus version.txt des Windows-Starts (liegt neben dem App-Ordner).
function commit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    /* kein Git */
  }
  try {
    return readFileSync(new URL('../version.txt', import.meta.url), 'utf8').trim().slice(0, 7);
  } catch {
    return '';
  }
}

export default defineConfig({
  base: './',
  define: { __APP_COMMIT__: JSON.stringify(commit()) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sprachrichtigkeit',
        short_name: 'Sprachrichtigkeit',
        description: 'Rechtschreibung, Zeichensetzung und Grammatik bis zur Fehlerfreiheit trainieren.',
        lang: 'de-DE',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f7f6f2',
        theme_color: '#f7f6f2',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
});
