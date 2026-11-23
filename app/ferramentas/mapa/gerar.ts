// O mapa do sistema (#407): para cada assunto (pessoas, contratos, financeiro…), os arquivos, as tabelas, as funções de dados, as
// rotas e os testes, para quem vai mudar algo ir direto aos arquivos certos e rodar só os testes do assunto. As listas saem do código;
// o que é de cada assunto (e as descrições e armadilhas escritas à mão) está na tabela de assuntos.ts. Gerar não lê banco nem internet:
// só os arquivos do projeto. Roda no Windows e no Linux igual: caminhos com "/", fins de linha "\n" e ordem que não depende do idioma.
import { readdirSync, readFileSync } from 'node:fs';
import { ASSUNTOS, COMUM, type Assunto, type Padrao } from './assuntos.ts';

/** As pastas que o mapa percorre, a partir da raiz do projeto. */
export const PASTAS_DO_MAPA = ['app/src', 'app/e2e', 'app/ferramentas', 'supabase/migrations', 'supabase/tests', 'supabase/functions'];
/** Os tipos de arquivo que entram no mapa: código, estilo e SQL. */
const EXTENSOES_DO_MAPA = /\.(tsx?|mjs|css|sql)$/;
/** O que fica de fora mesmo dentro das pastas: imagens e pastas escondidas ou geradas (que começam com ponto). */
const FORA_DO_MAPA = [/^app\/src\/imagens\//, /\/\.[^/]+\//];
/** Onde ficam as rotas e o contrato da camada de dados. */
const ARQUIVO_DAS_ROTAS = 'app/src/App.tsx';
const ARQUIVO_DO_CONTRATO = 'app/src/dados/tipos.ts';
/** O arquivo do mapa, a partir da raiz do projeto. */
export const ARQUIVO_DO_MAPA = 'docs/MAPA.md';
/** O tamanho máximo da frase que descreve cada regra (o começo do comentário do topo do arquivo), em letras. */
const TAMANHO_DA_DESCRICAO = 160;
/** O teste que confere que o banco fictício se comporta como o de verdade: entra no comando de todo assunto com funções de dados. */
const TESTE_DO_CONTRATO = 'app/src/dados/contrato.test.ts';
/** A partir de quantos testes de tela que vão direto a um endereço o mapa manda rodar a bateria inteira, em vez de listá-los. */
const MUITOS_TESTES_DE_TELA = 20;
/** As rotas que não são um endereço a escrever: a página pública ("/") e a que leva ao Início ("*"). */
const ROTAS_SEM_ENDERECO = ['/', '*'];

/** O projeto que o mapa lê: a lista dos arquivos (caminhos a partir da raiz, com "/") e como ler cada um. */
export interface Projeto {
  arquivos: string[];
  ler: (caminho: string) => string;
}

/** Ordem que não depende do idioma do computador (localeCompare muda de uma máquina para outra). */
const emOrdem = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sem = (texto: string) => texto.replace(/\r\n?/g, '\n');

/** Lê o projeto do disco, a partir da raiz. */
export function lerProjeto(raiz: string): Projeto {
  const arquivos: string[] = [];
  const percorrer = (pasta: string) => {
    let itens;
    try { itens = readdirSync(`${raiz}/${pasta}`, { withFileTypes: true }); } catch { return; }
    for (const item of itens) {
      const caminho = `${pasta}/${item.name}`;
      if (item.isDirectory()) percorrer(caminho);
      else if (EXTENSOES_DO_MAPA.test(caminho) && !FORA_DO_MAPA.some(p => p.test(caminho))) arquivos.push(caminho);
    }
  };
  PASTAS_DO_MAPA.forEach(percorrer);
  return { arquivos: arquivos.sort(emOrdem), ler: caminho => sem(readFileSync(`${raiz}/${caminho}`, 'utf8')) };
}

/**
 * A chave do arquivo, que a tabela de assuntos usa: o nome sem a pasta, sem as extensões (.test.tsx, .spec.ts, .css…) e, nas
 * migrações, sem a data ("20261025000003_vinculos.sql" → "vinculos"). Nas funções do servidor, index.ts vale pelo nome da pasta.
 */
export function chaveDoArquivo(caminho: string): string {
  const partes = caminho.split('/');
  const nome = partes.at(-1) === 'index.ts' && caminho.startsWith('supabase/functions/') ? partes.at(-2)! : partes.at(-1)!;
  return nome.replace(/(\.tela)?\.(test|spec)\.(tsx?|sql)$/, '').replace(EXTENSOES_DO_MAPA, '').replace(/^\d{14}_/, '');
}

const casa = (padrao: Padrao, caminho: string) => typeof padrao === 'string' ? padrao === chaveDoArquivo(caminho) : padrao.test(caminho);
const ehDoAssunto = (assunto: Assunto, caminho: string) => assunto.arquivos.some(p => casa(p, caminho));

/** As tabelas de cada migração: as que ela cria, muda (alter table) ou cujas regras de acesso (policy) ela escreve. */
export function tabelasDaMigracao(sql: string): { cria: string[]; mexe: string[] } {
  const nome = (esquema: string | undefined, tabela: string) => (esquema && esquema !== 'public' ? `${esquema}.${tabela}` : tabela);
  const texto = sql.toLowerCase().replace(/--[^\n]*/g, '');
  // O nome não pode continuar com ponto nem com letra: "public.%1$I" (tabela montada dentro de um laço) não é a tabela "public".
  const cria = [...texto.matchAll(/create table (?:if not exists )?(?:(public|privado)\.)?"?(\w+)(?![.\w])/g)].map(m => nome(m[1], m[2]));
  const mexe = [...texto.matchAll(/(?:alter table (?:only )?(?:if exists )?|create policy (?:"[^"]+"|\w+)\s+on\s+)(?:(public|privado)\.)?"?(\w+)(?![.\w])/g)]
    .map(m => nome(m[1], m[2]));
  return { cria: [...new Set(cria)], mexe: [...new Set([...cria, ...mexe])] };
}

/** As partes do contrato Dados (app/src/dados/tipos.ts), cada uma com os nomes das funções, na ordem do arquivo. */
export function partesDoContrato(tipos: string): Map<string, string[]> {
  const partes = new Map<string, string[]>();
  const inteiro = tipos.match(/export interface Dados extends ([^{]+)\{/);
  const doContrato = new Set(inteiro ? inteiro[1].split(',').map(s => s.trim()) : []);
  for (const bloco of tipos.matchAll(/export interface (Dados\w*) (?:extends [^{]+)?\{\n([\s\S]*?)\n\}/g)) {
    if (!doContrato.has(bloco[1])) continue;
    partes.set(bloco[1], [...bloco[2].matchAll(/^ {2}(\w+)\??[(<:]/gm)].map(m => m[1]));
  }
  return partes;
}

/** As rotas de App.tsx, como estão escritas lá ("pessoas", "pessoas/nova", "/"): as das <Route path> e as dos cadastros. */
export function rotasDoApp(app: string): string[] {
  const rotas = [...app.matchAll(/path="([^"]*)"/g), ...app.matchAll(/\['([a-z][a-z/-]*)', Formulario/g)].map(m => m[1]);
  return [...new Set(rotas)].sort(emOrdem);
}

/** A tela de cada rota de App.tsx (o componente do element ou o formulário do cadastro): "financeiro/direitos" → "HubDoFinanceiro". */
export function telasDasRotas(app: string): Map<string, string> {
  const telas = new Map<string, string>();
  for (const m of app.matchAll(/path="([^"]*)" element=\{<(\w+)/g)) telas.set(m[1], m[2]);
  for (const m of app.matchAll(/\['([a-z][a-z/-]*)', (Formulario\w+)/g)) telas.set(m[1], m[2]);
  return telas;
}

/**
 * Um endereço do app escrito no código, entre aspas ou crases: "/pessoas/", "/financeiro/direitos/?cartao=…" e
 * "`/processos/${tipo}/`" (que vale "processos"). Só conta com uma letra depois da barra: "/" sozinho não é endereço.
 */
const ENDERECO_NO_CODIGO = /['"`]\/([a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*)\/?(?=['"`?#$])/g;
/** Os endereços (como as rotas de App.tsx, sem as barras) que um arquivo escreve. */
export function enderecosCitados(codigo: string): Set<string> {
  return new Set([...codigo.matchAll(ENDERECO_NO_CODIGO)].map(m => m[1]));
}

/** A primeira frase do comentário do topo do arquivo (o que a regra decide), curta. */
export function primeiraFrase(codigo: string): string {
  const linhas: string[] = [];
  for (const linha of codigo.split('\n')) {
    const comentario = linha.match(/^\s*(?:\/\/|\/\*\*?|\*\/?)\s?(.*?)\s*(?:\*\/)?$/);
    if (!comentario || /^\s*(import|export)\b/.test(linha)) break;
    if (comentario[1]) linhas.push(comentario[1]);
    else if (linhas.length) break;
  }
  const texto = linhas.join(' ').replace(/\s+/g, ' ').trim();
  // Só o ponto encerra a frase: "!" e "?" aparecem no meio dos comentários como as teclas das menções e da ajuda.
  const frase = texto.match(/^.*?\.(?=\s|$)/)?.[0] ?? texto;
  if (frase.length <= TAMANHO_DA_DESCRICAO) return frase;
  return `${frase.slice(0, TAMANHO_DA_DESCRICAO).replace(/\s+\S*$/, '')}…`;
}

/** O que o mapa sabe do projeto, já lido: os arquivos, as tabelas, o contrato e as rotas. */
interface Leitura {
  arquivos: string[];
  ler: (caminho: string) => string;
  /** Tabela → a migração que a cria (o nome do arquivo sem .sql). */
  criadaEm: Map<string, string>;
  /** Migração (caminho) → as tabelas que ela cria ou muda. */
  tabelasDe: Map<string, string[]>;
  contrato: Map<string, string[]>;
  rotas: string[];
  /** Rota → a tela (o componente) que ela abre. */
  telas: Map<string, string>;
}

function ler(projeto: Projeto): Leitura {
  const criadaEm = new Map<string, string>();
  const tabelasDe = new Map<string, string[]>();
  for (const caminho of projeto.arquivos.filter(c => c.startsWith('supabase/migrations/'))) {
    const { cria, mexe } = tabelasDaMigracao(projeto.ler(caminho));
    const nome = caminho.split('/').at(-1)!.replace(/\.sql$/, '');
    cria.forEach(t => { if (!criadaEm.has(t)) criadaEm.set(t, nome); });
    tabelasDe.set(caminho, mexe);
  }
  // Só contam as tabelas criadas por alguma migração (um alter table em auth.users, por exemplo, não é tabela do SEMPER).
  for (const [caminho, tabelas] of tabelasDe) tabelasDe.set(caminho, tabelas.filter(t => criadaEm.has(t)));
  const tem = (c: string) => projeto.arquivos.includes(c);
  return {
    arquivos: projeto.arquivos,
    ler: projeto.ler,
    criadaEm,
    tabelasDe,
    contrato: tem(ARQUIVO_DO_CONTRATO) ? partesDoContrato(projeto.ler(ARQUIVO_DO_CONTRATO)) : new Map(),
    rotas: tem(ARQUIVO_DAS_ROTAS) ? rotasDoApp(projeto.ler(ARQUIVO_DAS_ROTAS)) : [],
    telas: tem(ARQUIVO_DAS_ROTAS) ? telasDasRotas(projeto.ler(ARQUIVO_DAS_ROTAS)) : new Map()
  };
}

const ehTesteUnitario = (c: string) => c.startsWith('app/') && /\.test\.tsx?$/.test(c);
const ehTesteDeTela = (c: string) => c.startsWith('app/e2e/') && c.endsWith('.spec.ts');
const ehTesteDoBanco = (c: string) => c.startsWith('supabase/tests/') && c.endsWith('.test.sql');
const ehTeste = (c: string) => ehTesteUnitario(c) || ehTesteDeTela(c) || ehTesteDoBanco(c);

/**
 * Os arquivos de um assunto: os que casam com a tabela, as migrações que mexem nas tabelas dele e, se o assunto diz um
 * "conteudo", as migrações em que ele aparece, com os testes do banco de mesmo nome.
 */
function arquivosDoAssunto(assunto: Assunto, leitura: Leitura): string[] {
  const tabelas = new Set(assunto.tabelas ?? []);
  const { conteudo } = assunto;
  const peloConteudo = new Set(conteudo
    ? leitura.arquivos.filter(c => c.startsWith('supabase/migrations/') && conteudo.test(leitura.ler(c))).map(chaveDoArquivo)
    : []);
  return leitura.arquivos.filter(c => ehDoAssunto(assunto, c) || (leitura.tabelasDe.get(c) ?? []).some(t => tabelas.has(t))
    || (c.startsWith('supabase/') && peloConteudo.has(chaveDoArquivo(c))));
}

/**
 * Os testes que o assunto roda: os dele, os de outros assuntos que ele costuma quebrar ("testes" na tabela) e, se o assunto tem
 * funções de dados, o teste do contrato (o fictício igual ao de verdade).
 */
function testesDoAssunto(assunto: Assunto, arquivos: string[], leitura: Leitura): string[] {
  const deFora = leitura.arquivos.filter(c => ehTeste(c) && (assunto.testes ?? []).some(p => casa(p, c)));
  const doContrato = assunto.dados?.length && leitura.arquivos.includes(TESTE_DO_CONTRATO) ? [TESTE_DO_CONTRATO] : [];
  return [...new Set([...arquivos.filter(ehTeste), ...deFora, ...doContrato])].sort(emOrdem);
}

const naPasta = (base: string) => (c: string) => c.startsWith(base) && !ehTeste(c);
/** As pastas que têm item próprio na seção; o que está em app/ e fora delas vai para "Outros". */
const PASTAS_COM_ITEM = ['app/src/dados/', 'app/src/regras/', 'app/src/paginas/', 'app/src/ui/'];
const noApp = (c: string) => c.slice('app/'.length);
const codigo = (t: string) => `\`${t}\``;
/** Uma rota como se escreve no navegador: "pessoas/nova" → "/pessoas/nova/". */
const endereco = (r: string) => (r === '/' || r === '*' ? r : `/${r}/`);

/** O que cada parte da seção de um assunto recebe: o assunto, os arquivos e os testes dele e o que o mapa leu do projeto. */
interface Contexto { assunto: Assunto; arquivos: string[]; testes: string[]; leitura: Leitura }
/** Um item da lista ("- **Telas:** …"), com as linhas de baixo, se houver; sem conteúdo, nada. */
const item = (titulo: string, texto: string, embaixo: string[] = []) => [`- **${titulo}:**${texto ? ` ${texto}` : ''}`, ...embaixo.map(l => `  - ${l}`)];
/** Os arquivos de uma pasta, com o caminho a partir dela. */
const listaDaPasta = (titulo: string, base: string, de: (c: string) => boolean = naPasta(base)) => ({ arquivos }: Contexto) => {
  const daPasta = arquivos.filter(de);
  return daPasta.length ? item(titulo, `(${base}) ${daPasta.map(c => c.slice(base.length).replace(/\.sql$/, '')).join(', ')}`) : [];
};

/** As partes da seção de cada assunto, na ordem em que aparecem. Parte nova = uma linha nova aqui. */
const PARTES_DA_SECAO: ((contexto: Contexto) => string[])[] = [
  ({ assunto, leitura }) => {
    const tabelas = (assunto.tabelas ?? []).map(t => `${codigo(t)} (${leitura.criadaEm.get(t)?.replace(/^\d{14}_/, '') ?? 'não achada nas migrações'})`);
    return tabelas.length ? item('Tabelas', `${tabelas.join(', ')}; entre parênteses, a migração que a cria`) : [];
  },
  listaDaPasta('Migrações', 'supabase/migrations/'),
  ({ assunto, leitura }) => (assunto.dados?.length
    ? item('Funções de dados', 'o contrato em app/src/dados/tipos.ts; as mesmas funções em supabase.ts e falso.ts',
      assunto.dados.map(parte => `${codigo(parte)}: ${(leitura.contrato.get(parte) ?? ['(não achada no contrato)']).join(', ')}`))
    : []),
  listaDaPasta('Outros arquivos de dados', 'app/src/dados/'),
  ({ arquivos, leitura }) => {
    const regras = arquivos.filter(naPasta('app/src/regras/'));
    return regras.length ? item('Regras', '(app/src/regras/)', regras.map(r => `${codigo(r.slice('app/src/regras/'.length))}: ${primeiraFrase(leitura.ler(r))}`)) : [];
  },
  listaDaPasta('Telas', 'app/src/paginas/'),
  ({ assunto, leitura }) => {
    const rotas = leitura.rotas.filter(r => (assunto.rotas ?? []).includes(r));
    return rotas.length ? item('Rotas', rotas.map(r => codigo(endereco(r))).join(', ')) : [];
  },
  listaDaPasta('Peças de ui', 'app/src/ui/'),
  listaDaPasta('Servidor (funções do Supabase)', 'supabase/functions/'),
  listaDaPasta('Outros', 'app/', c => naPasta('app/')(c) && !PASTAS_COM_ITEM.some(p => c.startsWith(p))),
  ({ testes }) => {
    const doBanco = testes.filter(ehTesteDoBanco);
    return doBanco.length
      ? item('Testes do banco', `na raiz do projeto, com o Docker ligado e o banco local de pé (${codigo('npx supabase db start')}), ${codigo(`npx supabase test db ${doBanco.join(' ')}`)}`)
      : [];
  },
  ({ testes }) => {
    const unitarios = testes.filter(ehTesteUnitario).map(noApp);
    return unitarios.length ? item('Testes unitários', `na pasta app, ${codigo(`npx vitest run ${unitarios.join(' ')}`)}`) : [];
  },
  ({ testes }) => {
    const deTela = testes.filter(ehTesteDeTela).map(noApp);
    return deTela.length ? item('Testes de tela', `na pasta app, ${codigo(`npx playwright test ${deTela.join(' ')}`)}`) : [];
  },
  ({ assunto }) => (assunto.armadilhas?.length ? item('Armadilhas', '', assunto.armadilhas) : [])
];

/** O pedaço do mapa de um assunto: a âncora, o título, o resumo e, em listas curtas, tudo o que é dele. */
function secao(assunto: Assunto, leitura: Leitura): string[] {
  const arquivos = arquivosDoAssunto(assunto, leitura);
  const contexto = { assunto, arquivos, testes: testesDoAssunto(assunto, arquivos, leitura), leitura };
  // O resumo pode ter duas linhas: cada uma conta no índice, que diz as linhas de cada seção.
  return [`<a id="${assunto.id}"></a>`, `## ${assunto.titulo}`, '', ...assunto.resumo.split('\n'), '', ...PARTES_DA_SECAO.flatMap(parte => parte(contexto)), ''];
}

/** O que não caiu em nenhum assunto: arquivos, tabelas, partes do contrato e rotas. */
export function semAssunto(projeto: Projeto): string[] {
  return semAssuntoNa(ler(projeto));
}
function semAssuntoNa(leitura: Leitura): string[] {
  const todos = [COMUM, ...ASSUNTOS];
  const comAssunto = new Set(todos.flatMap(a => arquivosDoAssunto(a, leitura)));
  const tabelas = new Set(todos.flatMap(a => a.tabelas ?? []));
  const partes = new Set(todos.flatMap(a => a.dados ?? []));
  const rotas = new Set(todos.flatMap(a => a.rotas ?? []));
  return [
    ...leitura.arquivos.filter(c => !comAssunto.has(c)),
    ...[...leitura.criadaEm.keys()].sort(emOrdem).filter(t => !tabelas.has(t)).map(t => `tabela ${t}`),
    ...[...leitura.contrato.keys()].filter(p => !partes.has(p)).map(p => `contrato ${p}`),
    ...leitura.rotas.filter(r => !rotas.has(r)).map(r => `rota ${r}`)
  ];
}

/**
 * O que a tabela de assuntos cita e não existe mais (um arquivo renomeado, uma tabela, uma parte do contrato ou uma rota que saiu):
 * sem isto, o assunto perderia o arquivo sem ninguém ver.
 */
export function citadosQueNaoExistem(projeto: Projeto): string[] {
  const leitura = ler(projeto);
  const existe = (caminho: string) => leitura.arquivos.some(c => c === caminho || c.endsWith(`/${caminho}`));
  return [COMUM, ...ASSUNTOS].flatMap(a => [
    ...a.arquivos.filter(p => !leitura.arquivos.some(c => casa(p, c))).map(p => `${a.id}: arquivo ${String(p)}`),
    ...(a.testes ?? []).filter(p => !leitura.arquivos.some(c => ehTeste(c) && casa(p, c))).map(p => `${a.id}: teste ${String(p)}`),
    ...caminhosCitados([a.resumo, ...(a.armadilhas ?? [])].join('\n')).filter(c => !existe(c)).map(c => `${a.id}: o texto cita ${c}`),
    ...(a.tabelas ?? []).filter(t => !leitura.criadaEm.has(t)).map(t => `${a.id}: tabela ${t}`),
    ...(a.dados ?? []).filter(d => !leitura.contrato.has(d)).map(d => `${a.id}: contrato ${d}`),
    ...(a.rotas ?? []).filter(r => !leitura.rotas.includes(r)).map(r => `${a.id}: rota ${r}`)
  ]);
}

/** Os caminhos de arquivo citados entre crases nos textos escritos à mão ("`regras/quadro.ts`"), para conferir que existem. */
export function caminhosCitados(texto: string): string[] {
  return [...texto.matchAll(/`([\w.-]+(?:\/[\w.-]+)+\.(?:tsx?|mjs|css|sql))`/g)].map(m => m[1]);
}

/** Os assuntos de uma rota, como links para as seções deles. */
const assuntosDaRota = (rota: string) =>
  [COMUM, ...ASSUNTOS].filter(a => (a.rotas ?? []).includes(rota)).map(a => `[${a.titulo}](#${a.id})`).join(', ');

/**
 * A seção das rotas: cada endereço do app, a tela que abre, o assunto e quem escreve o endereço (links, painéis, ajudantes e
 * testes que vão direto a ele). É o que se procura quando um endereço sai ou muda de lugar.
 */
function secaoDasRotas(leitura: Leitura): string[] {
  const citados = leitura.arquivos.filter(c => /^app\/(src|e2e)\//.test(c) && c !== ARQUIVO_DAS_ROTAS)
    .map(c => ({ caminho: c, enderecos: enderecosCitados(leitura.ler(c)) }));
  const linhas = leitura.rotas.filter(r => !ROTAS_SEM_ENDERECO.includes(r)).flatMap(rota => {
    const quem = citados.filter(c => c.enderecos.has(rota)).map(c => c.caminho);
    const deTela = quem.filter(ehTesteDeTela).map(noApp);
    const outros = quem.filter(c => !ehTesteDeTela(c)).map(noApp);
    const tela = leitura.telas.get(rota);
    const testes = deTela.length > MUITOS_TESTES_DE_TELA
      ? `${deTela.length} testes de tela vão direto a ele: rode a bateria completa (${codigo('npm run testar-telas')}).`
      : `testes de tela que vão direto a ele, na pasta app: ${codigo(`npx playwright test ${deTela.join(' ')}`)}`;
    return [`- ${codigo(endereco(rota))}${tela ? ` (${tela})` : ''}: ${assuntosDaRota(rota) || 'sem assunto'}`,
      ...(outros.length ? [`  - escrevem o endereço: (app/) ${outros.join(', ')}`] : []),
      ...(deTela.length ? [`  - ${testes}`] : [])];
  });
  return ['<a id="rotas"></a>', '## Rotas e endereços', '',
    'Cada endereço do app (`app/src/App.tsx`), a tela que abre, o assunto e quem escreve o endereço. Endereço que sai ou muda: mude',
    'todos os que o escrevem, rode os testes de cada um e ponha o antigo em `regras/enderecosAntigos.ts`, para os links antigos valerem.',
    '', ...linhas, ''];
}

/** O começo do mapa: o que ele é e como usar. */
const CABECALHO = [
  '# Mapa do sistema',
  '',
  '<!-- Gerado por "npm run mapa --prefix app" (app/ferramentas/mapa/). Não edite à mão: mude a tabela app/ferramentas/mapa/assuntos.ts e rode de novo. -->',
  '',
  'Para cada assunto, onde estão as tabelas, as funções de dados, as regras, as telas e os testes. Antes de procurar no código,',
  'leia o assunto aqui (o índice diz as linhas de cada um). Durante o trabalho, rode só os testes do assunto (os comandos estão',
  'em cada um; os do banco pedem o Docker ligado); a bateria completa (`npm run verificar` e `npm run testar-telas`), uma vez, antes de',
  'enviar um lote ao main ou publicar. Os comandos já incluem os testes de outros assuntos que este costuma quebrar e, onde há funções',
  'de dados, o `src/dados/contrato.test.ts`. Endereço que sai ou muda: veja [Rotas e endereços](#rotas).',
  'Um arquivo pode estar em mais de um assunto. As listas são geradas; o resumo e as armadilhas são',
  'escritos à mão na tabela `app/ferramentas/mapa/assuntos.ts`. Arquivo, tabela ou assunto novo: classifique lá e rode',
  '`npm run mapa --prefix app`. Conflito neste arquivo ao juntar ramos: não resolva à mão, rode o mesmo comando.',
  '',
  '## Índice',
  ''
];

/** O mapa inteiro, pronto para gravar: arquivo → texto. */
export function gerarMapa(projeto: Projeto): Map<string, string> {
  const leitura = ler(projeto);
  const sobra = semAssuntoNa(leitura);
  const secoes = [
    ...[COMUM, ...ASSUNTOS].map(a => ({ id: a.id, titulo: a.titulo, resumo: a.resumo.split('\n')[0], linhas: secao(a, leitura) })),
    { id: 'rotas', titulo: 'Rotas e endereços', resumo: 'cada endereço, a tela que abre, o assunto e quem escreve o endereço.', linhas: secaoDasRotas(leitura) },
    {
      id: 'sem-assunto', titulo: 'Sem assunto', resumo: sobra.length ? `${sobra.length} para classificar.` : 'nada.',
      linhas: ['<a id="sem-assunto"></a>', '## Sem assunto', '',
        sobra.length ? 'Classifique cada um na tabela de app/ferramentas/mapa/assuntos.ts e rode `npm run mapa --prefix app`:' : 'Nada: tudo está classificado.',
        ...(sobra.length ? ['', ...sobra.map(s => `- ${s}`)] : [])]
    }
  ];
  // O índice tem uma linha por seção e uma em branco: cada seção começa depois dele e das anteriores (linhas contadas a partir de 1).
  let linha = CABECALHO.length + secoes.length + 2;
  const indice = secoes.map(s => {
    const inicio = linha;
    linha += s.linhas.length;
    return `- [${s.titulo}](#${s.id}), linhas ${inicio}–${linha - 1}: ${s.resumo}`;
  });
  const texto = `${[...CABECALHO, ...indice, '', ...secoes.flatMap(s => s.linhas)].join('\n')}\n`;
  return new Map([[ARQUIVO_DO_MAPA, texto]]);
}
