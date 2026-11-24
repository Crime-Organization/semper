// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Propriedade intelectual (#418): o prazo após a publicação do deferimento da marca (60 dias úteis, mais 30 extras, sem falar em taxa)
// aparece no cartão até a concessão ser informada; vai para a agenda com um clique; o compromisso acompanha a data quando ela muda e é
// concluído quando a concessão chega. A série dos prazos do INPI também acompanha o depósito. O relógio fica parado (e anda um minuto a
// cada mudança das datas do processo) em quarta-feira, 04/11/2026, 12h em Brasília. Na semente do banco fictício: a pessoa LUCIANA ROCHA AMOSTRA. Quem está logado é o Mauro.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const AGORA = new Date('2026-11-04T12:00:00-03:00');
const NUMERO = '918000001';
/** Quanto o relógio parado anda a cada mudança das datas do processo: o cartão só oferece atualizar se elas mudaram DEPOIS do compromisso. */
const UM_MINUTO = 60 * 1000;
let relogio = AGORA;

test.beforeEach(async ({ page }) => {
  relogio = AGORA;
  await page.clock.setFixedTime(AGORA);
});

/** Cadastra o processo administrativo de PI com o tipo de proteção e as datas dadas (rótulo → dígitos) e devolve o cartão aberto. */
async function cadastrar(page: Page, protecao: string, datas: Record<string, string>) {
  await page.goto('/processos/novo/');
  await page.getByRole('group', { name: 'Tipo' }).getByText('Administrativo', { exact: true }).click();
  await page.getByLabel('Número do processo').fill(NUMERO);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
  await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
  await page.getByLabel('Papel do cliente').selectOption('autor');
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByLabel('Área do direito').selectOption({ label: 'Propriedade intelectual' });
  await page.getByLabel('Tipo de proteção').selectOption({ label: protecao });
  for (const [rotulo, valor] of Object.entries(datas)) await page.getByLabel(rotulo).fill(valor);
  await page.getByRole('button', { name: 'Salvar processo' }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: 'LUCIANA ROCHA AMOSTRA', level: 2 })).toBeVisible();
  return cartao;
}

/** Muda uma data do processo na seção "Dados do processo" (#428), clicando no tipo de proteção, um minuto depois do que veio antes. */
async function mudarData(page: Page, cartao: Locator, protecao: string, rotulo: string, valor: string) {
  relogio = new Date(relogio.getTime() + UM_MINUTO);
  await page.clock.setFixedTime(relogio);
  await abrirSecao(cartao, 'Dados do processo');
  await cartao.getByRole('definition').filter({ hasText: new RegExp(`^${protecao}$`) }).click();
  const form = cartao.getByRole('form', { name: 'Editar os dados do processo' });
  await form.getByLabel(rotulo).fill(valor);
  await form.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Processo atualizado.')).toBeVisible();
}

/** Salva o cadastro do compromisso aberto, passando pelas etapas que faltam. */
async function salvarCompromisso(page: Page) {
  while (await page.getByRole('button', { name: 'Próxima' }).isVisible()) await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByText(/Compromisso \w+ cadastrado/)).toBeVisible();
}

