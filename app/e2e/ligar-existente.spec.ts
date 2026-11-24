// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Ligar, no cartão de um item, outro que já existe (#341, etapa 2): as seções de pessoas, demandas, processos, contratos, tarefas e
// compromissos de cada cartão. A semente do banco fictício: JOSÉ DA SILVA TESTE é cliente do contrato de "Registro de marca" (com
// as demandas "Registro de marca" e "Busca de anterioridade") e do processo judicial 0001234-97.2026.8.13.0024; MARIA APARECIDA
// EXEMPLO é cliente do contrato "Ação de cobrança" e da demanda avulsa "Notificar o devedor"; "Renovar a procuração" é uma tarefa
// avulsa da Ana (sem demanda, contrato, processo nem pessoas), e "Reunião de equipe" é um compromisso da Agenda geral, sem
// pessoas. Quem está logado é o Mauro (administrador); o Bruno é estagiário e não está em "Renovar a procuração".
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

const CHAVE = 'semper-dados-falsos';
type Colecao = 'pessoas' | 'processos' | 'contratos' | 'demandas' | 'tarefas' | 'compromissos';
/** O id de um item da semente, lido do banco fictício da aba pelo valor de um campo (o nome, o título, o número...). */
async function idDe(page: Page, colecao: Colecao, campo: string, valor: string) {
  await page.goto('/inicio/');
  return page.evaluate(([chave, c, k, v]) => {
    const bd = JSON.parse(sessionStorage.getItem(chave)!) as Record<string, Record<string, unknown>[]>;
    return bd[c].find(x => String(x[k]).startsWith(v))!.id as string;
  }, [CHAVE, colecao, campo, valor]);
}
/** Onde cada cartão abre. */
const ENDERECO: Record<Colecao, string> = {
  pessoas: '/pessoas/?id=', processos: '/processos/judicial/?id=', contratos: '/contratos/?id=', demandas: '/demandas/?id=', tarefas: '/tarefas/?id=', compromissos: '/agenda/?id='
};
/** Abre o cartão do item e espera o título dele. */
async function abrirCartao(page: Page, colecao: Colecao, id: string, titulo: string) {
  await page.goto(ENDERECO[colecao] + id);
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return cartao;
}
/** A seção do cartão pelo título (aberta). */
async function secao(cartao: Locator, titulo: string) {
  await abrirSecao(cartao, titulo);
  return cartao.locator('section', { has: cartao.page().getByRole('button', { name: new RegExp(`^${titulo}( \\d+)?$`) }) });
}
interface Busca { botao: string; campo: string; lista: string; texto: string; achado: RegExp }
/** "Ligar … existente": abre a busca, digita e espera a lista. */
async function buscar(lugar: Locator, b: Omit<Busca, 'achado'>) {
  await lugar.getByRole('button', { name: b.botao }).click();
  await lugar.getByRole('textbox', { name: b.campo }).fill(b.texto);
  return lugar.getByRole('list', { name: b.lista });
}
/** Busca e escolhe o achado. */
async function ligar(lugar: Locator, b: Busca) {
  await (await buscar(lugar, b)).getByRole('button', { name: b.achado }).click();
}

const TAREFA: Omit<Busca, 'texto' | 'achado'> = { botao: 'Ligar tarefa existente', campo: 'Buscar tarefa para ligar', lista: 'Tarefas para ligar' };
const PESSOA: Omit<Busca, 'texto' | 'achado' | 'botao'> = { campo: 'Buscar pessoa para ligar', lista: 'Pessoas para ligar' };

