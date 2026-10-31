// Regras de cadastro de pessoas: listas do formulário, formatos, validação e qualificação.
// Não depende do banco: serve ao formulário, ao cartão e às listagens.
import type { DadosPessoa, TipoPessoa } from '../dados/tipos';

export const TIPOS: Record<TipoPessoa, string> = { pf: 'Pessoa física', pj: 'Pessoa jurídica', contato: 'Somente contato' };

export const NATUREZAS: Record<string, string> = {
  empresarial: 'Entidades empresariais',
  publica: 'Administração pública',
  sem_fins: 'Entidades sem fins lucrativos'
};

// Tipos de entidade conforme a tabela de naturezas jurídicas da Receita (iguais ao formulário do site).
export const ENTIDADES: Record<string, string[]> = {
  empresarial: ['Clube/Fundo de Investimento', 'Consórcio de Empregadores', 'Consórcio de Sociedades', 'Consórcio Simples',
    'Cooperativa', 'Cooperativas de Consumo', 'Empresa Binacional', 'Empresa Domiciliada no Exterior',
    'Empresa Individual de Responsabilidade Limitada (de Natureza Empresária)',
    'Empresa Individual de Responsabilidade Limitada (de Natureza Simples)', 'Empresa Pública',
    'Empresa Simples de Inovação', 'Empresário(a) Individual',
    'Estabelecimento, no Brasil, de Empresa Binacional Argentino-Brasileira',
    'Estabelecimento, no Brasil, de Sociedade Estrangeira', 'Grupo de Sociedades',
    'Microempreendedor(a) Individual (MEI)', 'Investidor Não Residente', 'Sociedade Anônima Aberta',
    'Sociedade Anônima Fechada', 'Sociedade de Economia Mista', 'Sociedade em Conta de Participação',
    'Sociedade Empresária em Comandita por Ações', 'Sociedade Empresária em Comandita Simples',
    'Sociedade Empresária em Nome Coletivo', 'Sociedade Empresária Limitada', 'Sociedade Simples em Comandita Simples',
    'Sociedade Simples em Nome Coletivo', 'Sociedade Simples Limitada', 'Sociedade Simples Pura',
    'Sociedade Unipessoal de Advogados'],
  publica: ['Autarquia Estadual ou do Distrito Federal', 'Autarquia Federal', 'Autarquia Municipal', 'Comissão Polinacional',
    'Consórcio Público de Direito Privado', 'Consórcio Público de Direito Público (Associação Pública)',
    'Estado ou Distrito Federal', 'Fundação Pública de Direito Privado Estadual ou do Distrito Federal',
    'Fundação Pública de Direito Privado Federal', 'Fundação Pública de Direito Privado Municipal',
    'Fundação Pública de Direito Público Estadual ou do Distrito Federal', 'Fundação Pública de Direito Público Federal',
    'Fundação Pública de Direito Público Municipal', 'Fundo Público da Administração Direta Estadual ou do Distrito Federal',
    'Fundo Público da Administração Direta Federal', 'Fundo Público da Administração Direta Municipal',
    'Fundo Público da Administração Indireta Estadual ou do Distrito Federal', 'Fundo Público da Administração Indireta Federal',
    'Fundo Público da Administração Indireta Municipal', 'Município', 'Órgão Público Autônomo Estadual ou do Distrito Federal',
    'Órgão Público Autônomo Federal', 'Órgão Público Autônomo Municipal',
    'Órgão Público do Poder Executivo Estadual ou do Distrito Federal', 'Órgão Público do Poder Executivo Federal',
    'Órgão Público do Poder Executivo Municipal', 'Órgão Público do Poder Judiciário Estadual',
    'Órgão Público do Poder Judiciário Federal', 'Órgão Público do Poder Legislativo Estadual ou do Distrito Federal',
    'Órgão Público do Poder Legislativo Federal', 'Órgão Público do Poder Legislativo Municipal', 'União'],
  sem_fins: ['Associação Privada', 'Comissão de Conciliação Prévia', 'Comitê Financeiro de Partido Político', 'Comunidade Indígena',
    'Condomínio Edilício', 'Demais Condomínios', 'Entidade de Mediação e Arbitragem', 'Entidade Sindical',
    'Estabelecimento, no Brasil, de Fundação ou Associação Estrangeiras', 'Frente Plebiscitária ou Referendária',
    'Fundação ou Associação Domiciliada no Exterior', 'Fundação Privada', 'Fundo Privado', 'Organização Religiosa',
    'Organização Social (OS)', 'Órgão de Direção Local de Partido Político', 'Órgão de Direção Nacional de Partido Político',
    'Órgão de Direção Regional de Partido Político', 'Plano de Benefícios de Previdência Complementar Fechada',
    'Serviço Notarial e Registral (Cartório)', 'Serviço Social Autônomo', 'Candidato a Cargo Político Eletivo']
};

