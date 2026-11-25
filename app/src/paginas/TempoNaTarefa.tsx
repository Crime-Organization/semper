// O prazo e o tempo no cartão da tarefa (#442, opção 9 aprovada pelo dono em 25/11): um bloco só, "Prazo e tempo", em duas colunas
// (uma embaixo da outra na faixa estreita). À esquerda, o prazo na folhinha (ui/base/PrazoNaFolhinha, montado no CartaoTarefa); à
// direita, para quem altera a tarefa, o relógio de quem está com o cartão aberto ("Seu tempo, contando", a duração e os botões com
// nome: Iniciar, Parar ou Continuar, também pela tecla T, e "Adicionar tempo", o ajuste à mão com motivo, que também tira tempo com
// "-"). Embaixo, a linha da equipe ("Total da equipe … · Ver registros (N)", só quando mais alguém tem tempo) e os registros por
// pessoa, que só aparecem ao abrir (RegistrosDoTempo.tsx). Cada um vê só o próprio tempo; os administradores veem a duração de cada um,
// e os outros, na tarefa concluída, a parte de cada um em %. Quem só lê vê o prazo e o total da equipe (quando o banco o devolve,
// #397), sem botões. Uma peça só (DadosDaTarefa) lê o tempo: o cronômetro liga uma vez só (duas vezes, gravaria o tempo em dobro).
// O cartão da demanda continua com a faixa do tempo (#383): a soma do tempo nas tarefas dela (TempoDaDemanda, no fim do arquivo).
import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react';
import { SD, type Tarefa, type TempoDaTarefa } from '../dados';
import { TAMANHO_MOTIVO } from '../dados/limites';
import { errosDoAjuste, fmtDuracao, lerAjuste, partesDaDuracao, situacaoDoRelogio, somaDoTempo, totalAparece, type SituacaoDoRelogio } from '../regras/cronometro';
import { feito, falha } from '../ui/avisos';
import { Aviso, Campo, Carregando, DadoDoGrupo, estiloBotao, GrupoDeDatas, type VarianteBotao } from '../ui/base';
import { useAtalhosLigados } from '../ui/atalhos';
import { Icone, ICONE_DO_MINI, type NomeIcone } from '../ui/Icone';
import { janela } from '../ui/janela';
import { useCtx } from '../ui/sessao';
import { TempoDaEquipe } from './RegistrosDoTempo';
import { TECLA_DO_CRONOMETRO, useCronometro } from './useCronometro';

/** O nome do bloco do prazo e do tempo, para o leitor de tela e para os testes. */
export const PRAZO_E_TEMPO = 'Prazo e tempo';
/** O nome do relógio de quem está com o cartão. */
export const SEU_TEMPO = 'Seu tempo';
/** O nome do botão e da janela do ajuste à mão. */
export const ADICIONAR_TEMPO = 'Adicionar tempo';

/** A linha de cima do relógio em cada situação: a marca (o ponto que pulsa, a pausa, o cadeado) e a palavra depois de "Seu tempo,". */
const ESTADO: Record<SituacaoDoRelogio, { marca: ReactNode; palavra: string | null }> = {
  zerado: { marca: null, palavra: null },
  contando: { marca: <span className="seu-tempo-pulso" aria-hidden="true" />, palavra: 'contando' },
  parado: { marca: <Icone nome="pausa" tam={ICONE_DO_MINI} />, palavra: 'parado' },
  encerrado: { marca: <Icone nome="cadeado" tam={ICONE_DO_MINI} />, palavra: 'encerrado' }
};
/** O botão do relógio em cada situação; na tarefa concluída, nenhum (a contagem encerrou). */
const BOTAO: Record<SituacaoDoRelogio, { rotulo: string; icone: NomeIcone; variante: VarianteBotao } | null> = {
  zerado: { rotulo: 'Iniciar', icone: 'iniciar', variante: 'principal' },
  contando: { rotulo: 'Parar', icone: 'parar', variante: 'padrao' },
  parado: { rotulo: 'Continuar', icone: 'iniciar', variante: 'principal' },
  encerrado: null
};

/** O tempo lido do banco: chegando (null), lido, ou a mensagem do erro. */
type TempoLido = TempoDaTarefa | string | null;

interface PropsDosDados {
  t: Tarefa;
  /** Quem altera a tarefa tem o relógio ("Seu tempo"); os outros veem só o total, quando o banco o devolve. */
  podeAlterar: boolean;
  /** O prazo na folhinha (PrazoNaFolhinha), à esquerda do bloco. */
  prazo: ReactNode;
}

/** Os dados da tarefa (#442): o bloco "Prazo e tempo" e, embaixo, a linha da equipe. O tempo é lido uma vez aqui. */
export function DadosDaTarefa({ t, podeAlterar, prazo }: PropsDosDados) {
  const [tempo, setTempo] = useState<TempoLido>(null);
  const carregar = useCallback(() => SD.tempoDaTarefa(t.id).then(setTempo).catch(e => setTempo((e as Error).message)), [t.id]);
  useEffect(() => { void carregar(); }, [carregar]);
  if (!podeAlterar) return <PrazoETempoLidos prazo={prazo} tempo={tempo} />;
  return <TempoNaTarefa t={t} tempo={tempo} carregar={carregar} prazo={prazo} />;
}

