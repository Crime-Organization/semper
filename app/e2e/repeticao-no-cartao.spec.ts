// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A repetição no cartão do compromisso (#417): o lápis dá repetição a um compromisso que já existe, liga e desliga a demanda de cada
// data, e pergunta "só esta / esta e as seguintes" ao mudar o título, o local, a equipe e as pessoas. O relógio fica parado em
// quarta-feira, 04/11/2026, 12h em Brasília. Quem está logado é o Mauro (administrador).
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

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

/** O texto da seção "Dados do compromisso" do cartão aberto. Lido com expect.poll: depois de salvar, o cartão recarrega logo após o aviso. */
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
    await expect.poll(() => dados(page)).toContain('Toda semana, 4 vezes');
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
    await expect.poll(() => dados(page)).toContain('Nasce 7 dias antes de cada data');
    // Quando: desliga
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await expect(lapis(page).getByLabel('Gerar demanda (dias antes)')).toHaveValue('7');
    await lapis(page).getByLabel('Gerar demanda (dias antes)').fill('');
    await lapis(page).getByRole('button', { name: 'Salvar', exact: true }).click();
    // Então
    await expect(page.getByText('As datas em aberto não geram mais demanda. As que já nasceram continuam.')).toBeVisible();
    await expect.poll(() => dados(page)).not.toContain('Nasce 7 dias antes');
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
    await expect.poll(() => dados(page)).toContain('Sala do segundo andar');
    await abrirNoDia(page, '25/11');
    await expect.poll(() => dados(page)).toContain('Sala do segundo andar');
    await abrirNoDia(page, '04/11');
    await expect.poll(() => dados(page)).not.toContain('Sala do segundo andar');
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

test.describe('Dada uma reunião que se repete toda semana, mudada pelo lápis', () => {
  const pergunta = (page: Page) => page.getByRole('dialog', { name: 'Mudar o compromisso que se repete' });
  /** No lápis aberto, troca o responsável. */
  const responsavel = (page: Page, nome: string) => lapis(page).getByLabel('Responsável').selectOption({ label: nome });
  const salvar = (page: Page) => lapis(page).getByRole('button', { name: 'Salvar', exact: true }).click();

  test('quando a pessoa troca o responsável e liga uma pessoa, "esta e as seguintes", então uma data adiante também muda; a anterior, não', async ({ page }) => {
    // Dado
    await cadastrar(page, true);
    await abrirNoDia(page, '11/11');
    // Quando
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await responsavel(page, 'Bruno Exemplo Souza');
    await lapis(page).getByRole('textbox', { name: 'Pessoa ligada' }).fill('JOSÉ DA SILVA');
    await lapis(page).getByRole('button', { name: /^JOSÉ DA SILVA TESTE/ }).first().click();
    await salvar(page);
    await expect(pergunta(page)).toContainText('Mudar a equipe e as pessoas só nesta data, ou nesta e nas seguintes ainda em aberto?');
    await pergunta(page).getByRole('button', { name: 'Esta e as seguintes' }).click();
    // Então
    await expect(page.getByText('3 compromissos mudados na repetição.')).toBeVisible();
    await abrirNoDia(page, '25/11');
    await abrirSecao(cartao(page), 'Pessoas');
    await expect(cartao(page).getByText('JOSÉ DA SILVA TESTE')).toBeVisible();
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await expect(lapis(page).getByLabel('Responsável')).toHaveValue('u-bruno');
    // E a primeira data continua com o Mauro
    await lapis(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
    await abrirNoDia(page, '04/11');
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await expect(lapis(page).getByLabel('Responsável')).toHaveValue('u-master');
  });

  test('quando a pessoa cancela a pergunta, então nada é gravado, nem nesta data nem nas seguintes', async ({ page }) => {
    // Dado
    await cadastrar(page, true);
    await abrirNoDia(page, '11/11');
    // Quando
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await lapis(page).getByLabel('Local').fill('Sala que não fica');
    await salvar(page);
    await pergunta(page).getByRole('button', { name: 'Cancelar' }).click();
    // Então: o lápis continua aberto, com o que a pessoa escreveu
    await expect(pergunta(page)).toHaveCount(0);
    await expect(lapis(page).getByLabel('Local')).toHaveValue('Sala que não fica');
    await lapis(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect.poll(() => dados(page)).not.toContain('Sala que não fica');
    await abrirNoDia(page, '25/11');
    await expect.poll(() => dados(page)).not.toContain('Sala que não fica');
  });

  test('dado o Bruno responsável por todas as datas, quando ele passa as seguintes à Ana e liga a demanda, então a demanda vale e ele sai da data', async ({ page }) => {
    // Dado
    await cadastrar(page, true);
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await responsavel(page, 'Bruno Exemplo Souza');
    await salvar(page);
    await pergunta(page).getByRole('button', { name: 'Esta e as seguintes' }).click();
    await expect(page.getByText('4 compromissos mudados na repetição.')).toBeVisible();
    await entrarComo(page, 'u-bruno');
    await abrirNoDia(page, '11/11');
    // Quando: a demanda vai antes das seguintes, enquanto ele ainda muda todas as datas em aberto
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await responsavel(page, 'Ana Teste Lima');
    await lapis(page).getByLabel('Gerar demanda (dias antes)').fill('7');
    await salvar(page);
    await pergunta(page).getByRole('button', { name: 'Esta e as seguintes' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'A demanda passa a nascer 7 dias antes de cada data em aberto.' })
      .filter({ hasText: 'Você saiu dele, e a saída ficou no histórico.' })).toBeVisible();
    await expect(page.getByText(/não foi possível/)).toHaveCount(0);
  });

  test('dado o Bruno posto só na terceira data, quando ele muda o título dela no próprio lugar, "esta e as seguintes", então esta muda e a mensagem diz que as seguintes não', async ({ page }) => {
    // Dado
    await cadastrar(page, true);
    await abrirNoDia(page, '18/11');
    await cartao(page).getByRole('button', { name: 'Editar' }).click();
    await responsavel(page, 'Bruno Exemplo Souza');
    await salvar(page);
    await pergunta(page).getByRole('button', { name: 'Só esta' }).click();
    await expect(page.getByText('Compromisso atualizado.')).toBeVisible();
    await entrarComo(page, 'u-bruno');
    await abrirNoDia(page, '18/11');
    // Quando
    await cartao(page).getByRole('button', { name: TITULO, exact: true }).click();
    await cartao(page).getByRole('textbox', { name: 'Título' }).fill(`${TITULO} (do Bruno)`);
    await cartao(page).getByRole('textbox', { name: 'Título' }).press('Enter');
    await pergunta(page).getByRole('button', { name: 'Esta e as seguintes' }).click();
    // Então: esta data ficou gravada, o cartão mostra como ficou, e as seguintes não mudaram
    await expect(page.getByText(/^O compromisso \w+ foi atualizado, mas não foi possível mudar as seguintes: Há datas seguintes desta repetição/)).toBeVisible();
    await expect(cartao(page).getByRole('heading', { name: `${TITULO} (do Bruno)`, level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(noDia(page, '18/11')).toContainText('(do Bruno)');
    await expect(noDia(page, '25/11')).not.toContainText('(do Bruno)');
  });
});
