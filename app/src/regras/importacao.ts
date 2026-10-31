// Importar pessoas de um arquivo CSV no modelo do SEMPER (Pessoas > ⋯ > Importar pessoas).
// Regras puras: ler o arquivo, normalizar cada linha, achar os responsáveis, comparar com os cadastros que já existem
// e montar o que vai para o banco. Sem tela e sem banco: a tela chama, mostra a conferência e grava em lotes.
import type { DadosPessoa, Membro, Pessoa, TipoPessoa } from '../dados/tipos';
import {
  LINHAS_MAXIMAS_DA_IMPORTACAO, TAMANHO_OBSERVACOES, TAMANHO_PESSOA, TAMANHO_REFERENCIA
} from '../dados/limites';
import { escreverCSV, lerCSV, linhaVazia, PROTECAO_DE_FORMULA } from './csv';
import { maiusculas } from './cadastro';
import {
  ajustarAoTipo, CAMPOS, CAMPOS_DO_TIPO, celularCompleto, cepValido, cnpjValido, cpfValido, dig, DIGITOS_DO_CEP, emailValido,
  entidadeDoTexto, espacos, estadoCivilDoTexto, fmtCEP, fmtDocumento, fmtTelefone, FUSO_PADRAO, generoDoTexto, generoPermitido,
  LGPD, lerDataFlexivel, lerDataHora, limparDocumento, naturezaDaEntidade, naturezaDoTexto, porteDoTexto, tabela,
  telefoneValido, TIPOS, ufValida
} from './pessoa';
import { normal } from './texto';

// ---------- tipos (o PR2 leva Pendencia e ItemImportacao para o contrato, em dados/tipos.ts) ----------

/** O que falta resolver num cadastro importado. Os mesmos valores da regra "check" de pessoas.pendencias no banco. */
export type Pendencia = 'documento_invalido' | 'conferir';

/** Uma linha pronta para gravar (montada por planejar). */
export interface ItemImportacao {
  /** Número da linha no arquivo (para as mensagens de erro). */
  linha: number;
  referencia: string | null;
  /** Cadastro que já existe e vai ser completado; null = pessoa nova. */
  existente_id: string | null;
  /** Pessoa nova: o cadastro todo. Existente: só o que completa (completarVazios). */
  dados: DadosPessoa;
  /** Data antiga de cadastro (ISO); null = agora. Só vale para pessoa nova. */
  criado_em: string | null;
  /** Ids de perfil dos responsáveis a acrescentar (nenhum é tirado). */
  responsaveis: string[];
  /** Pessoa nova: a observação toda. Existente: o texto a ACRESCENTAR ao que já está lá (null = nada novo). */
  observacoes: string | null;
  /** Pessoa nova: as pendências. Existente: as que se juntam às que já estão lá. */
  pendencias: Pendencia[];
}

/** Cadastro que já existe, com os campos que a importação acrescenta ao banco (no PR2 entram em Pessoa). */
export type PessoaExistente = Pessoa & { referencia?: string | null; observacoes?: string | null; pendencias?: Pendencia[] };

/** Como cada pendência aparece no cartão e na conferência. */
export const PENDENCIAS: Record<Pendencia, string> = {
  documento_invalido: 'CPF/CNPJ inválido no arquivo',
  conferir: 'Dados a conferir'
};

// ---------- o modelo CSV ----------

export type ChaveImportacao = 'referencia' | 'tipo' | 'nome' | 'documento' | 'genero' | 'nacionalidade' | 'profissao'
  | 'estado_civil' | 'rg' | 'rg_expedicao' | 'nome_mae' | 'nome_pai' | 'nascimento' | 'nascimento_municipio'
  | 'nascimento_uf' | 'natureza' | 'tipo_entidade' | 'nome_fantasia' | 'porte' | 'abertura' | 'representantes'
  | 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'municipio' | 'uf' | 'telefones' | 'emails'
  | 'lgpd_base' | 'lgpd_consentimento' | 'responsaveis' | 'cadastrado_em' | 'observacoes' | 'conferir';

export interface ColunaImportacao {
  chave: ChaveImportacao;
  /** Nome da coluna para quem lê ("Data de nascimento"); também vale como cabeçalho do arquivo. */
  rotulo: string;
  /** O que pôr na coluna (a tabela "Como preencher cada coluna"). */
  formato: string;
  exemplo: { pf: string; pj: string };
  /** Tamanho máximo do texto: acima dele, a linha é recusada. */
  limite?: number;
  /** Outros nomes aceitos no cabeçalho ("CPF", "Telefone"…). */
  apelidos?: string[];
  /** Sem esta coluna o arquivo não pode ser importado. */
  obrigatoria?: boolean;
}

/** Referência das linhas de exemplo do modelo: o arquivo que ainda as tem é recusado (esqueceram de apagar). */
export const REFERENCIA_DO_EXEMPLO = 'EXEMPLO-APAGUE';
export const NOME_DO_MODELO = 'modelo-importacao-pessoas.csv';
/** Separador dos itens de uma lista (telefones, e-mails, responsáveis) na escrita. */
export const SEPARADOR_DE_LISTA = ' | ';
/** Na leitura, os itens de uma lista se separam por "|" ou por quebra de linha. */
export const DIVIDIR_LISTA = /\s*\|\s*|\r?\n/;

/** Rótulos das colunas que não são campos do cadastro (os outros vêm de CAMPOS, os mesmos do histórico). */
const ROTULOS_PROPRIOS: Partial<Record<ChaveImportacao, string>> = { responsaveis: 'Responsáveis', conferir: 'A conferir' };
const DATA = 'data (DD/MM/AAAA ou AAAA-MM-DD)';
const coluna = (chave: ChaveImportacao, formato: string, pf: string, pj: string, extra: Partial<ColunaImportacao> = {}): ColunaImportacao =>
  ({ chave, rotulo: ROTULOS_PROPRIOS[chave] ?? CAMPOS[chave] ?? chave, formato, exemplo: { pf, pj }, ...extra });

