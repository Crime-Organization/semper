// O painel de um grupo da equipe em Equipe e acessos (#378), como o de um usuário (UsuarioDaEquipe.tsx): o nome, os integrantes e
// a exclusão. Cada pessoa posta ou tirada grava sozinha (uma por vez, com o Desfazer de cada uma): duas mudanças seguidas, ou dois
// administradores ao mesmo tempo, não apagam uma à outra, porque nenhuma grava a lista inteira.
import { useId, useRef, useState, type FormEvent } from 'react';
import { SD, type GrupoDaEquipe as Grupo, type ItensDoGrupo } from '../dados';
import { TAMANHO_GRUPO_DA_EQUIPE } from '../dados/limites';
import { corpoDaExclusao, ondeOGrupoEsta, tituloDaExclusao } from '../regras/gruposDaEquipe';
import { avisar, falha, feito } from '../ui/avisos';
import { Campo, estiloBotao, Nota, propsDoCampo, SecaoDoFormulario, Selo } from '../ui/base';
import { EscolhaDaEquipe } from '../ui/EscolhaDaEquipe';
import { confirmar } from '../ui/janela';
import { useCtx } from '../ui/sessao';

/** O que o botão de excluir diz, e a confirmação dele. */
export const EXCLUIR_O_GRUPO = 'Excluir o grupo';

interface Props {
  g: Grupo;
  /** Em quantos itens o grupo está (null: ainda contando). */
  itens: ItensDoGrupo[] | null;
  /** Depois de cada mudança: relê o contexto (os grupos) e as contagens. */
  aoMudar: () => Promise<void>;
  /** O grupo foi excluído: o painel fecha. */
  aoExcluir: () => Promise<void>;
}

export function GrupoDaEquipe({ g, itens, aoMudar, aoExcluir }: Props) {
  const ctx = useCtx();
  const id = useId();
  const [nome, setNome] = useState(g.nome);
  const [ocupado, setOcupado] = useState(false);
  // Barra a segunda mudança antes de a tela se desenhar de novo (o estado só muda no próximo desenho).
  const gravando = useRef(false);
  const mudouNome = nome.trim() !== g.nome;

  async function umaDeCadaVez(gravar: () => Promise<void>) {
    if (gravando.current) return;
    gravando.current = true;
    setOcupado(true);
    try { await gravar(); } catch (e) { falha(e); }
    await aoMudar();
    gravando.current = false;
    setOcupado(false);
  }

  const salvarNome = (ev: FormEvent) => {
    ev.preventDefault();
    if (!mudouNome) return;
    void umaDeCadaVez(async () => {
      await SD.grupoDaEquipeRenomear(g.id, nome);
      avisar(`Nome salvo: ${nome.trim()}.`);
    });
  };

  const nomeDe = (perfil: string) => ctx.equipe.find(m => m.id === perfil)?.nome ?? 'Usuário removido';
  // A escolha da equipe devolve a lista nova: quem entrou ou saiu é uma pessoa só, gravada sozinha.
  const mudarIntegrantes = (ids: string[]) => umaDeCadaVez(async () => {
    const entrou = ids.find(x => !g.integrantes.includes(x)), saiu = g.integrantes.find(x => !ids.includes(x));
    if (entrou) {
      await SD.grupoDaEquipeIncluir(g.id, entrou);
      feito(`${nomeDe(entrou)} agora está no grupo ${g.nome}.`, 'inclusão no grupo', async () => { await SD.grupoDaEquipeTirar(g.id, entrou); await aoMudar(); });
    } else if (saiu) {
      await SD.grupoDaEquipeTirar(g.id, saiu);
      feito(`${nomeDe(saiu)} saiu do grupo ${g.nome}.`, 'saída do grupo', async () => { await SD.grupoDaEquipeIncluir(g.id, saiu); await aoMudar(); });
    }
  });

  async function excluir() {
    try {
      const contagem = await SD.grupoDaEquipeContarItens(g.id);
      if (!await confirmar(tituloDaExclusao(g.nome), corpoDaExclusao(g.nome, contagem), EXCLUIR_O_GRUPO, true)) return;
      await SD.grupoDaEquipeExcluir(g.id);
      avisar(`O grupo ${g.nome} foi excluído.`);
      await aoExcluir();
    } catch (e) { falha(e); }
  }

  return <>
    <header className="cartao-cabeca">
      <div className="linha"><Selo tipo="escuro">Grupo da equipe</Selo></div>
      <h2>{g.nome}</h2>
    </header>
    <div className="edicao-cartao">
      <section className="bloco separada" aria-label="Nome do grupo">
        <form className="usuario-nome" onSubmit={salvarNome} noValidate>
          <Campo rotulo="Nome" para={id + 'nome'}>
            <input type="text" {...propsDoCampo(id + 'nome')} value={nome} maxLength={TAMANHO_GRUPO_DA_EQUIPE} onChange={e => setNome(e.target.value)} />
          </Campo>
          <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={!mudouNome || ocupado}>{ocupado ? 'Salvando…' : 'Salvar nome'}</button>
        </form>
      </section>

      <section className="bloco separada" aria-label="Integrantes do grupo">
        {/* Enquanto uma mudança grava, a escolha fica desligada: a outra espera esta terminar. */}
        <fieldset className="sem-moldura" disabled={ocupado} aria-busy={ocupado || undefined}>
          <EscolhaDaEquipe rotulo="Integrantes" adicionar="Adicionar integrante" equipe={ctx.equipe} escolhidos={g.integrantes} aoMudar={ids => void mudarIntegrantes(ids)}
            dica="Cada pessoa posta ou tirada é gravada na hora. Quem está desativado continua no grupo, sem acesso: reativado, volta a participar." />
        </fieldset>
      </section>

      <SecaoDoFormulario titulo="Onde o grupo está" nivel={3}>
        <Nota>{itens ? `${ondeOGrupoEsta(itens)}, contando os arquivados.` : 'Contando os itens…'}</Nota>
      </SecaoDoFormulario>

      <SecaoDoFormulario titulo={EXCLUIR_O_GRUPO} nivel={3}>
        <Nota>Tira o grupo de todos os itens, também dos arquivados. Quem participa só pelo grupo deixa de ver esses itens; as pessoas continuam na equipe. Não tem desfazer.</Nota>
        <div className="financeiro-acoes">
          <button type="button" className={estiloBotao({ forma: 'mini', variante: 'perigo' })} disabled={ocupado} onClick={() => void excluir()}>{EXCLUIR_O_GRUPO}</button>
        </div>
      </SecaoDoFormulario>
    </div>
  </>;
}
