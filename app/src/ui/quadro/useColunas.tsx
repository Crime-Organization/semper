// Colunas do quadro (kanban) de um módulo: carregar, criar, ocultar, renomear, excluir e reordenar,
// com as regras de permissão e o desfazer, e a ordem dos cartões de cada coluna (escolha de cada usuário). As colunas são do escritório; cada usuário só as oculta para si.
// Os grupos de colunas são do escritório (só administradores mudam); abrir e fechar um grupo é escolha de cada usuário.
// Todo módulo com quadro usa este gancho com o <Kanban>; nada disso se reescreve por página.
import { useEffect, useRef, useState } from 'react';
import { SD, type Coluna, type ContextoAtivo, type GrupoDeColunas, type Modulo, type Ordem } from '../../dados';
import { avisar, falha, feito } from '../avisos';
import { janela, pedirTexto } from '../janela';
import { lerPreferencia, salvarPreferencia } from '../preferencias';
import { antesDeAoAndar, blocosDoQuadro, filaDoTopo, grupoEstaAberto, ordemAoPosicionar, ordemNoFimDoQuadro, podeExcluirColuna, type BlocoDoQuadro, type ItemDoTopo } from '../../regras/quadro';
import { normal } from '../../regras/texto';

export interface Quadro {
  colunas: Coluna[];
  sugestoes: string[];
  pronto: boolean;
  rotuloSemEtapa: string;
  nomeDe: (id: string | null) => string;
  podeReordenar: boolean;
  podeRenomear: (c: Coluna) => boolean;
  podeExcluir: (c: Coluna) => boolean;
  /** Cria a coluna, no grupo dado (ou oferece mostrar a que já existe oculta). Devolve true se criou. */
  criar: (nome: string, grupoId?: string | null) => Promise<boolean>;
  ocultar: (c: Coluna, ocultar: boolean) => Promise<void>;
  renomear: (c: Coluna) => Promise<void>;
  excluir: (c: Coluna) => Promise<void>;
  /**
   * Coloca a coluna antes do item "antesDe" (ou no fim, se null), na fila dela (filaDaColuna): dentro do grupo, entre as colunas
   * visíveis dele; sem grupo, no topo do quadro, entre as colunas sem grupo e os grupos. A ordem vale para todo o escritório.
   */
  posicionar: (c: Coluna, antesDe: string | null) => Promise<void>;
  mover: (c: Coluna, passo: -1 | 1) => void;
  /** Ordem dos cartões de uma coluna (null = "Sem etapa"). Cada coluna tem a sua; o padrão é a manual. */
  ordemDe: (colunaId: string | null) => Ordem;
  ordenar: (colunaId: string | null, ordem: Ordem) => void;
  grupos: GrupoDeColunas[];
  /** As colunas visíveis, em trechos, na ordem da tela: as sem grupo que ficam juntas e cada grupo. */
  blocos: BlocoDoQuadro<Coluna>[];
  /** O topo do quadro: as colunas visíveis sem grupo e os grupos, na ordem da tela. */
  topo: ItemDoTopo[];
  /** A fila em que a coluna anda: as colunas visíveis do grupo dela ou, sem grupo, o topo do quadro. */
  filaDaColuna: (c: Coluna) => { id: string }[];
  podeGerirGrupos: boolean;
  grupoAberto: (g: GrupoDeColunas) => boolean;
  alternarGrupo: (g: GrupoDeColunas) => void;
  criarGrupo: (nome: string) => Promise<boolean>;
  renomearGrupo: (g: GrupoDeColunas) => Promise<void>;
  alternarComecoFechado: (g: GrupoDeColunas) => Promise<void>;
  /** Coloca o grupo antes do item do topo "antesDe" (coluna sem grupo ou grupo; null: no fim). A ordem vale para todo o escritório. */
  posicionarGrupo: (g: GrupoDeColunas, antesDe: string | null) => Promise<void>;
  moverGrupo: (g: GrupoDeColunas, passo: -1 | 1) => void;
  excluirGrupo: (g: GrupoDeColunas) => Promise<void>;
  /** Põe a coluna no grupo, no fim dele (null: sem grupo, no fim do quadro). */
  agrupar: (c: Coluna, grupoId: string | null) => Promise<void>;
}