export const PORTES: Record<string, string> = { me: 'Microempresa', epp: 'Empresa de pequeno porte', medio: 'Empresa de médio porte', grande: 'Empresa de grande porte' };

// [masculino, feminino, sem gênero informado]
export const ESTADO_CIVIL: Record<string, [string, string, string]> = {
  solteiro: ['solteiro', 'solteira', 'solteiro(a)'],
  uniao_estavel: ['em união estável', 'em união estável', 'em união estável'],
  casado: ['casado', 'casada', 'casado(a)'],
  separado: ['separado', 'separada', 'separado(a)'],
  divorciado: ['divorciado', 'divorciada', 'divorciado(a)'],
  viuvo: ['viúvo', 'viúva', 'viúvo(a)']
};

export const LGPD: Record<string, string> = {
  contrato: 'Execução de contrato ou procedimentos preliminares (art. 7º, V)',
  processo: 'Exercício regular de direitos em processo (art. 7º, VI)',
  consentimento: 'Consentimento do titular (art. 7º, I)',
  obrigacao_legal: 'Cumprimento de obrigação legal (art. 7º, II)',
  legitimo_interesse: 'Legítimo interesse (art. 7º, IX)'
};

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

// Rótulos dos campos (usados no histórico de alterações).
export const CAMPOS: Record<string, string> = {
  tipo: 'Tipo de cadastro', nome: 'Nome', genero: 'Gênero', nacionalidade: 'Nacionalidade', profissao: 'Profissão',
  estado_civil: 'Estado civil', rg: 'RG', rg_expedicao: 'Expedição do RG', nome_mae: 'Nome da mãe', nome_pai: 'Nome do pai',
  nascimento: 'Data de nascimento', nascimento_municipio: 'Município de nascimento', nascimento_uf: 'UF de nascimento',
  natureza: 'Natureza jurídica', tipo_entidade: 'Tipo de entidade', nome_fantasia: 'Nome fantasia', porte: 'Porte',
  abertura: 'Data de abertura', representantes: 'Representante(s) legal(is)', documento: 'CPF/CNPJ', cep: 'CEP',
  logradouro: 'Logradouro', numero: 'Número', complemento: 'Complemento', bairro: 'Bairro', municipio: 'Município',
  uf: 'UF', telefones: 'Telefones', emails: 'E-mails', lgpd_base: 'Base legal (LGPD)',
  lgpd_consentimento: 'Data do consentimento', etapa: 'Etapa do atendimento', arquivado_em: 'Arquivamento', vinculo: 'Vínculo'
};

// ---------- formatos ----------
type Texto = string | number | null | undefined;
export const dig = (v: Texto) => String(v ?? '').replace(/\D/g, '');
/**
 * CPF ou CNPJ só com letras e números, em maiúsculas. Desde julho de 2026 a Receita emite CNPJ com letras nos 12
 * primeiros caracteres (CNPJ alfanumérico); por isso o documento não pode passar pelo dig(), que apaga as letras.
 */
