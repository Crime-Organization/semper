// Junta os cadastros repetidos da planilha do site, cruza com o Google Contatos e monta os clientes finais.
// Porte do script de limpeza usado nos dados reais (limpar.cjs): as regras de juntar e separar são as mesmas.
// Puro: recebe as linhas já lidas e devolve os clientes e as contagens. Sem arquivo, sem console, sem estado no módulo.
import type { TipoPessoa } from '../../src/dados/tipos';
import {
  cnpjValido, cpfValido, dig, DIGITOS_DO_CEP, espacos, fmtData, FUSO_PADRAO, lerData, lerDataFlexivel, lerDataHora,
  limparDocumento, MASCARAS, tabela
} from '../../src/regras/pessoa';
import { normal } from '../../src/regras/texto';
import { DIA, SEGUNDO } from '../../src/ui/tempos';
import { aplicarDecisoes, type Decisao, type Decisoes, type Par } from './decisoes';
import { chaveDoNome, NOME_CONTIDO, nomeNorm, semAcento, semelhanca, tokens } from './nomes';
import type { ArquivoGoogle, ColunaDoSite, LinhaDoSite } from './planilhas';
import { envioMaisAntigo, referenciaBase, semRepetir, type EnvioDoSite } from './referencia';
import { chave, extrair, lerTodos, type Lido } from './telefones';

// ---------- tipos ----------

/** Um telefone lido, com a chave que o compara com os outros (o número, ou "X" + o texto quando não serve para comparar). */
export interface Telefone { k: string; t: Lido }

/** Campos de texto de um cadastro do site, completados com os envios anteriores ao juntar. */
type CampoDoSite = 'nome' | 'tipoTexto' | 'genero' | 'nacionalidade' | 'profissao' | 'estadoCivil' | 'cpf' | 'cpfTexto' | 'rg'
  | 'rgExpedicao' | 'mae' | 'pai' | 'nascimento' | 'nascimentoMunicipio' | 'nascimentoUf' | 'tipoEntidade' | 'fantasia'
  | 'porte' | 'cnpj' | 'cnpjTexto' | 'abertura' | 'representantes' | 'logradouro' | 'numero' | 'complemento' | 'bairro'
  | 'municipio' | 'uf' | 'cep' | 'cepTexto';

/** Um cliente do site: um envio do formulário ou vários juntados. */
export type PessoaDoSite = Record<CampoDoSite, string> & {
  linhas: number[];
  envios: EnvioDoSite[];
  /** Instante do envio que decide os campos (o mais recente), em milissegundos. */
  enviado: number | null;
  /** "PROFISSIONAL RESPONSÁVEL" de cada envio, do mais antigo ao mais recente. */
  responsaveis: string[];
  tipo: TipoPessoa | null;
  nn: string;
  /** "QUALIFICAÇÃO_37" de cada envio (a qualificação que a planilha montava). */
  qualificacoes: string[];
  telefones: Telefone[];
  emails: string[];
  /** CPF (pessoa física) ou CNPJ (pessoa jurídica) válido, só letras e números; null se não há. */
  doc: string | null;
  /** O que os envios anteriores tinham de diferente e ficou de fora ao juntar, um campo por linha. */
  diferencas: string[];
  comoJuntado: string[];
  /** Os CPF/CNPJ válidos e as datas legíveis de todos os envios juntados (para avisar quando não batem entre si). */
  provasDosEnvios: ProvasDosEnvios;
};
/** O que pode provar (ou desmentir) que dois envios são da mesma pessoa, de cada envio juntado. */
export interface ProvasDosEnvios { docs: string[]; nascimentos: string[]; aberturas: string[] }

/** Um contato do Google Contatos. */
interface ContatoGoogle {
  /** Posição na lista (primeiro arquivo, depois os complementos): desempata a ordem. */
  ordem: number;
  arquivo: string;
  linha: number;
  campos: Record<string, string>;
  nome: string;
  nn: string;
  telefones: Telefone[];
  emails: string[];
  notas: string;
  aniversario: string;
}

/** Um contato final: do Google (um ou mais contatos juntados), do site, ou os dois. */
interface Ficha {
  membros: ContatoGoogle[];
  /** O nome do Google (quando há contato) ou o do site: é o que se compara na conferência de mesmo nome. */
  nome: string;
  nn: string;
  telefones: Telefone[];
  emails: string[];
  /** A descrição do contato do Google (a mais completa dos juntados). */
  notas: string;
  site: PessoaDoSite | null;
  comoJuntado: string[];
}

/** Outro cliente que pode ser a mesma pessoa (par sem decisão). */
export interface Pendente { referencia: string; nome: string; caso: string }

/** Um cliente do site pronto para virar a linha do SEMPER (paraSemper). */
export interface ClienteFinal {
  referencia: string;
  /** Os campos do cadastro (do envio mais recente, completados com os anteriores). */
  site: PessoaDoSite;
  /** Os números do site e dos contatos do Google que casaram, sem repetir. */
  telefones: Lido[];
  emails: string[];
  /** O envio mais antigo (ISO), ou null se nenhum envio tem data. */
  primeiroEnvio: string | null;
  /** Partes da observação: diferenças dos envios anteriores e o que a descrição do Google tinha além da qualificação. */
  observacoes: string[];
  pendentes: Pendente[];
  /** Contatos do Google que casaram ("arquivo:linha"). */
  contatosGoogle: string[];
  comoJuntado: string[];
  /** Os cadastros juntados têm CPFs (ou CNPJs, ou datas de nascimento ou de criação) diferentes entre si: a junção em
   *  cadeia (pelo telefone, e-mail ou Google) pode ter unido pessoas diferentes. Vai para "conferir". */
  provasDivergentes: boolean;
}

export interface Relatorio {
  /** Linhas (não vazias) lidas da planilha do site. */
  linhasDoSite: number;
  /** Linhas do site sem nome: ficam de fora. */
  semNome: number;
  /** Contatos do Google usados (os do primeiro arquivo e os dos complementos que entraram). */
  contatosDoGoogle: number;
  /** Contatos dos arquivos seguintes que entraram (sem nada em comum com o primeiro). */
  complementosDoGoogle: number;
  /** Clientes por motivo de junção (um cliente pode ter mais de um motivo). */
  juntados: Record<string, number>;
  /** Pares de mesmo nome separados porque o CPF/CNPJ ou a data não batem. */
  separadosPorProva: number;
  pares: Par[];
  decisoes: { aplicadas: number; ignoradas: number };
  referenciasRepetidas: number;
  /** Envios com a data de envio preenchida, e quantos deles não puderam ser lidos (ficaram sem data). */
  envios: { comData: number; ilegiveis: number };
}

export interface Entrada { site: LinhaDoSite[]; google: ArquivoGoogle[] }

// ---------- motivos e casos ----------

