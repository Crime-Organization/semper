// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O menu lateral (#404): o cadastro de compromisso no menu e o número de mensagens não lidas na coluna dos "+". Desde a #435, a seta
// da Agenda fica na coluna dos "+", e o cadastro de compromisso é a primeira opção do submenu ("Novo compromisso"), não mais um "+".
// No banco fictício, quem está logado é o Mauro (administrador), num escritório com todos os módulos; a Ana é advogada.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

const CHAVE = 'semper-dados-falsos';
const AGORA = new Date('2026-11-04T12:00:00-03:00');
const HOJE = '04/11/2026';
/** A largura do celular em que o menu vira a gaveta que abre por cima. */
const CELULAR = { width: 375, height: 812 };
const COMPUTADOR = { width: 1280, height: 800 };
/** Quanto os meios podem diferir, em pixels: o arredondamento do navegador. */
const FOLGA_DO_EIXO = 0.5;

const menu = (page: Page) => page.getByRole('navigation', { name: 'Seções' });
const agenda = (page: Page) => menu(page).getByRole('button', { name: 'Agenda e calendário' });
const novoCompromisso = (page: Page) => menu(page).getByRole('link', { name: 'Novo compromisso' });
/** Abre o submenu da Agenda (fechado na semente) e devolve o "Novo compromisso". */
async function abrirNovoCompromisso(page: Page) {
  await agenda(page).click();
  await expect(agenda(page)).toHaveAttribute('aria-expanded', 'true');
  return novoCompromisso(page);
}

/** O meio de um elemento na horizontal. */
const meioNaHorizontal = async (alvo: Locator) => {
  const caixa = await alvo.evaluate(el => el.getBoundingClientRect().toJSON() as DOMRect);
  return caixa.left + caixa.width / 2;
};

/** Os módulos do escritório da semente, todos ligados (a semente não os guarda: o banco fictício os liga todos). */
const MODULOS = { pessoas: true, contratos: true, demandas: true, tarefas: true, processos: true, compromissos: true, anotacoes: true, financeiro: true };
/** Desliga um módulo do escritório no banco fictício da aba, com os outros ligados, e recarrega a tela. */
async function desligarModulo(page: Page, modulo: string) {
  await page.evaluate(([chave, m, todos]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as { escritorio: { modulos?: Record<string, boolean> } };
    bd.escritorio = { ...bd.escritorio, modulos: { ...todos, ...bd.escritorio.modulos, [m]: false } };
    sessionStorage.setItem(chave, JSON.stringify(bd));
  }, [CHAVE, modulo, MODULOS] as const);
  await page.reload();
}

/** Comenta no cartão do JOSÉ, como o Mauro, citando a Ana: ela fica com uma mensagem não lida. */
async function mensagemParaAna(page: Page) {
  await page.goto('/pessoas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
  const cartao = page.getByRole('dialog');
  await abrirSecao(cartao, 'Comentários');
  await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Ver os documentos, @ana.lima até sexta');
  await cartao.getByRole('button', { name: 'Comentar' }).click();
  await expect(cartao.getByRole('listitem', { name: /Comentário de/ }).first()).toContainText('Ver os documentos');
  await entrarComo(page, 'u-ana');
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA);
});

