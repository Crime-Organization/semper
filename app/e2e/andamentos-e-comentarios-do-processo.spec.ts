// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O cartão do processo com comentários e andamentos na coluna da direita (#362): o andamento é lançado com um tipo da lista pronta
// (despacho, decisão, sentença, intimação, petição, audiência), que aparece na caixa dele; "Mudar" e "Excluir" ficam no "⋯" à direita
// da caixa, que aparece ao passar o mouse e no foco do teclado; quem só lê o processo vê comentários e andamentos, sem o "⋯". Na
// semente do banco fictício, o processo judicial de JOSÉ DA SILVA TESTE é do Mateus (administrador, quem está logado), sem
// andamentos; o Bruno (estagiário) não está nele.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

const CLIENTE = 'JOSÉ DA SILVA TESTE';

/** Abre o processo judicial da semente pela tabela. */
async function abrirProcesso(page: Page) {
  await page.goto('/processos/judicial/');
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: CLIENTE }).first().click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByLabel('Situação do processo')).toBeVisible();
  return cartao;
}
/** Abre a seção dos andamentos (o título ganha "(n a tratar)" quando há intimação a tratar). */
async function abrirAndamentos(cartao: Locator) {
  const botao = cartao.getByRole('button', { name: /^Andamentos( \(\d+ a tratar\))?( \d+)?$/ });
  if (await botao.getAttribute('aria-expanded') === 'false') await botao.click();
  await expect(botao).toHaveAttribute('aria-expanded', 'true');
}
async function lancarAndamento(cartao: Locator, tipo: string, texto: string) {
  await cartao.getByRole('button', { name: 'Novo andamento' }).click();
  const form = cartao.getByRole('form', { name: 'Novo andamento' });
  await form.getByLabel('Tipo').selectOption({ label: tipo });
  await form.getByLabel('O que aconteceu').fill(texto);
  await form.getByRole('button', { name: 'Lançar andamento' }).click();
  await expect(form).toHaveCount(0);
}
const noCentro = (page: Page) => page.getByRole('button', { name: 'Abrir no centro da tela' }).click();
const andamentos = (cartao: Locator) => cartao.getByRole('list', { name: 'Andamentos do processo' });

