// Formulário do prazo: calcula pelo calendário do órgão do processo, mostrando como chegou à data e os dias que pulou,
// ou recebe a data digitada à mão. A data calculada é só uma sugestão: ao passar para "Digitar", ela já vem preenchida.
// Como o formulário pequeno das datas do cartão (#395): Esc desfaz só o formulário, sem fechar o cartão; o que foi escrito e não
// lançado é avisado ao cartão, que pergunta antes de fechar; o calendário abre dentro do formulário, logo embaixo da data, sem
// cobrir os outros campos; e a data da intimação escrita errada fica marcada no próprio campo.
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { DadosPrazo, Orgao } from '../../dados';
import { TAMANHO_PRAZO } from '../../dados/limites';
import { dadosDoPrazo, errosDoPrazo, MODOS_DO_PRAZO, type FormDoPrazo as Form, type ModoDoPrazo } from '../../regras/andamentos';
import { erroDaDataEscrita } from '../../regras/campoData';
import { SALVE_OU_CANCELE } from '../../regras/edicaoUnica';
import { fmtData } from '../../regras/pessoa';
import { CONTAGENS, PRAZO_MAXIMO_DIAS, type Contagem } from '../../regras/prazos';
import { falha } from '../../ui/avisos';
import { Aviso, Campo, CampoData, Escolhas, estiloBotao, LugarDoCalendario, Nota, propsDoCampo } from '../../ui/base';
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
  /** Avisa do que foi escrito e ainda não lançado (o formulário como texto, quando ficou diferente do inicial; null quando volta, fecha ou é salvo). */
  aoMudarRascunho?: (rascunho: string | null) => void;
  /** Quantas vezes a pessoa pediu outro prazo com este por salvar: a cada pedido novo, o formulário lembra de salvar ou cancelar. */
  barrados?: number;
}