/** O bloco do prazo e do tempo: as duas colunas lado a lado (uma embaixo da outra, na faixa estreita). */
const BlocoDoPrazoETempo = ({ children }: { children: ReactNode }) =>
  <div className="prazo-e-tempo" role="group" aria-label={PRAZO_E_TEMPO}>{children}</div>;

/** A linha "Total da equipe 2 h" (sem os registros), para quem só lê. */
const LinhaDoTotal = ({ segundos }: { segundos: number }) => <div className="tempo-da-equipe" role="group" aria-label="Tempo da equipe">
  <p className="tempo-da-equipe-linha"><span>Total da equipe <b className="num">{fmtDuracao(segundos)}</b></span></p>
</div>;

/**
 * Quem só lê a tarefa: o prazo e, quando o banco o devolve maior que zero (#397: a quem vê a tarefa só pela chave "A equipe vê tudo",
 * o banco não o devolve), o total da equipe. Sem relógio e sem botões.
 */
function PrazoETempoLidos({ prazo, tempo }: { prazo: ReactNode; tempo: TempoLido }) {
  const total = tempo && typeof tempo !== 'string' ? tempo.total : 0;
  return <>
    <BlocoDoPrazoETempo>{prazo}</BlocoDoPrazoETempo>
    {totalAparece(false, total) && <LinhaDoTotal segundos={total} />}
  </>;
}

/** O relógio: o número grande e a unidade menor ("1 h 05 min"), com espaços de verdade, para o texto ser o de sempre. */
function Relogio({ segundos, zerado }: { segundos: number; zerado: boolean }) {
  return <p className={'seu-tempo-relogio' + (zerado ? ' zerado' : '')} role="timer" aria-label={`${SEU_TEMPO}: ${fmtDuracao(segundos)}`}>
    {partesDaDuracao(segundos).map((p, i) => <Fragment key={i}>{i > 0 && ' '}{p.numero} <span className="seu-tempo-unidade">{p.unidade}</span></Fragment>)}
  </p>;
}

/** O relógio de quem altera a tarefa, ao lado do prazo, e a linha da equipe embaixo. */
function TempoNaTarefa({ t, tempo, carregar, prazo }: { t: Tarefa; tempo: TempoLido; carregar: () => Promise<unknown>; prazo: ReactNode }) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  // Só conta quando a pessoa inicia; na tarefa concluída, a contagem já encerrou.
  const relogio = useCronometro(t, !t.concluida_em, () => { void carregar(); });
  // Com os atalhos de uma tecla desligados (Minha conta), o T não funciona e o botão não o promete.
  const atalhos = useAtalhosLigados();
  const lido = tempo && typeof tempo !== 'string' ? tempo : null;
  // O meu tempo: o que já está gravado (menos o período deste cartão aberto, que o relógio já conta) e o período.
  const meu = (lido ? somaDoTempo(lido.registros.filter(r => r.id !== relogio.periodoId), eu) : 0) + relogio.segundos;
  const situacao = situacaoDoRelogio(!!t.concluida_em, relogio.contando, meu);
  const estado = ESTADO[situacao], botao = BOTAO[situacao], tecla = TECLA_DO_CRONOMETRO.toUpperCase();

  async function ajustar() {
    const campos = await janela<{ tanto: string; motivo: string }>({
      titulo: ADICIONAR_TEMPO,
      corpo: <div className="ajuste-tempo">
        <Campo rotulo="Quanto" para="ajuste-tanto" dica={'Ex.: 30min, 1h15, 1:30. Com "-" na frente para tirar (-20min).'}>
          <input id="ajuste-tanto" name="tanto" type="text" className="campo" autoFocus />
        </Campo>
        <Campo rotulo="Motivo" para="ajuste-motivo" dica="Fica registrado junto do ajuste.">
          <input id="ajuste-motivo" name="motivo" type="text" className="campo" maxLength={TAMANHO_MOTIVO} />
        </Campo>
      </div>,
      acoes: [{ rotulo: 'Cancelar', valor: null },
        // "Salvar", e não "Adicionar": a mesma janela também tira tempo ("-20min").
        { rotulo: 'Salvar', tipo: 'pri', valor: f => ({ tanto: String(f.get('tanto') || ''), motivo: String(f.get('motivo') || '') }) }]
    });
    if (!campos) return;
    const erros = errosDoAjuste(campos.tanto, campos.motivo);
    if (erros.tanto || erros.motivo) { falha(new Error(erros.tanto || erros.motivo)); return; }
    try {
      const segundos = lerAjuste(campos.tanto);
      await SD.tempoAjustar(t.id, segundos, campos.motivo);
      // Desfazer é um ajuste ao contrário (o ajuste fica registrado; para tirá-lo, apague-o na lista dos registros).
      feito(`Tempo ajustado: ${segundos > 0 ? '+' : '−'}${fmtDuracao(Math.abs(segundos))}.`, 'ajuste de tempo',
        async () => { await SD.tempoAjustar(t.id, -segundos, `Desfeito: ${campos.motivo.trim()}`); await carregar(); });
      await carregar();
    } catch (e) { falha(e); }
  }

  // Enquanto lê, o lugar do relógio fica reservado, e os botões esperam (sem o tempo gravado, não se sabe se é Iniciar ou Continuar).
  const leitura: Record<'lendo' | 'erro' | 'lido', ReactNode> = {
    lendo: <div className="seu-tempo-lendo"><Carregando /></div>,
    erro: <Aviso tipo="erro">{typeof tempo === 'string' ? tempo : ''}</Aviso>,
    lido: <Relogio segundos={meu} zerado={situacao === 'zerado'} />
  };
  return <>
    <BlocoDoPrazoETempo>
      {prazo}
      <div className="seu-tempo" role="group" aria-label={SEU_TEMPO}>
        <p className="seu-tempo-estado">{estado.marca}<span>{SEU_TEMPO}{estado.palavra && <>, <b>{estado.palavra}</b></>}</span></p>
        {leitura[tempo === null ? 'lendo' : lido ? 'lido' : 'erro']}
        {lido && <div className="seu-tempo-acoes">
          {botao && <button type="button" className={estiloBotao({ variante: botao.variante }, 'seu-tempo-botao')} onClick={relogio.alternar}
            {...(atalhos ? { title: `${botao.rotulo} (tecla ${tecla})`, 'aria-keyshortcuts': tecla } : {})}>
            <Icone nome={botao.icone} tam={ICONE_DO_MINI} />{botao.rotulo}
          </button>}
          <button type="button" className={estiloBotao({}, 'seu-tempo-botao')} onClick={ajustar}><Icone nome="mais" tam={ICONE_DO_MINI} />{ADICIONAR_TEMPO}</button>
        </div>}
      </div>
    </BlocoDoPrazoETempo>
    {lido && <TempoDaEquipe t={t} tempo={lido} relogio={relogio} carregar={carregar} />}
  </>;
}

