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
    rotas: tem(ARQUIVO_DAS_ROTAS) ? rotasDoApp(projeto.ler(ARQUIVO_DAS_ROTAS)) : []
  };
}

/** Os arquivos de um assunto: os que casam com a tabela e as migrações que mexem nas tabelas dele. */
function arquivosDoAssunto(assunto: Assunto, leitura: Leitura): string[] {
  const tabelas = new Set(assunto.tabelas ?? []);
  return leitura.arquivos.filter(c => ehDoAssunto(assunto, c) || (leitura.tabelasDe.get(c) ?? []).some(t => tabelas.has(t)));
}

const ehTesteUnitario = (c: string) => c.startsWith('app/') && /\.test\.tsx?$/.test(c);
const ehTesteDeTela = (c: string) => c.startsWith('app/e2e/') && c.endsWith('.spec.ts');
const naPasta = (base: string) => (c: string) => c.startsWith(base) && !ehTesteUnitario(c) && !ehTesteDeTela(c);
/** As pastas que têm item próprio na seção; o que está em app/ e fora delas vai para "Outros". */
const PASTAS_COM_ITEM = ['app/src/dados/', 'app/src/regras/', 'app/src/paginas/', 'app/src/ui/'];
const noApp = (c: string) => c.slice('app/'.length);
const codigo = (t: string) => `\`${t}\``;
/** Uma rota como se escreve no navegador: "pessoas/nova" → "/pessoas/nova/". */
const endereco = (r: string) => (r === '/' || r === '*' ? r : `/${r}/`);

/** O que cada parte da seção de um assunto recebe: o assunto, os arquivos dele e o que o mapa leu do projeto. */
interface Contexto { assunto: Assunto; arquivos: string[]; leitura: Leitura }
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
  listaDaPasta('Testes do banco', 'supabase/tests/', c => c.startsWith('supabase/tests/')),
  ({ arquivos }) => {
    const unitarios = arquivos.filter(ehTesteUnitario).map(noApp);
    return unitarios.length ? item('Testes unitários', `na pasta app, ${codigo(`npx vitest run ${unitarios.join(' ')}`)}`) : [];
  },
  ({ arquivos }) => {
    const deTela = arquivos.filter(ehTesteDeTela).map(noApp);
    return deTela.length ? item('Testes de tela', `na pasta app, ${codigo(`npx playwright test ${deTela.join(' ')}`)}`) : [];
  },
  ({ assunto }) => (assunto.armadilhas?.length ? item('Armadilhas', '', assunto.armadilhas) : [])
];

/** O pedaço do mapa de um assunto: a âncora, o título, o resumo e, em listas curtas, tudo o que é dele. */
function secao(assunto: Assunto, leitura: Leitura): string[] {
  const contexto = { assunto, arquivos: arquivosDoAssunto(assunto, leitura), leitura };
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
  return [COMUM, ...ASSUNTOS].flatMap(a => [
    ...a.arquivos.filter(p => !leitura.arquivos.some(c => casa(p, c))).map(p => `${a.id}: arquivo ${String(p)}`),
    ...(a.tabelas ?? []).filter(t => !leitura.criadaEm.has(t)).map(t => `${a.id}: tabela ${t}`),
    ...(a.dados ?? []).filter(d => !leitura.contrato.has(d)).map(d => `${a.id}: contrato ${d}`),
    ...(a.rotas ?? []).filter(r => !leitura.rotas.includes(r)).map(r => `${a.id}: rota ${r}`)
  ]);
}

/** O começo do mapa: o que ele é e como usar. */
const CABECALHO = [
  '# Mapa do sistema',
  '',
  '<!-- Gerado por "npm run mapa --prefix app" (app/ferramentas/mapa/). Não edite à mão: mude a tabela app/ferramentas/mapa/assuntos.ts e rode de novo. -->',
  '',
  'Para cada assunto, onde estão as tabelas, as funções de dados, as regras, as telas e os testes. Antes de procurar no código,',
  'leia o assunto aqui (o índice diz as linhas de cada um). Durante o trabalho, rode só os testes do assunto (os comandos estão',
  'em cada um, para rodar na pasta app); a bateria completa (`npm run verificar` e `npm run testar-telas`), uma vez, antes de enviar',
  'um lote ao main ou publicar. Um arquivo pode estar em mais de um assunto. As listas são geradas; o resumo e as armadilhas são',
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