test.describe('Ligar, no cartão de um item, outro que já existe (#341)', () => {
  test('dado o cartão de uma pessoa, quando ela é ligada a uma tarefa existente, então a tarefa aparece na seção, o cartão da tarefa mostra a pessoa, e a tarefa não é oferecida de novo', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'pessoas', 'nome', 'JOSÉ DA SILVA TESTE');
    let cartao = await abrirCartao(page, 'pessoas', id, 'JOSÉ DA SILVA TESTE');
    const tarefas = await secao(cartao, 'Tarefas');
    // Desde a #427, o "+" fica só no título: embaixo da lista não há o botão "Nova tarefa".
    await expect(tarefas.getByRole('link', { name: 'Nova tarefa ligada a esta pessoa' })).toBeVisible();
    await expect(tarefas.getByRole('link', { name: 'Nova tarefa', exact: true })).toHaveCount(0);
    // Quando
    await ligar(tarefas, { ...TAREFA, texto: 'renovar', achado: /Renovar a procuração/ });
    // Então
    await expect(page.getByText('Pessoa ligada à tarefa Renovar a procuração.')).toBeVisible();
    await expect(tarefas.getByRole('link', { name: /Renovar a procuração/ })).toBeVisible();
    await tarefas.getByRole('link', { name: /Renovar a procuração/ }).click();
    const tarefa = page.getByRole('dialog');
    await expect(tarefa.getByRole('heading', { name: 'Renovar a procuração', level: 2 })).toBeVisible();
    await expect((await secao(tarefa, 'Pessoas')).getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    // E, já ligada, a tarefa não aparece de novo na busca do cartão da pessoa
    cartao = await abrirCartao(page, 'pessoas', id, 'JOSÉ DA SILVA TESTE');
    const lista = await buscar(await secao(cartao, 'Tarefas'), { ...TAREFA, texto: 'renovar' });
    await expect(lista.getByText('Nenhuma tarefa ativa com esse texto que você possa ligar.')).toBeVisible();
  });

  test('dado o cartão de uma pessoa, quando ela é ligada como cliente de uma demanda, então a demanda aparece na seção, e o Desfazer a tira de lá', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'pessoas', 'nome', 'JOSÉ DA SILVA TESTE');
    const cartao = await abrirCartao(page, 'pessoas', id, 'JOSÉ DA SILVA TESTE');
    const demandas = await secao(cartao, 'Demandas');
    // Quando
    await ligar(demandas, { botao: 'Ligar demanda existente', campo: 'Buscar demanda para ligar', lista: 'Demandas para ligar', texto: 'notificar', achado: /Notificar o devedor/ });
    // Então
    await expect(demandas.getByRole('link', { name: /Notificar o devedor/ })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(demandas.getByRole('link', { name: /Notificar o devedor/ })).toHaveCount(0);
  });

  test('dado o cartão de um processo, quando liga um contrato e uma tarefa que já existem, então os dois aparecem nele e nos cartões deles', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    let cartao = await abrirCartao(page, 'processos', id, 'JOSÉ DA SILVA TESTE');
    // Quando
    const contratos = await secao(cartao, 'Contratos');
    await ligar(contratos, { botao: 'Ligar contrato existente', campo: 'Buscar contrato para ligar', lista: 'Contratos para ligar', texto: 'cobrança', achado: /Ação de cobrança/ });
    // Então
    await expect(contratos.getByRole('list', { name: 'Contratos ligados' }).getByRole('link', { name: /Ação de cobrança/ })).toBeVisible();
    // Quando
    const tarefas = await secao(cartao, 'Tarefas');
    await ligar(tarefas, { ...TAREFA, texto: 'renovar', achado: /Renovar a procuração/ });
    // Então
    await expect(tarefas.getByRole('link', { name: /Renovar a procuração/ })).toBeVisible();
    // E do outro lado: o contrato mostra o processo, e a tarefa também
    await contratos.getByRole('link', { name: /Ação de cobrança/ }).click();
    const contrato = page.getByRole('dialog');
    await expect(contrato.getByRole('heading', { name: 'MARIA APARECIDA EXEMPLO', level: 2 })).toBeVisible();
    await expect((await secao(contrato, 'Processos')).getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    const tarefa = await abrirCartao(page, 'tarefas', await idDe(page, 'tarefas', 'titulo', 'Renovar a procuração'), 'Renovar a procuração');
    await expect((await secao(tarefa, 'Processo')).getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    // E a tarefa, já com processo, não é oferecida de novo
    cartao = await abrirCartao(page, 'processos', id, 'JOSÉ DA SILVA TESTE');
    const lista = await buscar(await secao(cartao, 'Tarefas'), { ...TAREFA, texto: 'renovar' });
    await expect(lista.getByText('Nenhuma tarefa ativa com esse texto que você possa ligar.')).toBeVisible();
  });

  test('dado o cartão de um contrato, quando liga uma demanda avulsa, então ela aparece nas demandas dele, e o cartão da demanda mostra o contrato', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'contratos', 'servico', 'Ação de cobrança');
    const cartao = await abrirCartao(page, 'contratos', id, 'MARIA APARECIDA EXEMPLO');
    const demandas = await secao(cartao, 'Demandas');
    // Quando
    const lista = await buscar(demandas, { botao: 'Ligar demanda existente', campo: 'Buscar demanda para ligar', lista: 'Demandas para ligar', texto: 'marca' });
    // Então: as demandas que já têm contrato não aparecem
    await expect(lista.getByText('Nenhuma demanda ativa com esse texto que você possa ligar.')).toBeVisible();
    // Quando
    await cartao.getByRole('textbox', { name: 'Buscar demanda para ligar' }).fill('notificar');
    await expect(cartao.getByText('Quem está neste contrato passa a ver, só para ler, a demanda que você ligar e as tarefas dela.')).toBeVisible();
    await lista.getByRole('button', { name: /Notificar o devedor/ }).click();
    // Então
    await expect(demandas.getByRole('list', { name: 'Demandas do contrato' }).getByRole('link', { name: /Notificar o devedor/ })).toBeVisible();
    await demandas.getByRole('link', { name: /Notificar o devedor/ }).click();
    const demanda = page.getByRole('dialog');
    await expect(demanda.getByRole('heading', { name: 'Notificar o devedor', level: 2 })).toBeVisible();
    const contrato = await secao(demanda, 'Contrato');
    await expect(contrato.getByRole('link', { name: /Ação de cobrança/ })).toBeVisible();
    // E, com o contrato, a demanda não oferece outro
    await expect(contrato.getByRole('button', { name: 'Ligar contrato existente' })).toHaveCount(0);
  });

  test('dado o cartão de uma demanda, quando liga uma tarefa avulsa e um cliente que já existem, então eles aparecem nela, e a tarefa mostra a demanda', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'demandas', 'titulo', 'Notificar o devedor');
    const cartao = await abrirCartao(page, 'demandas', id, 'Notificar o devedor');
    // Quando
    const tarefas = await secao(cartao, 'Tarefas');
    await ligar(tarefas, { ...TAREFA, texto: 'renovar', achado: /Renovar a procuração/ });
    // Então
    await expect(cartao.getByRole('region', { name: 'Tarefas da demanda' }).getByRole('link', { name: 'Renovar a procuração' })).toBeVisible();
    // Quando
    const clientes = await secao(cartao, 'Clientes');
    await ligar(clientes, { ...PESSOA, botao: 'Ligar cliente existente', texto: 'josé da silva', achado: /JOSÉ DA SILVA TESTE/ });
    // Então
    await expect(page.getByText('Cliente ligado: JOSÉ DA SILVA TESTE.')).toBeVisible();
    await expect(clientes.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    // E a tarefa mostra a demanda, com os clientes que ela tinha quando foi ligada
    const tarefa = await abrirCartao(page, 'tarefas', await idDe(page, 'tarefas', 'titulo', 'Renovar a procuração'), 'Renovar a procuração');
    await expect((await secao(tarefa, 'Demanda')).getByRole('link', { name: /Notificar o devedor/ })).toBeVisible();
    await expect((await secao(tarefa, 'Pessoas')).getByRole('link', { name: /MARIA APARECIDA EXEMPLO/ })).toBeVisible();
  });

  test('dado o cartão de uma tarefa, quando liga uma pessoa e um contrato que já existem, então aparecem nela, a pessoa não é oferecida de novo e o cartão dela mostra a tarefa', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'tarefas', 'titulo', 'Renovar a procuração');
    let cartao = await abrirCartao(page, 'tarefas', id, 'Renovar a procuração');
    // Quando
    let pessoas = await secao(cartao, 'Pessoas');
    await ligar(pessoas, { ...PESSOA, botao: 'Ligar pessoa existente', texto: 'josé da silva', achado: /JOSÉ DA SILVA TESTE/ });
    // Então
    await expect(pessoas.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toBeVisible();
    // Quando
    const contrato = await secao(cartao, 'Contrato');
    await ligar(contrato, { botao: 'Ligar contrato existente', campo: 'Buscar contrato para ligar', lista: 'Contratos para ligar', texto: 'cobrança', achado: /Ação de cobrança/ });
    // Então: com o contrato, a tarefa ainda liga mais um (#283)
    await expect(contrato.getByRole('link', { name: /Ação de cobrança/ })).toBeVisible();
    await expect(contrato.getByRole('button', { name: 'Ligar mais um contrato' })).toBeVisible();
    // E a pessoa já ligada não é oferecida de novo
    cartao = await abrirCartao(page, 'tarefas', id, 'Renovar a procuração');
    pessoas = await secao(cartao, 'Pessoas');
    const lista = await buscar(pessoas, { ...PESSOA, botao: 'Ligar pessoa existente', texto: 'josé da silva' });
    await expect(lista.getByText('Nenhuma pessoa ativa com esse texto que ainda não esteja aqui.')).toBeVisible();
    // E o cartão da pessoa mostra a tarefa
    await page.keyboard.press('Escape');
    await pessoas.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ }).click();
    const pessoa = page.getByRole('dialog');
    await expect(pessoa.getByRole('heading', { name: 'JOSÉ DA SILVA TESTE', level: 2 })).toBeVisible();
    await expect((await secao(pessoa, 'Tarefas')).getByRole('link', { name: /Renovar a procuração/ })).toBeVisible();
  });

  test('dado o cartão de um compromisso, quando liga uma pessoa que já existe, então ela aparece nele e no cartão dela', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'compromissos', 'titulo', 'Reunião de equipe');
    const cartao = await abrirCartao(page, 'compromissos', id, 'Reunião de equipe');
    const pessoas = await secao(cartao, 'Pessoas');
    // Quando
    await ligar(pessoas, { ...PESSOA, botao: 'Ligar pessoa existente', texto: 'maria aparecida', achado: /MARIA APARECIDA EXEMPLO/ });
    // Então
    await expect(page.getByText('Pessoa ligada: MARIA APARECIDA EXEMPLO.')).toBeVisible();
    await expect(pessoas.getByRole('link', { name: /MARIA APARECIDA EXEMPLO/ })).toBeVisible();
    await pessoas.getByRole('link', { name: /MARIA APARECIDA EXEMPLO/ }).click();
    const pessoa = page.getByRole('dialog');
    await expect(pessoa.getByRole('heading', { name: 'MARIA APARECIDA EXEMPLO', level: 2 })).toBeVisible();
    await expect((await secao(pessoa, 'Compromissos')).getByRole('link', { name: /Reunião de equipe/ })).toBeVisible();
  });

  test('dado um prazo do processo sem tarefa, quando liga uma tarefa que já existe, então o prazo mostra a tarefa', async ({ page }) => {
    // Dado: um prazo lançado direto no banco fictício da aba
    const id = await idDe(page, 'processos', 'numero', '0001234-97.2026.8.13.0024');
    await page.evaluate(([chave, processo]) => {
      const bd = JSON.parse(sessionStorage.getItem(chave)!) as { prazos?: unknown[] };
      const agora = new Date().toISOString();
      bd.prazos = [...(bd.prazos ?? []), { id: 'z-teste', processo_id: processo, descricao: 'Contestação', final: '2030-12-02', intimacao: null, dias: null, contagem: null,
        disponibilizacao: false, sem_recesso: false, andamento_id: null, concluido_em: null, tarefa_id: null, excluido_em: null, criado_por: 'u-master', criado_em: agora, atualizado_em: agora }];
      sessionStorage.setItem(chave, JSON.stringify(bd));
    }, [CHAVE, id]);
    const cartao = await abrirCartao(page, 'processos', id, 'JOSÉ DA SILVA TESTE');
    const prazo = (await secao(cartao, 'Prazos')).getByRole('listitem').filter({ hasText: 'Contestação' });
    // Quando
    const lista = await buscar(prazo, { ...TAREFA, texto: 'renovar' });
    await expect(prazo.getByText('O prazo da tarefa passa a ser o último dia deste prazo, e muda junto quando ele mudar.', { exact: false })).toBeVisible();
    await lista.getByRole('button', { name: /Renovar a procuração/ }).click();
    // Então
    await expect(page.getByText('Tarefa F00D1234 ligada ao prazo.')).toBeVisible();
    await expect(prazo.getByRole('link', { name: 'Tarefa F00D1234' })).toBeVisible();
  });

  test('dada uma pessoa arquivada, quando abre as seções do cartão, então não há como ligar nada', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'pessoas', 'nome', 'JOSÉ DA SILVA TESTE');
    await page.evaluate(([chave, pessoa]) => {
      const bd = JSON.parse(sessionStorage.getItem(chave)!) as { pessoas: { id: string; arquivado_em: string | null }[] };
      bd.pessoas.find(p => p.id === pessoa)!.arquivado_em = new Date().toISOString();
      sessionStorage.setItem(chave, JSON.stringify(bd));
    }, [CHAVE, id]);
    // Quando
    const cartao = await abrirCartao(page, 'pessoas', id, 'JOSÉ DA SILVA TESTE');
    for (const titulo of ['Demandas', 'Processos', 'Compromissos', 'Tarefas']) await abrirSecao(cartao, titulo);
    // Então
    await expect(cartao.getByRole('button', { name: /^Ligar .* existente$/ })).toHaveCount(0);
  });

  test('dada a conta comum que não está na tarefa, quando abre o cartão dela, então só lê: não há como ligar pessoa, demanda nem contrato', async ({ page }) => {
    // Dado
    const id = await idDe(page, 'tarefas', 'titulo', 'Renovar a procuração');
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirCartao(page, 'tarefas', id, 'Renovar a procuração');
    for (const titulo of ['Pessoas', 'Demanda', 'Contrato']) await abrirSecao(cartao, titulo);
    // Então
    await expect(cartao.getByText('Você não participa deste cartão.', { exact: false })).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Ligar .* existente$/ })).toHaveCount(0);
  });
});