const ordenar = (cs: Coluna[]) => cs.slice().sort((a, b) => a.ordem - b.ordem);
const ordenarGrupos = (gs: GrupoDeColunas[]) => gs.slice().sort((a, b) => a.ordem - b.ordem);

export function useColunas(modulo: Modulo, ctx: ContextoAtivo, rotuloSemEtapa = 'Sem etapa'): Quadro {
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [pronto, setPronto] = useState(false);
  const atuais = useRef(colunas);
  atuais.current = colunas;
  // Ordem escolhida em cada coluna, guardada no perfil: { "sem" | id da coluna: ordem }.
  const chaveOrdens = `${modulo}.ordem.colunas`;
  const [ordens, setOrdens] = useState<Record<string, Ordem>>(() => lerPreferencia(chaveOrdens, {}));
  const [grupos, setGrupos] = useState<GrupoDeColunas[]>([]);
  const gruposAtuais = useRef(grupos);
  gruposAtuais.current = grupos;
  // Grupos que a pessoa abriu ou fechou, guardados no perfil: { id do grupo: aberto }.
  const chaveAbertos = `${modulo}.grupos.abertos`;
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() => lerPreferencia(chaveAbertos, {}));

  useEffect(() => {
    let vivo = true;
    Promise.all([SD.colunasListar(modulo), SD.sugestoesListar(modulo), SD.gruposListar(modulo)])
      .then(([c, s, g]) => { if (vivo) { setColunas(ordenar(c)); setSugestoes(s); setGrupos(ordenarGrupos(g)); } })
      .catch(falha)
      .finally(() => { if (vivo) setPronto(true); });
    return () => { vivo = false; };
  }, [modulo]);

  // Mudanças sempre por função: valem mesmo quando o desfazer roda depois que a tela mudou.
  const mudar = (id: string, campos: Partial<Coluna>) => setColunas(cs => ordenar(cs.map(x => x.id === id ? { ...x, ...campos } : x)));
  const tirar = (id: string) => setColunas(cs => cs.filter(x => x.id !== id));
  const eu = ctx.perfil.id;

  async function ocultar(c: Coluna, ocultar: boolean) {
    try {
      await SD.colunaOcultar(c.id, ocultar);
      mudar(c.id, { oculta: ocultar });
      feito(ocultar ? `Coluna "${c.nome}" oculta para você.` : `Coluna "${c.nome}" visível de novo.`, ocultar ? 'ocultação da coluna' : 'exibição da coluna',
        async () => { await SD.colunaOcultar(c.id, !ocultar); mudar(c.id, { oculta: !ocultar }); });
    } catch (e) { falha(e); }
  }

  async function criar(nome: string, grupoId: string | null = null) {
    const igual = atuais.current.find(c => normal(c.nome) === normal(nome));
    if (igual?.oculta) {
      const ver = await janela({
        titulo: 'Coluna já existente',
        corpo: <p>A coluna <b>{igual.nome}</b> já existe e está oculta para você. Deseja somente visualizá-la?</p>,
        acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Visualizar coluna', valor: true, tipo: 'pri' }]
      });
      if (ver) await ocultar(igual, false);
      return false;
    }
    if (igual) { falha(new Error(`A coluna "${igual.nome}" já existe neste quadro. Não é possível criar outra com o mesmo nome.`)); return false; }
    try {
      const ordem = ordemNoFimDoQuadro(atuais.current, gruposAtuais.current);
      const c = await SD.colunaCriar(modulo, nome, ordem, grupoId);
      setColunas(cs => ordenar([...cs, c]));
      feito(`Coluna "${c.nome}" criada.`, 'criação da coluna', async () => {
        if (ctx.ehAdmin) { await SD.colunaExcluir(c.id); tirar(c.id); }
        else { await SD.colunaOcultar(c.id, true); mudar(c.id, { oculta: true }); }
      });
      return true;
    } catch (e) { falha(e); return false; }
  }

  async function renomear(c: Coluna) {
    const novo = (await pedirTexto('Renomear coluna', c.nome))?.replace(/\s+/g, ' ');
    if (!novo || novo === c.nome) return;
    if (atuais.current.some(x => x.id !== c.id && normal(x.nome) === normal(novo))) { falha(new Error('Já existe uma coluna com esse nome neste quadro.')); return; }
    try {
      await SD.colunaRenomear(c.id, novo);
      mudar(c.id, { nome: novo });
      feito(`Coluna renomeada para "${novo}".`, 'renomeação da coluna', async () => { await SD.colunaRenomear(c.id, c.nome); mudar(c.id, { nome: c.nome }); });
    } catch (e) { falha(e); }
  }

  async function excluir(c: Coluna) {
    const ok = await janela({
      titulo: 'Excluir coluna',
      corpo: <p>A coluna <b>{c.nome}</b> sai do quadro de todo o escritório. Os itens dela vão para "{rotuloSemEtapa}"; nada é apagado.</p>,
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Excluir coluna', valor: true, tipo: 'perigo' }]
    });
    if (!ok) return;
    try { await SD.colunaExcluir(c.id); tirar(c.id); }
    catch (e) { falha(e); }
  }

  // As visíveis do mesmo grupo: uma coluna muda de lugar só dentro do grupo dela (para outro grupo, use agrupar).
  // O topo: colunas visíveis sem grupo e grupos, com a ordem dos dois junta. A coluna de um grupo anda só entre as do grupo.
  const topoAtual = () => filaDoTopo(atuais.current.filter(x => !x.oculta), gruposAtuais.current);
  function filaDaColuna(c: Coluna): { id: string; ordem: number }[] {
    const topo = topoAtual();
    if (topo.some(x => x.id === c.id)) return topo;
    return atuais.current.filter(x => !x.oculta && x.grupo_id === c.grupo_id);
  }

  async function posicionar(c: Coluna, antesDe: string | null) {
    const ordem = ordemAoPosicionar(filaDaColuna(c), c.id, antesDe);
    if (ordem === null) return;
    const anterior = c.ordem;
    mudar(c.id, { ordem });
    try {
      await SD.colunaOrdenar(c.id, ordem);
      feito(`Coluna "${c.nome}" mudou de lugar.`, 'mudança de ordem da coluna', async () => { await SD.colunaOrdenar(c.id, anterior); mudar(c.id, { ordem: anterior }); });
    } catch (e) { falha(e); mudar(c.id, { ordem: anterior }); }
  }

  function mover(c: Coluna, passo: -1 | 1) {
    const antes = antesDeAoAndar(filaDaColuna(c), c.id, passo);
    if (antes !== undefined) void posicionar(c, antes);
  }

  function ordenarCartoes(colunaId: string | null, ordem: Ordem) {
    const k = colunaId || 'sem', novas = { ...ordens, [k]: ordem };
    if (ordem === 'manual') delete novas[k];
    setOrdens(novas);
    salvarPreferencia(chaveOrdens, novas);
  }

  // ---------- grupos ----------
  const mudarGrupo = (id: string, campos: Partial<GrupoDeColunas>) => setGrupos(gs => ordenarGrupos(gs.map(g => g.id === id ? { ...g, ...campos } : g)));

  function alternarGrupo(g: GrupoDeColunas) {
    const novos = { ...abertos, [g.id]: !grupoEstaAberto(g, abertos) };
    setAbertos(novos);
    salvarPreferencia(chaveAbertos, novos);
  }

  async function criarGrupo(nome: string) {
    if (gruposAtuais.current.some(g => normal(g.nome) === normal(nome))) { falha(new Error('Já existe um grupo com esse nome neste quadro.')); return false; }
    try {
      const ordem = ordemNoFimDoQuadro(atuais.current, gruposAtuais.current);
      const g = await SD.grupoCriar(modulo, nome, ordem);
      setGrupos(gs => ordenarGrupos([...gs, g]));
      avisar(`Grupo "${g.nome}" criado. No menu de cada coluna, use "Mover para o grupo".`);
      return true;
    } catch (e) { falha(e); return false; }
  }

  async function renomearGrupo(g: GrupoDeColunas) {
    const novo = (await pedirTexto('Renomear grupo', g.nome))?.replace(/\s+/g, ' ');
    if (!novo || novo === g.nome) return;
    if (gruposAtuais.current.some(x => x.id !== g.id && normal(x.nome) === normal(novo))) { falha(new Error('Já existe um grupo com esse nome neste quadro.')); return; }
    try {
      await SD.grupoAtualizar(g.id, { nome: novo });
      mudarGrupo(g.id, { nome: novo });
    } catch (e) { falha(e); }
  }

  async function alternarComecoFechado(g: GrupoDeColunas) {
    try {
      await SD.grupoAtualizar(g.id, { comeca_fechado: !g.comeca_fechado });
      mudarGrupo(g.id, { comeca_fechado: !g.comeca_fechado });
    } catch (e) { falha(e); }
  }

  async function posicionarGrupo(g: GrupoDeColunas, antesDe: string | null) {
    const ordem = ordemAoPosicionar(topoAtual(), g.id, antesDe);
    if (ordem === null) return;
    const anterior = g.ordem;
    mudarGrupo(g.id, { ordem });
    try {
      await SD.grupoAtualizar(g.id, { ordem });
      feito(`Grupo "${g.nome}" mudou de lugar.`, 'mudança de ordem do grupo', async () => { await SD.grupoAtualizar(g.id, { ordem: anterior }); mudarGrupo(g.id, { ordem: anterior }); });
    } catch (e) { falha(e); mudarGrupo(g.id, { ordem: anterior }); }
  }

  function moverGrupo(g: GrupoDeColunas, passo: -1 | 1) {
    const antes = antesDeAoAndar(topoAtual(), g.id, passo);
    if (antes !== undefined) void posicionarGrupo(g, antes);
  }

  async function excluirGrupo(g: GrupoDeColunas) {
    const ok = await janela({
      titulo: 'Excluir grupo',
      corpo: <p>O grupo <b>{g.nome}</b> sai do quadro de todo o escritório. As colunas dele continuam, sem grupo; nada é apagado.</p>,
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Excluir grupo', valor: true, tipo: 'perigo' }]
    });
    if (!ok) return;
    try {
      await SD.grupoExcluir(g.id);
      setGrupos(gs => gs.filter(x => x.id !== g.id));
      setColunas(cs => cs.map(c => c.grupo_id === g.id ? { ...c, grupo_id: null } : c));
    } catch (e) { falha(e); }
  }

  async function agrupar(c: Coluna, grupoId: string | null) {
    if ((c.grupo_id ?? null) === grupoId) return;
    // Maior que todas (como ao criar): fica no fim do grupo, ou no fim do quadro quando sai do grupo.
    const ordem = ordemNoFimDoQuadro(atuais.current, gruposAtuais.current);
    const antes = { grupo_id: c.grupo_id ?? null, ordem: c.ordem };
    try {
      await SD.colunaAgrupar(c.id, grupoId, ordem);
      mudar(c.id, { grupo_id: grupoId, ordem });
      feito(`Coluna "${c.nome}" mudou de grupo.`, 'mudança de grupo da coluna', async () => { await SD.colunaAgrupar(c.id, antes.grupo_id, antes.ordem); mudar(c.id, antes); });
    } catch (e) { falha(e); }
  }

  return {
    colunas, sugestoes, pronto, rotuloSemEtapa,
    grupos, blocos: blocosDoQuadro(colunas.filter(c => !c.oculta), grupos), topo: filaDoTopo(colunas.filter(c => !c.oculta), grupos), filaDaColuna,
    podeGerirGrupos: ctx.ehAdmin,
    grupoAberto: g => grupoEstaAberto(g, abertos),
    alternarGrupo, criarGrupo, renomearGrupo, alternarComecoFechado, posicionarGrupo, moverGrupo, excluirGrupo, agrupar,
    ordemDe: id => ordens[id || 'sem'] || 'manual',
    ordenar: ordenarCartoes,
    nomeDe: id => colunas.find(c => c.id === id)?.nome || '',
    podeReordenar: ctx.ehAdmin,
    podeRenomear: c => ctx.ehAdmin || c.criado_por === eu,
    podeExcluir: c => podeExcluirColuna(c, ctx.ehAdmin),
    criar, ocultar, renomear, excluir, posicionar, mover
  };
}
