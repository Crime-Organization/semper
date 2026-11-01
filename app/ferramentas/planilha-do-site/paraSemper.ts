// Cliente final -> linha do modelo de importação do SEMPER (as colunas de COLUNAS_IMPORTACAO), e os arquivos de saída.
// Puro. Não repete o que a tela de importação já faz (normalizarLinha): UF, estado civil, porte, datas e CPF inválidos,
// telefones e e-mails inválidos vão como vieram, e a tela avisa e guarda na observação.
import type { TipoPessoa } from '../../src/dados/tipos';
import { TAMANHO_OBSERVACOES } from '../../src/dados/limites';
import { escreverCSV } from '../../src/regras/csv';
import {
  classificar, COLUNAS_IMPORTACAO, lerImportacao, normalizarLinha, SEPARADOR_DE_LISTA, type ChaveImportacao, type ContextoImportacao
} from '../../src/regras/importacao';
import {
  CAMPOS_DO_TIPO, cnpjValido, cpfValido, DIGITOS_DO_CEP, fmtCEP, fmtCNPJ, fmtCPF, fmtData, limparDocumento, TIPOS
} from '../../src/regras/pessoa';
import { normal } from '../../src/regras/texto';
import {
  DATA_ISO, naturezaDoSite, PENDENTES_NO_CONFERIR, tipoDoSite, UF_DOS_CEPS_COM_ZERO, type ClienteFinal, type PessoaDoSite
} from './limpar';
import { formatar } from './telefones';

export type LinhaSemper = Record<ChaveImportacao, string>;
export interface OpcoesParaSemper {
  /** Base legal (chave de LGPD) para todos; vazio = a escolha da tela. */
  lgpd?: string;
}
/** Outro cliente do arquivo (referência e nome), para o texto de "conferir". */
export interface Outro { referencia: string; nome: string }
/** O que foi marcado na linha (para as contagens do console). */
export interface Marcas { tipoNaoReconhecido: boolean; mesmoDocumento: boolean; observacaoCortada: boolean; provasDivergentes: boolean }

/** Tipo vazio ou desconhecido: decide pelo documento válido, na ordem; sem nenhum, somente contato. */
const TIPO_PELO_DOCUMENTO: [TipoPessoa, (p: PessoaDoSite) => boolean][] = [['pf', p => cpfValido(p.cpf)], ['pj', p => cnpjValido(p.cnpj)]];
/** O tipo do cadastro e se veio reconhecido da planilha. */
export function tipoDoCliente(p: PessoaDoSite): { tipo: TipoPessoa; reconhecido: boolean } {
  const tipo = tipoDoSite(p.tipoTexto);
  if (tipo) return { tipo, reconhecido: true };
  return { tipo: TIPO_PELO_DOCUMENTO.find(([, vale]) => vale(p))?.[0] ?? 'contato', reconhecido: false };
}

const cpfFormatado = (p: PessoaDoSite) => cpfValido(p.cpf) ? fmtCPF(p.cpf) : '';
const cnpjFormatado = (p: PessoaDoSite) => cnpjValido(p.cnpj) ? fmtCNPJ(p.cnpj) : '';
/** O documento de cada tipo: formatado quando válido; inválido, como veio (a tela guarda na observação e marca a
 *  pendência); somente contato, o que houver (a tela decide pelo formato). */
const DOCUMENTO: Record<TipoPessoa, (p: PessoaDoSite) => string> = {
  pf: p => cpfFormatado(p) || p.cpfTexto,
  pj: p => cnpjFormatado(p) || p.cnpjTexto,
  contato: p => cpfFormatado(p) || cnpjFormatado(p) || p.cpfTexto || p.cnpjTexto
};
/** Número com todos os caracteres iguais (000.000.000-00) é preenchimento, não documento: fica de fora. Na tela, cada
 *  linha com ele pediria uma decisão, porque o mesmo número estaria em mais de uma linha. */
const DOC_DE_PREENCHIMENTO = /^(.)\1+$/;
const semPreenchimento = (documento: string) => DOC_DE_PREENCHIMENTO.test(limparDocumento(documento)) ? '' : documento;

/** Data legível em DD/MM/AAAA; senão, o texto como veio. */
const data = (v: string) => DATA_ISO.test(v) ? fmtData(v) : v;
/** CEP com os 8 algarismos, formatado; senão, como veio. */
const cep = (p: PessoaDoSite) => p.cep.length === DIGITOS_DO_CEP && /^\d+$/.test(p.cep) ? fmtCEP(p.cep) : p.cepTexto;
/** CEP só de algarismos com 7 (perdeu um) e UF informada que não é SP: a tela completaria com o zero do começo e faria
 *  dele um CEP de SP. Vai para a observação, e a coluna fica vazia. */
