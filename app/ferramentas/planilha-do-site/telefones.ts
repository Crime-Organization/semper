// Telefones da planilha do site e do Google Contatos: separar os números de um texto livre e corrigir o formato.
// Porte do script de limpeza usado nos dados reais (telefones.cjs). Regras puras: sem arquivo, sem console.
import { dig, fmtTelefone } from '../../src/regras/pessoa';

/** Um número lido de um texto. */
export interface Lido {
  /** Só os algarismos, já corrigidos (DDD + número); no estrangeiro, o texto como veio. */
  n: string;
  /** O pedaço do texto de onde o número saiu. */
  original: string;
  valido: boolean;
  /** Preenchimento, não é número de ninguém: "(00) 0000-0000", "0", "9999-9999". */
  lixo?: boolean;
  /** Começa com "+" e não é do Brasil. */
  estrangeiro?: boolean;
  /** 0800, 0300, 4004…: não tem DDD. */
  especial?: boolean;
  /** O que foi corrigido ("acrescentado o 9 do celular"…). */
  correcoes: string[];
  /** Por que não é válido (texto para a pessoa ler). */
  problema?: string;
  /** Sem DDD: lerTodos completa com o DDD dos outros números do contato. */
  semDDD?: boolean;
}

/** DDDs que existem no Brasil. */
export const DDDS: ReadonlySet<string> = new Set(('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 '
  + '46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99').split(' '));

/** Algarismos do DDD. */
const DIGITOS_DO_DDD = 2;
/** Número com DDD: fixo (DDD + 8 algarismos) e celular (DDD + 9). */
const FIXO = 10, CELULAR = 11;
const COM_DDD: ReadonlySet<number> = new Set([FIXO, CELULAR]);
/** Sem DDD: 8 algarismos (fixo ou celular antigo) ou 9 (celular). */
const SEM_DDD: ReadonlySet<number> = new Set([FIXO - DIGITOS_DO_DDD, CELULAR - DIGITOS_DO_DDD]);
/** O maior número escrito por inteiro: +55, DDD e celular (13 algarismos). */
const MAIOR_NUMERO = CELULAR + 2;
/** Menos algarismos que isso não é telefone de ninguém ("0", "123"). */
const DIGITOS_MINIMOS = 6;
/** Código do Brasil. */
const BRASIL = '55';
/** Código da operadora (dois algarismos) depois do 0 do interurbano: "0 15 38 99999-0000". */
const DIGITOS_DA_OPERADORA = 2;

/** Onde um texto de telefones se divide em números: ":::" (Google), / , ; | e as palavras "e" e "ou". */
const DIVISORES = /:::|[/,;|]|\s+(?:e|ou)\s+/i;
/** Prefixos que o número completo pode ter antes do DDD ("55", "0", "0" + operadora). */
const PREFIXO_ANTES_DO_DDD = /^(55|0)(?=\d{10,11}$)/;

/**
 * Separa os números de um texto ("(38) 9 9999-9999 / (38) 3222-0000", "+55 38 …", dois números colados por espaço).
 * Devolve cada número como foi escrito.
 */
