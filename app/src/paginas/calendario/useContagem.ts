// A contagem de um prazo na tela: busca os dias que o escritório lançou nos anos que o prazo pode atravessar e conta.
// Serve à calculadora de Feriados e prazos e ao formulário de prazo do cartão do processo.
import { useEffect, useState } from 'react';
import { SD, type DiaLancado, type Orgao } from '../../dados';
import { anosDoPrazo, diasDoOrgao } from '../../regras/calendario';
import { contarPrazo, erroDoPrazo, type Contagem, type PrazoContado } from '../../regras/prazos';

interface Pedido {
  orgao: Orgao | null; intimacao: string; dias: number; contagem: Contagem; disponibilizacao: boolean; semRecesso: boolean;
  /** Muda quando o calendário muda: busca de novo. */
  versao?: number;
}
export interface Contado {
  /** null: ainda calculando; texto: o que impede a conta. */
  resultado: PrazoContado | string | null;
  /** O último dia se o prazo não se suspender no recesso, quando ele muda: é a data mais curta, a que não pode passar em branco. */
  foraDoRecesso: string | null;
}

export function useContagem({ orgao, intimacao, dias, contagem, disponibilizacao, semRecesso, versao = 0 }: Pedido): Contado {
  const [lancados, setLancados] = useState<{ chave: string; dias: DiaLancado[] } | string | null>(null);
  const erro = erroDoPrazo({ intimacao, dias });
  // Os dias lançados dos anos que o prazo pode atravessar: busca de novo só quando os anos (ou o calendário) mudam.
  const anos = erro ? null : anosDoPrazo(intimacao, dias);
  const de = anos ? `${anos[0]}-01-01` : '', ate = anos ? `${anos.at(-1)}-12-31` : '';
  const chave = `${de}/${ate}/${versao}`;

  useEffect(() => {
    if (!de) return;
    let vale = true;
    SD.diasListar(de, ate)
      .then(d => { if (vale) setLancados({ chave, dias: d }); })
      .catch(e => { if (vale) setLancados((e as Error).message); });
    return () => { vale = false; };
  }, [de, ate, chave]);

  if (erro) return { resultado: erro, foraDoRecesso: null };
  if (typeof lancados === 'string') return { resultado: lancados, foraDoRecesso: null };
  if (lancados?.chave !== chave) return { resultado: null, foraDoRecesso: null };
  const seguindoRecesso = !!orgao?.recesso;
  const contar = (opcoes: { semRecesso: boolean }) =>
    contarPrazo({ intimacao, dias, contagem, disponibilizacao, semExpediente: diasDoOrgao(orgao, lancados.dias, anos!, opcoes) });
  try {
    const resultado = contar({ semRecesso: semRecesso && seguindoRecesso });
    if (!seguindoRecesso || semRecesso) return { resultado, foraDoRecesso: null };
    const final = contar({ semRecesso: true }).final;
    return { resultado, foraDoRecesso: final === resultado.final ? null : final };
  } catch (e) { return { resultado: (e as Error).message, foraDoRecesso: null }; }
}
