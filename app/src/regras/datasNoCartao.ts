// As datas e o tempo lado a lado no cartão (#361): o prazo (com a hora e o lembrete) de tarefas e demandas e a data e o horário
// do compromisso mudam ali mesmo, sem o lápis, como o título e a descrição (#346) e a data de início (#357). Aqui, como o cartão
// os mostra, o que confere (as mesmas regras do cadastro), o que grava e o que o lápis de um item já existente deixa de mostrar e
// de gravar. Tudo puro, sem tela nem banco.
import type { Compromisso, Lembrete, TipoCompromisso } from '../dados/tipos';
import { compromissoVazio, fmtHora, TIPOS_COMPROMISSO, validarCompromisso, type CamposCompromisso } from './compromisso';
import { CAMPOS_NO_LUGAR } from './edicaoNoLugar';
import { horaELembreteAoGravar, horaELembreteDoCartao, prazoComHora, textoDoLembrete, type CamposDoLembrete } from './lembrete';
import { fmtData, lerData } from './pessoa';

/** Os erros, por campo, que o formulário do cartão mostra ('' ou ausente: o campo está certo). */
export type ErrosDosCampos<K extends string> = Partial<Record<K, string>>;

/**
 * Os erros só dos campos pedidos, pelas regras do cadastro inteiro: valida o cadastro vazio com estes campos preenchidos e fica
 * com os erros deles. Assim o cartão confere o prazo como o cadastro confere, sem repetir as regras.
 */
export function errosDosCampos<C extends object, K extends keyof C & string>(
  validar: (c: C) => Partial<Record<keyof C, string>>, vazio: C, valores: Pick<C, K>, campos: readonly K[]
): ErrosDosCampos<K> {
  const erros = validar({ ...vazio, ...valores });
  return Object.fromEntries(campos.filter(c => erros[c]).map(c => [c, erros[c]])) as ErrosDosCampos<K>;
}
/** Há algum erro? */
export const temErro = (erros: Partial<Record<string, string>>) => Object.values(erros).some(Boolean);

// ---------- o prazo (tarefas e demandas) ----------
/** O que se escreve quando não há prazo. */
export const SEM_PRAZO = 'Sem prazo';
/** O prazo como o cartão o tem gravado (aaaa-mm-dd; a hora como o banco devolve; o lembrete em minutos). */
export interface PrazoGravado { prazo: string | null; prazo_hora?: string | null; lembrete?: Lembrete | null }
/** Os campos do prazo no cartão (o formulário pequeno): o prazo em dd/mm/aaaa, a hora em hh:mm e o lembrete. */
export type CamposDoPrazo = CamposDoLembrete;
/** O formulário pequeno começa com o prazo gravado; sem prazo, sem hora e sem lembrete (como no lápis). */
export const camposDoPrazo = (g: PrazoGravado): CamposDoPrazo => ({ prazo: fmtData(g.prazo), ...horaELembreteDoCartao(g) });
/** O prazo como o cartão o mostra: "15/11/2030 às 14:00", "15/11/2030" ou "Sem prazo". */
export const textoDoPrazo = (g: PrazoGravado) => prazoComHora(g.prazo, g.prazo_hora) || SEM_PRAZO;
/** O lembrete marcado, por extenso, só quando há prazo (sem prazo, o lembrete não vale): "1 hora antes", "Sem lembrete". */
export const lembreteDoPrazo = (g: PrazoGravado) => g.prazo ? textoDoLembrete(g.lembrete) : null;
/** O nome inteiro do prazo, para o leitor de tela: "15/11/2030 às 14:00, lembrete: 1 hora antes". */
export function resumoDoPrazo(g: PrazoGravado) {
  const lembrete = g.prazo && g.lembrete !== null && g.lembrete !== undefined ? `, lembrete: ${textoDoLembrete(g.lembrete).toLowerCase()}` : '';
  return textoDoPrazo(g) + lembrete;
}
/** O que vai para o banco (só depois de conferido): sem prazo, a hora e o lembrete ficam vazios. */
export function prazoAoGravar(c: CamposDoPrazo): Required<PrazoGravado> {
  const prazo = lerData(c.prazo);
  return { prazo, ...horaELembreteAoGravar(prazo, c) };
}
/**
 * O prazo como o cartão o confere (#395): apagar a data tira o prazo inteiro, e a hora e o lembrete vão junto (como prazoAoGravar
 * grava). Sem isto, a hora ou o lembrete que ficaram pediriam o prazo de volta, e a pessoa teria de tirá-los à mão antes.
 */
export const prazoParaConferir = (c: CamposDoPrazo): CamposDoPrazo => c.prazo.trim() ? c : { ...c, hora: '', lembrete: null };
/** O prazo como está gravado, para o Desfazer. */
export const prazoComoEsta = (g: PrazoGravado): Required<PrazoGravado> => ({ prazo: g.prazo, prazo_hora: g.prazo_hora ?? null, lembrete: g.lembrete ?? null });
/** Os campos do prazo no formulário pequeno, na ordem em que aparecem. */
export const CAMPOS_DO_PRAZO = ['prazo', 'hora', 'lembrete'] as const satisfies readonly (keyof CamposDoPrazo)[];

