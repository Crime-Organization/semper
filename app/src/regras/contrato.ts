// Regras do contrato (módulo Contratos): categorias de honorário, número do contrato, valor da parcela,
// percentuais da divisão, leitura de valores em reais e a validação do cadastro. Tudo puro, sem tela nem banco.
// As contas seguem as planilhas de receitas do escritório (aba Contratos).
import type { CategoriaHonorario, Contrato, DadosContrato, PapelNoContrato } from '../dados/tipos';
import { CLIENTES_MAXIMOS, OBJETOS_MAXIMOS, PARCELAS_MAXIMAS, PARTICIPANTES_MAXIMOS, TAMANHO_CONTRATO } from '../dados/limites';
import { dig, fmtData, lerData } from './pessoa';
import { normal } from './texto';

export const CATEGORIAS: Record<CategoriaHonorario, string> = {
  pro_labore: 'Pró-labore',
  quota_litis: 'Quota litis',
  sucumbencia: 'Sucumbência',
  adiantamento_despesas: 'Adiantamento de despesas',
  pro_bono: 'Pro bono'
};

/** Rótulo dos contratos fora das colunas do quadro. */
export const SEM_SITUACAO = 'Sem situação';

/** Quanto do que o cliente paga vai para a conta PJ do escritório, definido pelo advogado na contratação. */
export const PERCENTUAIS_ESCRITORIO = [20, 30, 100] as const;

/** Sigla do advogado, como nas planilhas: as duas primeiras letras do nome (sem acento) e os dois últimos dígitos do CPF. */
export function siglaAdvogado(nome: string, cpf: string | null | undefined): string | null {
  const letras = normal(nome).replace(/[^a-z]/g, '').slice(0, 2).toUpperCase();
  const d = dig(cpf);
  return letras.length === 2 && d.length === 11 ? letras + d.slice(-2) : null;
}

/** Número do contrato: sigla do advogado, número no ano (4 dígitos; recomeça a cada ano) e ano de criação. Ex.: HE62-0163-2026. */
export const numeroContrato = (sigla: string, numero: number, ano: number) => `${sigla}-${String(numero).padStart(4, '0')}-${ano}`;

const centavos = (v: number) => Math.round(v * 100) / 100;

/** Valor de cada parcela. A entrada conta como a primeira parcela, como nas planilhas de receitas. */
export function valorParcela(valor: number | null, entrada: number | null, parcelas: number | null): number | null {
  if (!valor || !parcelas) return null;
  if (!entrada) return centavos(valor / parcelas);
  return parcelas > 1 ? centavos((valor - entrada) / (parcelas - 1)) : null;
}

/**
 * % do responsável: o que sobra do total depois do escritório, dos participantes e do indicador (todos sobre o total,
 * como a conta da planilha Caixa). null se a soma passar de 100%.
 */
export function percentualResponsavel(escritorio: number | null, participantes: (number | null)[], indicador: number | null): number | null {
  const resto = 100 - (escritorio || 0) - participantes.reduce<number>((soma, p) => soma + (p || 0), 0) - (indicador || 0);
  return resto < 0 ? null : centavos(resto);
}

/** Participantes por extenso, como no histórico do banco: "NOME (20%), OUTRO NOME". null se não há nenhum. */
export const textoDosParticipantes = (lista: { nome: string; percentual: number | null }[]) =>
  lista.map(p => p.nome + (p.percentual === null ? '' : ` (${fmtPercentual(p.percentual)})`)).join(', ') || null;

// ---------- objetos do contrato ----------
/** Objetos como o banco guarda: sem espaços nas pontas, sem linhas vazias e sem repetir (ignorando maiúsculas e acentos), na ordem escrita. */
export function limparObjetos(objetos: string[]): string[] {
  const vistos = new Set<string>();
  return objetos.map(o => o.trim()).filter(o => {
    if (!o || vistos.has(normal(o))) return false;
    vistos.add(normal(o));
    return true;
  });
}
/** Os objetos juntos, como ficam no campo "servico" (o que a tabela e o quadro mostram). */
export const juntarObjetos = (objetos: string[]) => limparObjetos(objetos).join('; ');

