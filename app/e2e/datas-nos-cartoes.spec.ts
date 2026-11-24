// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A edição das datas nos cartões (#395): cada defeito que os testadores acharam virou um teste. Ao mexer numa data, as outras
// ficam no lugar e à vista (o formulário abre embaixo da faixa); o calendário só abre quando a pessoa pede, abre dentro do
// formulário e não cobre a hora, o lembrete, o Cancelar nem o Salvar; o Tab não foge do cartão; uma data aberta de cada vez; e
// o mesmo jeito de salvar, cancelar e desistir no início, no prazo, na data do compromisso, nos prazos do processo e no contrato.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const calendario = (page: Page) => page.getByRole('dialog', { name: 'Calendário' });

/** Abre o cartão pela tabela do módulo. O cartão é achado pelo título, porque o calendário também é uma janela (dialog). */
async function abrirCartao(page: Page, modulo: string, titulo: string) {
  await page.goto(`/${modulo}/`);
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: titulo }).first().click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: titulo, level: 2 }) });
  await expect(cartao).toBeVisible();
  await esperarParar(cartao);
  return cartao;
}
/** Abre o cartão de um compromisso pela tabela da agenda. */
async function abrirCompromisso(page: Page, nome: string) {
  await page.goto('/agenda/');
  await page.getByRole('group', { name: 'Visualização' }).getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: nome }).click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: nome, level: 2 }) });
  await expect(cartao).toBeVisible();
  await esperarParar(cartao);
  return cartao;
}
/** Espera as animações do cartão terminarem, para medir. */
async function esperarParar(lugar: Locator) {
  await lugar.evaluate(async el => {
    const animacoes = el.ownerDocument.getAnimations().filter(a => { const alvo = (a.effect as KeyframeEffect | null)?.target; return !!alvo && (alvo.contains(el) || el.contains(alvo)); });
    await Promise.allSettled(animacoes.map(a => a.finished));
  });
}
/** Onde a coisa está na tela (arredondado). */
async function posicao(local: Locator) {
  const caixa = (await local.boundingBox())!;
  return { x: Math.round(caixa.x), y: Math.round(caixa.y) };
}
/** A pessoa vê e alcança o meio da coisa: nada fica por cima dela (o que está no ponto é ela mesma, ou parte dela). */
async function aVista(local: Locator) {
  await local.scrollIntoViewIfNeeded();
  return local.evaluate(el => {
    const r = el.getBoundingClientRect();
    const noPonto = el.ownerDocument.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!noPonto && (noPonto === el || el.contains(noPonto));
  });
}
/** O foco está dentro do cartão? */
const focoNoCartao = (cartao: Locator) => cartao.evaluate(el => el.contains(el.ownerDocument.activeElement));

/** No máximo quantos Tabs o campo de hora do navegador pede até sair dele (uma parte para as horas, outra para os minutos…). */
const PARTES_DA_HORA = 4;
const TELAS = [{ nome: 'computador', viewport: { width: 1300, height: 900 } }, { nome: 'celular', viewport: { width: 375, height: 812 } }];
const CARTOES = [
  { modulo: 'tarefas', titulo: 'Emitir a GRU', prazo: 'Prazo', criacao: 'Criada em' },
  { modulo: 'demandas', titulo: 'Notificar o devedor', prazo: 'Prazo de entrega', criacao: 'Criada em' }
];

