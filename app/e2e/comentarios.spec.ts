// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Comentários com @ nos cartões. No banco fictício, quem está logado é o Mauro (administrador e advogado); a Ana é
// advogada e o Bruno, estagiário. JOSÉ DA SILVA TESTE já tem um comentário da Ana.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

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
    await abrirSecao(page.getByRole('dialog'), 'Comentários');
    const caixa = page.getByRole('textbox', { name: 'Escrever um comentário' });
    // Quando
    await caixa.fill('Pedir os documentos a @br');
    await page.getByRole('option', { name: /Bruno Exemplo Souza/ }).click();
    await expect(caixa).toHaveValue('Pedir os documentos a @bruno.souza ');
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
    await abrirSecao(page.getByRole('dialog'), 'Comentários');
    const caixa = page.getByRole('textbox', { name: 'Escrever um comentário' });
    // Quando
    await caixa.fill('Veja isto, @');
    // Então
    const bruno = page.getByRole('option', { name: /Bruno Exemplo Souza/ });
    await expect(bruno).toHaveAttribute('aria-disabled', 'true');
    await expect(bruno).toContainText('em contratos, só advogados');
    await expect(page.getByRole('option', { name: /Ana Teste Lima/ })).toHaveAttribute('aria-disabled', 'false');
  });

  test('quando a lista do @ abre, então cada pessoa tem a bolinha redonda das iniciais, do tamanho normal', async ({ page }) => {
    // Dado: a seção de comentários aberta (se a pessoa a deixou recolhida, abre)
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    const secao = page.getByRole('dialog').getByRole('button', { name: /^Comentários/ });
    if (await secao.getAttribute('aria-expanded') === 'false') await secao.click();
    // Quando
    await page.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Veja isto, @');
    // Então
    const bolinha = page.getByRole('option', { name: /Bruno Exemplo Souza/ }).getByLabel('Bruno Exemplo Souza', { exact: true });
    const medida = await bolinha.boundingBox();
    expect(Math.round(medida!.width)).toBe(Math.round(medida!.height));
  });

  test('quando o autor edita o comentário, então o texto muda e aparece "(editado)"', async ({ page }) => {
    // Dado
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    await abrirSecao(page.getByRole('dialog'), 'Comentários');
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
    await abrirSecao(page.getByRole('dialog'), 'Comentários');
    const daAna = page.getByRole('listitem', { name: 'Comentário de Ana Teste Lima' });
    await expect(daAna.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    // Quando
    await daAna.getByRole('button', { name: 'Excluir' }).click();
    await daAna.getByRole('button', { name: 'Confirmar exclusão' }).click();
    // Então
    await expect(daAna).toHaveCount(0);
    await expect(page.getByText('Nenhum comentário ainda.', { exact: false })).toBeVisible();
  });

  // Desde o pedido do dono de 18/11, os comentários na coluna da direita são uma seção que recolhe, aberta de início, com o
  // "Recolher tudo" / "Expandir tudo" no topo da coluna (antes, um bloco fixo, que não recolhia). Desde a #360, a coluna também tem
  // "Anotações" e "Histórico de alterações", que começam recolhidas: o botão começa como "Expandir tudo" e, depois de abrir as três,
  // o "Recolher tudo" fecha todas, os comentários também.
  test('quando o cartão abre no centro, então os comentários ficam na coluna da direita, abertos, e o "Recolher tudo" do topo dela os recolhe', async ({ page }) => {
    // Dado
    await abrirCartao(page, '/pessoas/', 'JOSÉ DA SILVA TESTE');
    // Quando
    await page.getByRole('button', { name: 'Abrir no centro da tela' }).click();
    // Então
    const janela = page.getByRole('dialog');
    const secao = janela.getByRole('button', { name: /^Comentários/ });
    await expect(secao).toHaveAttribute('aria-expanded', 'true');
    const caixa = janela.getByRole('textbox', { name: 'Escrever um comentário' });
    await expect(caixa).toBeVisible();
    await expect.poll(async () => {
      const [fora, lado] = await Promise.all([janela.boundingBox(), caixa.boundingBox()]);
      return lado!.x > fora!.x + fora!.width / 2;
    }).toBe(true);
    // Quando: o botão do topo da coluna, na linha dos botões da janela (#397), abre todas e, depois, recolhe todas
    const daColuna = janela.getByRole('group', { name: 'Botões da janela' });
    await daColuna.getByRole('button', { name: 'Expandir tudo' }).click();
    await expect(janela.getByRole('button', { name: /^Histórico de alterações/ })).toHaveAttribute('aria-expanded', 'true');
    await daColuna.getByRole('button', { name: 'Recolher tudo' }).click();
    // Então
    await expect(secao).toHaveAttribute('aria-expanded', 'false');
    await expect(caixa).toBeHidden();
  });
});
