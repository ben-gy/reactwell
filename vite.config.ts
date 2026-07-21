import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Reactwell — instant JSX / TSX preview',
        short_name: 'Reactwell',
        description: 'Drop a JSX or TSX file and see the React component render instantly — transpiled in your browser.',
        theme_color: '#0b0e14',
        background_color: '#0b0e14',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Precache the app shell but NOT the 12MB esbuild wasm — cache that at
        // runtime on first use instead (keeps installs fast and small).
        globPatterns: ['**/*.{js,css,html,svg,png,txt}'],
        globIgnores: ['**/*.wasm'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'reactwell-wasm',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
  // esbuild-wasm ships a large .wasm we load via ?url — keep it out of dep pre-bundling.
  optimizeDeps: {
    exclude: ['esbuild-wasm'],
  },
  assetsInclude: ['**/*.wasm'],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
