// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Arquivados à vista em todos os módulos: a coluna fixa "Arquivados" no fim do quadro e a seção recolhível
// "Arquivados" embaixo da tabela. Na semente do banco fictício, "Renovar a procuração" é uma tarefa em "Para fazer" e o
// contrato de MARIA APARECIDA EXEMPLO está ativo. Quem está logado é o Mateus (administrador).
import { expect, test } from '@playwright/test';

test.describe('Arquivados no quadro', () => {
  // Tela bem larga: as colunas de "Para fazer" até "Arquivados" ficam todas à vista, para arrastar entre elas.
  test.use({ viewport: { width: 2400, height: 1000 } });

  test('quando a pessoa arrasta um cartão para "Arquivados", então ele é arquivado; arrastado de volta, volta para a coluna', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const arquivados = page.getByRole('list', { name: 'Arquivados', exact: true });
    const titulos = await page.getByRole('region', { name: 'Quadro' }).getByRole('heading', { level: 3 }).allTextContents();
    expect(titulos.at(-1)).toBe('Arquivados');
    await expect(arquivados.getByText('Nenhum item.')).toBeVisible();
    // Quando
    await page.getByRole('list', { name: 'Para fazer', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' }).dragTo(arquivados);
    // Então
    await expect(arquivados.getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toBeVisible();
    await expect(page.getByText('F00D1234 foi para Arquivados.')).toBeVisible();
    // Quando: de volta, para "Fazendo"
    const fazendo = page.getByRole('list', { name: 'Fazendo', exact: true });
    await arquivados.getByRole('listitem').filter({ hasText: 'Renovar a procuração' }).dragTo(fazendo);
    // Então
    await expect(page.getByText('F00D1234 saiu de Arquivados e foi para "Fazendo".')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('list', { name: 'Fazendo', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Arquivados', exact: true }).getByRole('listitem').filter({ hasText: 'Renovar a procuração' })).toHaveCount(0);
  });
});

test.describe('Arquivados na tabela', () => {
  test('quando a pessoa arquiva um contrato, então ele sai da tabela e aparece em "Arquivados" embaixo dela, de onde volta ao desarquivar', async ({ page }) => {
    // Dado
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    const maria = page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' });
    // Quando
    await maria.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
    // Então: a seção mostra quantos há, mesmo fechada, e ao abrir mostra o contrato
    const secao = page.getByRole('button', { name: /^Arquivados/ });
    await expect(secao).toContainText('1');
    await expect(maria).toHaveCount(0);
    await secao.click();
    await expect(maria).toHaveCount(1);
    // Quando
    await maria.getByRole('checkbox').check();
    await page.getByRole('group', { name: 'Ações nos arquivados selecionados' }).getByRole('button', { name: 'Desarquivar' }).click();
    // Então
    await expect(page.getByText('1 contrato voltou para a lista.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' })).toHaveCount(1);
    await expect(secao).not.toContainText('1');
  });
});

test.describe('Botões do cartão arquivado', () => {
  // Em cada módulo, um item ativo da semente do banco fictício. Quem está logado é administrador, então pode excluir.
  const CARTOES = [
    { modulo: 'pessoas', item: 'MARIA APARECIDA EXEMPLO', titulo: 'Excluir a pessoa?' },
    { modulo: 'contratos', item: 'MARIA APARECIDA EXEMPLO', titulo: 'Excluir o contrato?' },
    { modulo: 'demandas', item: 'Notificar o devedor', titulo: 'Excluir a demanda?' },
    { modulo: 'tarefas', item: 'Renovar a procuração', titulo: 'Excluir a tarefa?' },
    { modulo: 'processos/judicial', item: 'JOSÉ DA SILVA TESTE', titulo: 'Excluir o processo?' },
    { modulo: 'agenda', item: 'Reunião de equipe', titulo: 'Excluir o compromisso?' }
  ];

  for (const { modulo, item, titulo } of CARTOES) {
    test(`quando a pessoa arquiva e desarquiva em ${modulo}, então os botões do cartão acompanham, e a lixeira pede confirmação`, async ({ page }) => {
      // Dado
      await page.goto(`/${modulo}/`);
      await page.getByRole('button', { name: 'Tabela' }).click();
      await page.getByRole('row').filter({ hasText: item }).first().getByText(item).first().click();
      const cartao = page.getByRole('dialog');
      const botao = (name: string) => cartao.getByRole('button', { name, exact: true });
      // Quando
      await botao('Arquivar').click();
      // Então
      await expect(botao('Desarquivar')).toBeVisible();
      await expect(botao('Excluir')).toBeVisible();
      await expect(botao('Editar')).toHaveCount(0);
      await expect(botao('Arquivar')).toHaveCount(0);
      // Quando: a lixeira, cancelando na janela
      await botao('Excluir').click();
      const janela = page.getByRole('dialog', { name: titulo });
      await expect(janela).toContainText('não pode ser desfeita');
      await janela.getByRole('button', { name: 'Cancelar' }).click();
      // Então: nada foi excluído
      await expect(janela).toHaveCount(0);
      await expect(botao('Desarquivar')).toBeVisible();
      // Quando
      await botao('Desarquivar').click();
      // Então
      await expect(botao('Arquivar')).toBeVisible();
      await expect(botao('Editar')).toBeVisible();
      await expect(botao('Excluir')).toHaveCount(0);
    });
  }
});
