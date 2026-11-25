// O tempo da equipe no cartão da tarefa (#442), embaixo do bloco "Prazo e tempo": numa linha só, o total da equipe (só quando mais
// alguém além de quem olha tem tempo) e o link "Ver registros (N)". Ao abrir, os registros agrupados por pessoa (#400, refeitos na
// #442), cada grupo com o nome ("Você", para quem olha) e o total: a duração para o administrador e para os próprios; para os outros,
// a % do total (só na tarefa concluída, como antes; sempre com uma casa). Cada registro numa linha: quando ("Hoje", "Ontem, 24/11",
// "Hoje, desde 14:10"), de onde veio ("À mão: motivo", "Tirado à mão: motivo", "Mudado: motivo"), a duração numa coluna fixa e o
// lápis e a lixeira (que, armada, vira "Confirmar" no mesmo lugar). O registro que o relógio deste cartão está contando aparece desde
// o Iniciar ("Contando agora", com a duração andando), antes mesmo de ser gravado, e só se muda ou se apaga depois de parar (decisão do dono): o lápis e a
// lixeira dele ficam desligados, com o motivo na dica e na descrição, e o clique não faz nada. Quem não é administrador só recebe os
// próprios registros (o banco nem devolve os dos outros). Mudar, apagar e o Desfazer acertam o relógio, o total e a parte de cada um,
// e vão ao histórico da tarefa.
import { useId, useState, type ReactNode } from 'react';
import { SD, type RegistroDeTempo, type Tarefa, type TempoDaTarefa } from '../dados';
import { TAMANHO_MOTIVO } from '../dados/limites';
import { fmtDecorrido, fmtDuracao, fmtParte, outrosTemTempo, parteDeCadaUmAparece, partesAoVivo, totalAoVivo } from '../regras/cronometro';
import { fmtData } from '../regras/pessoa';
import {
  comOQueConta, conferirCorrecao, diaDoRegistro, duracaoDoRegistro, duracaoParaEscrever, emAndamento, gruposDosRegistros, MOTIVO_DO_DESFAZER, NOME_DO_TIPO,
  ORIGEM_DO_AJUSTE, PARE_ANTES, possoMexer, quandoDoRegistro, sinalDoAjuste, talvezContando, tipoDoRegistro, type CamposDaCorrecao, type GrupoDeRegistros
} from '../regras/registrosDeTempo';
import { falha, feito, sinalizarMudanca } from '../ui/avisos';
import { Aviso, BotaoDeIcone, Campo, CampoData, estiloBotao, Nota } from '../ui/base';
import { Botao, BotaoDuplo } from '../ui/Botoes';
import { Icone, ICONE_DO_MINI } from '../ui/Icone';
import { janela } from '../ui/janela';
import { useCtx } from '../ui/sessao';
import { dataCurta, hojeISO } from '../ui/util';
import type { useCronometro } from './useCronometro';

/** O cronômetro deste cartão, como a linha da equipe precisa dele: qual registro ele conta, quanto, se está contando, e soltar. */
type RelogioDoCartao = Pick<ReturnType<typeof useCronometro>, 'periodoId' | 'inicio' | 'segundos' | 'contando' | 'soltarPeriodo'>;
interface Props { t: Tarefa; tempo: TempoDaTarefa; relogio: RelogioDoCartao; carregar: () => Promise<unknown> }

/** O aviso ao mexer no período recente de outra pessoa, que pode estar contando em outra aba ou aparelho dela (talvezContando). */
const TALVEZ_CONTANDO = 'Este período começou há menos de um dia e pode ainda estar contando em outra aba ou aparelho de quem o registrou. Se estiver, o tempo contado depois desta mudança vai para um registro novo.';
/** O que o aviso diz depois de apagar: o de sempre, ou com a lembrança de que o período apagado podia estar contando. */
const APAGADO = { sempre: 'Registro de tempo apagado.', talvez: 'Registro de tempo apagado. Se ainda estava contando, o tempo seguinte vai para um registro novo.' };
/** A quem não é administrador, quando há tempo de outros: de onde vem o resto do total (os registros deles não vêm). */
export const SO_OS_SEUS = 'Você vê só os seus registros; os dos outros, só eles e os administradores veem.';
/** O nome da lista aberta dos registros, para o leitor de tela e para os testes. */
export const REGISTROS_DE_TEMPO = 'Registros de tempo';

