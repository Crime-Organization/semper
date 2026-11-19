// Anotação nova (#303), como uma nota em branco do Obsidian, na janela do cadastro (como os outros cadastros, pedido do dono de
// 18/11) e no mesmo desenho da anotação aberta: no topo, numa linha só, a pasta (vinda da página com ?pasta=, já escolhida) e a
// equipe em bolinhas (quem escreve já é o responsável) e o ícone de etiqueta, que abre a escolha das etiquetas; logo abaixo, os
// selos das etiquetas escolhidas (sem etiquetas, a linha some); o cursor já no título ("Sem título"); o texto, no editor ao vivo
// da #364 (a formatação aparece enquanto se escreve, como no Obsidian), com o Markdown completo da #344 e a barra de botões; e
// "Ligada a", que junta os itens antes de salvar. Vindo do cartão de um item (?pessoa=, ?processo=, ?contrato=, ?demanda=, ?tarefa= ou ?compromisso=), ele já vem na
// lista. Salvar (ou Ctrl+Enter) cria a anotação ligada a todos os itens da lista e a abre na janela do cartão, no lugar da nota em
// branco: o Voltar do navegador volta para onde a pessoa estava (o cartão do item, por exemplo). O X da janela fecha a nota.
// Para mudar uma anotação que já existe, tudo se muda na própria anotação (o antigo ?id= leva a ela).
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { SD, type Etiqueta, type ItemDaAnotacao, type ModuloDaAnotacao } from '../dados';
import { ITENS_DA_ANOTACAO, TAMANHO_ANOTACAO } from '../dados/limites';
import {
  comMaisUmItem, dadosDaAnotacao, DICA_DO_TEXTO, errosDaAnotacao, ITEM_DA_ANOTACAO, itemDaAnotacao, ligacoesDaAnotacaoNova,
  MODULOS_DA_ANOTACAO, semOItem, type CamposAnotacao
} from '../regras/anotacao';
import { candidatosDaEquipe } from '../regras/equipe';
import { AVISO_DA_MUDANCA, desfazerMudanca, EQUIPE_DO_MODULO, MUDANCAS, type EquipeGravada, type TipoDeMudanca } from '../regras/equipeNoCartao';
import { etiquetasQueExistem } from '../regras/etiquetas';
import { PARAMETRO_DA_PASTA } from '../regras/pastas';
import { ICONE_DO_TOPO } from '../ui/AcoesDoCartao';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { avisar, falha, feito } from '../ui/avisos';
import { Aviso, CampoDoTitulo, EditorAoVivo, estiloBotao, Nota } from '../ui/base';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { BotaoDasEtiquetas, SelosDasEtiquetas } from '../ui/Etiquetas';
import { buscarEtiquetas, lojaDeEtiquetas } from '../ui/etiquetasDoEscritorio';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { LigarItem } from '../ui/LigarItem';
import { CaminhoDaPasta } from '../ui/Pastas';
import { buscarPastas, usePastas } from '../ui/pastasDoEscritorio';
import { Recolhivel } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';
import { ENDERECO_DA_ANOTACAO } from './AnotacoesDoCartao';
import './Documentos.css';

/** Como ler o item de cada módulo, para mostrar a que a anotação nova fica ligada. */
const OBTER_ITEM: Record<ModuloDaAnotacao, (id: string) => Promise<ItemDaAnotacao | null>> = {
  pessoas: id => SD.pessoaObter(id).then(x => x && itemDaAnotacao('pessoas', x)),
  processos: id => SD.processoObter(id).then(x => x && itemDaAnotacao('processos', { ...x, cliente_nome: x.clientes.map(c => c.nome).join('; ') })),
  contratos: id => SD.contratoObter(id).then(x => x && itemDaAnotacao('contratos', x)),
  demandas: id => SD.demandaObter(id).then(x => x && itemDaAnotacao('demandas', x)),
  tarefas: id => SD.tarefaObter(id).then(x => x && itemDaAnotacao('tarefas', x)),
  compromissos: id => SD.compromissoObter(id).then(x => x && itemDaAnotacao('compromissos', x))
};
/** O id do campo do título e o do texto (o foco vai a eles). */
const TITULO = 'titulo', TEXTO = 'texto';
const focar = (id: string) => document.getElementById(id)?.focus({ preventScroll: true });
/** O tamanho do X que tira um item da lista dos que a anotação vai ligar. */
const TAMANHO_DO_X = 14;
/** As palavras da equipe da anotação (o papel de quem está na lista, o "+", a lista cheia). */
const EQUIPE = EQUIPE_DO_MODULO.anotacoes;