test.describe('Andamentos com tipo e comentários no processo (#362)', () => {
  test('dado o cartão de um processo no centro, quando abre, então a coluna tem comentários, andamentos, anotações e histórico, nesta ordem, só os comentários abertos', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    // Quando
    await noCentro(page);
    // Então
    await expect(cartao.getByRole('button', { name: /^(Comentários|Andamentos|Anotações|Histórico de alterações)/ }))
      .toHaveText([/^Comentários\s*\d+$/, /^Andamentos\s*\d+$/, /^Anotações\s*\d+$/, /^Histórico de alterações\s*\d+$/]);
    await expect(cartao.getByRole('button', { name: /^Comentários/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(cartao.getByRole('button', { name: /^Andamentos/ })).toHaveAttribute('aria-expanded', 'false');
  });

  test('quando lança uma decisão, então escolhe o tipo na lista pronta, ele aparece na caixa do andamento e vai para o histórico', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    await abrirAndamentos(cartao);
    await cartao.getByRole('button', { name: 'Novo andamento' }).click();
    const tipos = cartao.getByRole('form', { name: 'Novo andamento' }).getByLabel('Tipo').getByRole('option');
    await expect(tipos).toHaveText(['Escolha o tipo', 'Despacho', 'Decisão', 'Sentença', 'Intimação', 'Petição', 'Audiência']);
    await cartao.getByRole('button', { name: 'Cancelar' }).click();
    // Quando
    await lancarAndamento(cartao, 'Decisão', 'Deferida a tutela de urgência.');
    // Então
    await expect(page.getByText('Decisão lançada.')).toBeVisible();
    const caixa = andamentos(cartao).getByRole('listitem', { name: /^Decisão de / });
    await expect(caixa).toContainText('Deferida a tutela de urgência.');
    await abrirSecao(cartao, 'Histórico de alterações');
    await expect(cartao.getByText(/Decisão de \d{2}\/\d{2}\/\d{4}: Deferida a tutela de urgência\./).first()).toBeVisible();
  });

  test('dada a caixa de um andamento, quando a pessoa passa o mouse ou chega pelo teclado, então vê o "⋯", com "Mudar" e "Excluir"', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    await noCentro(page);
    await abrirAndamentos(cartao);
    await lancarAndamento(cartao, 'Despacho', 'Cite-se.');
    const caixa = andamentos(cartao).getByRole('listitem', { name: /^Despacho de / });
    const mais = caixa.getByRole('button', { name: /^Ações do andamento: Despacho de / });
    await page.mouse.move(0, 0);
    await expect(mais).toHaveCSS('opacity', '0');
    // Quando: passa o mouse
    await caixa.hover();
    // Então
    await expect(mais).toHaveCSS('opacity', '1');
    // Quando: chega pelo teclado
    await page.mouse.move(0, 0);
    await mais.focus();
    // Então
    await expect(mais).toHaveCSS('opacity', '1');
    // Quando: abre o menu e muda para sentença
    await mais.click();
    const menu = page.getByRole('menu', { name: /^Ações do andamento: Despacho de / });
    await expect(menu.getByRole('menuitem')).toHaveText(['Mudar', 'Excluir']);
    await menu.getByRole('menuitem', { name: 'Mudar' }).click();
    const form = cartao.getByRole('form', { name: 'Mudar andamento' });
    await expect(form.getByLabel('Tipo')).toHaveValue('despacho');
    await form.getByLabel('Tipo').selectOption({ label: 'Sentença' });
    await form.getByRole('button', { name: 'Salvar andamento' }).click();
    // Então
    await expect(andamentos(cartao).getByRole('listitem', { name: /^Sentença de / })).toContainText('Cite-se.');
    // Quando: exclui pelo menu
    await andamentos(cartao).getByRole('button', { name: /^Ações do andamento: Sentença de / }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    // Então: sai da lista, e o Desfazer o devolve
    await expect(andamentos(cartao).getByRole('listitem')).toHaveCount(0);
    await page.getByRole('button', { name: 'Desfazer' }).last().click();
    await expect(andamentos(cartao).getByRole('listitem', { name: /^Sentença de / })).toBeVisible();
  });

  test('quando comenta no processo, no centro, então o comentário aparece na coluna, com a menção; quem não está no processo não pode ser mencionado', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    await noCentro(page);
    const caixa = cartao.getByRole('textbox', { name: 'Escrever um comentário' });
    // Quando: começa a mencionar o Bruno, que não está no processo
    await caixa.fill('@bru');
    // Então: a lista do @ diz por que não
    await expect(page.getByRole('option', { name: /Bruno/ })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('option', { name: /Bruno/ })).toContainText('não participa; inclua como colaborador');
    // Quando: comenta mencionando a Ana, administradora
    await caixa.fill('Preparar a réplica, @ana.lima, até sexta');
    await cartao.getByRole('button', { name: 'Comentar' }).click();
    // Então
    const comentario = cartao.getByRole('list', { name: 'Comentários do cartão' }).getByRole('listitem').first();
    await expect(comentario).toContainText('Preparar a réplica, @ana.lima, até sexta');
    await expect(comentario.getByText('@ana.lima', { exact: true })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Comentários/ })).toHaveText(/^Comentários\s*1$/);
  });

  test('dado quem só lê o processo, quando abre o cartão, então lê comentários e andamentos e comenta, mas não vê o "⋯" nem lança andamento', async ({ page }) => {
    // Dado: o Mateus lança um andamento e comenta; a chave "toda a equipe vê" está ligada, e o Bruno não está no processo
    let cartao = await abrirProcesso(page);
    await abrirAndamentos(cartao);
    await lancarAndamento(cartao, 'Petição', 'Juntada a contestação.');
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Contestação juntada.');
    await cartao.getByRole('button', { name: 'Comentar' }).click();
    await expect(cartao.getByRole('list', { name: 'Comentários do cartão' })).toContainText('Contestação juntada.');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { equipeVeTudo(l: boolean): void } }).SEMPER_FALSO.equipeVeTudo(true));
    await entrarComo(page, 'u-bruno');
    // Quando
    cartao = await abrirProcesso(page);
    await abrirAndamentos(cartao);
    // Então
    await expect(cartao.getByText('toda a equipe vê este processo', { exact: false })).toBeVisible();
    await expect(andamentos(cartao).getByRole('listitem', { name: /^Petição de / })).toContainText('Juntada a contestação.');
    await expect(cartao.getByRole('list', { name: 'Comentários do cartão' })).toContainText('Contestação juntada.');
    await expect(cartao.getByRole('button', { name: /^Ações do andamento/ })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Novo andamento' })).toHaveCount(0);
    // Quando: comenta
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Li a contestação.');
    await cartao.getByRole('button', { name: 'Comentar' }).click();
    // Então
    await expect(cartao.getByRole('list', { name: 'Comentários do cartão' }).getByRole('listitem').first()).toContainText('Li a contestação.');
  });
});