/** Por que um cliente foi juntado (a coluna "Como foi juntado" da conferência). */
export const MOTIVOS = {
  siteComSite: 'envios repetidos no site (mesmo CPF/CNPJ, telefone ou e-mail e nome parecido): valeu o envio mais recente, completado com os anteriores',
  googleRepetido: 'contatos repetidos no Google (mesmo telefone, e-mail ou descrição e nome parecido)',
  variosDoGoogle: 'mais de um contato do Google com o telefone ou e-mail do cliente e nome parecido',
  mesmoNomeComProva: 'mesmo nome e mesmo CPF/CNPJ ou data de nascimento',
  decisao: 'pela sua decisão (para-decidir.csv)'
} as const;
/** Por onde o cliente do site casou com o contato do Google. */
type Via = 'telefone' | 'e-mail' | 'nome';
const POR_ONDE: Record<Via, string> = {
  telefone: 'com o contato do Google pelo telefone e nome parecido',
  'e-mail': 'com o contato do Google pelo e-mail e nome parecido',
  nome: 'com o contato do Google pelo nome completo e mesmo CPF/CNPJ ou data'
};

/** Os casos da lista para decidir. */
export const CASOS = {
  mesmoDocumento: 'Mesmo CPF/CNPJ com nomes diferentes',
  mesmoNomeDocumentoDiferente: 'Mesmo nome e mesmo telefone ou e-mail, mas CPF/CNPJ diferentes',
  mesmoNomeSemProva: 'Mesmo nome, sem telefone, e-mail, CPF ou data em comum',
  documentoDiferente: (via: Via) => `Nome parecido e mesmo ${via}, mas CPF/CNPJ diferentes`
} as const;
const SEPARADOS = 'mantidos separados';
const DOCUMENTO_NOS_DOIS = 'mantidos separados; o CPF/CNPJ ficou nos dois';
/** O que foi feito com um par decidido (juntos: os dois acabaram no mesmo cliente). Um "sim" que juntaria dois
 *  clientes que você separou com "não" (em cadeia: A=B, B=C, mas A≠C) não é aplicado: o "não" vale. */
const FEITO_DA_DECISAO: Record<Decisao, (juntos: boolean) => string> = {
  sim: juntos => juntos ? 'juntados pela sua decisão' : 'mantidos separados: juntar desfaria outra decisão sua ("não")',
  nao: () => 'mantidos separados pela sua decisão'
};
/** Mais que isso de outros clientes no "conferir" de um cliente vira "e mais N" (o texto vai para a observação). */
export const PENDENTES_NO_CONFERIR = 5;

// ---------- auxiliares ----------

/** Grupos de índices que vão sendo unidos (union-find). */
class Grupos {
  private readonly pai: number[];
  constructor(n: number) { this.pai = Array.from({ length: n }, (_, i) => i); }
  raiz(i: number): number {
    let r = i;
    while (this.pai[r] !== r) r = this.pai[r] = this.pai[this.pai[r]];
    return r;
  }
  unir(a: number, b: number) {
    const [ra, rb] = [this.raiz(a), this.raiz(b)];
    if (ra !== rb) this.pai[Math.max(ra, rb)] = Math.min(ra, rb);
  }
  /** Os grupos, na ordem do primeiro índice de cada um. */
  lista(): number[][] {
    const m = new Map<number, number[]>();
    this.pai.forEach((_, i) => juntarEm(m, this.raiz(i), i));
    return [...m.values()];
  }
}

function juntarEm<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const lista = m.get(k);
  if (lista) lista.push(v); else m.set(k, [v]);
}
const semRepetidos = (itens: string[]) => [...new Set(itens)];
/** Cada par de uma lista de índices (a < b), na ordem. */
function* paresDe(ids: number[]): Generator<[number, number]> {
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) yield [ids[a], ids[b]];
}

const DIGITOS_DO_CPF = 11, CARACTERES_DO_CNPJ = 14;
/** Zeros do começo que a planilha apaga de um CPF ou CNPJ guardado como número (e que a leitura devolve). */
const ZEROS_PERDIDOS_MAXIMOS = 2;
/** Os CEPs que começam com 0 (e que a planilha guarda com 7 algarismos) são os de São Paulo. */
export const UF_DOS_CEPS_COM_ZERO = 'SP';
/** Palavras mínimas no nome para casar com o Google só pelo nome. */
const PALAVRAS_MINIMAS_DO_NOME = 2;

/** O número só de algarismos com os zeros do começo devolvidos, se assim ele fica válido; senão, como veio. */
function devolverZeros(d: string, tamanho: number, valido: (d: string) => boolean) {
  if (!/^\d+$/.test(d) || d.length >= tamanho || d.length < tamanho - ZEROS_PERDIDOS_MAXIMOS) return d;
  const completo = d.padStart(tamanho, '0');
  return valido(completo) ? completo : d;
}

// Datas: a planilha baixada em CSV traz o texto que o Google mostra; uma célula formatada como número traz o número de
// série do Excel (dias desde 30/12/1899).
/** Número de série aceito como data: 5 algarismos (10000 é 18/05/1927). Com 4, é quase sempre um ano digitado ("1980"),
 *  que fica como veio (a tela guarda na observação) em vez de virar uma data de 1905. */
const SERIE_DO_EXCEL = /^\d{5}(\.\d+)?$/;
/** O último número de série aceito: 31/12/2099. Acima disso, o número não é uma data. */
const SERIE_MAXIMA = 73050;
const ehSerieDoExcel = (t: string) => SERIE_DO_EXCEL.test(t) && Number(t) <= SERIE_MAXIMA;
const EPOCA_DO_EXCEL = Date.UTC(1899, 11, 30);
/** Caracteres de "AAAA-MM-DD" e de "AAAA-MM-DDTHH:MM:SS.mmm" numa data ISO. */
const TAMANHO_DA_DATA = 10, TAMANHO_DA_HORA = 23;
/** Data já lida ("AAAA-MM-DD"). */
export const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const tentar = <T>(ler: () => T): T | null => { try { return ler(); } catch { return null; } };
/** As leituras de data, na ordem: DD/MM/AAAA, D/M/AAAA ou AAAA-MM-DD; depois só os algarismos (01-02-1980, 01021980). */
const LEITURAS_DE_DATA: ((t: string) => string | null)[] = [lerDataFlexivel, t => lerData(MASCARAS.data(t))];

/** Data de nascimento, de expedição ou de criação -> "AAAA-MM-DD"; ilegível fica como veio; vazia, "". */
function lerDataDoSite(texto: string | undefined): string {
  const t = espacos(texto);
  if (!t) return '';
  if (ehSerieDoExcel(t)) return new Date(EPOCA_DO_EXCEL + Math.round(Number(t)) * DIA).toISOString().slice(0, TAMANHO_DA_DATA);
  for (const ler of LEITURAS_DE_DATA) {
    const iso = tentar(() => ler(t));
    if (iso) return iso;
  }
  return t;
}

/** Data e hora do envio -> ISO e milissegundos; sem fuso, o horário de Brasília. Vazia ou ilegível: null. */
function lerEnvio(texto: string | undefined): { iso: string; ms: number } | null {
  const t = espacos(texto);
  if (!t) return null;
  let iso: string | null;
  if (ehSerieDoExcel(t)) {
    const local = new Date(EPOCA_DO_EXCEL + Math.round(Number(t) * DIA / SEGUNDO) * SEGUNDO).toISOString().slice(0, TAMANHO_DA_HORA);
    iso = new Date(local + FUSO_PADRAO).toISOString();
  } else iso = tentar(() => lerDataHora(t));
  return iso ? { iso, ms: Date.parse(iso) } : null;
}

