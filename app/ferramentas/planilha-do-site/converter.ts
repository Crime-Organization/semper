// Linha de comando do conversor: planilha do site (+ Google Contatos) -> CSV de importação do SEMPER.
// Rode com: npm run converter-planilha --prefix app -- --site <planilha.csv> (veja o README.md desta pasta).
// O console só mostra contagens: nunca nome, documento, telefone, e-mail ou texto de célula (LGPD).
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SEPARADOR_DE_LISTA } from '../../src/regras/importacao';
import { LGPD } from '../../src/regras/pessoa';
import { normal } from '../../src/regras/texto';
import { lerDecisoes, linhasParaDecidir, type Decisoes } from './decisoes';
import { gravar, lerTabela, nomeDoArquivo } from './ler';
import { DATA_ISO, limpar } from './limpar';
import { conferirNaTela, csvParaConferir, csvParaSemper, linhasDaConferencia, paraSemper } from './paraSemper';
import { conferirCabecalhosDoGoogle, lerExportacaoDoGoogle, lerPlanilhaDoSite } from './planilhas';

/** Pasta de saída padrão, relativa à pasta app/ (exportacoes/ fica fora do Git). */
export const SAIDA_PADRAO = '../exportacoes/importacao-semper/';
export const ARQUIVOS = { pessoas: 'pessoas-para-o-semper.csv', decidir: 'para-decidir.csv', conferencia: 'conferencia.csv' } as const;

export const AJUDA = `Conversor da planilha de cadastros do site para o CSV de importação do SEMPER.

Uso: npm run converter-planilha --prefix app -- --site <planilha.csv> [opções]

  --site <csv>       a aba do formulário baixada do Google Planilhas em CSV (obrigatória)
  --google <csv>     exportação do Google Contatos (Google CSV); pode repetir: o 1º é o atual, os outros completam
  --saida <pasta>    onde gravar (padrão: exportacoes/importacao-semper/)
  --decisoes <csv>   o para-decidir.csv com a coluna "Sua decisão" preenchida (sim/não)
  --lgpd <chave>     base legal para todos: ${Object.keys(LGPD).join(', ')} (padrão: a escolha da tela)
  --hoje AAAA-MM-DD  data de hoje (só para teste)

Os arquivos gravados têm dados de clientes: deixe-os só em exportacoes/ e apague-os depois de importar.`;

export interface Argumentos {
  site: string;
  google: string[];
  saida: string | null;
  decisoes: string | null;
  lgpd: string | null;
  hoje: string | null;
}

/** O que cada opção faz com o valor que vem depois dela. */
const OPCOES: Record<string, (a: Argumentos, valor: string) => void> = {
  '--site': (a, v) => { a.site = v; },
  '--google': (a, v) => { a.google.push(v); },
  '--saida': (a, v) => { a.saida = v; },
  '--decisoes': (a, v) => { a.decisoes = v; },
  '--lgpd': (a, v) => {
    if (!Object.hasOwn(LGPD, v)) throw new Error(`Base legal "${v}" não existe. Use uma destas: ${Object.keys(LGPD).join(', ')}.`);
    a.lgpd = v;
  },
  '--hoje': (a, v) => {
    if (!DATA_ISO.test(v)) throw new Error('Use --hoje no formato AAAA-MM-DD.');
    a.hoje = v;
  }
};
const PEDIR_AJUDA: ReadonlySet<string> = new Set(['--ajuda', '--help', '-h']);

/** Os argumentos da linha de comando (sem "node" e o script). null = mostrar a ajuda. Lança Error em português. */
export function lerArgumentos(argv: string[]): Argumentos | null {
  const a: Argumentos = { site: '', google: [], saida: null, decisoes: null, lgpd: null, hoje: null };
  for (let i = 0; i < argv.length; i++) {
    const opcao = argv[i];
    if (PEDIR_AJUDA.has(opcao)) return null;
    const aplicar = OPCOES[opcao];
    if (!aplicar) throw new Error(`Opção desconhecida: ${opcao}. Rode sem opções para ver a ajuda.`);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith('--')) throw new Error(`Falta o valor de ${opcao}.`);
    aplicar(a, valor);
    i++;
  }
  return a.site ? a : null;
}

/** Hoje (AAAA-MM-DD) no horário de Brasília. */
const hojeEmBrasilia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

/** Quando mais da metade das datas de envio não é lida, a planilha provavelmente veio em outro formato. */
export const AVISO_DAS_DATAS = 'Atenção: mais da metade das datas de envio não foi lida. Baixe a planilha com as datas em '
  + 'DD/MM/AAAA (Arquivo > Configurações > Localidade: Brasil) e rode de novo; datas no formato americano (M/D/AAAA) '
  + 'com o dia até 12 seriam lidas trocadas.';

/** Quantos itens há de cada valor (para as contagens do console). */
function contar(valores: string[]): string {
  const m = new Map<string, number>();
  for (const v of valores) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([v, n]) => `${v}: ${n}`).join('; ') || 'nenhum';
}

