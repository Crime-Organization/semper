// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Grupos de colunas nos quadros. Na semente do banco fictício nenhum quadro tem grupos, e JOSÉ DA SILVA TESTE está na
// coluna "Lead". Quem está logado é o Mateus (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';

async function abrirQuadro(page: Page) {
  await page.goto('/pessoas/');
  await page.getByRole('button', { name: 'Kanban' }).click();
}
async function criarGrupo(page: Page, nome: string) {
  await page.getByLabel('Novo grupo').fill(nome);
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  await expect(page.getByRole('region', { name: `Grupo ${nome}` })).toBeVisible();
}
async function moverParaGrupo(page: Page, coluna: string, grupo: string) {
  await page.getByRole('button', { name: `Opções da coluna ${coluna}` }).click();
  await page.getByRole('menuitemradio', { name: grupo, exact: true }).click();
  await expect(page.getByRole('region', { name: `Grupo ${grupo}`, exact: true }).getByRole('list', { name: coluna, exact: true })).toBeVisible();
}

/** Os nomes das colunas ou dos grupos, na ordem da tela. */
const titulos = (lugar: Locator) => lugar.getByRole('heading', { level: 3 }).allTextContents();

test.describe('Grupos de colunas', () => {
  test('quando o quadro não tem grupos, então continua como antes', async ({ page }) => {
    // Quando
    await abrirQuadro(page);
    // Então
    await expect(page.getByRole('list', { name: 'Lead' })).toContainText('JOSÉ DA SILVA TESTE');
    await expect(page.getByRole('region', { name: /^Grupo / })).toHaveCount(0);
    await expect(page.getByLabel('Grupo da coluna')).toHaveCount(0);
  });

  test('quando a pessoa fecha um grupo, então as colunas somem, fica a faixa com o nome e os cartões, e continua fechado ao recarregar', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Início');
    await moverParaGrupo(page, 'Lead', 'Início');
    // Quando
    await page.getByRole('button', { name: 'Fechar o grupo Início' }).click();
    // Então
    const faixa = page.getByRole('button', { name: /^Abrir o grupo Início, \d+ cartões$/ });
    await expect(faixa).toBeVisible();
    await expect(page.getByRole('list', { name: 'Lead' })).toHaveCount(0);
    // Quando
    await page.reload();
    await page.getByRole('button', { name: 'Kanban' }).click();
    // Então
    await expect(faixa).toBeVisible();
    await expect(page.getByRole('list', { name: 'Lead' })).toHaveCount(0);
    // Quando
    await faixa.click();
    // Então
    await expect(page.getByRole('list', { name: 'Lead' })).toContainText('JOSÉ DA SILVA TESTE');
  });

  test('quando o grupo começa fechado, então ele abre fechado até a pessoa abrir', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Encerrado');
    // Quando
    await page.getByRole('button', { name: 'Opções do grupo Encerrado' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Começa fechado para todos' }).click();
    // Então
    await expect(page.getByRole('button', { name: /^Abrir o grupo Encerrado/ })).toBeVisible();
  });

  test('quando alguém cria uma coluna, então escolhe o grupo dela', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Conhecimento');
    // Quando
    await page.getByLabel('Nova coluna').fill('Contestação');
    await page.getByLabel('Grupo da coluna').selectOption({ label: 'Conhecimento' });
    await page.getByRole('button', { name: 'Criar coluna' }).click();
    // Então
    await expect(page.getByRole('region', { name: 'Grupo Conhecimento' }).getByRole('list', { name: 'Contestação' })).toBeVisible();
  });

  test('quando o grupo é excluído, então as colunas dele continuam no quadro, sem grupo', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Início');
    await moverParaGrupo(page, 'Lead', 'Início');
    // Quando
    await page.getByRole('button', { name: 'Opções do grupo Início' }).click();
    await page.getByRole('menuitem', { name: 'Excluir grupo' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir grupo' }).click();
    // Então
    await expect(page.getByRole('region', { name: 'Grupo Início' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Lead' })).toContainText('JOSÉ DA SILVA TESTE');
  });

  test('quando a pessoa fecha e abre um grupo pelo teclado, então o foco fica no botão do grupo', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Início');
    await moverParaGrupo(page, 'Lead', 'Início');
    // Quando
    await page.getByRole('button', { name: 'Fechar o grupo Início' }).focus();
    await page.keyboard.press('Enter');
    // Então
    await expect(page.getByRole('button', { name: /^Abrir o grupo Início/ })).toBeFocused();
    // Quando
    await page.keyboard.press('Enter');
    // Então
    await expect(page.getByRole('button', { name: 'Fechar o grupo Início' })).toBeFocused();
  });

  test('quando o grupo está fechado, então o nome fica embaixo na faixa, lido de baixo para cima, abaixo da quantidade', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Início');
    // Quando
    await page.getByRole('button', { name: 'Fechar o grupo Início' }).click();
    // Então
    const faixa = page.getByRole('button', { name: /^Abrir o grupo Início/ });
    const nome = faixa.getByText('Início', { exact: true }), quantidade = faixa.getByText('0', { exact: true });
    const [caixaDaFaixa, caixaDoNome, caixaDaQuantidade] = await Promise.all([faixa.boundingBox(), nome.boundingBox(), quantidade.boundingBox()]);
    const peDaFaixa = caixaDaFaixa!.y + caixaDaFaixa!.height, FOLGA_DA_FAIXA = 16;
    expect(peDaFaixa - (caixaDoNome!.y + caixaDoNome!.height)).toBeLessThanOrEqual(FOLGA_DA_FAIXA);
    expect(caixaDoNome!.y).toBeGreaterThan(caixaDaQuantidade!.y);
    await expect(nome).toHaveCSS('writing-mode', 'vertical-rl');
    await expect(nome).not.toHaveCSS('transform', 'none');
  });

  test('quando o nome do grupo é longo e a tela é baixa, então a quantidade de cartões continua à vista na faixa', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1366, height: 500 });
    await abrirQuadro(page);
    const nome = 'A'.repeat(60);
    await criarGrupo(page, nome);
    // Quando
    await page.getByRole('button', { name: `Fechar o grupo ${nome}` }).click();
    const faixa = page.getByRole('button', { name: new RegExp(`^Abrir o grupo ${nome}`) });
    await faixa.scrollIntoViewIfNeeded();
    // Então
    await expect(faixa.getByText('0', { exact: true })).toBeInViewport({ ratio: 1 });
  });

  test('quando a coluna é arrastada para cima de outro grupo, então ela continua no grupo dela', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'A');
    await criarGrupo(page, 'B');
    await moverParaGrupo(page, 'Lead', 'A');
    await moverParaGrupo(page, 'Entrar em contato', 'B');
    const grupoA = page.getByRole('region', { name: 'Grupo A', exact: true }), grupoB = page.getByRole('region', { name: 'Grupo B', exact: true });
    // Quando
    await grupoA.getByRole('heading', { name: 'Lead' }).dragTo(grupoB.getByRole('heading', { name: 'Entrar em contato' }));
    // Então
    await expect(grupoA.getByRole('list', { name: 'Lead' })).toBeVisible();
    await expect(grupoB.getByRole('list', { name: 'Lead' })).toHaveCount(0);
  });

  test('quando a coluna muda de lugar pelo menu, então ela anda só dentro do grupo', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'A');
    await moverParaGrupo(page, 'Lead', 'A');
    await moverParaGrupo(page, 'Entrar em contato', 'A');
    const grupoA = page.getByRole('region', { name: 'Grupo A', exact: true });
    // Quando
    await page.getByRole('button', { name: 'Opções da coluna Lead' }).click();
    await page.getByRole('menuitem', { name: 'Mover para a direita' }).click();
    // Então
    await expect.poll(() => titulos(grupoA)).toEqual(['Entrar em contato', 'Lead']);
    // Quando: já é a última do grupo
    await page.getByRole('button', { name: 'Opções da coluna Lead' }).click();
    // Então
    await expect(page.getByRole('menuitem', { name: 'Mover para a direita' })).toHaveCount(0);
  });

  test('quando o grupo muda de lugar pelo menu, então ele troca com o vizinho', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'A');
    await criarGrupo(page, 'B');
    const grupos = page.getByRole('region', { name: /^Grupo / });
    const nomes = () => grupos.evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
    // Quando
    await page.getByRole('button', { name: 'Opções do grupo A' }).click();
    await page.getByRole('menuitem', { name: 'Mover para a direita' }).click();
    // Então
    await expect.poll(nomes).toEqual(['Grupo B', 'Grupo A']);
  });

  test('quando a pessoa desfaz a mudança de grupo, então a coluna volta para onde estava', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'A');
    await moverParaGrupo(page, 'Lead', 'A');
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(page.getByRole('region', { name: 'Grupo A', exact: true }).getByRole('list', { name: 'Lead' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Lead' })).toBeVisible();
  });

  test('quando um grupo é excluído depois de receber uma coluna, então as colunas continuam podendo mudar de lugar', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'A');
    await moverParaGrupo(page, 'Lead', 'A');
    await page.getByRole('button', { name: 'Opções do grupo A' }).click();
    await page.getByRole('menuitem', { name: 'Excluir grupo' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir grupo' }).click();
    await expect(page.getByRole('region', { name: 'Grupo A', exact: true })).toHaveCount(0);
    const quadro = page.getByRole('region', { name: 'Quadro' });
    const posicao = async (nome: string) => (await titulos(quadro)).indexOf(nome);
    expect(await posicao('Entrar em contato')).toBeLessThan(await posicao('Retornar contato'));
    // Quando
    await page.getByRole('button', { name: 'Opções da coluna Retornar contato' }).click();
    await page.getByRole('menuitem', { name: 'Mover para a esquerda' }).click();
    // Então
    await expect.poll(async () => await posicao('Retornar contato') < await posicao('Entrar em contato')).toBe(true);
  });

  test('quando o quadro tem muitos grupos, então o menu da coluna cabe na tela', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1366, height: 680 });
    await abrirQuadro(page);
    for (const g of ['Início', 'Conhecimento', 'Decisão', 'Recursal', 'Cumprimento', 'Encerrado']) await criarGrupo(page, g);
    // Quando
    await page.getByRole('button', { name: 'Opções da coluna Lead' }).click();
    // Então
    await expect(page.getByRole('menu')).toBeInViewport({ ratio: 1 });
    await page.getByRole('menuitemradio', { name: 'Encerrado' }).click();
    await expect(page.getByRole('region', { name: 'Grupo Encerrado' }).getByRole('list', { name: 'Lead' })).toBeVisible();
  });

  test('quando o grupo é renomeado, então o nome novo aparece no quadro', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Inicio');
    // Quando
    await page.getByRole('button', { name: 'Opções do grupo Inicio' }).click();
    await page.getByRole('menuitem', { name: 'Renomear' }).click();
    await page.getByRole('dialog').getByRole('textbox').fill('Início');
    await page.getByRole('dialog').getByRole('button', { name: /Salvar|OK|Confirmar/ }).click();
    // Então
    await expect(page.getByRole('region', { name: 'Grupo Início' })).toBeVisible();
  });
});
