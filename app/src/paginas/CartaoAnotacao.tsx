// Cartão da anotação (painel ao lado ou janela no centro), no modelo dos outros cartões (#303): no topo, o código e as ações;
// o título e o texto formatado, em medida de leitura; a equipe; os itens a que ela está ligada, com a busca para ligar a
// mais um; o histórico e o rodapé. Quem a vê só por um item ligado lê tudo, mas não muda nada. Todos podem baixá-la em .md (#345).
import { useCallback, useEffect, useRef, useState } from 'react';
import { SD, type Anotacao, type ItemDaAnotacao } from '../dados';
import { ITENS_DA_ANOTACAO } from '../dados/limites';
import { alteraAAnotacao, enderecoDoItem, excluiAAnotacao, ITEM_DA_ANOTACAO, ligaNaAnotacao, MODULOS_DA_ANOTACAO } from '../regras/anotacao';
import { markdownDaAnotacao, nomeDoArquivo } from '../regras/anotacaoEmMarkdown';
import { equipeEditaTudo, equipeVeTudo } from '../regras/equipeVeTudo';
import { AcoesDeQuemLe, AcoesDoCartao, type AcaoDoTopo } from '../ui/AcoesDoCartao';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, Nota, Selo, TextoFormatado, Vazio } from '../ui/base';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { LigarItem } from '../ui/LigarItem';
import { Recolhivel } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';
import { useQuantos } from '../ui/useQuantos';
import { baixarArquivo, dataCurta, relativo } from '../ui/util';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import { plural } from './importarPessoas/textos';
import NovaAnotacao from './NovaAnotacao';
import './Documentos.css';

/** O nome de cada campo no histórico. */
const CAMPOS_ANOTACAO: Record<string, string> = {
  titulo: 'Título', texto: 'Texto', responsavel_id: 'Responsável', participantes: 'Compartilhada com', arquivado_em: 'Arquivamento'
};
/** O texto não é guardado no histórico (seria grande demais): fica só que mudou, "Texto alterado". */
const SO_QUE_MUDOU = ['texto'];
/** Como cada valor aparece no histórico. */
const valorNoHistorico = (_campo: string, v: unknown) => v === null || v === undefined || v === '' ? '—' : String(v);
/** Por que quem não altera a anotação a vê: com a chave da equipe, todos a veem; sem ela, só por um item ligado. */
const POR_QUE_SO_LE = {
  equipe: 'Toda a equipe vê as anotações do escritório. Só quem a escreveu, o responsável e quem está nela podem mudá-la.',
  item: 'Você vê esta anotação porque vê um item ligado a ela. Só quem a escreveu, o responsável e quem está nela podem mudá-la.'
};

/** O tipo do arquivo baixado: Markdown, em UTF-8 (acentos e emojis do texto chegam inteiros). */
const TIPO_MARKDOWN = 'text/markdown;charset=utf-8';

interface Props {
  id: string;
  /** Avisa a lista de que algo mudou (para recarregar a tabela). */
  aoMudar: () => void;
  aoFechar: () => void;
}
type ItensLidos = { visiveis: ItemDaAnotacao[]; ocultos: number };

