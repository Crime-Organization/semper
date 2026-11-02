// Calcular um prazo pelo calendário: escolhe o órgão, a data da intimação, os dias e a contagem, e vê o último dia e
// cada dia que ficou de fora, com o motivo. Usa os mesmos dias que os prazos dos processos vão usar.
import { useState } from 'react';
import type { Orgao } from '../../dados';
import { DIAS_INICIAIS_DO_PRAZO } from '../../regras/andamentos';
import { diaDaSemana, pulosEmPeriodos } from '../../regras/calendario';
import { fmtData } from '../../regras/pessoa';
import { CONTAGENS, PRAZO_MAXIMO_DIAS, type Contagem, type PrazoContado } from '../../regras/prazos';
import { Aviso, Cartao, Escolhas, naGrade, Nota, TituloSecao } from '../../ui/base';
import { hojeISO } from '../../ui/util';
import { useContagem } from './useContagem';

const SEM_ORGAO = '';

/** A data com o dia da semana: "quarta-feira, 27/01/2027". */
const porExtenso = (iso: string) => `${diaDaSemana(iso)}, ${fmtData(iso)}`;

export function CalcularPrazo({ orgaos, versao }: { orgaos: Orgao[]; versao: number }) {
  const [orgaoId, setOrgaoId] = useState(SEM_ORGAO);
  const [intimacao, setIntimacao] = useState(() => hojeISO());
  const [dias, setDias] = useState(String(DIAS_INICIAIS_DO_PRAZO));
  const [contagem, setContagem] = useState<Contagem>('corridos');
  const [disponibilizacao, setDisponibilizacao] = useState(false);
  const [semRecesso, setSemRecesso] = useState(false);

  const orgao = orgaos.find(o => o.id === orgaoId) ?? null;
  const seguindoRecesso = !!orgao?.recesso;
  const { resultado, foraDoRecesso } = useContagem({ orgao, intimacao, dias: Number(dias), contagem, disponibilizacao, semRecesso, versao });

  function escolherOrgao(id: string) {
    setOrgaoId(id);
    setContagem(orgaos.find(o => o.id === id)?.contagem_padrao ?? 'corridos');
  }

  return <section className="cartao form-grade calc-prazo" aria-labelledby="tCalc">
    <TituloSecao id="tCalc">Calcular um prazo</TituloSecao>
    <div className="grade-form campos">
      <div className="campo-form" style={naGrade({ m: 6, g: 3 })}>
        <label htmlFor="cp-orgao">Órgão</label>
        <select id="cp-orgao" value={orgaoId} onChange={e => escolherOrgao(e.target.value)}>
          <option value={SEM_ORGAO}>Sem órgão (só feriados nacionais)</option>
          {orgaos.map(o => <option key={o.id} value={o.id}>{o.sigla}{o.nome ? ` (${o.nome})` : ''}</option>)}
        </select>
      </div>
      <div className="campo-form" style={naGrade({ p: 7, m: 3, g: 3 })}>
        <label htmlFor="cp-intimacao">{disponibilizacao ? 'Disponibilização' : 'Intimação'}</label>
        <input id="cp-intimacao" type="date" value={intimacao} onChange={e => setIntimacao(e.target.value)} />
      </div>
      <div className="campo-form" style={naGrade({ p: 5, m: 3, g: 2 })}>
        <label htmlFor="cp-dias">Dias</label>
        <input id="cp-dias" type="number" inputMode="numeric" min={1} max={PRAZO_MAXIMO_DIAS} value={dias} onChange={e => setDias(e.target.value)} />
      </div>
      <div style={naGrade({ g: 4 })}>
        <Escolhas rotulo="Contagem">
          {(Object.keys(CONTAGENS) as Contagem[]).map(c => <label key={c}>
            <input type="radio" name="cp-contagem" value={c} checked={contagem === c} onChange={() => setContagem(c)} />{CONTAGENS[c]}
          </label>)}
        </Escolhas>
      </div>
    </div>
    <label className="calc-dje">
      <input type="checkbox" checked={disponibilizacao} onChange={e => setDisponibilizacao(e.target.checked)} />
      Saiu no Diário eletrônico: a data acima é a da disponibilização, e a publicação é o dia útil seguinte
    </label>
    {seguindoRecesso && <label className="calc-dje">
      <input type="checkbox" checked={semRecesso} onChange={e => setSemRecesso(e.target.checked)} />
      Este prazo não se suspende no recesso (réu preso, Lei Maria da Penha, medida urgente, prazo de direito material)
    </label>}

    <div className="calc-resultado" role="status" aria-live="polite" aria-label="Resultado do prazo">
      {resultado === null ? <Nota>Calculando…</Nota>
        : typeof resultado === 'string' ? <Aviso tipo="info">{resultado}</Aviso>
        : <Resultado prazo={resultado} contagem={contagem} orgao={orgao} foraDoRecesso={foraDoRecesso} />}
    </div>
    <Nota>O cálculo usa o calendário abaixo. Confira sempre no tribunal: uma portaria nova pode mudar o prazo.</Nota>
  </section>;
}

/** O último dia e como ele foi contado: aqui e no formulário de prazo do cartão do processo. */
export function Resultado({ prazo, contagem, orgao, foraDoRecesso }: { prazo: PrazoContado; contagem: Contagem; orgao: Orgao | null; foraDoRecesso: string | null }) {
  const pulos = pulosEmPeriodos(prazo.pulados);
  return <Cartao className="calc-final">
    <p className="calc-ultimo">Último dia: <b>{porExtenso(prazo.final)}</b></p>
    {foraDoRecesso && <Aviso tipo="info">Este prazo atravessa o recesso. Se ele não se suspender (réu preso, Lei Maria da Penha, medida urgente, prazo de direito material), o último dia é {porExtenso(foraDoRecesso)}.</Aviso>}
    <dl className="calc-datas">
      <div><dt>Publicação</dt><dd>{porExtenso(prazo.publicacao)}</dd></div>
      <div><dt>Primeiro dia contado</dt><dd>{porExtenso(prazo.inicio)}</dd></div>
      <div><dt>Contagem</dt><dd>{CONTAGENS[contagem]}{orgao ? `, ${orgao.sigla}` : ', sem órgão'}</dd></div>
    </dl>
    {pulos.length ? <>
      <h3 className="calc-pulos-titulo">Dias que ficaram de fora</h3>
      <ul className="calc-pulos" aria-label="Dias que ficaram de fora">
        {pulos.map(p => <li key={p.de}><b>{p.de === p.ate ? fmtData(p.de) : `${fmtData(p.de)} a ${fmtData(p.ate)}`}</b> {p.motivo}</li>)}
      </ul>
    </> : <Nota>Nenhum dia ficou de fora.</Nota>}
  </Cartao>;
}
