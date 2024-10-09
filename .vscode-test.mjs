// .vscode-test.js
import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
	{
		files: 'out/test/**/*.test.js',
		version: 'insiders',

	}
	// you can specify additional test configurations, too
]);
