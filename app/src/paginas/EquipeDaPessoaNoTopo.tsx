// Os responsáveis da pessoa no topo do cartão (#387), em bolinhas, como a equipe dos outros cartões (EquipeNoTopo,
// EquipeDoContratoNoTopo), sobre a mesma peça (EquipeDoCartao) no modo sem responsável principal: a pessoa tem vários
// responsáveis, todos iguais. A bolinha com "+" põe mais um; o menu da de um responsável (#388) o tira ou abre o perfil dele;
// pôr e tirar, com o aviso e o Desfazer.
// Grava pelas mesmas funções de antes (responsavelIncluir e responsavelRemover), uma mudança de cada vez, e avisa o cartão
// para ler de novo. Sem grupos da equipe: a pessoa não os tem. Na pessoa arquivada, as bolinhas são só para ver.
import { SD, type Pessoa } from '../dados';
import { candidatosDaEquipe } from '../regras/equipe';
import { ACOES_NA_BOLINHA } from '../regras/menuDaBolinha';
import {
  AVISO_NOS_RESPONSAVEIS, PAPEL_NA_PESSOA, POR_RESPONSAVEL, tirarDosResponsaveis, type MudancaNosResponsaveis
} from '../regras/responsaveisDaPessoa';
import { feito } from '../ui/avisos';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { useCtx } from '../ui/sessao';
import { usePerfilNaBolinha, useUmaMudancaDeCadaVez } from './EquipeNoTopo';

/** O que cada mudança grava e o que o Desfazer grava para voltar. */
const GRAVACAO: Record<MudancaNosResponsaveis, { fazer: (pessoaId: string, perfilId: string) => Promise<void>; desfazer: (pessoaId: string, perfilId: string) => Promise<void> }> = {
  por: { fazer: (p, u) => SD.responsavelIncluir(p, u), desfazer: (p, u) => SD.responsavelRemover(p, u) },
  tirar: { fazer: (p, u) => SD.responsavelRemover(p, u), desfazer: (p, u) => SD.responsavelIncluir(p, u) }
};

interface Props {
  pessoa: Pessoa;
  /** Depois de mudar (ou de a gravação falhar): o cartão lê de novo. null: só para ver (a pessoa arquivada). */
  depois: (() => void) | null;
}

export function EquipeDaPessoaNoTopo({ pessoa, depois }: Props) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const { ocupado, umaDeCadaVez } = useUmaMudancaDeCadaVez();
  const perfil = usePerfilNaBolinha();
  const resp = pessoa.resp.map(r => r.perfil_id);
  const responsaveis = resp.map(id => naEquipe(ctx.equipe, id, PAPEL_NA_PESSOA));
  if (!depois) return <EquipeDoCartao semPrincipal participantes={responsaveis} />;

  const pedir = (tipo: MudancaNosResponsaveis, quem: { id: string; nome: string }) => umaDeCadaVez(async () => {
    const g = GRAVACAO[tipo], aviso = AVISO_NOS_RESPONSAVEIS[tipo];
    await g.fazer(pessoa.id, quem.id);
    feito(aviso.texto(quem.nome), aviso.oQue, () => g.desfazer(pessoa.id, quem.id));
    depois();
  }, depois);

  return <EquipeDoCartao semPrincipal participantes={responsaveis} mudar={{
    por: POR_RESPONSAVEL,
    candidatos: termo => candidatosDaEquipe(ctx.equipe, termo, resp),
    acoes: () => ACOES_NA_BOLINHA.responsavelDaPessoa,
    tirar: p => tirarDosResponsaveis(p, eu),
    perfil,
    ocupado,
    aoPor: m => pedir('por', m),
    aoTirar: p => pedir('tirar', p)
  }} />;
}
