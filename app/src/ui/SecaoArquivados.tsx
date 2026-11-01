// Embaixo da tabela de cada módulo, a seção recolhível "Arquivados (N)": os arquivados numa tabela própria (a mesma
// tabela do módulo), com seleção e as ações Desarquivar e Excluir. Começa recolhida, como toda seção, e a lista só é
// lida quando ela abre; o número aparece mesmo fechada. Peça comum: todo módulo com arquivo a usa assim.
import { useEffect, useState, type ReactNode } from 'react';
import type { Exclusao, Pagina } from '../dados';
import { avisar, falha, feito } from './avisos';
import { BotaoDuplo } from './Botoes';
import { Aviso, Carregando, estiloBotao } from './base';
import { Icone } from './Icone';
import { Recolhivel } from './Recolhivel';
import { useSelecao, type Selecao } from './useSelecao';
import { numero } from './util';

/** Como o módulo chama os seus itens, no singular e no plural, e se a palavra é feminina (pessoa, demanda, tarefa). */
export interface NomeDosItens { um: string; varios: string; feminino: boolean }

interface Props<T extends { id: string }> {
  /** Módulo (guarda a escolha de abrir ou fechar a seção: "<modulo>.arquivados"). */
  modulo: string;
  nome: NomeDosItens;
  /** Quantos arquivados há (null enquanto conta). */
  total: number | null;
  listar: (pagina: number) => Promise<Pagina<T>>;
  arquivar: (ids: string[], arquivar: boolean) => Promise<number>;
  excluir: (ids: string[]) => Promise<Exclusao>;
  /** A tabela do módulo, com a página dos arquivados, a seleção e a troca de página. */
  tabela: (pagina: Pagina<T>, numeroDaPagina: number, selecao: Selecao, aoPaginar: (n: number) => void) => ReactNode;
  /** Muda quando algo mudou na página (ex.: arquivaram itens na tabela de cima): relê a lista. */
  versao: number | string;
  /** Avisa a página de que desarquivou ou excluiu (para ela reler a tabela de cima e as contagens). */
  aoMudar: () => void;
}

export function SecaoArquivados<T extends { id: string }>(props: Props<T>) {
  return <div className="secao-arquivados">
    <Recolhivel titulo="Arquivados" icone="arquivo" preferencia={props.modulo + '.arquivados'} contador={props.total ?? undefined}>
      <ListaDeArquivados {...props} />
    </Recolhivel>
  </div>;
}

function ListaDeArquivados<T extends { id: string }>({ nome, listar, arquivar, excluir, tabela, versao, aoMudar }: Props<T>) {
  const [pagina, setPagina] = useState(0);
  const [lista, setLista] = useState<Pagina<T> | string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const selecao = useSelecao();
  useEffect(() => {
    let vivo = true;
    listar(pagina).then(r => { if (vivo) setLista(r); }).catch(e => { if (vivo) setLista((e as Error).message); });
    return () => { vivo = false; };
  // oxlint-disable-next-line react/exhaustive-deps -- relê ao trocar de página e quando algo muda (versao, recarga), não a cada desenho
  }, [pagina, versao, recarga]);

  const contar = (n: number) => `${numero(n)} ${n === 1 ? nome.um : nome.varios}`;
  const o = nome.feminino ? 'a' : 'o';
  const depois = () => { selecao.limpar(); setRecarga(x => x + 1); aoMudar(); };
  async function desarquivar() {
    const ids = [...selecao.selecionadas];
    try {
      const q = await arquivar(ids, false);
      feito(`${contar(q)} ${q === 1 ? 'voltou' : 'voltaram'} para a lista.`, `desarquivamento de ${contar(q)}`, async () => { await arquivar(ids, true); });
      depois();
    } catch (e) { falha(e); }
  }
  async function excluirSelecionados() {
    try {
      const r = await excluir([...selecao.selecionadas]);
      avisar(r.naoExcluidas
        ? `${contar(r.excluidas)} excluíd${o}${r.excluidas === 1 ? '' : 's'}. ${numero(r.naoExcluidas)} não ${r.naoExcluidas === 1 ? 'pôde' : 'puderam'} ser excluíd${o}${r.naoExcluidas === 1 ? '' : 's'}: ${r.motivo}`
        : `${contar(r.excluidas)} excluíd${o}${r.excluidas === 1 ? '' : 's'} definitivamente.`, r.naoExcluidas ? 'erro' : 'ok');
      depois();
    } catch (e) { falha(e); }
  }

  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  const n = selecao.quantas;
  return <div className="arquivados">
    {n > 0 && <div className="arquivados-acoes" role="group" aria-label="Ações nos arquivados selecionados">
      <span><b>{numero(n)}</b> {n === 1 ? `selecionad${o}` : `selecionad${o}s`}</span>
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={desarquivar}><Icone nome="arquivo" tam={15} /> Desarquivar</button>
      <BotaoDuplo forma="mini" variante="perigo" confirmar={`Confirmar exclusão de ${numero(n)}`} aoConfirmar={excluirSelecionados}><Icone nome="lixeira" tam={15} /> Excluir</BotaoDuplo>
      <button type="button" className={estiloBotao({ forma: 'link' })} onClick={() => selecao.limpar()}>limpar</button>
    </div>}
    {tabela(lista, pagina, selecao, p => { selecao.limpar(); setPagina(p); })}
  </div>;
}
