// A primeira sincronização com o Google Contatos (#164, etapa 2): quais contatos que JÁ estão na conta Google do escritório
// são pessoas do SEMPER. Os certos são ligados à pessoa (em vez de o SEMPER criar uma cópia); os duvidosos vão para a lista
// "Para conferir" em Configurações, onde o administrador decide. Puro (sem rede, sem banco): usado pela função do servidor
// google-sincronizar e pelo banco fictício, e testado em app/src/regras/correspondenciaDeContatos.test.ts.
//
// As regras seguem as do cadastro repetido do SEMPER:
//   - telefone e nome juntos ligam; e-mail e nome juntos também;
//   - e-mail sozinho NUNCA liga nem sugere (a contabilidade põe o mesmo e-mail em várias empresas);
//   - o mesmo telefone com outro nome (um parente, a empresa da pessoa) é duvidoso: vai para conferir;
//   - só o nome igual é duvidoso (homônimos); com o mesmo aniversário, liga; com aniversário diferente, são pessoas diferentes;
//   - mais de uma pessoa possível, ou um contato repetido no Google para a mesma pessoa: conferir.

/** A marca do SEMPER no contato (o id da pessoa, em clientData): o contato que o SEMPER criou é dela, sem dúvida. */
export const MARCA_DO_SEMPER = 'semper_pessoa';

/** Um contato da conta Google, como people.connections.list devolve (só os campos que a correspondência usa). */
export interface ContatoDaConta {
  resourceName: string;
  etag?: string;
  names?: { displayName?: string; unstructuredName?: string; givenName?: string; familyName?: string }[];
  phoneNumbers?: { value?: string; canonicalForm?: string }[];
  emailAddresses?: { value?: string }[];
  birthdays?: { date?: { year?: number; month?: number; day?: number } }[];
  clientData?: { key?: string; value?: string }[];
  metadata?: { deleted?: boolean };
}

/** Uma pessoa do escritório, com o contato já ligado a ela nesta conta Google (`recurso`), se houver. */
export interface PessoaDoEscritorio {
  id: string;
  tipo: 'pf' | 'pj' | 'contato';
  nome: string;
  telefones: string[] | null;
  emails: string[] | null;
  nascimento: string | null;
  abertura: string | null;
  recurso: string | null;
}

/**
 * Por que o contato ficou para conferir: mais de uma pessoa possível; só o nome bate; o telefone (ou o aniversário) não
 * combina com o resto; ou a pessoa já tem outro contato no Google (o contato está repetido lá).
 */
export type MotivoParaConferir = 'varios' | 'so-nome' | 'conflito' | 'repetido';

export interface LigacaoCerta { pessoa_id: string; recurso: string; etag: string | null }
export interface ContatoParaConferir {
  recurso: string;
  etag: string | null;
  nome: string | null;
  telefones: string[];
  emails: string[];
  /** "aaaa-mm-dd", ou "mm-dd" quando o Google não tem o ano. */
  aniversario: string | null;
  motivo: MotivoParaConferir;
  /** As pessoas do SEMPER que podem ser este contato (a mais provável primeiro). */
  candidatos: string[];
}
export interface Correspondencia {
  ligar: LigacaoCerta[];
  conferir: ContatoParaConferir[];
  /** Contatos da conta que não são de ninguém do SEMPER: ficam no Google como estão. */
  semCorrespondencia: number;
}

// Os tamanhos que o banco aceita na lista para conferir (supabase/migrations/*_contatos_google_primeira.sql): mudou aqui,
// muda a migração também.
/** O nome do contato guardado para conferir. */
export const TAMANHO_DO_NOME_PARA_CONFERIR = 200;
/** Quantos telefones e e-mails do contato vão para a lista (o resto não ajuda a decidir). */
export const DADOS_PARA_CONFERIR = 10;
/** Quantas pessoas possíveis um contato mostra, no máximo. */
export const CANDIDATOS_PARA_CONFERIR = 20;
/** O tamanho de um telefone ou e-mail guardado para conferir. */
export const TAMANHO_DO_DADO_PARA_CONFERIR = 254;

// ---------------------------------------------------------------------
// Como cada dado é comparado
// ---------------------------------------------------------------------

const so = (v: string) => v.replace(/\D/g, '');
/** Um número brasileiro tem DDD e 8 ou 9 dígitos: menos que isso não serve para dizer quem é quem. */
const DIGITOS_DO_TELEFONE = [10, 11];

