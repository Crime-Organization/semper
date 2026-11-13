// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Grupo do quadro entre colunas sem grupo (#296), no quadro de Tarefas do banco fictício: "Para fazer", "Fazendo",
// "Aguardando retorno" e "Concluída", sem grupos. Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 2000, height: 1000 } });

async function abrirComGrupo(page: Page) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Kanban' }).click();
  await page.getByLabel('Novo grupo').fill('Aguardado');
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  await expect(page.getByRole('region', { name: 'Grupo Aguardado' })).toBeVisible();
  // O grupo nasce no fim do quadro; "Aguardando retorno" entra nele.
  await page.getByRole('button', { name: 'Opções da coluna Aguardando retorno' }).click();
  await page.getByRole('menuitemradio', { name: 'Aguardado', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Grupo Aguardado' }).getByRole('list', { name: 'Aguardando retorno' })).toBeVisible();
}

/** O topo do quadro na ordem da tela: o nome de cada coluna sem grupo e "Grupo X" para cada grupo. */
const topo = (page: Page) => page.getByRole('region', { name: 'Quadro' }).evaluate(q =>
  [...q.querySelectorAll<HTMLElement>('[data-topo]')].map(el => el.getAttribute('aria-label') ?? el.querySelector('h3')?.textContent));

const grupo = (page: Page) => page.getByRole('region', { name: 'Grupo Aguardado' });
/** Um ponto perto da borda esquerda: soltar ali põe o arrastado antes do alvo. */
const BORDA_ESQUERDA = { x: 4, y: 20 };

test.describe('Grupo entre colunas sem grupo', () => {
  test('quando o administrador arrasta o grupo para antes de uma coluna sem grupo, então ele fica entre as colunas, e continua lá ao recarregar', async ({ page }) => {
    // Dado
    await abrirComGrupo(page);
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Fazendo', 'Concluída', 'Grupo Aguardado']);
    // Quando
    await page.getByRole('button', { name: 'Fechar o grupo Aguardado' }).dragTo(page.getByRole('list', { name: 'Concluída', exact: true }), { targetPosition: BORDA_ESQUERDA });
    // Então
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Fazendo', 'Grupo Aguardado', 'Concluída']);
    await expect(page.getByText('Grupo "Aguardado" mudou de lugar.')).toBeVisible();
    // Quando
    await page.reload();
    await page.getByRole('button', { name: 'Kanban' }).click();
    // Então
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Fazendo', 'Grupo Aguardado', 'Concluída']);
  });

  test('quando a pessoa clica em "Desfazer", então o grupo volta para o fim', async ({ page }) => {
    // Dado
    await abrirComGrupo(page);
    await page.getByRole('button', { name: 'Fechar o grupo Aguardado' }).dragTo(page.getByRole('list', { name: 'Fazendo', exact: true }), { targetPosition: BORDA_ESQUERDA });
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Grupo Aguardado', 'Fazendo', 'Concluída']);
    // Quando: o aviso mais novo é o da mudança de lugar (o anterior é o da coluna que entrou no grupo)
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    // Então
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Fazendo', 'Concluída', 'Grupo Aguardado']);
    await expect(grupo(page).getByRole('list', { name: 'Aguardando retorno' })).toBeVisible();
  });

  test('quando a coluna sem grupo é arrastada para depois do grupo, então ela passa para o outro lado dele', async ({ page }) => {
    // Dado
    await abrirComGrupo(page);
    await page.getByRole('button', { name: 'Fechar o grupo Aguardado' }).dragTo(page.getByRole('list', { name: 'Fazendo', exact: true }), { targetPosition: BORDA_ESQUERDA });
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Grupo Aguardado', 'Fazendo', 'Concluída']);
    // Quando: "Para fazer" vai para antes de "Concluída", passando pelo grupo
    await page.getByRole('heading', { name: 'Para fazer' }).dragTo(page.getByRole('list', { name: 'Concluída', exact: true }), { targetPosition: BORDA_ESQUERDA });
    // Então
    await expect.poll(() => topo(page)).toEqual(['Grupo Aguardado', 'Fazendo', 'Para fazer', 'Concluída']);
    await expect(grupo(page).getByRole('list', { name: 'Aguardando retorno' })).toBeVisible();
  });

  test('quando o grupo fechado é arrastado pela faixa, então ele também fica entre as colunas', async ({ page }) => {
    // Dado
    await abrirComGrupo(page);
    await page.getByRole('button', { name: 'Fechar o grupo Aguardado' }).click();
    // Quando
    await page.getByRole('button', { name: /^Abrir o grupo Aguardado/ }).dragTo(page.getByRole('list', { name: 'Concluída', exact: true }), { targetPosition: BORDA_ESQUERDA });
    // Então
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Fazendo', 'Grupo Aguardado', 'Concluída']);
  });

  test('quando a pessoa usa só o menu, então o grupo e a coluna sem grupo andam um passo, contando colunas e grupos', async ({ page }) => {
    // Dado
    await abrirComGrupo(page);
    // Quando
    await page.getByRole('button', { name: 'Opções do grupo Aguardado' }).click();
    await page.getByRole('menuitem', { name: 'Mover para a esquerda' }).click();
    // Então
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Fazendo', 'Grupo Aguardado', 'Concluída']);
    // Quando
    await page.getByRole('button', { name: 'Opções da coluna Fazendo' }).click();
    await page.getByRole('menuitem', { name: 'Mover para a direita' }).click();
    // Então
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Grupo Aguardado', 'Fazendo', 'Concluída']);
    // Quando: a última do topo não anda mais para a direita
    await page.getByRole('button', { name: 'Opções da coluna Concluída' }).click();
    // Então
    await expect(page.getByRole('menuitem', { name: 'Mover para a direita' })).toHaveCount(0);
  });

  test('quando uma coluna nova sem grupo é criada, então ela entra no fim do quadro, depois do grupo', async ({ page }) => {
    // Dado
    await abrirComGrupo(page);
    // Quando
    await page.getByLabel('Nova coluna').fill('Revisão');
    await page.getByRole('button', { name: 'Criar coluna' }).click();
    // Então
    await expect.poll(() => topo(page)).toEqual(['Para fazer', 'Fazendo', 'Concluída', 'Grupo Aguardado', 'Revisão']);
  });
});
