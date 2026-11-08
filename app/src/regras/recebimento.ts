// O recebimento completo (#266), sem tela e sem banco: as formas de pagamento, os bancos (com o código do Banco Central),
// o texto de cada pessoa para mandar junto do comprovante e as receitas de um recebimento.
import type { CategoriaHonorario, FormaDePagamento, RecebimentoGravado } from '../dados/tipos';
import { fmtCentavos } from './caixa';
import { fmtPercentual } from './contrato';
import { fmtData } from './pessoa';

export const FORMAS_DE_PAGAMENTO: Record<FormaDePagamento, string> = {
  pix: 'Pix', ted: 'TED', doc: 'DOC', cartao: 'Cartão', boleto: 'Boleto', dinheiro: 'Dinheiro', cheque: 'Cheque', outra: 'Outra'
};

/**
 * Os bancos mais usados, com o código de compensação do Banco Central (3 dígitos). Banco que não está aqui entra pelo
 * código, em "Outro".
 */
export const BANCOS: { codigo: string; nome: string }[] = [
  { codigo: '077', nome: 'Banco Inter' }, { codigo: '260', nome: 'Nubank' }, { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '104', nome: 'Caixa Econômica Federal' }, { codigo: '341', nome: 'Itaú Unibanco' }, { codigo: '237', nome: 'Bradesco' },
  { codigo: '033', nome: 'Santander' }, { codigo: '756', nome: 'Sicoob' }, { codigo: '748', nome: 'Sicredi' }, { codigo: '336', nome: 'C6 Bank' },
  { codigo: '212', nome: 'Banco Original' }, { codigo: '290', nome: 'PagBank (PagSeguro)' }, { codigo: '323', nome: 'Mercado Pago' },
  { codigo: '380', nome: 'PicPay' }, { codigo: '197', nome: 'Stone' }, { codigo: '403', nome: 'Cora' }, { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '422', nome: 'Safra' }, { codigo: '041', nome: 'Banrisul' }, { codigo: '070', nome: 'BRB' }
];
/** O código de banco que o banco de dados aceita: 3 dígitos. */
export const codigoDeBancoValido = (codigo: string) => /^\d{3}$/.test(codigo);
/** "077 · Banco Inter" (ou só o código, se o banco não está na lista). */
export const nomeDoBanco = (codigo: string | null | undefined) => {
  if (!codigo) return '';
  const b = BANCOS.find(x => x.codigo === codigo);
  return b ? `${b.codigo} · ${b.nome}` : codigo;
};

/** O que o texto precisa do contrato e da parcela. */
export interface ContextoDoTexto {
  codigo: string; clientes: string[]; objetos: string[]; responsavel: string; participantes: string[];
  /** "2/2": a parcela e quantas o contrato tem. */
  parcela: string;
}
export type QuemRecebe = 'escritorio' | 'participante' | 'indicador' | 'socio_indicador';
export interface TextoDaPessoa { chave: string; quem: QuemRecebe; nome: string; percentual: number; valor: number; texto: string }

/** Como cada um aparece no texto: o escritório recebe (ENTRADA); os outros, o dinheiro sai para eles (SAÍDA). */
const SENTIDO: Record<QuemRecebe, 'ENTRADA' | 'SAÍDA'> = { escritorio: 'ENTRADA', participante: 'SAÍDA', indicador: 'SAÍDA', socio_indicador: 'SAÍDA' };
/** O sócio que indicou recebe 10% do que o cliente pagou (a mesma regra da divisão). */
const PERCENTUAL_DO_SOCIO_INDICADOR = 10;

const maiusculas = (s: string) => s.toLocaleUpperCase('pt-BR');
function linha(quem: QuemRecebe, percentual: number, valor: number, data: string, c: ContextoDoTexto) {
  return [
    fmtPercentual(percentual), SENTIDO[quem], c.codigo, maiusculas(c.clientes.join('/')), maiusculas(c.objetos.join('/')),
    maiusculas([c.responsavel, ...c.participantes].filter(Boolean).join('/')), c.parcela, fmtCentavos(valor), fmtData(data)
  ].join(' - ');
}

/**
 * O texto de cada pessoa que recebe parte deste recebimento, como na planilha (TEXTO_ESCRITÓRIO, TEXTO_INDICADOR,
 * TEXTO_PARTICIPANTE): "20% - ENTRADA - código - CLIENTE - SERVIÇO - RESPONSÁVEL/PARTICIPANTE - 2/2 - R$ 238,75 - 28/09/2026".
 */
export function textosDoRecebimento(r: Pick<RecebimentoGravado, 'data' | 'parte_na_conta' | 'na_conta' | 'terceiros' | 'socio_indicador'>, c: ContextoDoTexto): TextoDaPessoa[] {
  const textos: TextoDaPessoa[] = [{ chave: 'escritorio', quem: 'escritorio', nome: 'Escritório', percentual: r.parte_na_conta, valor: r.na_conta, texto: linha('escritorio', r.parte_na_conta, r.na_conta, r.data, c) }];
  for (const t of r.terceiros) {
    const quem: QuemRecebe = t.papel === 'indicador' ? 'indicador' : 'participante';
    textos.push({ chave: t.id, quem, nome: t.nome, percentual: t.percentual, valor: t.valor, texto: linha(quem, t.percentual, t.valor, r.data, c) });
  }
  if (r.socio_indicador) textos.push({ chave: 'socio-' + r.socio_indicador.id, quem: 'socio_indicador', nome: r.socio_indicador.nome, percentual: PERCENTUAL_DO_SOCIO_INDICADOR,
    valor: r.socio_indicador.valor, texto: linha('socio_indicador', PERCENTUAL_DO_SOCIO_INDICADOR, r.socio_indicador.valor, r.data, c) });
  return textos;
}

/**
 * As receitas de um recebimento: a bruta (o que o cliente pagou), a líquida do responsável (o que de fato fica com ele
 * pelos serviços), e quanto foi ao escritório, aos indicadores e aos participantes.
 */
export function receitasDoRecebimento(r: Pick<RecebimentoGravado, 'valor' | 'responsavel_fica' | 'escritorio_final' | 'terceiros' | 'socio_indicador'>) {
  const soma = (papel: 'indicador' | 'participante') => r.terceiros.filter(t => (t.papel ?? 'participante') === papel).reduce((s, t) => s + t.valor, 0);
  return {
    bruta: r.valor,
    liquidaDoResponsavel: r.responsavel_fica,
    escritorio: r.escritorio_final,
    indicadores: soma('indicador') + (r.socio_indicador?.valor ?? 0),
    participantes: soma('participante')
  };
}

/** O tipo do recebimento: o escolhido nele ou, nos recebimentos de antes, o do contrato. */
export const tipoDoRecebimento = (r: Pick<RecebimentoGravado, 'categoria'>, doContrato: CategoriaHonorario) => r.categoria ?? doContrato;

/**
 * A conta de destino do contrato (#269) para a nova entrada: vale se ainda é uma das contas ativas; a arquivada não vale
 * (a entrada fica com a conta sugerida) e a tela avisa.
 */
export function contaDeDestino(destinoId: string | null | undefined, ativas: { id: string }[]): { contaId: string; arquivada: boolean } {
  if (!destinoId || !ativas.length) return { contaId: '', arquivada: false };
  return ativas.some(c => c.id === destinoId) ? { contaId: destinoId, arquivada: false } : { contaId: '', arquivada: true };
}