/** O número sem o 55 do Brasil e sem o 0 antes do DDD, com o 9 nos celulares antigos de 8 dígitos (como celularCompleto em app/src/regras/pessoa.ts). */
export function telefoneNacional(v: string) {
  const digitos = so(v);
  let d = (digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (d === digitos && (d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 && /[6-9]/.test(d[2]) ? d.slice(0, 2) + '9' + d.slice(2) : d;
}

/** O telefone para comparar: o número nacional (com DDD); de fora do Brasil, "+" e os dígitos; curto demais, nada. */
export function telefoneComparavel(v: string | null | undefined) {
  const original = String(v ?? '').trim();
  if (/^\+/.test(original) && !/^\+\s*55/.test(original)) return so(original).length >= DIGITOS_DO_TELEFONE[0] ? '+' + so(original) : null;
  const d = telefoneNacional(original);
  return DIGITOS_DO_TELEFONE.includes(d.length) ? d : null;
}

/** O e-mail para comparar: sem espaços e em minúsculas. */
export const emailComparavel = (v: string | null | undefined) => {
  const e = String(v ?? '').trim().toLowerCase();
  return e.includes('@') ? e : null;
};

/** As palavras que não ajudam a dizer quem é quem num nome. */
const LIGACOES_DO_NOME = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);

/** O nome para comparar: sem acento, em maiúsculas, sem pontuação e sem espaços repetidos. */
export function nomeComparavel(v: string | null | undefined) {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
const palavras = (nome: string) => nome.split(' ').filter(p => p && !LIGACOES_DO_NOME.has(p));

/** Como dois nomes (já comparáveis) se parecem: iguais, um contido no outro (todas as palavras do menor estão no maior), ou nada. */
export function semelhancaDoNome(a: string, b: string): 'igual' | 'contido' | null {
  if (!a || !b) return null;
  if (a === b) return 'igual';
  const [menor, maior] = [palavras(a), palavras(b)].sort((x, y) => x.length - y.length);
  if (!menor.length) return null;
  const doMaior = new Set(maior);
  return menor.every(p => doMaior.has(p)) ? 'contido' : null;
}
/** Um nome de uma palavra só ("MARIA") não basta sozinho para sugerir ninguém. */
const nomeCompleto = (nome: string) => palavras(nome).length >= 2;

/** O nome que o contato mostra no Google. */
function nomeDoContato(c: ContatoDaConta) {
  const n = c.names?.[0];
  if (!n) return null;
  return (n.displayName || n.unstructuredName || [n.givenName, n.familyName].filter(Boolean).join(' ')).trim() || null;
}

/** O aniversário do contato: "aaaa-mm-dd", ou "mm-dd" sem o ano. */
function aniversarioDoContato(c: ContatoDaConta) {
  const d = c.birthdays?.find(b => b.date?.month && b.date?.day)?.date;
  if (!d?.month || !d.day) return null;
  const mmdd = `${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  return d.year ? `${String(d.year).padStart(4, '0')}-${mmdd}` : mmdd;
}
/** O aniversário da pessoa no SEMPER (nascimento; para empresa, a abertura), como "aaaa-mm-dd". */
const aniversarioDaPessoa = (p: PessoaDoEscritorio) => (/^\d{4}-\d{2}-\d{2}/.exec((p.tipo === 'pj' ? p.abertura : p.nascimento) ?? '')?.[0]) ?? null;

/** Os dois aniversários batem, não batem, ou falta um deles. Sem o ano no Google, compara o dia e o mês. */
function comparaAniversario(doContato: string | null, daPessoa: string | null): 'igual' | 'diferente' | null {
  if (!doContato || !daPessoa) return null;
  const pessoa = doContato.length === 5 ? daPessoa.slice(5) : daPessoa;
  return pessoa === doContato ? 'igual' : 'diferente';
}

// ---------------------------------------------------------------------
// Os indícios de cada pessoa possível e a força deles
// ---------------------------------------------------------------------

/** O que liga um contato a uma pessoa. */
export interface Indicio {
  telefone: boolean;
  email: boolean;
  nome: 'igual' | 'contido' | null;
  /** O nome tem duas palavras ou mais (que contam). */
  nomeCompleto: boolean;
  aniversario: 'igual' | 'diferente' | null;
}
/** Quão certo é que o contato é a pessoa: certo, só o nome, dados que não combinam, ou nada que conte. */
export type Forca = 'certo' | 'so-nome' | 'conflito' | 'nenhuma';

/**
 * A tabela de casos: a primeira linha que vale decide a força. A ordem importa (um aniversário diferente desfaz o que o
 * telefone ou o e-mail confirmariam). Caso novo = uma linha nova.
 */
export const CASOS_DO_INDICIO: readonly { caso: string; vale: (i: Indicio) => boolean; forca: Forca }[] = [
  { caso: 'nome e telefone ou e-mail, mas o aniversário é outro', vale: i => !!i.nome && (i.telefone || i.email) && i.aniversario === 'diferente', forca: 'conflito' },
  { caso: 'nome e telefone', vale: i => !!i.nome && i.telefone, forca: 'certo' },
  { caso: 'nome e e-mail', vale: i => !!i.nome && i.email, forca: 'certo' },
  { caso: 'o mesmo telefone com outro nome', vale: i => i.telefone, forca: 'conflito' },
  { caso: 'o mesmo nome completo e o mesmo aniversário', vale: i => i.nome === 'igual' && i.nomeCompleto && i.aniversario === 'igual', forca: 'certo' },
  { caso: 'o mesmo nome completo, com aniversário diferente (homônimos)', vale: i => i.nome === 'igual' && i.aniversario === 'diferente', forca: 'nenhuma' },
  { caso: 'só o mesmo nome completo', vale: i => i.nome === 'igual' && i.nomeCompleto, forca: 'so-nome' },
  // E-mail sozinho, nome parecido sem mais nada, ou nada: não conta.
  { caso: 'nada que conte', vale: () => true, forca: 'nenhuma' }
];
export const forcaDoIndicio = (i: Indicio): Forca => CASOS_DO_INDICIO.find(c => c.vale(i))!.forca;

// ---------------------------------------------------------------------
// O que fazer com cada contato
// ---------------------------------------------------------------------

/** A situação do contato, pelas pessoas possíveis. */
export type SituacaoDoContato = 'marcado' | 'um-certo' | 'varios-certos' | 'so-nome' | 'conflito' | 'varios-duvidosos' | 'nenhum';

interface Possivel { pessoa: PessoaDoEscritorio; forca: Forca }
type Decisao = { ligar: string } | { conferir: MotivoParaConferir; candidatos: string[] } | null;

/** A tabela de decisões: cada situação, o que acontece com o contato. */
export const DECISAO_DO_CONTATO: Record<SituacaoDoContato, (certos: Possivel[], duvidosos: Possivel[]) => Decisao> = {
  marcado: certos => ({ ligar: certos[0].pessoa.id }),
  'um-certo': certos => ({ ligar: certos[0].pessoa.id }),
  'varios-certos': certos => ({ conferir: 'varios', candidatos: certos.map(c => c.pessoa.id) }),
  'so-nome': (_, duvidosos) => ({ conferir: 'so-nome', candidatos: [duvidosos[0].pessoa.id] }),
  conflito: (_, duvidosos) => ({ conferir: 'conflito', candidatos: [duvidosos[0].pessoa.id] }),
  'varios-duvidosos': (_, duvidosos) => ({ conferir: 'varios', candidatos: duvidosos.map(c => c.pessoa.id) }),
  nenhum: () => null
};

export function situacaoDoContato(certos: Possivel[], duvidosos: Possivel[], marcado: boolean): SituacaoDoContato {
  if (marcado) return 'marcado';
  if (certos.length) return certos.length === 1 ? 'um-certo' : 'varios-certos';
  if (!duvidosos.length) return 'nenhum';
  return duvidosos.length > 1 ? 'varios-duvidosos' : duvidosos[0].forca === 'so-nome' ? 'so-nome' : 'conflito';
}

/** Junta numa lista por chave (telefone, e-mail ou nome → pessoas). */
function indice(pessoas: PessoaDoEscritorio[], chaves: (p: PessoaDoEscritorio) => (string | null)[]) {
  const m = new Map<string, PessoaDoEscritorio[]>();
  for (const p of pessoas) {
    for (const k of new Set(chaves(p).filter((x): x is string => !!x))) {
      const lista = m.get(k);
      if (lista) lista.push(p); else m.set(k, [p]);
    }
  }
  return m;
}

const corta = (lista: (string | null | undefined)[]) =>
  [...new Set(lista.map(v => String(v ?? '').trim()).filter(Boolean))].slice(0, DADOS_PARA_CONFERIR).map(v => v.slice(0, TAMANHO_DO_DADO_PARA_CONFERIR));

/**
 * Compara os contatos da conta Google com as pessoas do escritório e diz quais ligar e quais conferir. Contatos já ligados
 * a alguém nesta conta e contatos apagados ficam de fora. Cada pessoa fica com um contato só: se dois contatos são certos
 * para a mesma pessoa (o contato repetido no Google), o primeiro liga (o marcado pelo SEMPER antes de todos) e os outros
 * vão para conferir; o mesmo vale para a pessoa que já tinha um contato ligado.
 */
export function corresponder(contatos: ContatoDaConta[], pessoas: PessoaDoEscritorio[]): Correspondencia {
  const porId = new Map(pessoas.map(p => [p.id, p]));
  const jaLigados = new Set(pessoas.map(p => p.recurso).filter(Boolean));
  const nomes = new Map(pessoas.map(p => [p.id, nomeComparavel(p.nome)]));
  const porTelefone = indice(pessoas, p => (p.telefones ?? []).map(telefoneComparavel));
  const porEmail = indice(pessoas, p => (p.emails ?? []).map(emailComparavel));
  const porNome = indice(pessoas, p => [nomes.get(p.id) ?? null]);

  const marcaDe = (c: ContatoDaConta) => c.clientData?.find(d => d.key === MARCA_DO_SEMPER)?.value;
  // Os marcados pelo SEMPER primeiro: se houver repetido, fica ligado o que o SEMPER criou.
  const emOrdem = contatos.filter(c => !c.metadata?.deleted && c.resourceName && !jaLigados.has(c.resourceName))
    .map((c, ordem) => ({ c, ordem, marcado: !!porId.get(marcaDe(c) ?? '') }))
    .sort((a, b) => Number(b.marcado) - Number(a.marcado) || a.ordem - b.ordem);

  const resultado: Correspondencia = { ligar: [], conferir: [], semCorrespondencia: 0 };
  const ocupadas = new Set(pessoas.filter(p => p.recurso).map(p => p.id));
  for (const { c, marcado } of emOrdem) {
    const nome = nomeDoContato(c);
    const aniversario = aniversarioDoContato(c);
    const paraConferir = (motivo: MotivoParaConferir, candidatos: string[]) => resultado.conferir.push({
      recurso: c.resourceName, etag: c.etag ?? null, nome: nome?.slice(0, TAMANHO_DO_NOME_PARA_CONFERIR) ?? null,
      telefones: corta((c.phoneNumbers ?? []).map(t => t.value)), emails: corta((c.emailAddresses ?? []).map(e => e.value)),
      aniversario, motivo, candidatos: candidatos.slice(0, CANDIDATOS_PARA_CONFERIR)
    });

    let decisao: Decisao;
    if (marcado) {
      decisao = DECISAO_DO_CONTATO.marcado([{ pessoa: porId.get(marcaDe(c)!)!, forca: 'certo' }], []);
    } else {
      const telefones = new Set((c.phoneNumbers ?? []).map(t => telefoneComparavel(t.canonicalForm || t.value)).filter(Boolean) as string[]);
      const emails = new Set((c.emailAddresses ?? []).map(e => emailComparavel(e.value)).filter(Boolean) as string[]);
      const nomeC = nomeComparavel(nome);
      const possiveis = new Map<string, PessoaDoEscritorio>();
      for (const k of telefones) porTelefone.get(k)?.forEach(p => possiveis.set(p.id, p));
      for (const k of emails) porEmail.get(k)?.forEach(p => possiveis.set(p.id, p));
      if (nomeC) porNome.get(nomeC)?.forEach(p => possiveis.set(p.id, p));
      const avaliados: Possivel[] = [...possiveis.values()].map(p => {
        const nomeP = nomes.get(p.id) ?? '';
        const indicio: Indicio = {
          telefone: (p.telefones ?? []).some(t => telefones.has(telefoneComparavel(t) ?? '')),
          email: (p.emails ?? []).some(e => emails.has(emailComparavel(e) ?? '')),
          nome: semelhancaDoNome(nomeC, nomeP),
          nomeCompleto: nomeCompleto(nomeC) && nomeCompleto(nomeP),
          aniversario: comparaAniversario(aniversario, aniversarioDaPessoa(p))
        };
        return { pessoa: p, forca: forcaDoIndicio(indicio) };
      });
      const certos = avaliados.filter(a => a.forca === 'certo');
      const duvidosos = avaliados.filter(a => a.forca === 'so-nome' || a.forca === 'conflito');
      decisao = DECISAO_DO_CONTATO[situacaoDoContato(certos, duvidosos, false)](certos, duvidosos);
    }

    if (!decisao) { resultado.semCorrespondencia++; continue; }
    if ('conferir' in decisao) { paraConferir(decisao.conferir, decisao.candidatos); continue; }
    // A pessoa já tem um contato (ligado antes ou por outro contato desta lista): este é repetido no Google.
    if (ocupadas.has(decisao.ligar)) { paraConferir('repetido', [decisao.ligar]); continue; }
    ocupadas.add(decisao.ligar);
    resultado.ligar.push({ pessoa_id: decisao.ligar, recurso: c.resourceName, etag: c.etag ?? null });
  }
  return resultado;
}