/** As colunas do modelo, na ordem do arquivo. A leitura segue esta ordem (o tipo vem antes do documento e do gênero). */
export const COLUNAS_IMPORTACAO: readonly ColunaImportacao[] = [
  coluna('referencia', 'código de origem, único: evita duplicar se importar de novo', REFERENCIA_DO_EXEMPLO, REFERENCIA_DO_EXEMPLO,
    { limite: TAMANHO_REFERENCIA }),
  coluna('tipo', 'pf, pj ou contato (ou "Pessoa física", "Pessoa jurídica", "Somente contato")', 'pf', 'pj',
    { obrigatoria: true, apelidos: ['tipo de pessoa', 'tipo de cadastro'] }),
  coluna('nome', 'nome completo ou razão social', 'MARIA EXEMPLO DA SILVA', 'PADARIA MODELO LTDA',
    { obrigatoria: true, limite: TAMANHO_PESSOA.nome, apelidos: ['razao social'] }),
  coluna('documento', 'CPF ou CNPJ, com ou sem pontos (o CNPJ pode ter letras)', '529.982.247-25', '11.222.333/0001-81',
    { apelidos: ['cpf', 'cnpj', 'cpf/cnpj', 'cpf ou cnpj'] }),
  coluna('genero', 'm, f, "masculino", "feminino" ou vazio (só pessoa física e empresa individual)', 'f', '', { apelidos: ['sexo'] }),
  coluna('nacionalidade', 'texto', 'brasileira', '', { limite: TAMANHO_PESSOA.nacionalidade }),
  coluna('profissao', 'texto', 'professora', '', { limite: TAMANHO_PESSOA.profissao }),
  coluna('estado_civil', 'solteiro, casado(a), em união estável, separado, divorciado ou viúvo', 'casada', ''),
  coluna('rg', 'número, órgão e estado', 'MG-12.345.678', '', { limite: TAMANHO_PESSOA.rg }),
  coluna('rg_expedicao', DATA, '10/05/2005', ''),
  coluna('nome_mae', 'texto', 'ANA EXEMPLO DA SILVA', '', { limite: TAMANHO_PESSOA.filiacao, apelidos: ['mae'] }),
  coluna('nome_pai', 'texto', '', '', { limite: TAMANHO_PESSOA.filiacao, apelidos: ['pai'] }),
  coluna('nascimento', DATA, '01/02/1980', '', { apelidos: ['data de nascimento', 'nascido em'] }),
  coluna('nascimento_municipio', 'texto', 'Montes Claros', '', { limite: TAMANHO_PESSOA.municipio, apelidos: ['naturalidade'] }),
  coluna('nascimento_uf', 'sigla do estado', 'MG', ''),
  coluna('natureza', 'empresarial, publica ou sem_fins (ou "Entidades empresariais"…)', '', 'empresarial'),
  coluna('tipo_entidade', 'nome da lista de tipos de entidade (ou MEI)', '', 'Sociedade Empresária Limitada'),
  coluna('nome_fantasia', 'texto', '', 'PADARIA MODELO', { limite: TAMANHO_PESSOA.nomeFantasia }),
  coluna('porte', 'ME, EPP, médio ou grande', '', 'ME'),
  coluna('abertura', DATA, '', '05/03/2010', { apelidos: ['data de abertura'] }),
  coluna('representantes', 'nome(s), separados por "e/ou"', '', 'JOÃO EXEMPLO', { limite: TAMANHO_PESSOA.representantes }),
  coluna('cep', 'CEP com ou sem traço', '39400-000', '39400-001'),
  coluna('logradouro', 'texto', 'Rua A', 'Avenida B', { limite: TAMANHO_PESSOA.logradouro, apelidos: ['endereco', 'rua'] }),
  coluna('numero', 'texto', '10', '200', { limite: TAMANHO_PESSOA.numero }),
  coluna('complemento', 'texto', 'Apto 101', '', { limite: TAMANHO_PESSOA.complemento }),
  coluna('bairro', 'texto', 'Centro', 'Centro', { limite: TAMANHO_PESSOA.bairro }),
  coluna('municipio', 'texto', 'Montes Claros', 'Montes Claros', { limite: TAMANHO_PESSOA.municipio, apelidos: ['cidade'] }),
  coluna('uf', 'sigla do estado', 'MG', 'MG', { apelidos: ['estado'] }),
  coluna('telefones', `um ou mais, separados por "${SEPARADOR_DE_LISTA.trim()}"`, '(38) 99999-0000 | (38) 3222-0000', '(38) 3222-0001',
    { apelidos: ['telefone', 'celular', 'telefones'] }),
  coluna('emails', `um ou mais, separados por "${SEPARADOR_DE_LISTA.trim()}"`, 'maria@exemplo.com', 'contato@exemplo.com',
    { apelidos: ['email', 'e-mail'] }),
  coluna('lgpd_base', 'contrato, processo, consentimento, obrigacao_legal ou legitimo_interesse; vazio = a escolha da tela',
    'contrato', 'contrato', { apelidos: ['base legal', 'lgpd'] }),
  coluna('lgpd_consentimento', `${DATA}; só com consentimento`, '', ''),
  coluna('responsaveis', `nome ou @usuario da equipe, separados por "${SEPARADOR_DE_LISTA.trim()}"`, 'Ana Lima', 'Ana Lima',
    { apelidos: ['responsavel'] }),
  coluna('cadastrado_em', `${DATA}, ou data e hora; vazio = hoje`, '15/03/2019', '15/03/2019', { apelidos: ['cadastro', 'cadastrado'] }),
  coluna('observacoes', `texto livre (até ${TAMANHO_OBSERVACOES.toLocaleString('pt-BR')} caracteres)`, '', '',
    { limite: TAMANHO_OBSERVACOES, apelidos: ['observacao', 'obs'] }),
  coluna('conferir', 'se preenchido, marca "Dados a conferir" e o texto vai para a observação', '', '',
    { limite: TAMANHO_OBSERVACOES })
];
const COLUNA = new Map(COLUNAS_IMPORTACAO.map(c => [c.chave, c]));
const rotuloDe = (chave: ChaveImportacao) => COLUNA.get(chave)?.rotulo ?? chave;

/** O modelo para baixar: cabeçalho (as chaves) e um exemplo de pessoa física e um de pessoa jurídica (fictícios). */
export function modeloImportacao(): string {
  return escreverCSV([
    COLUNAS_IMPORTACAO.map(c => c.chave),
    COLUNAS_IMPORTACAO.map(c => c.exemplo.pf),
    COLUNAS_IMPORTACAO.map(c => c.exemplo.pj)
  ]);
}

// ---------- ler o arquivo ----------

export interface LinhaLida {
  /** Número da linha na planilha (o cabeçalho é a 1). */
  numero: number;
  valores: Partial<Record<ChaveImportacao, string>>;
}
export interface LeituraImportacao {
  linhas: LinhaLida[];
  /** Cabeçalhos que o SEMPER não conhece (ignorados). */
  desconhecidas: string[];
  /** Colunas obrigatórias que faltam: sem elas, o arquivo não pode ser importado. */
  faltando: ChaveImportacao[];
  /** Cabeçalhos repetidos (vale a primeira coluna). */
  repetidas: string[];
}

/** Cada nome aceito no cabeçalho (chave, chave com espaços, rótulo e apelidos), comparado com normal(). */
const CHAVE_DO_CABECALHO = new Map<string, ChaveImportacao>(COLUNAS_IMPORTACAO.flatMap(c =>
  [c.chave, c.chave.replace(/_/g, ' '), c.rotulo, ...(c.apelidos ?? [])].map((nome): [string, ChaveImportacao] => [normal(nome), c.chave])));
const OBRIGATORIAS = COLUNAS_IMPORTACAO.filter(c => c.obrigatoria).map(c => c.chave);

/**
 * Texto do CSV -> linhas com os valores por chave. O cabeçalho vale pela chave, pelo rótulo ou por um apelido (sem
 * acento nem maiúscula fazer diferença). Lança Error em português se o arquivo não tem linhas, tem linhas demais ou
 * ainda tem os exemplos do modelo.
 */
export function lerImportacao(texto: string): LeituraImportacao {
  // O número de cada linha é contado antes de tirar as vazias (";;;" que o Excel deixa), para bater com a planilha.
  const numeradas = lerCSV(texto, { manterVazias: true })
    .map((celulas, i) => ({ celulas, numero: i + 1 }))
    .filter(l => !linhaVazia(l.celulas));
  const [primeira, ...dados] = numeradas;
  const cabecalho = primeira?.celulas;
  if (!cabecalho || !dados.length) throw new Error('O arquivo não tem nenhuma pessoa: só o cabeçalho, ou nada.');
  if (dados.length > LINHAS_MAXIMAS_DA_IMPORTACAO) {
    throw new Error(`O arquivo tem ${dados.length.toLocaleString('pt-BR')} linhas; o máximo é ${LINHAS_MAXIMAS_DA_IMPORTACAO.toLocaleString('pt-BR')}. Divida em partes.`);
  }
  const desconhecidas: string[] = [], repetidas: string[] = [];
  const indice = new Map<ChaveImportacao, number>();
  cabecalho.forEach((nome, i) => {
    const chave = CHAVE_DO_CABECALHO.get(normal(nome));
    if (!chave) { if (nome.trim()) desconhecidas.push(nome.trim()); return; }
    if (indice.has(chave)) { repetidas.push(nome.trim()); return; }
    indice.set(chave, i);
  });
  const linhas = dados.map(({ celulas, numero }): LinhaLida =>
    ({ numero, valores: Object.fromEntries([...indice].map(([chave, j]) => [chave, celulas[j] ?? ''])) }));
  if (linhas.some(l => normal(l.valores.referencia) === normal(REFERENCIA_DO_EXEMPLO))) {
    throw new Error(`O arquivo ainda tem as linhas de exemplo do modelo (referência ${REFERENCIA_DO_EXEMPLO}). Apague essas linhas e escolha o arquivo de novo.`);
  }
  return { linhas, desconhecidas, faltando: OBRIGATORIAS.filter(c => !indice.has(c)), repetidas };
}

