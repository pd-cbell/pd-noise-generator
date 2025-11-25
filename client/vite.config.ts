import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/proxy': 'http://localhost:3001', // Proxy API requests to the backend server
      '/templates': 'http://localhost:3001', // Proxy template requests
      '/config.json': 'http://localhost:3001', // Proxy config requests
    },
  },
});
