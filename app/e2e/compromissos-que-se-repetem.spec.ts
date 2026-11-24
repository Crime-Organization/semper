// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Compromissos que se repetem (#307). O relógio fica parado em quarta-feira, 04/11/2026, 12h em Brasília. Quem está logado é o
// Mauro (administrador). Cada data da repetição é um cartão: a agenda mostra todas; a tabela e o quadro, só a próxima em aberto.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao, acaoNoMenuDoCartao } from './ajudantes';

const AGORA = new Date('2026-11-04T12:00:00-03:00');
const TITULO = 'Reunião semanal do núcleo';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA);
});

const agenda = (page: Page) => page.getByRole('region', { name: 'Agenda por data' });
const visao = (page: Page, nome: string) => page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: nome }).click();
const periodo = (page: Page, nome: string) => page.getByRole('group', { name: 'Período' }).getByRole('button', { name: nome }).click();
const cartao = (page: Page) => page.getByRole('dialog').filter({ has: page.getByLabel('Situação do compromisso') });
const datasDaReuniao = (page: Page) => agenda(page).getByRole('link', { name: new RegExp(TITULO) });

/** Cadastra a reunião das 10h30 de hoje, toda semana, 4 vezes (04, 11, 18 e 25/11), e fecha o cartão dela. */
async function cadastrarSemanal(page: Page) {
  await page.goto('/agenda/novo/');
  await page.getByLabel('Título').fill(TITULO);
  await page.getByLabel('Data').fill('04/11/2026');
  await page.getByLabel('Hora').fill('10:30');
  await page.getByLabel('Repetir', { exact: true }).selectOption({ label: 'Toda semana' });
  await page.getByRole('group', { name: 'Termina' }).getByText('Depois de algumas vezes', { exact: true }).click();
  await page.getByLabel('Quantas vezes').fill('4');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByText(/Compromisso \w+ cadastrado, com mais 3 datas na agenda\./)).toBeVisible();
  await expect(cartao(page).getByRole('heading', { name: TITULO, level: 2 })).toBeVisible();
  await abrirSecao(cartao(page), 'Dados do compromisso');
  await expect(cartao(page)).toContainText('Toda semana, 4 vezes');
  await page.getByRole('button', { name: 'Fechar' }).click();
}

/** Abre, na agenda do mês, o cartão da reunião no dia pedido (dd/mm). */
async function abrirNoDia(page: Page, dia: string) {
  await page.goto('/agenda/');
  await visao(page, 'Agenda');
  await periodo(page, 'Mês');
  const doDia = agenda(page).getByRole('listitem', { name: new RegExp(`${dia}$`) });
  await doDia.getByRole('link', { name: new RegExp(TITULO) }).click();
  await expect(cartao(page).getByRole('heading', { name: TITULO, level: 2 })).toBeVisible();
}

test.describe('Dado o cadastro de uma reunião que se repete', () => {
  test('quando ela se repete toda semana, 4 vezes, então a agenda mostra as quatro datas, e a tabela e o quadro, só a próxima', async ({ page }) => {
    // Dado / Quando
    await cadastrarSemanal(page);
    // Então: no mês, as quatro datas
    await visao(page, 'Agenda');
    await periodo(page, 'Mês');
    await expect(datasDaReuniao(page)).toHaveCount(4);
    // E na tabela e no quadro, uma só: a de hoje
    await visao(page, 'Tabela');
    await expect(page.getByRole('row').filter({ hasText: TITULO })).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: TITULO })).toContainText('04/11/2026 · 10:30');
    await visao(page, 'Kanban');
    await expect(page.getByRole('list', { name: 'Agendado', exact: true }).getByText(TITULO)).toHaveCount(1);
  });

  test('quando o tipo é audiência, então o cadastro não oferece repetir', async ({ page }) => {
    // Dado
    await page.goto('/agenda/novo/');
    await expect(page.getByLabel('Repetir', { exact: true })).toBeVisible();
    // Quando
    await page.getByRole('group', { name: 'Tipo' }).getByText('Audiência', { exact: true }).click();
    // Então
    await expect(page.getByLabel('Repetir', { exact: true })).toHaveCount(0);
  });

  test('quando a data final vem antes da data do compromisso, então o cadastro avisa e não segue', async ({ page }) => {
    // Dado
    await page.goto('/agenda/novo/');
    await page.getByLabel('Título').fill(TITULO);
    await page.getByLabel('Data').fill('04/11/2026');
    await page.getByLabel('Hora').fill('10:30');
    await page.getByLabel('Repetir', { exact: true }).selectOption({ label: 'Todo mês' });
    await page.getByRole('group', { name: 'Termina' }).getByText('Até uma data', { exact: true }).click();
    await page.getByLabel('Repetir até').fill('01/11/2026');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('A data final precisa ser depois da data do compromisso.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar compromisso' })).toHaveCount(0);
  });
});

