// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Compromisso ligado a tarefas, demandas e contratos, e o tipo Atendimento (#306). O relógio fica parado em quarta-feira, 04/11/2026,
// 12h em Brasília. Na semente do banco fictício: "Notificar o devedor" é uma demanda avulsa de MARIA APARECIDA EXEMPLO; "Renovar a
// procuração" é uma tarefa avulsa; "Registro de marca" é um contrato; "Reunião de equipe" é a reunião de hoje às 09:00. Quem está
// logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const AGORA = new Date('2026-11-04T12:00:00-03:00');
const HOJE = '04/11/2026';
const CHAVE = 'semper-dados-falsos';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA);
});

type Colecao = 'demandas' | 'tarefas' | 'contratos' | 'compromissos';
/** O id de um item da semente, lido do banco fictício da aba pelo valor de um campo (o título, o serviço...). */
async function idDe(page: Page, colecao: Colecao, campo: string, valor: string) {
  await page.goto('/inicio/');
  return page.evaluate(([chave, c, k, v]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as Record<string, Record<string, unknown>[]>;
    return bd[c].find(x => String(x[k]).startsWith(v))!.id as string;
  }, [CHAVE, colecao, campo, valor]);
}
const ENDERECO: Record<Colecao, string> = { demandas: '/demandas/?id=', tarefas: '/tarefas/?id=', contratos: '/contratos/?id=', compromissos: '/agenda/?id=' };
/** Abre o cartão do item e espera a seção pedida aparecer. */
async function abrirCartao(page: Page, colecao: Colecao, id: string, secao: string) {
  await page.goto(ENDERECO[colecao] + id);
  const cartao = page.getByRole('dialog');
  await expect(tituloDaSecao(cartao, secao)).toBeVisible();
  return cartao;
}
/** O botão que abre e recolhe a seção, com o contador ao lado do título. */
const tituloDaSecao = (cartao: Locator, titulo: string) => cartao.getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) });
/** A seção do cartão pelo título (aberta). */
async function secao(cartao: Locator, titulo: string) {
  await abrirSecao(cartao, titulo);
  return cartao.locator('section', { has: cartao.page().getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) }) });
}

/** No cadastro de compromisso aberto: um atendimento hoje às 15:00, passando pelas etapas até salvar. Devolve a etapa das pessoas, para conferir. */
async function salvarAtendimento(page: Page, titulo: string, pessoa?: string) {
  const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
  await cadastro.getByRole('group', { name: 'Tipo' }).getByText('Atendimento', { exact: true }).click();
  await cadastro.getByLabel('Título').fill(titulo);
  await cadastro.getByLabel('Data').fill(HOJE);
  await cadastro.getByLabel('Hora').fill('15:00');
  await cadastro.getByRole('button', { name: 'Próxima' }).click();
  await cadastro.getByRole('button', { name: 'Próxima' }).click();
  if (pessoa) await expect(cadastro.getByRole('group', { name: 'Pessoas ligadas' })).toContainText(pessoa);
  await cadastro.getByRole('button', { name: 'Próxima' }).click();
  await cadastro.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByText(/Compromisso \w+ cadastrado\./)).toBeVisible();
}

test.describe('Compromisso que nasce no cartão de uma demanda ou de um contrato (#306)', () => {
  test('dado o cartão de uma demanda, quando cria ali um atendimento, então ele nasce ligado, com o cliente dela, e aparece nos dois cartões', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Notificar o devedor');
    let cartao = await abrirCartao(page, 'demandas', id, 'Compromissos');
    await expect(tituloDaSecao(cartao, 'Compromissos')).toHaveText(/^Compromissos0$/);
    const compromissos = await secao(cartao, 'Compromissos');
    await expect(compromissos.getByText('Nenhum compromisso ligado a esta demanda.')).toBeVisible();
    // Quando
    await compromissos.getByRole('link', { name: 'Novo compromisso desta demanda' }).click();
    // Então: o cadastro diz de onde o compromisso nasce
    await expect(page.getByRole('dialog', { name: 'Cadastro' }).getByText(/Este compromisso nasce da demanda \w+ \(Notificar o devedor\) e fica ligado a ela\./)).toBeVisible();
    // Quando
    await salvarAtendimento(page, 'Atender o devedor', 'MARIA APARECIDA EXEMPLO');
    // Então: volta ao cartão da demanda, com o compromisso na seção e o número
    await expect(page).toHaveURL(new RegExp(`/demandas/\\?id=${id}$`));
    cartao = page.getByRole('dialog');
    await expect(tituloDaSecao(cartao, 'Compromissos')).toHaveText(/1$/);
    const link = (await secao(cartao, 'Compromissos')).getByRole('link', { name: /Atender o devedor/ });
    await expect(link).toContainText('Atendimento');
    // Quando: abre o compromisso
    await link.click();
    // Então: o cartão dele mostra a demanda em "Ligado a"
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Atender o devedor', level: 2 })).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Ligado a')).toHaveText(/1$/);
    await expect((await secao(cartao, 'Ligado a')).getByRole('link', { name: /Notificar o devedor/ })).toHaveAttribute('href', `/demandas/?id=${id}`);
  });

  test('dado o cartão de um contrato, quando cria ali um compromisso, então ele nasce ligado ao contrato', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'contratos', 'servico', 'Registro de marca');
    let cartao = await abrirCartao(page, 'contratos', id, 'Compromissos');
    await expect(cartao.getByRole('link', { name: 'Novo compromisso deste contrato' })).toBeVisible();
    // Quando
    await (await secao(cartao, 'Compromissos')).getByRole('link', { name: 'Novo compromisso deste contrato' }).click();
    await expect(page.getByRole('dialog', { name: 'Cadastro' }).getByText(/Este compromisso nasce do contrato/)).toBeVisible();
    await salvarAtendimento(page, 'Explicar o registro');
    // Então
    await expect(page).toHaveURL(new RegExp(`/contratos/\\?id=${id}$`));
    cartao = page.getByRole('dialog');
    await expect(tituloDaSecao(cartao, 'Compromissos')).toHaveText(/1$/);
    await expect((await secao(cartao, 'Compromissos')).getByRole('link', { name: /Explicar o registro/ })).toBeVisible();
  });
});

