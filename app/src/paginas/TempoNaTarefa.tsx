// O tempo no cartão da tarefa: o cronômetro de quem está com o cartão aberto ("Seu tempo nesta tarefa": Iniciar,
// Pausar e Retomar, também pela tecla T), o ajuste à mão com motivo, a lista dos registros para mudar e apagar (#400) e, com a tarefa concluída, o esforço da equipe (o total, da criação à conclusão
// e a parte de cada um em %). Cada um vê só o próprio tempo; os administradores veem a duração de cada um e os ajustes.
// Desde a #383, ele fica numa faixa própria, logo abaixo da faixa das datas (a mesma peça, GrupoDeDatas, em ui/base): o relógio e a
// situação (pausado ou contando) lado a lado e, logo depois, Iniciar/Pausar e "Ajustar meu tempo" um em cima do outro (#434), numa
// linha só, encostada à esquerda (#436), num dado largo, e o resumo de quem registrou tempo embaixo deles, na mesma faixa (LinhaDoGrupo). No cartão da demanda, a mesma faixa mostra a soma do tempo nas tarefas dela.
// Desde a #397 (pedido do dono de 20/11), o tempo total da tarefa (o da equipe toda) entra na faixa das datas, como o último dado, à
// direita ("Tempo total"), e o resumo de quem registrou tempo não o repete. Quem só lê o vê quando o banco o devolve (totalAparece). Uma peça só (DadosDaTarefa)
// lê o tempo e desenha as duas faixas: o cronômetro liga uma vez só (duas vezes, gravaria o tempo em dobro), e o total acompanha o
// relógio de quem está contando.
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { SD, type RegistroDeTempo, type Tarefa, type TempoDaTarefa } from '../dados';
import { TAMANHO_MOTIVO } from '../dados/limites';
import { errosDoAjuste, fmtDecorrido, fmtDuracao, fmtRelogio, lerAjuste, parteDeCadaUmAparece, partesAoVivo, somaDoTempo, totalAoVivo, totalAparece,
  type ParteDoTempo } from '../regras/cronometro';
import { fmtData } from '../regras/pessoa';
import { conferirCorrecao, diaDoRegistro, duracaoDoRegistro, duracaoParaEscrever, emAndamento, MOTIVO_DO_DESFAZER, NOME_DO_TIPO, possoMexer, registrosEmOrdem,
  talvezContando, tipoDoRegistro, type CamposDaCorrecao } from '../regras/registrosDeTempo';
import { Avatar } from '../ui/Avatar';
import { avisar, falha, feito, sinalizarMudanca } from '../ui/avisos';
import { Aviso, Campo, CampoData, Carregando, Contador, DadoDoGrupo, estiloBotao, FaixaDasDatas, GrupoDeDatas, LinhaDoGrupo, Nota, Selo, Tecla } from '../ui/base';
import { Botao, BotaoDuplo } from '../ui/Botoes';
import { useAtalhosLigados } from '../ui/atalhos';
import { Icone, ICONE_DO_MINI } from '../ui/Icone';
import { janela } from '../ui/janela';
import { useCtx } from '../ui/sessao';
import { dataCurta, hojeISO } from '../ui/util';
import { TECLA_DO_CRONOMETRO, useCronometro } from './useCronometro';

/** O nome da faixa do tempo no cartão (da tarefa e da demanda), logo abaixo da faixa das datas. */
const FAIXA_DO_TEMPO = 'Tempo';
/** O nome do cronômetro na faixa do tempo. */
const ROTULO_DO_TEMPO = 'Seu tempo nesta tarefa';
/** O nome do tempo total da tarefa, o último dado da faixa das datas (#397). */
export const ROTULO_DO_TEMPO_TOTAL = 'Tempo total';

/** A situação do relógio, na pílula ao lado dele: parado, contando ou, na tarefa concluída, encerrado. */
type SituacaoDoRelogio = 'pausado' | 'contando' | 'encerrado';
/**
 * O que a pílula de cada situação diz e a dica dela. Na tarefa concluída (#434), a pílula diz "encerrado", e a frase de antes
 * ("Tarefa concluída: a contagem encerrou.") virou a dica dela, em vez de um segundo texto ao lado do botão.
 */
