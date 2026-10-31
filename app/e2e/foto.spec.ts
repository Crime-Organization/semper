// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Foto do perfil. No banco fictício, quem está logado é o Mateus (master); a foto fica guardada na aba.
import { expect, test, type Page } from '@playwright/test';

/** Uma foto de teste em PNG, desenhada no próprio navegador (sem arquivo no repositório): um degradê de 1600×1200. */
async function fotoDeTeste(page: Page) {
  const dados = await page.evaluate(() => {
    const tela = document.createElement('canvas');
    tela.width = 1600; tela.height = 1200;
    const c = tela.getContext('2d')!;
    const g = c.createLinearGradient(0, 0, 1600, 1200);
    g.addColorStop(0, '#377D22'); g.addColorStop(1, '#F1EFE9');
    c.fillStyle = g; c.fillRect(0, 0, 1600, 1200);
    return tela.toDataURL('image/png').split(',')[1];
  });
  return { name: 'retrato.png', mimeType: 'image/png', buffer: Buffer.from(dados, 'base64') };
}

/** Escolhe a foto pelo botão, como a pessoa faz. */
async function escolherFoto(page: Page, botao: string) {
  const arquivo = await fotoDeTeste(page);
  const escolha = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: botao }).click();
  await (await escolha).setFiles(arquivo);
}

test.describe('Foto do perfil', () => {
  test('quando a pessoa escolhe uma foto e ajusta o corte, então vê a prévia redonda antes de salvar', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    // Quando
    await escolherFoto(page, 'Escolher foto');
    const corte = page.getByRole('group', { name: /Corte da foto/ });
    await corte.focus();
    await page.keyboard.press('+');
    await page.keyboard.press('ArrowLeft');
    // Então
    await expect(page.getByRole('img', { name: 'Prévia da bolinha' })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Aproximar' })).not.toHaveValue('1');
    await expect(page.getByRole('button', { name: 'Salvar foto' })).toBeEnabled();
  });

  test('quando a pessoa salva a foto, então a bolinha dela mostra a foto, e dá para baixar os dois AVIF de 1000 e 150', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await escolherFoto(page, 'Escolher foto');
    // Quando
    await page.getByRole('button', { name: 'Salvar foto' }).click();
    await expect(page.getByText('Foto salva. Ela já aparece nas bolinhas.')).toBeVisible({ timeout: 30_000 });
    // Então: a bolinha do menu traz a foto (e não as iniciais)
    const bolinha = page.getByRole('complementary').getByRole('img', { name: 'Mateus Freitas Gonçalves' });
    await expect(bolinha).toBeVisible();
    const links = [await page.getByRole('link', { name: '1000×1000' }).getAttribute('href'), await page.getByRole('link', { name: '150×150' }).getAttribute('href')];
    const medidas = await page.evaluate(async enderecos => {
      return Promise.all(enderecos.map(async endereco => {
        const a = { href: endereco! };
        const img = new Image();
        img.src = a.href;
        await img.decode();
        const tela = document.createElement('canvas');
        tela.width = img.naturalWidth; tela.height = img.naturalHeight;
        const c = tela.getContext('2d')!;
        c.drawImage(img, 0, 0);
        return { tipo: a.href.slice(5, a.href.indexOf(';')), lado: img.naturalWidth, alto: img.naturalHeight, cantoTransparente: c.getImageData(0, 0, 1, 1).data[3] === 0 };
      }));
    }, links);
    expect(medidas).toEqual([
      { tipo: 'image/avif', lado: 1000, alto: 1000, cantoTransparente: true },
      { tipo: 'image/avif', lado: 150, alto: 150, cantoTransparente: true }
    ]);
  });

  test('quando a pessoa tira a foto, então as bolinhas voltam às iniciais', async ({ page }) => {
    // Dado
    await page.goto('/minha-conta/');
    await escolherFoto(page, 'Escolher foto');
    await page.getByRole('button', { name: 'Salvar foto' }).click();
    await expect(page.getByText('Foto salva. Ela já aparece nas bolinhas.')).toBeVisible({ timeout: 30_000 });
    // Quando
    await page.getByRole('button', { name: 'Tirar foto' }).click();
    await page.getByRole('button', { name: 'Confirmar: tirar a foto' }).click();
    // Então
    await expect(page.getByText('Foto tirada. As bolinhas voltam às iniciais.')).toBeVisible();
    await expect(page.getByRole('complementary').getByLabel('Mateus Freitas Gonçalves')).toHaveText('MG');
    await expect(page.getByRole('button', { name: 'Escolher foto' })).toBeVisible();
  });
});