for (const c of CARTOES) {
  const faixa = (cartao: Locator) => cartao.getByRole('group', { name: 'Datas', exact: true });
  const dado = (cartao: Locator, nome: string) => faixa(cartao).getByRole('group', { name: nome, exact: true });
  const inicio = (cartao: Locator) => cartao.getByRole('button', { name: /^Data de início: / });
  const prazo = (cartao: Locator) => cartao.getByRole('button', { name: new RegExp(`^${c.prazo}: `) });
  const doPrazo = (cartao: Locator) => cartao.getByRole('group', { name: `Mudar o ${c.prazo.toLowerCase()}` });
  const doInicio = (cartao: Locator) => cartao.getByRole('group', { name: 'Mudar a data de início' });

  for (const tela of TELAS) {
    test.describe(`Dado o cartão (${c.modulo}) no ${tela.nome} (#395)`, () => {
      test.use({ viewport: tela.viewport });

      test('quando a pessoa clica no início, então a criação e o prazo ficam onde estavam, à vista, e o prazo continua alcançável', async ({ page }) => {
        // Dado
        const cartao = await abrirCartao(page, c.modulo, c.titulo);
        const antes = { criacao: await posicao(dado(cartao, c.criacao)), inicio: await posicao(dado(cartao, 'Início')), prazo: await posicao(dado(cartao, c.prazo)),
          nome: await posicao(dado(cartao, 'Início').getByText('Início', { exact: true })) };
        // Quando
        await inicio(cartao).click();
        // Então
        await expect(doInicio(cartao)).toBeVisible();
        await expect(calendario(page)).toHaveCount(0);
        expect(await posicao(dado(cartao, c.criacao))).toEqual(antes.criacao);
        expect(await posicao(dado(cartao, 'Início'))).toEqual(antes.inicio);
        expect(await posicao(dado(cartao, c.prazo))).toEqual(antes.prazo);
        // No celular, o nome "Início" continua à esquerda do valor, como os outros
        expect(await posicao(dado(cartao, 'Início').getByText('Início', { exact: true }))).toEqual(antes.nome);
        expect(await aVista(prazo(cartao))).toBe(true);
      });

      test('quando a pessoa clica no prazo, então o calendário não abre sozinho, as outras datas ficam no lugar, e Cancelar e Salvar ficam à vista', async ({ page }) => {
        // Dado
        const cartao = await abrirCartao(page, c.modulo, c.titulo);
        const antes = { criacao: await posicao(dado(cartao, c.criacao)), inicio: await posicao(dado(cartao, 'Início')) };
        // Quando
        await prazo(cartao).click();
        // Então
        await expect(doPrazo(cartao)).toBeVisible();
        await expect(calendario(page)).toHaveCount(0);
        await expect(doPrazo(cartao).getByRole('textbox', { name: c.prazo, exact: true })).toBeFocused();
        expect(await posicao(dado(cartao, c.criacao))).toEqual(antes.criacao);
        expect(await posicao(dado(cartao, 'Início'))).toEqual(antes.inicio);
        for (const botao of ['Cancelar', 'Salvar']) expect(await aVista(doPrazo(cartao).getByRole('button', { name: botao }))).toBe(true);
      });

      test('quando a pessoa abre o calendário do prazo, então ele fica no formulário e não cobre a hora, o lembrete, o Cancelar nem o Salvar', async ({ page }) => {
        // Dado
        const cartao = await abrirCartao(page, c.modulo, c.titulo);
        await prazo(cartao).click();
        // Quando
        await doPrazo(cartao).getByRole('button', { name: 'Abrir o calendário' }).click();
        // Então
        await expect(doPrazo(cartao).getByRole('dialog', { name: 'Calendário' })).toBeVisible();
        expect(await aVista(doPrazo(cartao).getByLabel(`Hora do ${c.prazo.toLowerCase()}`))).toBe(true);
        expect(await aVista(doPrazo(cartao).getByRole('button', { name: /^Lembrete:/ }))).toBe(true);
        for (const botao of ['Cancelar', 'Salvar']) expect(await aVista(doPrazo(cartao).getByRole('button', { name: botao }))).toBe(true);
        // E fecha com Esc, sem fechar o formulário
        await page.keyboard.press('Escape');
        await expect(calendario(page)).toHaveCount(0);
        await expect(doPrazo(cartao)).toBeVisible();
      });
    });
  }

  test.describe(`Dado o cartão (${c.modulo}) (#395)`, () => {
    test('numa janela baixa de notebook, quando a pessoa abre o calendário do prazo ou do início, então ele aparece inteiro, com o "Hoje"', async ({ page }) => {
      // Dado
      await page.setViewportSize({ width: 1366, height: 650 });
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      for (const [abrir, formulario] of [[prazo, doPrazo], [inicio, doInicio]] as const) {
        await abrir(cartao).click();
        // Quando
        await formulario(cartao).getByRole('button', { name: 'Abrir o calendário' }).click();
        // Então
        const cal = formulario(cartao).getByRole('dialog', { name: 'Calendário' });
        await expect(cal.getByRole('button', { name: 'Hoje', exact: true })).toBeInViewport();
        await esperarParar(cal);
        const caixa = (await cal.boundingBox())!;
        expect(caixa.y).toBeGreaterThanOrEqual(0);
        expect(caixa.y + caixa.height).toBeLessThanOrEqual(650);
        await page.keyboard.press('Escape');
        await formulario(cartao).getByRole('button', { name: 'Cancelar' }).click();
      }
    });

    test('dado o prazo mudado e não salvo, quando a pessoa clica no início, então o prazo continua aberto com o que ela escreveu, lembra de salvar ou cancelar, e o início não abre', async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      await prazo(cartao).click();
      await doPrazo(cartao).getByRole('textbox', { name: c.prazo, exact: true }).fill('04/04/2031');
      // Quando
      await inicio(cartao).click();
      // Então
      await expect(doInicio(cartao)).toHaveCount(0);
      await expect(doPrazo(cartao).getByRole('status')).toHaveText('Salve ou cancele esta mudança antes de abrir outra.');
      await expect(doPrazo(cartao).getByRole('textbox', { name: c.prazo, exact: true })).toHaveValue('04/04/2031');
      await expect(doPrazo(cartao).getByRole('textbox', { name: c.prazo, exact: true })).toBeFocused();
    });

    test('dado o calendário do prazo aberto pelo teclado, quando a pessoa aperta Tab, então o foco vai à hora, ao lembrete, ao Cancelar e ao Salvar, sem sair do cartão', async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      await prazo(cartao).focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await expect(calendario(page)).toBeVisible();
      // Quando / Então
      await page.keyboard.press('Tab');
      await expect(calendario(page).getByRole('button', { name: 'Hoje', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(doPrazo(cartao).getByLabel(`Hora do ${c.prazo.toLowerCase()}`)).toBeFocused();
      // A hora do navegador tem partes (as horas, os minutos): o Tab passa por cada uma antes de sair dela
      const lembrete = doPrazo(cartao).getByRole('button', { name: /^Lembrete:/ });
      for (let partes = 0; partes < PARTES_DA_HORA && !await lembrete.evaluate(el => el === el.ownerDocument.activeElement); partes++) await page.keyboard.press('Tab');
      await expect(lembrete).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(doPrazo(cartao).getByRole('button', { name: 'Cancelar' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(doPrazo(cartao).getByRole('button', { name: 'Salvar' })).toBeFocused();
      expect(await focoNoCartao(cartao)).toBe(true);
      // E para trás, do calendário volta ao prazo
      await doPrazo(cartao).getByRole('textbox', { name: c.prazo, exact: true }).focus();
      await page.keyboard.press('ArrowDown');
      for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+Tab');
      await expect(doPrazo(cartao).getByRole('textbox', { name: c.prazo, exact: true })).toBeFocused();
    });

    test('dado um prazo com lembrete, quando a pessoa apaga a data e salva, então o prazo sai inteiro e o cartão diz "Sem prazo"', async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      await prazo(cartao).click();
      await doPrazo(cartao).getByRole('button', { name: /^Lembrete:/ }).click();
      await page.getByRole('menuitemradio', { name: '1 dia antes' }).click();
      await doPrazo(cartao).getByRole('button', { name: 'Salvar' }).click();
      await expect(doPrazo(cartao)).toHaveCount(0);
      await expect(prazo(cartao)).toContainText('1 dia antes');
      // Quando
      await prazo(cartao).click();
      await doPrazo(cartao).getByRole('textbox', { name: c.prazo, exact: true }).fill('');
      await doPrazo(cartao).getByRole('button', { name: 'Salvar' }).click();
      // Então
      await expect(doPrazo(cartao)).toHaveCount(0);
      await expect(prazo(cartao)).toHaveText('Sem prazo');
    });

    test('quando a pessoa muda o início, então ele se comporta como o prazo: sair do campo não grava, e a data errada fica marcada no próprio campo', async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      const antes = await inicio(cartao).textContent();
      await inicio(cartao).click();
      const campo = doInicio(cartao).getByRole('textbox', { name: 'Data de início' });
      // Quando: escreve e clica fora (no título)
      await campo.fill('08/08/2027');
      await cartao.getByRole('heading', { name: c.titulo, level: 2 }).click();
      // Então: nada gravado, e o formulário continua com o que ela escreveu
      await expect(inicio(cartao)).toHaveText(antes!);
      await expect(campo).toHaveValue('08/08/2027');
      // Quando: uma data que não existe, e Enter
      await campo.fill('31/02/2026');
      await campo.press('Enter');
      // Então
      await expect(doInicio(cartao).getByRole('alert')).toHaveText('Data inexistente.');
      await expect(campo).toHaveAttribute('aria-invalid', 'true');
      await expect(inicio(cartao)).toHaveText(antes!);
    });

    test('dado o prazo mudado e não salvo, quando a pessoa clica no lápis Editar, então o prazo continua aberto com o que ela escreveu, lembra de salvar ou cancelar, e o lápis não abre', async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      await prazo(cartao).click();
      await doPrazo(cartao).getByRole('textbox', { name: c.prazo, exact: true }).fill('04/04/2031');
      // Quando
      await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
      // Então
      await expect(cartao.getByRole('form', { name: /^Editar / })).toHaveCount(0);
      await expect(doPrazo(cartao).getByRole('status')).toHaveText('Salve ou cancele esta mudança antes de abrir outra.');
      await expect(doPrazo(cartao).getByRole('textbox', { name: c.prazo, exact: true })).toHaveValue('04/04/2031');
      await expect(doPrazo(cartao).getByRole('textbox', { name: c.prazo, exact: true })).toBeFocused();
      // Quando: cancela o prazo, e aí o lápis abre
      await doPrazo(cartao).getByRole('button', { name: 'Cancelar' }).click();
      await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
      // Então
      await expect(cartao.getByRole('form', { name: /^Editar / })).toBeVisible();
    });

    test('dado o início aberto, quando a pessoa usa Shift+Tab, Tab e Esc, então o foco vai do formulário ao início e volta, e o Esc no valor desfaz só o início, sem fechar o cartão', async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      const antes = await inicio(cartao).textContent();
      await inicio(cartao).click();
      const campo = doInicio(cartao).getByRole('textbox', { name: 'Data de início' });
      await expect(campo).toBeFocused();
      await campo.fill('');
      // Quando
      await page.keyboard.press('Shift+Tab');
      // Então: volta ao início, e não ao prazo
      await expect(inicio(cartao)).toBeFocused();
      // Quando
      await page.keyboard.press('Tab');
      // Então
      await expect(campo).toBeFocused();
      // Quando: volta ao valor e aperta Esc
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Escape');
      // Então
      await expect(doInicio(cartao)).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).toHaveCount(0);
      await expect(inicio(cartao)).toHaveText(antes!);
      await expect(cartao).toBeVisible();
    });
  });
}

