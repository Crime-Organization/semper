// A seção "Grupos da equipe" de Equipe e acessos (#378), só para administradores (a página toda já é): a mesma tabela dos usuários,
// com o grupo, quem está nele e em quantos itens ele está. Clicar na linha abre o painel do grupo (GrupoDaEquipe.tsx), onde se muda
// o nome, se escolhem os integrantes e se exclui o grupo. "Novo grupo" pede o nome e abre o painel do grupo novo.
// Os grupos vêm do contexto (Contexto.grupos); depois de mudar um, a página relê o contexto, e as outras telas o leem de novo na
// próxima vez que a pessoa as abrir.
import { useEffect, useState } from 'react';
import { SD, type ItensDoGrupo } from '../dados';
import { TAMANHO_GRUPO_DA_EQUIPE } from '../dados/limites';
import { integrantesAtivos, ondeOGrupoEsta, quantasPessoas } from '../regras/gruposDaEquipe';
import { Avatares } from '../ui/Avatar';
import { avisar, falha } from '../ui/avisos';
import { estiloBotao, Nota, TituloSecao, Vazio } from '../ui/base';
import { Icone } from '../ui/Icone';
import { pedirTexto } from '../ui/janela';
import { PainelCartao } from '../ui/PainelCartao';
import { useSessao } from '../ui/sessao';
import { GrupoDaEquipe } from './GrupoDaEquipe';

/** Tamanho do ícone do botão "Novo grupo". */
const ICONE_DO_NOVO = 15;
/** Quantas bolinhas de integrantes a linha mostra antes do "+N". */
const BOLINHAS_NA_LINHA = 5;
/** O título da janela que pede o nome do grupo novo (também o nome do campo). */
export const NOME_DO_GRUPO_NOVO = 'Nome do grupo novo';

export function GruposDaEquipe() {
  const { ctx, recarregar } = useSessao();
  const grupos = ctx.grupos ?? [];
  // O grupo aberto no painel (o id: o contexto relido traz os dados novos).
  const [aberto, setAberto] = useState<string | null>(null);
  // Em quantos itens cada grupo está, contando os arquivados: lido à parte, para a tabela não esperar a contagem.
  const [itens, setItens] = useState<Record<string, ItensDoGrupo[]>>({});
  const chave = grupos.map(g => g.id).join('|');
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    const ids = chave ? chave.split('|') : [];
    Promise.all(ids.map(async id => [id, await SD.grupoDaEquipeContarItens(id)] as const))
      .then(lista => { if (vivo) setItens(Object.fromEntries(lista)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [chave, versao]);

  const mudou = async () => { await recarregar(true); setVersao(v => v + 1); };
  const doAberto = grupos.find(g => g.id === aberto) ?? null;

  async function novo() {
    const nome = await pedirTexto(NOME_DO_GRUPO_NOVO, '', { maximo: TAMANHO_GRUPO_DA_EQUIPE });
    if (!nome) return;
    try {
      const id = await SD.grupoDaEquipeCriar(nome);
      avisar(`Grupo ${nome} criado. Agora escolha quem está nele.`);
      await mudou();
      setAberto(id);
    } catch (e) { falha(e); }
  }

  return <section aria-labelledby="tGrupos" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div className="grupos-da-equipe-cabeca">
      <TituloSecao id="tGrupos">Grupos da equipe</TituloSecao>
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => void novo()}><Icone nome="mais" tam={ICONE_DO_NOVO} /> Novo grupo</button>
    </div>
    <Nota style={{ marginTop: -6 }}>Um grupo junta pessoas da equipe, como um núcleo do escritório. Posto num item, todos do grupo participam dele; quem entra no grupo depois também participa, e quem sai deixa de participar (a não ser que esteja no item por conta própria).</Nota>
    {!grupos.length
      ? <Vazio>Nenhum grupo ainda. Um grupo junta pessoas da equipe (por exemplo, um núcleo) para pôr todas de uma vez numa demanda, tarefa ou contrato.</Vazio>
      : <div className="tabela"><table className="tabela-grupos">
        <thead><tr><th scope="col">Grupo</th><th scope="col">Integrantes</th><th scope="col">Itens</th></tr></thead>
        <tbody>{grupos.map(g => {
          const ativos = integrantesAtivos(g, ctx.equipe);
          return <tr key={g.id} className="clicavel" onClick={() => setAberto(g.id)}>
            <td><button type="button" className="financeiro-abrir nome" aria-label={`Abrir o grupo ${g.nome}`} onClick={e => { e.stopPropagation(); setAberto(g.id); }}>{g.nome}</button></td>
            <td><div className="integrantes-do-grupo">
              {ativos.length > 0 && <Avatares ids={ativos.map(m => m.id)} equipe={ctx.equipe} max={BOLINHAS_NA_LINHA} />}
              <span className="sub">{ativos.length ? quantasPessoas(ativos.length) : 'Ninguém ainda'}</span>
            </div></td>
            <td><span className="sub">{itens[g.id] ? ondeOGrupoEsta(itens[g.id]) : '…'}</span></td>
          </tr>;
        })}</tbody>
      </table></div>}
    {doAberto && <PainelCartao aoFechar={() => setAberto(null)} soNoCentro ajustado rotulo={`Grupo ${doAberto.nome}`}>
      <GrupoDaEquipe key={doAberto.id} g={doAberto} itens={itens[doAberto.id] ?? null} aoMudar={mudou}
        aoExcluir={async () => { setAberto(null); await mudou(); }} />
    </PainelCartao>}
  </section>;
}