const SITUACAO: Record<SituacaoDoRelogio, { texto: string; dica?: string }> = {
  pausado: { texto: 'pausado' },
  contando: { texto: 'contando' },
  encerrado: { texto: 'encerrado', dica: 'Tarefa concluída: a contagem encerrou.' }
};
const situacaoDoRelogio = (concluida: boolean, contando: boolean): SituacaoDoRelogio =>
  concluida ? 'encerrado' : contando ? 'contando' : 'pausado';

/** O tempo lido do banco: chegando (null), lido, ou a mensagem do erro. */
type TempoLido = TempoDaTarefa | string | null;
type EstadoDoTempo = 'lendo' | 'lido' | 'erro';
const estadoDoTempo = (x: TempoLido): EstadoDoTempo => x === null ? 'lendo' : typeof x === 'string' ? 'erro' : 'lido';
/** O que o tempo total mostra em cada estado. Enquanto lê, o lugar do valor já está lá, e a faixa não pula. */
const TEXTO_DO_TOTAL: Record<EstadoDoTempo, (segundos: number) => string> = {
  lendo: () => '…',
  lido: segundos => fmtDuracao(segundos),
  erro: () => '—'
};
/** A dica do tempo total que não pôde ser lido. */
const TOTAL_SEM_LEITURA = 'Não foi possível ler o tempo agora';

interface PropsDosDados {
  t: Tarefa;
  /** Quem altera a tarefa tem o cronômetro ("Seu tempo nesta tarefa"); os outros veem só o total, quando o banco o devolve. */
  podeAlterar: boolean;
  /** As outras datas da faixa (o início e o prazo), entre a criação e o tempo total. */
  datas: ReactNode;
}

/**
 * Os dados da tarefa (#397): a faixa das datas, com o tempo total como o último dado, e, para quem altera, a faixa do tempo
 * logo abaixo (o cronômetro e o resumo). O tempo é lido uma vez aqui, para as duas.
 */
export function DadosDaTarefa({ t, podeAlterar, datas }: PropsDosDados) {
  const [tempo, setTempo] = useState<TempoLido>(null);
  const carregar = useCallback(() => SD.tempoDaTarefa(t.id).then(setTempo).catch(e => setTempo((e as Error).message)), [t.id]);
  useEffect(() => { void carregar(); }, [carregar]);
  if (!podeAlterar) return <FaixaComTotal t={t} datas={datas} tempo={tempo} />;
  return <TempoNaTarefa t={t} tempo={tempo} carregar={carregar} datas={datas} />;
}

/** O relógio aberto de quem está com o cartão: o que ele conta e ainda não está no total gravado. */
interface RelogioAberto { eu: string; periodoId: number | null; segundos: number }

/**
 * A faixa das datas da tarefa, com o tempo total à direita; com o relógio aberto (quem altera a tarefa), o total o acompanha. Sem
 * ele (quem só lê), o total só entra quando o banco o devolve: enquanto lê, ou se a leitura falha, o dado não aparece.
 */
function FaixaComTotal({ t, datas, tempo, relogio }: { t: Tarefa; datas: ReactNode; tempo: TempoLido; relogio?: RelogioAberto }) {
  const estado = estadoDoTempo(tempo);
  const lido = typeof tempo === 'string' ? null : tempo;
  const total = !lido ? 0 : relogio ? totalAoVivo(lido, relogio.eu, relogio.periodoId, relogio.segundos) : lido.total;
  return <FaixaDasDatas criacao={{ rotulo: 'Criada em', em: t.criado_em }}>
    {datas}
    {totalAparece(!!relogio, total) && <DadoDoGrupo rotulo={ROTULO_DO_TEMPO_TOTAL}>
      <b className="num tempo-total" aria-busy={estado === 'lendo' || undefined}
        title={estado === 'erro' ? TOTAL_SEM_LEITURA : undefined}>{TEXTO_DO_TOTAL[estado](total)}</b>
    </DadoDoGrupo>}
  </FaixaDasDatas>;
}

