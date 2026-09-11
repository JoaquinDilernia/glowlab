import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // El proyecto vive dentro de una carpeta sincronizada por Dropbox, que
  // bloquea archivos de node_modules/.vite en tiempo real y rompe el rename
  // atomico de optimize-deps (EBUSY). Cache fuera de esa carpeta lo evita.
  cacheDir: join(tmpdir(), 'promonube-vite-cache'),
})