export function FormDoPrazo({ inicial, orgao, siglaDoProcesso, mudando, aoSalvar, aoCancelar, aoMudarRascunho, barrados = 0 }: Props) {
  const id = useId();
  const [f, setF] = useState(inicial);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [lugarDoCalendario, setLugarDoCalendario] = useState<HTMLDivElement | null>(null);
  // O texto da intimação, como a pessoa escreveu: a data inexistente não chega ao formulário (o campo passa vazio), mas é marcada.
  const [textoDaIntimacao, setTextoDaIntimacao] = useState('');
  const mudar = (m: Partial<Form>) => setF(x => ({ ...x, ...m }));
  const formulario = useRef<HTMLFormElement>(null);

  // O que foi escrito e não lançado vai ao cartão, que pergunta antes de fechar; ao fechar (salvo ou cancelado), não há mais nada.
  const sujo = JSON.stringify(f) !== JSON.stringify(inicial) ? JSON.stringify(f) : null;
  const avisarRascunho = useRef(aoMudarRascunho);
  avisarRascunho.current = aoMudarRascunho;
  useEffect(() => { avisarRascunho.current?.(sujo); }, [sujo]);
  useEffect(() => () => avisarRascunho.current?.(null), []);
  // A pessoa pediu outro prazo com este por salvar: este continua aberto, lembra dela e recebe o foco.
  const [lembrar, setLembrar] = useState(false);
  const vistos = useRef(barrados);
  useEffect(() => {
    if (vistos.current === barrados) return;
    vistos.current = barrados;
    setLembrar(true);
    formulario.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  }, [barrados]);
  function teclar(e: KeyboardEvent<HTMLFormElement>) {
    // Esc desfaz só o formulário, sem fechar o cartão em volta (o calendário aberto fecha antes, sozinho), como as datas do cartão.
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    if (!ocupado) aoCancelar();
  }
  // A data já foi escolhida (digitada, ou é a de um prazo salvo). Enquanto não foi, "Digitar" começa pelo cálculo mais recente.
  const [dataEscolhida, setDataEscolhida] = useState(!!inicial.final);

  const { resultado, foraDoRecesso } = useContagem({ orgao, intimacao: f.intimacao, dias: Number(f.dias), contagem: f.contagem, disponibilizacao: f.disponibilizacao, semRecesso: f.semRecesso });
  const contado = typeof resultado === 'object' ? resultado : null;
  const finalCalculado = contado?.final ?? null;
  const erros = conferido ? errosDoPrazo(f, finalCalculado) : {};

  function escolherModo(modo: ModoDoPrazo) {
    // Passando a digitar, a data calculada vira o ponto de partida.
    mudar(modo === 'digitar' && !dataEscolhida ? { modo, final: finalCalculado ?? '' } : { modo });
  }
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDoPrazo(f, finalCalculado)).length) return;
    setOcupado(true);
    try { await aoSalvar(dadosDoPrazo(f, finalCalculado)); } catch (e) { falha(e); setOcupado(false); }
  }

  const erroDaIntimacao = erroDaDataEscrita(textoDaIntimacao) || undefined;
  /** O lugar do calendário, logo embaixo da data: ele abre ali, no fluxo do formulário, e empurra o resto em vez de cobrir. */
  const lugar = <div className="acomp-form-calendario" ref={setLugarDoCalendario} />;

  return <form ref={formulario} className="acomp-form" noValidate aria-label={mudando ? 'Mudar prazo' : 'Novo prazo'} onSubmit={salvar} onKeyDown={teclar}>
    <LugarDoCalendario value={lugarDoCalendario}>
    {lembrar && <Aviso tipo="info">{SALVE_OU_CANCELE}</Aviso>}
    <Campo rotulo="Que prazo é este" para={id + 'desc'} obrigatorio erro={erros.descricao} dica="Ex.: Contestação, Recurso, Cumprir exigência.">
      <input type="text" {...propsDoCampo(id + 'desc', { dica: true, erro: erros.descricao })} maxLength={TAMANHO_PRAZO.descricao} value={f.descricao} onChange={e => mudar({ descricao: e.target.value })} />
    </Campo>
    <Escolhas rotulo="Como definir a data">
      {(Object.keys(MODOS_DO_PRAZO) as ModoDoPrazo[]).map(m => <label key={m}>
        <input type="radio" name={id + 'modo'} checked={f.modo === m} onChange={() => escolherModo(m)} />{MODOS_DO_PRAZO[m]}
      </label>)}
    </Escolhas>

    {f.modo === 'digitar'
      ? <>
        <Campo rotulo="Último dia" para={id + 'final'} obrigatorio erro={erros.final}>
          <CampoData formato="iso" {...propsDoCampo(id + 'final', { erro: erros.final })} valor={f.final} aoMudar={v => { setDataEscolhida(true); mudar({ final: v }); }} />
        </Campo>
        {lugar}
      </>
      : <>
        {siglaDoProcesso && !orgao && <Aviso tipo="info">O órgão {siglaDoProcesso} não está cadastrado em Feriados e prazos: a conta usa só os feriados nacionais e os dias lançados para todos os órgãos.</Aviso>}
        {!siglaDoProcesso && <Aviso tipo="info">Este processo não tem órgão: a conta usa só os feriados nacionais e os dias lançados para todos os órgãos.</Aviso>}
        <div className="acomp-form-linha">
          <Campo rotulo={f.disponibilizacao ? 'Disponibilização' : 'Intimação'} para={id + 'data'} erro={erroDaIntimacao}>
            <CampoData formato="iso" {...propsDoCampo(id + 'data', { erro: erroDaIntimacao })} valor={f.intimacao} aoMudar={v => mudar({ intimacao: v })}
              aoMudarTexto={setTextoDaIntimacao} />
          </Campo>
          <Campo rotulo="Dias" para={id + 'dias'}>
            <input type="number" inputMode="numeric" {...propsDoCampo(id + 'dias')} min={1} max={PRAZO_MAXIMO_DIAS} value={f.dias} onChange={e => mudar({ dias: e.target.value })} />
          </Campo>
        </div>
        {lugar}
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
    </LugarDoCalendario>
  </form>;
}
