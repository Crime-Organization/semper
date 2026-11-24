// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Propriedade intelectual (#317): na área "Propriedade intelectual", o tipo de proteção, os campos de cada tipo, a seção "Validade e
// anuidades" no cartão e os papéis de titular, inventor e autor da criação. Na semente do banco fictício: a pessoa LUCIANA ROCHA
// AMOSTRA. Quem está logado é o Mauro (administrador).
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const NUMERO = 'BR 10 2020 004567-8';

/** Abre o cadastro de um processo administrativo e chega à etapa dos detalhes. */
async function cadastroAteDetalhes(page: Page) {
  await page.goto('/processos/novo/');
  await page.getByRole('group', { name: 'Tipo' }).getByText('Administrativo', { exact: true }).click();
  await page.getByLabel('Número do processo').fill(NUMERO);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
  await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
  await page.getByLabel('Papel do cliente').selectOption('autor');
  await page.getByRole('button', { name: 'Próxima' }).click();
}

test.describe('Processos de propriedade intelectual (#317)', () => {
  test('dado um processo de propriedade intelectual, quando a pessoa escolhe o tipo de proteção, então aparecem só os campos daquele tipo', async ({ page }) => {
    // Dado
    await cadastroAteDetalhes(page);
    await expect(page.getByLabel('Tipo de proteção')).toHaveCount(0);
    // Quando
    await page.getByLabel('Área do direito').selectOption({ label: 'Propriedade intelectual' });
    await page.getByLabel('Tipo de proteção').selectOption({ label: 'Marca' });
    // Então
    await expect(page.getByLabel('Classes de Nice')).toBeVisible();
    await expect(page.getByLabel('Apresentação da marca')).toBeVisible();
    await expect(page.getByLabel('Número de variações')).toHaveCount(0);
    // Quando
    await page.getByLabel('Tipo de proteção').selectOption({ label: 'Patente de invenção' });
    // Então
    await expect(page.getByLabel('Classes de Nice')).toHaveCount(0);
    await expect(page.getByLabel('Data da publicação')).toBeVisible();
    await expect(page.getByText(/os inventores entram no cartão/i)).toBeVisible();
  });

  test('dada a data de depósito de uma patente, quando a pessoa salva, então o cartão mostra a validade e as anuidades, e titular e inventor estão entre os papéis', async ({ page }) => {
    // Dado
    await cadastroAteDetalhes(page);
    await page.getByLabel('Área do direito').selectOption({ label: 'Propriedade intelectual' });
    await page.getByLabel('Tipo de proteção').selectOption({ label: 'Patente de invenção' });
    await page.getByLabel('Data do depósito').fill('10032020');
    // Quando
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByText('10/03/2040')).toBeVisible();
    const prazos = cartao.getByRole('table', { name: 'Prazos do INPI' });
    await expect(prazos.getByRole('row', { name: /3ª anuidade 10\/03\/2022 10\/06\/2022 10\/12\/2022/ })).toBeVisible();
    await expect(prazos.getByRole('row', { name: /20ª anuidade/ })).toBeVisible();
    await expect(cartao.getByText(/confira sempre na Revista da Propriedade Industrial/)).toBeVisible();
    // E os dados do processo mostram o tipo e o depósito
    await abrirSecao(cartao, 'Dados do processo');
    await expect(cartao.getByText('Patente de invenção', { exact: true })).toBeVisible();
    // E, nas pessoas do processo, titular e inventor estão entre os papéis (o autor da criação é do desenho e do programa)
    await abrirSecao(cartao, 'Pessoas do processo');
    await cartao.getByRole('button', { name: 'Ligar pessoa com papel a este processo' }).click();
    // O nome do cartão também é um botão com o nome da cliente: a busca é a do formulário.
    const form = cartao.getByRole('form', { name: 'Ligar pessoa com papel' }), papel = form.getByLabel('Papel no processo');
    await expect(papel.getByRole('option', { name: 'Titular' })).toHaveCount(1);
    await expect(papel.getByRole('option', { name: 'Inventor' })).toHaveCount(1);
    await expect(papel.getByRole('option', { name: 'Autor da criação' })).toHaveCount(0);
    // Quando
    await papel.selectOption({ label: 'Inventor' });
    await form.getByRole('textbox', { name: 'Pessoa', exact: true }).fill('luciana');
    await form.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await form.getByRole('button', { name: 'Ligar ao processo' }).click();
    // Então
    await expect(page.getByText('LUCIANA ROCHA AMOSTRA entrou no processo como inventor.')).toBeVisible();
  });

  test('dado um processo de outra área, quando a pessoa liga alguém com papel, então titular e inventor não aparecem', async ({ page }) => {
    // Dado
    await cadastroAteDetalhes(page);
    await page.getByLabel('Área do direito').selectOption({ label: 'Cível' });
    await page.getByRole('button', { name: 'Salvar processo' }).click();
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
    // Então
    await expect(cartao.getByRole('button', { name: /^Validade e anuidades/ })).toHaveCount(0);
    await abrirSecao(cartao, 'Pessoas do processo');
    await cartao.getByRole('button', { name: 'Ligar pessoa com papel a este processo' }).click();
    await expect(cartao.getByLabel('Papel no processo').getByRole('option', { name: 'Titular' })).toHaveCount(0);
  });
});
