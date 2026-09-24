import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const target = env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:3001';
    return {
        plugins: [react()],
        server: {
            host: true,
            port: Number(env.DEV_PORT || 3000),
            proxy: {
                '/api': { target, changeOrigin: true },
                '/health': { target, changeOrigin: true },
            },
        },
        preview: {
            host: true,
            port: Number(env.DEV_PORT || 3000),
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
        },
    };
});