/** Lê os números de um ou mais campos e devolve-os sem repetição (o preenchimento, como (00) 0000-0000, sai). */
function lerTelefones(valores: string[]): Telefone[] {
  const saida: Telefone[] = [];
  for (const t of lerTodos(valores.flatMap(extrair))) {
    if (t.lixo) continue;
    const k = chave(t) ?? 'X' + t.original;
    if (!saida.some(x => x.k === k)) saida.push({ k, t });
  }
  return saida;
}

// ---------- Google ----------

/** Contatos dos arquivos do Google. O primeiro arquivo é a versão atual; dos seguintes só entram os contatos sem
 *  telefone, e-mail ou nome em comum com o primeiro (os outros são versões antigas de contatos que já estão nele). */
function lerGoogle(arquivos: ArquivoGoogle[], rel: Relatorio): ContatoGoogle[] {
  const porArquivo = arquivos.map(({ arquivo, contatos }) => contatos.map(({ linha, campos }) => {
    const nome = espacos([campos['First Name'], campos['Middle Name'], campos['Last Name']].filter(Boolean).join(' '));
    const telefones: string[] = [];
    for (let i = 1; campos[`Phone ${i} - Value`] !== undefined; i++) {
      const valor = campos[`Phone ${i} - Value`];
      if (valor && /\d/.test(valor)) telefones.push(valor);
    }
    const emails: string[] = [];
    for (let i = 1; campos[`E-mail ${i} - Value`] !== undefined; i++) {
      for (const e of campos[`E-mail ${i} - Value`].split(':::').map(s => s.trim().toLowerCase()).filter(Boolean)) {
        if (!emails.includes(e)) emails.push(e);
      }
    }
    return {
      ordem: 0, arquivo, linha, campos, nome, nn: nomeNorm(nome), telefones: lerTelefones(telefones), emails,
      notas: campos.Notes ?? '', aniversario: campos.Birthday ?? ''
    };
  }));
  const [atuais = [], ...complementos] = porArquivo;
  const chaves = new Set(atuais.flatMap(c => [
    ...c.telefones.filter(x => chave(x.t)).map(x => 'T' + x.k), ...c.emails.map(e => 'E' + e), 'N' + chaveDoNome(c.nome)
  ]));
  const novo = (c: ContatoGoogle) => !c.telefones.some(x => chave(x.t) && chaves.has('T' + x.k))
    && !c.emails.some(e => chaves.has('E' + e)) && !chaves.has('N' + chaveDoNome(c.nome));
  const aceitos = complementos.flat().filter(novo);
  rel.complementosDoGoogle = aceitos.length;
  return [...atuais, ...aceitos].map((c, ordem) => ({ ...c, ordem }));
}

const preenchidos = (c: ContatoGoogle) => Object.values(c.campos).filter(Boolean).length;

/** Junta contatos do Google: o nome vem de quem tem o nome mais completo; a descrição, a mais longa. */
function juntarGoogle(membros: ContatoGoogle[], motivo: string, antes: string[] = []): Ficha {
  const ord = [...membros].sort((a, b) => preenchidos(b) - preenchidos(a) || a.ordem - b.ordem);
  const base = [...ord].sort((a, b) => tokens(b.nome).length - tokens(a.nome).length || ord.indexOf(a) - ord.indexOf(b))[0];
  const telefones: Telefone[] = [], emails: string[] = [];
  for (const m of ord) {
    for (const x of m.telefones) if (!telefones.some(y => y.k === x.k)) telefones.push(x);
    for (const e of m.emails) if (!emails.includes(e)) emails.push(e);
  }
  const notasDiferentes = [...new Map(ord.filter(m => m.notas).map(m => [espacos(m.notas).toUpperCase(), m])).values()];
  const notasBase = notasDiferentes.sort((a, b) => b.notas.length - a.notas.length)[0];
  return {
    membros: ord, nome: base.nome, nn: base.nn, telefones, emails, notas: notasBase?.notas ?? '', site: null,
    comoJuntado: semRepetidos([...antes, ...(membros.length > 1 ? [motivo] : [])])
  };
}

// Provas de que dois cadastros de mesmo nome são a mesma pessoa (regra da tarefa #165): o CPF/CNPJ (do site ou escrito
// na descrição do Google) e a data de nascimento ou de criação (do site ou o aniversário do Google).
/** Quantos caracteres (sem algarismo) podem separar o rótulo "CPF"/"CNPJ" do número ("CPF nº ", "CNPJ sob o nº "). */
const DISTANCIA_DO_ROTULO = 25;
/** Caracteres de um CPF ou CNPJ escrito: de 11 (CPF só com algarismos) a 18 (CNPJ com pontos, barra e traço). */
const ESCRITO_MINIMO = 11, ESCRITO_MAXIMO = 18;
const DOC_NA_DESCRICAO = new RegExp(`(?:CPF|CNPJ)\\D{0,${DISTANCIA_DO_ROTULO}}([\\d./-]{${ESCRITO_MINIMO},${ESCRITO_MAXIMO}})`, 'gi');
/** CNPJ com letras (desde julho de 2026) escrito na descrição: só depois do rótulo "CNPJ" e como palavra inteira, para
 *  não achar um "CNPJ" no meio de um e-mail ("ariaoliveira76@…" tem o formato e, às vezes, os dígitos verificadores). */
const CNPJ_COM_LETRAS_NA_DESCRICAO = new RegExp(`CNPJ\\D{0,${DISTANCIA_DO_ROTULO}}?(?<![0-9A-Z@.])`
  + '([0-9A-Z]{2}\\.?[0-9A-Z]{3}\\.?[0-9A-Z]{3}\\/?[0-9A-Z]{4}-?\\d{2})(?![0-9A-Z@])', 'gi');
/** Aniversário do Google: "AAAA-MM-DD" ou, sem o ano, "--MM-DD". */
const ANIVERSARIO = /^(\d{4}|-)-\d{2}-\d{2}$/;
/** Dia e mês do fim de uma data ("MM-DD"), para comparar com aniversário sem ano. */
const DIA_E_MES = 5;
type Prova = 'confirma' | 'contradiz' | 'sem prova';
interface Provas { docs: Set<string>; datas: Set<string> }
type ComProvas = Pick<Ficha, 'membros' | 'site'>;

function provas(c: ComProvas): Provas {
  const docs = new Set<string>(), datas = new Set<string>();
  for (const m of c.membros) {
    for (const [, d] of m.notas.matchAll(DOC_NA_DESCRICAO)) { const x = limparDocumento(d); if (cpfValido(x) || cnpjValido(x)) docs.add(x); }
    for (const [, d] of m.notas.matchAll(CNPJ_COM_LETRAS_NA_DESCRICAO)) { const x = limparDocumento(d); if (/[A-Z]/.test(x) && cnpjValido(x)) docs.add(x); }
    if (ANIVERSARIO.test(m.aniversario)) datas.add(m.aniversario);
  }
  const p = c.site;
  if (p) {
    if (p.doc) docs.add(p.doc);
    for (const v of [p.nascimento, p.abertura]) if (DATA_ISO.test(v)) datas.add(v);
  }
  return { docs, datas };
}
/** CPFs (ou CNPJs) dos dois lados, sem nenhum em comum. Compara CPF com CPF e CNPJ com CNPJ: a descrição de uma
 *  empresa traz o CNPJ dela e o CPF do representante. */
