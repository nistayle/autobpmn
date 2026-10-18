import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'bpmn',
              test: /node_modules[\\/](?:bpmn-js|diagram-js)[\\/]/,
              minSize: 0,
              maxSize: 400 * 1024,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              minSize: 80 * 1024,
              maxSize: 400 * 1024,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
