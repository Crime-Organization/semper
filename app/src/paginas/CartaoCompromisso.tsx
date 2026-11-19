// Cartão do compromisso (painel ao lado ou janela no centro), no modelo dos cartões de pessoa e de processo: no topo, o tipo,
// o nome e a data; as ações, com a equipe em bolinhas, e a situação; depois, cada tópico numa seção que recolhe. Quem só vê o
// compromisso pela Agenda geral lê tudo e comenta, mas não muda nada.
// Desde a #346, quem muda o compromisso muda o título no próprio lugar, como na anotação (o lápis não o repete). A audiência e a
// perícia podem ficar sem título: aí o título mostra o tipo e as pessoas, o campo abre em branco, e apagar o título volta a
// mostrá-los. Logo abaixo, a data e o horário (#361), que também se mudam no próprio lugar; o lápis não os repete.
import { Fragment, useCallback, useEffect, useState } from 'react';
import { SD, type Compromisso, type PessoaResumida } from '../dados';
import { TAMANHO_COMPROMISSO } from '../dados/limites';
import {
  CAMPOS_COMPROMISSO, compromissoVazio, continuaPeloProcesso, linhasDoCompromisso, motivoSemMencaoNoCompromisso, nomeDoCompromisso, podeMudarCompromisso, SEM_SITUACAO_COMPROMISSO,
  TIPOS_COMPROMISSO, validarCompromisso, valorLegivelCompromisso
} from '../regras/compromisso';
import { erroNoLugar, tituloOpcionalAoGravar } from '../regras/edicaoNoLugar';
import { AvisoDaEdicaoNoLugar, gravarNoLugar, useEdicaoNoLugar } from '../ui/EdicaoNoLugar';
import { equipeEditaTudo } from '../regras/equipeVeTudo';
import { ProcessosDoCartao, type ProcessosLidos } from './ProcessosDoCartao';
import { AcoesDoCartao } from '../ui/AcoesDoCartao';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, DadoDoGrupo, GrupoDeDatas, Nota, Selo, TituloEditavel, Vazio } from '../ui/base';
import { quandoComoEsta, type QuandoGravado } from '../regras/datasNoCartao';
import { dataDaCriacao } from '../regras/dataDeInicio';
import { QuandoDoCompromisso } from './QuandoDoCompromisso';
import { SecaoComentarios } from '../ui/Comentarios';
import { EquipeNoTopo } from './EquipeNoTopo';
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { SecaoEtiquetas } from '../ui/Etiquetas';
import { Icone } from '../ui/Icone';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { NaColunaDoCartao } from '../ui/PainelCartao';
import { Recolhivel } from '../ui/Recolhivel';
import { useQuantos } from '../ui/useQuantos';
import { quantosPreenchidos } from '../regras/secoes';
import { useCtx } from '../ui/sessao';
import { dataCurta, relativo } from '../ui/util';
import { AnotacoesDoCartao } from './AnotacoesDoCartao';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import NovoCompromisso from './NovoCompromisso';
import { MenuDeSituacao } from '../ui/quadro/MenuDeSituacao';
import { LigarPessoaNoItem, novaPessoaNoItem } from './PessoasNosItens';

interface Props {
  id: string;
  quadro: Quadro;
  /** Avisa a lista de que algo mudou (para recarregar a agenda, a tabela ou o quadro). */
  aoMudar: () => void;
  aoFechar: () => void;
}

