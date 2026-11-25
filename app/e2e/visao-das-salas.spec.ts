// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A visão das salas na Agenda (#438): todas as salas lado a lado, num dia, por horário. O relógio fica parado em quarta-feira,
// 04/11/2026, 12h em Brasília. Quem está logado é o Mauro (administrador). A semente do banco fictício não tem salas: cada caso
// cadastra as suas.
import { expect, test, type Page } from '@playwright/test';
import { ALVO_DE_TOQUE, entrarComo } from './ajudantes';

const AGORA = new Date('2026-11-04T12:00:00-03:00');
const HOJE = '04/11/2026';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA);
});

/** Nas Configurações, cadastra uma sala. */
async function cadastrarSala(page: Page, nome: string, capacidade: string) {
  await page.goto('/configuracoes/');
  const salas = page.getByRole('region', { name: 'Salas' });
  await salas.getByRole('button', { name: 'Nova sala' }).click();
  await salas.getByLabel('Nome da sala').fill(nome);
  await salas.getByLabel('Capacidade').fill(capacidade);
  await salas.getByRole('button', { name: 'Cadastrar sala' }).click();
  await expect(page.getByText(`Sala "${nome}" cadastrada.`)).toBeVisible();
}
/** Cadastra uma reunião hoje, na sala pedida, e fecha o cartão que abre. */
async function reuniaoNaSala(page: Page, titulo: string, sala: string, hora: string, ate: string) {
  await page.goto('/agenda/novo/');
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Data').fill(HOJE);
  await page.getByLabel('Hora').fill(hora);
  await page.getByLabel('Até').fill(ate);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByLabel('Sala').selectOption({ label: sala });
  await salvarDaqui(page);
}
/** Da etapa "Onde" até salvar. */
async function salvarDaqui(page: Page) {
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByText(/Compromisso \w+ cadastrado\./)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
}
/** Abre a Agenda na visão das salas. */
async function abrirSalas(page: Page) {
  await page.goto('/agenda/');
  await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Salas' }).click();
  const grade = page.getByRole('table', { name: 'Salas por horário' });
  await expect(grade).toBeVisible();
  return grade;
}