test.describe('Dados o lápis e a descrição mudada no lugar, no mesmo cartão (#395)', () => {
  test.use({ viewport: { width: 1300, height: 900 } });
  const pergunta = (page: Page) => page.getByRole('dialog', { name: 'Sair sem salvar?' });
  const lapis = (cartao: Locator) => cartao.getByRole('form', { name: 'Editar tarefa' });

  test('dada a descrição por salvar, quando a pessoa abre e cancela o lápis e fecha o cartão pelo X, então o SEMPER pergunta antes', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Renovar a procuração');
    await cartao.getByText('A procuração vence este mês.').click();
    await cartao.getByRole('textbox', { name: 'Descrição' }).fill('Uma ideia que não pode se perder.');
    await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
    await lapis(cartao).getByRole('button', { name: 'Cancelar' }).click();
    await expect(lapis(cartao)).toHaveCount(0);
    // Quando
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    // Então
    await expect(pergunta(page)).toBeVisible();
    await pergunta(page).getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(cartao.getByRole('textbox', { name: 'Descrição' })).toContainText('Uma ideia que não pode se perder.');
  });

  test('dado o lápis com o responsável trocado, quando a pessoa muda e salva a descrição no lugar e fecha o cartão pelo X, então o SEMPER pergunta antes', async ({ page }) => {
    // Dado
    const cartao = await abrirCartao(page, 'tarefas', 'Renovar a procuração');
    await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
    const responsavel = lapis(cartao).getByLabel(/Responsável/);
    const outro = await responsavel.locator('option').evaluateAll((opcoes, atual) => opcoes.map(o => (o as HTMLOptionElement).value).find(v => v && v !== atual), await responsavel.inputValue());
    await responsavel.selectOption(outro!);
    await cartao.getByText('A procuração vence este mês.').click();
    await cartao.getByRole('textbox', { name: 'Descrição' }).fill('Texto novo salvo no lugar.');
    await cartao.getByRole('textbox', { name: 'Descrição' }).press('Control+Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Tarefa atualizada.' })).toBeVisible();
    // Quando
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    // Então
    await expect(pergunta(page)).toBeVisible();
    await pergunta(page).getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(responsavel).toHaveValue(outro!);
  });
});

