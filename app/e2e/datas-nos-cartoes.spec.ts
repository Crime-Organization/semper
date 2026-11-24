// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A edição das datas nos cartões (#395, refeita na #422): as datas abrem numa janela que flutua sobre o cartão, como a das
// etiquetas, e nada é empurrado no cartão; a janela cabe na tela, com o calendário do mês, os campos e o Salvar ao alcance; o Esc
// e o clique fora fecham sem gravar; o mesmo jeito no início, no prazo, na data do compromisso e na assinatura do contrato. Os
// prazos do processo continuam com o formulário deles (#395), e o calendário dos campos de data abre dentro dele.
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
/** A distância entre duas coisas da tela. */
const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: b.x - a.x, y: b.y - a.y });
/** Duas caixas da tela se cruzam (uma cobre parte da outra)? */
const seCruzam = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
/** A coisa cabe inteira na tela, de cima a baixo e de um lado ao outro. */
async function cabeNaTela(page: Page, local: Locator) {
  const caixa = (await local.boundingBox())!, tela = page.viewportSize()!;
  return caixa.y >= 0 && caixa.x >= 0 && caixa.y + caixa.height <= tela.height && caixa.x + caixa.width <= tela.width;
}

const TELAS = [{ nome: 'computador', viewport: { width: 1300, height: 900 } }, { nome: 'celular', viewport: { width: 375, height: 812 } }];
const CARTOES = [
  { modulo: 'tarefas', titulo: 'Emitir a GRU', prazo: 'Prazo', criacao: 'Criada em' },
  { modulo: 'demandas', titulo: 'Notificar o devedor', prazo: 'Prazo de entrega', criacao: 'Criada em' }
];
/** A janela das datas (#422): flutua sobre o cartão, e por isso é achada na página. */
const janelaDasDatas = (page: Page) => page.getByRole('dialog', { name: 'Mudar as datas' });

