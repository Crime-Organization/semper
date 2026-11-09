// Toda a equipe vê os cartões, sem os valores de contrato para quem não é parte (#271). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício, Bruno (estagiário, não é administrador) não é parte do contrato de JOSÉ DA SILVA TESTE, de Mateus,
// e não está na demanda "Busca de anterioridade".
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirSecao, entrarComo } from './ajudantes';

async function ligarAChave(page: Page) {
  await page.goto('/inicio/');
  await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
}

test.describe('Toda a equipe vê os cartões', () => {
  test('dada a chave ligada, quando quem não é parte abre um contrato, então vê o contrato sem os valores e pode comentar', async ({ page }) => {
    // Dado
    await ligarAChave(page);
    await entrarComo(page, 'u-bruno');
    // Quando
    await abrir(page, 'Contratos');
    await page.getByRole('button', { name: 'Tabela' }).click();
    const linha = page.getByRole('row').filter({ hasText: 'Registro de marca' }).first();
    await expect(linha).toContainText('Oculto');
    await linha.click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByText('toda a equipe vê este contrato, sem os valores', { exact: false })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /Honorários/ })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: /Documento e observações/ })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: /Histórico de alterações/ })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Arquivar' })).toHaveCount(0);
    await expect(cartao.getByRole('combobox', { name: 'Situação do contrato' })).toBeDisabled();
    // Quando
    await abrirSecao(cartao, 'Comentários');
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Tenho uma dúvida');
    await cartao.getByRole('button', { name: 'Comentar' }).click();
    // Então
    await expect(cartao.getByRole('listitem', { name: /Comentário de/ }).first()).toContainText('Tenho uma dúvida');
  });

  test('dada a chave ligada, quando quem não participa abre uma demanda, então lê, mas não vê os botões de alterar', async ({ page }) => {
    // Dado
    await ligarAChave(page);
    await entrarComo(page, 'u-bruno');
    // Quando
    await abrir(page, 'Demandas');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Busca de anterioridade' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByText('toda a equipe vê este cartão', { exact: false })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(cartao.getByRole('combobox', { name: 'Situação da demanda' })).toBeDisabled();
    await abrirSecao(cartao, 'Listas');
    await expect(cartao.getByRole('button', { name: 'Adicionar lista' })).toHaveCount(0);
  });

  test('dada a chave ligada, quando um advogado sem vínculo entra no processo, então passa a poder alterar', async ({ page }) => {
    // Dado: Bruno, aqui como advogado, não está no processo
    await ligarAChave(page);
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { mudarFuncao(i: string, f: string): void } }).SEMPER_FALSO.mudarFuncao('u-bruno', 'advogado'));
    await entrarComo(page, 'u-bruno');
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: '0001234-97.2026.8.13.0024' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByText('Para alterar, entre nele.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    // Quando
    await cartao.getByRole('button', { name: 'Entrar como colaborador' }).click();
    // Então
    await expect(cartao.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(cartao.getByText('Para alterar, entre nele.')).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Assumir como responsável' })).toHaveCount(0);
  });

  test('dada a chave ligada, quando quem não é advogado abre o processo, então não vê as opções de entrar', async ({ page }) => {
    // Dado
    await ligarAChave(page);
    await entrarComo(page, 'u-bruno');
    // Quando
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: '0001234-97.2026.8.13.0024' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByText('toda a equipe vê este processo', { exact: false })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Entrar como colaborador' })).toHaveCount(0);
  });

  test('dada a fase de adaptação, quando quem não é parte edita o contrato, então muda o objeto sem ver os valores', async ({ page }) => {
    // Dado: o administrador liga em Configurações
    await page.goto('/configuracoes/');
    await page.getByRole('checkbox', { name: /Toda a equipe vê e edita tudo/ }).check();
    await expect(page.getByText('Fase de adaptação ligada', { exact: false })).toBeVisible();
    await entrarComo(page, 'u-bruno');
    // Quando
    await abrir(page, 'Contratos');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Registro de marca' }).first().click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('button', { name: /Honorários/ })).toHaveCount(0);
    await cartao.getByRole('button', { name: 'Editar sem os valores' }).click();
    // Então
    await expect(cartao.getByLabel('Valor do contrato')).toHaveCount(0);
    await expect(cartao.getByRole('group', { name: 'Clientes' })).toBeVisible();
    await expect(cartao.getByLabel('Advogado responsável')).toHaveCount(0);
    await expect(cartao.getByRole('group', { name: 'Participantes' })).toHaveCount(0);
    await cartao.getByRole('combobox', { name: 'Objeto 1' }).fill('Registro de marca atualizado');
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Contrato atualizado.')).toBeVisible();
  });

  test('dada a fase de adaptação, quando quem não participa abre a demanda, então pode alterar', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    await page.getByRole('checkbox', { name: /Toda a equipe vê e edita tudo/ }).check();
    await expect(page.getByText('Fase de adaptação ligada', { exact: false })).toBeVisible();
    await entrarComo(page, 'u-bruno');
    // Quando
    await abrir(page, 'Demandas');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Busca de anterioridade' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(cartao.getByRole('combobox', { name: 'Situação da demanda' })).toBeEnabled();
    await expect(cartao.getByText('toda a equipe vê este cartão', { exact: false })).toHaveCount(0);
  });

  test('dada a chave ligada, quando quem participa abre a demanda dele, então continua podendo alterar', async ({ page }) => {
    // Dado
    await ligarAChave(page);
    // Quando
    await abrir(page, 'Demandas');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Busca de anterioridade' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByText('toda a equipe vê este cartão', { exact: false })).toHaveCount(0);
    await expect(cartao.getByRole('combobox', { name: 'Situação da demanda' })).toBeEnabled();
  });
});
