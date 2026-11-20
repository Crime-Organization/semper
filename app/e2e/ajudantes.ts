// Ajudantes dos testes de ponta a ponta. O banco fictício começa com a sessão aberta
// (como Mateus, o master do escritório de exemplo) e é zerado a cada aba nova.
import { expect, type Locator, type Page } from '@playwright/test';

/** Sai pelo menu da barra lateral e espera a tela de entrada. */
export async function sair(page: Page) {
  await page.goto('/inicio/');
  await page.getByRole('complementary', { name: 'Menu' }).getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar\/?$/);
}

/** Abre uma seção pelo menu da barra lateral. */
export async function abrir(page: Page, secao: string) {
  await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: secao, exact: true }).click();
}

/**
 * Abre a janela de um usuário em Equipe e acessos (clicando no nome dele na tabela). Desde 07/11/2026, as ações de cada
 * usuário (nome, função, papel, sócio, e-mail, desativar) ficam nessa janela, e não mais na linha da tabela.
 */
export async function abrirUsuario(page: Page, nome: string) {
  await page.getByRole('region', { name: 'Usuários' }).getByRole('button', { name: `Abrir ${nome}` }).click();
  return page.getByRole('dialog', { name: nome });
}

/**
 * Uma ação do menu ⋯ de uma parcela (Mudar, Excluir, Estornar ou Corrigir). Excluir e estornar pedem confirmação numa
 * janela, que esta função confirma.
 */
export async function acaoDaParcela(page: Page, lugar: Page | Locator, acao: 'Mudar' | 'Excluir' | 'Estornar' | 'Corrigir', numero: number) {
  await lugar.getByRole('button', { name: `Mais ações da parcela ${numero}` }).click();
  await page.getByRole('menuitem', { name: `${acao} a parcela ${numero}` }).click();
  if (acao === 'Excluir' || acao === 'Estornar') await page.getByRole('dialog', { name: new RegExp(`^${acao}`) }).getByRole('button', { name: acao, exact: true }).click();
}

/**
 * As telas do Financeiro que não são abas da página principal, cada uma no seu endereço. O menu tem só o link do
 * Financeiro (desde 07/11/2026): elas se abrem pelos atalhos das abas, e o teste vai direto ao endereço.
 */
const TELAS_DO_FINANCEIRO: Record<string, string> = {
  Caixa: '/financeiro/contas/', 'Conferência': '/conferencia/', 'Lucro dos sócios': '/lucros/', 'Meus valores': '/meus-valores/', Parcelas: '/parcelas/'
};
export async function abrirNoFinanceiro(page: Page, tela: string) {
  await page.goto(TELAS_DO_FINANCEIRO[tela]);
}

/**
 * Abre uma seção recolhível do cartão pelo título (toda seção começa recolhida; a escolha fica guardada para os
 * próximos cartões). Se já estiver aberta, deixa como está. O título pode vir seguido do contador ("Pessoas 1").
 */
export async function abrirSecao(lugar: Page | Locator, titulo: string) {
  const botao = lugar.getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) });
  await expect(botao).toBeVisible();
  if (await botao.getAttribute('aria-expanded') === 'false') await botao.click();
  await expect(botao).toHaveAttribute('aria-expanded', 'true');
}

/**
 * Põe alguém da equipe como participante do contrato (na etapa Divisão ou na edição pelo cartão): "+ Adicionar participante"
 * abre a busca só na equipe (#348), e o nome é o da equipe ("Bruno Exemplo Souza"), não o do cadastro em Pessoas.
 */
export async function adicionarParticipante(lugar: Page | Locator, busca: string, nome: string) {
  await lugar.getByRole('group', { name: 'Participantes' }).getByRole('button', { name: 'Adicionar participante' }).click();
  await lugar.getByRole('textbox', { name: 'Buscar na equipe: adicionar participante' }).fill(busca);
  await lugar.getByRole('list', { name: 'Equipe' }).getByRole('button', { name: nome, exact: true }).click();
}

/**
 * A altura de um elemento, medida depois de terminarem as animações dele e de quem o contém. Durante a entrada de uma
 * etapa, o navegador tira a altura da conta "fundo menos topo" com posições fracionadas, e 48 pode vir como 47,99997.
 */
export async function alturaParada(alvo: Locator) {
  await alvo.evaluate(async el => {
    const animacoes = el.ownerDocument.getAnimations().filter(a => (a.effect as KeyframeEffect | null)?.target?.contains(el));
    await Promise.allSettled(animacoes.map(a => a.finished));
  });
  return (await alvo.boundingBox())!.height;
}

