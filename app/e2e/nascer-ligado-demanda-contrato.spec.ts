// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Criar, no cartão de um item, a demanda ou o contrato já ligados a ele (#376): o "+ Nova demanda" da tarefa e do processo e o
// "+ Novo contrato" do processo e da demanda abrem o cadastro com a origem preenchida e, ao salvar, voltam ao cartão de origem, com o
// item novo na seção e o contador atualizado. A semente do banco fictício: "Renovar a procuração" é uma tarefa avulsa (sem demanda,
// contrato, processo nem pessoas); JOSÉ DA SILVA TESTE é cliente do processo judicial 0001234-97.2026.8.13.0024; "Notificar o
// devedor" é uma demanda avulsa de MARIA APARECIDA EXEMPLO, sem contrato; "Registro de marca" é uma demanda de contrato. Quem está
// logado é o Mateus (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

const CHAVE = 'semper-dados-falsos';
type Colecao = 'processos' | 'demandas' | 'tarefas';
/** O id de um item da semente, lido do banco fictício da aba pelo valor de um campo (o título, o número...). */
async function idDe(page: Page, colecao: Colecao, campo: string, valor: string) {
  await page.goto('/inicio/');
  return page.evaluate(([chave, c, k, v]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as Record<string, Record<string, unknown>[]>;
    return bd[c].find(x => String(x[k]).startsWith(v))!.id as string;
  }, [CHAVE, colecao, campo, valor]);
}
/** Arquiva o item no banco fictício da aba (a página relê o banco ao abrir o cartão). */
async function arquivar(page: Page, colecao: Colecao, id: string) {
  await page.evaluate(([chave, c, item]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as Record<string, { id: string; arquivado_em: string | null }[]>;
    bd[c].find(x => x.id === item)!.arquivado_em = new Date().toISOString();
    sessionStorage.setItem(chave, JSON.stringify(bd));
  }, [CHAVE, colecao, id]);
}
/** Desliga um módulo do escritório no banco fictício da aba. */
async function desligarModulo(page: Page, modulo: string) {
  await page.evaluate(([chave, m]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as { escritorio: { modulos?: Record<string, boolean> } };
    bd.escritorio = { ...bd.escritorio, modulos: { ...bd.escritorio.modulos, [m]: false } };
    sessionStorage.setItem(chave, JSON.stringify(bd));
  }, [CHAVE, modulo]);
}
/** Os atalhos de criar já ligado de uma seção: o "+" do título e o "+ Novo …" de baixo. */
const atalhosDeCriar = (cartao: Locator, doTitulo: string, deBaixo: string) =>
  cartao.getByRole('link', { name: new RegExp(`^(${doTitulo}|${deBaixo})$`) });

/** Onde cada cartão abre. */
const ENDERECO: Record<Colecao, string> = { processos: '/processos/judicial/?id=', demandas: '/demandas/?id=', tarefas: '/tarefas/?id=' };
/** Abre o cartão do item e espera o título dele. */
async function abrirCartao(page: Page, colecao: Colecao, id: string, titulo: string | RegExp) {
  await page.goto(ENDERECO[colecao] + id);
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return cartao;
}
/** O botão que abre e recolhe a seção, com o contador ao lado do título. */
const tituloDaSecao = (cartao: Locator, titulo: string) => cartao.getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) });
/** A seção do cartão pelo título (aberta). */
async function secao(cartao: Locator, titulo: string) {
  await abrirSecao(cartao, titulo);
  // O "has" procura dentro da seção: o botão vem da página, e não do cartão (que não está dentro dela).
  return cartao.locator('section', { has: cartao.page().getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) }) });
}
/** O número ao lado do título da seção (0 quando não há). */
const contador = async (cartao: Locator, titulo: string) => Number((await tituloDaSecao(cartao, titulo).innerText()).replace(/\D/g, '') || 0);

/** No cadastro de demanda aberto: dá o título, passa pelas etapas e salva. */
async function salvarDemanda(page: Page, titulo: string) {
  const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
  await cadastro.getByLabel('Título').fill(titulo);
  await cadastro.getByRole('button', { name: 'Próxima' }).click();
  await cadastro.getByRole('button', { name: 'Próxima' }).click();
  await cadastro.getByRole('button', { name: 'Salvar demanda' }).click();
  await expect(page.getByText(/Demanda \w+ cadastrada\./)).toBeVisible();
}
/** No cadastro de contrato aberto: o objeto e a categoria (o que a origem não traz), as etapas e o salvar. */
async function salvarContrato(page: Page, objeto: string) {
  const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
  await cadastro.getByRole('button', { name: 'Próxima' }).click();
  await cadastro.getByRole('combobox', { name: 'Objeto 1' }).fill(objeto);
  await cadastro.getByText('Pró-labore', { exact: true }).click();
  while (!(await cadastro.getByRole('button', { name: 'Salvar contrato' }).isVisible())) await cadastro.getByRole('button', { name: 'Próxima' }).click();
  await cadastro.getByRole('button', { name: 'Salvar contrato' }).click();
  await expect(page.getByText(/Contrato [\w-]+ cadastrado\./)).toBeVisible();
}

