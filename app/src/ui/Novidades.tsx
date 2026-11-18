// Novidades (#353): o botão do menu lateral que abre a lista do que mudou em cada versão do SEMPER, com um ponto enquanto
// houver versão mais nova do que a última que a pessoa abriu. O texto vem dos arquivos de app/novidades/, escritos junto
// com cada mudança (as regras ficam em regras/novidades.ts). A última versão vista fica nas preferências da pessoa, no
// perfil: é de cada usuário, vale em qualquer aparelho e não precisa de mudança no banco.
// A lista abre numa janela larga (ui/janela.tsx): é um texto para ler, que precisa de espaço e funciona igual no celular.
// No celular, o menu lateral é uma gaveta que começa fechada: o botão aparece também na barra do topo, só com o ícone e o
// ponto, para quem entra ver o sinal sem abrir o menu. A janela já fecha com Esc e devolve o foco ao botão.
import { useId } from 'react';
import { dataPorExtenso } from '../regras/calendario';
import { haNovidadeNaoVista, marcaDaVersao, montarVersoes, type VersaoComNovidades } from '../regras/novidades';
import { Nota, Selo, Vazio } from './base';
import { Icone } from './Icone';
import { janela } from './janela';
import { criarLoja } from './loja';
import { lerPreferencia, salvarPreferencia } from './preferencias';

/** Os arquivos de app/novidades/, lidos ao compilar: um JSON por novidade e, em cada versão, o versao.json com a data. */
export const ARQUIVOS_DE_NOVIDADES: Record<string, unknown> = import.meta.glob('../../novidades/*/*.json', { eager: true, import: 'default' });
/** As versões com novidades, da mais nova para a mais antiga. A "proxima" leva o número e a data desta compilação. */
export const VERSOES = montarVersoes(ARQUIVOS_DE_NOVIDADES, { versao: __VERSAO__, data: __DATA_DA_VERSAO__ });
/** Onde fica, nas preferências da pessoa, a última versão cujas novidades ela abriu. */
export const PREFERENCIA_NOVIDADES = 'novidades.vista';
/**
 * Avisa os botões de Novidades (o do menu lateral e o da barra do topo, no celular) de que a última versão vista mudou:
 * abrir por um apaga o ponto dos dois. O valor fica nas preferências, que são de quem está logado; aqui só se conta a mudança.
 */
const vistaMudou = criarLoja(0);

function Versao({ versao }: { versao: VersaoComNovidades }) {
  const id = useId();
  return <li className="novidades-versao" aria-labelledby={id}>
    {/* O espaço separa o número da data no texto do título (leitor de tela, cópia); na tela, o CSS já os afasta. */}
    <h3 className="novidades-cabeca" id={id}>
      <Selo tipo={versao.versao ? undefined : 'pend'}>{versao.versao ?? 'Próxima versão'}</Selo>{' '}
      {versao.data ? <time dateTime={versao.data}>{dataPorExtenso(versao.data)}</time> : <span>Ainda não publicada</span>}
    </h3>
    {versao.novidades.map(n => <div className="novidade" key={n.arquivo}>
      <h4>{n.titulo}</h4>
      <p>{n.texto}</p>
      <p className="novidade-onde"><Icone nome="caminho" tam={15} /><span>{n.ondeAchar}</span></p>
      {n.link && <a className="link" href={n.link.endereco} target="_blank" rel="noopener noreferrer">{n.link.rotulo}</a>}
    </div>)}
  </li>;
}

/** A lista das versões, para a janela das Novidades. */
export function ListaDeNovidades({ versoes }: { versoes: VersaoComNovidades[] }) {
  if (!versoes.length) return <Vazio>Ainda não há novidades.</Vazio>;
  return <>
    <Nota>O que mudou no SEMPER em cada versão, da mais nova para a mais antiga, e onde achar.</Nota>
    <ol className="novidades" aria-label="Versões">
      {versoes.map(v => <Versao key={marcaDaVersao(v)} versao={v} />)}
    </ol>
  </>;
}

/** Se há novidade que a pessoa ainda não viu, e como marcar a versão mais nova como vista (vale para todos os botões). */
function useNovidadeNaoVista(versoes: VersaoComNovidades[]) {
  vistaMudou.usar();
  const naoVista = haNovidadeNaoVista(versoes, lerPreferencia<unknown>(PREFERENCIA_NOVIDADES, null));
  const marcarComoVista = () => {
    if (!naoVista) return;
    salvarPreferencia(PREFERENCIA_NOVIDADES, marcaDaVersao(versoes[0]));
    vistaMudou.mudar(n => n + 1);
  };
  return { naoVista, marcarComoVista };
}

/**
 * O botão "Novidades": no menu lateral, com o nome; na barra do topo do celular ("soIcone"), só o ícone. O ponto aparece
 * até a pessoa abrir a lista da versão mais nova, por qualquer um dos dois.
 */
export function BotaoNovidades({ versoes = VERSOES, soIcone = false }: { versoes?: VersaoComNovidades[]; soIcone?: boolean }) {
  const { naoVista, marcarComoVista } = useNovidadeNaoVista(versoes);

  function abrir() {
    marcarComoVista();
    void janela({ titulo: 'Novidades', corpo: <ListaDeNovidades versoes={versoes} />, larga: true });
  }

  const aviso = naoVista ? 'Há novidades que você ainda não viu' : undefined;
  const nome = aviso ? `Novidades: ${aviso.toLowerCase()}` : 'Novidades';
  // Com o nome à vista, o rótulo só muda quando há o ponto; só com o ícone, o rótulo e a dica dizem sempre o que é.
  return <button type="button" onClick={abrir} title={soIcone ? aviso ?? nome : aviso} aria-label={soIcone || aviso ? nome : undefined}>
    <Icone nome="foguete" />{!soIcone && <span>Novidades</span>}{naoVista && <span className="nav-ponto" aria-hidden="true" />}
  </button>;
}
