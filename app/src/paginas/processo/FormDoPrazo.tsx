// Formulário do prazo: calcula pelo calendário do órgão do processo, mostrando como chegou à data e os dias que pulou,
// ou recebe a data digitada à mão. A data calculada é só uma sugestão: ao passar para "Digitar", ela já vem preenchida.
import { useId, useState, type FormEvent } from 'react';
import type { DadosPrazo, Orgao } from '../../dados';
import { TAMANHO_PRAZO } from '../../dados/limites';
import { dadosDoPrazo, errosDoPrazo, MODOS_DO_PRAZO, type FormDoPrazo as Form, type ModoDoPrazo } from '../../regras/andamentos';
import { fmtData } from '../../regras/pessoa';
import { CONTAGENS, PRAZO_MAXIMO_DIAS, type Contagem } from '../../regras/prazos';
import { falha } from '../../ui/avisos';
import { Aviso, Campo, Escolhas, estiloBotao, Nota, propsDoCampo } from '../../ui/base';
import { Resultado } from '../calendario/CalcularPrazo';
import { useContagem } from '../calendario/useContagem';
import '../Calendario.css';

interface Props {
  inicial: Form;
  /** O órgão do processo, se está cadastrado em Feriados e prazos. */
  orgao: Orgao | null;
  /** A sigla do órgão do processo: para avisar quando ela não está cadastrada. */
  siglaDoProcesso: string | null;
  /** Mudando um prazo que já existe (a data calculada pode ter mudado com o calendário). */
  mudando?: boolean;
  aoSalvar: (dados: DadosPrazo) => Promise<void>;
  aoCancelar: () => void;
}

export function FormDoPrazo({ inicial, orgao, siglaDoProcesso, mudando, aoSalvar, aoCancelar }: Props) {
  const id = useId();
  const [f, setF] = useState(inicial);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const mudar = (m: Partial<Form>) => setF(x => ({ ...x, ...m }));

  const { resultado, foraDoRecesso } = useContagem({ orgao, intimacao: f.intimacao, dias: Number(f.dias), contagem: f.contagem, disponibilizacao: f.disponibilizacao, semRecesso: f.semRecesso });
  const contado = typeof resultado === 'object' ? resultado : null;
  const finalCalculado = contado?.final ?? null;
  const erros = conferido ? errosDoPrazo(f, finalCalculado) : {};

  function escolherModo(modo: ModoDoPrazo) {
    // Passando a digitar, a data calculada vira o ponto de partida.
    mudar(modo === 'digitar' && finalCalculado && !f.final ? { modo, final: finalCalculado } : { modo });
  }
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDoPrazo(f, finalCalculado)).length) return;
    setOcupado(true);
    try { await aoSalvar(dadosDoPrazo(f, finalCalculado)); } catch (e) { falha(e); setOcupado(false); }
  }

  return <form className="acomp-form" noValidate aria-label={mudando ? 'Mudar prazo' : 'Novo prazo'} onSubmit={salvar}>
    <Campo rotulo="Que prazo é este" para={id + 'desc'} obrigatorio erro={erros.descricao} dica="Ex.: Contestação, Recurso, Cumprir exigência.">
      <input type="text" {...propsDoCampo(id + 'desc', { dica: true, erro: erros.descricao })} maxLength={TAMANHO_PRAZO.descricao} value={f.descricao} onChange={e => mudar({ descricao: e.target.value })} />
    </Campo>
    <Escolhas rotulo="Como definir a data">
      {(Object.keys(MODOS_DO_PRAZO) as ModoDoPrazo[]).map(m => <label key={m}>
        <input type="radio" name={id + 'modo'} checked={f.modo === m} onChange={() => escolherModo(m)} />{MODOS_DO_PRAZO[m]}
      </label>)}
    </Escolhas>

    {f.modo === 'digitar'
      ? <Campo rotulo="Último dia" para={id + 'final'} obrigatorio erro={erros.final}>
          <input type="date" {...propsDoCampo(id + 'final', { erro: erros.final })} value={f.final} onChange={e => mudar({ final: e.target.value })} />
        </Campo>
      : <>
        {siglaDoProcesso && !orgao && <Aviso tipo="info">O órgão {siglaDoProcesso} não está cadastrado em Feriados e prazos: a conta usa só os feriados nacionais e os dias lançados para todos os órgãos.</Aviso>}
        {!siglaDoProcesso && <Aviso tipo="info">Este processo não tem órgão: a conta usa só os feriados nacionais e os dias lançados para todos os órgãos.</Aviso>}
        <div className="acomp-form-linha">
          <Campo rotulo={f.disponibilizacao ? 'Disponibilização' : 'Intimação'} para={id + 'data'}>
            <input type="date" {...propsDoCampo(id + 'data')} value={f.intimacao} onChange={e => mudar({ intimacao: e.target.value })} />
          </Campo>
          <Campo rotulo="Dias" para={id + 'dias'}>
            <input type="number" inputMode="numeric" {...propsDoCampo(id + 'dias')} min={1} max={PRAZO_MAXIMO_DIAS} value={f.dias} onChange={e => mudar({ dias: e.target.value })} />
          </Campo>
        </div>
        <Escolhas rotulo="Contagem">
          {(Object.keys(CONTAGENS) as Contagem[]).map(c => <label key={c}>
            <input type="radio" name={id + 'contagem'} checked={f.contagem === c} onChange={() => mudar({ contagem: c })} />{CONTAGENS[c]}
          </label>)}
        </Escolhas>
        <label className="calc-dje">
          <input type="checkbox" checked={f.disponibilizacao} onChange={e => mudar({ disponibilizacao: e.target.checked })} />
          Saiu no Diário eletrônico: a data acima é a da disponibilização, e a publicação é o dia útil seguinte
        </label>
        {orgao?.recesso && <label className="calc-dje">
          <input type="checkbox" checked={f.semRecesso} onChange={e => mudar({ semRecesso: e.target.checked })} />
          Este prazo não se suspende no recesso (réu preso, Lei Maria da Penha, medida urgente, prazo de direito material)
        </label>}
        <div className="calc-resultado" role="status" aria-live="polite" aria-label="Resultado do prazo">
          {resultado === null ? <Nota>Calculando…</Nota>
            : typeof resultado === 'string' ? <Aviso tipo="info">{resultado}</Aviso>
            : <Resultado prazo={resultado} contagem={f.contagem} orgao={orgao} foraDoRecesso={foraDoRecesso} />}
        </div>
        {mudando && inicial.final && finalCalculado && finalCalculado !== inicial.final &&
          <Aviso tipo="info">Ao salvar, o último dia muda de {fmtData(inicial.final)} para {fmtData(finalCalculado)}. Para manter a data, escolha "Digitar a data".</Aviso>}
        {erros.calculo && <Aviso tipo="erro">{erros.calculo}</Aviso>}
        <Nota>Confira sempre no tribunal: uma portaria nova pode mudar o prazo.</Nota>
      </>}

    <div className="acomp-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : mudando ? 'Salvar prazo' : 'Lançar prazo'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}
