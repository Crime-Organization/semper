// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Criar, pela seção "Ligada a" da anotação, um item novo já ligado a ela (#376): o "+ Novo…", ao lado de "Ligar a outro item", abre
// um menu com um item por módulo ligado no escritório (as pessoas sempre; o processo nunca). Cada um abre o cadastro com a anotação
// de origem; ao salvar, o item nasce ligado a ela e a tela volta à anotação, com o item em "Ligada a" e o número maior. Se a anotação
// tem uma pessoa só, ela já vem como cliente (demanda, contrato) ou pessoa (tarefa, compromisso). Na anotação nova, o botão espera
// ela ir ao banco; quem só lê a anotação não o vê.
// Na semente do banco fictício não há anotações. JOSÉ DA SILVA TESTE é uma pessoa do cadastro; a demanda "Registro de marca" tem o
// Bruno (estagiário, não administrador) de colaborador. Quem está logado é o Mateus (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

const CHAVE = 'semper-dados-falsos';
const TITULO = 'Reunião com o cliente';

/** A anotação aberta na janela do cartão. */
const anotacaoAberta = (page: Page) => page.getByRole('dialog', { name: 'Anotação', exact: true });
/** A janela do cadastro, aberta por cima da página do módulo. */
const cadastro = (page: Page) => page.getByRole('dialog', { name: 'Cadastro' });
/** O botão "+ Novo…" de "Ligada a". */
const botaoNovo = (anotacao: Locator) => anotacao.getByRole('button', { name: 'Novo…' });
/** O menu do "+ Novo…". */
const menuDoNovo = (page: Page) => page.getByRole('menu', { name: 'Novo item ligado a esta anotação' });

/**
 * Escreve uma anotação nova e espera ela ir ao banco (#369); com `pessoa`, liga a ela essa pessoa do cadastro, pela busca de
 * "Ligar a outro item". Devolve o id da anotação, lido do endereço.
 */
