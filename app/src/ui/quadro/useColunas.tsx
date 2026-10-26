// Colunas do quadro (kanban) de um módulo: carregar, criar, ocultar, renomear, excluir e reordenar,
// com as regras de permissão e o desfazer, e a ordem dos cartões de cada coluna (escolha de cada usuário). As colunas são do escritório; cada usuário só as oculta para si.
// Todo módulo com quadro usa este gancho com o <Kanban>; nada disso se reescreve por página.
import { useEffect, useRef, useState } from 'react';
import { SD, type Coluna, type ContextoAtivo, type Modulo, type Ordem } from '../../dados';
import { falha, feito } from '../avisos';
import { janela, pedirTexto } from '../janela';
import { lerPreferencia, salvarPreferencia } from '../preferencias';
import { normal } from '../util';

export interface Quadro {
  colunas: Coluna[];
  sugestoes: string[];
  pronto: boolean;
  rotuloSemEtapa: string;
  nomeDe: (id: string | null) => string;
  podeReordenar: boolean;
  podeRenomear: (c: Coluna) => boolean;
  podeExcluir: (c: Coluna) => boolean;
  /** Cria a coluna (ou oferece mostrar a que já existe oculta). Devolve true se criou. */
  criar: (nome: string) => Promise<boolean>;
  ocultar: (c: Coluna, ocultar: boolean) => Promise<void>;
  renomear: (c: Coluna) => Promise<void>;
  excluir: (c: Coluna) => Promise<void>;
  /** Coloca a coluna antes de "antesDe" (ou no fim, se null), entre as visíveis. A ordem vale para todo o escritório. */
  posicionar: (c: Coluna, antesDe: Coluna | null) => Promise<void>;
  mover: (c: Coluna, passo: -1 | 1) => void;
  /** Ordem dos cartões de uma coluna (null = "Sem etapa"). Cada coluna tem a sua; o padrão é a manual. */
  ordemDe: (colunaId: string | null) => Ordem;
  ordenar: (colunaId: string | null, ordem: Ordem) => void;
}

const ordenar = (cs: Coluna[]) => cs.slice().sort((a, b) => a.ordem - b.ordem);

export function useColunas(modulo: Modulo, ctx: ContextoAtivo, rotuloSemEtapa = 'Sem etapa'): Quadro {
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [pronto, setPronto] = useState(false);
  const atuais = useRef(colunas);
  atuais.current = colunas;
  // Ordem escolhida em cada coluna, guardada no perfil: { "sem" | id da coluna: ordem }.
  const chaveOrdens = `${modulo}.ordem.colunas`;
  const [ordens, setOrdens] = useState<Record<string, Ordem>>(() => lerPreferencia(chaveOrdens, {}));

  useEffect(() => {
    let vivo = true;
    Promise.all([SD.colunasListar(modulo), SD.sugestoesListar(modulo)])
      .then(([c, s]) => { if (vivo) { setColunas(ordenar(c)); setSugestoes(s); } })
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

  async function criar(nome: string) {
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
      const ordem = (atuais.current.length ? Math.max(...atuais.current.map(c => c.ordem)) : 0) + 1;
      const c = await SD.colunaCriar(modulo, nome, ordem);
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

  async function posicionar(c: Coluna, antesDe: Coluna | null) {
    if (antesDe?.id === c.id) return;
    const cs = atuais.current;
    const visiveis = cs.filter(x => !x.oculta && x.id !== c.id);
    const lugar = antesDe ? visiveis.findIndex(x => x.id === antesDe.id) : visiveis.length;
    const ant = visiveis[lugar - 1], prox = visiveis[lugar];
    const agora = cs.filter(x => !x.oculta), i = agora.findIndex(x => x.id === c.id);
    if (agora[i - 1]?.id === ant?.id && agora[i + 1]?.id === prox?.id) return;   // não mudou
    const anterior = c.ordem;
    const ordem = ant && prox ? (ant.ordem + prox.ordem) / 2 : ant ? ant.ordem + 1 : prox ? prox.ordem - 1 : c.ordem;
    mudar(c.id, { ordem });
    try {
      await SD.colunaOrdenar(c.id, ordem);
      feito(`Coluna "${c.nome}" mudou de lugar.`, 'mudança de ordem da coluna', async () => { await SD.colunaOrdenar(c.id, anterior); mudar(c.id, { ordem: anterior }); });
    } catch (e) { falha(e); mudar(c.id, { ordem: anterior }); }
  }

  function mover(c: Coluna, passo: -1 | 1) {
    const visiveis = atuais.current.filter(x => !x.oculta), i = visiveis.findIndex(x => x.id === c.id);
    if (passo < 0 && i > 0) posicionar(c, visiveis[i - 1]);
    if (passo > 0 && i < visiveis.length - 1) posicionar(c, visiveis[i + 2] || null);
  }

  function ordenarCartoes(colunaId: string | null, ordem: Ordem) {
    const k = colunaId || 'sem', novas = { ...ordens, [k]: ordem };
    if (ordem === 'manual') delete novas[k];
    setOrdens(novas);
    salvarPreferencia(chaveOrdens, novas);
  }

  return {
    colunas, sugestoes, pronto, rotuloSemEtapa,
    ordemDe: id => ordens[id || 'sem'] || 'manual',
    ordenar: ordenarCartoes,
    nomeDe: id => colunas.find(c => c.id === id)?.nome || '',
    podeReordenar: ctx.ehAdmin,
    podeRenomear: c => ctx.ehAdmin || c.criado_por === eu,
    podeExcluir: () => ctx.ehAdmin,
    criar, ocultar, renomear, excluir, posicionar, mover
  };
}
