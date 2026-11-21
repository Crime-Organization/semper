// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O nome da coluna do quadro inteiro, em mais de uma linha (#352): quebra em até três linhas, sem reticências; se nem três
// bastam, a terceira termina em reticências e a dica (title) mostra o nome todo. O "⋯" e a quantidade ficam alinhados no topo
// das colunas lado a lado. No banco fictício, o quadro de Tarefas tem "Para fazer", "Fazendo", "Aguardando retorno" e
// "Concluída" (com uma tarefa); a coluna nova entra depois delas, com zero. Quem está logado é o Mauro (administrador).
// O nome aparece em maiúsculas pelo estilo (#386): as linhas são contadas pela altura do título e pela altura de uma linha.
import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ viewport: { width: 2400, height: 1000 } });

/** Um nome com palavras curtas, como os das colunas do escritório: cabe em duas ou três linhas. */
const NOME_LONGO = 'Diligência/Análise/Falta de documentação';
/** Um nome com o tamanho máximo de coluna (60 letras), de letras largas: não cabe em três linhas. */
const NOME_ENORME = 'Mmmmmmmmmm Wwwwwwwwww Mmmmmmmmmm Wwwwwwwwww Mmmmmmmmmm Wwwww';

async function criarColuna(page: Page, nome: string) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Kanban' }).click();
  await page.getByLabel('Nova coluna').fill(nome);
  await page.getByRole('button', { name: 'Criar coluna' }).click();
  const titulo = page.getByRole('region', { name: 'Quadro' }).getByRole('heading', { name: nome, exact: true });
  await expect(titulo).toBeVisible();
  return titulo;
}

/** Quantas linhas o título mostra e se o texto passou delas (cortado com reticências). */
const linhasDo = (titulo: Locator) => titulo.evaluate(el => ({
  linhas: Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight)),
  cortado: el.scrollHeight > el.clientHeight
}));

/** A altura, na tela, do meio de um elemento. */
async function meio(el: Locator) {
  const caixa = await el.boundingBox();
  return caixa!.y + caixa!.height / 2;
}

test.describe('Nome da coluna inteiro', () => {
  test('dado um quadro com uma coluna de nome longo, quando a pessoa olha o topo dela, então o nome aparece inteiro, em mais de uma linha, sem reticências', async ({ page }) => {
    // Quando
    const titulo = await criarColuna(page, NOME_LONGO);
    // Então
    const { linhas, cortado } = await linhasDo(titulo);
    expect(linhas).toBeGreaterThan(1);
    expect(linhas).toBeLessThanOrEqual(3);
    expect(cortado).toBe(false);
    await expect(titulo).toHaveText(NOME_LONGO.toLocaleUpperCase('pt-BR'), { useInnerText: true });
  });

  test('dado um nome que não cabe nem em três linhas, quando a pessoa passa o mouse, então a dica mostra o nome inteiro', async ({ page }) => {
    // Dado
    const titulo = await criarColuna(page, NOME_ENORME);
    expect(await linhasDo(titulo)).toEqual({ linhas: 3, cortado: true });
    // Quando
    await titulo.hover();
    // Então
    await expect(titulo).toHaveAttribute('title', NOME_ENORME);
  });

  test('dadas as colunas lado a lado, quando uma tem o nome em várias linhas, então os contadores e o "⋯" continuam alinhados no topo', async ({ page }) => {
    // Dado
    const longo = await criarColuna(page, NOME_LONGO);
    const quadro = page.getByRole('region', { name: 'Quadro' });
    const curto = quadro.getByRole('heading', { name: 'Concluída', exact: true });
    // Então: o "⋯" das duas na mesma altura
    const menuLongo = page.getByRole('button', { name: `Opções da coluna ${NOME_LONGO}` });
    const menuCurto = page.getByRole('button', { name: 'Opções da coluna Concluída' });
    expect(Math.abs(await meio(menuLongo) - await meio(menuCurto))).toBeLessThanOrEqual(1);
    // Então: as quantidades também, ao lado do "⋯"
    const quantidadeLonga = longo.locator('xpath=..').getByText('0', { exact: true });
    const quantidadeCurta = curto.locator('xpath=..').getByText('1', { exact: true });
    expect(Math.abs(await meio(quantidadeLonga) - await meio(quantidadeCurta))).toBeLessThanOrEqual(1);
    expect(Math.abs(await meio(quantidadeLonga) - await meio(menuLongo))).toBeLessThanOrEqual(1);
    // Então: a primeira linha do nome longo na altura do nome curto
    const topoLongo = (await longo.boundingBox())!.y, topoCurto = (await curto.boundingBox())!.y;
    expect(Math.abs(topoLongo - topoCurto)).toBeLessThanOrEqual(1);
  });
});
