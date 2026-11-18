// A equipe da anotação (#339): quem responde por ela e com quem ela é compartilhada. Na anotação nova, os dois campos ficam numa
// linha discreta logo abaixo do título; no cartão, o lápis abre só eles (o título e o texto se mudam no próprio lugar, com um
// clique). A saída de quem se tira da anotação segue a regra da #276 (semSairDaAnotacao e sairDoCartao).
import { useEffect, useRef, useState } from 'react';
import { SD, type Anotacao } from '../dados';
import {
  dadosDaEquipe, equipeDaAnotacao, erroDaEquipe, gravaForaDaAnotacao, semSairDaAnotacao, type CamposDaEquipe
} from '../regras/anotacao';
import { RodapeDaEdicao } from '../ui/AcoesDoCartao';
import { falha, feito } from '../ui/avisos';
import { Campo, propsDoCampo } from '../ui/base';
import { EscolhaDaEquipe } from '../ui/EscolhaDaEquipe';
import { sairDoCartao } from '../ui/sairDoCartao';
import { useCtx } from '../ui/sessao';

interface PropsCampos {
  campos: CamposDaEquipe;
  aoMudar: (c: CamposDaEquipe) => void;
  erro?: string;
  /** Com as dicas de cada campo (no cartão); na anotação nova, a linha fica só com os nomes. */
  comDicas?: boolean;
}

/** O responsável e "Compartilhar com", lado a lado (um embaixo do outro no estreito). */
export function CamposDaEquipeDaAnotacao({ campos, aoMudar, erro, comDicas = false }: PropsCampos) {
  const ctx = useCtx();
  // Responsável: qualquer um da equipe ativa, e quem já é o responsável (mesmo desativado, para não sair sem querer).
  const opcoes = ctx.equipe.filter(m => m.ativo !== false || m.id === campos.responsavelId);
  const dica = comDicas ? 'Quem responde pela anotação: qualquer um da equipe.' : undefined;
  return <div className="anotacao-equipe">
    <Campo rotulo="Responsável" para="responsavelId" obrigatorio erro={erro} dica={dica}>
      <select {...propsDoCampo('responsavelId', { dica, erro })} value={campos.responsavelId}
        onChange={e => aoMudar({ responsavelId: e.target.value, participantes: campos.participantes.filter(x => x !== e.target.value) })}>
        <option value="">Escolha…</option>
        {opcoes.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
    </Campo>
    <EscolhaDaEquipe rotulo="Compartilhar com" dica={comDicas ? 'Quem da equipe também vê e altera a anotação.' : undefined} adicionar="Adicionar pessoa da equipe"
      equipe={ctx.equipe} escolhidos={campos.participantes} fora={campos.responsavelId ? [campos.responsavelId] : []}
      aoMudar={participantes => aoMudar({ ...campos, participantes })} />
  </div>;
}

interface PropsEdicao {
  anotacao: Anotacao;
  /** Salvou (true) ou desistiu (false). */
  aoTerminar: (salvou: boolean) => void;
  /** A pessoa se tirou da anotação e pode deixar de vê-la: o cartão fecha. */
  aoSairDaAnotacao: () => void;
  /** A equipe como está na edição (null: fechada), para o cartão avisar ao sair sem salvar. */
  aoMudarRascunho: (campos: CamposDaEquipe | null) => void;
  /** Se a equipe está sendo gravada, para o cartão pedir que a pessoa espere antes de sair. */
  aoMudarOcupado?: (ocupado: boolean) => void;
}

/** O lápis do cartão: muda só a equipe, com Cancelar e Salvar no pé. */
export function EditarEquipeDaAnotacao({ anotacao: alvo, aoTerminar, aoSairDaAnotacao, aoMudarRascunho, aoMudarOcupado }: PropsEdicao) {
  const ctx = useCtx();
  const [campos, setCampos] = useState(() => equipeDaAnotacao(alvo));
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const erro = conferido ? erroDaEquipe(campos) : '';
  const avisarOcupado = useRef(aoMudarOcupado);
  avisarOcupado.current = aoMudarOcupado;
  // O cartão sabe enquanto a gravação corre; ao fechar a edição, ela já não está gravando.
  useEffect(() => {
    avisarOcupado.current?.(ocupado);
    return () => avisarOcupado.current?.(false);
  }, [ocupado]);

  function mudar(c: CamposDaEquipe) {
    setCampos(c);
    aoMudarRascunho(c);
  }
  function terminar(salvou: boolean) {
    aoMudarRascunho(null);
    aoTerminar(salvou);
  }
  async function salvar() {
    if (ocupado) return;
    setConferido(true);
    if (erroDaEquipe(campos)) return;
    // Para desfazer: a equipe como estava, no mesmo formato que a edição grava.
    const antes = dadosDaEquipe(equipeDaAnotacao(alvo));
    const eu = ctx.perfil.id, { dados, ficou } = semSairDaAnotacao(dadosDaEquipe(campos), eu, gravaForaDaAnotacao(ctx, alvo.criado_por === eu),
      { responsavel_id: alvo.responsavel_id, lista: alvo.participantes });
    setOcupado(true);
    try {
      await SD.anotacaoAtualizar(alvo.id, dados);
      if (ficou) {
        // A pessoa se tirou da anotação: o resto já foi gravado com ela dentro, e a saída vem por último (ela pode deixar de vê-la).
        await sairDoCartao('anotacoes', alvo.id, 'Anotação atualizada. Você saiu dela, e a saída ficou no histórico.');
        aoMudarRascunho(null);
        aoSairDaAnotacao();
        return;
      }
      feito('Anotação atualizada.', 'atualização da anotação', async () => {
        await SD.anotacaoAtualizar(alvo.id, antes);
        return { tipo: 'anotacaoAtualizada', id: alvo.id };
      });
      terminar(true);
    } catch (e) {
      falha(e);
      setOcupado(false);
    }
  }

  return <form className="form-grade edicao-cartao" noValidate autoComplete="off" aria-label="Editar a equipe da anotação" onSubmit={e => e.preventDefault()}>
    <section className="etapa ativa"><CamposDaEquipeDaAnotacao campos={campos} aoMudar={mudar} erro={erro} comDicas /></section>
    <RodapeDaEdicao ocupado={ocupado} aoCancelar={() => terminar(false)} aoSalvar={() => void salvar()} />
  </form>;
}