// ---------- valores em reais e percentuais ----------
/** "R$ 1.500,00", "1500,5" ou "1500.50" viram 1500.5. Vazio vira null. */
export function lerDinheiro(txt: string): number | null {
  const t = txt.replace(/R\$|\s/g, '');
  if (!t) return null;
  // Com vírgula, ela separa os centavos e os pontos separam os milhares. Sem vírgula, um ponto seguido de 1 ou 2
  // dígitos no fim separa os centavos; os outros pontos separam os milhares.
  const decimal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.')
    : /\.\d{1,2}$/.test(t) ? t.replace(/\.(?=.*\.)/g, '') : t.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(decimal)) throw new Error('Use um valor como 1.500,00.');
  return Number(decimal);
}
export const fmtDinheiro = (v: number | null | undefined) => v === null || v === undefined ? ''
  : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** Para o campo do formulário: 1500.5 vira "1.500,50". */
export const dinheiroNoCampo = (v: number | null | undefined) => v === null || v === undefined ? ''
  : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "30", "30%" ou "26,67" viram números de 0 a 100. Vazio vira null. */
export function lerPercentual(txt: string): number | null {
  const t = txt.replace(/%|\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!/^\d+(\.\d{1,2})?$/.test(t) || n > 100) throw new Error('Use um percentual de 0 a 100.');
  return n;
}
export const fmtPercentual = (v: number | null | undefined) => v === null || v === undefined ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';

// ---------- formulário ----------
/** Campos do formulário de contrato, como digitados. */
export interface CamposContrato {
  /** Um por linha (o id da pessoa escolhida; linha vazia ainda sem pessoa). */
  clientes: string[];
  responsavelId: string;
  /** Um por linha; linhas vazias são ignoradas ao salvar. */
  objetos: string[];
  categoria: '' | CategoriaHonorario;
  valor: string;
  entrada: string;
  parcelas: string;
  descontos: string;
  assinadoEm: string;
  primeiroPagamento: string;
  percentualEscritorio: string;
  /** Um por linha: a pessoa escolhida e o % digitado. Linhas sem pessoa e sem % são ignoradas. */
  participantes: { pessoaId: string; percentual: string }[];
  indicadorId: string;
  indicadorPercentual: string;
  documentoUrl: string;
  observacoes: string;
  codigoAntigo: string;
}
export const CONTRATO_VAZIO: CamposContrato = {
  clientes: [''], responsavelId: '', objetos: [''], categoria: '', valor: '', entrada: '', parcelas: '', descontos: '', assinadoEm: '',
  primeiroPagamento: '', percentualEscritorio: '', participantes: [], indicadorId: '', indicadorPercentual: '',
  documentoUrl: '', observacoes: '', codigoAntigo: ''
};

/** Mensagem de cada campo obrigatório que falta. */
export const MSG_CONTRATO: Partial<Record<keyof CamposContrato, string>> = {
  clientes: 'Escolha o cliente.',
  responsavelId: 'Escolha o advogado responsável.',
  objetos: 'Informe ao menos um objeto do contrato.',
  categoria: 'Escolha a categoria de honorário.'
};

/** Confere um campo: devolve a mensagem de erro ou null. */
type Conferencia = (c: CamposContrato) => string | null;
type CampoTexto = Exclude<keyof CamposContrato, 'clientes' | 'objetos' | 'participantes'>;
/** Onde aparece cada erro: um campo do formulário, ou a divisão como um todo (a soma dos percentuais). */
export type CampoComErro = keyof CamposContrato | 'divisao';
/** Participantes preenchidos (com pessoa ou com %). */
const preenchidos = (c: CamposContrato) => c.participantes.filter(p => p.pessoaId || p.percentual.trim());
const obrigatorio = (campo: CampoTexto): Conferencia => c => String(c[campo]).trim() ? null : MSG_CONTRATO[campo]!;
const leitura = (ler: (t: string) => unknown, campo: CampoTexto): Conferencia => c => {
  try { ler(c[campo]); return null; } catch (e) { return (e as Error).message; }
};
const dinheiro = (campo: CampoTexto) => leitura(lerDinheiro, campo);
const data = (campo: CampoTexto) => leitura(lerData, campo);
const percentual = (campo: CampoTexto) => leitura(lerPercentual, campo);
/** Lê sem lançar erro (o erro de formato já é de outra conferência). */
const quieto = <T>(ler: (t: string) => T, t: string) => { try { return ler(t); } catch { return null; } };

