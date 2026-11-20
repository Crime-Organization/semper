// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A coluna da direita do cartão (#360): com o cartão no centro da tela, ela tem, nesta ordem, "Comentários" (aberta), "Anotações" e
// "Histórico de alterações" (recolhidas; no processo, os andamentos vêm depois dos comentários, #362), cada uma com o seu número, e
// o "Expandir tudo" / "Recolher tudo" no alto dela abrange as seções da coluna (três; no processo, quatro). Cada anotação ligada aparece como um comentário (o título e o
// começo do texto, num fundo diferente) e abre com um clique. Com o cartão ao lado e na janela estreita, não há a coluna: as seções dela ficam no pé do cartão, na mesma ordem, antes do rodapé, e o
// "Expandir tudo" do alto do cartão (o único) abre também elas. Na semente do banco fictício, JOSÉ DA SILVA TESTE tem um
// comentário da Ana e é o cliente do processo judicial; não há anotações. Quem está logado é o Mateus (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const PESSOA = 'JOSÉ DA SILVA TESTE';
/** O rodapé do cartão da pessoa: a data e quem cadastrou (a faixa das datas, #383, no alto, tem só a data). */
const RODAPE_DA_PESSOA = /^Cadastrada em \d{2}\/\d{2}\/\d{4} por /;
/** As três seções da coluna, pelo título (o número vem logo depois). */
const SECOES = /^(Comentários|Anotações|Histórico de alterações)/;
const ORDEM = [/^Comentários\s*\d+$/, /^Anotações\s*\d+$/, /^Histórico de alterações\s*\d+$/];

