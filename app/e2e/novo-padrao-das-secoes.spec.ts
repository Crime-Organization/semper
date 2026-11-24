// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Criar, do cartão, um item já ligado (#376), nas seções que já criavam mas fora do padrão: Contratos e Processos da pessoa e
// Processos da demanda. Cada uma tem o "+" no título e o "+ Novo …" embaixo; depois de gravar, a tela volta ao cartão de origem,
// com o item na seção e o contador atualizado. No cartão arquivado, nenhum "+" aparece.
// A semente do banco fictício: LUCIANA ROCHA AMOSTRA não tem contratos nem processos; JOSÉ DA SILVA TESTE é cliente do contrato
// "Registro de marca" (com as demandas "Registro de marca" e "Busca de anterioridade"). Quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, acaoNoMenuDoCartao, entrarComo, escolherPapeisDosClientes } from './ajudantes';

const NUMERO_NOVO = '0005678-13.2026.8.13.0433';
/** O número do processo em qualquer formato (com ou sem os pontos e o traço). */
const NUMERO_NA_TELA = new RegExp(NUMERO_NOVO.replace(/[.-]/g, '.'));

/** Abre o cartão de uma pessoa pela tabela de Pessoas. */
async function abrirPessoa(page: Page, busca: string, nome: string) {
  await page.goto('/pessoas/');
  await page.getByRole('searchbox').fill(busca);
  await page.getByRole('row').filter({ hasText: nome }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: nome, level: 2 })).toBeVisible();
  return cartao;
}
/** Abre o cartão de uma demanda pela tabela de Demandas. */
async function abrirDemanda(page: Page, titulo: string) {
  await page.goto('/demandas/');
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByLabel('Situação da demanda')).toBeVisible();
  return cartao;
}
/** O botão do título da seção, com o número ao lado (ex.: "Contratos 1"). */
const tituloDaSecao = (cartao: Locator, titulo: string) => cartao.getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) });

/** Do cadastro de contrato já aberto, com o cliente escolhido, preenche o que falta e salva. */
async function salvarContrato(page: Page) {
  const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
  await cadastro.getByRole('button', { name: 'Próxima' }).click();
  await cadastro.getByRole('combobox', { name: 'Objeto 1' }).fill('Registro de marca no INPI');
  await cadastro.getByText('Pró-labore', { exact: true }).click();
  while (!(await cadastro.getByRole('button', { name: 'Salvar contrato' }).isVisible())) await cadastro.getByRole('button', { name: 'Próxima' }).click();
  await cadastro.getByRole('button', { name: 'Salvar contrato' }).click();
  await expect(cadastro).toHaveCount(0);
}
/** Do cadastro de processo já aberto, põe o número e salva. */
async function salvarProcesso(page: Page) {
  const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
  await cadastro.getByLabel('Número do processo').fill(NUMERO_NOVO);
  await cadastro.getByRole('button', { name: 'Próxima' }).click();
  await escolherPapeisDosClientes(cadastro);
  await cadastro.getByRole('button', { name: 'Próxima' }).click();
  await cadastro.getByRole('button', { name: 'Salvar processo' }).click();
  await expect(cadastro).toHaveCount(0);
}

test.describe('Contratos da pessoa', () => {
  test('dado o cartão da pessoa, quando clica em "+ Novo contrato" e salva, então volta ao cartão dela, com o contrato na seção e o número atualizado', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page, 'luciana', 'LUCIANA ROCHA AMOSTRA');
    await abrirSecao(cartao, 'Contratos');
    await expect(cartao.getByText('Nenhum contrato ligado a esta pessoa.')).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Contratos')).toHaveText('Contratos0');
    // Quando
    await cartao.getByRole('link', { name: 'Novo contrato', exact: true }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await expect(cadastro.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ })).toHaveText('Trocar');
    await salvarContrato(page);
    // Então
    await expect(page).toHaveURL(/\/pessoas\/\?id=/);
    const deVolta = page.getByRole('dialog');
    await expect(deVolta.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
    await expect(deVolta.getByRole('link', { name: /Registro de marca no INPI/ })).toContainText('Cliente');
    await expect(tituloDaSecao(deVolta, 'Contratos')).toHaveText('Contratos1');
  });

  test('dado o cartão da pessoa, quando clica no "+" do título de Contratos, então abre o cadastro com ela como cliente', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page, 'luciana', 'LUCIANA ROCHA AMOSTRA');
    // Quando: o "+" fica no título, mesmo com a seção fechada
    await cartao.getByRole('link', { name: 'Novo contrato com esta pessoa como cliente' }).click();
    // Então
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await expect(cadastro.getByRole('heading', { name: 'Cliente e responsável', level: 2 })).toBeVisible();
    await expect(cadastro.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ })).toHaveText('Trocar');
  });
});

