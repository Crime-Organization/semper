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
 * Abre uma seção recolhível do cartão pelo título (toda seção começa recolhida; a escolha fica guardada para os
 * próximos cartões). Se já estiver aberta, deixa como está. O título pode vir seguido do contador ("Pessoas 1").
 */
export async function abrirSecao(lugar: Page | Locator, titulo: string) {
  const botao = lugar.getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) });
  await expect(botao).toBeVisible();
  if (await botao.getAttribute('aria-expanded') === 'false') await botao.click();
  await expect(botao).toHaveAttribute('aria-expanded', 'true');
}
