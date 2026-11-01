// Calcular um prazo pelo calendário: escolhe o órgão, a data da intimação, os dias e a contagem, e vê o último dia e
// cada dia que ficou de fora, com o motivo. Usa os mesmos dias que os prazos dos processos vão usar.
import { useEffect, useState } from 'react';
import { SD, type DiaLancado, type Orgao } from '../../dados';
import { anosDoPrazo, diaDaSemana, diasDoOrgao, pulosEmPeriodos } from '../../regras/calendario';
import { fmtData } from '../../regras/pessoa';
import { CONTAGENS, contarPrazo, erroDoPrazo, PRAZO_MAXIMO_DIAS, type Contagem, type PrazoContado } from '../../regras/prazos';
import { Aviso, Cartao, Escolhas, naGrade, Nota, TituloSecao } from '../../ui/base';
import { hojeISO } from '../../ui/util';

/** Quantos dias o prazo tem quando a tela abre (o prazo mais comum do CPC, art. 1.003, § 5º). */
const DIAS_INICIAIS = 15;
const SEM_ORGAO = '';

/** A data com o dia da semana: "quarta-feira, 27/01/2027". */
const porExtenso = (iso: string) => `${diaDaSemana(iso)}, ${fmtData(iso)}`;

export function CalcularPrazo({ orgaos, versao }: { orgaos: Orgao[]; versao: number }) {
  const [orgaoId, setOrgaoId] = useState(SEM_ORGAO);
  const [intimacao, setIntimacao] = useState(() => hojeISO());
  const [dias, setDias] = useState(String(DIAS_INICIAIS));
  const [contagem, setContagem] = useState<Contagem>('corridos');
  const [disponibilizacao, setDisponibilizacao] = useState(false);
  const [lancados, setLancados] = useState<{ chave: string; dias: DiaLancado[] } | string | null>(null);

  const orgao = orgaos.find(o => o.id === orgaoId) ?? null;
  const numero = Number(dias);
  const erro = erroDoPrazo({ intimacao, dias: numero });
  // Os dias lançados dos anos que o prazo pode atravessar: busca de novo só quando os anos (ou o calendário) mudam.
  const anos = erro ? null : anosDoPrazo(intimacao, numero);
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

  function escolherOrgao(id: string) {
    setOrgaoId(id);
    setContagem(orgaos.find(o => o.id === id)?.contagem_padrao ?? 'corridos');
  }

  let resultado: PrazoContado | string | null = null;
  if (erro) resultado = erro;
  else if (typeof lancados === 'string') resultado = lancados;
  else if (lancados?.chave === chave) {
    try {
      resultado = contarPrazo({ intimacao, dias: numero, contagem, disponibilizacao, semExpediente: diasDoOrgao(orgao, lancados.dias, anos!) });
    } catch (e) { resultado = (e as Error).message; }
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

    <div className="calc-resultado" role="status" aria-live="polite" aria-label="Resultado do prazo">
      {resultado === null ? <Nota>Calculando…</Nota>
        : typeof resultado === 'string' ? <Aviso tipo="info">{resultado}</Aviso>
        : <Resultado prazo={resultado} contagem={contagem} orgao={orgao} />}
    </div>
    <Nota>O cálculo usa o calendário abaixo. Confira sempre no tribunal: uma portaria nova pode mudar o prazo.</Nota>
  </section>;
}

function Resultado({ prazo, contagem, orgao }: { prazo: PrazoContado; contagem: Contagem; orgao: Orgao | null }) {
  const pulos = pulosEmPeriodos(prazo.pulados);
  return <Cartao className="calc-final">
    <p className="calc-ultimo">Último dia: <b>{porExtenso(prazo.final)}</b></p>
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
