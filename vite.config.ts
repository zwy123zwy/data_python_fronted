import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const host: string = 'http://localhost:8200'; 

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: host,
        changeOrigin: true,
      },
      '/nl2sql': {
        target: host  ,
        changeOrigin: true,
      },
      '/uploads': {
        target: host,
        changeOrigin: true,
      },
    },
  },
});