export function CartaoAnotacao({ id, aoMudar, aoFechar }: Props) {
  const ctx = useCtx();
  const [a, setA] = useState<Anotacao | null | undefined>(undefined);   // undefined: carregando; null: não existe ou não pode ver
  const [itens, setItens] = useState<ItensLidos | string | null>(null);
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  const [editando, setEditando] = useState(false);
  /**
   * As caixinhas marcadas uma atrás da outra: são gravadas em fila, na ordem dos cliques. Enquanto há gravação pendente, nenhuma
   * leitura do banco troca o texto da tela (ela viria sem os cliques ainda na fila, e o próximo clique partiria dela e os
   * apagaria). "confirmado" é o último texto que o banco aceitou, para a tela voltar a ele se uma gravação falhar; "geracao" muda
   * na falha, e as gravações que já estavam na fila, calculadas sobre o clique que falhou, são descartadas.
   */
  const caixinhas = useRef({ fila: Promise.resolve(), pendentes: 0, confirmado: '', geracao: 0 });
  /** Cada leitura da anotação ganha um número, e só vale a resposta da mais recente (as respostas podem chegar fora de ordem). */
  const leitura = useRef(0);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';

  const carregar = useCallback(() => {
    const esta = ++leitura.current;
    return SD.anotacaoObter(id).then(x => {
      if (esta !== leitura.current || caixinhas.current.pendentes) return;   // velha, ou há caixinha na fila: a fila lê no fim
      setA(x);
      setErro('');
    }).catch(e => setErro((e as Error).message));
  }, [id]);
  const carregarItens = useCallback(() => SD.anotacaoItens(id).then(setItens).catch(e => setItens((e as Error).message)), [id]);
  useEffect(() => { void carregar(); void carregarItens(); }, [carregar, carregarItens]);
  // Depois de desfazer: mostra a anotação como ficou.
  useMudancas(() => { void carregar(); void carregarItens(); setVersaoHist(v => v + 1); });
  const historico = useQuantos(() => SD.anotacaoHistorico(id), `${id}:${versaoHist}`);

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (a === undefined) return <Carregando />;
  if (!a) return <Vazio>Esta anotação não foi encontrada. Ela pode ter sido excluída, ou você não tem acesso a ela.</Vazio>;

  const chaves = { equipeEditaTudo: equipeEditaTudo(ctx.escritorio) };
  const podeAlterar = alteraAAnotacao(a, ctx.perfil, chaves);
  const podeLigar = ligaNaAnotacao(a, ctx.perfil, chaves);
  const podeExcluir = excluiAAnotacao(a, ctx.perfil);
  // Os módulos que se podem ligar: os ligados no escritório (as pessoas sempre existem).
  const modulos = MODULOS_DA_ANOTACAO.filter(m => m === 'pessoas' || !!ctx.escritorio?.modulos?.[m]);
  const depois = () => { aoMudar(); void carregar(); void carregarItens(); setVersaoHist(v => v + 1); };

  async function arquivar() {
    const estava = !!a!.arquivado_em;
    try {
      await SD.anotacoesArquivar([a!.id], !estava);
      feito(estava ? 'Anotação desarquivada.' : 'Anotação arquivada. Arquivadas podem ser excluídas depois.', estava ? 'desarquivamento' : 'arquivamento',
        async () => { await SD.anotacoesArquivar([a!.id], estava); });
      depois();
    } catch (e) { falha(e); }
  }
  async function excluir() {
    const r = await SD.anotacoesExcluir([a!.id]);
    if (r.excluidas) { avisar('Anotação excluída definitivamente.'); aoFechar(); aoMudar(); }
    else falha(new Error(r.motivo || 'Não foi possível excluir.'));
  }
  async function ligar(i: Pick<ItemDaAnotacao, 'modulo' | 'id' | 'nome'>) {
    try {
      await SD.anotacaoLigar(a!.id, i.modulo, i.id);
      feito(`Ligada a ${ITEM_DA_ANOTACAO[i.modulo].rotulo.toLowerCase()}: ${i.nome}.`, 'ligação da anotação', async () => { await SD.anotacaoDesligar(a!.id, i.modulo, i.id); });
      depois();
    } catch (e) { falha(e); }
  }
  async function desligar(i: ItemDaAnotacao) {
    try {
      await SD.anotacaoDesligar(a!.id, i.modulo, i.id);
      feito(`Desligada de ${ITEM_DA_ANOTACAO[i.modulo].rotulo.toLowerCase()}: ${i.nome}.`, 'desligamento da anotação', async () => { await SD.anotacaoLigar(a!.id, i.modulo, i.id); });
      depois();
    } catch (e) { falha(e); }
  }
  /**
   * Marca ou desmarca uma caixinha da lista de tarefas do texto: a caixinha muda na hora e o texto novo é gravado como na edição
   * (com o aviso e o desfazer). O texto novo parte do que está na tela, que já tem os cliques anteriores, mesmo os ainda na fila
   * (veja "caixinhas"). Se uma gravação falhar, a tela volta ao último texto gravado, e os cliques seguintes já na fila não são
   * gravados. Quando a fila esvazia, a anotação é lida de novo.
   */
  function marcarCaixinha(texto: string) {
    const c = caixinhas.current, antes = a!.texto, id = a!.id, geracao = c.geracao;
    if (!c.pendentes) c.confirmado = antes;
    c.pendentes++;
    setA(atual => atual && { ...atual, texto });
    c.fila = c.fila.then(async () => {
      if (geracao !== c.geracao) return;   // um clique anterior não foi gravado, e este partiu dele: fica de fora
      try {
        await SD.anotacaoAtualizar(id, { texto });
        c.confirmado = texto;
        feito('Anotação atualizada.', 'atualização da anotação', async () => {
          await SD.anotacaoAtualizar(id, { texto: antes });
          return { tipo: 'anotacaoAtualizada', id };
        });
      } catch (e) {
        const gravado = c.confirmado;
        c.geracao++;
        falha(e);
        setA(atual => atual && { ...atual, texto: gravado });
      }
    }).then(() => { if (--c.pendentes === 0) depois(); });
  }
  /**
   * Baixa a anotação como arquivo .md, como está na tela. Os itens ligados são lidos na hora (a seção "Ligada a" pode estar
   * fechada ou ainda carregando), e só entram os que a pessoa vê.
   */
  async function baixar() {
    try {
      const { visiveis } = await SD.anotacaoItens(a!.id);
      baixarArquivo(nomeDoArquivo(a!.titulo, a!.codigo), markdownDaAnotacao(a!, visiveis, { responsavel: nomeDe(a!.responsavel_id) }), TIPO_MARKDOWN);
    } catch (e) { falha(e); }
  }
  const baixarMd: AcaoDoTopo = { rotulo: 'Baixar .md', icone: 'baixar', aoClicar: baixar };
  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) depois();
  }

  const lidos = itens && typeof itens !== 'string' ? itens : null;
  const totalLigados = lidos ? lidos.visiveis.length + lidos.ocultos : undefined;

  return <>
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">Anotação</Selo><span className="codigo">{a.codigo}</span>
        {a.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
        {podeAlterar
          ? <AcoesDoCartao editando={editando} arquivado={!!a.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)}
            excluir={podeExcluir ? { oQue: 'a anotação', aoConfirmar: excluir } : undefined} extras={[baixarMd]} />
          : <AcoesDeQuemLe acoes={[baixarMd]} />}
      </div>
      <h2>{a.titulo}</h2>
    </header>

    {editando ? <NovaAnotacao edicao={{ id: a.id, aoTerminar: terminarEdicao }} /> : <>

    <div className="cartao-acoes">
      <EquipeDoCartao responsavel={naEquipe(ctx.equipe, a.responsavel_id, 'Responsável')}
        participantes={a.participantes.map(p => naEquipe(ctx.equipe, p, 'Compartilhada'))} />
    </div>
    {!podeAlterar && <Nota>{POR_QUE_SO_LE[equipeVeTudo(ctx.escritorio) ? 'equipe' : 'item']}</Nota>}
    {/* A faixa só explica: a exclusão fica na lixeira, no topo do cartão. */}
    {a.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Anotação arquivada. Se não for mais necessária, pode ser excluída definitivamente.'
        : 'Anotação arquivada. Só quem a escreveu ou um administrador pode excluí-la.'}</span>
    </div>}

    {a.texto.trim() ? <TextoFormatado className="anotacao-texto" texto={a.texto} aoMarcar={podeAlterar && !a.arquivado_em ? marcarCaixinha : undefined} /> : <Nota>Sem texto ainda.{podeAlterar && !a.arquivado_em ? ' Escreva pelo lápis do cartão.' : ''}</Nota>}

    <Recolhivel titulo="Ligada a" icone="vinculo" preferencia="anotacoes.cartao.ligada" contador={totalLigados}>
      {itens === null ? <Carregando />
        : typeof itens === 'string' ? <Aviso tipo="erro">{itens}</Aviso>
        : <>
          {itens.ocultos > 0 && <Nota>Há {plural(itens.ocultos, 'item ligado', 'itens ligados')} aqui que você não tem acesso para abrir.</Nota>}
          <ItensLigados rotulo="Itens ligados" vazio={itens.ocultos ? undefined : 'Esta anotação não está ligada a nenhum item.'} itens={itens.visiveis.map(i => ({
            id: `${i.modulo}-${i.id}`, para: enderecoDoItem(i), codigo: `${ITEM_DA_ANOTACAO[i.modulo].rotulo} · ${i.codigo}`, titulo: i.nome,
            selo: i.arquivado_em ? 'Arquivado' : undefined,
            acao: podeLigar ? <button type="button" className="icone-btn" title="Desligar" aria-label={`Desligar ${i.nome}`} onClick={() => desligar(i)}>
              <Icone nome="fechar" tam={14} />
            </button> : undefined
          }))} />
          {podeLigar && (totalLigados ?? 0) < ITENS_DA_ANOTACAO && <div className="ligados-acoes">
            <LigarItem modulos={modulos} ligados={itens.visiveis} aoEscolher={ligar} />
          </div>}
          {podeLigar && (totalLigados ?? 0) >= ITENS_DA_ANOTACAO && <Nota>A anotação já está ligada a {ITENS_DA_ANOTACAO} itens, o máximo.</Nota>}
        </>}
    </Recolhivel>

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="anotacoes.cartao.historico" contador={historico}>
      <HistoricoDoCartao carregar={() => SD.anotacaoHistorico(a.id)} campos={CAMPOS_ANOTACAO} valor={valorNoHistorico} soQueMudou={SO_QUE_MUDOU} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Criada em {dataCurta(a.criado_em)}{a.criado_por ? ' por ' + nomeDe(a.criado_por) : ''}</span>
      <span>Atualizada {relativo(a.atualizado_em)}</span>
    </footer>
    </>}
  </>;
}