test.describe('Prazo após o deferimento e compromissos que acompanham as datas (#418)', () => {
  test('dada a marca com a publicação do deferimento, quando a pessoa abre o cartão, põe o prazo na agenda, muda a data e informa a concessão, então o prazo e o compromisso acompanham', async ({ page }) => {
    // Dado: o deferimento publicado na terça, 06/10/2026
    let cartao = await cadastrar(page, 'Marca', { 'Data do depósito': '10032025', 'Publicação do deferimento (RPI)': '06102026' });
    const doProcesso = page.url(), titulo = `Prazo após o deferimento ${NUMERO}`;
    // Quando
    await abrirSecao(cartao, 'Validade e anuidades');
    // Então: 60 dias úteis (sem fins de semana nem feriados) até 05/01/2027, e mais 30 até 16/02/2027, sem falar em taxa
    const prazos = cartao.getByRole('table', { name: 'Prazos do INPI' });
    const linha = prazos.getByRole('row', { name: /Prazo após o deferimento 06\/10\/2026 05\/01\/2027 16\/02\/2027 Aberto/ });
    await expect(linha).toBeVisible();
    await expect(linha).not.toContainText(/taxa/i);
    await expect(cartao.getByText('Prazo após o deferimento: de 06/10/2026 a 05/01/2027 (prazo extra até 16/02/2027)')).toBeVisible();
    await expect(cartao.getByText(`Cria na agenda "${titulo}" em 05/01/2027.`)).toBeVisible();

    // Quando: põe o prazo na agenda (não nasce sozinho)
    await cartao.getByRole('link', { name: 'Pôr o prazo na agenda' }).click();
    // Então: o cadastro vem preenchido, sem repetir
    await expect(page.getByLabel('Título')).toHaveValue(titulo);
    await expect(page.getByRole('textbox', { name: 'Data*', exact: true })).toHaveValue('05/01/2027');
    await expect(page.getByLabel('Repetir', { exact: true })).toHaveValue('');
    await salvarCompromisso(page);
    await page.goto(doProcesso);
    cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByText(`O prazo após o deferimento já está na agenda: ${titulo}, na seção "Compromissos".`)).toBeVisible();
    await expect(cartao.getByRole('link', { name: 'Pôr o prazo na agenda' })).toHaveCount(0);

    // Quando: a data do deferimento muda para 13/10/2026
    await mudarData(page, cartao, 'Marca', 'Publicação do deferimento (RPI)', '13102026');
    // Então: o cartão oferece levar o compromisso para a data nova
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByText(`As datas do processo mudaram: "${titulo}" está na agenda em 05/01/2027, e a conta de agora dá 11/01/2027.`)).toBeVisible();
    // Quando
    await cartao.getByRole('button', { name: 'Atualizar as datas na agenda' }).click();
    // Então
    await expect(page.getByText('A data passou para 11/01/2027 na agenda.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Atualizar as datas na agenda' })).toHaveCount(0);

    // Quando: a concessão é informada
    await mudarData(page, cartao, 'Marca', 'Data da concessão', '03112026');
    // Então: o prazo após o deferimento some, e o cartão oferece concluir o compromisso dele
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByRole('table', { name: 'Prazos do INPI' }).getByRole('row', { name: /Prazo após o deferimento/ })).toHaveCount(0);
    await expect(cartao.getByText(/A concessão foi informada: o prazo após o deferimento terminou/)).toBeVisible();
    // Quando
    await cartao.getByRole('button', { name: 'Concluir na agenda' }).click();
    // Então
    await expect(page.getByText('O compromisso do prazo após o deferimento foi concluído.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Concluir na agenda' })).toHaveCount(0);
  });

  test('dadas as anuidades na agenda, quando o depósito muda, então o cartão oferece atualizar as datas seguintes, e elas passam a seguir a conta', async ({ page }) => {
    // Dado: a patente depositada em 10/03/2020, com as anuidades na agenda a partir de 10/06/2027
    let cartao = await cadastrar(page, 'Patente de invenção', { 'Data do depósito': '10032020' });
    const doProcesso = page.url(), titulo = `Anuidade da patente ${NUMERO}`;
    await abrirSecao(cartao, 'Validade e anuidades');
    await cartao.getByRole('link', { name: 'Acompanhar na agenda' }).click();
    await expect(page.getByRole('textbox', { name: 'Data*', exact: true })).toHaveValue('10/06/2027');
    await salvarCompromisso(page);
    await page.goto(doProcesso);
    cartao = page.getByRole('dialog');
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByText(`Estes prazos já estão na agenda: ${titulo}, na seção "Compromissos".`)).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Atualizar as datas na agenda' })).toHaveCount(0);
    // Quando: o depósito passa para 10/04/2020
    await mudarData(page, cartao, 'Patente de invenção', 'Data do depósito', '10042020');
    // Então
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByText(`As datas do processo mudaram: "${titulo}" está na agenda em 10/06/2027, e a conta de agora dá 10/07/2027.`)).toBeVisible();
    // Quando
    await cartao.getByRole('button', { name: 'Atualizar as datas na agenda' }).click();
    // Então: esta e as seguintes mudam, e o cartão não oferece mais
    await expect(page.getByText('Na agenda, esta data e as seguintes passaram a contar de 10/07/2027.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Atualizar as datas na agenda' })).toHaveCount(0);
    await expect(cartao.getByText(`Estes prazos já estão na agenda: ${titulo}, na seção "Compromissos".`)).toBeVisible();
  });

  test('dadas as anuidades na agenda, quando o depósito recua e uma anuidade fica para trás, então ao atualizar o cartão avisa que a série ficou com uma data a mais', async ({ page }) => {
    // Dado: 13 anuidades na agenda, da 8ª à 20ª, a partir de 10/06/2027
    let cartao = await cadastrar(page, 'Patente de invenção', { 'Data do depósito': '10032020' });
    const doProcesso = page.url(), titulo = `Anuidade da patente ${NUMERO}`;
    await abrirSecao(cartao, 'Validade e anuidades');
    await cartao.getByRole('link', { name: 'Acompanhar na agenda' }).click();
    await expect(page.getByRole('textbox', { name: 'Data*', exact: true })).toHaveValue('10/06/2027');
    await salvarCompromisso(page);
    await page.goto(doProcesso);
    cartao = page.getByRole('dialog');
    // Quando: o depósito passa para 10/07/2019 (a 8ª anuidade acabou em 10/10/2026: a conta dá 12, da 9ª em diante)
    await mudarData(page, cartao, 'Patente de invenção', 'Data do depósito', '10072019');
    await abrirSecao(cartao, 'Validade e anuidades');
    await expect(cartao.getByText(`As datas do processo mudaram: "${titulo}" está na agenda em 10/06/2027, e a conta de agora dá 10/10/2027.`)).toBeVisible();
    await cartao.getByRole('button', { name: 'Atualizar as datas na agenda' }).click();
    // Então
    await expect(page.getByText('Na agenda, esta data e as seguintes passaram a contar de 10/10/2027. Atenção: a série da agenda tem agora 13 datas, '
      + 'e a conta dá 12 datas. Confira o fim da série no cartão do compromisso.')).toBeVisible();
  });

  test('dado o processo de marca sem órgão, quando a pessoa abre o novo prazo, então a conta usa o calendário do INPI, sem dizer que o processo não tem órgão', async ({ page }) => {
    // Dado: o INPI está em Feriados e prazos (na semente), e o processo não tem órgão
    const cartao = await cadastrar(page, 'Marca', { 'Data do depósito': '10032025' });
    // Quando
    await abrirSecao(cartao, 'Prazos');
    await cartao.getByRole('button', { name: 'Novo prazo', exact: true }).first().click();
    // Então: dias úteis, no calendário do INPI
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    await expect(form.getByRole('radio', { name: 'Dias úteis' })).toBeChecked();
    await expect(form.getByText(/Este processo não tem órgão/)).toHaveCount(0);
    await expect(form.getByText(/não está cadastrado em Feriados e prazos/)).toHaveCount(0);
  });
});
