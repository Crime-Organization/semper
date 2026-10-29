// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Comentários com @ nos cartões. No banco fictício, quem está logado é o Mateus (administrador e advogado); a Ana é
// advogada e o Bruno, estagiário. JOSÉ DA SILVA TESTE já tem um comentário da Ana.
import { expect, test, type Page } from '@playwright/test';

/** Abre o cartão de uma linha da tabela do módulo. */
async function abrirCartao(page: Page, endereco: string, texto: string) {
  await page.goto(endereco);
  await page.getByRole('row').filter({ hasText: texto }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
const comentarios = (page: Page) => page.getByRole('list', { name: 'Comentários do cartão' }).getByRole('listitem');

test.describe('Comentários com @', () => {
  test('quando alguém comenta marcando um colega pelo @, então o comentário aparece no topo, com a menção destacada', async ({ page }) => {
    // Dado
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    const caixa = page.getByRole('textbox', { name: 'Escrever um comentário' });
    // Quando
    await caixa.fill('Pedir os documentos a @br');
    await page.getByRole('option', { name: /Bruno Exemplo Souza/ }).click();
    await caixa.press('End');
    await caixa.pressSequentially('até sexta.');
    await page.getByRole('button', { name: 'Comentar' }).click();
    // Então
    await expect(comentarios(page).first()).toContainText('Pedir os documentos a @bruno.souza até sexta.');
    await expect(comentarios(page).first().getByText('@bruno.souza', { exact: true })).toBeVisible();
    await expect(caixa).toHaveValue('');
  });

  test('quando o comentário é num contrato, então quem não é advogado aparece desligado na lista do @', async ({ page }) => {
    // Dado
    await abrirCartao(page, '/contratos/', 'JOSÉ DA SILVA TESTE');
    const caixa = page.getByRole('textbox', { name: 'Escrever um comentário' });
    // Quando
    await caixa.fill('Veja isto, @');
    // Então
    const bruno = page.getByRole('option', { name: /Bruno Exemplo Souza/ });
    await expect(bruno).toHaveAttribute('aria-disabled', 'true');
    await expect(bruno).toContainText('em contratos, só advogados');
    await expect(page.getByRole('option', { name: /Ana Teste Lima/ })).toHaveAttribute('aria-disabled', 'false');
  });

  test('quando o autor edita o comentário, então o texto muda e aparece "(editado)"', async ({ page }) => {
    // Dado
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    await page.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Primeira versão');
    await page.getByRole('button', { name: 'Comentar' }).click();
    const meu = comentarios(page).filter({ hasText: 'Primeira versão' });
    // Quando
    await meu.getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('textbox', { name: 'Editar o comentário' }).fill('Segunda versão');
    await page.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(comentarios(page).first()).toContainText('Segunda versão');
    await expect(comentarios(page).first()).toContainText('(editado)');
  });

  test('quando o administrador apaga o comentário de outra pessoa, então ele some; editar não aparece para ele', async ({ page }) => {
    // Dado
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    const daAna = page.getByRole('listitem', { name: 'Comentário de Ana Teste Lima' });
    await expect(daAna.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    // Quando
    await daAna.getByRole('button', { name: 'Excluir' }).click();
    await daAna.getByRole('button', { name: 'Confirmar exclusão' }).click();
    // Então
    await expect(daAna).toHaveCount(0);
    await expect(page.getByText('Nenhum comentário ainda.', { exact: false })).toBeVisible();
  });

  test('quando o cartão abre no centro, então os comentários ficam na coluna da direita', async ({ page }) => {
    // Dado
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    // Quando
    await page.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    // Então
    const coluna = page.getByRole('region', { name: 'Comentários' });
    await expect(coluna.getByRole('textbox', { name: 'Escrever um comentário' })).toBeVisible();
    await expect.poll(async () => {
      const [janela, lado] = await Promise.all([page.getByRole('dialog').boundingBox(), coluna.boundingBox()]);
      return lado!.x > janela!.x + janela!.width / 2;
    }).toBe(true);
  });
});
