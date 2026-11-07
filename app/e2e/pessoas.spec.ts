// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

// CPF válido que não está na semente do banco fictício. O 529.982.247-25 é de JOSÉ DA SILVA TESTE.
const CPF_LIVRE = '286.255.878-87';
const CPF_DE_JOSE = '529.982.247-25';

/** Preenche as duas primeiras etapas de uma pessoa física e para na etapa "Pessoa física". */
async function comecarPessoaFisica(page: Page, nome: string) {
  await page.goto('/pessoas/nova/');
  // As opções são clicadas pelo texto, como a pessoa faz (o botão de rádio fica escondido sob o rótulo).
  // Escolher o tipo já leva à etapa seguinte.
  await page.getByText('Pessoa física', { exact: true }).click();
  await expect(page.getByLabel('Nome')).toBeVisible();
  await page.getByLabel('Nome').fill(nome);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByRole('heading', { name: 'Pessoa física' })).toBeVisible();
  await page.getByText('Feminino', { exact: true }).click();
}

test.describe('Cadastro de pessoas', () => {
  test('quando a pessoa cadastra uma pessoa física com CPF válido, então ela aparece na lista com o nome em maiúsculas e o CPF formatado', async ({ page }) => {
    // Dado
    await comecarPessoaFisica(page, 'maria teste e2e');
    await page.getByLabel('CPF').fill(CPF_LIVRE.replace(/\D/g, ''));
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByRole('heading', { name: 'Endereço' })).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('textbox', { name: 'Telefone' }).fill('38999990000');
    // Quando
    await page.getByRole('button', { name: 'Salvar cadastro' }).click();
    // Então
    await expect(page).toHaveURL(/\/pessoas\/\?id=/);
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('searchbox').fill('maria teste e2e');
    const linha = page.getByRole('row').filter({ hasText: 'MARIA TESTE E2E' });
    await expect(linha).toContainText(CPF_LIVRE);
  });

  test('quando o CPF tem um dígito errado, então o formulário avisa e não segue', async ({ page }) => {
    // Dado
    await comecarPessoaFisica(page, 'cpf errado');
    // Quando
    await page.getByLabel('CPF').fill('52998224726');
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('CPF inválido: confira os números.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pessoa física' })).toBeVisible();
  });

  test('quando o CPF já é de outra pessoa cadastrada, então o formulário avisa quem é', async ({ page }) => {
    // Dado
    await comecarPessoaFisica(page, 'cpf repetido');
    // Quando
    await page.getByLabel('CPF').fill(CPF_DE_JOSE.replace(/\D/g, ''));
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByRole('dialog')).toContainText('JOSÉ DA SILVA TESTE');
  });
});

test.describe('Lista de pessoas', () => {
  test('quando a pessoa busca parte de um nome, então só aparecem os cadastros que batem', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Quando
    await page.getByRole('searchbox').fill('aparecida');
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'APARECIDA DE FÁTIMA ENSAIO' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' })).toHaveCount(0);
  });

  test('quando a pessoa troca para tabela e sai da tela, então a tabela continua escolhida ao voltar', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    // Quando
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Início', exact: true }).click();
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Pessoas', exact: true }).click();
    // Então
    await expect(page.getByRole('button', { name: 'Tabela' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('Cartão da pessoa', () => {
  test('quando abre a seção da qualificação, então "Copiar qualificação" fica junto do texto, e não nas ações do topo', async ({ page, context }) => {
    // Dado
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/pessoas/');
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    const cartao = page.getByRole('dialog');
    // A qualificação recolhe como as outras seções.
    await abrirSecao(cartao, 'Qualificação');
    const copiar = cartao.getByRole('button', { name: 'Copiar qualificação' });
    // Então: o botão vem depois do título "Qualificação" e do texto, bem abaixo do lápis do topo
    const [titulo, botao, atualizar] = await Promise.all([
      cartao.getByRole('heading', { name: 'Qualificação' }).boundingBox(), copiar.boundingBox(),
      cartao.getByRole('button', { name: 'Editar' }).boundingBox()
    ]);
    expect(botao!.y).toBeGreaterThan(titulo!.y);
    expect(botao!.y).toBeGreaterThan(atualizar!.y + atualizar!.height);
    // Quando
    await copiar.click();
    // Então
    await expect(page.getByText('Qualificação copiada.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('JOSÉ DA SILVA TESTE');
  });
});