// ---------- normalizar uma linha ----------

/** erro: a linha não entra; aviso: entra, com ajuste. */
export type Gravidade = 'erro' | 'aviso';
export interface Problema { linha: number; campo: ChaveImportacao; gravidade: Gravidade; mensagem: string }
export interface ContextoImportacao {
  /** Data de hoje (AAAA-MM-DD): datas depois dela são recusadas. */
  hoje: string;
  /** Base legal (chave de LGPD) de quem vier sem base no arquivo. */
  lgpdPadrao: string;
}
export interface PessoaImportada {
  linha: number;
  referencia: string | null;
  /** O cadastro já no formato do banco, só com os campos do tipo (ajustarAoTipo). */
  dados: DadosPessoa;
  /** CPF/CNPJ como veio no arquivo (só letras e números), mesmo inválido: serve para achar linhas repetidas. */
  documentoNoArquivo: string | null;
  cadastradoEm: string | null;
  nomesResponsaveis: string[];
  /** Cada parte da observação (juntas com quebra de linha ao gravar). */
  observacoes: string[];
  pendencias: Pendencia[];
  problemas: Problema[];
}

/** O que normalizarLinha vai montando, coluna a coluna. */
type Saida = PessoaImportada;
type Normalizar = (valor: string, s: Saida, ctx: ContextoImportacao) => void;

const anotar = (s: Saida, campo: ChaveImportacao, gravidade: Gravidade, mensagem: string) =>
  s.problemas.push({ linha: s.linha, campo, gravidade, mensagem });
const pendenciar = (s: Saida, p: Pendencia) => { if (!s.pendencias.includes(p)) s.pendencias.push(p); };
/** Guarda na observação o valor que não coube no cadastro, para não se perder. */
const guardar = (s: Saida, campo: ChaveImportacao, valor: string) => s.observacoes.push(`${rotuloDe(campo)} no arquivo: ${valor}`);
const dividir = (v: string) => v.split(DIVIDIR_LISTA).map(x => x.trim()).filter(Boolean);

/** Número que o Excel mostrou em notação científica ("5,29982E+10"): os últimos algarismos já se perderam. */
const NOTACAO_CIENTIFICA = /^\d+(?:[.,]\d+)?e\+?\d+$/i;
const emNotacaoCientifica = (v: string) => NOTACAO_CIENTIFICA.test(v.replace(/\s/g, ''));
/** Zeros do começo que o Excel apaga de um CPF ou CNPJ (012…, 001…) e que a leitura devolve; mais que isso, o número está curto demais. */
const ZEROS_PERDIDOS_MAXIMOS = 2;
/** No CEP, só um: nenhum CEP começa com "00" (os de São Paulo começam com 01 a 09). */
const ZEROS_PERDIDOS_DO_CEP = 1;
/** O número só de algarismos completado com os zeros do começo, se assim ele fica válido; senão, null. */
function semZeroPerdido(v: string, tamanho: number, valido: (d: string) => boolean, zerosMaximos = ZEROS_PERDIDOS_MAXIMOS) {
  const d = limparDocumento(v);
  if (!/^\d+$/.test(d) || d.length >= tamanho || d.length < tamanho - zerosMaximos) return null;
  const completo = d.padStart(tamanho, '0');
  return valido(completo) ? completo : null;
}

type Especie = 'CPF' | 'CNPJ';
/** Como cada documento é limpo e conferido; "tamanho" é o número de caracteres do documento completo. */
const ESPECIES: Record<Especie, { tamanho: number; limpar: (v: string) => string; valido: (d: string) => boolean }> = {
  CPF: { tamanho: 11, limpar: dig, valido: cpfValido },
  CNPJ: { tamanho: 14, limpar: limparDocumento, valido: cnpjValido }
};
/** Pelo formato: até 11 algarismos é CPF; o resto (14 caracteres, letras), CNPJ. */
const pelaForma = (v: string): Especie => /^\d{1,11}$/.test(limparDocumento(v)) ? 'CPF' : 'CNPJ';
/** Qual documento cada tipo de cadastro tem; somente contato (ou tipo inválido) vai pelo formato do número. */
const ESPECIE_DO_TIPO: Record<TipoPessoa, (v: string) => Especie> = { pf: () => 'CPF', pj: () => 'CNPJ', contato: pelaForma };

/** Texto livre -> chave, comparando com normal() (tabela, de pessoa.ts). */
const TIPO_POR_TEXTO = tabela<string>([
  ...Object.entries(TIPOS).flatMap(([chave, rotulo]): [string, string][] => [[chave, chave], [rotulo, chave]]),
  ['fisica', 'pf'], ['juridica', 'pj'], ['contato', 'contato']
]);
const LGPD_POR_TEXTO = tabela<string>(Object.entries(LGPD)
  .flatMap(([chave, rotulo]): [string, string][] => [[chave, chave], [chave.replace(/_/g, ' '), chave], [rotulo, chave]]));
/** Data de cadastro antes deste ano foi digitada errado (o banco também troca por agora). */
const ANO_MINIMO_DO_CADASTRO = 1900;
/** O último instante de um dia (AAAA-MM-DD) no horário de Brasília, em ISO: uma data e hora depois dele está no futuro. */
const FIM_DO_DIA = 'T23:59:59.999';
const fimDoDia = (dia: string) => new Date(`${dia}${FIM_DO_DIA}${FUSO_PADRAO}`).toISOString();
/** Telefone só tem algarismos, espaços, parênteses, ponto e traço, com um "+" opcional na frente; o resto (letras,
 *  "=", "@") não é telefone e não pode chegar à exportação, onde o "+" do começo fica sem a proteção contra fórmula. */
