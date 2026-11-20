// Contatos no Google (#164), em Configurações, dentro da Conta Google: o administrador liga a sincronização (começa
// desligada), vê se há alguém esperando para ir ao Google, o problema que a impede (com o que fazer) e pode pedir
// "Sincronizar agora". Quem leva as pessoas ao Google é o servidor (a rotina do banco e a função google-sincronizar).
// Ao ligar, o servidor faz antes a primeira sincronização (liga os contatos que já estão no Google às pessoas); os
// duvidosos aparecem na lista Para conferir (ContatosParaConferir.tsx).
import { useCallback, useEffect, useState } from 'react';
import { SD, type SincronizacaoGoogle } from '../dados';
import { PRIMEIRA_POR_FAZER, PROBLEMAS_DA_SINCRONIZACAO, RESULTADO_DO_AGORA, situacaoDaFila } from '../regras/sincronizacaoGoogle';
import { avisar, falha } from '../ui/avisos';
import { Aviso, Carregando, Nota } from '../ui/base';
import { Botao } from '../ui/Botoes';
import { dataHora } from '../ui/util';
import { ContatosParaConferir } from './ContatosParaConferir';

/** O que a tela confirma depois de ligar ou desligar. */
const AO_MUDAR: Record<'ligada' | 'desligada', string> = {
  ligada: 'Sincronização ligada: o SEMPER lê os contatos que já estão no Google e depois leva quem for cadastrado ou editado.',
  desligada: 'Sincronização desligada: o SEMPER deixou de mandar contatos ao Google.'
};

/** `versao` muda quando a conta é ligada de novo, para a situação ser lida outra vez. */
export function SincronizacaoDosContatos({ versao }: { versao: string }) {
  const [s, setS] = useState<SincronizacaoGoogle | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(() => SD.sincronizacaoGoogle().then(setS).catch(e => { falha(e); setS(null); }), []);
  useEffect(() => { void carregar(); }, [carregar, versao]);

  async function mudar(ligar: boolean) {
    // A caixinha muda na hora; se o banco recusar, a leitura de depois a devolve ao que era.
    setS(atual => atual && { ...atual, ativa: ligar });
    setOcupado(true);
    try {
      await SD.sincronizacaoGoogleLigar(ligar);
      avisar(AO_MUDAR[ligar ? 'ligada' : 'desligada']);
    } catch (e) { falha(e); }
    await carregar();
    setOcupado(false);
  }
  async function agora() {
    try {
      const r = await SD.sincronizarGoogleAgora();
      const { ok, texto } = RESULTADO_DO_AGORA[r.resultado](r);
      if (ok) avisar(texto); else falha(new Error(texto));
    } catch (e) { falha(e); }
    await carregar();
  }

  if (s === undefined) return <Carregando />;
  if (!s) return null;
  const problema = s.problema ? PROBLEMAS_DA_SINCRONIZACAO[s.problema] : null;
  return <div className="campos config-google-contatos" role="group" aria-labelledby="tContatosGoogle">
    <h3 id="tContatosGoogle" className="perfil-bloco">Contatos no Google</h3>
    <label className="perfil-no-site">
      <input type="checkbox" checked={s.ativa} disabled={ocupado} onChange={e => void mudar(e.target.checked)} />
      Criar e atualizar no Google os contatos das pessoas cadastradas e editadas
    </label>
    <Nota>Vão o nome em maiúsculas, os telefones, os e-mails e o aniversário (nascimento; para empresa, a abertura), sem a qualificação.
      Arquivar ou excluir uma pessoa não apaga o contato no Google. Ao ligar, o SEMPER primeiro procura nos contatos que já estão no
      Google os que são de pessoas do escritório (pelo telefone, pelo e-mail e pelo nome) e os liga a elas, sem criar cópias.</Nota>
    {s.ativa && !s.primeira_em && <p className="config-google-situacao">{PRIMEIRA_POR_FAZER}</p>}
    {s.ativa && <p className="config-google-situacao">
      {situacaoDaFila(s)}{s.sincronizado_em && <span className="nota"> Última sincronização: {dataHora(s.sincronizado_em)}.</span>}
    </p>}
    {problema && <Aviso tipo="erro"><b>{problema.titulo}</b> {problema.oQueFazer}</Aviso>}
    {s.ativa && <div className="acoes">
      <Botao forma="botao" ocupadoTexto="Sincronizando…" onClick={agora}>Sincronizar agora</Botao>
    </div>}
    {/* A lista é lida de novo quando o número de dúvidas muda (depois do "Sincronizar agora", por exemplo). */}
    {s.para_conferir > 0 && <ContatosParaConferir key={s.para_conferir} aoMudar={carregar} />}
  </div>;
}