test.describe('Processos da pessoa', () => {
  test('dado o cartão da pessoa, quando clica em "+ Novo processo" e salva, então volta ao cartão dela, com o processo na seção e o número atualizado', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page, 'luciana', 'LUCIANA ROCHA AMOSTRA');
    await abrirSecao(cartao, 'Processos');
    await expect(cartao.getByText('Nenhum processo ligado a esta pessoa.')).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Processos')).toHaveText('Processos0');
    // Quando
    await cartao.getByRole('link', { name: 'Novo processo', exact: true }).click();
    await salvarProcesso(page);
    // Então
    await expect(page).toHaveURL(/\/pessoas\/\?id=/);
    const deVolta = page.getByRole('dialog');
    await expect(deVolta.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
    await expect(deVolta.getByRole('link', { name: NUMERO_NA_TELA })).toContainText('Cliente');
    await expect(tituloDaSecao(deVolta, 'Processos')).toHaveText('Processos1');
  });

  test('dado o cartão da pessoa, quando clica no "+" do título de Processos, então abre o cadastro com ela como cliente', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page, 'luciana', 'LUCIANA ROCHA AMOSTRA');
    // Quando
    await cartao.getByRole('link', { name: 'Novo processo com esta pessoa como cliente' }).click();
    // Então
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    await cadastro.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await cadastro.getByRole('button', { name: 'Próxima' }).click();
    await expect(cadastro.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ })).toHaveText('Trocar');
  });
});

test.describe('Processos da demanda', () => {
  test('dado o cartão da demanda, quando clica em "+ Novo processo" e salva, então volta ao cartão dela, com o processo na seção e o número atualizado', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Registro de marca');
    await abrirSecao(cartao, 'Processos');
    await expect(cartao.getByText('Nenhum processo ligado a esta demanda.')).toBeVisible();
    await expect(tituloDaSecao(cartao, 'Processos')).toHaveText('Processos0');
    // Quando
    await cartao.getByRole('link', { name: 'Novo processo', exact: true }).click();
    await expect(page.getByText('Este processo nasce da demanda', { exact: false })).toBeVisible();
    await salvarProcesso(page);
    // Então
    await expect(page).toHaveURL(/\/demandas\/\?id=/);
    const deVolta = page.getByRole('dialog');
    await expect(deVolta.getByLabel('Situação da demanda')).toBeVisible();
    await expect(deVolta.getByRole('list', { name: 'Processos ligados' }).getByRole('link', { name: NUMERO_NA_TELA })).toBeVisible();
    await expect(tituloDaSecao(deVolta, 'Processos')).toHaveText('Processos1');
  });

  test('dado o cartão da demanda, quando clica no "+" do título de Processos, então abre o cadastro do processo que nasce dela', async ({ page }) => {
    // Dado
    const cartao = await abrirDemanda(page, 'Registro de marca');
    // Quando
    await cartao.getByRole('link', { name: 'Novo processo desta demanda' }).click();
    // Então
    await expect(page).toHaveURL(/\/processos\/novo\/\?demanda=/);
    await expect(page.getByText('Este processo nasce da demanda', { exact: false })).toBeVisible();
  });
});

