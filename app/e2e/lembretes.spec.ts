// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Hora e lembrete nos prazos de tarefas e demandas (#286). O relógio fica parado em quarta-feira, 04/11/2026, 12h em Brasília.
// No banco de verdade, a rotina dos lembretes roda a cada minuto; no fictício, o teste a chama num instante escolhido
// (SEMPER_FALSO.gerarLembretes). Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';

const AGORA = new Date('2026-11-04T12:00:00-03:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA);
});

/** A rotina dos lembretes num instante de Brasília (ex.: '2026-11-05T13:00:00-03:00'). */
async function rodarOsLembretes(page: Page, quando: string) {
  await page.evaluate(q => (window as unknown as { SEMPER_FALSO: { gerarLembretes(quando: string): void } }).SEMPER_FALSO.gerarLembretes(q), quando);
}
const agenda = (page: Page) => page.getByRole('region', { name: 'Agenda por data' });

test.describe('Hora e lembrete no prazo da tarefa', () => {
  const TITULO = 'Protocolar o recurso';

  test('quando a tarefa é cadastrada com hora e lembrete, então a hora aparece no cartão, no quadro, na tabela e na agenda, e o lembrete chega na hora marcada', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill(TITULO);
    await page.getByLabel('Prazo').fill('05112026');
    await page.getByLabel('Hora').fill('14:00');
    await page.getByLabel('Lembrete').selectOption({ label: '1 hora antes' });
    await expect(page.getByText('Sem hora, o lembrete conta o prazo às 9h.', { exact: false })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então: o cartão
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: TITULO })).toBeVisible();
    await expect(cartao).toContainText('Prazo: 05/11/2026 às 14:00');
    await expect(cartao).toContainText('Lembrete: 1 hora antes');
    // Então: o quadro e a tabela
    await page.goto('/tarefas/');
    await expect(page.getByRole('list', { name: 'Para fazer' }).getByRole('listitem').filter({ hasText: TITULO })).toContainText('Prazo: 05/11/2026 às 14:00');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: TITULO })).toContainText('Prazo: 05/11/2026 às 14:00');
    // Então: a agenda da semana
    await page.goto('/agenda/');
    await expect(agenda(page).getByRole('region', { name: 'quinta-feira, 05/11' }).getByRole('link', { name: new RegExp(TITULO) })).toContainText('Prazo da tarefa · 14:00');
    // Quando: a rotina roda antes e depois da hora do lembrete (13h)
    await rodarOsLembretes(page, '2026-11-05T12:59:00-03:00');
    await page.goto('/mensagens/');
    await expect(page.getByRole('listitem', { name: `Lembrete não lido: ${TITULO}` })).toHaveCount(0);
    await rodarOsLembretes(page, '2026-11-05T13:00:00-03:00');
    await page.goto('/mensagens/');
    // Então: o lembrete chega como lembrete, com a data e a hora do prazo
    const lembrete = page.getByRole('listitem', { name: `Lembrete não lido: ${TITULO}` });
    await expect(lembrete).toContainText('Lembrete: 1 hora antes');
    await expect(lembrete).toContainText('05/11/2026 às 14:00');
    await expect(lembrete).not.toContainText('Falta');
    await lembrete.getByRole('link').click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: TITULO })).toBeVisible();
  });

  test('quando a hora é posta sem o prazo, então a etapa pede o prazo e não segue', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/nova/');
    await page.getByLabel('Título').fill(TITULO);
    await page.getByLabel('Hora').fill('14:00');
    await page.getByLabel('Lembrete').selectOption({ label: 'Na hora do prazo' });
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Informe o prazo para pôr a hora')).toBeVisible();
    await expect(page.getByText('Informe o prazo para marcar o lembrete')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A tarefa', level: 2 })).toBeVisible();
  });
});

test.describe('Lembrete no prazo da demanda', () => {
  const TITULO = 'Preparar o parecer';

  test('quando a demanda tem prazo sem hora e lembrete de 1 dia, então o lembrete chega às 9h do dia anterior', async ({ page }) => {
    // Dado
    await page.goto('/demandas/nova/');
    await page.getByLabel('Título').fill(TITULO);
    await page.getByLabel('Prazo de entrega').fill('06112026');
    await page.getByLabel('Lembrete').selectOption({ label: '1 dia antes' });
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar demanda' }).click();
    // Então: o cartão e a agenda
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: TITULO })).toBeVisible();
    await expect(cartao).toContainText('Prazo: 06/11/2026');
    await expect(cartao).not.toContainText('06/11/2026 às');
    await expect(cartao).toContainText('Lembrete: 1 dia antes');
    await page.goto('/agenda/');
    await expect(agenda(page).getByRole('region', { name: 'sexta-feira, 06/11' }).getByRole('link', { name: new RegExp(TITULO) })).toContainText('Prazo da demanda');
    // Quando
    await rodarOsLembretes(page, '2026-11-05T09:00:00-03:00');
    await page.goto('/mensagens/');
    // Então
    const lembrete = page.getByRole('listitem', { name: `Lembrete não lido: ${TITULO}` });
    await expect(lembrete).toContainText('Lembrete: 1 dia antes');
    await expect(lembrete).toContainText('demanda');
  });
});
