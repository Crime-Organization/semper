// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Etiquetas coloridas. Na semente do banco fictício não há etiquetas, e JOSÉ DA SILVA TESTE está na coluna "Lead" de
// Pessoas. Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';

/** Abre o quadro de Pessoas e o cartão de JOSÉ DA SILVA TESTE. */
async function abrirCartaoDoJose(page: Page) {
  await page.goto('/pessoas/');
  await page.getByRole('button', { name: 'Kanban' }).click();
  await page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
  await page.getByRole('button', { name: 'Escolher etiquetas' }).waitFor();
}
const painel = (page: Page) => page.getByRole('dialog', { name: 'Escolher etiquetas' });

/** Cria a etiqueta pelo painel do cartão aberto (já fica aplicada nele). */
async function criarEtiqueta(page: Page, texto: string, cor: string) {
  await page.getByRole('button', { name: 'Escolher etiquetas' }).click();
  const form = painel(page).getByRole('form', { name: 'Nova etiqueta' });
  await form.getByLabel('Texto').fill(texto);
  await form.getByRole('radio', { name: cor }).check();
  await form.getByRole('button', { name: 'Criar etiqueta' }).click();
  await expect(painel(page).getByRole('list', { name: 'Etiquetas do escritório' })).toContainText(texto);
}
const fecharPainel = (page: Page) => page.keyboard.press('Escape');

