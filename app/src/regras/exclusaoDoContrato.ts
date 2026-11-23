// Excluir o contrato exclui junto o que está ligado a ele (#284). O banco faz o mesmo em public.contratos_excluir
// (supabase/migrations/20261122235537_contrato_exclui_em_cascata.sql); o banco fictício usa estas regras para se comportar igual.
//   - Saem as demandas dos contratos (menos a contínua, #313) e as tarefas ligadas a eles ou a essas demandas que não têm nenhuma
//     outra ligação: outro contrato, outra demanda (que não seja a contínua) ou um processo. As outras continuam, ligadas ao restante.
//   - Com pagamento já feito do dinheiro do contrato (repasse pago, participante marcado como pago), ninguém exclui: o administrador
//     desfaz antes. Com dinheiro recebido (recebimento não estornado ou parcela importada como paga), só um administrador exclui.
// E o texto da janela que pergunta antes de excluir, montado da prévia do banco (contratoExclusaoPrevia).
import type { PreviaExclusaoContrato, ResumoDaCascata } from '../dados/tipos';
import type { DemandaParaArquivar, TarefaParaArquivar } from './arquivarContrato';
import { fmtCentavos } from './caixa';
import { fmtDuracao } from './cronometro';

/** As demandas e as tarefas do escritório, como a regra precisa delas (as mesmas do arquivamento). */
export interface EscritorioParaExcluir { demandas: readonly DemandaParaArquivar[]; tarefas: readonly TarefaParaArquivar[] }

/** Os ids que a exclusão dos contratos exclui junto. */
export interface ExcluidosJunto { demandas: string[]; tarefas: string[] }

/** As demandas e as tarefas que saem junto quando estes contratos são excluídos (arquivadas ou não). */
export function excluidosComOsContratos(contratos: readonly string[], e: EscritorioParaExcluir): ExcluidosJunto {
  const saem = new Set(contratos);
  const demandas = e.demandas.filter(d => d.contrato_id && saem.has(d.contrato_id) && !d.continua).map(d => d.id);
  const demandasQueSaem = new Set(demandas);
  // Outra demanda: uma que existe, não sai com os contratos e não é a contínua (ela só agrupa).
  const outraDemanda = (id: string) => !demandasQueSaem.has(id) && e.demandas.some(d => d.id === id && !d.continua);
  const tarefas = e.tarefas.filter(t => (t.contratos.some(id => saem.has(id)) || t.demandas.some(id => demandasQueSaem.has(id)))
    && !t.processo_id && t.contratos.every(id => saem.has(id)) && !t.demandas.some(outraDemanda)).map(t => t.id);
  return { demandas, tarefas };
}

/**
 * De qual contrato é cada tarefa que sai, para o resumo de cada um no registro de ações. `contratos` vem na ordem do resumo (pelo
 * código): a tarefa conta no primeiro a que está ligada, direto ou por uma das demandas dele que saem. Assim a tarefa de dois
 * contratos excluídos juntos conta uma vez só, e nenhuma tarefa que sai fica fora do resumo.
 */
export function tarefasDeCadaContrato(contratos: readonly string[], junto: ExcluidosJunto, e: EscritorioParaExcluir): Record<string, string[]> {
  const saem = new Set(junto.tarefas), demandasQueSaem = new Set(junto.demandas), contadas = new Set<string>();
  return Object.fromEntries(contratos.map(k => {
    const demandas = new Set(e.demandas.filter(d => d.contrato_id === k && demandasQueSaem.has(d.id)).map(d => d.id));
    const minhas = e.tarefas.filter(t => saem.has(t.id) && !contadas.has(t.id) && (t.contratos.includes(k) || t.demandas.some(d => demandas.has(d))))
      .map(t => t.id);
    minhas.forEach(id => contadas.add(id));
    return [k, minhas];
  }));
}

/** Por que a exclusão não pode seguir. A ordem conta: o pagamento feito vale para todos; o dinheiro, para quem não é administrador. */
export type BloqueioDaExclusao = 'pagamento' | 'administrador' | 'nenhum';

/** O que a janela mostra: o título, o que sai, os avisos e, quando não dá para excluir, por quê (com a lista de pagamentos feitos). */
export interface JanelaDaExclusao {
  titulo: string;
  itens: string[];
  avisos: string[];
  bloqueio: { tipo: BloqueioDaExclusao; texto: string; lista: string[] } | null;
}

/** Os textos de quando não dá para excluir (#284, decisões do dono de 22/11). */
export const RECUSA_DA_EXCLUSAO: Record<BloqueioDaExclusao, string> = {
  pagamento: 'Já há pagamento feito do dinheiro deste contrato. Um administrador desfaz o pagamento no Financeiro antes de excluir.',
  administrador: 'Este contrato tem dinheiro recebido: só um administrador o exclui.',
  nenhum: 'Só contratos arquivados podem ser excluídos, por quem os cadastrou ou por um administrador.'
};

/** Em que ordem se confere cada bloqueio: o primeiro que vale é o que a janela diz. */
const BLOQUEIOS: { tipo: BloqueioDaExclusao; vale: (p: PreviaExclusaoContrato) => boolean }[] = [
  { tipo: 'nenhum', vale: p => p.contratos === 0 },
  { tipo: 'pagamento', vale: p => p.tem_pagamento },
  { tipo: 'administrador', vale: p => p.com_dinheiro && !p.sou_admin }
];

