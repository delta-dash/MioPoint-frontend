import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		proxy: {
			// This rule handles all requests to /api
			'/api': {
				// The target is your Python backend
				target: 'http://localhost:8000',
				// THIS IS THE FIX: It tells Vite to proxy WebSocket requests as well
				ws: true,
			}
		}
	},
	build: { emptyOutDir: true
	}
});
