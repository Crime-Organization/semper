// Testes de ponta a ponta (veja TESTES.md): rodam no Chromium contra o banco fictício
// ("npm run teste", porta 8091), nunca contra o Supabase. Cada teste abre uma aba nova,
// então o banco fictício (guardado na sessão da aba) sempre começa do zero.
import { defineConfig, devices } from '@playwright/test';

const naRotina = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: naRotina,
  retries: naRotina ? 1 : 0,
  reporter: naRotina ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8091',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run teste',
    url: 'http://localhost:8091',
    reuseExistingServer: !naRotina,
    timeout: 60_000
  }
});
