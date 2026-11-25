import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    base: './',

    server: {
        port: 8000,
        host: true
    },

    build: {
        outDir: 'dist',
        emptyOutDir: true,

        rollupOptions: {
            input: {
                student: fileURLToPath(
                    new URL('./index.html', import.meta.url)
                ),
                teacher: fileURLToPath(
                    new URL('./teacher.html', import.meta.url)
                )
            }
        }
    }
});