test.describe('Ligar o compromisso a itens que já existem (#306)', () => {
  test('dado o cartão de um compromisso, quando liga uma tarefa e depois a desliga, então ela aparece e sai do cartão da tarefa', async ({ page }) => {
    // Dado
    const reuniao = await idDe(page, 'compromissos', 'titulo', 'Reunião de equipe');
    const tarefa = await idDe(page, 'tarefas', 'titulo', 'Renovar a procuração');
    let cartao = await abrirCartao(page, 'compromissos', reuniao, 'Ligado a');
    const ligado = await secao(cartao, 'Ligado a');
    await expect(ligado.getByText('Este compromisso não está ligado a nenhuma tarefa, demanda ou contrato.')).toBeVisible();
    // Quando: a corrente do título (#427) abre o menu dos tipos que se ligam ao compromisso
    await cartao.getByRole('button', { name: 'Ligar a um item existente' }).click();
    await page.getByRole('menu', { name: 'Ligar a um item existente' }).getByRole('menuitem', { name: 'Ligar tarefa existente' }).click();
    await ligado.getByRole('textbox', { name: 'Buscar tarefa para ligar' }).fill('renovar');
    await ligado.getByRole('list', { name: 'Tarefas para ligar' }).getByRole('button', { name: /Renovar a procuração/ }).click();
    // Então
    await expect(page.getByText('Ligado a tarefa: Renovar a procuração.')).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Ligado a')).toHaveText(/1$/);
    await expect(ligado.getByRole('link', { name: /Renovar a procuração/ })).toBeVisible();
    // Então: o cartão da tarefa mostra o compromisso, com o número
    cartao = await abrirCartao(page, 'tarefas', tarefa, 'Compromissos');
    await expect(tituloDaSecao(cartao, 'Compromissos')).toHaveText(/1$/);
    await expect((await secao(cartao, 'Compromissos')).getByRole('link', { name: /Reunião de equipe/ })).toBeVisible();
    // Quando: no compromisso, desliga a tarefa
    cartao = await abrirCartao(page, 'compromissos', reuniao, 'Ligado a');
    await (await secao(cartao, 'Ligado a')).getByRole('button', { name: 'Desligar Renovar a procuração' }).click();
    // Então
    await expect(page.getByText('Desligado de tarefa: Renovar a procuração.')).toBeVisible();
    cartao = await abrirCartao(page, 'tarefas', tarefa, 'Compromissos');
    await expect(tituloDaSecao(cartao, 'Compromissos')).toHaveText(/^Compromissos0$/);
  });

  test('dado o cartão de uma demanda, quando liga um compromisso existente, então ele aparece na seção Compromissos', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Notificar o devedor');
    const cartao = await abrirCartao(page, 'demandas', id, 'Compromissos');
    const compromissos = await secao(cartao, 'Compromissos');
    // Quando
    await compromissos.getByRole('button', { name: 'Ligar compromisso existente' }).click();
    await compromissos.getByRole('textbox', { name: 'Buscar compromisso para ligar' }).fill('equipe');
    await compromissos.getByRole('list', { name: 'Compromissos para ligar' }).getByRole('button', { name: /Reunião de equipe/ }).click();
    // Então
    await expect(page.getByText('Compromisso ligado: Reunião de equipe.')).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Compromissos')).toHaveText(/1$/);
    await expect(compromissos.getByRole('link', { name: /Reunião de equipe/ })).toBeVisible();
  });
});

test.describe('O tipo Atendimento no calendário (#306)', () => {
  test('dado um atendimento e uma reunião no mesmo dia, quando a pessoa vê a agenda, então o atendimento tem a cor dele, diferente da reunião', async ({ page }) => {
    // Dado
    await page.goto('/agenda/novo/');
    await page.getByRole('group', { name: 'Tipo' }).getByText('Atendimento', { exact: true }).click();
    await page.getByLabel('Título').fill('Atender a cliente nova');
    await page.getByLabel('Data').fill(HOJE);
    await page.getByLabel('Hora').fill('16:00');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar compromisso' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
    // Quando
    const agenda = page.getByRole('region', { name: 'Agenda por data' });
    const atendimento = agenda.getByRole('link', { name: /Atender a cliente nova/ }), reuniao = agenda.getByRole('link', { name: /Reunião de equipe/ });
    await expect(atendimento).toBeVisible();
    // Então: a faixa da esquerda tem outra cor, e o tipo fica na dica
    const faixa = (l: Locator) => l.evaluate(el => getComputedStyle(el).borderLeftColor);
    expect(await faixa(atendimento)).not.toBe(await faixa(reuniao));
    await expect(atendimento).toHaveAttribute('title', 'Atendimento');
    // Quando: filtra pelo tipo
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByLabel('Tipo').selectOption({ label: 'Atendimento' });
    // Então: fica só o atendimento
    await expect(atendimento).toBeVisible();
    await expect(reuniao).toHaveCount(0);
  });
});