for (const c of CARTOES) {
  const faixa = (cartao: Locator) => cartao.getByRole('group', { name: 'Datas do cartão', exact: true });
  const dado = (cartao: Locator, nome: string) => faixa(cartao).getByRole('group', { name: nome, exact: true });
  const datas = (cartao: Locator) => cartao.getByRole('button', { name: /^Datas: / });

  for (const tela of TELAS) {
    test.describe(`Dado o cartão (${c.modulo}) no ${tela.nome} (#422)`, () => {
      test.use({ viewport: tela.viewport });

      test('quando a pessoa clica em "Datas", então a janela flutua sobre o cartão, inteira na tela, sem cobrir o resumo das datas, e nada no cartão é empurrado', async ({ page }) => {
        // Dado
        const cartao = await abrirCartao(page, c.modulo, c.titulo);
        const antes = distancia(await posicao(dado(cartao, c.criacao)), await posicao(dado(cartao, 'Datas')));
        // Quando
        await datas(cartao).click();
        // Então: a janela, com o calendário, abre por cima, sem empurrar nada no cartão (a regra mudou na #431: para a janela não
        // cobrir o resumo, o cartão pode rolar; por isso conta a distância entre as datas, e não o lugar delas na tela)
        const janela = janelaDasDatas(page);
        await expect(janela.getByRole('group', { name: 'Calendário' })).toBeVisible();
        await esperarParar(janela);
        expect(distancia(await posicao(dado(cartao, c.criacao)), await posicao(dado(cartao, 'Datas')))).toEqual(antes);
        expect(await cabeNaTela(page, janela)).toBe(true);
        expect(seCruzam((await janela.boundingBox())!, (await datas(cartao).boundingBox())!)).toBe(false);
        // E o que se muda está à vista e ao alcance: o início, a entrega, a hora, o lembrete e Salvar
        for (const campo of [janela.getByRole('textbox', { name: 'Data de início' }), janela.getByRole('textbox', { name: c.prazo, exact: true }),
          janela.getByLabel(`Hora do ${c.prazo.toLowerCase()}`), janela.getByRole('combobox', { name: 'Lembrete' }), janela.getByRole('button', { name: 'Salvar' })]) {
          expect(await aVista(campo)).toBe(true);
        }
      });
    });
  }

  test.describe(`Dado o cartão (${c.modulo}) (#422)`, () => {
    test('numa janela baixa de notebook, quando a pessoa abre as datas, então a janela cabe na tela e o Salvar é alcançável', async ({ page }) => {
      // Dado
      await page.setViewportSize({ width: 1366, height: 650 });
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      // Quando
      await datas(cartao).click();
      // Então (desde a #431, sem o "Hoje" no calendário da janela: o dia de hoje fica marcado na grade)
      const janela = janelaDasDatas(page);
      await esperarParar(janela);
      expect(await cabeNaTela(page, janela)).toBe(true);
      await expect(janela.getByRole('button', { name: 'Hoje', exact: true })).toHaveCount(0);
      expect(await aVista(janela.getByRole('button', { name: 'Salvar' }))).toBe(true);
    });

    test('numa tela de notebook (1366x768), quando a pessoa abre as datas, então a janela cabe inteira sem rolar, a caixa de marcar fica na linha do campo, com o nome em cima, e Salvar e Remover ocupam a largura toda, um embaixo do outro (#431)', async ({ page }) => {
      // Dado
      await page.setViewportSize({ width: 1366, height: 768 });
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      // Quando
      await datas(cartao).click();
      // Então: inteira na tela, sem rolar por dentro
      const janela = janelaDasDatas(page);
      await esperarParar(janela);
      expect(await cabeNaTela(page, janela)).toBe(true);
      expect(await janela.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
      // E a caixa da entrega na mesma linha do campo, antes dele, com o nome em cima (nada por cima de nada)
      const caixa = (await janela.getByRole('checkbox', { name: 'Data de entrega' }).boundingBox())!;
      const campo = (await janela.getByRole('textbox', { name: c.prazo, exact: true }).boundingBox())!;
      const nome = (await janela.getByText('Data de entrega', { exact: true }).boundingBox())!;
      expect(Math.abs((caixa.y + caixa.height / 2) - (campo.y + campo.height / 2))).toBeLessThanOrEqual(1);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(campo.x);
      expect(nome.y + nome.height).toBeLessThanOrEqual(Math.min(caixa.y, campo.y));
      // E a hora ao lado da data, numa lista de horários
      const hora = janela.getByRole('combobox', { name: `Hora do ${c.prazo.toLowerCase()}` });
      const caixaDaHora = (await hora.boundingBox())!;
      expect(Math.abs(caixaDaHora.y - campo.y)).toBeLessThanOrEqual(1);
      expect(caixaDaHora.x).toBeGreaterThanOrEqual(campo.x + campo.width);
      // E Salvar em cima de Remover, os dois da largura do calendário
      const largura = (await janela.getByRole('group', { name: 'Calendário' }).boundingBox())!.width;
      const salvar = (await janela.getByRole('button', { name: 'Salvar' }).boundingBox())!;
      const remover = (await janela.getByRole('button', { name: 'Remover' }).boundingBox())!;
      expect(Math.round(salvar.width)).toBe(Math.round(largura));
      expect(Math.round(remover.width)).toBe(Math.round(largura));
      expect(remover.y).toBeGreaterThanOrEqual(salvar.y + salvar.height);
    });

    for (const tela of [{ nome: 'notebook', viewport: { width: 1366, height: 768 } }, { nome: 'celular', viewport: { width: 390, height: 844 } }]) {
      test(`no ${tela.nome}, quando a pessoa abre as datas, então a janela não cobre o resumo que a abriu nem o lápis, e no celular fica no meio, com a mesma folga dos dois lados (#431)`, async ({ page }) => {
        // Dado
        await page.setViewportSize(tela.viewport);
        const cartao = await abrirCartao(page, c.modulo, c.titulo);
        // Quando
        await datas(cartao).click();
        // Então
        const janela = janelaDasDatas(page);
        await esperarParar(janela);
        const caixa = (await janela.boundingBox())!;
        expect(seCruzam(caixa, (await datas(cartao).boundingBox())!)).toBe(false);
        expect(seCruzam(caixa, (await cartao.getByRole('button', { name: 'Editar', exact: true }).boundingBox())!)).toBe(false);
        expect(await cabeNaTela(page, janela)).toBe(true);
        if (tela.nome === 'celular') expect(Math.abs(caixa.x - (tela.viewport.width - caixa.x - caixa.width))).toBeLessThanOrEqual(1);
      });
    }

    test('dada a janela aberta, quando a pessoa aperta Esc, então só a janela fecha, sem mudar nada, o foco volta às datas, e o cartão continua aberto', async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      const antes = await datas(cartao).textContent();
      await datas(cartao).click();
      await janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' }).fill('08/08/2027');
      // Quando
      await page.keyboard.press('Escape');
      // Então
      await expect(janelaDasDatas(page)).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'Sair sem salvar?' })).toHaveCount(0);
      await expect(datas(cartao)).toHaveText(antes!);
      await expect(datas(cartao)).toBeFocused();
      await expect(cartao).toBeVisible();
    });

    test('dada a janela aberta com uma data que não existe, quando a pessoa salva, então o campo fica marcado, a mensagem aparece e nada é gravado', async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      const antes = await datas(cartao).textContent();
      await datas(cartao).click();
      const campo = janelaDasDatas(page).getByRole('textbox', { name: 'Data de início' });
      // Quando
      await campo.fill('31/02/2026');
      await campo.press('Enter');
      // Então
      await expect(janelaDasDatas(page).getByRole('alert')).toHaveText('Data inexistente.');
      await expect(campo).toHaveAttribute('aria-invalid', 'true');
      await expect(datas(cartao)).toHaveText(antes!);
    });

    test('dada a janela aberta, quando a pessoa clica fora dela (no título) e depois no lápis Editar, então a janela fecha sem gravar e o lápis abre', async ({ page }) => {
      // Dado
      const cartao = await abrirCartao(page, c.modulo, c.titulo);
      const antes = await datas(cartao).textContent();
      await datas(cartao).click();
      await janelaDasDatas(page).getByRole('textbox', { name: c.prazo, exact: true }).fill('04/04/2031');
      // Quando: a janela flutua por cima do topo do cartão; o clique fora dela a fecha, e aí o lápis fica ao alcance
      await cartao.getByRole('heading', { name: c.titulo, level: 2 }).click({ position: { x: 1, y: 1 } });
      await expect(janelaDasDatas(page)).toHaveCount(0);
      await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
      // Então
      await expect(janelaDasDatas(page)).toHaveCount(0);
      await expect(cartao.getByRole('form', { name: /^Editar / })).toBeVisible();
      await cartao.getByRole('form', { name: /^Editar / }).getByRole('button', { name: 'Cancelar' }).click();
      await expect(datas(cartao)).toHaveText(antes!);
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

test.describe('Dado o compromisso (#422)', () => {
  const quando = (cartao: Locator) => cartao.getByRole('button', { name: /^Data e horário: / });
  const janela = (page: Page) => page.getByRole('dialog', { name: 'Mudar a data e o horário' });
  const criado = (cartao: Locator) => cartao.getByRole('group', { name: 'Datas do cartão', exact: true }).getByRole('group', { name: 'Criado em', exact: true });

  for (const tela of TELAS) {
    test(`no ${tela.nome}, quando a pessoa clica na data e no horário, então a janela abre sobre o cartão, sem cobrir a data, com o calendário, a data, a hora, o "Até" e o Salvar à vista, e "Criado em" fica junto da data`, async ({ page }) => {
      // Dado
      await page.setViewportSize(tela.viewport);
      const cartao = await abrirCompromisso(page, 'Reunião de equipe');
      const antes = distancia(await posicao(quando(cartao)), await posicao(criado(cartao)));
      // Quando
      await quando(cartao).click();
      // Então (a regra mudou na #431: para a janela não cobrir a data, o cartão pode rolar; conta a distância, e não o lugar na tela)
      await expect(janela(page).getByRole('group', { name: 'Calendário' })).toBeVisible();
      await esperarParar(janela(page));
      expect(distancia(await posicao(quando(cartao)), await posicao(criado(cartao)))).toEqual(antes);
      expect(seCruzam((await janela(page).boundingBox())!, (await quando(cartao).boundingBox())!)).toBe(false);
      expect(await cabeNaTela(page, janela(page))).toBe(true);
      for (const campo of [janela(page).getByRole('textbox', { name: 'Data' }), janela(page).getByLabel('Hora do compromisso'), janela(page).getByLabel('Até'),
        janela(page).getByRole('button', { name: 'Salvar' })]) {
        expect(await aVista(campo)).toBe(true);
      }
    });
  }

  test('quando a pessoa usa só o teclado, então abre a janela com Enter, o foco vai à data, e o Tab passa pela hora', async ({ page }) => {
    // Dado
    const cartao = await abrirCompromisso(page, 'Reunião de equipe');
    await quando(cartao).focus();
    // Quando
    await page.keyboard.press('Enter');
    // Então
    await expect(janela(page).getByRole('textbox', { name: 'Data' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(janela(page).getByLabel('Hora do compromisso')).toBeFocused();
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

test.describe('Dado o contrato (#395, #422)', () => {
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

  test('quando a pessoa clica em "Assinado em", então muda a data na janela das datas, como a tarefa, e ela fica ao fechar e abrir', async ({ page }) => {
    // Dado
    let cartao = await abrirContrato(page);
    // Quando
    await assinatura(cartao).click();
    const formulario = page.getByRole('dialog', { name: 'Mudar a data da assinatura' });
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

  test('dada a assinatura mudada e não salva, quando a pessoa clica no lápis Editar, então a janela fecha sem gravar e o lápis abre', async ({ page }) => {
    // Dado
    const cartao = await abrirContrato(page);
    const antes = await assinatura(cartao).textContent();
    await assinatura(cartao).click();
    const formulario = page.getByRole('dialog', { name: 'Mudar a data da assinatura' });
    await formulario.getByRole('textbox', { name: 'Data da assinatura' }).fill('02/02/2026');
    // Quando
    await cartao.getByRole('button', { name: 'Editar', exact: true }).click();
    // Então
    await expect(formulario).toHaveCount(0);
    await expect(cartao.getByRole('form', { name: 'Editar contrato' })).toBeVisible();
    await expect(assinatura(cartao)).toHaveCount(0);
    expect(antes).not.toBe('02/02/2026');
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