test.describe('Quem só lê não cria (#376)', () => {
  test('dada a pessoa arquivada, quando abre o cartão, então nenhuma seção mostra o "+" do título nem o "+ Novo …" de baixo', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page, 'josé da silva', 'JOSÉ DA SILVA TESTE');
    // Ativa, os "+" dos títulos estão lá
    for (const rotulo of ['Novo contrato com esta pessoa como cliente', 'Nova demanda com esta pessoa como cliente', 'Novo processo com esta pessoa como cliente',
      'Novo compromisso com esta pessoa', 'Nova tarefa ligada a esta pessoa']) await expect(cartao.getByRole('link', { name: rotulo })).toBeVisible();
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    await expect(cartao.getByRole('button', { name: 'Desarquivar' })).toBeVisible();
    // Quando
    for (const secao of ['Contratos', 'Demandas', 'Processos', 'Compromissos', 'Tarefas']) await abrirSecao(cartao, secao);
    // Então: as seções mostram o que está ligado, sem nenhum atalho de criar nem de ligar
    await expect(cartao.getByRole('link', { name: /Registro de marca/ }).first()).toBeVisible();
    await expect(cartao.getByRole('link', { name: /^Nov[oa] / })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: /existente/ })).toHaveCount(0);
  });

  test('dado o contrato arquivado, quando abre o cartão, então Demandas e Tarefas não mostram o "+" do título nem o de baixo', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    const cartao = page.getByRole('dialog');
    // Ativo, os "+" dos títulos estão lá
    await expect(cartao.getByRole('link', { name: 'Nova demanda deste contrato' })).toBeVisible();
    await expect(cartao.getByRole('link', { name: 'Nova tarefa deste contrato' })).toBeVisible();
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    await expect(cartao.getByRole('button', { name: 'Desarquivar' })).toBeVisible();
    // Quando
    await abrirSecao(cartao, 'Demandas');
    await abrirSecao(cartao, 'Tarefas');
    // Então
    await expect(cartao.getByRole('link', { name: /^Nov[oa] / })).toHaveCount(0);
  });
});

test.describe('A volta ao cartão de origem só vale quando o item ficou ligado a ele (#376)', () => {
  test('dado o "+ Novo contrato" da pessoa, quando troca o cliente que veio pronto e salva, então vai ao cartão do contrato, e não ao da pessoa', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page, 'luciana', 'LUCIANA ROCHA AMOSTRA');
    await abrirSecao(cartao, 'Contratos');
    await cartao.getByRole('link', { name: 'Novo contrato', exact: true }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro' });
    // Quando
    await cadastro.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await cadastro.getByRole('textbox', { name: 'Cliente', exact: true }).fill('paulo');
    await cadastro.getByRole('button', { name: /PAULO HENRIQUE SIMULADO/ }).click();
    await salvarContrato(page);
    // Então
    await expect(page).toHaveURL(/\/contratos\/\?id=/);
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'PAULO HENRIQUE SIMULADO' })).toBeVisible();
  });

  test('dado o processo aberto a partir da demanda, quando a ligação com ela falha depois de gravar, então avisa e vai ao cartão do processo', async ({ page }) => {
    // Dado: Bruno não está na demanda "Busca de anterioridade" e, com a chave "toda a equipe vê" ligada, só a lê: o processo
    // dele é gravado, mas a ligação com a demanda é recusada.
    await abrirDemanda(page, 'Busca de anterioridade');
    const demandaId = new URL(page.url()).searchParams.get('id')!;
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    await page.goto('/processos/novo/?demanda=' + demandaId + '&volta=cartao');
    await expect(page.getByText('Este processo nasce da demanda', { exact: false })).toBeVisible();
    // Quando: aberto pelo endereço, o cadastro ocupa a página
    await page.getByLabel('Número do processo').fill(NUMERO_NOVO);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await escolherPapeisDosClientes(page);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    await expect(page.getByText('Não foi possível ligar o processo à demanda', { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/processos\/judicial\/\?id=/);
    await expect(page.getByRole('dialog').getByLabel('Situação do processo')).toBeVisible();
  });
});