test.describe('Dado o compromisso (#395)', () => {
  const quando = (cartao: Locator) => cartao.getByRole('button', { name: /^Data e horário: / });
  const formulario = (cartao: Locator) => cartao.getByRole('group', { name: 'Mudar a data e o horário' });
  const criado = (cartao: Locator) => cartao.getByRole('group', { name: 'Datas', exact: true }).getByRole('group', { name: 'Criado em', exact: true });

  for (const tela of TELAS) {
    test(`no ${tela.nome}, quando a pessoa clica na data e no horário, então "Criado em" fica no lugar e o calendário só abre quando ela pede, sem cobrir o Até, o Cancelar e o Salvar`, async ({ page }) => {
      // Dado
      await page.setViewportSize(tela.viewport);
      const cartao = await abrirCompromisso(page, 'Reunião de equipe');
      const antes = await posicao(criado(cartao));
      // Quando
      await quando(cartao).click();
      // Então
      await expect(formulario(cartao)).toBeVisible();
      await expect(calendario(page)).toHaveCount(0);
      expect(await posicao(criado(cartao))).toEqual(antes);
      // Quando
      await formulario(cartao).getByRole('textbox', { name: 'Data' }).click();
      // Então
      await expect(formulario(cartao).getByRole('dialog', { name: 'Calendário' })).toBeVisible();
      expect(await aVista(formulario(cartao).getByLabel('Até'))).toBe(true);
      for (const botao of ['Cancelar', 'Salvar']) expect(await aVista(formulario(cartao).getByRole('button', { name: botao }))).toBe(true);
    });
  }

  test('quando a pessoa usa só o teclado, então do calendário o Tab vai para a hora, sem sair do cartão', async ({ page }) => {
    // Dado
    const cartao = await abrirCompromisso(page, 'Reunião de equipe');
    await quando(cartao).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    // Quando
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    // Então
    await expect(formulario(cartao).getByLabel('Hora do compromisso')).toBeFocused();
    expect(await focoNoCartao(cartao)).toBe(true);
  });
});