function docsConflitam(A: Set<string>, B: Set<string>) {
  for (const tamanho of [DIGITOS_DO_CPF, CARACTERES_DO_CNPJ]) {
    const a = [...A].filter(d => d.length === tamanho), b = [...B].filter(d => d.length === tamanho);
    if (a.length && b.length && !a.some(d => b.includes(d))) return true;
  }
  return false;
}
/** "confirma" (documento ou data em comum), "contradiz" (os dois têm documento ou data e nada bate) ou "sem prova".
 *  Aniversário do Google sem ano compara só dia e mês. */
function compararProvas(a: ComProvas, b: ComProvas): Prova {
  const A = provas(a), B = provas(b);
  if ([...A.docs].some(d => B.docs.has(d))) return 'confirma';
  if (docsConflitam(A.docs, B.docs)) return 'contradiz';
  const comAno = (d: string) => /^\d{4}-/.test(d);
  if ([...A.datas].some(x => [...B.datas].some(y => comAno(x) && comAno(y) ? x === y : x.slice(-DIA_E_MES) === y.slice(-DIA_E_MES)))) return 'confirma';
  if (A.datas.size && B.datas.size) return 'contradiz';
  return 'sem prova';
}
const sozinho = (m: ContatoGoogle): ComProvas => ({ membros: [m], site: null });

/** Junta contatos com telefone, e-mail ou descrição iguais quando os nomes são iguais ou um contém o outro. */
function agruparGoogle(lista: ContatoGoogle[]): Ficha[] {
  const g = new Grupos(lista.length), baldes = new Map<string, number[]>();
  lista.forEach((c, i) => {
    if (!c.nn) return;
    for (const x of c.telefones) if (chave(x.t)) juntarEm(baldes, 'T|' + x.k, i);
    for (const e of c.emails) juntarEm(baldes, 'E|' + e, i);
    if (c.notas) juntarEm(baldes, 'N|' + espacos(c.notas).toUpperCase(), i);
  });
  for (const ids of baldes.values()) {
    for (const [a, b] of paresDe(ids)) {
      if (semelhanca(lista[a].nome, lista[b].nome) >= NOME_CONTIDO && !docsConflitam(provas(sozinho(lista[a])).docs, provas(sozinho(lista[b])).docs)) g.unir(a, b);
    }
  }
  // Contato só com o nome (sem telefone, e-mail ou descrição): junta ao único outro contato de mesmo nome.
  const porNome = new Map<string, number[]>();
  lista.forEach((c, i) => { const k = chaveDoNome(c.nome); if (k) juntarEm(porNome, k, i); });
  lista.forEach((c, i) => {
    const k = chaveDoNome(c.nome);
    if (!k || c.telefones.length || c.emails.length || c.notas) return;
    const outros = [...new Set((porNome.get(k) ?? []).filter(j => j !== i).map(j => g.raiz(j)))];
    if (outros.length === 1) g.unir(outros[0], i);
  });
  return g.lista().map(ids => juntarGoogle(ids.map(i => lista[i]), MOTIVOS.googleRepetido));
}

// ---------- Site ----------

const TIPO_DO_SITE = tabela<TipoPessoa>([['Pessoa Física', 'pf'], ['Entidade Empresarial', 'pj'], ['Entidade sem Fins Lucrativos', 'pj'],
  ['Administração Pública', 'pj'], ['Somente informações de contato', 'contato']]);
/** As naturezas jurídicas (chaves de NATUREZAS) que o formulário do site oferece. */
type NaturezaDoSite = 'empresarial' | 'sem_fins' | 'publica';
const NATUREZA_DO_SITE = tabela<NaturezaDoSite>([['Entidade Empresarial', 'empresarial'], ['Entidade sem Fins Lucrativos', 'sem_fins'],
  ['Administração Pública', 'publica']]);
/** "TIPO DE CADASTRO" da planilha -> tipo do SEMPER (null se vazio ou desconhecido). */
export const tipoDoSite = (texto: string) => TIPO_DO_SITE.get(normal(texto)) ?? null;
/** "TIPO DE CADASTRO" da planilha -> natureza jurídica (chave de NATUREZAS), só na pessoa jurídica. */
export const naturezaDoSite = (texto: string) => NATUREZA_DO_SITE.get(normal(texto)) ?? null;
/** De que coluna vem o tipo de entidade, pela natureza (a planilha tem uma coluna para cada lista do formulário). */
const COLUNA_DA_ENTIDADE: Record<NaturezaDoSite, ColunaDoSite> ={ empresarial: 'entidadeEmpresarial', sem_fins: 'entidade', publica: 'entePublico' };
/** O documento que cada tipo de cadastro guarda (válido), para comparar e juntar. */
const DOCUMENTO_DO_TIPO: Record<TipoPessoa, (cpf: string, cnpj: string) => string | null> = {
  pf: cpf => cpfValido(cpf) ? cpf : null,
  pj: (_, cnpj) => cnpjValido(cnpj) ? cnpj : null,
  contato: () => null
};

/** Rótulo de cada campo nas diferenças entre envios (null: não entra nas diferenças). A ordem é a das diferenças. */
const ROTULOS: Record<CampoDoSite, string | null> = {
  nome: 'Nome', tipoTexto: 'Tipo de cadastro', genero: 'Gênero', nacionalidade: 'Nacionalidade', profissao: 'Profissão',
  estadoCivil: 'Estado civil', cpf: 'CPF', cpfTexto: null, rg: 'RG', rgExpedicao: 'Expedição do RG', mae: 'Mãe', pai: 'Pai',
  nascimento: 'Nascimento', nascimentoMunicipio: 'Município de nascimento', nascimentoUf: 'UF de nascimento',
  tipoEntidade: 'Tipo de entidade', fantasia: 'Nome fantasia', porte: 'Porte', cnpj: 'CNPJ', cnpjTexto: null,
  abertura: 'Data de criação', representantes: 'Representantes', logradouro: 'Logradouro', numero: 'Número',
  complemento: 'Complemento', bairro: 'Bairro', municipio: 'Município', uf: 'UF', cep: 'CEP', cepTexto: null
};
const CAMPOS = Object.keys(ROTULOS) as CampoDoSite[];
/** Os documentos de um envio: o número (com os zeros devolvidos), o texto como veio e quando o número vale. */
const DOCUMENTOS_DO_ENVIO: { numero: CampoDoSite; texto: CampoDoSite; valido: (d: string) => boolean }[] = [
  { numero: 'cpf', texto: 'cpfTexto', valido: cpfValido },
  { numero: 'cnpj', texto: 'cnpjTexto', valido: cnpjValido }
];
/** Como o valor aparece na observação: as datas em DD/MM/AAAA. */
const mostrar = (v: string) => DATA_ISO.test(v) ? fmtData(v) : v;

