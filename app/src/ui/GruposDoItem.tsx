// Os grupos da equipe de um item (#378), em pílulas: no topo do cartão (GruposNoCartao), depois das bolinhas dos participantes, e
// no quadro e na tabela (GruposDoItem), depois das bolinhas, só para ver.
// A pílula não tem a forma de bolinha, para não ser confundida com uma pessoa: o ícone de equipe, o nome (cortado com reticências)
// e quantas pessoas participam pelo grupo ("Núcleo A · 4"). A do grupo em que quem está logado está tem o contorno verde.
// No topo do cartão, a pílula é um botão: a dica (mouse e foco) mostra quem está; o clique ou o toque abre a lista dos integrantes
// e, para quem altera o cartão, "Tirar o grupo do cartão". O clique na pílula nunca tira o grupo (decisão 7 do plano: no celular
// não há mouse, e o toque precisa mostrar quem está).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GrupoDaEquipe, Membro } from '../dados/tipos';
import {
  dicaDaPilula, gruposDoItem, integrantesAtivos, linhaDosGruposNoLapis, maisGrupos, nomeDoGrupo, numeroDoGrupo, PILULAS_NO_QUADRO,
  PILULAS_NO_TOPO, quantasPessoas, rotuloDoGrupoNoQuadro
} from '../regras/gruposDaEquipe';
import { Avatar } from './Avatar';
import { estiloBotao, Nota, propsDaDica } from './base';
import { Icone } from './Icone';
import { MenuFlutuante } from './Menu';
import { useCtx } from './sessao';

/** Tamanho do ícone de equipe dentro da pílula do topo do cartão e dentro da do quadro. */
const ICONE_DA_PILULA = 15, ICONE_NO_QUADRO = 12;
/** Tamanho da bolinha de cada integrante na lista do grupo. */
const BOLINHA_NA_LISTA = 24;
/** O que o botão de dentro da lista faz. */
export const TIRAR_O_GRUPO = 'Tirar o grupo do cartão';
/** O que a pílula diz, além do nome, para o leitor de tela: o clique mostra quem está. */
const VER_QUEM_ESTA = 'Ver quem está';

const classeDaPilula = (g: GrupoDaEquipe, eu: string, base: string) => base + (g.integrantes.includes(eu) ? ' minha' : '');

/** O conteúdo da pílula: o ícone, o nome cortado e o número de pessoas. */
function MioloDaPilula({ g, equipe, icone }: { g: GrupoDaEquipe; equipe: readonly Membro[]; icone: number }) {
  return <>
    <Icone nome="equipe" tam={icone} />
    <span className="grupo-nome">{g.nome}</span>
    <span className="grupo-numero"> · {numeroDoGrupo(g, equipe)}</span>
  </>;
}

interface PropsDoQuadro {
  /** Os grupos do item (já na ordem do item). */
  grupos: readonly GrupoDaEquipe[];
  equipe: readonly Membro[];
  eu: string;
  /** Quantas pílulas mostrar antes do "+N". */
  max?: number;
}

/**
 * Os grupos no cartão do quadro e na linha da tabela, só para ver, como as bolinhas (Avatares): a dica no mouse e o nome completo
 * para o leitor de tela, sem botão nem lista (o cartão do quadro é clicável e se arrasta). Sem grupos, nada.
 */
export function GruposDoItem({ grupos, equipe, eu, max = PILULAS_NO_QUADRO }: PropsDoQuadro) {
  if (!grupos.length) return null;
  const extra = grupos.slice(max);
  return <span className="grupos-do-item">
    {grupos.slice(0, max).map(g => <span key={g.id} className={classeDaPilula(g, eu, 'grupo-pilula compacta')} role="img"
      aria-label={rotuloDoGrupoNoQuadro(g, equipe)} {...propsDaDica(dicaDaPilula(g, equipe, eu))}>
      <MioloDaPilula g={g} equipe={equipe} icone={ICONE_NO_QUADRO} />
    </span>)}
    {extra.length > 0 && <span className="grupo-pilula compacta mais" role="img" aria-label={`Mais ${extra.length}: ${extra.map(g => g.nome).join(', ')}`}
      {...propsDaDica(extra.map(g => g.nome).join(', '))}>+{extra.length}</span>}
  </span>;
}

interface PropsDoCartao {
  /** Os grupos do item, já na ordem do item. */
  grupos: readonly GrupoDaEquipe[];
  equipe: readonly Membro[];
  eu: string;
  /** Sem isto, a lista é só para ver (quem só lê o cartão, o cartão arquivado). */
  tirar?: (g: GrupoDaEquipe) => unknown;
  /** Uma mudança ainda grava: o "Tirar" fica desligado. */
  ocupado?: boolean;
  /** A nota de quem está no cartão só por este grupo (notaDeQuemEstaPeloGrupo: como sair, por outra pessoa do cartão ou um administrador). */
  nota?: (g: GrupoDaEquipe) => string | null;
  /** Por que este grupo não sai do cartão: o motivo aparece no lugar do "Tirar". */
  impedeTirar?: (g: GrupoDaEquipe) => string | undefined;
}