/** O que o link da linha da equipe diz: aberto; fechado com registros (quantos); ou sem registros meus, só com as partes dos outros. */
const textoDoLink = (aberta: boolean, n: number) => aberta ? 'Esconder registros' : n ? `Ver registros (${n})` : 'Ver a parte de cada um';

/**
 * A linha da equipe e, ao abrir, os registros por pessoa. Some quando não há o que mostrar: ninguém além de mim com tempo e nenhum
 * registro visível.
 */
export function TempoDaEquipe({ t, tempo, relogio, carregar }: Props) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [aberta, setAberta] = useState(false);
  const id = useId();
  // A parte de cada um e o total vêm com o meu tempo de agora (#436): o relógio, o total e o meu grupo dizem a mesma coisa.
  const partes = partesAoVivo(tempo, eu, relogio.periodoId, relogio.segundos);
  const total = totalAoVivo(tempo, eu, relogio.periodoId, relogio.segundos);
  // A parte de cada um aparece com a tarefa concluída e, a qualquer momento, para o administrador.
  // O registro que este relógio conta está na lista desde o Iniciar (#442), antes mesmo da primeira gravação no banco: a contagem
  // "Ver registros (N)" e a lista dizem a mesma coisa o tempo todo.
  const { registros, periodoId } = comOQueConta(tempo.registros, eu, relogio.periodoId, relogio.contando, relogio.inicio);
  const grupos = gruposDosRegistros(registros, partes, eu, !!t.concluida_em || ctx.ehAdmin);
  const comTotal = outrosTemTempo(partes, eu), comLista = registros.length > 0 || grupos.length > 1;
  if (!comTotal && !comLista) return null;

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
      corpo: <FormularioDoRegistro r={r} talvez={talvezContando(r, eu, Date.now())} aoMudarDia={dia => { escrito.dia = dia; }} />,
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
      feito(talvezContando(r, eu, Date.now()) ? APAGADO.talvez : APAGADO.sempre, 'registro de tempo apagado', async () => { await SD.tempoDevolver(t.id, r); await carregar(); });
      await depoisDeMexer(r);
    } catch (e) { falha(e); }
  }

  // O nome de cada grupo só aparece quando há mais alguém (#436: sozinho, ele só repetia o relógio).
  const comCabeca = parteDeCadaUmAparece(grupos.map(g => ({ perfil_id: g.perfil_id, segundos: g.segundos, percentual: g.percentual ?? 0 })), eu);
  return <div className="tempo-da-equipe" role="group" aria-label="Tempo da equipe">
    <p className="tempo-da-equipe-linha">
      {comTotal && <span>Total da equipe <b className="num">{fmtDuracao(total)}</b></span>}
      {comTotal && comLista && <span className="tempo-da-equipe-ponto" aria-hidden="true">·</span>}
      {comLista && <button type="button" className={estiloBotao({ forma: 'link' }, 'tempo-da-equipe-abrir')} aria-expanded={aberta} aria-controls={id}
        onClick={() => setAberta(a => !a)}>{textoDoLink(aberta, registros.length)}<Icone nome="abaixo" tam={ICONE_DO_MINI} /></button>}
    </p>
    {aberta && <div id={id} className="registros-do-tempo" role="group" aria-label={REGISTROS_DE_TEMPO}>
      {t.concluida_em && <p className="registros-do-tempo-decorrido">
        Da criação à conclusão: <b className="num">{fmtDecorrido(t.criado_em, t.concluida_em)}</b>
      </p>}
      {comTotal && !ctx.ehAdmin && <p className="registros-do-tempo-nota">{SO_OS_SEUS}</p>}
      {grupos.map(g => <GrupoDaPessoa key={g.perfil_id ?? 'removido'} g={g} comCabeca={comCabeca}
        linha={r => <LinhaDoRegistro key={r.id} r={r} posso={possoMexer(r, eu, ctx.ehAdmin)} contando={emAndamento(r, periodoId, relogio.contando)} agora={relogio.segundos}
          aoMudar={() => mudar(r)} aoApagar={() => apagar(r)} />} />)}
    </div>}
  </div>;
}