function lerSite(linhas: LinhaDoSite[]): PessoaDoSite[] {
  return linhas.map(({ linha, valores }) => {
    const v = (c: ColunaDoSite) => espacos(valores[c]);
    const nome = v('nome'), tipoTexto = v('tipo');
    const tipo = tipoDoSite(tipoTexto), natureza = naturezaDoSite(tipoTexto);
    // A planilha guarda CPF/CNPJ/CEP como número e perde os zeros do começo; volta com eles quando o número fecha.
    const cpf = devolverZeros(dig(valores.cpf), DIGITOS_DO_CPF, cpfValido);
    const cnpj = devolverZeros(limparDocumento(valores.cnpj), CARACTERES_DO_CNPJ, cnpjValido);
    const uf = v('uf').toUpperCase();
    const cepLido = dig(valores.cep) || v('cep');
    const cep = /^\d+$/.test(cepLido) && cepLido.length === DIGITOS_DO_CEP - 1 && uf === UF_DOS_CEPS_COM_ZERO ? '0' + cepLido : cepLido;
    const emails: string[] = [];
    for (const e of v('email').toLowerCase().split(/[\s,;/]+/).filter(Boolean)) if (e.includes('@') && !emails.includes(e)) emails.push(e);
    const envio = lerEnvio(valores.envio);
    const doc = tipo ? DOCUMENTO_DO_TIPO[tipo](cpf, cnpj) : null;
    const nascimento = lerDataDoSite(valores.nascimento), abertura = lerDataDoSite(valores.abertura);
    const seLida = (d: string) => DATA_ISO.test(d) ? [d] : [];
    return {
      nome, tipoTexto, genero: v('genero'), nacionalidade: v('nacionalidade'), profissao: v('profissao'), estadoCivil: v('estadoCivil'),
      cpf, cpfTexto: v('cpf'), rg: v('rg'), rgExpedicao: lerDataDoSite(valores.rgExpedicao), mae: v('mae'), pai: v('pai'),
      nascimento, nascimentoMunicipio: v('nascimentoMunicipio'), nascimentoUf: v('nascimentoUf').toUpperCase(),
      tipoEntidade: v(COLUNA_DA_ENTIDADE[natureza ?? 'empresarial']), fantasia: v('fantasia'), porte: v('porte'), cnpj, cnpjTexto: v('cnpj'),
      abertura, representantes: v('representantes'), logradouro: v('logradouro'), numero: v('numero'),
      complemento: v('complemento'), bairro: v('bairro'), municipio: v('municipio'), uf, cep, cepTexto: v('cep'),
      linhas: [linha], envios: [{ linha, iso: envio?.iso ?? null, ms: envio?.ms ?? null, nome }], enviado: envio?.ms ?? null,
      responsaveis: v('responsavel') ? [v('responsavel')] : [], tipo, nn: nomeNorm(nome),
      qualificacoes: v('qualificacao') ? [v('qualificacao')] : [], telefones: lerTelefones([valores.telefone ?? '']), emails,
      doc, diferencas: [], comoJuntado: [],
      provasDosEnvios: { docs: doc ? [doc] : [], nascimentos: seLida(nascimento), aberturas: seLida(abertura) }
    };
  });
}

/** Junta envios do mesmo cliente: valem os campos do envio mais recente, completados com os anteriores; o que os
 *  anteriores tinham de diferente (sem contar maiúscula, acento e espaços) vai para as diferenças. */
function juntarSite(membros: PessoaDoSite[]): PessoaDoSite {
  const ord = [...membros].sort((a, b) => (b.enviado ?? 0) - (a.enviado ?? 0) || b.linhas[0] - a.linhas[0]);
  const p: PessoaDoSite = { ...ord[0], linhas: ord.flatMap(m => m.linhas).sort((a, b) => a - b), telefones: [], emails: [] };
  // CPF e CNPJ: o válido mais recente ganha do inválido (o inválido vai para as diferenças).
  for (const { numero, texto, valido } of DOCUMENTOS_DO_ENVIO) {
    const comValido = ord.find(m => valido(m[numero]));
    if (comValido && !valido(p[numero])) { p[numero] = comValido[numero]; p[texto] = comValido[texto]; }
  }
  const diferencas: string[] = [];
  for (const k of CAMPOS) {
    for (const m of ord) if (!p[k] && m[k]) p[k] = m[k];
    const rotulo = ROTULOS[k];
    const valores = semRepetidos(ord.map(m => m[k]).filter(Boolean));
    if (!rotulo || new Set(valores.map(nomeNorm)).size < 2) continue;
    const vistos = new Set([nomeNorm(p[k])]);
    const fora = valores.filter(x => !vistos.has(nomeNorm(x)) && vistos.add(nomeNorm(x)));
    diferencas.push(`Envio anterior — ${rotulo}: ${fora.map(x => `"${mostrar(x)}"`).join(', ')}`);
  }
  for (const m of ord) {
    for (const x of m.telefones) if (!p.telefones.some(y => y.k === x.k)) p.telefones.push(x);
    for (const e of m.emails) if (!p.emails.includes(e)) p.emails.push(e);
  }
  const antigos = [...ord].reverse();
  return {
    ...p,
    envios: antigos.flatMap(m => m.envios),
    responsaveis: antigos.flatMap(m => m.responsaveis),
    qualificacoes: semRepetidos(ord.flatMap(m => m.qualificacoes)),
    nn: nomeNorm(p.nome),
    doc: ord.map(m => m.doc).find(Boolean) ?? null,
    diferencas: [...antigos.flatMap(m => m.diferencas), ...diferencas],
    comoJuntado: semRepetidos([...ord.flatMap(m => m.comoJuntado), ...(membros.length > 1 ? [MOTIVOS.siteComSite] : [])]),
    provasDosEnvios: {
      docs: semRepetidos(antigos.flatMap(m => m.provasDosEnvios.docs)),
      nascimentos: semRepetidos(antigos.flatMap(m => m.provasDosEnvios.nascimentos)),
      aberturas: semRepetidos(antigos.flatMap(m => m.provasDosEnvios.aberturas))
    }
  };
}

/** Os cadastros juntados têm dois CPFs, dois CNPJs, duas datas de nascimento ou duas de criação diferentes. */
function provasDivergem({ docs, nascimentos, aberturas }: ProvasDosEnvios): boolean {
  const doTamanho = (tamanho: number) => docs.filter(d => d.length === tamanho);
  return [doTamanho(DIGITOS_DO_CPF), doTamanho(CARACTERES_DO_CNPJ), nascimentos, aberturas].some(l => new Set(l).size > 1);
}

/** Junta os envios do mesmo cliente (mesmo CPF/CNPJ, telefone ou e-mail e nome parecido). Devolve também os pares de
 *  clientes com o mesmo CPF/CNPJ e nomes diferentes (índices em "pessoas"), que vão para a lista de decidir. */