test.describe('O "Novo compromisso" no submenu da Agenda', () => {
  test('dado o escritório com Compromissos, quando a pessoa abre a Agenda no menu, então o "Novo compromisso" é a primeira opção', async ({ page }) => {
    // Dado
    await page.goto('/tarefas/');
    await expect(agenda(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(novoCompromisso(page)).toBeHidden();
    // Quando
    const novo = await abrirNovoCompromisso(page);
    // Então
    await expect(novo).toBeVisible();
    await expect(novo).toHaveText('Novo compromisso');
    const opcoes = page.locator(`[id="${await agenda(page).getAttribute('aria-controls')}"]`).getByRole('link');
    await expect(opcoes).toHaveText(['Novo compromisso', 'Agenda', 'Feriados e prazos']);
  });

  test('dado a pessoa em Pessoas, quando clica em "Novo compromisso" e o salva, então volta para Pessoas, e o compromisso está na Agenda', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    // Quando
    await (await abrirNovoCompromisso(page)).click();
    const janela = page.getByRole('dialog');
    await janela.getByLabel('Título').fill('Reunião pelo menu');
    await janela.getByLabel('Data').fill(HOJE);
    await janela.getByLabel('Hora').fill('10:30');
    for (let i = 0; i < 3; i++) await janela.getByRole('button', { name: 'Próxima' }).click();
    await janela.getByRole('button', { name: 'Salvar compromisso' }).click();
    // Então
    await expect(page.getByRole('status').filter({ hasText: /Compromisso .+ cadastrado\./ })).toBeVisible();
    await expect(page).toHaveURL(/\/pessoas\/$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Pessoas', level: 1 })).toBeVisible();
    // E o compromisso está na Agenda
    await page.goto('/agenda/');
    await expect(page.getByText('Reunião pelo menu').first()).toBeVisible();
  });

  test('dado o cadastro aberto pelo menu, quando a pessoa o fecha sem salvar, então continua onde estava', async ({ page }) => {
    // Dado
    await page.goto('/demandas/');
    await (await abrirNovoCompromisso(page)).click();
    await expect(page.getByRole('dialog').getByLabel('Título')).toBeVisible();
    // Quando
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
    // Então
    await expect(page).toHaveURL(/\/demandas\/$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('dado o escritório sem o módulo Compromissos, quando a pessoa abre a Agenda no menu, então não há "Novo compromisso"', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    await desligarModulo(page, 'compromissos');
    // Quando
    await agenda(page).click();
    // Então
    await expect(menu(page).getByRole('link', { name: 'Feriados e prazos' })).toBeVisible();
    await expect(novoCompromisso(page)).toHaveCount(0);
    await expect(menu(page).getByRole('link', { name: 'Cadastrar tarefa' })).toBeVisible();
  });
});

test.describe('O número de mensagens não lidas no menu lateral', () => {
  const telas = [
    { nome: 'no computador, no claro', tamanho: COMPUTADOR, tema: 'light' },
    { nome: 'no computador, no escuro', tamanho: COMPUTADOR, tema: 'dark' },
    { nome: 'no celular, no claro', tamanho: CELULAR, tema: 'light' },
    { nome: 'no celular, no escuro', tamanho: CELULAR, tema: 'dark' }
  ] as const;

  for (const tela of telas) {
    test(`dada uma mensagem não lida, quando o menu mostra o número, então ele fica no meio da coluna dos "+", ${tela.nome}`, async ({ page }) => {
      // Dado
      await mensagemParaAna(page);
      await page.setViewportSize(tela.tamanho);
      await page.emulateMedia({ colorScheme: tela.tema });
      // Quando
      await page.goto('/inicio/');
      if (tela.tamanho === CELULAR) {
        await page.getByRole('button', { name: 'Abrir menu' }).click();
        // A gaveta entra deslizando: mede depois que ela para, encostada na esquerda.
        await expect.poll(() => page.getByRole('complementary', { name: 'Menu' }).evaluate(el => el.getBoundingClientRect().left)).toBe(0);
      }
      const mensagens = menu(page).getByRole('link', { name: 'Mensagens, 1 não lida' });
      await expect(mensagens).toBeVisible();
      // Então
      const numero = mensagens.getByText('1', { exact: true });
      const eixo = await meioNaHorizontal(menu(page).getByRole('link', { name: 'Cadastrar pessoa' }));
      expect(Math.abs(await meioNaHorizontal(numero) - eixo)).toBeLessThanOrEqual(FOLGA_DO_EIXO);
      expect(Math.abs(await meioNaHorizontal(menu(page).getByRole('link', { name: 'Cadastrar tarefa' })) - eixo)).toBeLessThanOrEqual(FOLGA_DO_EIXO);
    });
  }
});

// #435: o Início sai da lista e vira a casinha ao lado do nome do escritório, uma bolinha igual aos "+"; a lista segue a ordem nova;
// as setas de Processos e da Agenda ficam na coluna dos "+".
const lateral = (page: Page) => page.getByRole('complementary', { name: 'Menu' });
const casinha = (page: Page) => lateral(page).getByRole('group', { name: 'Escritório Exemplo (teste)' }).getByRole('link', { name: 'Início', exact: true });
/** A ordem dos itens da lista do menu, pedida pelo dono (#435). */
const ORDEM_DO_MENU = ['Mensagens', 'Pessoas', 'Tarefas', 'Agenda e calendário', 'Documentos', 'Contratos', 'Demandas', 'Processos',
  'Financeiro', 'Equipe e acessos', 'Configurações'];
/** Os nomes dos itens da lista, na ordem da tela: os links e os botões de submenu (fechados), sem os "+" de cadastrar. */
const itensDoMenu = async (page: Page) => (await menu(page).getByRole('link').or(menu(page).getByRole('button'))
  .evaluateAll(els => els.map(el => el.getAttribute('aria-label') || el.textContent?.trim() || '')))
  .filter(nome => !nome.startsWith('Cadastrar'));
/** A seta de abrir e recolher de um submenu (para baixo, fechado; para cima, aberto). */
const setaDe = (botao: Locator) => botao.locator('[data-icone="abaixo"], [data-icone="acima"]');
/** No celular, abre a gaveta do menu e espera ela parar, encostada na esquerda. */
async function abrirGaveta(page: Page) {
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect.poll(() => lateral(page).evaluate(el => el.getBoundingClientRect().left)).toBe(0);
}

test.describe('A ordem do menu e a casinha do Início (#435)', () => {
  test('dado o administrador num escritório com todos os módulos, quando vê o menu, então os itens seguem a ordem nova, sem o Início', async ({ page }) => {
    // Quando
    await page.goto('/pessoas/');
    // Então
    await expect(menu(page).getByRole('link', { name: 'Início', exact: true })).toHaveCount(0);
    await expect.poll(() => itensDoMenu(page)).toEqual(ORDEM_DO_MENU);
  });

  test('dada a casinha ao lado do nome do escritório, quando a pessoa clica nela, então vai ao Início, e a casinha fica marcada', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    await expect(casinha(page)).not.toHaveAttribute('aria-current', 'page');
    await expect(casinha(page)).toHaveText('');
    // Quando
    await casinha(page).click();
    // Então
    await expect(page).toHaveURL(/\/inicio\/$/);
    await expect(casinha(page)).toHaveAttribute('aria-current', 'page');
  });

  for (const tela of [{ nome: 'no computador', tamanho: COMPUTADOR }, { nome: 'no celular', tamanho: CELULAR }] as const) {
    test(`dado o menu ${tela.nome}, quando a pessoa o vê, então a casinha e as setas de Processos e da Agenda ficam no meio da coluna dos "+"`, async ({ page }) => {
      // Dado
      await page.setViewportSize(tela.tamanho);
      const processos = menu(page).getByRole('button', { name: 'Processos' });
      // Quando
      await page.goto('/tarefas/');
      if (tela.tamanho === CELULAR) await abrirGaveta(page);
      // Então
      const eixo = await meioNaHorizontal(menu(page).getByRole('link', { name: 'Cadastrar pessoa' }));
      expect(Math.abs(await meioNaHorizontal(casinha(page)) - eixo)).toBeLessThanOrEqual(FOLGA_DO_EIXO);
      await expect(processos).toHaveAttribute('aria-expanded', 'false');
      expect(Math.abs(await meioNaHorizontal(setaDe(processos)) - eixo)).toBeLessThanOrEqual(FOLGA_DO_EIXO);
      await expect(agenda(page)).toHaveAttribute('aria-expanded', 'false');
      expect(Math.abs(await meioNaHorizontal(setaDe(agenda(page))) - eixo)).toBeLessThanOrEqual(FOLGA_DO_EIXO);
      // E a casinha é uma bolinha do tamanho dos "+", sem passar da ponta da coluna deles
      const caixa = (l: Locator) => l.evaluate(el => el.getBoundingClientRect().toJSON() as DOMRect);
      const mais = await caixa(menu(page).getByRole('link', { name: 'Cadastrar pessoa' }));
      const inicio = await caixa(casinha(page));
      expect([inicio.width, inicio.height]).toEqual([mais.width, mais.height]);
      expect(inicio.right).toBeLessThanOrEqual(mais.right + FOLGA_DO_EIXO);
      // Quando o submenu está aberto (a seta vira para cima)
      await page.goto('/processos/judicial/');
      if (tela.tamanho === CELULAR) await abrirGaveta(page);
      // Então a seta continua no eixo
      await expect(processos).toHaveAttribute('aria-expanded', 'true');
      expect(Math.abs(await meioNaHorizontal(setaDe(processos)) - eixo)).toBeLessThanOrEqual(FOLGA_DO_EIXO);
    });
  }
});
