// Toda a equipe vê os cartões, sem os valores de contrato para quem não é parte (#271). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício, Bruno (estagiário, não é administrador) não é parte do contrato de JOSÉ DA SILVA TESTE, de Mauro,
// e não está na demanda "Busca de anterioridade".
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirSecao, acoesNoMenuDoCartao, entrarComo, menuDoCartao } from './ajudantes';

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
    // Sem o ⋯ (o Arquivar mora nele desde a #382): o caso de controle, de quem altera, está em "pode alterar", mais abaixo.
    await expect(menuDoCartao(cartao)).toHaveCount(0);
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
    await abrirSecao(cartao, 'Checklists');
    await expect(cartao.getByRole('button', { name: 'Adicionar checklist' })).toHaveCount(0);
  });

  test('dada a chave ligada e um checklist com grupos na demanda, quando quem não participa o abre, então vê os grupos, os números e as contagens, sem alterar (#309)', async ({ page }) => {
    // Dado: o Mauro põe o modelo agrupado na demanda
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Busca de anterioridade' }).click();
    await abrirSecao(page.getByRole('dialog'), 'Checklists');
    await page.getByRole('dialog').getByRole('button', { name: 'Adicionar checklist', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Benefício previdenciário' }).click();
    await expect(page.getByRole('dialog').getByRole('region', { name: 'Checklist Benefício previdenciário' })).toBeVisible();
    await ligarAChave(page);
    await entrarComo(page, 'u-bruno');
    // Quando
    await abrir(page, 'Demandas');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Busca de anterioridade' }).click();
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Checklists');
    const lista = cartao.getByRole('region', { name: 'Checklist Benefício previdenciário' });
    // Então
    const beneficio = lista.getByRole('button', { name: 'Fechar o grupo 2. Benefício' });
    await expect(beneficio).toHaveAccessibleDescription('0 de 3 feitos');
    await expect(lista.getByRole('checkbox', { name: 'CNIS' })).toHaveAccessibleDescription('2.1.1, no grupo 2. Benefício › 2.1 Aposentadoria por idade');
    await expect(lista.getByRole('checkbox', { name: 'CNIS' })).toBeDisabled();
    await expect(lista.getByRole('button', { name: /^(Ações do|Novo grupo|Adicionar item)/ })).toHaveCount(0);
    // Quando
    await beneficio.click();
    // Então
    await expect(lista.getByRole('button', { name: 'Abrir o grupo 2. Benefício' })).toBeVisible();
    await expect(lista.getByRole('checkbox', { name: 'CNIS' })).toHaveCount(0);
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
    // Então: o aviso diz onde a pessoa passa a aparecer (a equipe fica no topo do cartão, #382)
    await expect(page.getByText('Você entrou neste processo como colaborador (a equipe fica no topo do cartão).')).toBeVisible();
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
    // O lápis do topo (#382), com o nome que diz o que ele edita.
    await expect(cartao.getByRole('button', { name: 'Editar sem os valores' })).toHaveAttribute('data-dica', 'Editar sem os valores');
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
    expect(await acoesNoMenuDoCartao(page, cartao)).toEqual(['Arquivar']);
    await expect(cartao.getByRole('combobox', { name: 'Situação da demanda' })).toBeEnabled();
    await expect(cartao.getByText('toda a equipe vê este cartão', { exact: false })).toHaveCount(0);
  });

  test('dada a fase de adaptação, quando quem não participa muda a tarefa, então a mudança grava e ele não entra nela', async ({ page }) => {
    // Dado
    await page.goto('/configuracoes/');
    await page.getByRole('checkbox', { name: /Toda a equipe vê e edita tudo/ }).check();
    await expect(page.getByText('Fase de adaptação ligada', { exact: false })).toBeVisible();
    await entrarComo(page, 'u-bruno');
    await abrir(page, 'Tarefas');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Renovar a procuração' }).click();
    const cartao = page.getByRole('dialog');
    // Quando: muda o prazo no próprio cartão (desde a #361, ele não está mais no lápis) e salva o lápis
    await cartao.getByRole('button', { name: /^Prazo: / }).click();
    // (o cartão é achado como "dialog": com o calendário aberto, o formulário do prazo é achado pela página)
    const prazo = page.getByRole('group', { name: 'Mudar o prazo' }).getByRole('textbox', { name: 'Prazo', exact: true });
    await prazo.fill('15112030');
    await prazo.press('Enter');
    await expect(page.getByRole('group', { name: 'Mudar o prazo' })).toHaveCount(0);
    // Então
    await expect(cartao).toContainText('Prazo: 15/11/2030');
    await expect(page.getByRole('status').getByRole('button', { name: 'Desfazer' })).toBeVisible();
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await cartao.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(cartao.getByRole('form', { name: 'Editar tarefa' })).toHaveCount(0);
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await expect(cartao.getByRole('group', { name: 'Participantes' }).getByRole('button', { name: 'Tirar Bruno Exemplo Souza' })).toHaveCount(0);
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
