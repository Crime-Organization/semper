// Ajudantes dos testes de ponta a ponta. O banco fictício começa com a sessão aberta
// (como Mateus, o master do escritório de exemplo) e é zerado a cada aba nova.
import { expect, type Page } from '@playwright/test';

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
