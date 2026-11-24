// O consentimento sem data (#409): o aviso do Início, só para os administradores, com quantas pessoas têm a base legal
// "consentimento" e a data dele vazia, e o link que abre Pessoas já filtrada; e o filtro "Consentimento sem data" da página Pessoas.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './ajudantes';

const CHAVE = 'semper-dados-falsos';
/** Duas pessoas da semente ficam com a base legal "consentimento" e sem a data; uma terceira, com a data. */
const SEM_DATA = ['JOÃO PEDRO FICTÍCIO', 'LUCIANA ROCHA AMOSTRA'];
const COM_DATA = 'MARIA APARECIDA EXEMPLO';
/** A linha da pessoa na tabela de Pessoas. */
const linha = (page: Page, nome: string) => page.getByRole('row').filter({ hasText: nome });

/** Muda o banco fictício direto na aba (pelo cadastro, a data agora é obrigatória: não daria para salvar sem ela). */
async function comConsentimentoSemData(page: Page) {
  await page.goto('/inicio/');
  await page.evaluate(([chave, semData, comData]) => {
    type Banco = { pessoas: { nome: string; lgpd_base: string | null; lgpd_consentimento: string | null }[] };
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as Banco;
    for (const p of bd.pessoas) {
      if ((semData as string[]).includes(p.nome)) Object.assign(p, { lgpd_base: 'consentimento', lgpd_consentimento: null });
      if (p.nome === comData) Object.assign(p, { lgpd_base: 'consentimento', lgpd_consentimento: '2026-01-10' });
    }
    sessionStorage.setItem(chave, JSON.stringify(bd));
  }, [CHAVE, SEM_DATA, COM_DATA] as const);
  // O banco fictício lê a aba ao abrir a página: recarrega para valer a mudança.
  await page.reload();
}

test.describe('Consentimento sem data', () => {
  test('quando o administrador abre o Início, então vê quantas pessoas estão sem a data, e o link abre Pessoas só com elas', async ({ page }) => {
    // Dado
    await comConsentimentoSemData(page);
    // Quando
    await page.getByRole('link', { name: 'Completar as datas' }).click();
    // Então
    await expect(page).toHaveURL(/\/pessoas\//);
    for (const nome of SEM_DATA) await expect(linha(page, nome)).toBeVisible();
    await expect(linha(page, COM_DATA)).toHaveCount(0);
    await expect(page.getByText('2 ativas')).toBeVisible();
  });

  test('quando o administrador abre o Início, então o aviso diz quantas pessoas estão sem a data', async ({ page }) => {
    // Dado / Quando
    await comConsentimentoSemData(page);
    // Então
    await expect(page.getByText('2 pessoas estão com a base legal "consentimento" e sem a data dele.', { exact: false })).toBeVisible();
  });

  test('quando quem entra não é administrador, então o Início não mostra o aviso', async ({ page }) => {
    // Dado: as pessoas sem a data existem (o administrador vê o aviso)
    await comConsentimentoSemData(page);
    await expect(page.getByRole('link', { name: 'Completar as datas' })).toBeVisible();
    // Quando
    await entrarComo(page, 'u-bruno');
    // Então: com o painel já carregado, o aviso não está lá
    await expect(page.getByRole('group', { name: 'Números do dia' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Completar as datas' })).toHaveCount(0);
  });

  test('quando escolhe "Consentimento sem data" em "Situação do cadastro", então a lista de Pessoas mostra só essas pessoas', async ({ page }) => {
    // Dado
    await comConsentimentoSemData(page);
    await page.goto('/pessoas/?visao=tabela');
    await page.getByRole('button', { name: /Filtros/ }).click();
    // Quando
    await page.getByLabel('Situação do cadastro').selectOption({ label: 'Consentimento sem data' });
    // Então
    for (const nome of SEM_DATA) await expect(linha(page, nome)).toBeVisible();
    await expect(linha(page, COM_DATA)).toHaveCount(0);
  });
});