/** A faixa do tempo do cartão da demanda (#383), logo abaixo da das datas: o dado largo (a soma), na largura toda. */
function FaixaDoTempo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <GrupoDeDatas rotulo={FAIXA_DO_TEMPO}>
    <DadoDoGrupo rotulo={rotulo} largo>{children}</DadoDoGrupo>
  </GrupoDeDatas>;
}

/** O nome da faixa do tempo no cartão da demanda, logo abaixo da faixa das datas. */
const FAIXA_DO_TEMPO = 'Tempo';
/** O nome do dado na faixa do tempo da demanda: a soma do tempo de todos nas tarefas dela. */
const ROTULO_DA_SOMA = 'Tempo da equipe nas tarefas';

/** Em que pé está a soma do tempo da demanda: chegando do banco, com tempo, sem tempo ainda ou com erro. */
type EstadoDaSoma = 'somando' | 'com-tempo' | 'sem-tempo' | 'erro';
type Soma = number | 'erro' | null;
const estadoDaSoma = (s: Soma): EstadoDaSoma => s === null ? 'somando' : s === 'erro' ? 'erro' : s > 0 ? 'com-tempo' : 'sem-tempo';
/** O que a faixa mostra em cada estado. Enquanto soma, o lugar do valor já está lá, na mesma altura, e o cartão não pula. */
const TEXTO_DA_SOMA: Record<EstadoDaSoma, (segundos: number) => string> = {
  'somando': () => '…',
  'com-tempo': segundos => fmtDuracao(segundos),
  'sem-tempo': () => 'Ninguém registrou tempo ainda',
  'erro': () => 'Não foi possível somar agora'
};

/**
 * No cartão da demanda, na faixa do tempo logo abaixo das datas (#383): o esforço aproximado dela, a soma do tempo de todos nas
 * tarefas, no tamanho do relógio da tarefa (--texto-do-relogio). A faixa aparece junto com o cartão (sem tempo, diz que ninguém
 * registrou), para o que vem embaixo não pular quando a soma chega do banco.
 */
export function TempoDaDemanda({ demandaId, versao }: { demandaId: string; versao: number }) {
  const [segundos, setSegundos] = useState<Soma>(null);
  useEffect(() => { SD.tempoDaDemanda(demandaId).then(setSegundos).catch(() => setSegundos('erro')); }, [demandaId, versao]);
  const estado = estadoDaSoma(segundos);
  return <FaixaDoTempo rotulo={ROTULO_DA_SOMA}>
    <span className={'tempo-da-demanda ' + estado} aria-busy={estado === 'somando' || undefined}>
      {TEXTO_DA_SOMA[estado](typeof segundos === 'number' ? segundos : 0)}
    </span>
  </FaixaDoTempo>;
}
