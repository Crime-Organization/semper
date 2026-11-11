// Ligar demanda, tarefa, contrato e compromisso a um processo que já existe (#294). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício há dois processos ativos: o judicial de JOSÉ DA SILVA TESTE (sem nome, número 0001234-97.2026.8.13.0024)
// e o administrativo "Registro da marca Exemplo". A demanda "Busca de anterioridade" e a tarefa "Renovar a procuração" não têm
// processo; "Reunião de equipe" é um compromisso sem processo, e a audiência de JOSÉ DA SILVA TESTE é do processo judicial.
// O contrato MA96-0001-2026 é de JOSÉ DA SILVA TESTE. Quem está logado é o Mateus (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const MARCA = 'Registro da marca Exemplo';
const JUDICIAL = /0001234-97\.2026\.8\.13\.0024/;

/** Abre o cartão de um módulo pela tabela e a seção pedida. */
async function abrirCartao(page: Page, endereco: string, linha: string, secao: string) {
  await page.goto(endereco);
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: linha }).first().click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await abrirSecao(cartao, secao);
  return cartao;
}

/** "+ Ligar processo": busca pelo texto e escolhe o processo achado. */
async function ligar(lugar: Locator, busca: string, processo: string | RegExp) {
  await lugar.getByRole('button', { name: 'Ligar processo' }).click();
  await lugar.getByRole('textbox', { name: 'Buscar processo para ligar' }).fill(busca);
  await lugar.getByRole('list', { name: 'Processos' }).getByRole('button', { name: processo }).click();
}

const ligados = (cartao: Locator) => cartao.getByRole('list', { name: 'Processos ligados' });
const titulo = (cartao: Locator, secao: string) => cartao.getByRole('button', { name: new RegExp(`^${secao}( \\d+)?$`) });

test.describe('Demanda e processo', () => {
  test('quando liga um processo existente pelo cartão da demanda, então ele aparece, o contador sobe e o processo mostra a demanda; desligar desfaz', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Busca de anterioridade', 'Processos');
    await expect(cartao.getByText('Nenhum processo ligado a esta demanda.')).toBeVisible();
    // Quando
    await ligar(cartao, 'marca', new RegExp(MARCA));
    // Então
    await expect(ligados(cartao).getByRole('link', { name: new RegExp(MARCA) })).toContainText('Administrativo · 912345678');
    await expect(titulo(cartao, 'Processos')).toHaveText(/1$/);
    await expect(page.getByRole('status').filter({ hasText: 'Processo ligado.' })).toBeVisible();
    // Quando: desliga
    await cartao.getByRole('button', { name: `Desligar o processo ${MARCA}` }).click();
    // Então
    await expect(cartao.getByText('Nenhum processo ligado a esta demanda.')).toBeVisible();
    await expect(titulo(cartao, 'Processos')).toHaveText(/0$/);
    // Quando: desfaz o desligamento (o último aviso, o mais novo)
    await expect(page.getByRole('status')).toContainText(`Processo desligado: ${MARCA}.`);
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então: a ligação volta, e o processo mostra a demanda
    await expect(ligados(cartao).getByRole('link', { name: new RegExp(MARCA) })).toBeVisible();
    await ligados(cartao).getByRole('link', { name: new RegExp(MARCA) }).click();
    const processo = page.getByRole('dialog');
    await abrirSecao(processo, 'Demandas');
    await expect(processo.getByRole('link', { name: /Busca de anterioridade/ })).toBeVisible();
  });

  test('quando liga dois processos pelo formulário de edição da demanda e salva, então os dois aparecem no cartão; tirar um e salvar desliga só ele', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Busca de anterioridade', 'Processos');
    await cartao.getByRole('button', { name: 'Editar' }).click();
    const campo = cartao.getByRole('group', { name: 'Processos' });
    await expect(cartao.getByRole('heading', { name: 'Contrato e processos' })).toBeVisible();
    // Quando
    await ligar(campo, 'marca', new RegExp(MARCA));
    await ligar(campo, 'silva', /JOSÉ DA SILVA TESTE/);
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(ligados(cartao).getByRole('listitem')).toHaveCount(2);
    await expect(titulo(cartao, 'Processos')).toHaveText(/2$/);
    // Quando: tira um e salva
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await campo.getByRole('button', { name: `Tirar o processo ${MARCA}` }).click();
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(ligados(cartao).getByRole('listitem')).toHaveCount(1);
    await expect(ligados(cartao)).toContainText('JOSÉ DA SILVA TESTE');
    await expect(titulo(cartao, 'Processos')).toHaveText(/1$/);
  });

  test('dada uma demanda arquivada, quando abre os processos dela, então não há como ligar nem desligar', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/demandas/', 'Busca de anterioridade', 'Processos');
    await ligar(cartao, 'marca', new RegExp(MARCA));
    await expect(ligados(cartao).getByRole('listitem')).toHaveCount(1);
    // Quando
    await cartao.getByRole('button', { name: 'Arquivar' }).click();
    // Então
    await expect(cartao.getByText('Arquivada', { exact: true }).first()).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Ligar processo' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: /Desligar o processo/ })).toHaveCount(0);
  });
});