const cepIncompletoForaDeSP = (p: PessoaDoSite) => /^[\d\s.-]+$/.test(p.cepTexto) && /^\d+$/.test(p.cep)
  && p.cep.length === DIGITOS_DO_CEP - 1 && !!p.uf && p.uf !== UF_DOS_CEPS_COM_ZERO;

/** Resposta do formulário para a empresa sem porte (nem ME, nem EPP…): a coluna fica vazia, sem aviso na tela. */
const SEM_PORTE = normal('Não se enquadra');
const porte = (texto: string) => normal(texto) === SEM_PORTE ? '' : texto;

/** Onde uma célula de "PROFISSIONAL RESPONSÁVEL" se divide em nomes: , ; / & e a palavra "e". */
const DIVIDIR_RESPONSAVEIS = /\s*(?:[,;/&]|\s+e\s+)\s*/i;
/** Os responsáveis de todos os envios, sem repetir (sem acento nem maiúscula fazer diferença). */
export function responsaveis(celulas: string[]): string[] {
  const nomes = new Map<string, string>();
  for (const nome of celulas.flatMap(c => c.split(DIVIDIR_RESPONSAVEIS)).map(n => n.trim()).filter(Boolean)) {
    if (!nomes.has(normal(nome))) nomes.set(normal(nome), nome);
  }
  return [...nomes.values()];
}

/**
 * Espaço da observação deixado para a tela: ao importar, ela acrescenta os valores que não couberam no cadastro (UF,
 * telefone, e-mail inválidos…) e o texto de "conferir", e a observação inteira não pode passar de TAMANHO_OBSERVACOES.
 */
const FOLGA_PARA_A_TELA = 500;
/** Como a tela escreve o "conferir" na observação (normalizarLinha). */
const CONFERIR_NA_OBSERVACAO = 'A conferir: ';
const RETICENCIAS = '…';
export const OBSERVACAO_CORTADA = 'observação cortada';
/** Quanto a observação do arquivo pode ter, dado o texto de "conferir" (que a tela também põe na observação). */
const espacoDaObservacao = (conferir: string) =>
  Math.max(0, TAMANHO_OBSERVACOES - FOLGA_PARA_A_TELA - (conferir ? CONFERIR_NA_OBSERVACAO.length + conferir.length + 1 : 0));
const juntarConferir = (partes: string[]) => partes.join('; ');
/** O texto cortado para caber em "espaco" caracteres, com "…" no fim. */
const cortar = (texto: string, espaco: number) => texto.slice(0, Math.max(0, espaco - RETICENCIAS.length)) + RETICENCIAS;
/** Os outros clientes no "conferir": os primeiros PENDENTES_NO_CONFERIR e, se há mais, quantos ficaram de fora. */
function listarOutros<T>(outros: T[], texto: (o: T) => string, resto: (n: number) => string): string[] {
  const mostrados = outros.slice(0, PENDENTES_NO_CONFERIR).map(texto);
  return outros.length > PENDENTES_NO_CONFERIR ? [...mostrados, resto(outros.length - PENDENTES_NO_CONFERIR)] : mostrados;
}
export const PROVAS_DIVERGENTES = 'Os cadastros juntados têm CPF/CNPJ ou datas diferentes entre si: confira se são a mesma pessoa';

/** O texto de "conferir" de um tipo não reconhecido. */
const tipoNaoReconhecido = (texto: string, tipo: TipoPessoa) =>
  `${texto ? `Tipo de cadastro "${texto}" não reconhecido` : 'Tipo de cadastro em branco'}: ficou ${TIPOS[tipo]}`;

const ROTULO = new Map(COLUNAS_IMPORTACAO.map(c => [c.chave, c.rotulo]));
/** As colunas de campos que só valem para algum tipo (CAMPOS_DO_TIPO): fora do tipo do cliente, a tela as apaga e só
 *  avisa o nome do campo. O conversor as esvazia e põe o valor na observação, para não se perder. */
const CAMPOS_DE_ALGUM_TIPO = [...new Set(Object.values(CAMPOS_DO_TIPO).flat())].flatMap(c => COLUNAS_IMPORTACAO.find(k => k.chave === c)?.chave ?? []);
/** Colunas com tamanho máximo que o conversor corta (o texto inteiro vai para a observação): passar do limite faz a
 *  tela recusar a linha inteira. A referência é gerada aqui (curta); observação e "conferir" têm o seu próprio corte. */
const CORTADAS = COLUNAS_IMPORTACAO.flatMap(c => c.limite && !['referencia', 'observacoes', 'conferir'].includes(c.chave)
  ? [{ chave: c.chave, limite: c.limite }] : []);