/**
 * Roda o conversor. "base": de onde os caminhos das opções são relativos (a pasta de onde o comando foi chamado);
 * "app": a pasta app/ (a saída padrão é relativa a ela). Devolve as linhas para o console (só contagens).
 */
export function converter(args: Argumentos, base: string, app: string): string[] {
  const caminho = (p: string) => resolve(base, p);
  const site = lerPlanilhaDoSite(lerTabela(caminho(args.site), '--site'));
  const google = args.google.map(g => lerExportacaoDoGoogle(nomeDoArquivo(g), lerTabela(caminho(g), '--google')));
  conferirCabecalhosDoGoogle(google);
  const decisoes: Decisoes = args.decisoes ? lerDecisoes(lerTabela(caminho(args.decisoes), '--decisoes')) : new Map();

  const { finais, rel } = limpar({ site, google }, decisoes);
  const { linhas, marcas } = paraSemper(finais, { lgpd: args.lgpd ?? undefined });
  const csv = csvParaSemper(linhas);
  const tela = conferirNaTela(csv, { hoje: args.hoje ?? hojeEmBrasilia(), lgpdPadrao: args.lgpd ?? 'contrato' });

  const pasta = args.saida ? caminho(args.saida) : resolve(app, SAIDA_PADRAO);
  gravar(pasta, ARQUIVOS.pessoas, csv);
  gravar(pasta, ARQUIVOS.conferencia, csvParaConferir(linhasDaConferencia(finais)));
  // Sempre gravado (só o cabeçalho quando não há pares): um para-decidir.csv de outra execução não pode ficar na pasta.
  gravar(pasta, ARQUIVOS.decidir, csvParaConferir(linhasParaDecidir(rel.pares)));

  const pendentes = rel.pares.filter(p => !p.decisao);
  const quantas = (f: (i: number) => boolean) => linhas.filter((_, i) => f(i)).length;
  return [
    `Planilha do site: ${rel.linhasDoSite} linhas; ${rel.semNome} sem nome (ficaram de fora).`,
    `Data de envio: ${rel.envios.ilegiveis} de ${rel.envios.comData} não puderam ser lidas (ficaram sem data).`,
    ...(rel.envios.ilegiveis * 2 > rel.envios.comData ? [AVISO_DAS_DATAS] : []),
    `Google Contatos: ${rel.contatosDoGoogle} contatos usados (${rel.complementosDoGoogle} dos arquivos seguintes).`,
    `Clientes para o SEMPER: ${finais.length} (${contar(linhas.map(l => l.tipo))}).`,
    `Juntados (clientes por motivo): ${Object.entries(rel.juntados).map(([m, n]) => `${m}: ${n}`).join('; ') || 'nenhum'}.`,
    `Mesmo nome separados por CPF/CNPJ diferentes: ${rel.separadosPorProva}.`,
    `Pares para decidir: ${rel.pares.length}, ${pendentes.length} sem decisão (${contar(pendentes.map(p => p.caso))}).`,
    `Decisões: ${rel.decisoes.aplicadas} aplicadas; ${rel.decisoes.ignoradas} ignoradas (o par não existe mais).`,
    `Com o mesmo CPF/CNPJ de outro cliente: ${quantas(i => marcas[i].mesmoDocumento)}.`,
    `Juntados com CPF/CNPJ ou datas diferentes entre os cadastros (marcados para conferir): ${quantas(i => marcas[i].provasDivergentes)}.`,
    `Tipo de cadastro não reconhecido: ${quantas(i => marcas[i].tipoNaoReconhecido)}.`,
    `Com observação: ${quantas(i => !!linhas[i].observacoes)} (${quantas(i => marcas[i].observacaoCortada)} cortadas).`,
    `Com "conferir": ${quantas(i => !!linhas[i].conferir)}.`,
    `Referências repetidas (ganharam -2, -3…): ${rel.referenciasRepetidas}.`,
    `Responsáveis distintos: ${new Set(linhas.flatMap(l => l.responsaveis ? l.responsaveis.split(SEPARADOR_DE_LISTA).map(normal) : [])).size}.`,
    `Na tela de importação: ${tela.recusadas} linhas seriam recusadas; ${tela.comAviso} com aviso.`,
    ...(tela.recusadas ? [`Recusadas (linha de ${ARQUIVOS.pessoas} e colunas com erro): ${tela.porQueRecusadas.join('; ')}.`] : []),
    `Arquivos gravados em ${pasta}: ${[ARQUIVOS.pessoas, ARQUIVOS.decidir, ARQUIVOS.conferencia].join(', ')}.`,
    'Os arquivos têm dados de clientes: apague-os depois de importar.'
  ];
}

/** Só roda quando chamado pela linha de comando (não quando os testes importam este arquivo). */
function principal() {
  try {
    const args = lerArgumentos(process.argv.slice(2));
    if (!args) { console.log(AJUDA); return; }
    for (const linha of converter(args, process.env.INIT_CWD ?? process.cwd(), process.cwd())) console.log(linha);
  } catch (e) {
    console.error(`Erro: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