test.describe('Tarefa e processo', () => {
  test('quando liga um processo pelo cartão da tarefa, então ele aparece e não cabe outro; desligar volta ao vazio', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Renovar a procuração', 'Processo');
    await expect(cartao.getByText('Esta tarefa não está ligada a um processo.')).toBeVisible();
    // Quando
    await ligar(cartao, 'silva', /JOSÉ DA SILVA TESTE/);
    // Então
    await expect(ligados(cartao).getByRole('link', { name: JUDICIAL })).toBeVisible();
    await expect(titulo(cartao, 'Processo')).toHaveText(/1$/);
    await expect(cartao.getByRole('button', { name: 'Ligar processo' })).toHaveCount(0);
    // Quando
    await cartao.getByRole('button', { name: /Desligar o processo/ }).click();
    // Então
    await expect(cartao.getByText('Esta tarefa não está ligada a um processo.')).toBeVisible();
    await expect(titulo(cartao, 'Processo')).toHaveText(/0$/);
  });

  test('quando escolhe o processo no formulário de edição da tarefa e salva, então o cartão mostra o processo e o histórico guarda a mudança', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/tarefas/', 'Renovar a procuração', 'Processo');
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await expect(cartao.getByRole('heading', { name: 'Demanda, contrato e processo' })).toBeVisible();
    // Quando
    await ligar(cartao.getByRole('group', { name: 'Processo' }), 'marca', new RegExp(MARCA));
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(ligados(cartao).getByRole('link', { name: new RegExp(MARCA) })).toBeVisible();
    await abrirSecao(cartao, 'Histórico de alterações');
    // O histórico guarda o processo pelo número (o administrativo não tem nome no histórico).
    await expect(cartao.getByRole('listitem').filter({ hasText: /^Processo/ }).or(cartao.getByText(/Processo.*912345678/))).toBeVisible();
  });
});

test.describe('Contrato e processo', () => {
  test('quando liga um processo pelo cartão do contrato, então o contrato aparece no cartão do processo; desligar tira dos dois', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/contratos/', 'MA96-0001', 'Processos');
    await expect(cartao.getByText('Nenhum processo ligado a este contrato.')).toBeVisible();
    // Quando
    await ligar(cartao, 'silva', /JOSÉ DA SILVA TESTE/);
    // Então
    await expect(titulo(cartao, 'Processos')).toHaveText(/1$/);
    await ligados(cartao).getByRole('link', { name: JUDICIAL }).click();
    const processo = page.getByRole('dialog');
    await abrirSecao(processo, 'Contratos');
    await expect(processo.getByRole('list', { name: 'Contratos ligados' }).getByRole('link', { name: /MA96-0001/ })).toBeVisible();
    // Quando: volta ao contrato e desliga
    await processo.getByRole('list', { name: 'Contratos ligados' }).getByRole('link', { name: /MA96-0001/ }).click();
    const contrato = page.getByRole('dialog');
    await abrirSecao(contrato, 'Processos');
    await contrato.getByRole('button', { name: /Desligar o processo/ }).click();
    // Então
    await expect(contrato.getByText('Nenhum processo ligado a este contrato.')).toBeVisible();
  });

  test('quando liga um processo pelo formulário de edição do contrato e salva, então ele aparece no cartão', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, '/contratos/', 'MA96-0001', 'Processos');
    await cartao.getByRole('button', { name: 'Editar' }).click();
    // Quando
    await ligar(cartao.getByRole('group', { name: 'Processos do contrato' }), 'marca', new RegExp(MARCA));
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(ligados(cartao).getByRole('link', { name: new RegExp(MARCA) })).toBeVisible();
    await expect(titulo(cartao, 'Processos')).toHaveText(/1$/);
  });
});

test.describe('Compromisso e processo', () => {
  test('quando liga um processo pelo cartão de uma reunião, então ele aparece; e desligar volta ao vazio', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Reunião de equipe' }).click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Processo');
    // Quando
    await ligar(cartao, 'marca', new RegExp(MARCA));
    // Então
    await expect(ligados(cartao).getByRole('link', { name: new RegExp(MARCA) })).toBeVisible();
    await expect(titulo(cartao, 'Processo')).toHaveText(/1$/);
    // Quando
    await cartao.getByRole('button', { name: /Desligar o processo/ }).click();
    // Então
    await expect(cartao.getByText('Este compromisso não está ligado a um processo.')).toBeVisible();
  });

  test('dada uma audiência, quando abre o processo dela, então ele não pode ser desligado pelo cartão', async ({ page }) => {
    // Dado
    await page.goto('/agenda/');
    await page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Audiência' }).first().click();
    const cartao = page.getByRole('dialog');
    // Quando
    await abrirSecao(cartao, 'Processo');
    // Então
    await expect(ligados(cartao).getByRole('link', { name: JUDICIAL })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /Desligar o processo/ })).toHaveCount(0);
    await expect(cartao.getByText('Audiência precisa de um processo. Para trocar, use o lápis do cartão.')).toBeVisible();
  });
});