test.describe('Dada uma reunião que se repete toda semana', () => {
  test('quando a pessoa muda o horário da segunda data, "esta e as seguintes", então ela e as seguintes mudam; a primeira, não', async ({ page }) => {
    // Dado
    await cadastrarSemanal(page);
    await abrirNoDia(page, '11/11');
    // Quando
    await cartao(page).getByRole('button', { name: /^Data e horário: / }).click();
    // A janela das datas (#422) flutua sobre o cartão: é achada pela página, e não dentro do cartão.
    const formulario = page.getByRole('dialog', { name: 'Mudar a data e o horário' }).filter({ has: page.getByRole('group', { name: 'Calendário' }) });
    await formulario.getByLabel('Hora do compromisso').selectOption('15:00');   // desde a #431, a hora vem numa lista de horários
    await formulario.getByRole('button', { name: 'Salvar' }).click();
    await page.getByRole('dialog', { name: 'Mudar a data e o horário' }).getByRole('button', { name: 'Esta e as seguintes' }).click();
    // Então
    await expect(page.getByText('3 compromissos mudados na repetição.')).toBeVisible();
    // O X do cartão (a janela das datas, que fecha logo depois de gravar, também tem o seu, desde a #431)
    await cartao(page).getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(agenda(page).getByRole('listitem', { name: /04\/11$/ }).getByRole('link', { name: new RegExp(TITULO) })).toContainText('10:30');
    for (const dia of ['11/11', '18/11', '25/11']) {
      await expect(agenda(page).getByRole('listitem', { name: new RegExp(`${dia}$`) }).getByRole('link', { name: new RegExp(TITULO) })).toContainText('15:00');
    }
  });

  test('quando a pessoa muda a data da terceira, "só esta", então só ela muda de dia', async ({ page }) => {
    // Dado
    await cadastrarSemanal(page);
    await abrirNoDia(page, '18/11');
    // Quando
    await cartao(page).getByRole('button', { name: /^Data e horário: / }).click();
    // A janela das datas (#422) flutua sobre o cartão: é achada pela página, e não dentro do cartão.
    const formulario = page.getByRole('dialog', { name: 'Mudar a data e o horário' }).filter({ has: page.getByRole('group', { name: 'Calendário' }) });
    await formulario.getByRole('textbox', { name: 'Data' }).fill('19/11/2026');
    await formulario.getByRole('button', { name: 'Salvar' }).click();
    await page.getByRole('dialog', { name: 'Mudar a data e o horário' }).getByRole('button', { name: 'Só esta' }).click();
    // Então
    await expect(page.getByText('Compromisso atualizado.')).toBeVisible();
    // O X do cartão (a janela das datas, que fecha logo depois de gravar, também tem o seu, desde a #431)
    await cartao(page).getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(agenda(page).getByRole('listitem', { name: /18\/11$/ }).getByRole('link', { name: new RegExp(TITULO) })).toHaveCount(0);
    await expect(agenda(page).getByRole('listitem', { name: /19\/11$/ }).getByRole('link', { name: new RegExp(TITULO) })).toHaveCount(1);
    await expect(datasDaReuniao(page)).toHaveCount(4);
  });

  test('quando a pessoa arquiva a segunda data, "esta e as seguintes", então só a primeira continua na agenda', async ({ page }) => {
    // Dado
    await cadastrarSemanal(page);
    await abrirNoDia(page, '11/11');
    // Quando
    await acaoNoMenuDoCartao(page, cartao(page), 'Arquivar');
    await page.getByRole('dialog', { name: 'Arquivar o compromisso' }).getByRole('button', { name: 'Esta e as seguintes' }).click();
    // Então
    await expect(page.getByText('3 compromissos arquivados. A repetição parou.')).toBeVisible();
    // O X do cartão (a janela das datas, que fecha logo depois de gravar, também tem o seu, desde a #431)
    await cartao(page).getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(datasDaReuniao(page)).toHaveCount(1);
  });
});

test.describe('Dada uma reunião que não se repete (#431)', () => {
  test('quando a pessoa escolhe "Toda semana" na repetição da janela das datas e salva, então as datas seguintes vão para a agenda, e a lista passa a mostrar a repetição, sem mudar ali', async ({ page }) => {
    // Dado: uma reunião de hoje, sem repetir
    await page.goto('/agenda/novo/');
    await page.getByLabel('Título').fill(TITULO);
    await page.getByLabel('Data').fill('04/11/2026');
    await page.getByLabel('Hora').fill('10:30');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar compromisso' }).click();
    await expect(cartao(page).getByRole('heading', { name: TITULO, level: 2 })).toBeVisible();
    // Quando
    await cartao(page).getByRole('button', { name: /^Data e horário: / }).click();
    const janela = page.getByRole('dialog', { name: 'Mudar a data e o horário' });
    await janela.getByRole('combobox', { name: 'Repetição' }).selectOption({ label: 'Toda semana' });
    await janela.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByText(/Compromisso \w+ passa a se repetir, com mais \d+ datas na agenda\./)).toBeVisible();
    await expect(janela).toHaveCount(0);
    await cartao(page).getByRole('button', { name: /^Data e horário: / }).click();
    await expect(janela.getByRole('combobox', { name: 'Repetição' })).toBeDisabled();
    await expect(janela.getByRole('combobox', { name: 'Repetição' })).toHaveValue(/Toda semana/);
    await page.keyboard.press('Escape');
    await cartao(page).getByRole('button', { name: 'Fechar', exact: true }).click();
    await visao(page, 'Agenda');
    await periodo(page, 'Mês');
    // Toda semana, sem data para terminar (como no cadastro): uma em cada quarta-feira
    for (const dia of ['04/11', '11/11', '18/11', '25/11']) {
      await expect(agenda(page).getByRole('listitem', { name: new RegExp(`${dia}$`) }).getByRole('link', { name: new RegExp(TITULO) })).toHaveCount(1);
    }
  });
});