function agruparSite(lista: PessoaDoSite[]): { pessoas: PessoaDoSite[]; mesmoDocumento: [number, number][] } {
  const g = new Grupos(lista.length), baldes = new Map<string, number[]>();
  lista.forEach((p, i) => {
    if (p.doc) juntarEm(baldes, 'D|' + p.doc, i);
    for (const x of p.telefones) if (chave(x.t)) juntarEm(baldes, 'T|' + x.k, i);
    for (const e of p.emails) juntarEm(baldes, 'E|' + e, i);
  });
  const suspeitos: [number, number][] = [];
  for (const [k, ids] of baldes) {
    for (const [a, b] of paresDe(ids)) {
      const [x, y] = [lista[a], lista[b]];
      const docsDiferentes = x.doc && y.doc && x.doc !== y.doc;
      if (semelhanca(x.nome, y.nome) > 0 && !docsDiferentes) g.unir(a, b);
      else if (k.startsWith('D|')) suspeitos.push([a, b]);
    }
  }
  const grupos = g.lista();
  const pessoas = grupos.map(ids => juntarSite(ids.map(i => lista[i])));
  const deGrupo = new Map<number, number>();
  grupos.forEach((ids, gi) => ids.forEach(i => deGrupo.set(i, gi)));
  const mesmoDocumento: [number, number][] = [];
  for (const [a, b] of suspeitos) {
    const [ga, gb] = [deGrupo.get(a) ?? -1, deGrupo.get(b) ?? -1];
    if (ga !== gb) mesmoDocumento.push([ga, gb]);
  }
  return { pessoas, mesmoDocumento };
}

// ---------- Cruzamento site x Google ----------

interface Casamento { pi: number; gi: number; s: number; via: Via }

function cruzar(google: Ficha[], pessoas: PessoaDoSite[]) {
  const porTel = new Map<string, number[]>(), porEmail = new Map<string, number[]>(), porNome = new Map<string, number[]>();
  google.forEach((c, i) => {
    for (const x of c.telefones) if (chave(x.t)) juntarEm(porTel, x.k, i);
    for (const e of c.emails) juntarEm(porEmail, e, i);
    if (c.nn) juntarEm(porNome, c.nn, i);
  });
  const nomesSite = new Map<string, number>();
  pessoas.forEach(p => nomesSite.set(p.nn, (nomesSite.get(p.nn) ?? 0) + 1));
  const casamentos: Casamento[] = [], conflitos: { pi: number; gi: number; via: Via }[] = [];
  const doSite = (p: PessoaDoSite): ComProvas => ({ membros: [], site: p });
  pessoas.forEach((p, pi) => {
    const candidatos = new Map<number, Via>();
    for (const x of p.telefones) if (chave(x.t)) for (const gi of porTel.get(x.k) ?? []) candidatos.set(gi, 'telefone');
    for (const e of p.emails) for (const gi of porEmail.get(e) ?? []) if (!candidatos.has(gi)) candidatos.set(gi, 'e-mail');
    for (const [gi, via] of candidatos) {
      const s = semelhanca(p.nome, google[gi].nome);
      // Nome parecido, mas o CPF/CNPJ do site é outro que o da descrição do Google: pessoas diferentes (pai e filho…).
      if (s > 0 && docsConflitam(provas(doSite(p)).docs, provas(google[gi]).docs)) conflitos.push({ pi, gi, via });
      else if (s > 0) casamentos.push({ pi, gi, s: s + 1, via });
    }
  });
  casamentos.sort((a, b) => b.s - a.s || a.pi - b.pi);
  const dono = new Map<number, number>(), dele = new Map<number, Casamento[]>();
  for (const c of casamentos) {
    if (dono.has(c.gi)) continue;
    dono.set(c.gi, c.pi);
    juntarEm(dele, c.pi, c);
  }
  // Sem telefone ou e-mail em comum: casa pelo nome completo quando ele é único nas duas planilhas e o CPF ou a data batem.
  pessoas.forEach((p, pi) => {
    if (dele.has(pi) || !p.nn || tokens(p.nome).length < PALAVRAS_MINIMAS_DO_NOME || nomesSite.get(p.nn) !== 1) return;
    const gs = porNome.get(p.nn) ?? [];
    if (gs.length !== 1 || dono.has(gs[0]) || compararProvas(google[gs[0]], doSite(p)) !== 'confirma') return;
    dono.set(gs[0], pi);
    dele.set(pi, [{ pi, gi: gs[0], s: 0, via: 'nome' }]);
  });
  return { dono, dele, conflitos };
}

// ---------- Montagem ----------

function aplicarSite(c: Ficha, p: PessoaDoSite, via: Via | null): Ficha {
  for (const x of p.telefones) if (!c.telefones.some(y => y.k === x.k)) c.telefones.push(x);
  for (const e of p.emails) if (!c.emails.includes(e)) c.emails.push(e);
  c.site = p;
  c.comoJuntado = semRepetidos([...c.comoJuntado, ...p.comoJuntado, ...(via ? [POR_ONDE[via]] : [])]);
  return c;
}

const novoDoSite = (p: PessoaDoSite): Ficha => ({
  membros: [], nome: p.nome.toUpperCase(), nn: p.nn, telefones: [...p.telefones], emails: [...p.emails], notas: '', site: p,
  comoJuntado: [...p.comoJuntado]
});

/** Junta contatos finais (mesmo nome com prova, ou pela decisão): soma os contatos do Google e os cadastros do site. */
function juntarFinais(lista: Ficha[], motivos: string[]): Ficha {
  const membros = lista.flatMap(c => c.membros);
  const sites = lista.map(c => c.site).filter((s): s is PessoaDoSite => !!s);
  const p = sites.length > 1 ? juntarSite(sites) : sites[0] ?? null;
  let c: Ficha;
  if (!membros.length && p) c = novoDoSite(p);
  else {
    c = juntarGoogle(membros, MOTIVOS.mesmoNomeComProva);
    if (p) c = aplicarSite(c, p, null);
  }
  c.comoJuntado = semRepetidos([...lista.flatMap(x => x.comoJuntado), ...motivos]);
  return c;
}

// Palavras de um texto (sem acento, 3+ letras ou com algarismos), para ver o que um texto antigo tem e o outro não.
const COMUNS: ReadonlySet<string> = new Set(('COM NAO SEM POR PARA QUE NUM NUMERO INSCRITO INSCRITA CPF CNPJ RESIDENTE DOMICILIADO '
  + 'DOMICILIADA NASCIDO NASCIDA FILHO FILHA NATURAL BAIRRO CEP TELEFONE TELEFONES MAIL MAILS EXPEDIDA BRASILEIRO BRASILEIRA ESTADO '
  + 'CIVIL SEDE REPRESENTADA PORTE').split(' '));
const LETRAS_MINIMAS = 3;
const palavras = (t: string) => semAcento(t).toUpperCase().replace(/\(A\)/g, '').split(/[^A-Z0-9@._-]+/)
  .map(p => p.replace(/^[._-]+|[._-]+$/g, '')).filter(p => (p.length >= LETRAS_MINIMAS || /\d/.test(p)) && !COMUNS.has(p))
  .map(p => /^\d[\d./-]*$/.test(p) ? p.replace(/\D/g, '') : p);