export function CartaoCompromisso({ id, quadro, aoMudar, aoFechar }: Props) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [c, setC] = useState<Compromisso | null | undefined>(undefined);   // undefined: carregando; null: não existe ou não pode ver
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  // Lápis: o cartão vira o formulário, com todos os campos de uma vez (o cadastro em etapas fica para criar).
  const [editando, setEditando] = useState(false);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';
  // O título em edição no próprio lugar (#346).
  const noLugar = useEdicaoNoLugar();

  const carregar = useCallback(() => SD.compromissoObter(id).then(x => { setC(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Depois de desfazer: mostra o compromisso como ficou.
  useMudancas(() => { void carregar(); setVersaoHist(v => v + 1); });

  // Quantas alterações o histórico tem, para o número ao lado do título.
  const historico = useQuantos(() => SD.compromissoHistorico(id), `${id}:${versaoHist}`);
  // O processo vem com o compromisso: o ligado que a pessoa não pode abrir só conta.
  const processoDoCompromisso = useCallback(async (): Promise<ProcessosLidos> =>
    c?.processo ? { visiveis: [c.processo], ocultos: 0 } : { visiveis: [], ocultos: c?.processo_id ? 1 : 0 }, [c]);

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (c === undefined) return <Carregando />;
  if (!c) return <Vazio>Este compromisso não foi encontrado. Ele pode ter sido excluído, ou você não participa dele.</Vazio>;

  const podeMudar = equipeEditaTudo(ctx.escritorio) || podeMudarCompromisso(c, eu, ctx.ehAdmin);
  const podeExcluir = !!c.arquivado_em && (c.criado_por === eu || ctx.ehAdmin);
  const somenteLer = !!c.arquivado_em || !podeMudar;
  const doProcesso = TIPOS_COMPROMISSO[c.tipo].doProcesso;
  const pessoa = (p: PessoaResumida): ItemLigado => ({ id: 'pessoa-' + p.id, para: '/pessoas/?id=' + p.id, codigo: p.codigo, titulo: p.nome, detalhe: 'Ligada', selo: p.arquivado_em ? 'Arquivada' : undefined });

  async function arquivar() {
    const estava = !!c!.arquivado_em;
    try {
      await SD.compromissosArquivar([c!.id], !estava);
      feito(estava ? 'Compromisso desarquivado.' : 'Compromisso arquivado. Arquivados podem ser excluídos depois.', estava ? 'desarquivamento' : 'arquivamento',
        async () => { await SD.compromissosArquivar([c!.id], estava); });
      aoMudar(); await carregar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  async function excluir() {
    const r = await SD.compromissosExcluir([c!.id]);
    if (r.excluidas) { avisar('Compromisso excluído definitivamente.'); aoFechar(); aoMudar(); }
    else falha(new Error(r.motivo || 'Não foi possível excluir.'));
  }
  async function mudarSituacao(valor: string) {
    const etapa = valor || null, de = c!.etapa_id || null, ordemDe = c!.etapa_ordem ?? null, ordem = ordemNoFim();
    try {
      await SD.compromissoMover(c!.id, etapa, ordem);
      setC({ ...c!, etapa_id: etapa, etapa_ordem: ordem });
      feito(etapa ? `Movido para "${quadro.nomeDe(etapa)}".` : `Compromisso ${SEM_SITUACAO_COMPROMISSO.toLowerCase()}.`, 'mudança de situação',
        async () => { await SD.compromissoMover(c!.id, de, ordemDe); });
      aoMudar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  /** Grava o título mudado no próprio lugar (#346), como o lápis: o mesmo aviso, com Desfazer. Em branco (só a audiência e a perícia), o título sai. */
  const salvarTitulo = (titulo: string) => gravarNoLugar<Pick<Compromisso, 'titulo'>>({
    novo: { titulo: tituloOpcionalAoGravar(titulo) }, antes: { titulo: c.titulo }, gravar: x => SD.compromissoAtualizar(c.id, x),
    aviso: 'Compromisso atualizado.', oQue: 'atualização do compromisso', mudanca: { tipo: 'compromissoAtualizado', id: c.id },
    mostrar: x => setC(atual => atual && { ...atual, ...x }), depois: () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }
  });

  /** Grava a data e o horário mudados no próprio lugar (#361), como o lápis: o mesmo aviso, com Desfazer. */
  const salvarQuando = (q: QuandoGravado) => gravarNoLugar<QuandoGravado>({
    novo: q, antes: quandoComoEsta(c), gravar: x => SD.compromissoAtualizar(c.id, x),
    aviso: 'Compromisso atualizado.', oQue: 'atualização do compromisso', mudanca: { tipo: 'compromissoAtualizado', id: c.id },
    mostrar: x => setC(atual => atual && { ...atual, ...x }), depois: () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }
  });

  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); setVersaoHist(x => x + 1); }
  }

  return <>
    <AvisoDaEdicaoNoLugar edicao={noLugar} gravado={c} />
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">{TIPOS_COMPROMISSO[c.tipo].nome}</Selo><span className="codigo">{c.codigo}</span>
        {c.geral && <Selo>Agenda geral</Selo>}
        {c.arquivado_em && <Selo tipo="arq">Arquivado</Selo>}
        {podeMudar && <AcoesDoCartao editando={editando} arquivado={!!c.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)} excluir={podeExcluir ? { oQue: 'o compromisso', aoConfirmar: excluir } : undefined} />}
      </div>
      {/* O título muda no próprio lugar só para quem muda o compromisso, com ele ativo (como o lápis). */}
      <TituloEditavel key={noLugar.chave} valor={c.titulo ?? ''} exibido={nomeDoCompromisso(c)} placeholder={nomeDoCompromisso({ ...c, titulo: null })}
        maximo={TAMANHO_COMPROMISSO.titulo} conferir={titulo => erroNoLugar(validarCompromisso, compromissoVazio(c.tipo), 'titulo', titulo)}
        aoMudarRascunho={noLugar.rascunhoDe('titulo')} aoSalvar={somenteLer ? undefined : salvarTitulo} />
      {/* A data e o horário (#361), que quem muda o compromisso muda no próprio lugar, como o lápis grava; e a criação, fixa. */}
      <GrupoDeDatas rotulo="Datas">
        <DadoDoGrupo rotulo="Data e horário">
          <QuandoDoCompromisso key={'quando-' + noLugar.chave} c={c} aoMudarRascunho={noLugar.rascunhoDe('quando')}
            aoSalvar={somenteLer || editando ? undefined : salvarQuando} />
        </DadoDoGrupo>
        <DadoDoGrupo rotulo="Criado em"><b className="num">{dataDaCriacao(c.criado_em)}</b></DadoDoGrupo>
      </GrupoDeDatas>
      {!editando && <section className="bloco campos cartao-situacao">
        <h3><Icone nome="kanban" tam={14} />Situação</h3>
        <MenuDeSituacao rotulo="Situação do compromisso" quadro={quadro} valor={c.etapa_id} semSituacao={SEM_SITUACAO_COMPROMISSO} desabilitado={somenteLer} aoMudar={mudarSituacao} />
      </section>}
    </header>

    {editando ? <NovoCompromisso edicao={{ id: c.id, titulo: c.titulo, aoTerminar: terminarEdicao }} /> : <>

    <div className="cartao-acoes">
      {/* Quem tem o lápis muda a equipe também nas bolinhas (#356), com as regras de sair do compromisso do lápis (#276). Fora
          dele, o cartão diria "não encontrado": fecha. */}
      <EquipeNoTopo modulo="compromissos" id={c.id} equipe={{ responsavel_id: c.responsavel_id, lista: c.participantes }} mudar={somenteLer ? null : {
        saida: { podeSair: gravaForaDoCartao(ctx, c.criado_por === eu, continuaPeloProcesso(c, c.processo_id)), peloLigado: continuaPeloProcesso(c, c.processo_id) },
        depois: () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }, aoSair: () => { aoMudar(); aoFechar(); }
      }} />
    </div>
    {!podeMudar && <Nota>Você vê este compromisso porque ele está na Agenda geral. Só quem participa dele pode mudá-lo.</Nota>}
    {/* A faixa só explica: a exclusão fica na lixeira, no topo do cartão. */}
    {c.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Compromisso arquivado. Se não for mais necessário, pode ser excluído definitivamente.'
        : 'Compromisso arquivado. Só quem cadastrou este compromisso ou um administrador pode excluí-lo.'}</span>
    </div>}


    <SecaoEtiquetas modulo="compromissos" id={c.id} somenteLer={somenteLer} aoMudar={aoMudar} />

    <Recolhivel titulo="Dados do compromisso" icone="calendario" preferencia="compromissos.cartao.dados" contador={quantosPreenchidos(linhasDoCompromisso(c).map(([, v]) => v))}>
      <dl className="dados">{linhasDoCompromisso(c).map(([rotulo, valor]) => <Fragment key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></Fragment>)}</dl>
    </Recolhivel>

    {doProcesso && <Recolhivel titulo="Resultado" icone="check" preferencia="compromissos.cartao.resultado" contador={c.resultado ? 1 : 0}>
      {c.resultado ? <p className="demanda-descricao">{c.resultado}</p> : <Nota>Ainda sem resultado. Depois do compromisso, registre aqui pelo lápis do cartão.</Nota>}
    </Recolhivel>}

    <Recolhivel titulo="Processo" icone="processos" preferencia="compromissos.cartao.processo" contador={c.processo_id ? 1 : 0}>
      <ProcessosDoCartao carregar={processoDoCompromisso} versao={versaoHist} somenteLer={somenteLer || !ctx.escritorio?.modulos?.processos} maximo={1}
        vazio="Este compromisso não está ligado a um processo."
        semDesligar={doProcesso ? `${TIPOS_COMPROMISSO[c.tipo].nome} precisa de um processo. Para trocar, use o lápis do cartão.` : undefined}
        ligar={processoId => SD.compromissoAtualizar(c.id, { processo_id: processoId })} desligar={() => SD.compromissoAtualizar(c.id, { processo_id: null })}
        aoMudar={() => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }} />
    </Recolhivel>

    <Recolhivel titulo="Pessoas" icone="pessoas" preferencia="compromissos.cartao.pessoas" contador={c.pessoas.length} novo={novaPessoaNoItem('compromissos', c.id, c.pessoas, !somenteLer).titulo}>
      {c.pessoas.length ? <ItensLigados itens={c.pessoas.map(pessoa)} /> : <Nota>Nenhuma pessoa do cadastro ligada a este compromisso.</Nota>}
      {/* Ligar uma pessoa que já está no cadastro (#341) ou cadastrar uma nova já nele (#376): quem muda o compromisso, com ele ativo. */}
      {!somenteLer && <LigarPessoaNoItem modulo="compromissos" itemId={c.id} ligadas={c.pessoas} novo={novaPessoaNoItem('compromissos', c.id, c.pessoas, !somenteLer).embaixo}
        depois={() => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }} />}
    </Recolhivel>

    {/* Na coluna da direita da janela no centro (ao lado e na janela estreita, aqui embaixo), na ordem: comentários, anotações e
        histórico (#360). A escolha de deixar o histórico aberto tem chave nova (".coluna."): na coluna, ele começa recolhido. */}
    <NaColunaDoCartao>
      <SecaoComentarios modulo="compromissos" cartaoId={c.id} motivoSemMencao={equipeEditaTudo(ctx.escritorio) ? undefined : motivoSemMencaoNoCompromisso(c, c.processo)} />
      <AnotacoesDoCartao modulo="compromissos" id={c.id} somenteLer={somenteLer} />
      <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="compromissos.coluna.historico" contador={historico}>
        <HistoricoDoCartao carregar={() => SD.compromissoHistorico(c.id)} campos={CAMPOS_COMPROMISSO} valor={valorLegivelCompromisso} versao={versaoHist} />
      </Recolhivel>
    </NaColunaDoCartao>

    <footer className="cartao-rodape">
      <span>Criado em {dataCurta(c.criado_em)}{c.criado_por ? ' por ' + nomeDe(c.criado_por) : ''}</span>
      <span>Atualizado {relativo(c.atualizado_em)}</span>
    </footer>
    </>}
  </>;
}