test.describe('Criar no cartão a demanda ou o contrato já ligados (#376)', () => {
  test('dado o cartão de uma tarefa sem demanda, quando clica em "+ Nova demanda" e cria, então volta ao cartão da tarefa, com a demanda na seção', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'tarefas', 'titulo', 'Renovar a procuração');
    let cartao = await abrirCartao(page, 'tarefas', id, 'Renovar a procuração');
    const demanda = await secao(cartao, 'Demanda');
    await expect(cartao.getByRole('link', { name: 'Nova demanda desta tarefa' })).toBeVisible();
    // Quando
    await demanda.getByRole('link', { name: 'Nova demanda', exact: true }).click();
    // Então: o cadastro diz de onde a demanda nasce
    await expect(page.getByRole('dialog', { name: 'Cadastro' }).getByText(/Esta demanda nasce da tarefa \w+ \(Renovar a procuração\)/)).toBeVisible();
    // Quando
    await salvarDemanda(page, 'Regularizar a representação');
    // Então
    await expect(page).toHaveURL(new RegExp(`/tarefas/\\?id=${id}$`));
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Renovar a procuração', level: 2 })).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Demanda')).toHaveText(/1$/);
    await expect(cartao.getByRole('link', { name: /Regularizar a representação/ })).toBeVisible();
    // Então: com a demanda dela, a tarefa não cria nem liga outra
    await expect(cartao.getByRole('link', { name: 'Nova demanda desta tarefa' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Ligar demanda existente' })).toHaveCount(0);
  });

  test('dado o cartão de um processo, quando clica em "+ Nova demanda" e cria, então a demanda nasce com os clientes dele e volta ao processo, com ela na seção', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    let cartao = await abrirCartao(page, 'processos', id, /JOSÉ DA SILVA TESTE|0001234/);
    const demandas = await secao(cartao, 'Demandas');
    const antes = await contador(cartao, 'Demandas');
    await expect(cartao.getByRole('link', { name: 'Nova demanda deste processo' })).toBeVisible();
    // Quando
    await demandas.getByRole('link', { name: 'Nova demanda', exact: true }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await cadastro.getByLabel('Título').fill('Executar a sentença');
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    // Então: o cliente do processo já vem escolhido
    await expect(cadastro.getByRole('group', { name: 'Clientes' })).toContainText('JOSÉ DA SILVA TESTE');
    // Quando
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    // Então: e o processo, nos processos da demanda
    await expect(cadastro.getByRole('group', { name: 'Processos' })).toContainText('0001234-97.2026.8.13.0024');
    // Quando
    await cadastro.getByRole('button', { name: 'Salvar demanda' }).click();
    // Então
    await expect(page).toHaveURL(new RegExp(`/processos/judicial/\\?id=${id}$`));
    cartao = page.getByRole('dialog');
    await expect(tituloDaSecao(cartao, 'Demandas')).toHaveText(new RegExp(`${antes + 1}$`));
    await expect(cartao.getByRole('link', { name: /Executar a sentença/ })).toBeVisible();
  });

  test('dado o cartão de um processo, quando clica em "+ Novo contrato" e cria, então o contrato nasce com o processo escolhido e volta ao processo, com ele na seção', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    let cartao = await abrirCartao(page, 'processos', id, /JOSÉ DA SILVA TESTE|0001234/);
    const contratos = await secao(cartao, 'Contratos');
    const antes = await contador(cartao, 'Contratos');
    await expect(cartao.getByRole('link', { name: 'Novo contrato deste processo' })).toBeVisible();
    // Quando
    await contratos.getByRole('link', { name: 'Novo contrato', exact: true }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    // Então: o cliente do processo já vem escolhido
    await expect(cadastro.getByRole('group', { name: 'Clientes' })).toContainText('JOSÉ DA SILVA TESTE');
    // Quando
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    // Então: o campo de processos aparece ao criar, com o processo de origem
    await expect(cadastro.getByRole('group', { name: 'Processos do contrato' })).toContainText('0001234-97.2026.8.13.0024');
    // Quando
    await cadastro.getByRole('button', { name: 'Voltar' }).click();
    await salvarContrato(page, 'Execução de sentença');
    // Então
    await expect(page).toHaveURL(new RegExp(`/processos/judicial/\\?id=${id}$`));
    cartao = page.getByRole('dialog');
    await expect(tituloDaSecao(cartao, 'Contratos')).toHaveText(new RegExp(`${antes + 1}$`));
    await expect(cartao.getByRole('link', { name: /Execução de sentença/ })).toBeVisible();
  });

  test('dado o cartão de uma demanda sem contrato, quando clica em "+ Novo contrato" e cria, então volta à demanda, ligada ao contrato novo', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Notificar o devedor');
    let cartao = await abrirCartao(page, 'demandas', id, 'Notificar o devedor');
    const contrato = await secao(cartao, 'Contrato');
    await expect(cartao.getByRole('link', { name: 'Novo contrato desta demanda' })).toBeVisible();
    // Quando
    await contrato.getByRole('link', { name: 'Novo contrato', exact: true }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    // Então: a origem e o cliente da demanda já vêm escolhidos
    await expect(cadastro.getByText(/Este contrato nasce da demanda \w+ \(Notificar o devedor\)/)).toBeVisible();
    await expect(cadastro.getByRole('group', { name: 'Clientes' })).toContainText('MARIA APARECIDA EXEMPLO');
    // Quando
    await salvarContrato(page, 'Notificação extrajudicial');
    // Então
    await expect(page).toHaveURL(new RegExp(`/demandas/\\?id=${id}$`));
    cartao = page.getByRole('dialog');
    await expect(tituloDaSecao(cartao, 'Contrato')).toHaveText(/1$/);
    await expect(cartao.getByRole('link', { name: /Notificação extrajudicial/ })).toBeVisible();
    // Então: com o contrato dela, a demanda não cria nem liga outro
    await expect(cartao.getByRole('link', { name: 'Novo contrato desta demanda' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Ligar contrato existente' })).toHaveCount(0);
  });

  test('dada uma demanda que já tem contrato, quando abre a seção Contrato, então não há "+ Novo contrato"', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Registro de marca');
    const cartao = await abrirCartao(page, 'demandas', id, 'Registro de marca');
    // Quando
    const contrato = await secao(cartao, 'Contrato');
    // Então
    await expect(contrato.getByRole('link', { name: /^Novo contrato/ })).toHaveCount(0);
  });
});

test.describe('Os atalhos de criar já ligado seguem as condições do "Ligar existente" (#376)', () => {
  test('dada a conta comum que não está na tarefa, quando abre a seção Demanda, então não há como criar a demanda por ela', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'tarefas', 'titulo', 'Renovar a procuração');
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirCartao(page, 'tarefas', id, 'Renovar a procuração');
    await abrirSecao(cartao, 'Demanda');
    // Então
    await expect(cartao.getByText('Você não participa deste cartão.', { exact: false })).toBeVisible();
    await expect(atalhosDeCriar(cartao, 'Nova demanda desta tarefa', 'Nova demanda')).toHaveCount(0);
  });

  test('dado um processo arquivado, quando abre as seções Demandas e Contratos, então não há como criar a demanda nem o contrato por ele', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    await arquivar(page, 'processos', id);
    // Quando
    const cartao = await abrirCartao(page, 'processos', id, /JOSÉ DA SILVA TESTE|0001234/);
    for (const titulo of ['Demandas', 'Contratos']) await abrirSecao(cartao, titulo);
    // Então
    await expect(atalhosDeCriar(cartao, 'Nova demanda deste processo', 'Nova demanda')).toHaveCount(0);
    await expect(atalhosDeCriar(cartao, 'Novo contrato deste processo', 'Novo contrato')).toHaveCount(0);
  });

  test('dada uma demanda arquivada e sem contrato, quando abre a seção Contrato, então não há como criar o contrato por ela', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Notificar o devedor');
    await arquivar(page, 'demandas', id);
    // Quando
    const cartao = await abrirCartao(page, 'demandas', id, 'Notificar o devedor');
    await abrirSecao(cartao, 'Contrato');
    // Então
    await expect(atalhosDeCriar(cartao, 'Novo contrato desta demanda', 'Novo contrato')).toHaveCount(0);
  });

  test('dado o escritório sem o módulo Contratos, quando abre a seção Contrato de uma demanda sem contrato, então não há como criar o contrato', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Notificar o devedor');
    await desligarModulo(page, 'contratos');
    // Quando
    const cartao = await abrirCartao(page, 'demandas', id, 'Notificar o devedor');
    await abrirSecao(cartao, 'Contrato');
    // Então
    await expect(atalhosDeCriar(cartao, 'Novo contrato desta demanda', 'Novo contrato')).toHaveCount(0);
  });
});