export default function NovaAnotacao() {
  const ctx = useCtx();
  const navegar = useNavigate();
  /** Marcada logo antes de sair por conta própria: aí o aviso de sair sem salvar não pergunta. */
  const saidaLiberada = useRef(false);
  const [params] = useSearchParams();
  // O item de onde se veio: o primeiro módulo cujo parâmetro está no endereço.
  const moduloDeOrigem = MODULOS_DA_ANOTACAO.find(m => params.get(ITEM_DA_ANOTACAO[m].parametro));
  const idDeOrigem = moduloDeOrigem ? params.get(ITEM_DA_ANOTACAO[moduloDeOrigem].parametro)! : null;

  // Quem escreve já vem como responsável.
  const [c, setC] = useState<CamposAnotacao>(() => ({ titulo: '', texto: '', responsavelId: ctx.perfil.id, participantes: [] }));
  const [itens, setItens] = useState<ItemDaAnotacao[]>([]);
  // A pasta e as etiquetas com que a anotação nasce (#342).
  const [pasta, setPasta] = useState<string | null>(() => params.get(PARAMETRO_DA_PASTA));
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  // A pasta do endereço que a lista guardada não conhece (um colega acabou de criá-la) faz ler as pastas de novo; até a resposta
  // chegar, a lista fica null.
  const pastas = usePastas({ precisa: pasta });
  // A pasta do endereço que não existe mais (apagada por um colega) não vai para a anotação.
  if (pasta && pastas && !pastas.some(p => p.id === pasta)) setPasta(null);
  // A etiqueta marcada e depois excluída (no próprio painel, ou por um colega) some da tela e não vai para a anotação: senão, a
  // pessoa não teria como desmarcá-la, e o salvar falharia sempre.
  const etiquetasMarcadas = etiquetasQueExistem(etiquetas, lojaDeEtiquetas.usar());
  const marcarEtiqueta = (e: Etiqueta, marcada: boolean) => setEtiquetas(atual => marcada ? [...atual.filter(x => x !== e.id), e.id] : atual.filter(x => x !== e.id));
  const [origem, setOrigem] = useState<ItemDaAnotacao | null | undefined>(undefined);   // undefined: lendo ou sem origem
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const mudar = (campos: Partial<CamposAnotacao>) => setC(atual => ({ ...atual, ...campos }));
  /** A equipe como está na tela agora, para o Desfazer, que pode vir depois de outras mudanças. */
  const equipeNaTela = useRef(c);
  equipeNaTela.current = c;
  useEffect(() => {
    if (!moduloDeOrigem || !idDeOrigem) return;
    OBTER_ITEM[moduloDeOrigem](idDeOrigem).then(i => {
      setOrigem(i);
      // O item de onde se veio já entra na lista dos que a anotação vai ligar.
      if (i) setItens(atual => [i, ...semOItem(atual, i)]);
    }).catch(() => setOrigem(null));
  }, [moduloDeOrigem, idDeOrigem]);
  // Ao abrir, o cursor já está no título.
  useEffect(() => {
    const t = setTimeout(() => focar(TITULO), 0);
    return () => clearTimeout(t);
  }, []);
  // Ctrl+Enter (Cmd+Enter no Mac) salva de qualquer lugar da nota, mesmo com o foco fora dos campos (depois de ligar um item, por
  // exemplo). Com uma janela por cima (o endereço de um link), o atalho é dela.
  const salvarPeloAtalho = useRef(() => {});
  useEffect(() => {
    const teclar = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.defaultPrevented || document.querySelector('.veu-janela')) return;
      e.preventDefault();
      salvarPeloAtalho.current();
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  }, []);

  // O endereço antigo de atualizar (/documentos/nova/?id=…) leva à anotação, onde ela se muda no próprio lugar.
  const idAntigo = params.get('id');
  if (idAntigo) return <Navigate to={ENDERECO_DA_ANOTACAO + idAntigo} replace />;

  // Enquanto o item de onde se veio é lido, ainda não se sabe se a anotação nasce ligada: o Salvar espera.
  const lendoOrigem = !!moduloDeOrigem && origem === undefined;
  const erros = conferido ? errosDaAnotacao(c) : {};
  // Os módulos que se podem ligar: os ligados no escritório (as pessoas sempre existem).
  const modulos = MODULOS_DA_ANOTACAO.filter(m => m === 'pessoas' || !!ctx.escritorio?.modulos?.[m]);

  async function salvar() {
    if (ocupado || lendoOrigem) return;   // o atalho não respeita o botão desligado
    setConferido(true);
    const errado = errosDaAnotacao(c);
    const primeiro = Object.values(errado)[0];
    if (primeiro) {
      avisar(primeiro, 'erro');
      if (errado.titulo) focar(TITULO);
      return;
    }
    setOcupado(true);
    try {
      const r = await SD.anotacaoCriar({ ...dadosDaAnotacao(c), pasta_id: pasta }, ligacoesDaAnotacaoNova(itens), etiquetasMarcadas);
      feito(`Anotação ${r.codigo} cadastrada.`, 'cadastro da anotação', async () => {
        await SD.anotacoesArquivar([r.id], true);
        const x = await SD.anotacoesExcluir([r.id]);
        if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
        return { tipo: 'anotacaoCriada', id: r.id };
      });
      saidaLiberada.current = true;
      // A anotação salva toma o lugar da nota em branco (o Voltar não traz a nota em branco de volta, e sim de onde se veio).
      navegar(ENDERECO_DA_ANOTACAO + r.id, { replace: true });
    } catch (err) {
      falha(err);
      setOcupado(false);
      // A pasta ou uma etiqueta pode ter sido apagada por um colega: as listas lidas de novo as tiram da tela, e o próximo salvar passa.
      void buscarPastas(ctx.perfil.id);
      void buscarEtiquetas();
    }
  }
  salvarPeloAtalho.current = () => void salvar();

  /**
   * A equipe nas mesmas bolinhas da anotação aberta, com as mesmas regras (MUDANCAS) e o mesmo aviso no pé da tela com o
   * Desfazer (desfazerMudanca, sobre a equipe como estiver na hora), só que guardada na tela até salvar.
   */
  function pedir(tipo: TipoDeMudanca, id: string, nome: string) {
    const antes: EquipeGravada = { responsavel_id: c.responsavelId, lista: c.participantes };
    const r = MUDANCAS[tipo]('anotacoes', antes, id, nome);
    if ('aviso' in r) { avisar(r.aviso, r.tipo); return; }
    mudar({ responsavelId: r.gravar.responsavel_id ?? c.responsavelId, participantes: r.gravar.lista });
    feito(AVISO_DA_MUDANCA[tipo]('anotacoes', nome), EQUIPE.oQue, async () => {
      const agora = equipeNaTela.current;
      const volta = desfazerMudanca('anotacoes', { tipo, id, nome }, antes, { responsavel_id: agora.responsavelId, lista: agora.participantes });
      if (!volta) return;
      if ('aviso' in volta) throw new Error(volta.aviso);
      mudar({ responsavelId: volta.responsavel_id ?? agora.responsavelId, participantes: volta.lista });
    });
  }
  const responsavel = c.responsavelId ? naEquipe(ctx.equipe, c.responsavelId, 'Responsável') : null;
  const participantes = c.participantes.map(x => naEquipe(ctx.equipe, x, EQUIPE.papel));

  const cheia = itens.length >= ITENS_DA_ANOTACAO;
  return <article className="anotacao-aberta anotacao-nova" aria-label="Anotação nova">
    <AvisoAoSair estado={{ c, itens, pasta, etiquetas: etiquetasMarcadas }} liberada={saidaLiberada} ocupado={ocupado} />
    <header className="anotacao-topo">
      {/* Sem link nos pedaços do caminho: abrir a pasta agora perderia a anotação que ainda não foi salva. */}
      <CaminhoDaPasta pastas={pastas} pastaId={pasta} aoMudar={setPasta} />
      <div className="anotacao-topo-acoes">
        <EquipeDoCartao responsavel={responsavel} participantes={participantes} mudar={{
          por: EQUIPE.por,
          candidatos: termo => candidatosDaEquipe(ctx.equipe, termo, [c.responsavelId, ...c.participantes]),
          responsaveis: termo => candidatosDaEquipe(ctx.equipe, termo, [c.responsavelId]),
          // Na anotação ainda por salvar, ninguém "sai": quem escreve é sempre dela.
          tirar: p => `Tirar ${p.nome}`,
          cheia: c.participantes.length >= EQUIPE.maximo ? EQUIPE.cheia : undefined,
          aoPor: m => pedir('por', m.id, m.nome),
          aoTirar: p => pedir('tirar', p.id, p.nome),
          aoTrocarResponsavel: m => pedir('responsavel', m.id, m.nome)
        }} />
        {/* As etiquetas com que a anotação nasce: a mesma escolha da anotação aberta, guardada na tela até salvar. */}
        <BotaoDasEtiquetas ids={etiquetasMarcadas} aoMarcar={marcarEtiqueta} rotulo="Etiquetas" className="cartao-botao" comDica>
          <Icone nome="etiqueta" tam={ICONE_DO_TOPO} />
        </BotaoDasEtiquetas>
      </div>
    </header>
    {/* As etiquetas escolhidas, numa linha entre o topo e o título (sem etiquetas, ela não aparece). */}
    <SelosDasEtiquetas ids={etiquetasMarcadas} rotulo="Etiquetas" aoTirar={e => marcarEtiqueta(e, false)} />

    <CampoDoTitulo id={TITULO} className="anotacao-titulo" aria-label="Título" placeholder="Sem título" maxLength={TAMANHO_ANOTACAO.titulo} value={c.titulo}
      aria-invalid={erros.titulo ? true : undefined} onChange={e => mudar({ titulo: e.target.value })}
      // Enter no título desce para o texto, como numa nota.
      onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); focar(TEXTO); } }} />

    <div className="editor-de-texto">
      <EditorAoVivo id={TEXTO} rotulo="Texto" placeholder={DICA_DO_TEXTO} maximo={TAMANHO_ANOTACAO.texto}
        valor={c.texto} aoMudar={texto => mudar({ texto })} />
    </div>

    {/* A única seção que recolhe na nota em branco: sem o "Expandir tudo", que abriria e fecharia só ela. */}
    <Recolhivel titulo="Ligada a" icone="vinculo" contador={itens.length} abertaAoIniciar foraDoExpandirTudo>
      {origem === null && <Aviso tipo="erro">O item de onde você veio não foi encontrado. A anotação será salva sem ligação a ele.</Aviso>}
      {/* Sem link para o item: abrir outro cartão agora perderia a anotação que ainda não foi salva. */}
      <ItensLigados rotulo="Itens ligados" vazio="Ainda não está ligada a nenhum item." itens={itens.map(i => ({
        id: `${i.modulo}-${i.id}`, codigo: `${ITEM_DA_ANOTACAO[i.modulo].rotulo} · ${i.codigo}`, titulo: i.nome,
        acao: <button type="button" className="icone-btn" title="Tirar" aria-label={`Tirar ${i.nome}`} onClick={() => setItens(atual => semOItem(atual, i))}>
          <Icone nome="fechar" tam={TAMANHO_DO_X} />
        </button>
      }))} />
      {cheia
        ? <Nota>A anotação já vai ligada a {ITENS_DA_ANOTACAO} itens, o máximo.</Nota>
        : <div className="ligados-acoes">
          <LigarItem modulos={modulos} ligados={itens} rotulo={itens.length ? 'Ligar a outro item' : 'Ligar a um item'}
            aoEscolher={i => setItens(atual => comMaisUmItem(atual, i))} />
        </div>}
    </Recolhivel>

    <div className="anotacao-nova-salvar">
      <span className="texto-editavel-atalho" aria-hidden="true">Ctrl+Enter salva</span>
      <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={ocupado || lendoOrigem} onClick={() => void salvar()}>
        {ocupado ? 'Salvando…' : 'Salvar anotação'}
      </button>
    </div>
  </article>;
}