test.describe('Visão das salas na Agenda (#438)', () => {
  test('dado o escritório sem salas, quando a pessoa abre a Agenda, então a visão das salas não aparece', async ({ page }) => {
    // Dado / Quando
    await page.goto('/agenda/');
    // Então
    const periodo = page.getByRole('group', { name: 'Período' });
    await expect(periodo.getByRole('button', { name: 'Dia' })).toBeVisible();
    await expect(periodo.getByRole('button', { name: 'Salas' })).toHaveCount(0);
  });

  test('dadas duas salas, uma ocupada das 14h às 15h, quando a pessoa abre a visão das salas, então vê as duas lado a lado, com o ocupado e os livres; e troca de dia', async ({ page }) => {
    // Dado
    await cadastrarSala(page, 'Sala Verde', '6');
    await cadastrarSala(page, 'Sala Azul', '4');
    await reuniaoNaSala(page, 'Reunião com o perito', 'Sala Verde (6 pessoas)', '14:00', '15:00');
    // Quando
    const grade = await abrirSalas(page);
    // Então: as salas lado a lado, por nome, no dia de hoje
    await expect(page.getByRole('heading', { name: 'quarta-feira, 04/11/2026' })).toBeVisible();
    await expect(grade.getByRole('columnheader')).toHaveText(['Horário', /Sala Azul\s*4 pessoas/, /Sala Verde\s*6 pessoas/]);
    // Então: o horário ocupado mostra o compromisso e não deixa marcar; o mesmo horário na outra sala está livre
    await expect(grade.getByRole('link', { name: /Reunião com o perito/ })).toContainText('14:00 às 15:00');
    await expect(grade.getByRole('link', { name: 'Marcar em Sala Verde às 14:00' })).toHaveCount(0);
    await expect(grade.getByRole('link', { name: 'Marcar em Sala Verde às 14:30' })).toHaveCount(0);
    await expect(grade.getByRole('link', { name: 'Marcar em Sala Verde às 15:00' })).toBeVisible();
    await expect(grade.getByRole('link', { name: 'Marcar em Sala Azul às 14:00' })).toBeVisible();
    // Quando: o compromisso ocupado abre o cartão dele
    await grade.getByRole('link', { name: /Reunião com o perito/ }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Reunião com o perito' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
    // Quando: troca para o dia seguinte
    await page.getByRole('button', { name: 'Próximo' }).click();
    // Então: no outro dia, a sala está livre às 14h
    await expect(page.getByRole('heading', { name: 'quinta-feira, 05/11/2026' })).toBeVisible();
    await expect(grade.getByRole('link', { name: 'Marcar em Sala Verde às 14:00' })).toBeVisible();
    await expect(grade.getByRole('link', { name: /Reunião com o perito/ })).toHaveCount(0);
  });

  test('dado um horário livre, quando a pessoa clica nele, então abre o novo compromisso já com a sala, a data e a hora; e, salvo, o horário fica ocupado', async ({ page }) => {
    // Dado
    await cadastrarSala(page, 'Sala Verde', '6');
    const grade = await abrirSalas(page);
    // Quando
    await grade.getByRole('link', { name: 'Marcar em Sala Verde às 16:30' }).click();
    // Então: a data e a hora já vêm preenchidas
    await expect(page.getByRole('heading', { name: 'Novo compromisso' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Data/ })).toHaveValue(HOJE);
    await expect(page.getByLabel('Hora')).toHaveValue('16:30');
    // E a sala, na etapa "Onde"
    await page.getByLabel('Título').fill('Atendimento marcado pela sala');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByLabel('Sala', { exact: true }).locator('option:checked')).toHaveText('Sala Verde (6 pessoas)');
    // Quando: salva
    await salvarDaqui(page);
    // Então: na visão das salas, o horário ficou ocupado (sem hora de fim, por 1 hora)
    const depois = await abrirSalas(page);
    await expect(depois.getByRole('link', { name: /Atendimento marcado pela sala/ })).toContainText('16:30 às 17:30');
    await expect(depois.getByRole('link', { name: 'Marcar em Sala Verde às 17:00' })).toHaveCount(0);
    await expect(depois.getByRole('link', { name: 'Marcar em Sala Verde às 17:30' })).toBeVisible();
  });

  test('dado um compromisso de que a pessoa não participa, quando ele ocupa uma sala, então ela vê só que a sala está ocupada, sem o título', async ({ page }) => {
    // Dado: a reunião do Mauro, sem mais ninguém; e a visualização fechada (cada um vê o que é seu)
    await cadastrarSala(page, 'Sala Verde', '6');
    await reuniaoNaSala(page, 'Conversa reservada', 'Sala Verde (6 pessoas)', '10:00', '11:00');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { fecharVisibilidade(l: boolean): void } }).SEMPER_FALSO.fecharVisibilidade(true));
    // Quando: o Bruno abre a visão das salas
    await entrarComo(page, 'u-bruno');
    const grade = await abrirSalas(page);
    // Então
    const ocupado = grade.getByRole('cell', { name: /Ocupado/ });
    await expect(ocupado).toContainText('10:00 às 11:00');
    await expect(grade.getByText('Conversa reservada')).toHaveCount(0);
    await expect(grade.getByRole('link', { name: 'Marcar em Sala Verde às 10:00' })).toHaveCount(0);
    await expect(grade.getByRole('link', { name: 'Marcar em Sala Verde às 11:00' })).toBeVisible();
  });

  test('dado o celular, quando a pessoa abre a visão das salas, então a grade cabe na tela, rolando só dentro dela', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 812 });
    await cadastrarSala(page, 'Sala Verde', '6');
    await cadastrarSala(page, 'Sala Azul', '4');
    await cadastrarSala(page, 'Sala Amarela', '8');
    // Quando
    const grade = await abrirSalas(page);
    // Então: a página não rola para o lado, e o horário livre é um alvo de toque
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const livre = await grade.getByRole('link', { name: 'Marcar em Sala Azul às 09:00' }).boundingBox();
    expect(livre!.height).toBeGreaterThanOrEqual(ALVO_DE_TOQUE);
  });
});

