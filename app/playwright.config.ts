// Testes de ponta a ponta (veja TESTES.md): rodam no Chromium contra o banco fictício
// ("npm run teste", porta 8091), nunca contra o Supabase. Cada teste abre uma aba nova,
// então o banco fictício (guardado na sessão da aba) sempre começa do zero.
import { defineConfig, devices } from '@playwright/test';

/** O fuso dos testes, o de Brasília: vale para o navegador e para as datas que os próprios testes calculam, em qualquer computador. */
const FUSO_DOS_TESTES = 'America/Sao_Paulo';
process.env.TZ = FUSO_DOS_TESTES;

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
    timezoneId: FUSO_DOS_TESTES,
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