/** Os documentos que a planilha pode trazer: o que não foi para a coluna "documento" vai para a observação. */
const DOCUMENTOS: { rotulo: string; texto: (p: PessoaDoSite) => string; numero: (p: PessoaDoSite) => string }[] = [
  { rotulo: 'CPF', texto: p => p.cpfTexto, numero: p => p.cpf },
  { rotulo: 'CNPJ', texto: p => p.cnpjTexto, numero: p => p.cnpj }
];

/** O que a linha perderia na tela e vai para a observação: campos de outro tipo, o documento do outro tipo, CEP
 *  incompleto fora de SP e o texto inteiro do que passou do tamanho (a linha fica com o campo vazio ou cortado). */
function guardarNaObservacao(linha: LinhaSemper, p: PessoaDoSite, tipo: TipoPessoa): string[] {
  const guardados: string[] = [];
  const proprios = new Set<string>(CAMPOS_DO_TIPO[tipo]);
  for (const k of CAMPOS_DE_ALGUM_TIPO) {
    if (proprios.has(k) || !linha[k]) continue;
    guardados.push(`Não vale para ${TIPOS[tipo]} — ${ROTULO.get(k) ?? k}: "${linha[k]}"`);
    linha[k] = '';
  }
  const usado = limparDocumento(linha.documento);
  for (const d of DOCUMENTOS) {
    const texto = d.texto(p);
    if (semPreenchimento(texto) && limparDocumento(texto) !== usado && d.numero(p) !== usado) guardados.push(`Não vale para ${TIPOS[tipo]} — ${d.rotulo}: "${texto}"`);
  }
  if (linha.cep && cepIncompletoForaDeSP(p)) {
    guardados.push(`CEP com 7 algarismos (falta um): "${linha.cep}"`);
    linha.cep = '';
  }
  for (const { chave, limite } of CORTADAS) {
    if (linha[chave].length <= limite) continue;
    guardados.push(`${ROTULO.get(chave) ?? chave} inteiro: "${linha[chave]}"`);
    linha[chave] = cortar(linha[chave], limite);
  }
  return guardados;
}

/** A linha do SEMPER de um cliente. "mesmoDocumento": os outros clientes do arquivo com o mesmo CPF/CNPJ. */
export function linhaParaSemper(c: ClienteFinal, opcoes: OpcoesParaSemper = {}, mesmoDocumento: Outro[] = []): { linha: LinhaSemper; marcas: Marcas } {
  const p = c.site;
  const { tipo, reconhecido } = tipoDoCliente(p);
  const conferir = [
    ...(reconhecido ? [] : [tipoNaoReconhecido(p.tipoTexto, tipo)]),
    ...(c.provasDivergentes ? [PROVAS_DIVERGENTES] : []),
    ...listarOutros(c.pendentes, o => `Pode ser a mesma pessoa que ${o.referencia} (${o.nome}): ${o.caso}`,
      n => `e mais ${n} que podem ser a mesma pessoa (veja para-decidir.csv)`),
    ...listarOutros(mesmoDocumento, o => `Mesmo CPF/CNPJ que ${o.referencia} (${o.nome})`, n => `e mais ${n} com o mesmo CPF/CNPJ`)
  ];
  const linha: LinhaSemper = {
    referencia: c.referencia, tipo, natureza: tipo === 'pj' ? naturezaDoSite(p.tipoTexto) ?? '' : '', tipo_entidade: p.tipoEntidade,
    nome: p.nome, documento: semPreenchimento(DOCUMENTO[tipo](p)), genero: p.genero, nacionalidade: p.nacionalidade, profissao: p.profissao,
    estado_civil: p.estadoCivil, rg: p.rg, rg_expedicao: data(p.rgExpedicao), nome_mae: p.mae, nome_pai: p.pai,
    nascimento: data(p.nascimento), nascimento_municipio: p.nascimentoMunicipio, nascimento_uf: p.nascimentoUf,
    nome_fantasia: p.fantasia, porte: porte(p.porte), abertura: data(p.abertura), representantes: p.representantes, cep: cep(p),
    logradouro: p.logradouro, numero: p.numero, complemento: p.complemento, bairro: p.bairro, municipio: p.municipio, uf: p.uf,
    telefones: c.telefones.map(formatar).join(SEPARADOR_DE_LISTA), emails: c.emails.join(SEPARADOR_DE_LISTA),
    lgpd_base: opcoes.lgpd ?? '', lgpd_consentimento: '', responsaveis: responsaveis(p.responsaveis).join(SEPARADOR_DE_LISTA),
    cadastrado_em: c.primeiroEnvio ?? '', observacoes: '', conferir: ''
  };
  let observacoes = [...guardarNaObservacao(linha, p, tipo), ...c.observacoes].join('\n');
  const cortada = observacoes.length > espacoDaObservacao(juntarConferir(conferir));
  if (cortada) {
    conferir.push(OBSERVACAO_CORTADA);
    observacoes = cortar(observacoes, espacoDaObservacao(juntarConferir(conferir)));
  }
  linha.observacoes = observacoes;
  linha.conferir = juntarConferir(conferir);
  return {
    linha,
    marcas: {
      tipoNaoReconhecido: !reconhecido, mesmoDocumento: mesmoDocumento.length > 0, observacaoCortada: cortada,
      provasDivergentes: c.provasDivergentes
    }
  };
}