const palavrasForaDe = (a: string, b: string) => { const B = new Set(palavras(b)); return semRepetidos(palavras(a).filter(p => !B.has(p))); };
/** Quanto das palavras de "a" está em "b" (de 0 a 1). */
const coberto = (a: string, b: string) => { const A = palavras(a); return A.length ? 1 - palavrasForaDe(a, b).length / new Set(A).size : 1; };
/** A partir de quanto uma linha da descrição antiga já está na qualificação da planilha (e não precisa ser guardada). */
const COBERTURA_DA_QUALIFICACAO = 0.6;
/** A associação de que a pessoa é associada, no fim da qualificação ("…, associado(a) da Associação X"). */
const ASSOCIACAO = /,?\s*(associad[oa](?:\(a\))? (?:d[aoe]s?|à|ao|junto) .+)$/i;
export const PREFIXO_DA_DESCRICAO = 'Descrição no Google Contatos: ';

/**
 * Da descrição antiga do Google, o que não é qualificação: a associação e as linhas que a qualificação da planilha
 * (QUALIFICAÇÃO_37) não cobre. Nada, se a descrição era a própria qualificação da planilha.
 */
function restoDaDescricao(antiga: string, qualificacoes: string[]): string[] {
  const n = (t: string) => espacos(t).toUpperCase();
  if (!antiga.trim() || qualificacoes.some(q => n(q) === n(antiga))) return [];
  const referencia = qualificacoes.join('\n');
  const [primeira = '', ...outras] = antiga.split(/\r?\n+/).map(espacos).filter(Boolean);
  const mantido: string[] = [];
  if (coberto(primeira, referencia) >= COBERTURA_DA_QUALIFICACAO) {
    const assoc = primeira.match(ASSOCIACAO);
    if (assoc && !/associad/i.test(referencia)) mantido.push(assoc[1].replace(/[.;,\s]+$/, ''));
  } else mantido.push(primeira);
  mantido.push(...outras.filter(l => coberto(l, referencia) < COBERTURA_DA_QUALIFICACAO));
  return mantido.length ? [PREFIXO_DA_DESCRICAO + mantido.join('\n')] : [];
}

/** O cliente final de uma ficha com cadastro do site. */
function montarCliente(c: Ficha, p: PessoaDoSite, referencia: string, pendentes: Pendente[]): ClienteFinal {
  const telefones: Telefone[] = [];
  for (const x of [...p.telefones, ...c.telefones]) if (!telefones.some(y => y.k === x.k)) telefones.push(x);
  return {
    referencia, site: p, telefones: telefones.map(x => x.t),
    emails: semRepetidos([...p.emails, ...c.emails].filter(e => e.includes('@'))),
    primeiroEnvio: envioMaisAntigo(p.envios)?.iso ?? null,
    observacoes: [...p.diferencas, ...descricoesDoGoogle(c, p.qualificacoes)],
    pendentes, contatosGoogle: c.membros.map(m => `${m.arquivo}:${m.linha}`), comoJuntado: c.comoJuntado,
    provasDivergentes: provasDivergem(p.provasDosEnvios)
  };
}

/** O que as descrições dos contatos do Google que casaram têm além da qualificação: a mais completa primeiro, depois
 *  as dos outros contatos (cada descrição diferente uma vez; as partes repetidas, também). */
function descricoesDoGoogle(c: Ficha, qualificacoes: string[]): string[] {
  const n = (t: string) => espacos(t).toUpperCase();
  const descricoes = new Map([c.notas, ...c.membros.map(m => m.notas)].filter(t => t.trim()).map(t => [n(t), t]));
  return semRepetidos([...descricoes.values()].flatMap(d => restoDaDescricao(d, qualificacoes)));
}

const identidade = (p: PessoaDoSite) => ({
  envios: p.envios, nome: p.nome, documento: p.doc ?? (p.cpf || p.cnpj), telefone: p.telefones[0]?.k ?? '', email: p.emails[0] ?? ''
});
const menorLinha = (p: PessoaDoSite) => Math.min(...p.linhas);
/** Ordem do envio mais antigo (sem data, depois de todos), para escolher de quem fica a referência ao juntar. */
const ordemDoEnvio = (p: PessoaDoSite) => {
  const e = envioMaisAntigo(p.envios);
  return e ? [e.ms as number, e.linha] : [Infinity, menorLinha(p)];
};

/**
 * Junta os cadastros repetidos e devolve os clientes do site (só eles vão para o SEMPER) e o relatório. As decisões
 * (pares de referências -> sim/não) juntam os pares "sim" no mesmo passo em que os de mesmo nome com prova são juntados.
 */