/** Regras do cadastro, uma lista por campo (a primeira que falhar dá a mensagem). Campo novo = entrada nova aqui. */
const CONFERENCIAS: Partial<Record<CampoComErro, Conferencia[]>> = {
  clientes: [
    c => c.clientes.some(Boolean) ? null : MSG_CONTRATO.clientes!,
    c => new Set(c.clientes.filter(Boolean)).size < c.clientes.filter(Boolean).length ? 'O mesmo cliente aparece duas vezes.' : null,
    c => c.clientes.filter(Boolean).length > CLIENTES_MAXIMOS ? `Um contrato pode ter até ${CLIENTES_MAXIMOS} clientes.` : null
  ],
  responsavelId: [obrigatorio('responsavelId')],
  objetos: [
    c => limparObjetos(c.objetos).length ? null : MSG_CONTRATO.objetos!,
    c => limparObjetos(c.objetos).length > OBJETOS_MAXIMOS ? `Um contrato pode ter até ${OBJETOS_MAXIMOS} objetos.` : null,
    c => c.objetos.some(o => o.trim().length > TAMANHO_CONTRATO.objeto) ? `Cada objeto do contrato pode ter até ${TAMANHO_CONTRATO.objeto} caracteres.` : null
  ],
  categoria: [obrigatorio('categoria')],
  valor: [dinheiro('valor')],
  entrada: [dinheiro('entrada'), c => {
    const valor = quieto(lerDinheiro, c.valor), entrada = quieto(lerDinheiro, c.entrada);
    return valor !== null && entrada !== null && entrada > valor ? 'A entrada não pode passar do valor do contrato.' : null;
  }],
  descontos: [dinheiro('descontos'), c => {
    const valor = quieto(lerDinheiro, c.valor), descontos = quieto(lerDinheiro, c.descontos);
    return valor !== null && descontos !== null && descontos > valor ? 'Os descontos não podem passar do valor do contrato.' : null;
  }],
  parcelas: [c => {
    const t = c.parcelas.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isInteger(n) && n >= 1 && n <= PARCELAS_MAXIMAS ? null : `Informe de 1 a ${PARCELAS_MAXIMAS} parcelas.`;
  }],
  assinadoEm: [data('assinadoEm')],
  primeiroPagamento: [data('primeiroPagamento')],
  participantes: [
    c => preenchidos(c).map(p => { try { lerPercentual(p.percentual); return null; } catch (e) { return (e as Error).message; } }).find(Boolean) ?? null,
    c => preenchidos(c).some(p => !p.pessoaId) ? 'Escolha o participante deste percentual.' : null,
    c => new Set(preenchidos(c).map(p => p.pessoaId)).size < preenchidos(c).length ? 'A mesma pessoa aparece duas vezes nos participantes.' : null,
    c => preenchidos(c).length > PARTICIPANTES_MAXIMOS ? `Um contrato pode ter até ${PARTICIPANTES_MAXIMOS} participantes.` : null
  ],
  indicadorPercentual: [percentual('indicadorPercentual'),
    c => quieto(lerPercentual, c.indicadorPercentual) && !c.indicadorId ? 'Escolha o indicador deste percentual.' : null],
  indicadorId: [c => c.indicadorId && c.participantes.some(p => p.pessoaId === c.indicadorId) ? 'O indicador e os participantes precisam ser pessoas diferentes.' : null],
  divisao: [c => calculadosDoContrato(c).responsavel === null ? 'A soma dos percentuais (escritório, participantes e indicador) passa de 100%.' : null],
  documentoUrl: [c => !c.documentoUrl.trim() || /^https?:\/\/\S+$/i.test(c.documentoUrl.trim()) ? null : 'Cole o link completo, começando com https://.']
};

/** Erros do cadastro, por campo. Vazio: pode salvar. */
export function validarContrato(c: CamposContrato): Partial<Record<CampoComErro, string>> {
  const erros: Partial<Record<CampoComErro, string>> = {};
  for (const [campo, regras] of Object.entries(CONFERENCIAS) as [CampoComErro, Conferencia[]][]) {
    const erro = regras.map(r => r(c)).find(Boolean);
    if (erro) erros[campo] = erro;
  }
  return erros;
}