/** Passa a usar o banco fictício como outra conta da equipe ('u-bruno' é estagiário e não é administrador) e abre a tela inicial de novo. */
export async function entrarComo(page: Page, id: string) {
  await page.goto('/inicio/');
  await page.evaluate(conta => (window as unknown as { SEMPER_FALSO: { entrarComo(id: string): void } }).SEMPER_FALSO.entrarComo(conta), id);
  await page.goto('/inicio/');
}

/** O alvo mínimo do dedo em cada controle (o "alvo mínimo de 44px em controles" do DESIGN.md, o --alvo-de-toque). */
export const ALVO_DE_TOQUE = 44;
/** A barra de formatação de um texto (B, I, listas, link), pelo nome dela. */
export const barraDeFormatacao = (lugar: Page | Locator) => lugar.getByRole('toolbar', { name: 'Formatação do texto' }).first();
/** O lugar e o tamanho de cada botão da barra de formatação, na ordem em que aparecem, com o nome de cada um. */
export const botoesDaBarra = (barra: Locator) => barra.getByRole('button').evaluateAll(botoes => botoes.map(b => {
  const { x, y, width, height } = b.getBoundingClientRect();
  return { nome: b.getAttribute('aria-label')!, x, y, width, height };
}));
/**
 * Confere a barra de formatação na caixa estreita do celular (#374): os botões em duas linhas equilibradas (uma com no máximo um
 * botão a mais que a outra, então nenhum fica sozinho embaixo), cada um um alvo do dedo de pelo menos ALVO_DE_TOQUE de largura e
 * de altura, sem se sobrepor aos vizinhos, dentro da barra, e todos à vista na tela.
 */
export async function barraEquilibradaNoCelular(barra: Locator) {
  const [b, botoes] = [(await barra.boundingBox())!, await botoesDaBarra(barra)];
  expect(botoes.length).toBeGreaterThan(1);
  const linhas = [...new Set(botoes.map(x => Math.round(x.y)))].map(y => botoes.filter(x => Math.round(x.y) === y));
  expect(linhas.length).toBe(2);
  const tamanhos = linhas.map(l => l.length);
  expect(Math.max(...tamanhos) - Math.min(...tamanhos)).toBeLessThanOrEqual(1);
  for (const x of botoes) {
    expect(x.width, x.nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE);
    expect(x.height, x.nome).toBeGreaterThanOrEqual(ALVO_DE_TOQUE);
    expect(x.x, x.nome).toBeGreaterThanOrEqual(b.x);
    expect(x.x + x.width, x.nome).toBeLessThanOrEqual(b.x + b.width);
  }
  for (const linha of linhas) for (let i = 1; i < linha.length; i++) expect(linha[i].x, linha[i].nome).toBeGreaterThanOrEqual(linha[i - 1].x + linha[i - 1].width);
  for (const nome of botoes.map(x => x.nome)) await expect(barra.getByRole('button', { name: nome, exact: true })).toBeInViewport({ ratio: 1 });
}

/**
 * O menu ⋯ do topo do cartão aberto (#382: "Mais ações da tarefa", "Mais ações do contrato"…). Procura só dentro do cartão: a
 * página do módulo tem o ⋯ dela ("Mais ações"), atrás da janela.
 */
export const menuDoCartao = (cartao: Locator) => cartao.getByRole('button', { name: /^Mais ações d[aeo] / });

/**
 * Escolhe uma ação no menu ⋯ do topo do cartão (desde a #382, Arquivar, Desarquivar e Excluir moram lá). O menu abre por cima da
 * página, fora do cartão: a ação é achada no menu que tem o nome do ⋯ deste cartão, e não em qualquer menu da página.
 */
export async function acaoNoMenuDoCartao(page: Page, cartao: Locator, acao: 'Arquivar' | 'Desarquivar' | 'Excluir') {
  const mais = menuDoCartao(cartao);
  const nome = await mais.getAttribute('aria-label');
  await mais.click();
  await page.getByRole('menu', { name: nome ?? undefined }).getByRole('menuitem', { name: acao, exact: true }).click();
}

/** As ações que o menu ⋯ do topo do cartão oferece (abre o menu e o fecha de novo com o Esc, que fecha só o menu). */
export async function acoesNoMenuDoCartao(page: Page, cartao: Locator) {
  const mais = menuDoCartao(cartao);
  const nome = await mais.getAttribute('aria-label');
  await mais.click();
  const itens = (await page.getByRole('menu', { name: nome ?? undefined }).getByRole('menuitem').allTextContents()).map(t => t.trim());
  await page.keyboard.press('Escape');
  return itens;
}
