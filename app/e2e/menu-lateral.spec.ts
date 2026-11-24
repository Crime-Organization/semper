// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O menu lateral (#404): o "+" de cadastrar compromisso na linha da Agenda e o número de mensagens não lidas na coluna dos "+".
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
const maisDoCompromisso = (page: Page) => menu(page).getByRole('link', { name: 'Cadastrar compromisso' });

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

test.describe('O "+" de compromisso no menu lateral', () => {
  test('dado o escritório com Compromissos, quando a pessoa olha a linha da Agenda, então há o "+" na coluna dos outros', async ({ page }) => {
    // Quando
    await page.goto('/tarefas/');
    // Então
    const mais = maisDoCompromisso(page);
    await expect(mais).toBeVisible();
    await expect(mais).toHaveAttribute('title', 'Cadastrar compromisso');
    await expect(menu(page).getByRole('button', { name: 'Agenda e calendário' })).toHaveAttribute('aria-expanded', 'false');
    const eixo = await meioNaHorizontal(menu(page).getByRole('link', { name: 'Cadastrar tarefa' }));
    expect(Math.abs(await meioNaHorizontal(mais) - eixo)).toBeLessThanOrEqual(FOLGA_DO_EIXO);
    // E os "+" têm o mesmo tamanho
    const tamanho = (l: Locator) => l.evaluate(el => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]);
    expect(await tamanho(mais)).toEqual(await tamanho(menu(page).getByRole('link', { name: 'Cadastrar tarefa' })));
  });

  test('dado a pessoa em Pessoas, quando clica no "+" e salva o compromisso, então volta para Pessoas, e o compromisso está na Agenda', async ({ page }) => {
    // Dado
    await page.goto('/pessoas/');
    // Quando
    await maisDoCompromisso(page).click();
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

  test('dado o "+" aberto, quando a pessoa fecha o cadastro sem salvar, então continua onde estava', async ({ page }) => {
    // Dado
    await page.goto('/demandas/');
    await maisDoCompromisso(page).click();
    await expect(page.getByRole('dialog').getByLabel('Título')).toBeVisible();
    // Quando
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
    // Então
    await expect(page).toHaveURL(/\/demandas\/$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('dado o escritório sem o módulo Compromissos, quando o menu abre, então o "+" não aparece', async ({ page }) => {
    // Dado
    await page.goto('/inicio/');
    // Quando
    await desligarModulo(page, 'compromissos');
    // Então
    await expect(menu(page).getByRole('button', { name: 'Agenda e calendário' })).toBeVisible();
    await expect(maisDoCompromisso(page)).toHaveCount(0);
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
      expect(Math.abs(await meioNaHorizontal(maisDoCompromisso(page)) - eixo)).toBeLessThanOrEqual(FOLGA_DO_EIXO);
    });
  }
});

// #435: o Início sai da lista e vira a casinha ao lado do nome do escritório; a lista segue a ordem nova; a seta de Processos fica
// na coluna dos "+".
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
    test(`dado o menu ${tela.nome}, quando a pessoa o vê, então a casinha e a seta de Processos ficam no meio da coluna dos "+"`, async ({ page }) => {
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
      // Quando o submenu está aberto (a seta vira para cima)
      await page.goto('/processos/judicial/');
      if (tela.tamanho === CELULAR) await abrirGaveta(page);
      // Então a seta continua no eixo
      await expect(processos).toHaveAttribute('aria-expanded', 'true');
      expect(Math.abs(await meioNaHorizontal(setaDe(processos)) - eixo)).toBeLessThanOrEqual(FOLGA_DO_EIXO);
    });
  }
});
