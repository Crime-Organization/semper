// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O papel do cliente escrito pela equipe (#443): no cadastro do processo, "+ Escrever o nome do papel…" no fim do "Papel do cliente"
// abre a janela de texto; o nome escrito fica no processo, entra na lista do escritório e aparece nos próximos cadastros; o
// administrador o tira da lista nas Configurações, os processos que já o usam continuam com o nome, e ele não volta à lista sem
// alguém escrevê-lo de novo (o recurso que nasce do processo copia o nome, mas não o devolve à lista). Na semente do banco
// fictício, a cliente LUCIANA ROCHA AMOSTRA; quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrir, abrirSecao } from './ajudantes';

const NUMERO = '0005678-13.2026.8.13.0433';
const OUTRO_NUMERO = '0001111-02.2026.8.13.0024';
const NUMERO_DO_RECURSO = '0002222-21.2026.8.13.0024';
const ESCREVER = '+ Escrever o nome do papel…';
const JANELA = 'Escrever o nome do papel';
/** Um papel com as 60 letras que o campo aceita (TAMANHO_PROCESSO.papelEscrito). */
const PAPEL_COMPRIDO = 'Inventariante do espólio e representante legal dos herdeiros';

/** Abre o cadastro, escreve o número e escolhe a cliente: o "Papel do cliente" fica pronto para escolher. */
async function ateOPapel(page: Page, numero: string) {
  await page.goto('/processos/novo/');
  await page.getByLabel('Número do processo').fill(numero);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
  await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
  return page.getByLabel('Papel do cliente');
}
/** Quantas opções do select têm esse nome (sem contar maiúsculas): o navegador não mostra ao leitor de tela as do grupo, então se lê o próprio select. */
const quantasOpcoes = (select: Locator, nome: RegExp) => select.evaluate((s: HTMLSelectElement, n) => [...s.options].filter(o => new RegExp(n, 'i').test(o.text)).length, nome.source);
/** Escolhe "+ Escrever o nome do papel…" e escreve o nome na janela, com Enter. */
async function escrever(page: Page, nome: string) {
  await page.getByLabel('Papel do cliente').selectOption({ label: ESCREVER });
  const janela = page.getByRole('dialog', { name: JANELA });
  await janela.getByRole('textbox', { name: JANELA }).fill(nome);
  await janela.getByRole('textbox', { name: JANELA }).press('Enter');
  await expect(janela).toBeHidden();
}
/** Segue até o fim e salva o processo: o cartão dele abre. */
async function salvar(page: Page) {
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Salvar processo' }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
  return cartao;
}
/** A seção dos papéis escritos nas Configurações. */
async function configuracoes(page: Page) {
  await page.goto('/inicio/');
  await abrir(page, 'Configurações');
  return page.getByRole('region', { name: 'Papéis escritos nos processos' });
}

test.describe('O papel do cliente escrito pela equipe (#443)', () => {
  test('dado o cadastro de um processo, quando escreve Inventariante e salva, então o cartão mostra o papel e ele fica na lista', async ({ page }) => {
    // Dado
    const papel = await ateOPapel(page, NUMERO);
    await expect(papel.getByRole('option').last()).toHaveText(ESCREVER);
    // Quando
    await escrever(page, 'Inventariante');
    // Então
    await expect(papel.getByRole('option', { selected: true })).toHaveText('Inventariante');
    // Quando
    const cartao = await salvar(page);
    await abrirSecao(cartao, 'Clientes');
    // Então
    await expect(cartao.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toContainText('Cliente · Inventariante');

    // Quando cadastra outro processo, então o papel escrito está na lista, no grupo do escritório
    const outro = await ateOPapel(page, OUTRO_NUMERO);
    await expect.poll(() => outro.evaluate((s: HTMLSelectElement) => [...s.querySelectorAll('optgroup')].map(g => [g.label, [...g.children].map(o => o.textContent)])))
      .toEqual([['Do escritório', ['Inventariante']]]);
    // E escrever de novo, com outras maiúsculas e espaços, usa o que já existe, sem repetir
    await escrever(page, '  inventariante ');
    await expect(outro.getByRole('option', { selected: true })).toHaveText('Inventariante');
    expect(await quantasOpcoes(outro, /inventariante/)).toBe(1);
  });

  test('dado um papel escrito, quando o administrador o tira da lista nas Configurações, então ele some dos cadastros, o processo continua com o nome e o recurso não o devolve', async ({ page }) => {
    // Dado
    await ateOPapel(page, NUMERO);
    await escrever(page, 'Inventariante');
    await salvar(page);
    // Quando
    const secao = await configuracoes(page);
    await expect(secao.getByRole('cell', { name: 'Inventariante' })).toBeVisible();
    await secao.getByRole('button', { name: 'Tirar da lista' }).click();
    await secao.getByRole('button', { name: 'Confirmar: tirar da lista' }).click();
    // Então
    await expect(page.getByText('Papel "Inventariante" tirado da lista.')).toBeVisible();
    await expect(secao.getByText('Nenhum papel escrito ainda.')).toBeVisible();
    // E no próximo cadastro ele não aparece
    const papel = await ateOPapel(page, OUTRO_NUMERO);
    await expect(papel.getByRole('option').last()).toHaveText(ESCREVER);
    expect(await quantasOpcoes(papel, /inventariante/)).toBe(0);
    // E o processo que o usa continua com o nome
    await page.goto('/processos/judicial/');
    await page.getByRole('list', { name: 'Distribuído', exact: true }).getByRole('listitem').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' }).getByText('Inventariante').click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Clientes');
    await expect(cartao.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toContainText('Cliente · Inventariante');

    // Quando nasce um recurso dele, então o recurso traz o nome
    await cartao.getByRole('button', { name: 'Novo recurso ou incidental deste processo' }).click();
    await page.getByRole('menu', { name: 'Novo recurso ou incidental deste processo' }).getByRole('menuitem', { name: 'Novo recurso', exact: true }).click();
    await page.getByLabel('Número do processo').fill(NUMERO_DO_RECURSO);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByLabel('Papel do cliente').getByRole('option', { selected: true })).toHaveText('Inventariante');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
    // E o nome não volta à lista do escritório
    await expect((await configuracoes(page)).getByText('Nenhum papel escrito ainda.')).toBeVisible();
  });

  test('dado um papel escrito com as 60 letras que cabem, quando o processo aparece no quadro, então o selo não passa da largura do cartão', async ({ page }) => {
    // Dado
    await ateOPapel(page, NUMERO);
    await escrever(page, PAPEL_COMPRIDO);
    await salvar(page);
    // Quando
    await page.goto('/processos/judicial/');
    const miniatura = page.getByRole('list', { name: 'Distribuído', exact: true }).getByRole('listitem').filter({ has: page.getByTitle(PAPEL_COMPRIDO) });
    const selo = miniatura.getByTitle(PAPEL_COMPRIDO);
    // Então
    await expect(selo).toBeVisible();
    const [caixaDoSelo, caixaDoCartao] = await Promise.all([selo.boundingBox(), miniatura.boundingBox()]);
    expect(caixaDoSelo!.x + caixaDoSelo!.width).toBeLessThanOrEqual(caixaDoCartao!.x + caixaDoCartao!.width);
  });
});