interface PropsDoGrupo {
  g: GrupoDeRegistros<RegistroDeTempo>;
  comCabeca: boolean;
  linha: (r: RegistroDeTempo) => ReactNode;
}

/** Os registros de uma pessoa: a cabeça (o nome, a % e o total) e a lista, do mais novo ao mais antigo. */
function GrupoDaPessoa({ g, comCabeca, linha }: PropsDoGrupo) {
  const ctx = useCtx();
  const meu = g.perfil_id === ctx.perfil.id;
  const nome = meu ? 'Você' : ctx.equipe.find(m => m.id === g.perfil_id)?.nome ?? 'Usuário removido';
  // A duração dos outros só para o administrador; quem não é vê a % deles (o banco nem devolve as durações).
  const comDuracao = meu || ctx.ehAdmin;
  return <div className="registros-da-pessoa" role="group" aria-label={nome}>
    {comCabeca && <p className="registros-da-pessoa-cabeca">
      <span className="registros-da-pessoa-nome">{nome}{g.percentual !== null && <span className="registros-da-pessoa-parte"> · {fmtParte(g.percentual)} do total</span>}</span>
      {comDuracao && <b className="registros-da-pessoa-total num">{fmtDuracao(g.segundos)}</b>}
    </p>}
    {g.registros.length > 0 && <ul className="registros-da-pessoa-lista" aria-label={meu ? 'Seus registros' : `Registros de ${nome}`}>{g.registros.map(linha)}</ul>}
  </div>;
}

interface PropsDaLinha {
  r: RegistroDeTempo; posso: boolean; contando: boolean;
  /** Os segundos que o relógio deste cartão já contou no período: a duração, andando, do registro que está contando. */
  agora: number;
  aoMudar: () => unknown; aoApagar: () => unknown;
}

/** Um registro: quando e de onde veio, à esquerda; a duração; o lápis e a lixeira à direita. */
function LinhaDoRegistro({ r, posso, contando, agora, aoMudar, aoApagar }: PropsDaLinha) {
  const dia = dataCurta(r.inicio);
  const mudar = `Mudar o registro de ${dia}`, apagar = `Apagar o registro de ${dia}`;
  return <li className="registro-do-tempo">
    <span className="registro-do-tempo-quando">
      {quandoDoRegistro(r.inicio, hojeISO(), contando)}
      {contando && <span className="registro-do-tempo-motivo">Contando agora</span>}
      {r.ajuste && r.motivo && <span className="registro-do-tempo-motivo">{ORIGEM_DO_AJUSTE[sinalDoAjuste(r.segundos)]}: {r.motivo}</span>}
      {r.motivo_da_correcao && <span className="registro-do-tempo-motivo">Mudado: {r.motivo_da_correcao}</span>}
    </span>
    <span className="registro-do-tempo-duracao num">
      {contando ? <><span className="seu-tempo-pulso" aria-hidden="true" />{fmtDuracao(agora)}</> : duracaoDoRegistro(r)}
    </span>
    <span className="registro-do-tempo-acoes">
      {posso && (contando
        // O que está contando: desligados, com o motivo; o clique não faz nada (para mudar ou apagar, pare o relógio antes).
        ? <>
          <BotaoDeIcone icone="editar" rotulo={mudar} dica={PARE_ANTES} aria-disabled="true" />
          <BotaoDeIcone icone="lixeira" rotulo={apagar} dica={PARE_ANTES} aria-disabled="true" />
        </>
        : <>
          <Botao icone="editar" rotulo={mudar} dica="Mudar o registro" onClick={aoMudar} />
          {/* Armado, o botão cresce e mostra "Confirmar", e o nome continua o do registro (#436: ícones no lugar de textos repetidos). */}
          <BotaoDuplo icone="lixeira" rotulo={apagar} dica="Apagar o registro" variante="perigo" aria-label={apagar} confirmar="Confirmar" aoConfirmar={aoApagar} />
        </>)}
    </span>
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