/** As pílulas no topo do cartão: até PILULAS_NO_TOPO e o "+N grupos", que abre a mesma lista dos que não couberam. */
export function GruposNoCartao({ grupos, equipe, eu, tirar, ocupado, nota, impedeTirar }: PropsDoCartao) {
  const [aberto, setAberto] = useState<{ botao: HTMLElement; grupos: readonly GrupoDaEquipe[] } | null>(null);
  if (!grupos.length) return null;
  const visiveis = grupos.slice(0, PILULAS_NO_TOPO), outros = grupos.slice(PILULAS_NO_TOPO);
  const abrir = (botao: HTMLElement, lista: readonly GrupoDaEquipe[]) => setAberto(a => a?.botao === botao ? null : { botao, grupos: lista });
  const expandido = (botao: HTMLElement | null) => !!aberto && aberto.botao === botao;
  return <span className="grupos-do-cartao">
    {visiveis.map(g => <BotaoDoGrupo key={g.id} rotulo={`${nomeDoGrupo(g, equipe)}. ${VER_QUEM_ESTA}`} dica={dicaDaPilula(g, equipe, eu)}
      classe={classeDaPilula(g, eu, 'grupo-pilula')} expandido={expandido} aoAbrir={b => abrir(b, [g])}>
      <MioloDaPilula g={g} equipe={equipe} icone={ICONE_DA_PILULA} />
    </BotaoDoGrupo>)}
    {outros.length > 0 && <BotaoDoGrupo rotulo={`${maisGrupos(outros.length)}: ${outros.map(g => g.nome).join(', ')}. ${VER_QUEM_ESTA}`}
      dica={outros.map(g => g.nome).join(', ')} classe="grupo-pilula mais" expandido={expandido} aoAbrir={b => abrir(b, outros)}>
      {maisGrupos(outros.length)}
    </BotaoDoGrupo>}
    {aberto && <MenuFlutuante botao={aberto.botao} painel rotulo={aberto.grupos.length === 1 ? `Grupo ${aberto.grupos[0].nome}` : 'Grupos da equipe'}
      aoFechar={() => setAberto(null)}>
      <ListaDosGrupos grupos={aberto.grupos} equipe={equipe} eu={eu} ocupado={ocupado} nota={nota} impedeTirar={impedeTirar}
        tirar={tirar && (g => { setAberto(null); void tirar(g); })} />
    </MenuFlutuante>}
  </span>;
}

function BotaoDoGrupo({ rotulo, dica, classe, expandido, aoAbrir, children }: {
  rotulo: string; dica: string; classe: string; expandido: (b: HTMLElement | null) => boolean; aoAbrir: (b: HTMLElement) => void; children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return <button ref={ref} type="button" className={classe} aria-label={rotulo} aria-haspopup="dialog" aria-expanded={expandido(ref.current)}
    {...propsDaDica(dica)} onClick={e => aoAbrir(e.currentTarget)}>{children}</button>;
}

/** A lista de quem está em cada grupo, com "Você" junto ao próprio nome, e o "Tirar o grupo do cartão" para quem altera. */
function ListaDosGrupos({ grupos, equipe, eu, tirar, ocupado, nota, impedeTirar }: Omit<PropsDoCartao, 'grupos'> & { grupos: readonly GrupoDaEquipe[] }) {
  const primeira = useRef<HTMLUListElement>(null);
  // O foco vai à lista (e não ao "Tirar", que um Enter a mais acionaria): depois do foco que o painel põe no primeiro botão.
  useEffect(() => { primeira.current?.focus(); }, []);
  return <div className="grupos-lista">
    {grupos.map((g, i) => {
      const integrantes = integrantesAtivos(g, equipe).toSorted((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const impede = tirar ? impedeTirar?.(g) : undefined;
      // Quem não pode tirar o grupo lê o motivo, que já diz como sair (a nota repetiria a mesma coisa).
      const aviso = impede ?? nota?.(g);
      return <section key={g.id} className="grupo-da-lista" aria-label={`Grupo ${g.nome}`}>
        <p className="grupo-titulo"><Icone nome="equipe" tam={ICONE_DA_PILULA} /><b>{g.nome}</b><span className="nota">{quantasPessoas(integrantes.length)}</span></p>
        {integrantes.length
          ? <ul ref={i === 0 ? primeira : undefined} tabIndex={-1} aria-label={`Integrantes do grupo ${g.nome}`}>
            {integrantes.map(m => <li key={m.id}><span aria-hidden="true"><Avatar p={m} tam={BOLINHA_NA_LISTA} semDica /></span>
              <span>{m.nome}</span>{m.id === eu && <span className="nota">Você</span>}</li>)}
          </ul>
          : <Nota>Ninguém neste grupo ainda.</Nota>}
        {aviso && <Nota>{aviso}</Nota>}
        {tirar && !impede && <button type="button" className={estiloBotao({ forma: 'mini', variante: 'perigo' })} disabled={ocupado}
          aria-label={grupos.length > 1 ? `${TIRAR_O_GRUPO}: ${g.nome}` : undefined} onClick={() => tirar(g)}>
          <Icone nome="fechar" tam={ICONE_DA_PILULA} /> {TIRAR_O_GRUPO}
        </button>}
      </section>;
    })}
  </div>;
}

/**
 * No lápis (Editar), abaixo da equipe: os grupos do item, só para ver, com onde mudá-los ("Grupos: Núcleo A (mude no topo do
 * cartão)"). Sem grupos no item, nada.
 */
export function GruposNoLapis({ ids }: { ids: readonly string[] | undefined }) {
  const ctx = useCtx();
  const linha = linhaDosGruposNoLapis(gruposDoItem(ctx.grupos, ids).map(g => g.nome));
  return linha ? <Nota>{linha}</Nota> : null;
}