test.describe('Etiquetas', () => {
  test('quando alguém cria uma etiqueta num cartão, então ela aparece colorida no cartão do quadro e na tabela', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    // Quando
    await criarEtiqueta(page, 'Urgência do cliente', 'Vermelho');
    await fecharPainel(page);
    // Então: no quadro
    const jose = page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    await expect(jose.getByText('Urgência do cliente')).toBeVisible();
    await expect(jose.getByText('Urgência do cliente')).toHaveCSS('background-color', 'rgb(185, 28, 28)');
    // Então: na tabela
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).getByText('Urgência do cliente')).toBeVisible();
  });

  test('quando a etiqueta é só de cor, então ela aparece como uma faixa colorida', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    // Quando
    await page.getByRole('button', { name: 'Escolher etiquetas' }).click();
    const form = painel(page).getByRole('form', { name: 'Nova etiqueta' });
    await form.getByRole('radio', { name: 'Verde' }).check();
    await form.getByRole('button', { name: 'Criar etiqueta' }).click();
    await expect(painel(page).getByRole('checkbox', { name: 'Só cor: Verde' })).toBeChecked();
    await fecharPainel(page);
    // Então
    const jose = page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    await expect(jose.getByRole('img', { name: 'Só cor: Verde' })).toBeVisible();
  });

  test('quando alguém tenta criar uma etiqueta com o mesmo texto de outra, então o SEMPER avisa e não cria', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    await criarEtiqueta(page, 'Urgência do cliente', 'Vermelho');
    // Quando
    const form = painel(page).getByRole('form', { name: 'Nova etiqueta' });
    await form.getByLabel('Texto').fill('urgencia do CLIENTE');
    await form.getByRole('button', { name: 'Criar etiqueta' }).click();
    // Então
    await expect(form.getByRole('alert')).toHaveText('Já existe uma etiqueta com esse texto.');
    await expect(painel(page).getByRole('list', { name: 'Etiquetas do escritório' }).getByRole('listitem')).toHaveCount(1);
  });

  test('quando a pessoa filtra por uma etiqueta, então só vê os cartões com ela', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    await criarEtiqueta(page, 'Urgência do cliente', 'Vermelho');
    await fecharPainel(page);
    await page.goto('/pessoas/');
    // Quando
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Etiqueta').selectOption({ label: 'Urgência do cliente' });
    // Então
    await expect(page.getByText('JOSÉ DA SILVA TESTE').first()).toBeVisible();
    await expect(page.getByText('PAULO HENRIQUE SIMULADO')).toHaveCount(0);
  });

  test('quando a etiqueta é desmarcada no cartão, então ela sai dele, mas continua na lista do escritório', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    await criarEtiqueta(page, 'Urgência do cliente', 'Vermelho');
    // Quando
    await painel(page).getByRole('checkbox', { name: 'Urgência do cliente' }).uncheck();
    // Então
    await expect(painel(page).getByRole('checkbox', { name: 'Urgência do cliente' })).not.toBeChecked();
    await fecharPainel(page);
    await expect(page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).getByText('Urgência do cliente')).toHaveCount(0);
  });

  test('quando a pessoa aperta Esc no painel, então fecha só o painel, e o foco volta ao botão', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    await page.getByRole('button', { name: 'Escolher etiquetas' }).click();
    await expect(painel(page)).toBeVisible();
    // Quando
    await page.keyboard.press('Escape');
    // Então
    await expect(painel(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Escolher etiquetas' })).toBeFocused();
  });

  test('quando a pessoa passa o mouse na etiqueta do cartão no quadro e clica no x, então ela sai, e o cartão não abre', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    await criarEtiqueta(page, 'Urgência do cliente', 'Vermelho');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Fechar' }).first().click();
    const jose = page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    const selo = jose.getByText('Urgência do cliente');
    await expect(selo).toBeVisible();
    // Quando
    await selo.hover();
    await jose.getByRole('button', { name: 'Tirar a etiqueta Urgência do cliente' }).click();
    // Então
    await expect(selo).toHaveCount(0);
    await expect(page).toHaveURL(/\/pessoas\/$/);
  });

  test('quando a pessoa tira a etiqueta pelo teclado, então ela sai, e o cartão não abre', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    await criarEtiqueta(page, 'Urgência do cliente', 'Vermelho');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Fechar' }).first().click();
    const jose = page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    // Quando
    await jose.getByRole('button', { name: 'Tirar a etiqueta Urgência do cliente' }).focus();
    await page.keyboard.press('Enter');
    // Então
    await expect(jose.getByText('Urgência do cliente')).toHaveCount(0);
    await expect(page).toHaveURL(/\/pessoas\/$/);
  });

  test('quando a pessoa filtra por etiqueta no quadro, então o total da página acompanha', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    await criarEtiqueta(page, 'Urgência do cliente', 'Vermelho');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Fechar' }).first().click();
    // Quando
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Etiqueta').selectOption({ label: 'Urgência do cliente' });
    // Então
    await expect(page.getByText('1 ativa', { exact: true })).toBeVisible();
  });

  test('quando a etiqueta do filtro é excluída, então o filtro desliga e a lista volta', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    await criarEtiqueta(page, 'Urgência do cliente', 'Vermelho');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Fechar' }).first().click();
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Etiqueta').selectOption({ label: 'Urgência do cliente' });
    await expect(page.getByText('1 ativa', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    // Quando
    await page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    await page.getByRole('button', { name: 'Escolher etiquetas' }).click();
    await painel(page).getByRole('button', { name: 'Mudar a etiqueta Urgência do cliente' }).click();
    const form = painel(page).getByRole('form', { name: 'Mudar a etiqueta Urgência do cliente' });
    await form.getByRole('button', { name: 'Excluir' }).click();
    await form.getByRole('button', { name: 'Confirmar exclusão' }).click();
    // Então
    await expect(page.getByText('28 ativas', { exact: true })).toBeVisible();
  });

  test('quando o painel cresce no celular, então o botão de criar continua dentro da tela', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    await page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    await page.getByRole('button', { name: 'Escolher etiquetas' }).click();
    const form = painel(page).getByRole('form', { name: 'Nova etiqueta' });
    // Quando
    for (const texto of ['Um', 'Dois', 'Três']) {
      await form.getByLabel('Texto').fill(texto);
      await form.getByRole('button', { name: 'Criar etiqueta' }).click();
      await expect(painel(page).getByRole('checkbox', { name: texto })).toBeChecked();
    }
    // Então
    await expect(form.getByRole('button', { name: 'Criar etiqueta' })).toBeInViewport();
  });

  test('quando a pessoa seleciona cartões na tabela e aplica uma etiqueta, então ela vale para todos; depois, tira de todos', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    await criarEtiqueta(page, 'Prioridade', 'Roxo');
    await painel(page).getByRole('checkbox', { name: 'Prioridade' }).uncheck();
    await page.keyboard.press('Escape');
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    const linha = (nome: string) => page.getByRole('row').filter({ hasText: nome });
    await linha('JOSÉ DA SILVA TESTE').getByRole('checkbox').check();
    await linha('MARIA APARECIDA EXEMPLO').getByRole('checkbox').check();
    // Quando
    await page.getByRole('button', { name: 'Etiquetas', exact: true }).click();
    const lote = page.getByRole('dialog', { name: 'Etiquetas dos selecionados' });
    await lote.getByRole('button', { name: 'Aplicar a etiqueta Prioridade' }).click();
    // Então
    await expect(page.getByText('Etiqueta "Prioridade" aplicada em 2 cartões.')).toBeVisible();
    await expect(linha('JOSÉ DA SILVA TESTE').getByText('Prioridade')).toBeVisible();
    await expect(linha('MARIA APARECIDA EXEMPLO').getByText('Prioridade')).toBeVisible();
    await expect(linha('PAULO HENRIQUE SIMULADO').getByText('Prioridade')).toHaveCount(0);
    // Quando
    await page.getByRole('button', { name: 'Etiquetas', exact: true }).click();
    await lote.getByRole('button', { name: 'Tirar a etiqueta Prioridade' }).click();
    // Então
    await expect(linha('JOSÉ DA SILVA TESTE').getByText('Prioridade')).toHaveCount(0);
    await expect(linha('MARIA APARECIDA EXEMPLO').getByText('Prioridade')).toHaveCount(0);
  });

  test('quando a etiqueta é mudada ou excluída, então isso vale para os cartões', async ({ page }) => {
    // Dado
    await abrirCartaoDoJose(page);
    await criarEtiqueta(page, 'Urgencia', 'Vermelho');
    const jose = page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    // Quando: muda o texto
    await painel(page).getByRole('button', { name: 'Mudar a etiqueta Urgencia' }).click();
    const form = painel(page).getByRole('form', { name: 'Mudar a etiqueta Urgencia' });
    await form.getByLabel('Texto').fill('Prioridade');
    await form.getByRole('button', { name: 'Salvar etiqueta' }).click();
    // Então
    await expect(painel(page).getByRole('checkbox', { name: 'Prioridade' })).toBeChecked();
    await expect(jose.getByText('Prioridade')).toBeVisible();
    // Quando: exclui
    await painel(page).getByRole('button', { name: 'Mudar a etiqueta Prioridade' }).click();
    const formDois = painel(page).getByRole('form', { name: 'Mudar a etiqueta Prioridade' });
    await formDois.getByRole('button', { name: 'Excluir' }).click();
    await formDois.getByRole('button', { name: 'Confirmar exclusão' }).click();
    // Então
    await expect(painel(page).getByRole('list', { name: 'Etiquetas do escritório' })).toHaveCount(0);
    await expect(jose.getByText('Prioridade')).toHaveCount(0);
  });

  test.describe('quando uma etiqueta é criada em Pessoas, então ela serve para os outros módulos', () => {
    for (const modulo of ['Contratos', 'Demandas', 'Tarefas']) {
      test(`em ${modulo}: aplicada num cartão, ele aparece com ela, e o filtro mostra só ele`, async ({ page }) => {
        // Dado
        await abrirCartaoDoJose(page);
        await criarEtiqueta(page, 'Urgência do cliente', 'Vermelho');
        await fecharPainel(page);
        await page.getByRole('button', { name: 'Fechar' }).first().click();
        await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: modulo, exact: true }).click();
        await expect(page.getByRole('heading', { name: modulo, level: 1 })).toBeVisible();
        await page.getByRole('button', { name: 'Kanban' }).click();
        const cartoes = page.getByRole('region', { name: 'Quadro' }).getByRole('listitem');
        await expect.poll(() => cartoes.count()).toBeGreaterThan(1);
        // Quando
        await cartoes.first().click();
        await page.getByRole('button', { name: 'Escolher etiquetas' }).click();
        await painel(page).getByRole('checkbox', { name: 'Urgência do cliente' }).check();
        await fecharPainel(page);
        await page.getByRole('button', { name: 'Fechar' }).first().click();
        // Então
        await expect(cartoes.first().getByText('Urgência do cliente')).toBeVisible();
        // Quando
        await page.getByRole('button', { name: 'Filtros' }).click();
        await page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Etiqueta').selectOption({ label: 'Urgência do cliente' });
        // Então
        await expect(cartoes).toHaveCount(1);
        await expect(cartoes.first().getByText('Urgência do cliente')).toBeVisible();
      });
    }
  });
});
