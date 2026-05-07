import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node24',
  minify: false,
  outExtension() {
    return {
      js: '.js',
    }
  },
})