export const limparDocumento = (v: Texto) => String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
/** CNPJ completo: 12 letras ou números e os 2 dígitos verificadores (sempre números). */
const FORMATO_CNPJ = /^[0-9A-Z]{12}[0-9]{2}$/;
/** Um CNPJ (com ou sem máscara) dentro de um texto maior, como "CNPJ nº 12.ABC.345/01DE-35" colado de um documento. */
const CNPJ_NO_TEXTO = /[0-9A-Za-z]{2}\.?[0-9A-Za-z]{3}\.?[0-9A-Za-z]{3}\/?[0-9A-Za-z]{4}-?\d{2}/;
/** O começo de um CNPJ digitado com a máscara (12.ABC, 12.ABC.345/01DE…), para a busca achar enquanto se digita. */
const CNPJ_MASCARADO_PARCIAL = /^[0-9A-Za-z]{2}\.[0-9A-Za-z]{1,3}(\.[0-9A-Za-z]{0,3}(\/[0-9A-Za-z]{0,4}(-\d{0,2})?)?)?$/;
export const fmtCPF = (v: Texto) => { const d = dig(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : String(v ?? ''); };
export const fmtCNPJ = (v: Texto) => {
  const d = limparDocumento(v);
  return FORMATO_CNPJ.test(d) ? d.replace(/(\w{2})(\w{3})(\w{3})(\w{4})(\d{2})/, '$1.$2.$3/$4-$5') : String(v ?? '');
};
export const fmtDocumento = (v: Texto) => { const d = limparDocumento(v); return d.length === 14 ? fmtCNPJ(d) : /^\d{11}$/.test(d) ? fmtCPF(d) : String(v ?? ''); };
export const fmtCEP = (v: Texto) => { const d = dig(v); return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : String(v ?? ''); };
// Tira o código do Brasil (+55) de um número só com dígitos, quando ele vem com DDD e número completos.
const sem55 = (d: string) => (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d;
// Celular antigo, de 8 dígitos (começa com 6 a 9), ganha o 9 da frente: (16) 8201-0240 -> (16) 98201-0240.
// Também tira o +55 e o 0 antes do DDD.
export const celularCompleto = (v: Texto) => {
  const digitos = dig(v);
  let d = sem55(digitos);
  if (d === digitos && (d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 && /[6-9]/.test(d[2]) ? d.slice(0, 2) + '9' + d.slice(2) : d;
};
export function fmtTelefone(v: Texto) {
  const d = celularCompleto(v);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return String(v ?? '').trim();
}
/** O número foi digitado sem o 9 do celular (vai ser salvo com ele). */
export const faltaNoveCelular = (v: Texto) => { const d = dig(v).replace(/^(55|0)(?=\d{10}$)/, ''); return d.length === 10 && /[6-9]/.test(d[2]); };
export const telefoneNormal = (v: Texto) => sem55(dig(v));
/** Para achar cadastro repetido: o número com e sem o 9 do celular (cadastros antigos podem estar sem ele). */
export function variantesTelefone(v: Texto) {
  const d = celularCompleto(v);
  return d.length === 11 && d[2] === '9' && /[6-9]/.test(d[3]) ? [d, d.slice(0, 2) + d.slice(3)] : [d];
}
export const fmtData = (iso: Texto) => { if (!iso) return ''; const [a, m, d] = String(iso).slice(0, 10).split('-'); return d && m && a ? `${d}/${m}/${a}` : ''; };
// "dd/mm/aaaa" -> "aaaa-mm-dd" (ou null se vazia; lança erro se inválida)
export function lerData(txt: Texto) {
  const t = String(txt ?? '').trim();
  if (!t) return null;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw new Error('Use o formato DD/MM/AAAA.');
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const data = new Date(Date.UTC(a, mes - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== d || a < 1850 || a > 2200) {
    throw new Error('Data inexistente.');
  }
  return `${String(a).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Máscaras enquanto digita
export type Mascara = 'cpf' | 'cnpj' | 'cep' | 'data' | 'telefone';
export const MASCARAS: Record<Mascara, (v: string) => string> = {
  cpf: v => { const d = dig(v).slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); },
  // Letras e números (CNPJ alfanumérico), em maiúsculas; os dois últimos (dígitos verificadores) são sempre números.
  // Um CNPJ colado com rótulo ("CNPJ: 12.ABC…") fica só com o número; os dois últimos (verificadores) só aceitam números.
  cnpj: v => {
    const t = String(v ?? '').match(CNPJ_NO_TEXTO)?.[0] ?? v;
    const limpo = limparDocumento(t).slice(0, 14), d = limpo.slice(0, 12) + limpo.slice(12).replace(/\D/g, '');
    return d.replace(/^(\w{2})(\w)/, '$1.$2').replace(/^(\w{2})\.(\w{3})(\w)/, '$1.$2.$3').replace(/\.(\w{3})(\w)/, '.$1/$2').replace(/(\w{4})(\w)/, '$1-$2');
  },
  cep: v => dig(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'),
  data: v => dig(v).slice(0, 8).replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2'),
  telefone: v => {
    const d = dig(v).slice(0, 11);
    return d.length <= 10 ? d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
      : d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  }
};

// ---------- validação ----------
export function cpfValido(v: Texto) {
  const d = dig(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
/** Valor de cada caractere no cálculo do dígito verificador do CNPJ: o código ASCII menos 48 (0 a 9 valem 0 a 9; A vale 17… Z vale 42). */
const valorNoCNPJ = (c: string) => c.charCodeAt(0) - '0'.charCodeAt(0);
/** CNPJ só com números ou com letras (CNPJ alfanumérico): os mesmos pesos, com o valor de cada caractere. */
export function cnpjValido(v: Texto) {
  const d = limparDocumento(v);
  if (!FORMATO_CNPJ.test(d) || /^(.)\1{13}$/.test(d)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((t, p, i) => t + valorNoCNPJ(d[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
/**
 * Na busca: um CNPJ com letras digitado com ou sem a máscara (12.ABC.345/01DE-35) vira o texto que o banco guarda na busca
 * (minúsculo, sem pontuação). Só vale sem espaços e com os dígitos verificadores certos: um nome como "CONTRATO 1A2B34"
 * (14 letras e números, tirando o espaço) continua sendo buscado como texto. Devolve null nos outros casos.
 */
export function cnpjComLetrasNaBusca(texto: Texto) {
  const t = String(texto ?? '').trim(), d = limparDocumento(t);
  if (!/[A-Z]/.test(d)) return null;
  // O pedaço digitado com a máscara (12.ABC.345) também vale: a busca do banco guarda o documento sem pontuação.
  return CNPJ_MASCARADO_PARCIAL.test(t) || (/^[0-9A-Za-z.\-/]+$/.test(t) && cnpjValido(d)) ? d.toLowerCase() : null;
}
export const emailValido = (v: Texto) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v ?? '').trim());

// ---------- texto ----------
type Qualificavel = DadosPessoa & { nome?: string | null };
const espacos = (t: Texto) => String(t ?? '').replace(/\s+/g, ' ').trim();
// "Sociedade Empresária Limitada" -> "sociedade empresária limitada" (mantém siglas como MEI); tudo em maiúsculas vira minúsculas.
const minusculas = (t: Texto) => {
  const s = espacos(t);
  if (s === s.toUpperCase()) return s.toLowerCase();
  return s.split(' ').map(w => (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) ? w : w.toLowerCase()).join(' ');
};
const listaE = (itens: string[]) => itens.length <= 1 ? (itens[0] || '') : itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];

// Endereço e cidade digitados todos em maiúsculas (ou minúsculas) saem como nome próprio: "RUA DAS FLORES" -> "Rua das Flores".
// O que veio com maiúsculas e minúsculas fica como foi digitado. Números romanos e trechos com algarismos ("BR-251") ficam em maiúsculas.
const PEQUENAS = new Set(['a', 'à', 'ao', 'as', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'o', 'os']);
const ROMANO = /^(?=[ivxlcdm]{2,}$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
export function nomeProprio(t: Texto) {
  const s = espacos(t);
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s.toLowerCase().split(' ').map((w, i) => {
    if (/\d/.test(w) || ROMANO.test(w)) return w.toUpperCase();
    if (i > 0 && PEQUENAS.has(w)) return w;
    return w.replace(/(^|[-/('’.])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toUpperCase());
  }).join(' ');
}

/** Empresário individual e MEI: a pessoa jurídica é a própria pessoa, e o texto concorda com o gênero dela. */
export const ehIndividual = (tipoEntidade: Texto) => /^(Microempreendedor\(a\) Individual \(MEI\)|Empresári[oa](\(a\))? Individual)$/i.test(espacos(tipoEntidade));

// Concordância como na planilha do escritório: com o gênero informado, "o(a)" e "(a)" viram a forma certa, inclusive no que
// foi digitado ("agricultor(a)", "Empresário(a) Individual"). Sem gênero, o texto fica com "(a)".
function flexionar(texto: string, g: string | null | undefined) {
  if (g === 'f') return texto.replace(/o\(a\)/g, 'a').replace(/\(a\)/g, 'a');
  if (g === 'm') return texto.replace(/o\(a\)/g, 'o').replace(/\(a\)/g, '');
  return texto;
}

function nacionalidade(p: Qualificavel) {
  const n = espacos(p.nacionalidade);
  if (!n) return '';
  return /^brasileir/i.test(n) ? 'brasileiro(a)' : n.toLowerCase();
}

// "Rua das Flores, nº 10, Apto 201, bairro Centro, em Montes Claros/MG, CEP 39400-121". Devolve também como ligar ao
// texto anterior: "na Rua…", "no Sítio…" ou, sem logradouro, direto "em Montes Claros/MG".
const MASCULINOS = /^(s[ií]tio|povoado|distrito|assentamento|c[oó]rrego|beco|largo|loteamento|conjunto|condom[ií]nio|parque|residencial|n[uú]cleo|setor|trevo|viaduto|acampamento|lugar|km|quil[oô]metro|bairro|morro|alto|retiro|engenho|lote|ramal|caminho|p[aá]tio)\b/i;
function endereco(p: Qualificavel) {
  if (!p.logradouro && !p.municipio) return null;
  const partes: string[] = [];
  const logradouro = nomeProprio(p.logradouro);
  if (logradouro) partes.push(logradouro + (p.numero ? `, nº ${espacos(p.numero)}` : ''));
  if (p.complemento) partes.push(nomeProprio(p.complemento));
  if (p.bairro) partes.push(`bairro ${nomeProprio(p.bairro)}`);
  if (p.municipio) partes.push(`em ${nomeProprio(p.municipio)}${p.uf ? '/' + espacos(p.uf).toUpperCase() : ''}`);
  if (p.cep) partes.push(`CEP ${fmtCEP(p.cep)}`);
  return { texto: partes.join(', '), artigo: !logradouro ? '' : MASCULINOS.test(logradouro) ? 'no ' : 'na ' };
}

// "endereço eletrônico maria@exemplo.com, telefone (38) 99999-1234" (endereço eletrônico, como no art. 319, II, do CPC).
function contatos(p: Qualificavel) {
  const partes: string[] = [];
  const emails = (p.emails || []).map(e => espacos(e).toLowerCase()).filter(Boolean);
  const tels = (p.telefones || []).filter(Boolean).map(fmtTelefone);
  if (emails.length) partes.push((emails.length > 1 ? 'endereços eletrônicos ' : 'endereço eletrônico ') + listaE(emails));
  if (tels.length) partes.push((tels.length > 1 ? 'telefones ' : 'telefone ') + listaE(tels));
  return partes.join(', ');
}

/** Representante vinculado à pessoa jurídica (vínculo "Representante legal de"), com a função escrita no vínculo. */
export interface Representante { pessoa: Qualificavel; funcao?: string | null }
export const TIPO_REPRESENTANTE = 'Representante legal de';

// Fim da qualificação da pessoa jurídica: "neste ato representada por sua sócia administradora, FULANA, brasileira, …".
// Com representante vinculado, entra a qualificação dele (sem os contatos); sem vínculo, só os nomes do cadastro.
function representacao(p: Qualificavel, individual: boolean, vinculados: Representante[]) {
  const quem = vinculados.length
    ? vinculados.map(({ pessoa, funcao }) => {
      const texto = qualificacao(pessoa, { paraRepresentar: true });
      const f = minusculas(funcao);
      return f ? `${pessoa.genero === 'f' ? 'sua' : pessoa.genero === 'm' ? 'seu' : 'seu(sua)'} ${f}, ${texto}` : texto;
    }).filter(Boolean).join(', e por ')
    : espacos(p.representantes).split(/\s+e\/ou\s+/i).map(n => n.toUpperCase()).filter(Boolean).join(' e/ou ');
  if (!quem) return '';
  return `neste ato ${individual ? flexionar('representado(a)', p.genero) : 'representada'} por ${quem}`;
}

interface OpcoesQualificacao {
  /** Representantes vinculados (pessoas cadastradas); sem eles, vale o campo de representantes. */
  representantes?: Representante[];
  /** Qualificação de quem representa outra pessoa: sem contatos e sem a própria representação. */
  paraRepresentar?: boolean;
}

// Qualificação no modelo das peças do escritório (o mesmo da planilha do site), gerada a partir do cadastro.
// Sociedades, associações e entes públicos concordam no feminino ("inscrita", "representada"); pessoa física,
// MEI e empresário individual concordam com o gênero da pessoa. A representação fica no fim.
export function qualificacao(p: Qualificavel | null | undefined, opcoes: OpcoesQualificacao = {}): string {
  if (!p || !p.nome || (p.tipo !== 'pf' && p.tipo !== 'pj')) return '';
  const partes = [espacos(p.nome).toUpperCase()];
  const end = endereco(p);
  const individual = p.tipo === 'pj' && ehIndividual(p.tipo_entidade);
  if (p.tipo === 'pf') {
    if (nacionalidade(p)) partes.push(nacionalidade(p));
    if (p.profissao) partes.push(minusculas(p.profissao));
    if (p.estado_civil && ESTADO_CIVIL[p.estado_civil]) partes.push(ESTADO_CIVIL[p.estado_civil][2]);
    if (p.documento) partes.push(`inscrito(a) no CPF sob o nº ${fmtCPF(p.documento)}`);
    if (p.rg) partes.push(`com RG nº ${espacos(p.rg)}` + (p.rg_expedicao ? `, expedida em ${fmtData(p.rg_expedicao)}` : ''));
    const pais = [p.nome_mae, p.nome_pai].map(n => espacos(n).toUpperCase()).filter(Boolean);
    if (pais.length) partes.push(`filho(a) de ${pais.join(' e de ')}`);
    if (p.nascimento) partes.push(`nascido(a) em ${fmtData(p.nascimento)}`);
    if (p.nascimento_municipio) partes.push(`natural de ${nomeProprio(p.nascimento_municipio)}${p.nascimento_uf ? '/' + espacos(p.nascimento_uf).toUpperCase() : ''}`);
    if (end) partes.push(`residente e domiciliado(a) ${end.artigo}${end.texto}`);
  } else {
    if (p.natureza === 'publica') partes.push('pessoa jurídica de direito público');
    else if (p.tipo_entidade) partes.push(minusculas(p.tipo_entidade) + (p.natureza === 'sem_fins' ? ' sem fins lucrativos' : ''));
    if (p.documento) partes.push(`${individual ? 'inscrito(a)' : 'inscrita'} no CNPJ sob o nº ${fmtCNPJ(p.documento)}`);
    if (p.nome_fantasia) partes.push(`com título do estabelecimento ${espacos(p.nome_fantasia).toUpperCase()}`);
    if (p.porte && PORTES[p.porte]) partes.push(`com porte de ${PORTES[p.porte].toLowerCase()}`);
    if (end) partes.push(`${individual ? 'com endereço profissional' : 'com sede'} ${end.artigo}${end.texto}`);
  }
  if (!opcoes.paraRepresentar) {
    const cont = contatos(p);
    if (cont) partes.push(cont);
  }
  // Campo digitado com vírgula no fim ("Rua X,") não vira ",,".
  let texto = partes.join(', ').replace(/\s+,/g, ',').replace(/,(\s*,)+/g, ',');
  if (p.tipo === 'pf' || individual) texto = flexionar(texto, p.genero);
  const rep = p.tipo === 'pj' && !opcoes.paraRepresentar ? representacao(p, individual, opcoes.representantes || []) : '';
  return rep ? `${texto}, ${rep}` : texto;
}

// ---------- consulta de CNPJ (publica.cnpj.ws) ----------
const ALIAS_NATUREZA: Record<string, string> = {
  'Empresário (Individual)': 'Empresário(a) Individual',
  'Empresa Simples de Inovação - Inova Simples': 'Empresa Simples de Inovação'
};
const REPRESENTANTES = ['Administrador', 'Diretor', 'Presidente', 'Sócio-Administrador', 'Sócio Ostensivo', 'Sócio Comanditado',
  'Titular Pessoa Física Residente ou Domiciliado no Brasil', 'Produtor Rural', 'Conselheiro de Administração',
  'Administrador Residente ou Domiciliado no Exterior', 'Diretor Residente ou Domiciliado no Exterior',
  'Presidente Residente ou Domiciliado no Exterior', 'Sócio-Administrador Residente ou Domiciliado no Exterior',
  'Sócio Comanditado Residente no Exterior', 'Conselheiro de Administração Residente ou Domiciliado no Exterior',
  'Titular Pessoa Física Residente ou Domiciliado no Exterior'];

export interface DadosCNPJ {
  nome: string; nome_fantasia: string; natureza: string | null; tipo_entidade: string; porte: string | null;
  abertura: string | null; representantes: string; cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; municipio: string; uf: string; telefones: string[]; emails: string[];
}

// Resposta da API (só os campos usados).
export interface RespostaCNPJws {
  razao_social?: string;
  natureza_juridica?: { descricao?: string };
  porte?: { descricao?: string };
  simples?: { mei?: string; simples?: string };
  socios?: { nome?: string; qualificacao_socio?: { descricao?: string } }[];
  estabelecimento?: {
    nome_fantasia?: string; data_inicio_atividade?: string; cep?: string; tipo_logradouro?: string; logradouro?: string;
    numero?: string; complemento?: string; bairro?: string; cidade?: { nome?: string }; estado?: { sigla?: string };
    ddd1?: string; telefone1?: string; ddd2?: string; telefone2?: string; email?: string;
  };
}

// Converte a resposta da API em campos do cadastro.
export function deCNPJws(data: RespostaCNPJws): DadosCNPJ {
  const est = data.estabelecimento || {};
  let tipoEnt = String(data.natureza_juridica?.descricao || '').replace(/^\d{1,3}-\d\s*-\s*/, '').trim();
  tipoEnt = ALIAS_NATUREZA[tipoEnt] || tipoEnt;
  if (tipoEnt === 'Empresário(a) Individual' && (data.simples?.mei === 'Sim')) tipoEnt = 'Microempreendedor(a) Individual (MEI)';
  const natureza = Object.keys(ENTIDADES).find(k => ENTIDADES[k].includes(tipoEnt)) || null;
  const porteApi = String(data.porte?.descricao || '').toLowerCase();
  let porte = porteApi.includes('micro') ? 'me' : porteApi.includes('pequeno') ? 'epp' : porteApi.includes('médio') || porteApi.includes('medio') ? 'medio' : porteApi.includes('grande') ? 'grande' : null;
  if (!porte && tipoEnt !== 'Microempreendedor(a) Individual (MEI)' && (data.simples?.simples === 'Sim')) porte = 'me';
  const representantes = (data.socios || [])
    .filter(s => REPRESENTANTES.includes(String(s.qualificacao_socio?.descricao || '').trim()))
    .map(s => String(s.nome || '').toUpperCase()).filter(Boolean);
  const telefones = [[est.ddd1, est.telefone1], [est.ddd2, est.telefone2]].filter(([d, t]) => d && t).map(([d, t]) => fmtTelefone(`${d}${t}`));
  return {
    nome: String(data.razao_social || '').toUpperCase(),
    nome_fantasia: est.nome_fantasia ? String(est.nome_fantasia).toUpperCase() : '',
    natureza, tipo_entidade: natureza ? tipoEnt : '',
    porte,
    abertura: est.data_inicio_atividade || null,
    representantes: representantes.join(' e/ou '),
    cep: dig(est.cep), logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' '),
    numero: est.numero || '', complemento: est.complemento ? String(est.complemento).replace(/\s+/g, ' ').trim() : '',
    bairro: est.bairro || '', municipio: est.cidade?.nome || '', uf: est.estado?.sigla || '',
    telefones, emails: est.email ? [String(est.email).toLowerCase()] : []
  };
}

// CEP: endereço no formato do cadastro, a partir da BrasilAPI (principal) ou do ViaCEP (reserva).
export interface EnderecoCEP { logradouro: string; bairro: string; municipio: string; uf: string }
export interface RespostaBrasilAPI { street?: string; neighborhood?: string; city?: string; state?: string }
export interface RespostaViaCEP { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean | string }
export const deBrasilAPI = (x: RespostaBrasilAPI): EnderecoCEP =>
  ({ logradouro: x.street || '', bairro: x.neighborhood || '', municipio: x.city || '', uf: x.state || '' });
export const deViaCEP = (x: RespostaViaCEP): EnderecoCEP =>
  ({ logradouro: x.logradouro || '', bairro: x.bairro || '', municipio: x.localidade || '', uf: x.uf || '' });

// Como cada campo aparece no histórico e no cartão. Campo novo com formato próprio é uma linha nova aqui;
// os demais aparecem como foram gravados (listas separadas por vírgula).
const LEGIVEL: Record<string, (s: string, v: unknown) => string> = {
  tipo: s => TIPOS[s as TipoPessoa] || s,
  genero: s => s === 'm' ? 'Masculino' : s === 'f' ? 'Feminino' : s,
  estado_civil: s => ESTADO_CIVIL[s]?.[2] || s,
  natureza: s => NATUREZAS[s] || s,
  porte: s => PORTES[s] || s,
  lgpd_base: s => LGPD[s] || s,
  documento: fmtDocumento,
  cep: fmtCEP,
  telefones: (s, v) => Array.isArray(v) ? v.map(fmtTelefone).join(', ') : s,
  arquivado_em: () => 'Arquivado',
  rg_expedicao: fmtData, nascimento: fmtData, abertura: fmtData, lgpd_consentimento: fmtData
};

export function valorLegivel(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return '—';
  const s = String(v);
  const formatar = LEGIVEL[campo];
  if (formatar) return formatar(s, v);
  return Array.isArray(v) ? v.join(', ') : s;
}
