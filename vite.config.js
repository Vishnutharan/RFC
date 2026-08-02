import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          payments: ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          realtime: ['@microsoft/signalr']
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5242',
        changeOrigin: true,
        secure: false,
      },
      '/hubs': {
        target: 'http://localhost:5242',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  }
});