// ---------- a data e o horário do compromisso ----------
/** A data e o horário do compromisso como o cartão os tem gravados. */
export type QuandoGravado = Pick<Compromisso, 'data' | 'hora' | 'hora_fim'>;
/** Os campos da data e do horário no formulário pequeno: os mesmos nomes do cadastro. */
export type CamposDoQuando = Pick<CamposCompromisso, 'data' | 'hora' | 'horaFim'>;
export const CAMPOS_DO_QUANDO = ['data', 'hora', 'horaFim'] as const satisfies readonly (keyof CamposDoQuando)[];
export const camposDoQuando = (c: QuandoGravado): CamposDoQuando => ({ data: fmtData(c.data), hora: fmtHora(c.hora), horaFim: fmtHora(c.hora_fim) });
/** Os erros da data e do horário pelas regras do cadastro do compromisso (a hora é obrigatória nos tipos que a exigem). */
export const errosDoQuando = (tipo: TipoCompromisso, c: CamposDoQuando) =>
  errosDosCampos(validarCompromisso, compromissoVazio(tipo), c, CAMPOS_DO_QUANDO);
/** O que vai para o banco (só depois de conferido). */
export const quandoAoGravar = (c: CamposDoQuando): QuandoGravado => ({ data: lerData(c.data)!, hora: c.hora || null, hora_fim: c.horaFim || null });
/** A data e o horário como estão gravados, para o Desfazer. */
export const quandoComoEsta = (c: QuandoGravado): QuandoGravado => ({ data: c.data, hora: c.hora, hora_fim: c.hora_fim });

// ---------- o lápis de um item já existente ----------
/** Os módulos cujo cartão muda as datas no próprio lugar. */
export type ModuloComDatas = 'tarefas' | 'demandas' | 'compromissos';
/** O que sai do lápis: os campos do formulário (como a tela os chama) e os dados (como o banco os grava). */
export interface ForaDoLapis { campos: readonly string[]; dados: readonly string[] }
const DATAS_DO_PRAZO: ForaDoLapis = { campos: ['prazo', 'hora', 'lembrete', 'inicio'], dados: ['prazo', 'prazo_hora', 'lembrete', 'data_inicio'] };
/**
 * As datas que o cartão de cada módulo muda no próprio lugar: o lápis do item já existente não as mostra nem as grava (o cadastro
 * de um item novo continua com elas). Módulo novo com datas no cartão = uma entrada nova aqui.
 */
export const DATAS_NO_LUGAR: Record<ModuloComDatas, ForaDoLapis> = {
  tarefas: DATAS_DO_PRAZO,
  demandas: DATAS_DO_PRAZO,
  compromissos: { campos: ['data', 'hora', 'horaFim'], dados: ['data', 'hora', 'hora_fim'] }
};
/** Quando o lápis do compromisso pede a hora, só a data sai dele. */
const SO_A_DATA: ForaDoLapis = { campos: ['data'], dados: ['data'] };

/**
 * O lápis do compromisso pede a hora? Só quando o tipo escolhido no lápis exige uma e o compromisso não tem nenhuma gravada (era
 * um "Outro" do dia inteiro): aí a hora aparece no lápis, para a mudança de tipo poder ser salva (como o título, em tituloNoLapis).
 */
export const horaNoLapis = (tipo: TipoCompromisso, horaGravada: string | null) => TIPOS_COMPROMISSO[tipo].exigeHora && !horaGravada;
/** O que sai do lápis do compromisso: a data e o horário, a não ser que o lápis precise pedir a hora (horaNoLapis). */
export const datasForaDoLapisDoCompromisso = (tipo: TipoCompromisso, horaGravada: string | null): ForaDoLapis =>
  horaNoLapis(tipo, horaGravada) ? SO_A_DATA : DATAS_NO_LUGAR.compromissos;

/** Os dados sem os campos que o cartão já muda no próprio lugar. */
export function semOsCampos<D extends object>(dados: D, campos: readonly string[]): Partial<D> {
  return Object.fromEntries(Object.entries(dados).filter(([campo]) => !campos.includes(campo))) as Partial<D>;
}
/** Os campos que o lápis do item já existente não mostra: o título e a descrição (#346) e as datas do módulo (#361). */
export const camposForaDoLapis = (fora: ForaDoLapis): readonly string[] => [...CAMPOS_NO_LUGAR, ...fora.campos];
/**
 * As etapas que o lápis mostra: só as que ainda têm algum campo para mudar (a etapa "A tarefa", que só tinha o título, a descrição
 * e as datas, some do lápis).
 */
export const etapasDoLapis = <E extends { campos: readonly string[] }>(etapas: readonly E[], foraDoLapis: readonly string[]) =>
  etapas.filter(e => e.campos.some(campo => !foraDoLapis.includes(campo)));
