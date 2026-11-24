// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A repetição no cartão do compromisso (#417): o lápis dá repetição a um compromisso que já existe, liga e desliga a demanda de cada
// data, e pergunta "só esta / esta e as seguintes" ao mudar o título, o local, a equipe e as pessoas. O relógio fica parado em
// quarta-feira, 04/11/2026, 12h em Brasília. Quem está logado é o Mauro (administrador).
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const AGORA = new Date('2026-11-04T12:00:00-03:00');
const TITULO = 'Reunião do núcleo de marcas';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA);
});

const agenda = (page: Page) => page.getByRole('region', { name: 'Agenda por data' });
const cartao = (page: Page) => page.getByRole('dialog').filter({ has: page.getByLabel('Situação do compromisso') });
// Com o lápis aberto, o topo do cartão mostra só "Modo de edição" (sem a Situação): o formulário é achado pela página.
const lapis = (page: Page) => page.getByRole('form', { name: 'Editar compromisso' });
const noDia = (page: Page, dia: string) => agenda(page).getByRole('listitem', { name: new RegExp(`${dia}$`) }).getByRole('link', { name: new RegExp(TITULO) });

/** Cadastra a reunião das 10h30 de hoje; com `semanal`, toda semana, 4 vezes (04, 11, 18 e 25/11). O cartão dela fica aberto. */
async function cadastrar(page: Page, semanal: boolean) {
  await page.goto('/agenda/novo/');
  await page.getByLabel('Título').fill(TITULO);
  await page.getByLabel('Data').fill('04/11/2026');
  await page.getByLabel('Hora').fill('10:30');
  if (semanal) {
    await page.getByLabel('Repetir', { exact: true }).selectOption({ label: 'Toda semana' });
    await page.getByRole('group', { name: 'Termina' }).getByText('Depois de algumas vezes', { exact: true }).click();
    await page.getByLabel('Quantas vezes').fill('4');
  }
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(cartao(page).getByRole('heading', { name: TITULO, level: 2 })).toBeVisible();
}

/** Abre, na agenda do mês, o cartão da reunião no dia pedido (dd/mm). */
async function abrirNoDia(page: Page, dia: string) {
  await page.goto('/agenda/');
  await page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: 'Agenda' }).click();
  await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Mês' }).click();
  await noDia(page, dia).click();
  await expect(cartao(page).getByRole('heading', { name: TITULO, level: 2 })).toBeVisible();
}

/** O texto da seção "Dados do compromisso" do cartão aberto. */
async function dados(page: Page) {
  await abrirSecao(cartao(page), 'Dados do compromisso');
  return cartao(page).getByRole('definition').allInnerTexts().then(t => t.join(' | '));
}

test.describe('Dado um compromisso que não se repete', () => {
  test('quando a pessoa escolhe a repetição pelo lápis, então nascem as datas seguintes, como no cadastro', async ({ page }) => {
    // Dado
    await cadastrar(page, false);
    // Quando
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await lapis(page).getByLabel('Repetir', { exact: true }).selectOption({ label: 'Toda semana' });
    await lapis(page).getByRole('group', { name: 'Termina' }).getByText('Depois de algumas vezes', { exact: true }).click();
    await lapis(page).getByLabel('Quantas vezes').fill('4');
    await lapis(page).getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByText(/Compromisso \w+ atualizado\. Ele agora se repete, com mais 3 datas na agenda\./)).toBeVisible();
    expect(await dados(page)).toContain('Toda semana, 4 vezes');
    await page.getByRole('button', { name: 'Fechar' }).click();
    await abrirNoDia(page, '25/11');
    // E a data que já se repete não oferece a repetição de novo
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await expect(lapis(page).getByLabel('Repetir', { exact: true })).toHaveCount(0);
  });
});

test.describe('Dada uma reunião que se repete toda semana', () => {
  test('quando a pessoa liga a demanda de cada data pelo lápis e depois a desliga, então as datas em aberto seguem a escolha', async ({ page }) => {
    // Dado
    await cadastrar(page, true);
    // Quando: liga, 7 dias antes (as datas de 04/11 e 11/11 já estão no prazo)
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await lapis(page).getByLabel('Gerar demanda (dias antes)').fill('7');
    await lapis(page).getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByText('A demanda passa a nascer 7 dias antes de cada data em aberto. 2 demandas já nasceram para as datas mais próximas.')).toBeVisible();
    expect(await dados(page)).toContain('Nasce 7 dias antes de cada data');
    // Quando: desliga
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await expect(lapis(page).getByLabel('Gerar demanda (dias antes)')).toHaveValue('7');
    await lapis(page).getByLabel('Gerar demanda (dias antes)').fill('');
    await lapis(page).getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByText('As datas em aberto não geram mais demanda. As que já nasceram continuam.')).toBeVisible();
    expect(await dados(page)).not.toContain('Nasce 7 dias antes');
  });

  test('quando a pessoa muda o local da segunda data pelo lápis, "esta e as seguintes", então ela e as seguintes mudam; a primeira, não', async ({ page }) => {
    // Dado
    await cadastrar(page, true);
    await abrirNoDia(page, '11/11');
    // Quando
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await lapis(page).getByLabel('Local').fill('Sala do segundo andar');
    await lapis(page).getByRole('button', { name: 'Salvar', exact: true }).click();
    const pergunta = page.getByRole('dialog', { name: 'Mudar o compromisso que se repete' });
    await expect(pergunta).toContainText('Mudar o local só nesta data, ou nesta e nas seguintes ainda em aberto?');
    await pergunta.getByRole('button', { name: 'Esta e as seguintes' }).click();
    // Então
    await expect(page.getByText('3 compromissos mudados na repetição.')).toBeVisible();
    expect(await dados(page)).toContain('Sala do segundo andar');
    await abrirNoDia(page, '25/11');
    expect(await dados(page)).toContain('Sala do segundo andar');
    await abrirNoDia(page, '04/11');
    expect(await dados(page)).not.toContain('Sala do segundo andar');
  });

  test('quando a pessoa muda o título da terceira data no próprio lugar, "só esta", então só ela muda', async ({ page }) => {
    // Dado
    await cadastrar(page, true);
    await abrirNoDia(page, '18/11');
    // Quando
    await cartao(page).getByRole('button', { name: TITULO, exact: true }).click();
    await cartao(page).getByRole('textbox', { name: 'Título' }).fill(`${TITULO} (extra)`);
    await cartao(page).getByRole('textbox', { name: 'Título' }).press('Enter');
    const pergunta = page.getByRole('dialog', { name: 'Mudar o compromisso que se repete' });
    await expect(pergunta).toContainText('Mudar o título só nesta data');
    await pergunta.getByRole('button', { name: 'Só esta' }).click();
    // Então
    await expect(page.getByText('Compromisso atualizado.')).toBeVisible();
    await expect(cartao(page).getByRole('heading', { name: `${TITULO} (extra)`, level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(noDia(page, '18/11')).toContainText('(extra)');
    await expect(noDia(page, '25/11')).not.toContainText('(extra)');
  });
});