/** O que vai para o banco (só depois de validarContrato sem erros). */
export function dadosDoContrato(c: CamposContrato): DadosContrato {
  const texto = (t: string) => t.trim() || null;
  const parcelas = c.parcelas.trim();
  return {
    clientes: [...new Set(c.clientes.filter(Boolean))], responsavel_id: c.responsavelId, objetos: limparObjetos(c.objetos), servico: juntarObjetos(c.objetos), categoria: c.categoria as CategoriaHonorario,
    valor: lerDinheiro(c.valor), entrada: lerDinheiro(c.entrada), parcelas: parcelas ? Number(parcelas) : null, descontos: lerDinheiro(c.descontos),
    assinado_em: lerData(c.assinadoEm), primeiro_pagamento: lerData(c.primeiroPagamento),
    percentual_escritorio: c.percentualEscritorio ? Number(c.percentualEscritorio) : null,
    participantes: preenchidos(c).map(p => ({ pessoa_id: p.pessoaId, percentual: lerPercentual(p.percentual) })),
    indicador_id: c.indicadorId || null, indicador_percentual: c.indicadorId ? lerPercentual(c.indicadorPercentual) : null,
    documento_url: texto(c.documentoUrl), observacoes: texto(c.observacoes), codigo_antigo: texto(c.codigoAntigo)?.toUpperCase() ?? null
  };
}

/** Campos do formulário a partir de um contrato salvo (para atualizar). */
export function camposDoContrato(k: Contrato): CamposContrato {
  const pct = (v: number | null) => v === null ? '' : String(v).replace('.', ',');
  return {
    clientes: k.clientes.length ? k.clientes.map(p => p.id) : [''], responsavelId: k.responsavel_id, objetos: k.objetos.length ? [...k.objetos] : [''], categoria: k.categoria,
    valor: dinheiroNoCampo(k.valor), entrada: dinheiroNoCampo(k.entrada), parcelas: k.parcelas ? String(k.parcelas) : '',
    descontos: dinheiroNoCampo(k.descontos), assinadoEm: fmtData(k.assinado_em), primeiroPagamento: fmtData(k.primeiro_pagamento),
    percentualEscritorio: k.percentual_escritorio === null ? '' : String(k.percentual_escritorio),
    participantes: k.participantes.map(p => ({ pessoaId: p.pessoa.id, percentual: pct(p.percentual) })),
    indicadorId: k.indicador_id || '', indicadorPercentual: pct(k.indicador_percentual),
    documentoUrl: k.documento_url || '', observacoes: k.observacoes || '', codigoAntigo: k.codigo_antigo || ''
  };
}

/** Nome de cada campo no histórico de alterações do contrato. */
export const CAMPOS_CONTRATO: Record<string, string> = {
  cliente_id: 'Cliente', clientes: 'Clientes', responsavel_id: 'Responsável', servico: 'Objetos do contrato', categoria: 'Categoria', valor: 'Valor do contrato',
  entrada: 'Entrada', parcelas: 'Parcelas', descontos: 'Descontos', assinado_em: 'Assinado em', primeiro_pagamento: 'Primeiro pagamento',
  percentual_escritorio: 'Enviado ao escritório', participantes: 'Participantes', participante_id: 'Participante', participante_percentual: '% do participante',
  indicador_id: 'Indicador', indicador_percentual: '% do indicador', documento_url: 'Documento no Drive', observacoes: 'Observações',
  codigo_antigo: 'Código antigo', etapa: 'Situação', arquivado_em: 'Arquivamento'
};

/** Como cada campo aparece no cartão e no histórico (o que não está aqui aparece como foi guardado). */
const FORMATOS: Record<string, (v: unknown) => string> = {
  valor: v => fmtDinheiro(Number(v)), entrada: v => fmtDinheiro(Number(v)), descontos: v => fmtDinheiro(Number(v)),
  percentual_escritorio: v => fmtPercentual(Number(v)), participante_percentual: v => fmtPercentual(Number(v)),
  indicador_percentual: v => fmtPercentual(Number(v)),
  categoria: v => CATEGORIAS[v as CategoriaHonorario] ?? String(v),
  assinado_em: v => fmtData(String(v)), primeiro_pagamento: v => fmtData(String(v))
};
export function valorLegivelContrato(campo: string, v: unknown): string {
  return v === null || v === undefined || v === '' ? '—' : (FORMATOS[campo] ?? String)(v);
}