export function bloqueioDaExclusao(p: PreviaExclusaoContrato): BloqueioDaExclusao | null {
  return BLOQUEIOS.find(b => b.vale(p))?.tipo ?? null;
}

/** "1 demanda", "3 demandas"; zero não aparece. */
const contar = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Cada linha do que sai junto, na ordem da janela. Linha nova = uma entrada nova aqui. Sem nada daquele tipo, a linha não aparece. */
const ITENS: ((p: PreviaExclusaoContrato) => string | null)[] = [
  p => p.demandas ? contar(p.demandas, 'demanda', 'demandas') : null,
  p => p.tarefas ? contar(p.tarefas, 'tarefa', 'tarefas') + (p.segundos > 0 ? `, com ${fmtDuracao(p.segundos)} de tempo registrado` : '') : null,
  p => p.parcelas ? contar(p.parcelas, 'parcela', 'parcelas') : null,
  p => p.recebimentos ? contar(p.recebimentos, 'recebimento', 'recebimentos') + ' no Caixa'
    + (p.valores ? `: ${fmtCentavos(p.valores.recebido)} recebidos, ${fmtCentavos(p.valores.taxas)} de taxas da máquina e ${fmtCentavos(p.valores.repasses)} de repasses` : '') : null,
  p => p.valores?.correcoes ? `Registros de correção dos recebimentos: ${fmtCentavos(p.valores.correcoes)}` : null,
  p => p.estornados ? contar(p.estornados, 'recebimento estornado', 'recebimentos estornados') : null,
  p => p.importadas ? contar(p.importadas, 'parcela importada como paga', 'parcelas importadas como pagas')
    + (p.valores ? `: ${fmtCentavos(p.valores.importado)}` : '')
    + (p.importadas === 1 ? '. Ela não passou pelo Caixa: excluí-la não muda o saldo.' : '. Elas não passaram pelo Caixa: excluí-las não muda o saldo.') : null
];

/** Os avisos da janela, cada um com quando aparece. */
const AVISOS: { vale: (p: PreviaExclusaoContrato) => boolean; texto: (p: PreviaExclusaoContrato) => string }[] = [
  { vale: p => p.recebimentos + p.estornados > 0,
    texto: () => 'Os recebimentos saem do Caixa, dos saldos e do lucro dos sócios, inclusive de meses passados. Uma cópia fica guardada, que só os administradores veem.' },
  { vale: p => p.demandas + p.tarefas > 0,
    texto: () => 'As demandas e as tarefas saem junto, mesmo as que você não poderia excluir sozinho. A tarefa ligada também a outro contrato, a outra demanda ou a um processo continua.' },
  { vale: () => true, texto: () => 'Processos, compromissos e documentos ligados continuam existindo.' },
  { vale: p => p.nao_excluiveis > 0,
    texto: p => `${contar(p.nao_excluiveis, 'contrato selecionado não sai', 'contratos selecionados não saem')}: ${RECUSA_DA_EXCLUSAO.nenhum.charAt(0).toLowerCase()}${RECUSA_DA_EXCLUSAO.nenhum.slice(1)}` },
  { vale: () => true, texto: () => 'A exclusão é definitiva e não pode ser desfeita.' }
];

/** A janela da exclusão, da prévia do banco. */
export function janelaDaExclusao(p: PreviaExclusaoContrato): JanelaDaExclusao {
  const tipo = bloqueioDaExclusao(p);
  const titulo = tipo ? 'Não dá para excluir' : p.contratos === 1 ? 'Excluir o contrato?' : `Excluir ${p.contratos} contratos?`;
  if (tipo) {
    const lista = tipo === 'pagamento' ? p.pagos.map(x => `${x.nome}: ${fmtCentavos(x.valor)} (${x.codigo}, parcela ${x.parcela})`) : [];
    return { titulo, itens: [], avisos: [], bloqueio: { tipo, texto: RECUSA_DA_EXCLUSAO[tipo], lista } };
  }
  return {
    titulo,
    itens: ITENS.map(f => f(p)).filter((x): x is string => !!x),
    avisos: AVISOS.filter(a => a.vale(p)).map(a => a.texto(p)),
    bloqueio: null
  };
}

/** O que o registro de ações diz da exclusão em cascata (Equipe > Registro de ações): "com 2 demandas, 3 tarefas, 1 recebimento de R$ 1.000,00". */
export function detalheDaExclusaoDoContrato({ cascata }: { cascata?: ResumoDaCascata }) {
  if (!cascata) return '';
  const partes = [
    cascata.demandas && contar(cascata.demandas, 'demanda', 'demandas'),
    cascata.tarefas && contar(cascata.tarefas, 'tarefa', 'tarefas'),
    cascata.parcelas && contar(cascata.parcelas, 'parcela', 'parcelas'),
    cascata.recebimentos && `${contar(cascata.recebimentos, 'recebimento', 'recebimentos')} de ${fmtCentavos(cascata.recebido)}`,
    cascata.importadas && `${contar(cascata.importadas, 'parcela importada como paga', 'parcelas importadas como pagas')} de ${fmtCentavos(cascata.importado)}`
  ].filter(Boolean);
  return partes.length ? 'com ' + partes.join(', ') : 'sem nada ligado';
}