async function criarAnotacao(page: Page, { pessoa = '', endereco = '/documentos/nova/' } = {}) {
  await page.goto(endereco);
  const nova = page.getByRole('article', { name: 'Anotação nova' });
  const campo = nova.getByRole('textbox', { name: 'Título' });
  await campo.fill(TITULO);
  await campo.press('Enter');
  const anotacao = anotacaoAberta(page);
  await expect(anotacao.getByRole('article', { name: /^Anotação (?!nova$)\w+$/ })).toBeVisible();
  await abrirSecao(anotacao, 'Ligada a');
  if (pessoa) {
    await anotacao.getByRole('button', { name: /^Ligar a (outro|um) item$/ }).click();
    await anotacao.getByRole('textbox', { name: 'Buscar item para ligar' }).fill(pessoa.toLowerCase());
    await anotacao.getByRole('button', { name: new RegExp(pessoa) }).click();
    await expect(anotacao.getByRole('list', { name: 'Itens ligados' }).getByRole('link', { name: new RegExp(pessoa) })).toBeVisible();
  }
  await expect(page).toHaveURL(/\/documentos\/\?id=/);
  return { anotacao, id: new URL(page.url()).searchParams.get('id')! };
}
/** Escolhe um módulo no "+ Novo…" da anotação aberta e espera o cadastro dele. */
async function novoPeloMenu(page: Page, anotacao: Locator, modulo: string) {
  await botaoNovo(anotacao).click();
  await menuDoNovo(page).getByRole('menuitem', { name: modulo }).click();
  await expect(cadastro(page)).toBeVisible();
  return cadastro(page);
}
/** De volta à anotação de origem: o endereço, a janela dela e "Ligada a" com o número de itens. */
async function deVoltaAAnotacao(page: Page, id: string, itens: number) {
  await expect(cadastro(page)).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/documentos/\\?id=${id}$`));
  const anotacao = anotacaoAberta(page);
  await expect(anotacao.getByRole('heading', { name: TITULO, level: 2 })).toBeVisible();
  await expect(anotacao.getByRole('button', { name: /^Ligada a/ })).toHaveText(new RegExp(`^Ligada a\\s*${itens}$`));
  await abrirSecao(anotacao, 'Ligada a');
  return anotacao.getByRole('list', { name: 'Itens ligados' });
}
/** Os módulos do escritório da semente, todos ligados (a semente não os guarda: o banco fictício os liga todos). */
const MODULOS = { pessoas: true, contratos: true, demandas: true, tarefas: true, processos: true, compromissos: true, anotacoes: true, financeiro: true };
/** Desliga um módulo do escritório no banco fictício da aba, com os outros ligados. */
async function desligarModulo(page: Page, modulo: string) {
  await page.evaluate(([chave, m, todos]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as { escritorio: { modulos?: Record<string, boolean> } };
    bd.escritorio = { ...bd.escritorio, modulos: { ...todos, ...bd.escritorio.modulos, [m]: false } };
    sessionStorage.setItem(chave, JSON.stringify(bd));
  }, [CHAVE, modulo, MODULOS] as const);
}

test.describe('Criar um item já ligado pela seção "Ligada a" da anotação (#376)', () => {
  test('dada a anotação com uma pessoa só, quando escolhe Demanda no "+ Novo…" e salva, então a demanda nasce com ela como cliente, ligada, e a tela volta à anotação', async ({ page }) => {
    // Dado
    const { anotacao, id } = await criarAnotacao(page, { pessoa: 'JOSÉ DA SILVA TESTE' });
    // Quando
    const janela = await novoPeloMenu(page, anotacao, 'Demanda');
    // Então: o cadastro diz de onde a demanda nasce
    await expect(janela.getByText(/Esta demanda nasce da anotação .* e fica ligada a ela\./)).toBeVisible();
    // Quando
    await janela.getByLabel('Título').fill('Notificar o vizinho');
    await janela.getByRole('button', { name: 'Próxima' }).click();
    await janela.getByRole('button', { name: 'Próxima' }).click();
    await janela.getByRole('button', { name: 'Salvar demanda' }).click();
    // Então
    const ligados = await deVoltaAAnotacao(page, id, 2);
    await ligados.getByRole('link', { name: /Notificar o vizinho/ }).click();
    const demanda = page.getByRole('dialog');
    await expect(demanda.getByRole('heading', { name: 'Notificar o vizinho', level: 2 })).toBeVisible();
    await abrirSecao(demanda, 'Clientes');
    await expect(demanda.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
  });

  test('quando escolhe Tarefa no "+ Novo…" e salva, então a tarefa fica ligada à anotação, com a pessoa dela, e a tela volta à anotação', async ({ page }) => {
    // Dado
    const { anotacao, id } = await criarAnotacao(page, { pessoa: 'JOSÉ DA SILVA TESTE' });
    // Quando
    const janela = await novoPeloMenu(page, anotacao, 'Tarefa');
    await expect(janela.getByText(/Esta tarefa nasce da anotação .* e fica ligada a ela\./)).toBeVisible();
    await janela.getByLabel('Título').fill('Ligar para o cliente');
    await janela.getByRole('button', { name: 'Próxima' }).click();
    // Então: a pessoa da anotação é a pessoa da tarefa
    await expect(janela.getByRole('group', { name: 'Pessoas ligadas' })).toContainText('JOSÉ DA SILVA TESTE');
    // Quando
    await janela.getByRole('button', { name: 'Salvar tarefa' }).click();
    // Então
    const ligados = await deVoltaAAnotacao(page, id, 2);
    await expect(ligados.getByRole('link', { name: /Ligar para o cliente/ })).toBeVisible();
  });

  test('quando escolhe Compromisso no "+ Novo…" e salva, então o compromisso fica ligado à anotação, e a tela volta a ela', async ({ page }) => {
    // Dado
    const { anotacao, id } = await criarAnotacao(page);
    // Quando
    const janela = await novoPeloMenu(page, anotacao, 'Compromisso');
    await expect(janela.getByText(/Este compromisso nasce da anotação .* e fica ligado a ela\./)).toBeVisible();
    await janela.getByLabel('Título').fill('Reunião de retorno');
    await janela.getByLabel('Data').fill(new Date().toISOString().slice(0, 10));
    await janela.getByLabel('Hora').fill('10:30');
    while (!(await janela.getByRole('button', { name: 'Salvar compromisso' }).isVisible())) await janela.getByRole('button', { name: 'Próxima' }).click();
    await janela.getByRole('button', { name: 'Salvar compromisso' }).click();
    // Então
    const ligados = await deVoltaAAnotacao(page, id, 1);
    await expect(ligados.getByRole('link', { name: /Reunião de retorno/ })).toBeVisible();
  });

  test('quando escolhe Pessoa no "+ Novo…" e cadastra, então a pessoa fica ligada à anotação, e a tela volta a ela', async ({ page }) => {
    // Dado
    const { anotacao, id } = await criarAnotacao(page);
    // Quando
    const janela = await novoPeloMenu(page, anotacao, 'Pessoa');
    await expect(janela.getByText(/Ao terminar, a pessoa fica ligada à anotação/)).toBeVisible();
    await janela.getByText('Somente informações de contato', { exact: true }).click();
    await janela.getByLabel('Nome').fill('vizinha da cliente');
    await janela.getByRole('button', { name: 'Próxima' }).click();
    await janela.getByRole('textbox', { name: 'Telefone' }).fill('38999990000');
    await janela.getByRole('button', { name: 'Salvar cadastro' }).click();
    // Então
    await expect(page.getByText(/Pessoa cadastrada e ligada à anotação/)).toBeVisible();
    const ligados = await deVoltaAAnotacao(page, id, 1);
    await expect(ligados.getByRole('link', { name: /VIZINHA DA CLIENTE/ })).toBeVisible();
  });

  test('dada a anotação com uma pessoa só, quando escolhe Contrato no "+ Novo…" e salva, então o contrato nasce com ela como cliente, ligado à anotação', async ({ page }) => {
    // Dado
    const { anotacao, id } = await criarAnotacao(page, { pessoa: 'JOSÉ DA SILVA TESTE' });
    // Quando
    const janela = await novoPeloMenu(page, anotacao, 'Contrato');
    await expect(janela.getByText(/Este contrato nasce da anotação .* e fica ligado a ela\./)).toBeVisible();
    await janela.getByRole('button', { name: 'Próxima' }).click();
    await janela.getByRole('combobox', { name: 'Objeto 1' }).fill('Consultoria');
    await janela.getByText('Pró-labore', { exact: true }).click();
    while (!(await janela.getByRole('button', { name: 'Salvar contrato' }).isVisible())) await janela.getByRole('button', { name: 'Próxima' }).click();
    await janela.getByRole('button', { name: 'Salvar contrato' }).click();
    // Então
    const ligados = await deVoltaAAnotacao(page, id, 2);
    await expect(ligados.getByRole('link', { name: /Contrato/ })).toHaveCount(1);
    await ligados.getByRole('link', { name: /Contrato/ }).click();
    await expect(page.getByRole('dialog').getByText('JOSÉ DA SILVA TESTE').first()).toBeVisible();
  });
});

test.describe('Quem vê o "+ Novo…" da anotação, e o que ele oferece (#376)', () => {
  test('dado o escritório sem o módulo Demandas, quando abre o "+ Novo…", então Demanda não aparece, nem Processo, e Pessoa sim', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await desligarModulo(page, 'demandas');
    const { anotacao } = await criarAnotacao(page);
    // Quando
    await botaoNovo(anotacao).click();
    // Então
    await expect(menuDoNovo(page).getByRole('menuitem')).toHaveText(['Tarefa', 'Compromisso', 'Pessoa', 'Contrato']);
  });

  test('dada a anotação nova, quando ainda não foi ao banco, então o "+ Novo…" espera, e liga quando a pessoa escreve o título', async ({ page }) => {
    // Dado
    await page.goto('/documentos/nova/');
    const nova = page.getByRole('article', { name: 'Anotação nova' });
    const esperando = botaoNovo(nova);
    // Então
    await expect(esperando).toHaveAttribute('aria-disabled', 'true');
    await expect(esperando).toHaveAccessibleDescription(/escreva antes o título ou o texto/);
    // (o Playwright não clica no que está desligado: a pessoa do teclado aperta Enter nele)
    await esperando.press('Enter');
    await expect(menuDoNovo(page)).toHaveCount(0);
    // Quando
    const campo = nova.getByRole('textbox', { name: 'Título' });
    if (!await campo.count()) await nova.getByRole('button', { name: 'Sem título' }).click();
    await nova.getByRole('textbox', { name: 'Título' }).fill(TITULO);
    await nova.getByRole('textbox', { name: 'Título' }).press('Enter');
    // Então
    const anotacao = anotacaoAberta(page);
    await expect(botaoNovo(anotacao)).not.toHaveAttribute('aria-disabled');
    await botaoNovo(anotacao).click();
    await expect(menuDoNovo(page)).toBeVisible();
  });

  test('dada uma anotação que o Bruno só lê, quando ele abre "Ligada a", então não há "+ Novo…" nem "Ligar a outro item"', async ({ page }) => {
    // Dado: o Mateus escreve a anotação ligada à demanda em que o Bruno está
    await page.goto('/inicio/');
    const demanda = await page.evaluate(([chave]) =>
      (JSON.parse(sessionStorage.getItem(chave)!) as { demandas: { id: string; titulo: string }[] }).demandas.find(d => d.titulo === 'Registro de marca')!.id, [CHAVE]);
    await criarAnotacao(page, { endereco: '/documentos/nova/?demanda=' + demanda });
    // Quando
    await entrarComo(page, 'u-bruno');
    await page.goto('/documentos/');
    await page.getByRole('row').filter({ hasText: TITULO }).click();
    const anotacao = anotacaoAberta(page);
    await expect(anotacao.getByRole('heading', { name: TITULO, level: 2 })).toBeVisible();
    await abrirSecao(anotacao, 'Ligada a');
    // Então
    await expect(anotacao.getByRole('list', { name: 'Itens ligados' }).getByRole('link', { name: /Registro de marca/ })).toBeVisible();
    await expect(botaoNovo(anotacao)).toHaveCount(0);
    await expect(anotacao.getByRole('button', { name: /^Ligar a (outro|um) item$/ })).toHaveCount(0);
  });
});
