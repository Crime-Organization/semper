// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Propriedade intelectual (#317, parte C): no cartão do processo de PI, o "Acompanhar na agenda" abre o cadastro do compromisso que se
// repete (#307) já preenchido com os prazos do INPI, com a demanda de cada data nascendo quando o prazo abre. O relógio fica parado em
// quarta-feira, 04/11/2026, 12h em Brasília. Na semente do banco fictício: a pessoa LUCIANA ROCHA AMOSTRA. Quem está logado é o Mauro.
import { expect, test, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const AGORA = new Date('2026-11-04T12:00:00-03:00');
const NUMERO = 'BR 10 2020 004567-8';
const TITULO = `Anuidade da patente ${NUMERO}`;

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA);
});

/** Cadastra a patente depositada em 10/03/2020 e devolve o cartão dela aberto. */
async function cadastrarPatente(page: Page) {
  await page.goto('/processos/novo/');
  await page.getByRole('group', { name: 'Tipo' }).getByText('Administrativo', { exact: true }).click();
  await page.getByLabel('Número do processo').fill(NUMERO);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
  await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByLabel('Área do direito').selectOption({ label: 'Propriedade intelectual' });
  await page.getByLabel('Tipo de proteção').selectOption({ label: 'Patente de invenção' });
  await page.getByLabel('Data do depósito').fill('10032020');
  await page.getByRole('button', { name: 'Salvar processo' }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
  return cartao;
}

test.describe('Acompanhar os prazos do INPI na agenda (#317)', () => {
  test('dadas as anuidades calculadas, quando a pessoa acompanha na agenda, então nasce o compromisso que se repete, com a demanda quando o prazo abre', async ({ page }) => {
    // Dado
    let cartao = await cadastrarPatente(page);
    const doProcesso = page.url();
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByText(`Cria na agenda "${TITULO}" a partir de 10/06/2027 (todo ano, 13 vezes), com a demanda 92 dias antes de cada data, quando o prazo abre.`))
      .toBeVisible();
    // Quando
    await cartao.getByRole('link', { name: 'Acompanhar na agenda' }).click();
    // Então: o cadastro já vem preenchido com os prazos
    await expect(page.getByLabel('Título')).toHaveValue(TITULO);
    await expect(page.getByRole('textbox', { name: 'Data*', exact: true })).toHaveValue('10/06/2027');
    await expect(page.getByLabel('Repetir', { exact: true })).toHaveValue('ano');
    await expect(page.getByLabel('Quantas vezes')).toHaveValue('13');
    await expect(page.getByLabel('Gerar demanda (dias antes)')).toHaveValue('92');
    // Quando
    while (await page.getByRole('button', { name: 'Próxima' }).isVisible()) await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar compromisso' }).click();
    // Então
    await expect(page.getByText(/Compromisso \w+ cadastrado/)).toBeVisible();
    const doCompromisso = page.getByRole('dialog').filter({ has: page.getByLabel('Situação do compromisso') });
    await abrirSecao(doCompromisso, 'Dados do compromisso');
    await expect(doCompromisso).toContainText('Todo ano, 13 vezes');
    await expect(doCompromisso).toContainText('Nasce 92 dias antes de cada data');
    // E, de volta ao processo, o cartão diz que os prazos já estão na agenda, sem oferecer outro
    await page.goto(doProcesso);
    cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByText(`Estes prazos já estão na agenda: ${TITULO}, na seção "Compromissos".`)).toBeVisible();
    await expect(cartao.getByRole('link', { name: 'Acompanhar na agenda' })).toHaveCount(0);
  });

  test('dada a 7ª anuidade no prazo extra, quando a pessoa põe o prazo extra na agenda, então nasce um compromisso só, no último dia do extra', async ({ page }) => {
    // Dado: a 7ª anuidade acabou em 10/06/2026; com a taxa extra, vai até 10/12/2026
    let cartao = await cadastrarPatente(page);
    const doProcesso = page.url(), titulo = `7ª anuidade no prazo extra ${NUMERO}`;
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByText(`7ª anuidade está no prazo extra, com taxa, até 10/12/2026. Cria na agenda "${titulo}" nesse dia.`)).toBeVisible();
    // Quando
    await cartao.getByRole('link', { name: 'Pôr o prazo extra na agenda' }).click();
    // Então: o cadastro vem preenchido com o prazo extra, sem repetir
    await expect(page.getByLabel('Título')).toHaveValue(titulo);
    await expect(page.getByRole('textbox', { name: 'Data*', exact: true })).toHaveValue('10/12/2026');
    await expect(page.getByLabel('Repetir', { exact: true })).toHaveValue('');
    // Quando
    while (await page.getByRole('button', { name: 'Próxima' }).isVisible()) await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar compromisso' }).click();
    // Então
    await expect(page.getByText(/Compromisso \w+ cadastrado/)).toBeVisible();
    // E, de volta ao processo, o prazo extra já está na agenda, e a série continua oferecida
    await page.goto(doProcesso);
    cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByText(`O prazo extra já está na agenda: ${titulo}, na seção "Compromissos".`)).toBeVisible();
    await expect(cartao.getByRole('link', { name: 'Pôr o prazo extra na agenda' })).toHaveCount(0);
    await expect(cartao.getByRole('link', { name: 'Acompanhar na agenda' })).toBeVisible();
  });
});
