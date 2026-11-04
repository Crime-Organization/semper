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

/** Abre uma tela de dentro do submenu Financeiro, que começa recolhido e abre sozinho nas telas dele. */
export async function abrirNoFinanceiro(page: Page, tela: string) {
  const secoes = page.getByRole('navigation', { name: 'Seções' });
  const submenu = secoes.getByRole('button', { name: 'Financeiro' });
  if (await submenu.getAttribute('aria-expanded') !== 'true') await submenu.click();
  await secoes.getByRole('link', { name: tela, exact: true }).click();
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
