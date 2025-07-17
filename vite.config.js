import { defineConfig } from 'vite'
import netlify from '@netlify/vite-plugin'

export default defineConfig({
  plugins: [netlify()],
  // Ensure proper base path for deployment
  base: './',
  
  // Configure asset handling
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.fbx'],
  
  // Build configuration
  build: {
    // Ensure assets are properly copied
    assetsDir: 'assets',
    rollupOptions: {
      // Ensure large assets are not inlined
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(glb|gltf|fbx|png|jpg|jpeg|gif|svg)$/i.test(assetInfo.name)) {
            return `assets/[name].[hash][extname]`;
          }
          return `assets/[name].[hash][extname]`;
        }
      }
    }
  },
  
  // Dev server configuration
  server: {
    // Ensure assets are served properly in development
    fs: {
      strict: false
    }
  },
  
  // Ensure modules resolve correctly
  resolve: {
    alias: {
      // Help with three.js imports
      'three/examples/jsm': 'three/examples/jsm'
    }
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['three']
  }
}) 