/** Valores calculados enquanto se digita: o valor da parcela e o % do responsável. Campo ainda inválido conta como vazio. */
export function calculadosDoContrato(c: CamposContrato) {
  const parcelas = Number(c.parcelas);
  return {
    parcela: valorParcela(quieto(lerDinheiro, c.valor), quieto(lerDinheiro, c.entrada), Number.isInteger(parcelas) && parcelas > 0 ? parcelas : null),
    responsavel: percentualResponsavel(Number(c.percentualEscritorio) || null, c.participantes.map(p => quieto(lerPercentual, p.percentual)),
      quieto(lerPercentual, c.indicadorPercentual))
  };
}

// ---------- etapas do cadastro ----------
/** As etapas do cadastro de contrato, na ordem, como no cadastro de pessoa. */
export type EtapaContrato = 'partes' | 'objetos' | 'honorarios' | 'divisao' | 'documento';
export interface DefinicaoEtapa { id: EtapaContrato; titulo: string; texto: string; campos: CampoComErro[] }
export const ETAPAS_CONTRATO: DefinicaoEtapa[] = [
  { id: 'partes', titulo: 'Cliente e responsável', texto: 'Quem contrata e o advogado que responde pelo contrato.',
    campos: ['clientes', 'responsavelId', 'codigoAntigo'] },
  { id: 'objetos', titulo: 'O que foi contratado', texto: 'Cada objeto vira uma demanda quando o contrato for assinado.',
    campos: ['objetos', 'categoria'] },
  { id: 'honorarios', titulo: 'Honorários', texto: 'Valores e datas. Nada aqui é obrigatório.',
    campos: ['valor', 'entrada', 'parcelas', 'descontos', 'assinadoEm', 'primeiroPagamento'] },
  { id: 'divisao', titulo: 'Divisão', texto: 'Todos os percentuais são sobre o total; o responsável fica com o que sobra.',
    campos: ['percentualEscritorio', 'participantes', 'indicadorId', 'indicadorPercentual', 'divisao'] },
  { id: 'documento', titulo: 'Documento e observações', texto: 'O contrato assinado fica na pasta do Drive: cole o link aqui.',
    campos: ['documentoUrl', 'observacoes'] }
];

/** Erros só dos campos de uma etapa (o que impede de seguir para a próxima). */
export function errosDaEtapa(etapa: EtapaContrato, c: CamposContrato): Partial<Record<CampoComErro, string>> {
  const campos = ETAPAS_CONTRATO.find(e => e.id === etapa)!.campos, erros = validarContrato(c);
  return Object.fromEntries(Object.entries(erros).filter(([campo]) => campos.includes(campo as CampoComErro)));
}
/** Posição da primeira etapa com erro (para voltar a ela ao salvar), ou -1 se pode salvar. */
export const primeiraEtapaComErro = (c: CamposContrato) => ETAPAS_CONTRATO.findIndex(e => Object.keys(errosDaEtapa(e.id, c)).length > 0);

// ---------- contratos no cartão da pessoa ----------
export const PAPEIS_NO_CONTRATO: Record<PapelNoContrato, string> = {
  cliente: 'Cliente', responsavel: 'Responsável', participante: 'Participante', indicador: 'Indicador'
};
/** O que confere cada papel: a pessoa (ou o usuário dela, no responsável) no campo certo do contrato. */
interface PartesDoContrato { clientes: string[]; responsavel_id: string; indicador_id: string | null; participantes: string[] }
const CONFERE_PAPEL: Record<PapelNoContrato, (k: PartesDoContrato, pessoaId: string, perfilId: string | null) => boolean> = {
  cliente: (k, p) => k.clientes.includes(p),
  responsavel: (k, _p, perfil) => !!perfil && k.responsavel_id === perfil,
  participante: (k, p) => k.participantes.includes(p),
  indicador: (k, p) => k.indicador_id === p
};
/** Os papéis da pessoa no contrato, na ordem de PAPEIS_NO_CONTRATO (vazio: ela não está nele). */
export const papeisNoContrato = (k: PartesDoContrato, pessoaId: string, perfilId: string | null = null) =>
  (Object.keys(CONFERE_PAPEL) as PapelNoContrato[]).filter(papel => CONFERE_PAPEL[papel](k, pessoaId, perfilId));

/** Nomes por extenso, como se fala: "ANA", "ANA e BRUNO", "ANA, BRUNO e CARLA". */
export const nomesPorExtenso = (nomes: string[]) => new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(nomes);
/** Os clientes de um contrato por extenso, a partir do nome guardado ("A; B"). */
export const clientesPorExtenso = (clienteNome: string) => nomesPorExtenso(clienteNome.split('; '));