export function extrair(texto: string | null | undefined): string[] {
  const saida: string[] = [];
  for (const parte of String(texto ?? '').split(DIVISORES)) {
    const pedacos = parte.trim().split(/\s+/).filter(t => /\d/.test(t));
    let acumulado = '', bruto: string[] = [];
    const fechar = () => { if (acumulado) saida.push(bruto.join(' ')); acumulado = ''; bruto = []; };
    for (const t of pedacos) {
      const d = dig(t);
      // Começa um número novo quando o atual já tem DDD + número e o próximo pedaço abre outro, ex.: "(38)".
      if (acumulado.replace(PREFIXO_ANTES_DO_DDD, '').length >= FIXO && (/^[(+]/.test(t) || (acumulado + d).length > MAIOR_NUMERO)) fechar();
      acumulado += d;
      bruto.push(t);
    }
    fechar();
  }
  return saida;
}

/** Algarismos todos iguais ("99999999") ou só zeros depois do +55: preenchimento. */
const REPETIDO = /^(\d)\1+$/;
/** Números especiais, sem DDD: 0800, 0300, 0500, 0900 e 3003/4004…. */
const ESPECIAL = /^0?(800|300|500|900)/;
const ESPECIAL_SEM_ZERO = /^[34]00[0-9]\d{4}$/;
/** O terceiro algarismo de um número com DDD: 6 a 9 é celular; 2 a 5, fixo. */
const COMECO_DE_CELULAR = /[6-9]/, COMECO_DE_FIXO = /[2-5]/;

/** Um tamanho de número com DDD (fixo ou celular) depois de tirar "tirar" algarismos do começo. */
const comDDDSemOsPrimeiros = (d: string, tirar: number) => COM_DDD.has(d.length - tirar);
/** Prefixos tirados antes do DDD, na ordem: o primeiro que vale decide. */
const PREFIXOS: { vale: (d: string) => boolean; tirar: number; correcao?: string }[] = [
  { vale: d => d.startsWith(BRASIL) && comDDDSemOsPrimeiros(d, BRASIL.length) && DDDS.has(d.slice(BRASIL.length, BRASIL.length + DIGITOS_DO_DDD)),
    tirar: BRASIL.length },
  { vale: d => d.startsWith('0') && comDDDSemOsPrimeiros(d, 1), tirar: 1, correcao: 'tirado o 0 antes do DDD' },
  { vale: d => d.startsWith('0') && comDDDSemOsPrimeiros(d, 1 + DIGITOS_DA_OPERADORA), tirar: 1 + DIGITOS_DA_OPERADORA,
    correcao: 'tirado o código da operadora' }
];

/** O número sem o código do Brasil do começo (para ver se o resto é só zeros). */
const SEM_O_BRASIL = new RegExp(`^${BRASIL}`);
/** Número escrito com o "+" do código do Brasil ("+55", "+ 55"). */
const COM_O_BRASIL = new RegExp(`^\\+\\s*${BRASIL}`);
/** Números que não passam pela correção do DDD, na ordem: o primeiro que vale decide (lixo, estrangeiro, especial). */
const SEM_CORRECAO: { vale: (d: string, original: string) => boolean; lido: (d: string, original: string) => Lido }[] = [
  { vale: d => d.length < DIGITOS_MINIMOS || REPETIDO.test(d) || /^0+$/.test(d.replace(SEM_O_BRASIL, '')),
    lido: (d, original) => ({ n: d, original, lixo: true, valido: false, correcoes: [] }) },
  { vale: (_, original) => original.startsWith('+') && !COM_O_BRASIL.test(original),
    lido: (_, original) => ({ n: original, original, estrangeiro: true, valido: true, correcoes: [] }) },
  { vale: d => ESPECIAL.test(d) || ESPECIAL_SEM_ZERO.test(d), lido: (d, original) => ({ n: d, original, especial: true, valido: true, correcoes: [] }) }
];
/** Número com DDD que existe: celular (DDD + 9 + 8 algarismos) ou fixo (DDD + 2 a 5 + 7 algarismos). */
const comDDDValido = (d: string) => DDDS.has(d.slice(0, DIGITOS_DO_DDD))
  && ((d.length === CELULAR && d[DIGITOS_DO_DDD] === '9') || (d.length === FIXO && COMECO_DE_FIXO.test(d[DIGITOS_DO_DDD])));

/** Lê um número. dddPadrao (opcional) completa os números sem DDD. */
export function normalizar(bruto: string, dddPadrao?: string): Lido {
  const original = String(bruto ?? '').trim();
  let d = dig(original);
  const sem = SEM_CORRECAO.find(c => c.vale(d, original));
  if (sem) return sem.lido(d, original);
  const correcoes: string[] = [];
  const prefixo = PREFIXOS.find(p => p.vale(d));
  if (prefixo) {
    d = d.slice(prefixo.tirar);
    if (prefixo.correcao) correcoes.push(prefixo.correcao);
  }
  if (SEM_DDD.has(d.length)) {
    if (!dddPadrao) return { n: d, original, valido: false, correcoes, semDDD: true, problema: 'sem DDD' };
    d = dddPadrao + d;
    correcoes.push(`acrescentado o DDD ${dddPadrao} (o mesmo dos outros números do contato)`);
  }
  if (d.length === FIXO && COMECO_DE_CELULAR.test(d[DIGITOS_DO_DDD])) {
    d = d.slice(0, DIGITOS_DO_DDD) + '9' + d.slice(DIGITOS_DO_DDD);
    correcoes.push('acrescentado o 9 do celular');
  }
  if (comDDDValido(d)) return { n: d, original, valido: true, correcoes };
  return {
    n: d, original, valido: false, correcoes,
    problema: d.length >= FIXO && !DDDS.has(d.slice(0, DIGITOS_DO_DDD)) ? 'DDD inexistente' : 'número incompleto ou com dígitos a mais'
  };
}

/** No formato do SEMPER, "(38) 99999-0000"; estrangeiro, especial ou inválido fica como veio. */
export const formatar = (t: Lido) => t.valido && !t.estrangeiro && !t.especial ? fmtTelefone(t.n) : t.original;

/** Chave para comparar números entre as planilhas (null: não serve para comparar). */
export const chave = (t: Lido) => t.valido && !t.estrangeiro ? t.n : null;

/** Lê todos os números de um contato: primeiro os que têm DDD; depois completa os sem DDD com o DDD dos outros. */
export function lerTodos(brutos: string[]): Lido[] {
  const lidos = brutos.map(b => normalizar(b));
  const ddd = lidos.find(t => t.valido && !t.estrangeiro && !t.especial)?.n.slice(0, DIGITOS_DO_DDD);
  return lidos.map((t, i) => t.semDDD && ddd ? normalizar(brutos[i], ddd) : t);
}
