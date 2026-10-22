const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e', timeout: 45000, expect: { timeout: 10000 }, workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: { trace: 'retain-on-failure' }
});