/** O cronômetro de quem altera a tarefa: a faixa das datas (o total acompanha o relógio) e, logo abaixo, a faixa do tempo. */
function TempoNaTarefa({ t, tempo, carregar, datas }: { t: Tarefa; tempo: TempoLido; carregar: () => Promise<unknown>; datas: ReactNode }) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  // Só conta quando a pessoa inicia; na tarefa concluída, a contagem já encerrou.
  const relogio = useCronometro(t, !t.concluida_em, () => { void carregar(); });
  // Com os atalhos de uma tecla desligados (Minha conta), o T não funciona e o botão não o promete.
  const atalhos = useAtalhosLigados();
  const faixa = <FaixaComTotal t={t} datas={datas} tempo={tempo} relogio={{ eu, periodoId: relogio.periodoId, segundos: relogio.segundos }} />;

  if (tempo === null) return <>{faixa}<FaixaDoTempo rotulo={ROTULO_DO_TEMPO}><Carregando /></FaixaDoTempo></>;
  if (typeof tempo === 'string') return <>{faixa}<FaixaDoTempo rotulo={ROTULO_DO_TEMPO}><Aviso tipo="erro">{tempo}</Aviso></FaixaDoTempo></>;
  // O meu tempo: o que já está gravado (menos o período deste cartão aberto, que o relógio já conta) e o período.
  const gravado = somaDoTempo(tempo.registros.filter(r => r.id !== relogio.periodoId), eu);
  const meu = gravado + relogio.segundos;

  async function ajustar() {
    const campos = await janela<{ tanto: string; motivo: string }>({
      titulo: 'Ajustar meu tempo',
      corpo: <div className="ajuste-tempo">
        <Campo rotulo="Quanto" para="ajuste-tanto" dica={'Ex.: 30min, 1h15, 1:30. Com "-" na frente para tirar (-20min).'}>
          <input id="ajuste-tanto" name="tanto" type="text" className="campo" autoFocus />
        </Campo>
        <Campo rotulo="Motivo" para="ajuste-motivo" dica="Fica registrado junto do ajuste.">
          <input id="ajuste-motivo" name="motivo" type="text" className="campo" maxLength={TAMANHO_MOTIVO} />
        </Campo>
      </div>,
      acoes: [{ rotulo: 'Cancelar', valor: null },
        { rotulo: 'Salvar ajuste', tipo: 'pri', valor: f => ({ tanto: String(f.get('tanto') || ''), motivo: String(f.get('motivo') || '') }) }]
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

  // A faixa do tempo (#383, arrumada na #400, na #434 e na #436): uma linha só, encostada à esquerda: o relógio e a situação, lado
  // a lado, e logo depois os botões, um em cima do outro, da mesma largura; igual no computador e no celular (só numa faixa
  // estreita demais os botões descem). Na tarefa concluída, a pílula diz "encerrado" e só "Ajustar meu tempo" fica, na mesma
  // linha. Embaixo, a parte de cada um (com o meu tempo de agora, como o relógio e o tempo total) e a lista dos registros.
  const situacao = SITUACAO[situacaoDoRelogio(!!t.concluida_em, relogio.contando)];
  const partes = partesAoVivo(tempo, eu, relogio.periodoId, relogio.segundos);
  return <>{faixa}<FaixaDoTempo rotulo={ROTULO_DO_TEMPO} resumo={<div className="tempo-resumo">
    {(t.concluida_em || ctx.ehAdmin) && <TempoDaEquipe t={t} partes={partes} />}
    <RegistrosDoTempo t={t} tempo={tempo} relogio={relogio} carregar={carregar} />
  </div>}>
    <div className="cronometro">
      <span className="cronometro-leitura">
        <span className="cronometro-relogio" role="timer" aria-label={`Seu tempo: ${fmtDuracao(meu)}`}>{fmtRelogio(meu)}</span>
        <span className={'cronometro-situacao' + (relogio.contando ? ' contando' : '')} title={situacao.dica}>{situacao.texto}</span>
      </span>
      <span className="cronometro-acoes">
        {!t.concluida_em && <button type="button" className={estiloBotao({ forma: 'mini' }) + ' cronometro-alternar'} onClick={relogio.alternar}
            {...(atalhos ? { title: `Atalho: tecla ${TECLA_DO_CRONOMETRO.toUpperCase()}`, 'aria-keyshortcuts': TECLA_DO_CRONOMETRO.toUpperCase() } : {})}>
            {relogio.contando ? 'Pausar' : meu ? 'Retomar' : 'Iniciar'}{atalhos && <Tecla>{TECLA_DO_CRONOMETRO.toUpperCase()}</Tecla>}
          </button>}
        <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={ajustar}>Ajustar meu tempo</button>
      </span>
    </div>
  </FaixaDoTempo></>;
}

/** O cronômetro deste cartão, como a lista dos registros precisa dele: qual registro ele conta, se está contando, pausar e soltar. */
type RelogioDoCartao = Pick<ReturnType<typeof useCronometro>, 'periodoId' | 'contando' | 'pausar' | 'soltarPeriodo'>;
interface PropsDosRegistros { t: Tarefa; tempo: TempoDaTarefa; relogio: RelogioDoCartao; carregar: () => Promise<unknown> }

/** O pedido para pausar antes de mexer no registro que o cronômetro está contando. */
const PAUSE_ANTES = 'Pause o cronômetro antes de mudar ou apagar o registro que está contando.';
/** O aviso ao mexer no período recente de outra pessoa, que pode estar contando em outra aba ou aparelho dela (talvezContando). */
const TALVEZ_CONTANDO = 'Este período começou há menos de um dia e pode ainda estar contando em outra aba ou aparelho de quem o registrou. Se estiver, o tempo contado depois desta mudança vai para um registro novo.';
/** O que o aviso diz depois de apagar: o de sempre, ou com a lembrança de que o período apagado podia estar contando. */
const APAGADO = { sempre: 'Registro de tempo apagado.', talvez: 'Registro de tempo apagado. Se ainda estava contando, o tempo seguinte vai para um registro novo.' };
/** O tamanho da bolinha de quem registrou tempo, na parte de cada um e na lista dos registros do administrador. */
const TAMANHO_DO_AVATAR_NO_TEMPO = 22;

/**
 * A lista dos registros de tempo (#400), fechada de início: cada um com o dia, a duração, se veio do cronômetro ou de um ajuste e o
 * motivo, e Mudar e Apagar. Quem não é administrador vê e mexe só nos próprios (o banco nem devolve os dos outros); o administrador,
 * nos de todos, com o nome de quem registrou. Mudar, apagar e o Desfazer acertam o relógio, o total e a parte de cada um, e vão ao
 * histórico da tarefa.
 */
function RegistrosDoTempo({ t, tempo, relogio, carregar }: PropsDosRegistros) {
  const ctx = useCtx();
  const [aberta, setAberta] = useState(false);
  const id = useId();
  const registros = registrosEmOrdem(tempo.registros);
  if (!registros.length) return null;
  const nome = ctx.ehAdmin ? 'Registros de tempo' : 'Meus registros de tempo';

  /** Depois de mexer: o cronômetro solta o registro que contava (se foi ele), a faixa relê o tempo e o cartão, o histórico. */
  async function depoisDeMexer(r: RegistroDeTempo) {
    if (r.id === relogio.periodoId) relogio.soltarPeriodo();
    await carregar();
    sinalizarMudanca();
  }
  async function mudar(r: RegistroDeTempo) {
    const escrito = { dia: fmtData(diaDoRegistro(r.inicio)) };
    const campos = await janela<CamposDaCorrecao>({
      titulo: 'Mudar o registro de tempo',
      corpo: <FormularioDoRegistro r={r} talvez={talvezContando(r, ctx.perfil.id, Date.now())} aoMudarDia={dia => { escrito.dia = dia; }} />,
      acoes: [{ rotulo: 'Cancelar', valor: null },
        { rotulo: 'Salvar', tipo: 'pri', valor: f => ({ duracao: String(f.get('duracao') || ''), dia: escrito.dia, motivo: String(f.get('motivo') || '') }) }]
    });
    if (!campos) return;
    const { erros, correcao } = conferirCorrecao(r, campos, hojeISO());
    if (!correcao) { falha(new Error(erros.duracao || erros.dia || erros.motivo)); return; }
    try {
      await SD.tempoCorrigir(r.id, correcao);
      feito('Registro de tempo mudado.', 'mudança do registro de tempo', async () => {
        await SD.tempoCorrigir(r.id, { segundos: r.segundos, inicio: r.inicio, motivo: MOTIVO_DO_DESFAZER });
        await carregar();
      });
      await depoisDeMexer(r);
    } catch (e) { falha(e); }
  }
  async function apagar(r: RegistroDeTempo) {
    try {
      await SD.tempoApagar(r.id);
      feito(talvezContando(r, ctx.perfil.id, Date.now()) ? APAGADO.talvez : APAGADO.sempre, 'registro de tempo apagado', async () => { await SD.tempoDevolver(t.id, r); await carregar(); });
      await depoisDeMexer(r);
    } catch (e) { falha(e); }
  }
  const pedirPausa = () => { avisar(PAUSE_ANTES, 'erro', { rotulo: 'Pausar', fn: () => { void relogio.pausar(); } }); };

  return <div className="tempo-registros">
    <button type="button" className={estiloBotao({ forma: 'link' }) + ' tempo-registros-abrir'} aria-expanded={aberta} aria-controls={id}
      onClick={() => setAberta(a => !a)}>
      {nome} <Contador>{registros.length}</Contador><Icone nome="abaixo" tam={ICONE_DO_MINI} />
    </button>
    {aberta && <ul id={id} className="tempo-registros-lista" aria-label={nome}>
      {registros.map(r => <LinhaDoRegistro key={r.id} r={r} comNome={ctx.ehAdmin}
        posso={possoMexer(r, ctx.perfil.id, ctx.ehAdmin)} contando={emAndamento(r, relogio.periodoId, relogio.contando)}
        aoMudar={() => mudar(r)} aoApagar={() => apagar(r)} aoPedirPausa={pedirPausa} />)}
    </ul>}
  </div>;
}

interface PropsDaLinha {
  r: RegistroDeTempo; comNome: boolean; posso: boolean; contando: boolean;
  aoMudar: () => unknown; aoApagar: () => unknown; aoPedirPausa: () => void;
}
/** Um registro da lista: o dia e a duração à esquerda, de onde veio e o motivo no meio, Mudar e Apagar à direita. */
function LinhaDoRegistro({ r, comNome, posso, contando, aoMudar, aoApagar, aoPedirPausa }: PropsDaLinha) {
  const ctx = useCtx();
  const dia = dataCurta(r.inicio);
  const membro = ctx.equipe.find(m => m.id === r.perfil_id) ?? { id: r.perfil_id ?? '', nome: 'Usuário removido' };
  return <li className="tempo-registro">
    <span className="tempo-registro-quando">
      <span className="tempo-registro-dia">{dia}</span>
      <b className="tempo-registro-duracao">{duracaoDoRegistro(r)}</b>
    </span>
    <span className="tempo-registro-sobre">
      <span className="tempo-registro-tipo">
        {comNome && <span className="tempo-registro-quem"><Avatar p={membro} tam={TAMANHO_DO_AVATAR_NO_TEMPO} />{membro.nome}</span>}
        <span>{NOME_DO_TIPO[tipoDoRegistro(r)]}</span>
        {contando && <Selo tipo="ok">em andamento</Selo>}
      </span>
      {r.motivo && <span className="tempo-registro-motivo">{r.motivo}</span>}
      {r.motivo_da_correcao && <span className="tempo-registro-motivo">Mudado: {r.motivo_da_correcao}</span>}
    </span>
    {posso && <span className="tempo-registro-acoes">
      {contando
        ? <>
          <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Mudar o registro de ${dia}`} onClick={aoPedirPausa}>Mudar</button>
          <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Apagar o registro de ${dia}`} onClick={aoPedirPausa}>Apagar</button>
        </>
        : <>
          <Botao forma="mini" aria-label={`Mudar o registro de ${dia}`} onClick={aoMudar}>Mudar</Botao>
          <BotaoDuplo forma="mini" variante="perigo" aria-label={`Apagar o registro de ${dia}`} confirmar="Confirmar" aoConfirmar={aoApagar}>Apagar</BotaoDuplo>
        </>}
    </span>}
  </li>;
}

/** A janela de Mudar: a duração (como a pessoa escreve), o dia e o motivo, com o registro como está, para comparar. */
function FormularioDoRegistro({ r, talvez, aoMudarDia }: { r: RegistroDeTempo; talvez: boolean; aoMudarDia: (dia: string) => void }) {
  const [dia, setDia] = useState(() => fmtData(diaDoRegistro(r.inicio)));
  const dicaDaDuracao = r.ajuste ? 'Ex.: 30min, 1h15. Com "-" na frente para tirar (-20min).' : 'Ex.: 45min, 1h20, 1:30 (até 12 horas).';
  return <div className="ajuste-tempo">
    <Nota>Como está: {duracaoDoRegistro(r)} em {dataCurta(r.inicio)} ({NOME_DO_TIPO[tipoDoRegistro(r)].toLowerCase()}).</Nota>
    {talvez && <Aviso tipo="info">{TALVEZ_CONTANDO}</Aviso>}
    <Campo rotulo="Duração" para="registro-duracao" dica={dicaDaDuracao}>
      <input id="registro-duracao" name="duracao" type="text" className="campo" defaultValue={duracaoParaEscrever(r.segundos)} />
    </Campo>
    <Campo rotulo="Dia" para="registro-dia">
      <CampoData id="registro-dia" className="campo" valor={dia} aoMudar={v => { setDia(v); aoMudarDia(v); }} max={hojeISO()} />
    </Campo>
    <Campo rotulo="Motivo" para="registro-motivo" dica="Fica no histórico da tarefa.">
      <input id="registro-motivo" name="motivo" type="text" className="campo" maxLength={TAMANHO_MOTIVO} />
    </Campo>
  </div>;
}

/** A faixa do tempo, logo abaixo da das datas: o dado largo (o cronômetro, o total) e, embaixo dele, o resumo. */
function FaixaDoTempo({ rotulo, resumo, children }: { rotulo: string; resumo?: ReactNode; children: ReactNode }) {
  return <GrupoDeDatas rotulo={FAIXA_DO_TEMPO}>
    <DadoDoGrupo rotulo={rotulo} largo>{children}</DadoDoGrupo>
    {resumo && <LinhaDoGrupo>{resumo}</LinhaDoGrupo>}
  </GrupoDeDatas>;
}

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
 * tarefas, no mesmo desenho do relógio da tarefa. A faixa aparece junto com o cartão (sem tempo, diz que ninguém registrou), para o
 * que vem embaixo não pular quando a soma chega do banco.
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

/**
 * O esforço da equipe: com a tarefa concluída, o tempo da criação à conclusão e a parte de cada um em % (o total está na faixa das
 * datas, #397). Os administradores veem também a duração de cada um (a qualquer momento); os ajustes estão na lista dos registros (#400).
 * A parte de cada um vem com o meu tempo de agora (partesAoVivo, #436), e não aparece quando a única pessoa com tempo é quem está
 * vendo: a linha dela só repetia o relógio e o tempo total.
 */
function TempoDaEquipe({ t, partes }: { t: Tarefa; partes: ParteDoTempo[] }) {
  const ctx = useCtx();
  const membro = (id: string | null) => ctx.equipe.find(m => m.id === id) ?? { id: id ?? '', nome: 'Usuário removido' };
  if (!partes.length) return ctx.ehAdmin ? <div className="tempo-equipe"><Nota>Ninguém registrou tempo nesta tarefa ainda.</Nota></div> : null;
  const comLista = parteDeCadaUmAparece(partes, ctx.perfil.id);
  if (!t.concluida_em && !comLista) return null;
  return <div className="tempo-equipe">
    {t.concluida_em && <p className="tempo-equipe-total">
      Da criação à conclusão: <b className="duracao">{fmtDecorrido(t.criado_em, t.concluida_em)}</b>
    </p>}
    {comLista && <ul className="tempo-equipe-lista" aria-label="Parte de cada um">
      {partes.map(p => <li key={p.perfil_id ?? 'removido'}>
        <span className="tempo-equipe-quem"><Avatar p={membro(p.perfil_id)} tam={TAMANHO_DO_AVATAR_NO_TEMPO} />{membro(p.perfil_id).nome}</span>
        <b className="num">{p.percentual.toLocaleString('pt-BR')}%</b>
        {ctx.ehAdmin && <span className="nota num">{fmtDuracao(p.segundos)}</span>}
      </li>)}
    </ul>}
  </div>;
}
