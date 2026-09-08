import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
	plugins: [vue()],
	define: {
		'process.env': JSON.stringify({ NODE_ENV: 'production' }),
		'process.env.NODE_ENV': JSON.stringify('production'),
	},
	build: {
		outDir: 'js',
		emptyOutDir: true,
		lib: {
			entry: 'src/main.ts',
			name: 'ShareViaDevice',
			formats: ['iife'],
			fileName: () => 'share-via-device-main-v101.js',
		},
		rollupOptions: {
			output: {
				assetFileNames: 'share-via-device-[name][extname]',
			},
		},
		sourcemap: true,
	},
})
