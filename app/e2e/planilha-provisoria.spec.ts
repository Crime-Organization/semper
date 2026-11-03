// PROVISORIO-219: sai junto com src/improvisos/planilhaAntiga.ts.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { expect, test, type Page } from '@playwright/test';

const SCRIPT = '**/macros/s/**';

async function cadastrarContato(page: Page, nome: string) {
  await page.goto('/pessoas/nova/');
  await page.getByText('Somente informações de contato', { exact: true }).click();
  await page.getByLabel('Nome').fill(nome);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('textbox', { name: 'Telefone' }).fill('38999990000');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page).toHaveURL(/\/pessoas\/\?id=/);
}

/** O banco fictício se passa pelo escritório da planilha. Antes, um cadastro faz ele se guardar na aba. */
async function virarEscritorioDaPlanilha(page: Page) {
  await page.evaluate(() => {
    const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!);
    bd.escritorio.slug = 'braga-ferreira';
    sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
  });
}

test('quando um escritório que não usa a planilha cadastra alguém, então a pessoa é salva e nada vai para o script antigo', async ({ page }) => {
  // Dado
  const enviados: string[] = [];
  page.on('request', r => { if (r.url().includes('script.google')) enviados.push(r.url()); });
  // Quando
  await cadastrarContato(page, 'contato de outro escritorio');
  // Então
  expect(enviados).toEqual([]);
});

test('quando o escritório da planilha cadastra alguém, então o cadastro envia uma vez ao script; ao desfazer, lembra de apagar lá fora', async ({ page }) => {
  // Dado: o endereço é interceptado, para nunca chegar ao script de verdade
  const enviados: Record<string, string>[] = [];
  await page.route(SCRIPT, rota => { enviados.push(JSON.parse(rota.request().postData()!)); return rota.fulfill({ status: 200, body: '' }); });
  await cadastrarContato(page, 'contato antes da troca');
  await virarEscritorioDaPlanilha(page);
  enviados.length = 0;
  // Quando
  await cadastrarContato(page, 'contato da planilha');
  // Então
  await expect.poll(() => enviados.length).toBe(1);
  expect(enviados[0]).toMatchObject({ nome: 'CONTATO DA PLANILHA', telefone: '(38) 99999-0000', tipo_de_cadastro: 'Somente informações de contato' });
  // Quando
  await page.getByRole('button', { name: 'Desfazer' }).click();
  // Então
  await expect(page.getByText('a linha na planilha, o contato no Google e o cartão no Trello continuam', { exact: false })).toBeVisible();
  expect(enviados).toHaveLength(1);
});

test('quando o envio falha na rede, então o cadastro continua salvo e a tela avisa o que conferir', async ({ page }) => {
  // Dado
  await page.route(SCRIPT, rota => rota.abort());
  await cadastrarContato(page, 'contato antes da troca');
  await virarEscritorioDaPlanilha(page);
  // Quando
  await cadastrarContato(page, 'contato sem rede');
  // Então
  await expect(page.getByText('não deu para confirmar o envio à planilha', { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/pessoas\/\?id=/);
});
