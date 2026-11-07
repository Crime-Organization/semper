// A marca "Sócio" de cada usuário em Equipe e acessos: é ali que o administrador diz quem é sócio. Marcar abre o período a partir de hoje;
// desmarcar termina o período hoje (ou apaga o que começou hoje), para o lucro dos meses passados não mudar.
import { useId } from 'react';
import { SD, type Socio, type Usuario } from '../../dados';
import { desmarcarSocio, periodoAtualDoSocio, periodoDoSocio } from '../../regras/parcelas';
import { falha, feito } from '../../ui/avisos';
import { hojeISO } from '../../ui/util';

/** O que fazer ao desmarcar, e como desfazer. */
const DESMARCAR: Record<ReturnType<typeof desmarcarSocio>, (s: Socio, hoje: string) => { fazer: () => Promise<void>; desfazer: () => Promise<void> }> = {
  excluir: s => ({ fazer: () => SD.financeiroSocioExcluir(s.id), desfazer: () => SD.financeiroSocioRestaurar(s.id) }),
  encerrar: (s, hoje) => ({ fazer: () => SD.financeiroSocioAtualizar(s.id, { desde: s.desde, ate: hoje }), desfazer: () => SD.financeiroSocioAtualizar(s.id, { desde: s.desde, ate: s.ate }) })
};

export function SocioNaEquipe({ usuario, socios, aoMudar }: { usuario: Pick<Usuario, 'nome' | 'pessoa_id'>; socios: Socio[]; aoMudar: () => void }) {
  const id = useId();
  const hoje = hojeISO();
  const atual = periodoAtualDoSocio(socios, usuario.pessoa_id, hoje);

  async function trocar(marcar: boolean) {
    try {
      if (marcar) {
        const novo = await SD.financeiroSocioCriar({ pessoa_id: usuario.pessoa_id!, desde: hoje, ate: null });
        feito(`${usuario.nome} agora é sócio.`, 'sócio', async () => { await SD.financeiroSocioExcluir(novo.id); aoMudar(); });
      } else if (atual) {
        const { fazer, desfazer } = DESMARCAR[desmarcarSocio(atual, hoje)](atual, hoje);
        await fazer();
        feito(`${usuario.nome} deixou de ser sócio.`, 'sócio', async () => { await desfazer(); aoMudar(); });
      }
      aoMudar();
    } catch (e) { falha(e); aoMudar(); }
  }

  return <label className="socio-na-equipe" htmlFor={id}>
    <input id={id} type="checkbox" checked={!!atual} onChange={e => void trocar(e.target.checked)} aria-label={`${usuario.nome} é sócio`} />
    Sócio{atual && <span className="sub"> {periodoDoSocio(atual)}</span>}
  </label>;
}