/** Abre o cartão de uma pessoa pela tabela. */
async function abrirPessoa(page: Page) {
  await page.goto('/pessoas/');
  await page.getByRole('row').filter({ hasText: PESSOA }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: PESSOA, level: 2 })).toBeVisible();
  return cartao;
}
/** Abre o processo judicial da semente pela tabela. */
async function abrirProcesso(page: Page) {
  await page.goto('/processos/judicial/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: PESSOA }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: PESSOA, level: 2 })).toBeVisible();
  return cartao;
}
/**
 * Escreve, pelo "+" da seção "Anotações" do cartão aberto, uma anotação já ligada ao item, e volta ao cartão. Desde a #369, a
 * anotação nova abre em Documentos, na janela da anotação, e vai ao banco sozinha: o título, com o Enter; o texto, com o Ctrl+S.
 */
async function escreverAnotacao(page: Page, cartao: Locator, titulo: string, texto: string) {
  await cartao.getByRole('link', { name: 'Nova anotação ligada a este item' }).click();
  const janela = page.getByRole('dialog', { name: 'Anotação', exact: true });
  const nova = janela.getByRole('article', { name: 'Anotação nova' });
  await expect(nova.getByRole('heading', { level: 2 })).toBeVisible();
  const campo = nova.getByRole('textbox', { name: 'Título' });
  if (!await campo.count()) await nova.getByRole('button', { name: 'Sem título' }).click();
  await campo.fill(titulo);
  await campo.press('Enter');
  // Gravada, ela passa a se chamar pelo código
  await expect(janela.getByRole('article', { name: /^Anotação (?!nova$)\w+$/ })).toBeVisible();
  const caixa = janela.getByRole('textbox', { name: 'Texto', exact: true });
  await caixa.click();
  // O texto entra de uma vez, como colado (tecla por tecla, o Enter numa lista já começaria o item seguinte).
  await page.keyboard.insertText(texto);
  await caixa.press('Control+s');
  await expect(janela.getByRole('status', { name: 'Gravação do texto' })).toHaveText('Salvo');
  await page.goBack();
  await expect(cartao.getByRole('button', { name: /^Anotações/ })).toHaveText(/^Anotações\s*1$/);
}
/** Passa o cartão para o centro da tela. */
const noCentro = (page: Page) => page.getByRole('button', { name: 'Abrir no centro da tela' }).click();
/** Se o elemento está na metade direita da janela (na coluna) ou na esquerda (no cartão). */
async function naMetadeDireita(janela: Locator, alvo: Locator) {
  const [fora, dentro] = await Promise.all([janela.boundingBox(), alvo.boundingBox()]);
  return dentro!.x > fora!.x + fora!.width / 2;
}

test.describe('A coluna da direita do cartão (#360)', () => {
  test('dado o cartão de uma pessoa no centro, quando abre, então a coluna tem comentários, anotações e histórico, nesta ordem, só os comentários abertos, e o "Expandir tudo" dela abre os três', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page);
    // Quando
    await noCentro(page);
    // Então: as três, na ordem, cada uma com o número, todas na coluna da direita
    const secoes = cartao.getByRole('button', { name: SECOES });
    await expect(secoes).toHaveText(ORDEM);
    for (const s of await secoes.all()) await expect.poll(() => naMetadeDireita(cartao, s)).toBe(true);
    await expect(secoes.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(secoes.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(secoes.nth(2)).toHaveAttribute('aria-expanded', 'false');
    // E o histórico saiu do corpo do cartão: o rodapé, o último do corpo, fica na metade esquerda
    await expect.poll(() => naMetadeDireita(cartao, cartao.getByText(RODAPE_DA_PESSOA))).toBe(false);
    // Quando: o "Expandir tudo" da coluna (o do corpo do cartão vem antes, na ordem da página)
    await cartao.getByRole('button', { name: 'Expandir tudo' }).last().click();
    // Então: as três abrem
    for (const s of await secoes.all()) await expect(s).toHaveAttribute('aria-expanded', 'true');
    await expect(cartao.getByText('Nenhuma anotação ligada a esta pessoa.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Recolher tudo' }).last()).toBeVisible();
  });

  test('dada uma anotação ligada à pessoa, quando a seção abre, então ela aparece como um comentário, com o título e o começo do texto num fundo diferente, e o clique a abre', async ({ page }) => {
    // Dado
    let cartao = await abrirPessoa(page);
    await escreverAnotacao(page, cartao, 'Plano do atendimento', '# Objetivo\nJuntar a **procuração** até sexta.\n- Pedir o RG\n- Conferir o CPF\nO resto do texto');
    await noCentro(page);
    // Quando
    await abrirSecao(cartao, 'Anotações');
    // Então: o título e as três primeiras linhas, sem os sinais do Markdown e sem o resto do texto
    const anotacao = cartao.getByRole('list', { name: 'Anotações ligadas' }).getByRole('link', { name: 'Abrir a anotação Plano do atendimento' });
    await expect(anotacao).toContainText('Objetivo');
    await expect(anotacao).toContainText('Juntar a procuração até sexta.');
    await expect(anotacao).toContainText('Pedir o RG…');
    await expect(anotacao).not.toContainText('Conferir o CPF');
    await expect(anotacao).not.toContainText('**');
    // E o balão dela tem outro fundo que o dos comentários
    const fundo = (alvo: Locator) => alvo.evaluate(el => getComputedStyle(el).backgroundColor);
    const doComentario = await fundo(cartao.getByRole('list', { name: 'Comentários do cartão' }).getByRole('paragraph').first());
    const daAnotacao = await fundo(anotacao.getByText(/^Objetivo/).locator('..'));
    expect(daAnotacao).not.toBe(doComentario);
    // Quando
    await anotacao.click();
    // Então
    await expect(page).toHaveURL(/\/documentos\/\?id=/);
    cartao = page.getByRole('dialog', { name: 'Anotação', exact: true });
    await expect(cartao.getByRole('heading', { name: 'Plano do atendimento', level: 2 })).toBeVisible();
    // E, na anotação, a coluna continua com "Comentários", "Ligada a" e o histórico, sem "Anotações"
    await expect(cartao.getByRole('button', { name: /^(Comentários|Ligada a|Histórico de alterações|Anotações)/ }))
      .toHaveText([/^Comentários\s*\d+$/, /^Ligada a\s*1$/, /^Histórico de alterações\s*\d+$/]);
  });

  test('dado o cartão de um processo, quando abre no centro, então a coluna tem os comentários (abertos), os andamentos (#362), as anotações e o histórico, nesta ordem', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    // Quando
    await noCentro(page);
    // Então
    const secoes = cartao.getByRole('button', { name: /^(Comentários|Andamentos|Anotações|Histórico de alterações)/ });
    await expect(secoes).toHaveText([ORDEM[0], /^Andamentos\s*\d+$/, ...ORDEM.slice(1)]);
    for (const s of await secoes.all()) await expect.poll(() => naMetadeDireita(cartao, s)).toBe(true);
    await expect(secoes.nth(0)).toHaveAttribute('aria-expanded', 'true');
    for (const s of (await secoes.all()).slice(1)) await expect(s).toHaveAttribute('aria-expanded', 'false');
  });

  test('dado o cartão de uma pessoa ao lado, quando abre, então as três seções ficam no pé do cartão, na mesma ordem, depois das outras e antes do rodapé', async ({ page }) => {
    // Dado / Quando: o cartão abre ao lado, de início
    const cartao = await abrirPessoa(page);
    await expect(cartao.getByRole('button', { name: 'Abrir no centro da tela' })).toBeVisible();
    // Então
    const secoes = cartao.getByRole('button', { name: SECOES });
    await expect(secoes).toHaveText(ORDEM);
    await expect(secoes.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(secoes.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(secoes.nth(2)).toHaveAttribute('aria-expanded', 'false');
    const altura = async (alvo: Locator) => (await alvo.boundingBox())!.y;
    const dados = await altura(cartao.getByRole('button', { name: /^Dados do cadastro/ }));
    const comentarios = await altura(secoes.nth(0)), historico = await altura(secoes.nth(2));
    const rodape = await altura(cartao.getByText(RODAPE_DA_PESSOA));
    expect(dados).toBeLessThan(comentarios);
    expect(historico).toBeLessThan(rodape);
  });
  test('dado o cartão de uma pessoa ao lado, quando a pessoa usa o "Expandir tudo" do alto do cartão, então ele é o único e abre também as três seções do pé', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page);
    const secoes = cartao.getByRole('button', { name: SECOES });
    await expect(secoes).toHaveText(ORDEM);
    // Então: um botão só, no alto do cartão, antes da primeira seção dele
    const expandir = cartao.getByRole('button', { name: /^(Expandir|Recolher) tudo$/ });
    await expect(expandir).toHaveCount(1);
    expect((await expandir.boundingBox())!.y).toBeLessThan((await cartao.getByRole('button', { name: /^Dados do cadastro/ }).boundingBox())!.y);
    // Quando
    await expandir.click();
    // Então
    for (const s of await secoes.all()) await expect(s).toHaveAttribute('aria-expanded', 'true');
    await expect(cartao.getByText('Nenhuma anotação ligada a esta pessoa.')).toBeVisible();
  });

  test('dada a janela estreita, quando o cartão abre no centro, então não há a coluna: as três seções ficam no pé do cartão, na mesma ordem, e o histórico vem antes do rodapé', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 800, height: 900 });
    const cartao = await abrirPessoa(page);
    // Quando
    await noCentro(page);
    await expect(cartao.getByRole('button', { name: 'Abrir ao lado' })).toBeVisible();
    // Então
    const secoes = cartao.getByRole('button', { name: SECOES });
    await expect(secoes).toHaveText(ORDEM);
    const altura = async (alvo: Locator) => (await alvo.boundingBox())!.y;
    expect(await altura(cartao.getByRole('button', { name: /^Dados do cadastro/ }))).toBeLessThan(await altura(secoes.nth(0)));
    expect(await altura(secoes.nth(2))).toBeLessThan(await altura(cartao.getByText(RODAPE_DA_PESSOA)));
    // E um "Expandir tudo" só, o do cartão
    await expect(cartao.getByRole('button', { name: /^(Expandir|Recolher) tudo$/ })).toHaveCount(1);
  });

  test('dada a escolha de antes da #360, com as anotações e o histórico abertos no corpo do cartão, quando o cartão abre, então os dois começam recolhidos na coluna', async ({ page }) => {
    // Dado: as preferências antigas gravadas como abertas
    await page.goto('/pessoas/');
    await page.evaluate(() => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { perfil: { preferencias: Record<string, unknown> } };
      bd.perfil.preferencias = { ...bd.perfil.preferencias, 'pessoas.cartao.anotacoes': true, 'pessoas.cartao.historico': true };
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    });
    // O banco fictício lê a aba ao abrir a página: recarrega para valer a mudança.
    await page.reload();
    // Quando
    const cartao = await abrirPessoa(page);
    await noCentro(page);
    // Então
    const secoes = cartao.getByRole('button', { name: SECOES });
    await expect(secoes).toHaveText(ORDEM);
    await expect(secoes.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(secoes.nth(2)).toHaveAttribute('aria-expanded', 'false');
  });
});
