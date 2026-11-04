// Quem vê cada contrato (#107). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício, Bruno (estagiário, não é administrador) é responsável só pelo contrato de JOÃO PEDRO FICTÍCIO
// e colaborador da demanda "Registro de marca", ligada ao contrato de JOSÉ DA SILVA TESTE, de Mateus.
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirSecao, entrarComo } from './ajudantes';

/** Id de um contrato da semente, pelo objeto, lido do que o banco fictício guarda na aba. */
const idDoContrato = (page: Page, objeto: string) => page.evaluate(texto => {
  const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { contratos: { id: string; servico: string }[] };
  return bd.contratos.find(k => k.servico.startsWith(texto))!.id;
}, objeto);

test.describe('Visibilidade dos contratos', () => {
  test('dada uma conta comum, quando abre Contratos, então vê só o contrato dela, e a busca não acha os outros', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    // Quando
    await abrir(page, 'Contratos');
    // Então
    await expect(page.getByText('Divórcio consensual').first()).toBeVisible();
    await expect(page.getByText('Ação de cobrança')).toHaveCount(0);
    await expect(page.getByText('Registro de marca')).toHaveCount(0);
    // Quando
    await page.getByRole('searchbox').fill('MARIA APARECIDA');
    // Então
    await expect(page.getByText('Divórcio consensual')).toHaveCount(0);
    await expect(page.getByText('MARIA APARECIDA EXEMPLO')).toHaveCount(0);
  });

  test('dado um contrato alheio, quando a conta comum abre o endereço dele, então não vê nada', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    const id = await idDoContrato(page, 'Ação de cobrança');
    // Quando
    await page.goto('/contratos/?id=' + id);
    // Então
    await expect(page.getByText('Este contrato não foi encontrado. Ele pode ter sido excluído, ou você não tem acesso a ele.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'MARIA APARECIDA EXEMPLO' })).toHaveCount(0);
  });

  test('dada uma conta comum, quando abre o cartão de uma pessoa, então vê a pessoa, mas não o contrato alheio dela', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    // Quando
    await abrir(page, 'Pessoas');
    await page.getByRole('searchbox').fill('MARIA APARECIDA');
    await page.getByText('MARIA APARECIDA EXEMPLO').first().click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'MARIA APARECIDA EXEMPLO' })).toBeVisible();
    await abrirSecao(cartao, 'Contratos');
    await expect(cartao.getByRole('link', { name: /Ação de cobrança/ })).toHaveCount(0);
  });

  test('dada uma demanda ligada a um contrato alheio, quando a conta comum a abre, então vê o número, sem link', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    // Quando
    await abrir(page, 'Demandas');
    await page.getByText('Registro de marca').first().click();
    // Então
    const cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Contrato');
    await expect(cartao.getByText('Você não tem acesso a este contrato')).toBeVisible();
    await expect(cartao.getByRole('link', { name: /Contrato ligado/ })).toHaveCount(0);
  });

  test('dada uma conta mencionada num contrato alheio, quando abre o contrato, então lê e comenta, mas não altera', async ({ page }) => {
    // Dado: Ana mencionou Bruno num comentário. O banco fictício recusaria a menção a um estagiário, então ela entra direto na aba.
    await entrarComo(page, 'u-bruno');
    const id = await idDoContrato(page, 'Ação de cobrança');
    await page.evaluate(contrato => {
      const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as { comentarios: unknown[] };
      bd.comentarios.push({ id: 'cm-mencao', modulo: 'contratos', cartao_id: contrato, autor_id: 'u-ana', texto: 'Veja este, @bruno.souza',
        mencoes: ['u-bruno'], criado_em: new Date().toISOString(), editado_em: null });
      sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
    }, id);
    // Quando
    await page.goto('/contratos/?id=' + id);
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'MARIA APARECIDA EXEMPLO' })).toBeVisible();
    await expect(cartao.getByText('Você vê este contrato porque foi mencionado num comentário.')).toBeVisible();
    await expect(cartao.getByLabel('Situação do contrato')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Arquivar', exact: true })).toHaveCount(0);
  });

  test('dado um administrador, quando abre Contratos, então vê os contratos de todos', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-ana');
    // Quando
    await abrir(page, 'Contratos');
    // Então
    await expect(page.getByText('Divórcio consensual').first()).toBeVisible();
    await expect(page.getByText('Ação de cobrança').first()).toBeVisible();
    await expect(page.getByText('Consultoria e assessoria jurídica').first()).toBeVisible();
  });
});
