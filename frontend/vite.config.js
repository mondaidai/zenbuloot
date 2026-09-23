import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Ensure this matches your GitHub repo name exactly
  base: '/ZenbuLoot/', 
  plugins: [react()],
  build: {
    outDir: '../docs',   // Build into the root repository's /docs for GH Pages
    emptyOutDir: true,   // Clears the old files in /docs before building new ones
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          ethers: ['ethers'],
          react: ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hooks': path.resolve(__dirname, './src/hooks'), 
      '@components': path.resolve(__dirname, './src/components'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@contracts': path.resolve(__dirname, './src/contracts'),
      '@config': path.resolve(__dirname, './src/config'),
      '@context': path.resolve(__dirname, './src/context'),
      '@styles': path.resolve(__dirname, './src/styles')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false
  }
});
