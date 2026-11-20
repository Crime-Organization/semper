// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Nomes das colunas e dos grupos sempre em maiúsculas (#386): no quadro, nas tabelas, nos menus e nos filtros. Muda só o que
// aparece: o nome guardado continua como foi digitado. No banco fictício, o quadro de Tarefas tem "Para fazer", "Fazendo",
// "Aguardando retorno" e "Concluída", sem grupos; "Renovar a procuração" está em "Para fazer". Quem está logado é o Mateus
// (administrador). No quadro e nas peças de texto a caixa alta vem do CSS: por isso se confere o texto mostrado (innerText).
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 2000, height: 1000 } });

async function quadroDeTarefas(page: Page) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Kanban' }).click();
}

test.describe('Nomes das colunas e dos grupos em maiúsculas', () => {
  test('dado um grupo de colunas no quadro, quando ele está aberto ou recolhido, então o nome dele aparece em maiúsculas, como o das colunas', async ({ page }) => {
    // Dado
    await quadroDeTarefas(page);
    await page.getByLabel('Novo grupo').fill('Aguardado');
    await page.getByRole('button', { name: 'Criar grupo' }).click();
    // Então: aberto
    const fechar = page.getByRole('button', { name: 'Fechar o grupo Aguardado' });
    await expect(fechar).toHaveText('AGUARDADO', { useInnerText: true });
    await expect(page.getByRole('region', { name: 'Quadro' }).getByRole('heading', { name: 'Fazendo', exact: true })).toHaveText('FAZENDO', { useInnerText: true });
    // Quando
    await fechar.click();
    // Então: recolhido
    await expect(page.getByRole('button', { name: /^Abrir o grupo Aguardado/ })).toHaveText(/AGUARDADO/, { useInnerText: true });
  });

  test('dado um grupo, quando a pessoa cria uma coluna e escolhe o grupo dela, então o menu "Grupo da coluna" mostra o nome em maiúsculas', async ({ page }) => {
    // Dado
    await quadroDeTarefas(page);
    await page.getByLabel('Novo grupo').fill('Aguardado');
    await page.getByRole('button', { name: 'Criar grupo' }).click();
    // Então
    await expect(page.getByLabel('Grupo da coluna').getByRole('option')).toHaveText(['Sem grupo', 'AGUARDADO']);
  });

  test('dada a coluna Situação da tabela, quando ela mostra uma tarefa, então a situação aparece em maiúsculas', async ({ page }) => {
    // Quando
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Então
    await expect(page.getByRole('row').filter({ hasText: 'Renovar a procuração' }).getByText('PARA FAZER', { exact: true })).toBeVisible();
  });

  test('quando a pessoa abre o filtro de situações dos processos, então os nomes das colunas aparecem em maiúsculas', async ({ page }) => {
    // Dado
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Quando
    await page.getByRole('button', { name: 'Filtros' }).click();
    // Então
    const filtro = page.getByRole('dialog', { name: 'Filtros' }).getByLabel('Situação');
    await expect(filtro.getByRole('option', { name: 'DISTRIBUÍDO', exact: true })).toHaveCount(1);
    await expect(filtro.getByRole('option', { name: 'SEM SITUAÇÃO', exact: true })).toHaveCount(1);
    await expect(filtro.getByRole('option', { name: 'Distribuído', exact: true })).toHaveCount(0);
  });

  test('quando a pessoa abre o menu "Etapa do atendimento" da pessoa, então as etapas aparecem em maiúsculas', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Quando
    await page.getByRole('row').filter({ hasText: 'LUCIANA ROCHA AMOSTRA' }).click();
    // Então
    const etapa = page.getByRole('dialog').getByLabel('Etapa do atendimento');
    await expect(etapa.getByRole('option', { name: 'SEM ETAPA', exact: true })).toHaveCount(1);
    await expect(etapa.getByRole('option', { name: 'CONTRATO FECHADO', exact: true })).toHaveCount(1);
  });

  test('dada a renomeação de uma coluna com acento, quando a pessoa grava, então a tela mostra "EM ANÁLISE" e o nome guardado é o que ela digitou', async ({ page }) => {
    // Dado
    await quadroDeTarefas(page);
    await page.getByRole('button', { name: 'Opções da coluna Fazendo' }).click();
    await page.getByRole('menuitem', { name: 'Renomear' }).click();
    const janela = page.getByRole('dialog', { name: 'Renomear coluna' });
    await janela.getByLabel('Renomear coluna').fill('Em análise');
    // Quando
    await janela.getByRole('button', { name: 'Salvar' }).click();
    // Então: a tela em maiúsculas
    await expect(page.getByRole('region', { name: 'Quadro' }).getByRole('heading', { name: 'Em análise', exact: true })).toHaveText('EM ANÁLISE', { useInnerText: true });
    // Então: ao renomear de novo, a caixa traz o nome como foi guardado
    await page.getByRole('button', { name: 'Opções da coluna Em análise' }).click();
    await page.getByRole('menuitem', { name: 'Renomear' }).click();
    await expect(page.getByRole('dialog', { name: 'Renomear coluna' }).getByLabel('Renomear coluna')).toHaveValue('Em análise');
  });
});
