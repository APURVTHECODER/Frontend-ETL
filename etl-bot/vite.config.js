import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
export default (function (_a) {
    var mode = _a.mode;
    // load all env vars (unprefixed) from .env.<mode>
    var env = loadEnv(mode, process.cwd(), '');
    return defineConfig({
        plugins: [react()],
        resolve: {
            alias: { '@': path.resolve(__dirname, './src') },
        },
        optimizeDeps: {
            exclude: ['lucide-react'],
        },
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: env.VITE_API_BASE_URL,
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
        define: {
            'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL),
        },
    });
});