test.describe('Dados os prazos do processo (#395)', () => {
  /** Abre o cartão do processo judicial da semente, com a seção dos prazos aberta. */
  async function abrirProcesso(page: Page) {
    await page.goto('/processos/judicial/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).first().click();
    const cartao = page.getByRole('dialog').filter({ has: page.getByLabel('Situação do processo') });
    await expect(cartao.getByLabel('Situação do processo')).toBeVisible();
    await abrirSecao(cartao, 'Prazos');
    return cartao;
  }
  const novoPrazo = (cartao: Locator) => cartao.getByRole('button', { name: 'Novo prazo', exact: true });
  const lista = (cartao: Locator) => cartao.getByRole('list', { name: 'Prazos do processo' });
  async function lancar(cartao: Locator, descricao: string, data: string) {
    await novoPrazo(cartao).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    await form.getByLabel('Que prazo é este').fill(descricao);
    await form.getByText('Digitar a data').click();
    await form.getByLabel('Último dia').fill(data);
    await form.getByRole('button', { name: 'Lançar prazo' }).click();
    await expect(lista(cartao)).toContainText(descricao);
  }

  test('quando a pessoa aperta Esc no formulário do prazo novo ou do que muda, então só o formulário fecha, sem mudar nada, e o cartão continua aberto', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    await lancar(cartao, 'Contestação teste', '01/12/2026');
    // Quando: Esc no "Mudar"
    await lista(cartao).getByRole('button', { name: 'Mudar o prazo Contestação teste' }).click();
    const mudar = cartao.getByRole('form', { name: 'Mudar prazo' });
    await mudar.getByLabel('Que prazo é este').fill('Contestação teste MUDADA');
    await page.keyboard.press('Escape');
    // Então
    await expect(mudar).toHaveCount(0);
    await expect(cartao).toBeVisible();
    await expect(lista(cartao)).toContainText('Contestação teste');
    await expect(lista(cartao)).not.toContainText('MUDADA');
    // Quando: Esc no "Novo prazo"
    await novoPrazo(cartao).click();
    await cartao.getByRole('form', { name: 'Novo prazo' }).getByLabel('Que prazo é este').fill('Rascunho');
    await page.keyboard.press('Escape');
    // Então
    await expect(cartao.getByRole('form', { name: 'Novo prazo' })).toHaveCount(0);
    await expect(cartao).toBeVisible();
  });

  test('dado um prazo escrito e não lançado, quando a pessoa fecha o cartão pelo X, então o SEMPER pergunta antes', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    await novoPrazo(cartao).click();
    await cartao.getByRole('form', { name: 'Novo prazo' }).getByLabel('Que prazo é este').fill('Rascunho que vai sumir');
    // Quando
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    // Então
    const pergunta = page.getByRole('dialog', { name: 'Sair sem salvar?' });
    await expect(pergunta).toBeVisible();
    await pergunta.getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(cartao.getByRole('form', { name: 'Novo prazo' }).getByLabel('Que prazo é este')).toHaveValue('Rascunho que vai sumir');
  });

  test('dado o prazo A mudado e não salvo, quando a pessoa clica em "Mudar" no prazo B ou no "+" dos prazos, então o A continua aberto, com o que ela escreveu, e lembra de salvar ou cancelar', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    await lancar(cartao, 'Prazo A', '01/12/2026');
    await lancar(cartao, 'Prazo B', '05/12/2026');
    await lista(cartao).getByRole('button', { name: 'Mudar o prazo Prazo A' }).click();
    const mudar = cartao.getByRole('form', { name: 'Mudar prazo' });
    await mudar.getByLabel('Último dia').fill('15/01/2027');
    // Quando
    await lista(cartao).getByRole('button', { name: 'Mudar o prazo Prazo B' }).click();
    // Então
    await expect(cartao.getByRole('form', { name: 'Mudar prazo' })).toHaveCount(1);
    await expect(mudar.getByLabel('Último dia')).toHaveValue('15/01/2027');
    await expect(mudar.getByRole('status').filter({ hasText: 'Salve ou cancele' })).toBeVisible();
    // Quando: o "+" do título dos prazos
    await cartao.getByRole('button', { name: 'Novo prazo', exact: true }).first().click();
    // Então
    await expect(cartao.getByRole('form', { name: 'Novo prazo' })).toHaveCount(0);
    await expect(mudar.getByLabel('Último dia')).toHaveValue('15/01/2027');
  });

  test('quando a pessoa abre o calendário da intimação, então ele abre dentro do formulário, embaixo da data, sem cobrir os outros campos', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    await novoPrazo(cartao).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    // Quando
    await form.getByLabel('Intimação').click();
    // Então
    const cal = form.getByRole('dialog', { name: 'Calendário' });
    await expect(cal).toBeVisible();
    expect((await cal.boundingBox())!.y).toBeGreaterThan((await form.getByLabel('Intimação').boundingBox())!.y);
    expect(await aVista(form.getByLabel('Que prazo é este'))).toBe(true);
    expect(await aVista(form.getByLabel('Dias', { exact: true }))).toBe(true);
    expect(await aVista(form.getByRole('button', { name: 'Lançar prazo' }))).toBe(true);
  });

  test('quando a pessoa escreve uma intimação que não existe, então o campo fica marcado com "Data inexistente."', async ({ page }) => {
    // Dado
    const cartao = await abrirProcesso(page);
    await novoPrazo(cartao).click();
    const form = cartao.getByRole('form', { name: 'Novo prazo' });
    // Quando
    await form.getByLabel('Intimação').fill('31/02/2026');
    // Então
    await expect(form.getByLabel('Intimação')).toHaveAttribute('aria-invalid', 'true');
    await expect(form.getByText('Data inexistente.')).toBeVisible();
  });
});

