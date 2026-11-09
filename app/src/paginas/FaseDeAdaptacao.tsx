// Fase de adaptação em Configurações (#275): o administrador libera e desliga, sem depender de programação.
import { useState } from 'react';
import { SD } from '../dados';
import { equipeEditaTudo } from '../regras/equipeVeTudo';
import { avisar, falha } from '../ui/avisos';
import { Nota, TituloSecao } from '../ui/base';
import { useSessao } from '../ui/sessao';

/** O que a tela confirma depois de mudar. */
const AO_MUDAR: Record<'ligada' | 'desligada', string> = {
  ligada: 'Fase de adaptação ligada: toda a equipe vê e edita tudo, menos o financeiro.',
  desligada: 'Fase de adaptação desligada: voltou a regra normal.'
};

export function FaseDeAdaptacao() {
  const { ctx, recarregar } = useSessao();
  const [ligada, setLigada] = useState(() => equipeEditaTudo(ctx.escritorio));
  const [ocupado, setOcupado] = useState(false);
  async function mudar(valor: boolean) {
    setLigada(valor);
    setOcupado(true);
    try {
      await SD.faseDeAdaptacaoDefinir(valor);
      await recarregar(false);
      avisar(AO_MUDAR[valor ? 'ligada' : 'desligada']);
    } catch (e) {
      setLigada(!valor);
      falha(e);
    }
    setOcupado(false);
  }
  return <section className="cartao form-grade config campos" aria-labelledby="tFase">
    <TituloSecao id="tFase">Fase de adaptação</TituloSecao>
    <label className="perfil-no-site">
      <input type="checkbox" checked={ligada} disabled={ocupado} onChange={e => void mudar(e.target.checked)} />
      Toda a equipe vê e edita tudo, menos o financeiro
    </label>
    <Nota>Ao desligar, volta a regra normal: cada pessoa vê e altera só o que é dela. Excluir de vez continua com quem criou e com os administradores.</Nota>
  </section>;
}
