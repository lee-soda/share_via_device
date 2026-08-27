import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
	plugins: [vue()],
	build: {
		outDir: 'js',
		emptyOutDir: true,
		lib: {
			entry: 'src/main.ts',
			formats: ['es'],
			fileName: () => 'share-via-device-main.js',
		},
		rollupOptions: {
			output: {
				assetFileNames: 'share-via-device-[name][extname]',
			},
		},
		sourcemap: true,
	},
})