test.describe('Dado o contrato (#395)', () => {
  /** Abre o cartão do contrato do José. */
  async function abrirContrato(page: Page) {
    await page.goto('/contratos/');
    await page.getByRole('button', { name: 'Tabela', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).first().click();
    const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 }) });
    await expect(cartao).toBeVisible();
    return cartao;
  }
  const assinatura = (cartao: Locator) => cartao.getByRole('button', { name: /^Data da assinatura: / });

  test('quando a pessoa clica em "Assinado em", então muda a data ali mesmo, como o início da tarefa, e ela fica ao fechar e abrir', async ({ page }) => {
    // Dado
    let cartao = await abrirContrato(page);
    // Quando
    await assinatura(cartao).click();
    const formulario = cartao.getByRole('group', { name: 'Mudar a data da assinatura' });
    await formulario.getByRole('textbox', { name: 'Data da assinatura' }).fill('02/02/2026');
    await formulario.getByRole('button', { name: 'Salvar' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: 'Contrato atualizado.' })).toBeVisible();
    await expect(assinatura(cartao)).toHaveText('02/02/2026');
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    cartao = await abrirContrato(page);
    await expect(assinatura(cartao)).toHaveText('02/02/2026');
  });

  test('dado o lápis com a assinatura mudada, quando a pessoa aperta Esc ou clica no X, então o SEMPER pergunta antes de perder a mudança', async ({ page }) => {
    // Dado
    const cartao = await abrirContrato(page);
    await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar contrato' });
    await edicao.getByRole('textbox', { name: 'Assinado em' }).fill('02/02/2026');
    // Quando: Esc com o calendário fechado
    await edicao.getByRole('textbox', { name: 'Assinado em' }).press('Escape');
    // Então
    const pergunta = page.getByRole('dialog', { name: 'Sair sem salvar?' });
    await expect(pergunta).toBeVisible();
    await pergunta.getByRole('button', { name: 'Continuar no cadastro' }).click();
    await expect(edicao.getByRole('textbox', { name: 'Assinado em' })).toHaveValue('02/02/2026');
    // Quando: o X
    await cartao.getByRole('button', { name: 'Fechar' }).click();
    // Então
    await expect(pergunta).toBeVisible();
  });

  test('dada a assinatura mudada e não salva, quando a pessoa clica no lápis Editar, então a data continua aberta com o que ela escreveu e lembra de salvar ou cancelar', async ({ page }) => {
    // Dado
    const cartao = await abrirContrato(page);
    await assinatura(cartao).click();
    const formulario = cartao.getByRole('group', { name: 'Mudar a data da assinatura' });
    await formulario.getByRole('textbox', { name: 'Data da assinatura' }).fill('02/02/2026');
    // Quando
    await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
    // Então
    await expect(cartao.getByRole('form', { name: 'Editar contrato' })).toHaveCount(0);
    await expect(formulario.getByRole('status')).toHaveText('Salve ou cancele esta mudança antes de abrir outra.');
    await expect(formulario.getByRole('textbox', { name: 'Data da assinatura' })).toHaveValue('02/02/2026');
  });

  test('no celular, quando a pessoa abre o calendário da assinatura no lápis, então ele não cobre o nome do campo', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 375, height: 812 });
    const cartao = await abrirContrato(page);
    await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
    const edicao = cartao.getByRole('form', { name: 'Editar contrato' });
    const campo = edicao.getByRole('textbox', { name: 'Assinado em' });
    await campo.scrollIntoViewIfNeeded();
    // Quando
    await campo.click();
    // Então
    await expect(calendario(page)).toBeVisible();
    await esperarParar(calendario(page));
    expect((await calendario(page).boundingBox())!.y).toBeGreaterThan((await campo.boundingBox())!.y);
    expect(await edicao.getByText('Assinado em', { exact: true }).evaluate(el => {
      const r = el.getBoundingClientRect();
      const noPonto = el.ownerDocument.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!noPonto && (noPonto === el || el.contains(noPonto));
    })).toBe(true);
  });
});
