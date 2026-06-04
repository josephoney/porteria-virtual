import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Portería Virtual — Kiosk',
        short_name: 'Portería',
        description: 'Terminal de portería virtual',
        theme_color: '#0a0c0f',
        background_color: '#0a0c0f',
        display: 'standalone',
        orientation: 'landscape',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