export function limpar(entrada: Entrada, decisoes: Decisoes = new Map()): { finais: ClienteFinal[]; rel: Relatorio } {
  const rel: Relatorio = {
    linhasDoSite: entrada.site.length, semNome: 0, contatosDoGoogle: 0, complementosDoGoogle: 0, juntados: {},
    separadosPorProva: 0, pares: [], decisoes: { aplicadas: 0, ignoradas: 0 }, referenciasRepetidas: 0, envios: { comData: 0, ilegiveis: 0 }
  };
  const comData = entrada.site.filter(l => espacos(l.valores.envio));
  rel.envios = { comData: comData.length, ilegiveis: comData.filter(l => !lerEnvio(l.valores.envio)).length };
  const lista = lerGoogle(entrada.google, rel);
  rel.contatosDoGoogle = lista.length;
  const grupos = agruparGoogle(lista);
  const { pessoas, mesmoDocumento } = agruparSite(lerSite(entrada.site));
  const { dono, dele, conflitos } = cruzar(grupos, pessoas);

  // Cada cliente do site vira uma ficha (com os contatos do Google que casaram); os contatos sem cliente, outra.
  const fichas: Ficha[] = [];
  const fichaDaPessoa = new Map<number, number>(), fichaDoGrupo = new Map<number, number>();
  pessoas.forEach((p, pi) => {
    const casou = dele.get(pi);
    if (!casou) {
      if (p.nome) { fichaDaPessoa.set(pi, fichas.length); fichas.push(novoDoSite(p)); } else rel.semNome += p.linhas.length;
      return;
    }
    const c = casou.length > 1
      ? juntarGoogle(casou.flatMap(x => grupos[x.gi].membros), MOTIVOS.variosDoGoogle, casou.flatMap(x => grupos[x.gi].comoJuntado))
      : grupos[casou[0].gi];
    casou.forEach(x => fichaDoGrupo.set(x.gi, fichas.length));
    fichaDaPessoa.set(pi, fichas.length);
    fichas.push(aplicarSite(c, p, casou[0].via));
  });
  grupos.forEach((c, gi) => { if (!dono.has(gi)) { fichaDoGrupo.set(gi, fichas.length); fichas.push(c); } });

  // Pares para decidir (índices em "fichas"): mesmo CPF/CNPJ com nomes diferentes, nome parecido com CPF/CNPJ diferentes.
  const candidatos: { caso: string; a: number; b: number; feito: string }[] = [];
  const candidato = (caso: string, a: number | undefined, b: number | undefined, feito: string) => {
    if (a !== undefined && b !== undefined) candidatos.push({ caso, a, b, feito });
  };
  for (const [a, b] of mesmoDocumento) candidato(CASOS.mesmoDocumento, fichaDaPessoa.get(a), fichaDaPessoa.get(b), DOCUMENTO_NOS_DOIS);
  for (const { pi, gi, via } of conflitos) {
    if (!dele.get(pi)?.some(x => x.gi === gi)) candidato(CASOS.documentoDiferente(via), fichaDaPessoa.get(pi), fichaDoGrupo.get(gi), SEPARADOS);
  }

  // Mesmo nome sem telefone ou e-mail em comum (regra da #165): junta quando o CPF ou a data batem, separa quando não
  // batem e põe o resto na lista para decidir (separados até lá).
  const temEmComum = (x: Ficha, y: Ficha) => x.telefones.some(a => chave(a.t) && y.telefones.some(b => b.k === a.k))
    || x.emails.some(e => y.emails.includes(e));
  const mesmoNome = new Map<string, number[]>();
  fichas.forEach((c, i) => { const k = chaveDoNome(c.nome); if (k) juntarEm(mesmoNome, k, i); });
  const gf = new Grupos(fichas.length);
  const unioes: { a: number; motivo: string }[] = [];
  for (const ids of mesmoNome.values()) {
    for (const [a, b] of paresDe(ids)) {
      const [x, y] = [fichas[a], fichas[b]];
      const emComum = temEmComum(x, y);
      if (docsConflitam(provas(x).docs, provas(y).docs)) {
        if (emComum) candidato(CASOS.mesmoNomeDocumentoDiferente, a, b, SEPARADOS);
        else rel.separadosPorProva++;
        continue;
      }
      if (emComum) continue;
      const prova = compararProvas(x, y);
      if (prova === 'confirma') { gf.unir(a, b); unioes.push({ a, motivo: MOTIVOS.mesmoNomeComProva }); }
      else if (prova === 'contradiz') rel.separadosPorProva++;
      else candidato(CASOS.mesmoNomeSemProva, a, b, SEPARADOS);
    }
  }

  // A referência de cada ficha do site; a de um grupo de fichas é a do cadastro com o envio mais antigo.
  const comSite = fichas.flatMap((c, i) => c.site ? [{ i, p: c.site }] : []);
  const { referencias, repetidas } = semRepetir(comSite.map(({ p }) => ({ base: referenciaBase(identidade(p)), menorLinha: menorLinha(p) })));
  rel.referenciasRepetidas = repetidas;
  const refDaFicha = new Map(comSite.map(({ i }, j) => [i, referencias[j]]));
  const ref = (i: number) => refDaFicha.get(i) ?? '';
  /** A ficha do site que dá a referência a um grupo (null: só contatos do Google). */
  const donoDaReferencia = (ids: number[]) => ids
    .flatMap(i => { const p = fichas[i].site; return p ? [{ i, p, ordem: ordemDoEnvio(p) }] : []; })
    .sort((a, b) => a.ordem[0] - b.ordem[0] || a.ordem[1] - b.ordem[1])[0] ?? null;

  // Os clientes antes das decisões (as fichas já juntadas por mesmo nome com prova). A referência de cada um é a que ele
  // terá na saída se nenhuma decisão o juntar a outro: é a chave das decisões em para-decidir.csv.
  const antes = gf.lista();
  const clienteAntes = new Map<number, number>();
  antes.forEach((ids, g) => ids.forEach(i => clienteAntes.set(i, g)));
  const donoAntes = antes.map(donoDaReferencia);

  // Só pares entre clientes do site (o lado que é só do Google não vai para o SEMPER), um por par de clientes.
  const vistos = new Set<string>();
  const validos = candidatos.flatMap(c => {
    const [a, b] = [clienteAntes.get(c.a) ?? -1, clienteAntes.get(c.b) ?? -1];
    const k = [a, b].sort((x, y) => x - y).join('|');
    if (a === b || !donoAntes[a] || !donoAntes[b] || vistos.has(k)) return [];
    vistos.add(k);
    return [{ caso: c.caso, a, b, feito: c.feito }];
  });

  const { porPar, aplicadas, ignoradas } = aplicarDecisoes(validos.map(c => ({ a: ref(donoAntes[c.a]?.i ?? -1), b: ref(donoAntes[c.b]?.i ?? -1) })), decisoes);
  rel.decisoes = { aplicadas, ignoradas };
  // Um "sim" não junta dois clientes que um "não" separou (nem em cadeia: A=B e B=C com A≠C).
  const ficha = (g: number) => antes[g][0];
  const separados = validos.filter((_, j) => porPar[j] === 'nao').map(c => [ficha(c.a), ficha(c.b)]);
  const desfariaUmNao = (x: number, y: number) => {
    const lados = new Set([gf.raiz(x), gf.raiz(y)]);
    return separados.some(([a, b]) => gf.raiz(a) !== gf.raiz(b) && lados.has(gf.raiz(a)) && lados.has(gf.raiz(b)));
  };
  validos.forEach((c, j) => {
    if (porPar[j] !== 'sim' || desfariaUmNao(ficha(c.a), ficha(c.b))) return;
    gf.unir(ficha(c.a), ficha(c.b));
    unioes.push({ a: ficha(c.a), motivo: MOTIVOS.decisao });
  });

  // Junta e escolhe a referência de cada cliente: a do cadastro com o envio mais antigo.
  const juntas = gf.lista();
  const finalDa = new Map<number, number>();
  const finais = juntas.map((ids, j) => {
    ids.forEach(i => finalDa.set(i, j));
    if (ids.length === 1) return fichas[ids[0]];
    const doGrupo = new Set(ids);
    return juntarFinais(ids.map(i => fichas[i]), semRepetidos(unioes.filter(u => doGrupo.has(u.a)).map(u => u.motivo)));
  });
  const refDoFinal = juntas.map(ids => ref(donoDaReferencia(ids)?.i ?? -1));

  // A lista para decidir e o "conferir" dos dois lados de cada par sem decisão (cada outro cliente uma vez só).
  const pendentes = new Map<number, Pendente[]>();
  const lado = (g: number) => {
    const linhas = antes[g].flatMap(i => fichas[i].site?.linhas ?? []).sort((x, y) => x - y);
    return { referencia: ref(donoAntes[g]?.i ?? -1), nome: donoAntes[g]?.p.nome ?? '', linhas };
  };
  validos.forEach((c, j) => {
    const decisao = porPar[j];
    const [fa, fb] = [finalDa.get(ficha(c.a)) ?? -1, finalDa.get(ficha(c.b)) ?? -1];
    if (fa === fb && !decisao) return;
    rel.pares.push({ caso: c.caso, a: lado(c.a), b: lado(c.b), feito: decisao ? FEITO_DA_DECISAO[decisao](fa === fb) : c.feito, decisao });
    if (decisao) return;
    const pendente = (de: number, outro: number) => {
      if (pendentes.get(de)?.some(x => x.referencia === refDoFinal[outro])) return;
      juntarEm(pendentes, de, { referencia: refDoFinal[outro], nome: finais[outro].site?.nome ?? '', caso: c.caso });
    };
    pendente(fa, fb);
    pendente(fb, fa);
  });

  const clientes = finais.flatMap((c, j) => c.site ? [montarCliente(c, c.site, refDoFinal[j], pendentes.get(j) ?? [])] : [])
    .sort((a, b) => menorLinha(a.site) - menorLinha(b.site));
  for (const c of clientes) for (const motivo of c.comoJuntado) rel.juntados[motivo] = (rel.juntados[motivo] ?? 0) + 1;
  return { finais: clientes, rel };
}
