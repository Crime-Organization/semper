// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A página pública (rota "/", #380): o que é o SEMPER, o pedido de demonstração no alto e no fim, os links do sistema
// levados à entrada e o tema da página.
import { expect, test, type Page } from '@playwright/test';

/** Guarda os endereços que a página manda abrir (o e-mail do pedido), em vez de abrir o programa de e-mail. */
async function guardarOQueAbre(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __abertos: string[] };
    w.__abertos = [];
    window.open = (endereco?: string | URL) => { w.__abertos.push(String(endereco)); return null; };
  });
}
const abertos = (page: Page) => page.evaluate(() => (window as unknown as { __abertos: string[] }).__abertos);

test.describe('Página pública', () => {
  test('quando alguém abre a página inicial, então vê o que é o SEMPER, para quem é, e o pedido de demonstração no alto e no fim', async ({ page }) => {
    // Quando
    await page.goto('/');
    // Então
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/SEMPER\.\s*Tudo do seu escritório num lugar só\./);
    await expect(page.getByText(/escritórios de advocacia, de propriedade intelectual, núcleos de inovação e outros escritórios de serviços/)).toBeVisible();
    const pedidoNoAlto = page.getByRole('form', { name: 'Pedir uma demonstração' });
    await expect(pedidoNoAlto.getByRole('button', { name: 'Pedir uma demonstração' })).toBeInViewport();
    const pedidoNoFim = page.getByRole('form', { name: 'Peça uma demonstração.' });
    await expect(pedidoNoFim.getByLabel('Nome do escritório')).toBeVisible();
    await expect(pedidoNoFim.getByRole('button', { name: 'Pedir uma demonstração' })).toBeVisible();
  });

  test('quando alguém lê a página, então não há preço, nem "em breve" de módulo pronto, nem o nome de um escritório cliente', async ({ page }) => {
    // Quando
    await page.goto('/');
    const texto = await page.locator('body').innerText();
    // Então
    expect(texto).not.toMatch(/R\$|preço|quanto custa|mensalidade/i);
    expect(texto).not.toMatch(/em breve/i);
    expect(texto).not.toMatch(/Braga|Ferreira/i);   // nem o nome do primeiro escritório cliente, nem parte dele (#323)
  });

  test('quando a pessoa escolhe uma parte no índice, então vai até a seção do módulo, com o título e a tela', async ({ page }) => {
    // Dado
    await page.goto('/');
    const indice = page.getByRole('navigation', { name: 'O que o SEMPER já faz' });
    // Quando
    await indice.getByRole('link', { name: /Checklists/ }).click();
    // Então
    await expect(page).toHaveURL(/#checklists$/);
    await expect(page.getByRole('heading', { name: 'Checklists', level: 2 })).toBeInViewport();
    await expect(page.getByRole('img', { name: /Checklist de um pedido de registro de marca/ })).toBeVisible();
  });

  test('quando a pessoa troca o gênero na qualificação de exemplo, então o texto muda a concordância', async ({ page }) => {
    // Dado
    await page.goto('/');
    await expect(page.getByText(/MARIA DA SILVA EXEMPLO, brasileira/)).toBeVisible();
    // Quando
    await page.getByRole('group', { name: 'Gênero da pessoa' }).getByText('Masculino').click();
    // Então
    await expect(page.getByText(/JOÃO DA SILVA EXEMPLO, brasileiro/)).toBeVisible();
  });

  test('quando a pessoa copia a qualificação de exemplo, então o aviso no pé da tela diz que ela foi copiada', async ({ page, context }) => {
    // Dado
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    const caixa = page.getByText(/MARIA DA SILVA EXEMPLO, brasileira/);
    await caixa.scrollIntoViewIfNeeded();
    // Quando
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    // Então
    await expect(page.getByText('Qualificação copiada.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copiada', exact: true })).toBeVisible();
  });

  test('quando alguém abre a página no computador, então já vê uma tela do SEMPER no alto, antes de rolar', async ({ page }) => {
    // Dado
    await page.setViewportSize({ width: 1440, height: 900 });
    // Quando
    await page.goto('/');
    // Então
    await expect(page.getByRole('img', { name: /^Início do SEMPER num celular/ })).toBeInViewport();
  });

  test('quando o navegador não abre AVIF, então cada tela tem a versão em WebP', async ({ page }) => {
    // Quando
    await page.goto('/');
    // Então
    const telas = page.getByRole('img', { name: /SEMPER/ });
    await expect(telas.first()).toBeAttached();
    for (const src of await telas.evaluateAll(imgs => imgs.map(i => i.getAttribute('src') ?? ''))) expect(src).toMatch(/\.webp$/);
  });

  test('quando a pessoa pede a demonstração no alto sem o nome do escritório, então a página pede o nome e não abre nada', async ({ page }) => {
    // Dado
    await guardarOQueAbre(page);
    await page.goto('/');
    const pedido = page.getByRole('form', { name: 'Pedir uma demonstração' });
    // Quando
    await pedido.getByRole('button', { name: 'Pedir uma demonstração' }).click();
    // Então
    await expect(pedido.getByRole('alert')).toHaveText('Escreva o nome do escritório.');
    await expect(pedido.getByLabel('Nome do escritório')).toBeFocused();
    expect(await abertos(page)).toEqual([]);
  });

  test('quando a pessoa escreve o nome do escritório e pede a demonstração no alto, então o e-mail abre já com o nome', async ({ page }) => {
    // Dado
    await guardarOQueAbre(page);
    await page.goto('/');
    const pedido = page.getByRole('form', { name: 'Pedir uma demonstração' });
    // Quando
    await pedido.getByLabel('Nome do escritório').fill('Marques & Lima Advogados');
    await pedido.getByRole('button', { name: 'Pedir uma demonstração' }).click();
    // Então
    await expect.poll(() => abertos(page)).toHaveLength(1);
    const email = new URL((await abertos(page))[0]);
    expect(email.protocol).toBe('mailto:');
    expect(email.searchParams.get('body')).toContain('o escritório Marques & Lima Advogados');
  });

  test('quando a pessoa pede a demonstração no fim, com o tamanho da equipe, então o e-mail leva os dois', async ({ page }) => {
    // Dado
    await guardarOQueAbre(page);
    await page.goto('/');
    const pedido = page.getByRole('form', { name: 'Peça uma demonstração.' });
    // Quando
    await pedido.getByLabel('Nome do escritório').fill('Núcleo de Inovação Exemplo');
    await pedido.getByText('Mais de 5 pessoas').click();
    await pedido.getByRole('button', { name: 'Pedir uma demonstração' }).click();
    // Então
    await expect.poll(() => abertos(page)).toHaveLength(1);
    const corpo = new URL((await abertos(page))[0]).searchParams.get('body');
    expect(corpo).toContain('o escritório Núcleo de Inovação Exemplo (equipe de mais de 5 pessoas)');
  });

  test('quando alguém sem sessão olha o topo, então o link "Entrar" leva à entrada', async ({ page }) => {
    // Quando
    await page.goto('/');
    // Então
    await expect(page.getByRole('banner').getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar/');
  });

  for (const endereco of ['/?primeiro-acesso', '/?token_hash=abc&type=invite', '/#access_token=abc&type=invite']) {
    test(`quando alguém chega por um link do sistema (${endereco}), então vai direto para a entrada, com o link inteiro`, async ({ page }) => {
      // Então (escutado antes de abrir: no banco fictício já há sessão, e a entrada segue logo para o Início, às vezes
      // antes de a conferência do endereço olhar; escutando a troca de endereço, a passagem pela entrada não escapa)
      const naEntrada = page.waitForURL(new RegExp('/entrar/' + endereco.slice(1).replace(/[?.*+^$()|[\]\\]/g, '\\$&') + '$'), { waitUntil: 'commit' });
      // Quando
      await page.goto(endereco);
      // Então
      await naEntrada;
    });
  }
});

