// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Salas do escritório e agendamento interno, sem horário duplicado (#308). O relógio fica parado em quarta-feira, 04/11/2026, 12h em
// Brasília. Quem está logado é o Mauro (administrador). A semente do banco fictício não tem salas: cada caso cadastra as suas.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

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
  await expect(salas.getByRole('row', { name: new RegExp(nome) })).toBeVisible();
}
/** No cadastro de compromisso, preenche a primeira etapa (uma reunião hoje) e segue para a etapa "Onde". */
async function reuniaoAte(page: Page, titulo: string, hora: string, ate = '') {
  await page.goto('/agenda/novo/');
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Data').fill(HOJE);
  await page.getByLabel('Hora').fill(hora);
  if (ate) await page.getByLabel('Até').fill(ate);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByRole('heading', { name: 'Onde e de qual processo' })).toBeVisible();
}
/** Da etapa "Onde" até salvar. */
async function salvarDaqui(page: Page) {
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByText(/Compromisso \w+ cadastrado\./)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
}

test.describe('Salas do escritório (#308)', () => {
  test('dada uma sala ocupada das 14h às 15h, quando alguém marca outro compromisso nela às 14h30, então o SEMPER avisa com qual e não salva', async ({ page }) => {
    // Dado
    await cadastrarSala(page, 'Sala Verde', '6');
    await reuniaoAte(page, 'Reunião com o perito', '14:00', '15:00');
    await page.getByLabel('Sala').selectOption({ label: 'Sala Verde (6 pessoas)' });
    await salvarDaqui(page);
    // Quando
    await reuniaoAte(page, 'Conversa com o cliente', '14:30');
    await page.getByLabel('Sala').selectOption({ label: 'Sala Verde (6 pessoas)' });
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então: o aviso diz com qual compromisso, e o cadastro não segue
    await expect(page.getByText(/A sala Sala Verde já está ocupada das 14:00 às 15:00 por "Reunião com o perito" \(\w+\)\. Escolha outro horário ou outra sala\./)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Onde e de qual processo' })).toBeVisible();
    // Quando: troca o horário para depois do outro
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByLabel('Hora').fill('15:00');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então: agora salva
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar compromisso' }).click();
    await expect(page.getByText(/Compromisso \w+ cadastrado\./)).toBeVisible();
  });

  test('dado um horário ocupado na visão das salas (#438), quando a pessoa tenta marcar a mesma sala nele, então o SEMPER mostra que está ocupada e não salva', async ({ page }) => {
    // Dado
    await cadastrarSala(page, 'Sala Verde', '6');
    await reuniaoAte(page, 'Reunião com o perito', '14:00', '15:00');
    await page.getByLabel('Sala').selectOption({ label: 'Sala Verde (6 pessoas)' });
    await salvarDaqui(page);
    await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Salas' }).click();
    const grade = page.getByRole('table', { name: 'Salas por horário' });
    // Então: o horário ocupado não se marca pela visão
    await expect(grade.getByRole('link', { name: 'Marcar em Sala Verde às 14:30' })).toHaveCount(0);
    // Quando: abre o horário livre das 15h e muda a hora para 14h30, dentro do ocupado
    await grade.getByRole('link', { name: 'Marcar em Sala Verde às 15:00' }).click();
    await page.getByLabel('Título').fill('Conversa com o cliente');
    await page.getByLabel('Hora').fill('14:30');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByLabel('Sala', { exact: true }).locator('option:checked')).toHaveText('Sala Verde (6 pessoas)');
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então: o aviso diz que a sala está ocupada, e o cadastro não segue
    await expect(page.getByText(/A sala Sala Verde já está ocupada das 14:00 às 15:00 por "Reunião com o perito" \(\w+\)\./)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Onde e de qual processo' })).toBeVisible();
  });

  test('dado o calendário, quando a pessoa filtra por sala, então vê só os compromissos daquela sala', async ({ page }) => {
    // Dado
    await cadastrarSala(page, 'Sala Amarela', '4');
    await reuniaoAte(page, 'Na sala amarela', '10:00');
    await page.getByLabel('Sala').selectOption({ label: 'Sala Amarela (4 pessoas)' });
    await salvarDaqui(page);
    const agenda = page.getByRole('region', { name: 'Agenda por data' });
    await expect(agenda.getByRole('link', { name: /Reunião de equipe/ })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByLabel('Sala').selectOption({ label: 'Sala Amarela' });
    // Então
    await expect(agenda.getByRole('link', { name: /Na sala amarela/ })).toBeVisible();
    await expect(agenda.getByRole('link', { name: /Reunião de equipe/ })).toHaveCount(0);
  });

  test('dada uma sala sem uso, quando o administrador a desativa, então ela some das opções novas, e o compromisso antigo continua mostrando o nome', async ({ page }) => {
    // Dado
    await cadastrarSala(page, 'Sala Azul', '8');
    await reuniaoAte(page, 'Na sala azul', '09:30');
    await page.getByLabel('Sala').selectOption({ label: 'Sala Azul (8 pessoas)' });
    await salvarDaqui(page);
    // Quando
    await page.goto('/configuracoes/');
    const salas = page.getByRole('region', { name: 'Salas' });
    await salas.getByRole('row', { name: /Sala Azul/ }).getByRole('button', { name: /Desativar/ }).click();
    await salas.getByRole('button', { name: 'Confirmar: desativar Sala Azul' }).click();
    // Então: ela sai das salas ativas e vai para as desativadas
    await expect(page.getByText(/Sala "Sala Azul" desativada\./)).toBeVisible();
    await expect(salas.getByRole('row', { name: /Sala Azul/ })).toHaveCount(0);
    await abrirSecao(salas, 'Salas desativadas');
    await expect(salas.getByText('Sala Azul (8 pessoas) · desativada')).toBeVisible();
    // Então: o cadastro de compromisso não a oferece mais
    await reuniaoAte(page, 'Outra reunião', '16:00');
    await expect(page.getByLabel('Sala').getByRole('option', { name: /Sala Azul/ })).toHaveCount(0);
    // Então: o compromisso antigo continua com o nome dela
    await page.goto('/agenda/');
    await page.getByRole('region', { name: 'Agenda por data' }).getByRole('link', { name: /Na sala azul/ }).click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Dados do compromisso');
    await expect(cartao.getByText('Sala Azul (8 pessoas) · desativada')).toBeVisible();
  });
});