const FORMA_DE_TELEFONE = /^\+?[\d(][\d\s().-]*$/;

/** Coluna de texto simples: espaços juntados, e em maiúsculas onde o formulário também põe. */
const texto = (campo: ChaveImportacao & keyof DadosPessoa, formatar: (v: string) => string = espacos): Normalizar =>
  (v, s) => { (s.dados as Record<string, unknown>)[campo] = formatar(v) || null; };
/** Coluna com lista fechada (estado civil, porte, natureza): o que não encaixa fica vazio e vai para a observação. */
const codigo = (campo: ChaveImportacao & keyof DadosPessoa, ler: (t: string) => string | null): Normalizar => (v, s) => {
  if (!v) return;
  const chave = ler(v);
  (s.dados as Record<string, unknown>)[campo] = chave;
  if (chave) return;
  guardar(s, campo, v);
  anotar(s, campo, 'aviso', `${rotuloDe(campo)} “${v}” não reconhecido: ficou em branco, com o texto na observação.`);
};
/** Coluna de data: inválida ou no futuro fica vazia, com o texto na observação. */
const data = (campo: ChaveImportacao & keyof DadosPessoa): Normalizar => (v, s, ctx) => {
  if (!v) return;
  let iso: string | null = null, motivo = '';
  try { iso = lerDataFlexivel(v); } catch (e) { motivo = (e as Error).message; }
  if (iso && iso > ctx.hoje) { iso = null; motivo = 'Data no futuro.'; }
  (s.dados as Record<string, unknown>)[campo] = iso;
  if (iso) return;
  guardar(s, campo, v);
  anotar(s, campo, 'aviso', `${rotuloDe(campo)} “${v}” ficou em branco: ${motivo}`);
};
const uf = (campo: ChaveImportacao & keyof DadosPessoa): Normalizar => (v, s) => {
  if (!v) return;
  const valida = ufValida(v);
  (s.dados as Record<string, unknown>)[campo] = valida ? v.toUpperCase() : null;
  if (valida) return;
  guardar(s, campo, v);
  anotar(s, campo, 'aviso', `${rotuloDe(campo)} “${v}” não é uma UF: ficou em branco, com o texto na observação.`);
};

/** Como cada coluna entra no cadastro (uma entrada por coluna: coluna nova = uma linha nova aqui). */
const NORMALIZAR: Record<ChaveImportacao, Normalizar> = {
  referencia: (v, s) => { s.referencia = v || null; },
  tipo: (v, s) => {
    const tipo = TIPO_POR_TEXTO.get(normal(v)) as TipoPessoa | undefined;
    if (tipo) { s.dados.tipo = tipo; return; }
    anotar(s, 'tipo', 'erro', v ? `Tipo “${v}” não reconhecido: use pf, pj ou contato.` : 'Informe o tipo: pf, pj ou contato.');
  },
  nome: (v, s) => {
    s.dados.nome = maiusculas(v);
    if (!s.dados.nome) anotar(s, 'nome', 'erro', 'Informe o nome.');
  },
  documento: (v, s) => {
    if (!v) return;
    s.documentoNoArquivo = limparDocumento(v) || null;
    if (emNotacaoCientifica(v)) {
      anotar(s, 'documento', 'erro', `O CPF/CNPJ veio em notação científica: o Excel trocou o número e os últimos algarismos se perderam. Formate a coluna como texto, digite de novo e salve.`);
      return;
    }
    const especie = s.dados.tipo ? ESPECIE_DO_TIPO[s.dados.tipo](v) : pelaForma(v);
    const { tamanho, limpar, valido } = ESPECIES[especie];
    if (valido(limpar(v))) { s.dados.documento = limpar(v); return; }
    const completo = semZeroPerdido(v, tamanho, valido);
    if (completo) {
      s.dados.documento = completo;
      anotar(s, 'documento', 'aviso', `O ${especie} veio sem o zero do começo (o Excel apaga): ficou ${fmtDocumento(completo)}.`);
      return;
    }
    s.dados.documento = null;
    pendenciar(s, 'documento_invalido');
    s.observacoes.push(`${especie} digitado no arquivo: ${v}`);
    anotar(s, 'documento', 'aviso', `${especie} inválido: entra sem ${especie}, com o número guardado na observação.`);
  },
  genero: (v, s) => {
    if (!v) return;
    s.dados.genero = generoDoTexto(v);
    if (!s.dados.genero) anotar(s, 'genero', 'aviso', `Gênero “${v}” não reconhecido: ficou em branco.`);
  },
  nacionalidade: texto('nacionalidade', v => /^brasileir/i.test(v.trim()) ? 'brasileira' : espacos(v)),
  profissao: texto('profissao'),
  estado_civil: codigo('estado_civil', estadoCivilDoTexto),
  rg: texto('rg'),
  rg_expedicao: data('rg_expedicao'),
  nome_mae: texto('nome_mae', maiusculas),
  nome_pai: texto('nome_pai', maiusculas),
  nascimento: data('nascimento'),
  nascimento_municipio: texto('nascimento_municipio'),
  nascimento_uf: uf('nascimento_uf'),
  natureza: codigo('natureza', naturezaDoTexto),
  tipo_entidade: (v, s) => {
    if (!v) return;
    const entidade = entidadeDoTexto(v), natureza = naturezaDaEntidade(entidade);
    if (entidade && natureza && (!s.dados.natureza || s.dados.natureza === natureza)) {
      s.dados.tipo_entidade = entidade;
      s.dados.natureza = natureza;
      return;
    }
    guardar(s, 'tipo_entidade', v);
    anotar(s, 'tipo_entidade', 'aviso', entidade
      ? `Tipo de entidade “${v}” não é da natureza jurídica informada: ficou em branco, com o texto na observação.`
      : `Tipo de entidade “${v}” não reconhecido: ficou em branco, com o texto na observação.`);
  },
  nome_fantasia: texto('nome_fantasia', maiusculas),
  porte: codigo('porte', porteDoTexto),
  abertura: data('abertura'),
  representantes: texto('representantes', maiusculas),
  cep: (v, s) => {
    if (!v) return;
    const d = dig(v);
    const so = !/[^\d\s.-]/.test(v) && !emNotacaoCientifica(v);
    if (so && cepValido(d)) { s.dados.cep = d; return; }
    const completo = so ? semZeroPerdido(d, DIGITOS_DO_CEP, cepValido, ZEROS_PERDIDOS_DO_CEP) : null;
    if (completo) {
      s.dados.cep = completo;
      anotar(s, 'cep', 'aviso', `O CEP veio sem o zero do começo (o Excel apaga): ficou ${fmtCEP(completo)}.`);
      return;
    }
    guardar(s, 'cep', v);
    anotar(s, 'cep', 'aviso', emNotacaoCientifica(v)
      ? 'O CEP veio em notação científica: ficou em branco, com o texto na observação.'
      : `CEP “${v}” não tem 8 dígitos: ficou em branco, com o texto na observação.`);
  },
  logradouro: texto('logradouro'),
  numero: texto('numero'),
  complemento: texto('complemento'),
  bairro: texto('bairro'),
  municipio: texto('municipio'),
  uf: uf('uf'),
  telefones: (v, s) => {
    const vistos = new Set<string>(), telefones: string[] = [];
    for (const t of dividir(v)) {
      if (emNotacaoCientifica(t) || !FORMA_DE_TELEFONE.test(t) || !telefoneValido(t)) {
        guardar(s, 'telefones', t);
        anotar(s, 'telefones', 'aviso', `Telefone “${t}” não reconhecido (use DDD + número): ficou de fora, com o texto na observação.`);
        continue;
      }
      const chave = celularCompleto(t);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      telefones.push(fmtTelefone(t));
    }
    s.dados.telefones = telefones;
  },
  emails: (v, s) => {
    const emails: string[] = [];
    for (const e of dividir(v).map(x => x.toLowerCase())) {
      if (!emailValido(e)) {
        guardar(s, 'emails', e);
        anotar(s, 'emails', 'aviso', `E-mail “${e}” inválido: ficou de fora, com o texto na observação.`);
      } else if (!emails.includes(e)) emails.push(e);
    }
    s.dados.emails = emails;
  },
  lgpd_base: (v, s, ctx) => {
    const base = v ? LGPD_POR_TEXTO.get(normal(v)) : ctx.lgpdPadrao;
    s.dados.lgpd_base = base ?? ctx.lgpdPadrao;
    if (!base) anotar(s, 'lgpd_base', 'aviso', `Base legal “${v}” não reconhecida: ficou ${LGPD[ctx.lgpdPadrao] ?? ctx.lgpdPadrao}.`);
  },
  lgpd_consentimento: (v, s, ctx) => {
    if (!v) return;
    if (s.dados.lgpd_base !== 'consentimento') {
      anotar(s, 'lgpd_consentimento', 'aviso', 'A data do consentimento só vale com a base legal "consentimento": ficou de fora.');
      return;
    }
    data('lgpd_consentimento')(v, s, ctx);
  },
  responsaveis: (v, s) => {
    const nomes = new Map<string, string>();
    for (const n of dividir(v)) if (!nomes.has(normal(n))) nomes.set(normal(n), n);
    s.nomesResponsaveis = [...nomes.values()];
  },
  cadastrado_em: (v, s, ctx) => {
    if (!v) return;
    let iso: string | null = null, motivo = '';
    try { iso = lerDataHora(v); } catch (e) { motivo = (e as Error).message; }
    if (iso && iso > fimDoDia(ctx.hoje)) { iso = null; motivo = 'Data no futuro.'; }
    if (iso && Number(iso.slice(0, 4)) < ANO_MINIMO_DO_CADASTRO) { iso = null; motivo = `Data antes de ${ANO_MINIMO_DO_CADASTRO}.`; }
    s.cadastradoEm = iso;
    if (!iso) anotar(s, 'cadastrado_em', 'aviso', `Data de cadastro “${v}” ignorada (fica a de hoje): ${motivo}`);
  },
  observacoes: (v, s) => { if (v) s.observacoes.unshift(v); },
  conferir: (v, s) => {
    if (!v) return;
    pendenciar(s, 'conferir');
    s.observacoes.push(`A conferir: ${v}`);
  }
};

// Injeção de fórmula: começo de texto que a planilha rodaria como fórmula se o cadastro for exportado de novo.
/** Sempre tirados do começo: =, @, tab e \r (e os espaços entre eles). */
const FORMULA_A_TIRAR = /^[=@\s]+/;
/** Nas colunas de texto livre, também + e - saem do começo. */
const FORMULA_A_TIRAR_COM_SINAL = /^[=@+\-\s]+/;
/** Onde + e - podem começar o valor (telefone "+55", datas, documentos), só =, @, tab e \r saem. Essas colunas são
 *  conferidas pelo formato depois (o telefone só aceita algarismos e sinais): texto com fórmula não passa. O número do
 *  endereço não está aqui: não tem sinal, e é texto livre ("s/n", "10-A"). */
const ACEITAM_SINAL: ReadonlySet<ChaveImportacao> = new Set<ChaveImportacao>(
  ['telefones', 'documento', 'cep', 'rg_expedicao', 'nascimento', 'abertura', 'lgpd_consentimento', 'cadastrado_em']);
/** Colunas com mais de um item: a proteção vale para cada item. */
const LISTAS: ReadonlySet<ChaveImportacao> = new Set<ChaveImportacao>(['telefones', 'emails', 'responsaveis']);

/** Os responsáveis não são gravados como texto (viram ids da equipe) e aceitam "@usuario": ficam como vieram. */
const SEM_PROTECAO: ReadonlySet<ChaveImportacao> = new Set<ChaveImportacao>(['responsaveis']);

/** O texto sem o apóstrofo que escreverCSV (protegerFormulas) pôs na frente: o arquivo exportado volta como era. */
const semProtecao = (t: string) => t.trim().replace(PROTECAO_DE_FORMULA, '');

/**
 * O valor sem o começo de fórmula; avisa uma vez por coluna quando tirou algo. Antes, desfaz a proteção do
 * escreverCSV ("'=X" volta a "=X"), senão o apóstrofo iria para o cadastro e esconderia a fórmula.
 */
function semFormula(chave: ChaveImportacao, valor: string, s: Saida): string {
  if (SEM_PROTECAO.has(chave)) return valor.trim();
  const comeco = ACEITAM_SINAL.has(chave) ? FORMULA_A_TIRAR : FORMULA_A_TIRAR_COM_SINAL;
  const limpar = (t: string) => semProtecao(t).replace(comeco, '').trim();
  const limpo = LISTAS.has(chave) ? dividir(valor).map(limpar).filter(Boolean).join(SEPARADOR_DE_LISTA) : limpar(valor);
  const original = LISTAS.has(chave) ? dividir(valor).map(semProtecao).join(SEPARADOR_DE_LISTA) : semProtecao(valor);
  if (limpo !== original) {
    anotar(s, chave, 'aviso', `${rotuloDe(chave)}: o começo com =, +, - ou @ foi tirado (a planilha leria como fórmula).`);
  }
  return limpo;
}

/** Cadastro vazio, com todos os campos: a pessoa nova vai para o banco com tudo definido. */
const CADASTRO_VAZIO: DadosPessoa = {
  tipo: undefined, nome: undefined, genero: null, nacionalidade: null, profissao: null, estado_civil: null, rg: null,
  rg_expedicao: null, nome_mae: null, nome_pai: null, nascimento: null, nascimento_municipio: null, nascimento_uf: null,
  natureza: null, tipo_entidade: null, nome_fantasia: null, porte: null, abertura: null, representantes: null,
  documento: null, cep: null, logradouro: null, numero: null, complemento: null, bairro: null, municipio: null, uf: null,
  telefones: [], emails: [], lgpd_base: null, lgpd_consentimento: null
};

/**
 * Uma linha do arquivo -> cadastro no formato do banco, com observações, pendências e problemas. Cada coluna passa
 * por NORMALIZAR, na ordem do modelo; no fim, o cadastro fica só com os campos do tipo (ajustarAoTipo).
 */
export function normalizarLinha(l: LinhaLida, ctx: ContextoImportacao): PessoaImportada {
  const s: Saida = {
    linha: l.numero, referencia: null, dados: { ...CADASTRO_VAZIO }, documentoNoArquivo: null, cadastradoEm: null,
    nomesResponsaveis: [], observacoes: [], pendencias: [], problemas: []
  };
  for (const { chave, limite } of COLUNAS_IMPORTACAO) {
    const valor = semFormula(chave, l.valores[chave] ?? '', s);
    if (limite && valor.length > limite) {
      anotar(s, chave, 'erro', `${rotuloDe(chave)} tem ${valor.length} caracteres; o máximo é ${limite}.`);
      continue;
    }
    NORMALIZAR[chave](valor, s, ctx);
  }
  // Só os campos do tipo: o que veio em coluna de outro tipo fica de fora (com aviso).
  const ajustado = ajustarAoTipo(s.dados);
  const foraDoTipo = (Object.keys(s.dados) as (keyof DadosPessoa)[])
    .filter(c => c !== 'genero' && s.dados[c] !== null && ajustado[c] === null);
  if (foraDoTipo.length && s.dados.tipo) {
    anotar(s, 'tipo', 'aviso', `Campos que não valem para ${TIPOS[s.dados.tipo]} ficaram de fora: ${foraDoTipo.map(c => CAMPOS[c] ?? c).join(', ')}.`);
  }
  if (s.dados.genero && !ajustado.genero && s.dados.tipo) {
    anotar(s, 'genero', 'aviso', 'Gênero só vale para pessoa física ou empresa individual (MEI, empresário individual): ficou em branco.');
  }
  s.dados = ajustado;
  const observacao = textoDaObservacao(s.observacoes);
  if (observacao && observacao.length > TAMANHO_OBSERVACOES) {
    anotar(s, 'observacoes', 'erro', `A observação ficou com ${observacao.length} caracteres; o máximo é ${TAMANHO_OBSERVACOES}. Encurte as observações da linha.`);
  }
  return s;
}

/** As partes da observação num texto só (null se não há nenhuma). */
export const textoDaObservacao = (partes: string[]) => partes.filter(Boolean).join('\n') || null;
/** A observação que já existe com a nova acrescentada no fim (a nova não entra de novo se já está lá). */
export function juntarObservacoes(atual: string | null | undefined, nova: string | null | undefined): string | null {
  if (!nova || atual?.includes(nova)) return atual || null;
  return atual ? `${atual}\n${nova}` : nova;
}

// ---------- responsáveis ----------

export type Achado = { membro: Membro } | { motivo: 'nao_achado' | 'ambiguo' };
const palavras = (t: string) => normal(t).replace(/^@/, '').split(/\s+/).filter(Boolean);
/** Jeitos de achar alguém da equipe pelo texto do arquivo, do mais exato ao mais solto. O primeiro que acha alguém decide. */
const MANEIRAS_DE_ACHAR: ((texto: string, m: Membro) => boolean)[] = [
  // O nome inteiro ou o @usuario.
  (t, m) => palavras(t).join(' ') === palavras(m.nome).join(' ') || palavras(t).join(' ') === normal(m.usuario),
  // Só o primeiro nome ("Ana").
  (t, m) => palavras(t).length === 1 && palavras(t)[0] === palavras(m.nome)[0],
  // Todas as palavras do texto estão no nome ("Ana Lima" acha "Ana Teste Lima").
  (t, m) => { const nome = palavras(m.nome); return palavras(t).every(p => nome.includes(p)); }
];
/** Alguém da equipe pelo nome ou @usuario do arquivo. Só membros ativos; mais de um possível = ambiguo. */
export function acharResponsavel(texto: string, equipe: Membro[]): Achado {
  if (!palavras(texto).length) return { motivo: 'nao_achado' };
  const ativos = equipe.filter(m => m.ativo !== false);
  for (const achar of MANEIRAS_DE_ACHAR) {
    const achados = ativos.filter(m => achar(texto, m));
    if (achados.length === 1) return { membro: achados[0] };
    if (achados.length > 1) return { motivo: 'ambiguo' };
  }
  return { motivo: 'nao_achado' };
}

export interface NomeDoArquivo { texto: string; quantas: number; sugestao: string | null; motivo?: 'nao_achado' | 'ambiguo' }
/** Cada nome distinto da coluna "responsaveis" (na ordem em que aparece; fora as linhas recusadas), quantas linhas o citam e a sugestão da equipe. */
export function nomesDeResponsaveis(importadas: PessoaImportada[], equipe: Membro[]): NomeDoArquivo[] {
  const nomes = new Map<string, NomeDoArquivo>();
  const semErro = importadas.filter(i => !i.problemas.some(p => p.gravidade === 'erro'));
  for (const texto of semErro.flatMap(i => i.nomesResponsaveis)) {
    const chave = normal(texto), visto = nomes.get(chave);
    if (visto) { visto.quantas++; continue; }
    const achado = acharResponsavel(texto, equipe);
    nomes.set(chave, 'membro' in achado ? { texto, quantas: 1, sugestao: achado.membro.id } : { texto, quantas: 1, sugestao: null, motivo: achado.motivo });
  }
  return [...nomes.values()];
}
/** Nome do arquivo (normal(texto)) -> id do perfil escolhido na tela (null = não ligar ninguém). */
export type MapaResponsaveis = Record<string, string | null>;
const idsDosResponsaveis = (nomes: string[], mapa: MapaResponsaveis) =>
  [...new Set(nomes.map(n => mapa[normal(n)]).filter((id): id is string => !!id))];

// ---------- comparar com o que já existe ----------

export type Situacao = 'novo' | 'completar' | 'sem_mudanca' | 'decidir' | 'recusada';
export type MotivoDecisao = 'repetido_no_arquivo' | 'documento_diferente' | 'nome_diferente';
export interface Classificacao {
  linha: number;
  situacao: Situacao;
  existente: PessoaExistente | null;
  /** Novo: o cadastro todo. Existente: o que completarVazios preenche. */
  mudancas: DadosPessoa;
  /** Ids de perfil que entram como responsáveis (os que o cadastro ainda não tem). */
  responsaveisNovos: string[];
  motivo?: MotivoDecisao;
  /** O cadastro existente está arquivado: é completado e continua arquivado (DICA_ARQUIVADA). */
  arquivada: boolean;
}
export const DICA_ARQUIVADA = 'Está arquivada: continua arquivada.';

const vazio = (v: unknown) => v === null || v === undefined || v === '';
/** Campos que completarVazios pode preencher no cadastro existente: os do tipo dele (CAMPOS_DO_TIPO, os mesmos do
 *  formulário), menos o gênero, que tem regra própria. */
const completaveis = (tipo: TipoPessoa) => CAMPOS_DO_TIPO[tipo].filter(c => c !== 'genero');
/** A lista atual com os itens novos no fim, sem repetir (pela chave); null se nada é novo. */
function uniao(atuais: string[], novos: string[] | null | undefined, chave: (v: string) => string): string[] | null {
  const vistos = new Set(atuais.map(chave)), juntos = [...atuais];
  for (const n of novos ?? []) if (!vistos.has(chave(n))) { vistos.add(chave(n)); juntos.push(n); }
  return juntos.length > atuais.length ? juntos : null;
}

/**
 * O que a importação muda num cadastro que já existe (a mesma regra do UPDATE de pessoas_importar no banco):
 * - só campos vazios, e só os do tipo do cadastro (PF, PJ; somente contato não tem endereço);
 * - nunca troca tipo, nome, documento nem nada preenchido; o documento só entra se o cadastro não tem nenhum
 *   (ex.: o CPF corrigido na planilha, numa nova importação; achado pela referência);
 * - gênero vazio é completado só se o tipo permite (pessoa física ou empresa individual);
 * - tipo de entidade só se for da natureza do cadastro;
 * - telefones e e-mails são ACRESCENTADOS (os atuais primeiro, sem repetir);
 * - a base legal só se estiver vazia (com a data do consentimento).
 * {} = nada a completar.
 */
export function completarVazios(atual: PessoaExistente, nova: DadosPessoa): DadosPessoa {
  const r: DadosPessoa = {};
  const mudar = r as Record<string, unknown>;
  for (const campo of completaveis(atual.tipo)) if (vazio(atual[campo]) && !vazio(nova[campo])) mudar[campo] = nova[campo];
  if (vazio(atual.documento) && nova.documento) r.documento = nova.documento;
  const natureza = atual.natureza ?? r.natureza;
  if (r.tipo_entidade && naturezaDaEntidade(r.tipo_entidade) !== natureza) delete r.tipo_entidade;
  if (vazio(atual.genero) && nova.genero
    && generoPermitido({ tipo: atual.tipo, tipo_entidade: atual.tipo_entidade ?? r.tipo_entidade })) r.genero = nova.genero;
  const telefones = uniao(atual.telefones ?? [], nova.telefones, t => celularCompleto(t));
  if (telefones) r.telefones = telefones;
  const emails = uniao(atual.emails ?? [], nova.emails, e => e.trim().toLowerCase());
  if (emails) r.emails = emails;
  if (vazio(atual.lgpd_base) && nova.lgpd_base) {
    r.lgpd_base = nova.lgpd_base;
    if (nova.lgpd_consentimento) r.lgpd_consentimento = nova.lgpd_consentimento;
  }
  return r;
}

/** Os responsáveis atuais com os novos no fim, sem repetir e sem tirar ninguém. */
export const juntarResponsaveis = (atuais: string[], novos: string[]): string[] => [...new Set([...atuais, ...novos])];

/** O que se sabe de uma linha para classificá-la. */
interface Caso {
  imp: PessoaImportada;
  existente: PessoaExistente | null;
  repetida: boolean;
  mudancas: DadosPessoa;
  responsaveisNovos: string[];
}
const nomeComparavel = (t: string | null | undefined) => normal(t).replace(/\s+/g, ' ');
/** Há algo a gravar num cadastro existente: campo, responsável, observação ou pendência novos. */
function temNovidade({ imp, existente, mudancas, responsaveisNovos }: Caso) {
  const observacao = textoDaObservacao(imp.observacoes);
  return Object.keys(mudancas).length > 0 || responsaveisNovos.length > 0
    || (!!observacao && !existente?.observacoes?.includes(observacao))
    || imp.pendencias.some(p => !existente?.pendencias?.includes(p));
}
/** As regras de classificação, na ordem: a primeira que vale decide. */
const CLASSIFICACAO: { situacao: Situacao; motivo?: MotivoDecisao; vale: (c: Caso) => boolean }[] = [
  { situacao: 'recusada', vale: c => c.imp.problemas.some(p => p.gravidade === 'erro') },
  { situacao: 'decidir', motivo: 'repetido_no_arquivo', vale: c => c.repetida },
  { situacao: 'decidir', motivo: 'documento_diferente', vale: c => !!c.existente?.documento && !!c.imp.dados.documento
    && limparDocumento(c.existente.documento) !== c.imp.dados.documento },
  { situacao: 'decidir', motivo: 'nome_diferente', vale: c => !!c.existente && nomeComparavel(c.existente.nome) !== nomeComparavel(c.imp.dados.nome) },
  { situacao: 'sem_mudanca', vale: c => !!c.existente && !temNovidade(c) },
  { situacao: 'completar', vale: c => !!c.existente },
  { situacao: 'novo', vale: () => true }
];

/** O documento da linha para achar repetidos: o válido, ou o que foi digitado (dois CPFs inválidos iguais também repetem). */
const documentoDaLinha = (i: PessoaImportada) => i.dados.documento ?? i.documentoNoArquivo;
const chavesDaLinha = (i: PessoaImportada) =>
  [documentoDaLinha(i) && `d:${documentoDaLinha(i)}`, i.referencia && `r:${i.referencia}`].filter((k): k is string => !!k);

/**
 * Cada linha comparada com os cadastros que já existem (achados pelo documento ou pela referência): novo, completar,
 * sem mudança, para decidir (repetida no arquivo ou com outro nome) ou recusada (com erro).
 */
export function classificar(importadas: PessoaImportada[], existentes: PessoaExistente[], mapa: MapaResponsaveis): Classificacao[] {
  const porDocumento = new Map(existentes.filter(p => p.documento).map(p => [limparDocumento(p.documento), p]));
  const porReferencia = new Map(existentes.filter(p => p.referencia).map(p => [p.referencia as string, p]));
  const comErro = (i: PessoaImportada) => i.problemas.some(p => p.gravidade === 'erro');
  const vezes = new Map<string, number>();
  for (const k of importadas.filter(i => !comErro(i)).flatMap(chavesDaLinha)) vezes.set(k, (vezes.get(k) ?? 0) + 1);
  return importadas.map(imp => {
    const existente = (imp.dados.documento && porDocumento.get(imp.dados.documento))
      || (imp.referencia && porReferencia.get(imp.referencia)) || null;
    const ids = idsDosResponsaveis(imp.nomesResponsaveis, mapa);
    const atuais = new Set(existente?.resp?.map(r => r.perfil_id) ?? []);
    const caso: Caso = {
      imp, existente,
      repetida: chavesDaLinha(imp).some(k => (vezes.get(k) ?? 0) > 1),
      mudancas: existente ? completarVazios(existente, imp.dados) : imp.dados,
      responsaveisNovos: ids.filter(id => !atuais.has(id))
    };
    const regra = CLASSIFICACAO.find(r => r.vale(caso)) as (typeof CLASSIFICACAO)[number];
    return {
      linha: imp.linha, situacao: regra.situacao, existente, mudancas: caso.mudancas, responsaveisNovos: caso.responsaveisNovos,
      arquivada: !!existente?.arquivado_em, ...(regra.motivo ? { motivo: regra.motivo } : {})
    };
  });
}

// ---------- decidir e planejar ----------

export type Decisao = 'usar_cadastro' | 'manter_documento' | 'nova_sem_documento' | 'nao_importar';
export const ROTULO_DECISAO: Record<Decisao, string> = {
  usar_cadastro: 'Completar o cadastro que já existe',
  manter_documento: 'Entrar como pessoa nova, com este CPF/CNPJ',
  nova_sem_documento: 'Entrar como pessoa nova, sem o CPF/CNPJ (fica na observação)',
  nao_importar: 'Não importar'
};
/** O que a tela explica e oferece em cada caso para decidir. "manter_documento" só existe para linha repetida no arquivo. */
export const DECISOES: Record<MotivoDecisao, { explicacao: string; opcoes: Decisao[] }> = {
  repetido_no_arquivo: {
    explicacao: 'O mesmo CPF/CNPJ (ou a mesma referência) aparece em mais de uma linha do arquivo. Só uma linha pode entrar com ele.',
    opcoes: ['manter_documento', 'usar_cadastro', 'nova_sem_documento', 'nao_importar']
  },
  documento_diferente: {
    explicacao: 'O cadastro desta referência já tem outro CPF/CNPJ. Completar mantém o CPF/CNPJ que já está no SEMPER.',
    opcoes: ['usar_cadastro', 'nao_importar']
  },
  nome_diferente: {
    explicacao: 'Já existe um cadastro com este CPF/CNPJ (ou esta referência), mas com outro nome.',
    opcoes: ['usar_cadastro', 'nova_sem_documento', 'nao_importar']
  }
};
/** Quando cada decisão cabe: completar exige um cadastro existente; entrar com o documento exige que não haja nenhum. */
const DECISAO_CABE: Record<Decisao, (c: Classificacao) => boolean> = {
  usar_cadastro: c => !!c.existente,
  manter_documento: c => !c.existente,
  nova_sem_documento: () => true,
  nao_importar: () => true
};
/** As opções que a tela mostra para uma linha "decidir". */
export const opcoesDaLinha = (c: Classificacao): Decisao[] => c.motivo ? DECISOES[c.motivo].opcoes.filter(d => DECISAO_CABE[d](c)) : [];

/** O que se sabe de uma linha para montar o item. */
interface Plano {
  imp: PessoaImportada;
  c: Classificacao;
  mapa: MapaResponsaveis;
  problema: (campo: ChaveImportacao, mensagem: string) => null;
  /** A referência é de outra linha ou de um cadastro existente (não pode entrar de novo como nova). */
  referenciaUsada: boolean;
}

/** O que muda numa pessoa nova em relação à linha do arquivo (entrar sem o documento). */
interface AjusteDoNovo { dados?: DadosPessoa; referencia?: string | null; observacoes?: string[]; pendencias?: Pendencia[] }

function itemNovo({ imp, mapa, problema }: Plano, ajuste: AjusteDoNovo = {}): ItemImportacao | null {
  const observacoes = textoDaObservacao([...imp.observacoes, ...(ajuste.observacoes ?? [])]);
  if (observacoes && observacoes.length > TAMANHO_OBSERVACOES) {
    return problema('observacoes', `Linha ${imp.linha}: a observação passaria de ${TAMANHO_OBSERVACOES} caracteres.`);
  }
  return {
    linha: imp.linha, referencia: ajuste.referencia !== undefined ? ajuste.referencia : imp.referencia, existente_id: null,
    dados: ajuste.dados ?? imp.dados, criado_em: imp.cadastradoEm, responsaveis: idsDosResponsaveis(imp.nomesResponsaveis, mapa),
    observacoes, pendencias: [...new Set([...imp.pendencias, ...(ajuste.pendencias ?? [])])]
  };
}

function itemCompletar({ imp, c, problema }: Plano): ItemImportacao | null {
  const existente = c.existente as PessoaExistente;
  const partes = [...imp.observacoes];
  // Completar um cadastro de outro nome: o nome do arquivo fica registrado.
  if (nomeComparavel(existente.nome) !== nomeComparavel(imp.dados.nome)) partes.unshift(`Nome no arquivo importado: ${imp.dados.nome}`);
  // Completar um cadastro que tem outro CPF/CNPJ: o do arquivo fica registrado, o do SEMPER não muda.
  if (existente.documento && imp.dados.documento && limparDocumento(existente.documento) !== imp.dados.documento) {
    partes.unshift(`CPF/CNPJ no arquivo importado: ${fmtDocumento(imp.dados.documento)}`);
  }
  const nova = textoDaObservacao(partes);
  const junta = juntarObservacoes(existente.observacoes, nova);
  if (junta && junta.length > TAMANHO_OBSERVACOES) {
    return problema('observacoes', `Linha ${imp.linha}: a observação do cadastro passaria de ${TAMANHO_OBSERVACOES} caracteres.`);
  }
  return {
    linha: imp.linha, referencia: imp.referencia, existente_id: existente.id, dados: c.mudancas, criado_em: null,
    responsaveis: c.responsaveisNovos, observacoes: junta === (existente.observacoes || null) ? null : nova,
    pendencias: imp.pendencias
  };
}

/** Pessoa nova sem o documento (que vai para a observação, com a pendência "conferir"). */
function itemSemDocumento(p: Plano): ItemImportacao | null {
  const { imp } = p, doc = imp.dados.documento ?? imp.documentoNoArquivo;
  return itemNovo(p, {
    dados: { ...imp.dados, documento: null },
    referencia: p.referenciaUsada ? null : imp.referencia,
    observacoes: doc ? [`CPF/CNPJ no arquivo: ${fmtDocumento(doc)} (entrou sem ele para não repetir outro cadastro; confira)`] : [],
    pendencias: ['conferir']
  });
}

/** O que cada decisão grava. */
const PLANO_DA_DECISAO: Record<Decisao, (p: Plano) => ItemImportacao | null> = {
  usar_cadastro: itemCompletar,
  manter_documento: p => itemNovo(p),
  nova_sem_documento: itemSemDocumento,
  nao_importar: () => null
};
/** O que cada situação grava (recusada e sem mudança não vão para o banco). */
const PLANO_DA_SITUACAO: Record<Situacao, (p: Plano, decisao: Decisao | undefined) => ItemImportacao | null> = {
  novo: p => itemNovo(p),
  completar: itemCompletar,
  sem_mudanca: () => null,
  recusada: () => null,
  decidir: (p, decisao) => {
    if (!decisao) return null;   // sem decisão, a linha fica de fora
    if (!opcoesDaLinha(p.c).includes(decisao)) return p.problema('documento', `Linha ${p.c.linha}: essa escolha não vale para esta linha.`);
    return PLANO_DA_DECISAO[decisao](p);
  }
};

/**
 * O que vai para o banco, linha a linha. Linha para decidir sem decisão fica de fora (como "Não importar"). Duas linhas
 * que escolheram entrar com o mesmo CPF/CNPJ (ou a mesma referência) são problema, e as duas ficam de fora.
 * "nova_sem_documento": o documento vai para a observação, com a pendência "conferir".
 */
export function planejar(importadas: PessoaImportada[], c: Classificacao[], decisoes: Record<number, Decisao>,
  mapa: MapaResponsaveis): { itens: ItemImportacao[]; problemas: Problema[] } {
  const porLinha = new Map(importadas.map(i => [i.linha, i]));
  const problemas: Problema[] = [];
  // Quem escolheu entrar com o documento: só uma linha por CPF/CNPJ ou referência.
  const mantidas = new Map<string, number[]>();
  for (const x of c.filter(x => x.situacao === 'decidir' && decisoes[x.linha] === 'manter_documento')) {
    for (const k of chavesDaLinha(porLinha.get(x.linha) as PessoaImportada)) mantidas.set(k, [...(mantidas.get(k) ?? []), x.linha]);
  }
  const emConflito = new Set<number>();
  for (const linhas of mantidas.values()) {
    if (linhas.length < 2) continue;
    for (const linha of linhas) {
      if (emConflito.has(linha)) continue;
      emConflito.add(linha);
      problemas.push({ linha, campo: 'documento', gravidade: 'erro',
        mensagem: `As linhas ${linhas.join(', ')} escolheram entrar com o mesmo CPF/CNPJ (ou a mesma referência): só uma pode.` });
    }
  }
  // Referências que aparecem em mais de uma linha ou já são de um cadastro: a pessoa nova sem documento entra sem elas.
  const referencias = new Map<string, number>();
  for (const i of importadas) if (i.referencia) referencias.set(i.referencia, (referencias.get(i.referencia) ?? 0) + 1);
  const itens: ItemImportacao[] = [];
  for (const x of c) {
    const imp = porLinha.get(x.linha);
    if (!imp || emConflito.has(x.linha)) continue;
    const plano: Plano = {
      imp, c: x, mapa,
      problema: (campo, mensagem) => { problemas.push({ linha: x.linha, campo, gravidade: 'erro', mensagem }); return null; },
      referenciaUsada: !!imp.referencia && ((referencias.get(imp.referencia) ?? 0) > 1 || x.existente?.referencia === imp.referencia)
    };
    const item = PLANO_DA_SITUACAO[x.situacao](plano, decisoes[x.linha]);
    if (item) itens.push(item);
  }
  return { itens, problemas };
}

/** Os itens em lotes de até "tamanho" (o último pode ser menor). */
export function emLotes<T>(itens: T[], tamanho: number): T[][] {
  if (tamanho < 1) throw new Error('O lote precisa ter pelo menos 1 item.');
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

export interface ResumoImportacao { novos: number; completar: number; semMudanca: number; decidir: number; recusadas: number; comPendencia: number }
const CONTADOR: Record<Situacao, Exclude<keyof ResumoImportacao, 'comPendencia'>> = {
  novo: 'novos', completar: 'completar', sem_mudanca: 'semMudanca', decidir: 'decidir', recusada: 'recusadas'
};
/** As situações que com certeza vão para o banco (para decidir depende da escolha; sem mudança e recusada não vão). */
const ENTRAM: ReadonlySet<Situacao> = new Set<Situacao>(['novo', 'completar']);
/** Quantas linhas em cada situação e quantas das que entram (novas ou a completar) levam pendência. */
export function resumir(c: Classificacao[], importadas: PessoaImportada[]): ResumoImportacao {
  const r: ResumoImportacao = { novos: 0, completar: 0, semMudanca: 0, decidir: 0, recusadas: 0, comPendencia: 0 };
  const pendentes = new Set(importadas.filter(i => i.pendencias.length).map(i => i.linha));
  for (const x of c) {
    r[CONTADOR[x.situacao]]++;
    if (ENTRAM.has(x.situacao) && pendentes.has(x.linha)) r.comPendencia++;
  }
  return r;
}