test.describe('Página pública no celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('quando alguém abre a página no celular, então as telas são as capturadas num celular, que dão para ler', async ({ page }) => {
    // Quando
    await page.goto('/');
    const busca = page.getByRole('img', { name: /^Busca geral do SEMPER/ });
    await busca.scrollIntoViewIfNeeded();
    // Então
    await expect(busca).toBeVisible();
    await expect.poll(() => busca.evaluate(i => (i as HTMLImageElement).currentSrc)).toMatch(/busca-celular-claro/);
    await expect(page.getByRole('img', { name: /^Início do SEMPER: prazos/ })).toBeHidden();
  });
});

test.describe('Página pública no tema escuro do aparelho', () => {
  test.use({ colorScheme: 'dark' });

  test('quando o aparelho está no tema escuro, então a página segue o tema e mostra as telas escuras do SEMPER', async ({ page }) => {
    // Quando
    await page.goto('/');
    // Então
    await expect(page.locator('html')).not.toHaveAttribute('data-tema', 'claro');
    const tela = page.getByRole('img', { name: /^Início do SEMPER: prazos/ });
    await tela.scrollIntoViewIfNeeded();
    await expect(tela).toBeVisible();
    await expect(tela).toHaveAttribute('src', /inicio-escuro/);
  });
});