/** Todos os clientes -> linhas do SEMPER. Mesmo CPF/CNPJ em clientes separados fica nos dois, com "conferir" (a tela
 *  pede para escolher quem fica com ele). */
export function paraSemper(clientes: ClienteFinal[], opcoes: OpcoesParaSemper = {}): { linhas: LinhaSemper[]; marcas: Marcas[] } {
  // Só documento válido conta: um de preenchimento ("000.000.000-00", "0") repetido não é o mesmo cliente.
  const documentos = clientes.map(c => {
    const d = limparDocumento(DOCUMENTO[tipoDoCliente(c.site).tipo](c.site));
    return cpfValido(d) || cnpjValido(d) ? d : '';
  });
  const porDocumento = new Map<string, number[]>();
  documentos.forEach((d, i) => { if (d) porDocumento.set(d, [...(porDocumento.get(d) ?? []), i]); });
  const feitas = clientes.map((c, i) => linhaParaSemper(c, opcoes, (porDocumento.get(documentos[i]) ?? [])
    .filter(j => j !== i).map(j => ({ referencia: clientes[j].referencia, nome: clientes[j].site.nome }))));
  return { linhas: feitas.map(f => f.linha), marcas: feitas.map(f => f.marcas) };
}

const CHAVES = COLUNAS_IMPORTACAO.map(c => c.chave);
const COLUNA_DOS_TELEFONES = CHAVES.indexOf('telefones');
/** Telefone estrangeiro ("+1 …") começa com "+": na coluna de telefones, só o número de verdade fica sem a proteção
 *  contra fórmula (como na exportação para o Google); qualquer outro texto ganha o apóstrofo como as demais colunas. */
const TELEFONES_COM_MAIS = /^\+\d[\d\s().|+-]*$/;

/** As linhas -> o CSV do modelo do SEMPER (cabeçalho = as chaves, na ordem), protegido contra fórmula. */
export function csvParaSemper(linhas: LinhaSemper[]): string {
  return escreverCSV([CHAVES, ...linhas.map(l => CHAVES.map(k => l[k]))], {
    protegerFormulas: { exceto: (coluna, valor) => coluna === COLUNA_DOS_TELEFONES && TELEFONES_COM_MAIS.test(valor) }
  });
}

/** O CSV gerado lido como a tela lê (lerImportacao + normalizarLinha): quantas linhas a tela recusaria, avisaria ou pediria
 *  para decidir (só pelo que há no arquivo: aqui não se sabe o que já está no SEMPER). */
export function conferirNaTela(texto: string, ctx: ContextoImportacao) {
  const leitura = lerImportacao(texto);
  const importadas = leitura.linhas.map(l => normalizarLinha(l, ctx));
  const comErro = importadas.map(i => ({ linha: i.linha, campos: [...new Set(i.problemas.filter(p => p.gravidade === 'erro').map(p => p.campo))] }))
    .filter(r => r.campos.length);
  return {
    importadas, desconhecidas: leitura.desconhecidas, faltando: leitura.faltando,
    recusadas: comErro.length,
    /** Linha do arquivo gerado e colunas com erro de cada recusada (sem o valor: o console não mostra dado de cliente). */
    porQueRecusadas: comErro.map(r => `linha ${r.linha} (${r.campos.join(', ')})`),
    comAviso: importadas.filter(i => i.problemas.some(p => p.gravidade === 'aviso')).length,
    paraDecidir: classificar(importadas, [], {}).filter(c => c.situacao === 'decidir').length
  };
}

/** conferencia.csv: uma linha por cliente, com as linhas do site, os contatos do Google e como foi juntado. */
export function linhasDaConferencia(clientes: ClienteFinal[]): string[][] {
  return [['Referência', 'Nome', 'Linhas do site', 'Contatos do Google', 'Como foi juntado'], ...clientes.map(c => [
    c.referencia, c.site.nome, c.site.linhas.join(', '), c.contatosGoogle.join(', '), c.comoJuntado.join('; ')
  ])];
}

/** Linhas -> CSV para conferir no Excel (para-decidir.csv, conferencia.csv): ";", BOM e protegido contra fórmula. */
export const csvParaConferir = (linhas: string[][]) => escreverCSV(linhas, { protegerFormulas: true });
