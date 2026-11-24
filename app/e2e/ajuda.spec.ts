// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A ajuda de cada tela de módulo (#85): o botão "?" ao lado do título abre uma janela com a explicação curta da tela em cima e
// os atalhos de teclado embaixo; a tecla "?" abre a mesma janela; Esc e o clique fora a fecham. Os textos ficam em regras/ajuda.ts.
// As telas que não são de módulo (Início, Financeiro, Equipe, Minha conta…) têm o mesmo "?" e a mesma janela (#411).
import { expect, test } from '@playwright/test';
import { AJUDA, AJUDA_DAS_TELAS, type TelaComAjuda } from '../src/regras/ajuda';

test.describe('Ajuda da tela', () => {
  test('dada a tela de Pessoas, quando a pessoa clica no "?" do cabeçalho, então lê a explicação da tela e, embaixo, os atalhos; o Esc fecha', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Ajuda desta tela' }).click();
    // Então
    const ajuda = page.getByRole('dialog', { name: 'Ajuda: Pessoas' });
    for (const paragrafo of AJUDA.pessoas) await expect(ajuda.getByText(paragrafo)).toBeVisible();
    const atalhos = ajuda.getByRole('region', { name: 'Atalhos do teclado' });
    await expect(atalhos.getByRole('region', { name: 'Nesta página' })).toContainText('Nova pessoa');
    await expect(atalhos.getByRole('region', { name: 'Em todo o SEMPER' })).toContainText('Buscar em todo o SEMPER');
    // Quando
    await page.keyboard.press('Escape');
    // Então
    await expect(ajuda).toBeHidden();
    await expect(page).toHaveURL(/\/pessoas\/$/);
  });

  test('dada a ajuda aberta pela tecla "?", quando a pessoa clica fora da janela, então ela fecha', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    await page.keyboard.press('?');
    const ajuda = page.getByRole('dialog', { name: 'Ajuda: Pessoas' });
    await expect(ajuda.getByText(AJUDA.pessoas[0])).toBeVisible();
    // Quando: o clique cai no canto da tela, fora da janela
    await page.mouse.click(5, 5);
    // Então
    await expect(ajuda).toBeHidden();
  });

  test('dada outra tela de módulo, quando a pessoa clica no "?", então a explicação é a dela', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    await expect(page.getByRole('heading', { name: 'Contratos' })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Ajuda desta tela' }).click();
    // Então
    const ajuda = page.getByRole('dialog', { name: 'Ajuda: Contratos' });
    await expect(ajuda.getByText(AJUDA.contratos[0])).toBeVisible();
    await expect(ajuda.getByText(AJUDA.pessoas[0])).toHaveCount(0);
    await expect(ajuda.getByRole('region', { name: 'Nesta página' })).toContainText('Novo contrato');
  });

  test('dado o celular, quando a tela de Pessoas abre, então o "?" cabe ao lado do título, sem a página rolar para o lado', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 812 });
    // Quando
    await page.goto('/pessoas/');
    // Então
    const botao = page.getByRole('button', { name: 'Ajuda desta tela' });
    await expect(botao).toBeVisible();
    const titulo = await page.getByRole('heading', { name: 'Pessoas' }).boundingBox();
    const doBotao = await botao.boundingBox();
    expect(doBotao && titulo && Math.abs((doBotao.y + doBotao.height / 2) - (titulo.y + titulo.height / 2))).toBeLessThan(titulo?.height ?? 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

// As telas que não são de módulo (#411): o mesmo "?" ao lado do título e a mesma tecla "?", com a mesma janela.
const OUTRAS_TELAS: [string, TelaComAjuda][] = [
  ['/inicio/', 'inicio'], ['/processos/', 'painelProcessos'], ['/mensagens/', 'mensagens'], ['/modelos-de-lista/', 'modelosDeLista'],
  ['/tarefas/meu-tempo/', 'meuTempo'], ['/calendario/', 'calendario'], ['/financeiro/', 'financeiroEntradas'], ['/financeiro/saidas/', 'financeiroSaidas'],
  ['/financeiro/direitos/', 'financeiroDireitos'], ['/financeiro/obrigacoes/', 'financeiroObrigacoes'], ['/equipe/', 'equipe'],
  ['/minha-conta/', 'minhaConta'], ['/configuracoes/', 'configuracoes']
];

test.describe('Ajuda das telas que não são de módulo (#411)', () => {
  test('dada cada tela, quando a pessoa clica no "?" ao lado do título, então lê a explicação dela e os atalhos; o Esc fecha', async ({ page }) => {
    for (const [endereco, tela] of OUTRAS_TELAS) {
      // Dado
      await page.goto(endereco);
      // Quando
      await page.getByRole('button', { name: 'Ajuda desta tela' }).click();
      // Então
      const ajuda = page.getByRole('dialog', { name: `Ajuda: ${AJUDA_DAS_TELAS[tela].titulo}` });
      await expect(ajuda.getByText(AJUDA_DAS_TELAS[tela].textos[0])).toBeVisible();
      await expect(ajuda.getByRole('region', { name: 'Atalhos do teclado' })).toContainText('Mostrar esta ajuda');
      // Quando
      await page.keyboard.press('Escape');
      // Então
      await expect(ajuda).toBeHidden();
    }
  });

  test('dada a aba Direitos do Financeiro, quando a pessoa aperta "?", então abre a ajuda da aba, com o N da Nova entrada', async ({ page }) => {
    // Dado
    await page.goto('/financeiro/direitos/');
    await expect(page.getByRole('navigation', { name: 'Abas do financeiro' })).toBeVisible();
    // Quando
    await page.keyboard.press('?');
    // Então
    const ajuda = page.getByRole('dialog', { name: 'Ajuda: Financeiro (Direitos)' });
    for (const paragrafo of AJUDA_DAS_TELAS.financeiroDireitos.textos) await expect(ajuda.getByText(paragrafo)).toBeVisible();
    await expect(ajuda.getByRole('region', { name: 'Nesta página' })).toContainText('Nova entrada');
  });

  test('dado o Início, quando a pessoa aperta "?", então abre a ajuda do Início, mesmo com o título "Olá"', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await expect(page.getByRole('heading', { level: 1, name: /^Olá/ })).toBeVisible();
    // Quando
    await page.keyboard.press('?');
    // Então
    await expect(page.getByRole('dialog', { name: 'Ajuda: Início' }).getByText(AJUDA_DAS_TELAS.inicio.textos[0])).toBeVisible();
  });

  test('dado o celular, quando o Início e Minha conta abrem, então o "?" cabe ao lado do título, sem a página rolar para o lado', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 812 });
    for (const endereco of ['/inicio/', '/minha-conta/']) {
      // Quando
      await page.goto(endereco);
      // Então
      const botao = page.getByRole('button', { name: 'Ajuda desta tela' });
      await expect(botao).toBeVisible();
      const titulo = await page.getByRole('heading', { level: 1 }).boundingBox();
      const doBotao = await botao.boundingBox();
      expect(doBotao && titulo && Math.abs((doBotao.y + doBotao.height / 2) - (titulo.y + titulo.height / 2))).toBeLessThan(titulo?.height ?? 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
});
