// Agendas no Google (#166), em Configurações, dentro da Conta Google: o administrador autoriza a agenda na conta já ligada
// (autorização aos poucos: os contatos continuam), liga as agendas (começam desligadas), vê a situação, o problema que as
// impede (com o que fazer) e pode pedir "Sincronizar agora". Quem cria e compartilha as agendas é o servidor (a rotina do
// banco e a função google-agendas); as regras ficam em supabase/functions/_compartilhado/agendasGoogle.ts.
import { useCallback, useEffect, useState } from 'react';
import { SD, type AgendasGoogle } from '../dados';
import {
  AGENDAS_QUE_O_SEMPER_CRIA, AO_MUDAR_AS_AGENDAS, FALTA_AUTORIZAR_A_AGENDA, PROBLEMAS_DAS_AGENDAS, RESULTADO_DAS_AGENDAS, situacaoDasAgendas
} from '../regras/sincronizacaoDasAgendas';
import { avisar, falha } from '../ui/avisos';
import { Aviso, Carregando, estiloBotao, Nota } from '../ui/base';
import { Botao } from '../ui/Botoes';
import { dataHora } from '../ui/util';

interface Props {
  /** Muda quando a conta é ligada (ou autorizada) de novo, para a situação ser lida outra vez. */
  versao: string;
  /** Vai ao Google pedir a permissão da agenda (a mesma ida da ligação da conta). */
  aoAutorizar: () => void;
  /** A ida ao Google já começou. */
  indo: boolean;
}

export function AgendasNoGoogle({ versao, aoAutorizar, indo }: Props) {
  const [s, setS] = useState<AgendasGoogle | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(() => SD.agendasGoogle().then(setS).catch(e => { falha(e); setS(null); }), []);
  useEffect(() => { void carregar(); }, [carregar, versao]);

  async function mudar(ligar: boolean) {
    // A caixinha muda na hora; se o banco recusar, a leitura de depois a devolve ao que era.
    setS(atual => atual && { ...atual, ativa: ligar });
    setOcupado(true);
    try {
      await SD.agendasGoogleLigar(ligar);
      avisar(AO_MUDAR_AS_AGENDAS[ligar ? 'ligadas' : 'desligadas']);
    } catch (e) { falha(e); }
    await carregar();
    setOcupado(false);
  }
  async function agora() {
    try {
      const r = await SD.sincronizarAgendasAgora();
      const { ok, texto } = RESULTADO_DAS_AGENDAS[r.resultado](r);
      if (ok) avisar(texto); else falha(new Error(texto));
    } catch (e) { falha(e); }
    await carregar();
  }

  if (s === undefined) return <Carregando />;
  if (!s) return null;
  const problema = s.problema ? PROBLEMAS_DAS_AGENDAS[s.problema] : null;
  // Autorizar de novo também resolve a autorização vencida ou retirada.
  const pedirAutorizacao = !s.autorizada || s.problema === 'autorizacao';
  return <div className="campos config-google-agendas" role="group" aria-labelledby="tAgendasGoogle">
    <h3 id="tAgendasGoogle" className="perfil-bloco">Agendas no Google</h3>
    <Nota>{AGENDAS_QUE_O_SEMPER_CRIA}</Nota>
    {!s.autorizada && <Aviso tipo="info">{FALTA_AUTORIZAR_A_AGENDA}</Aviso>}
    {s.autorizada && <label className="perfil-no-site">
      <input type="checkbox" checked={s.ativa} disabled={ocupado} onChange={e => void mudar(e.target.checked)} />
      Criar e manter no Google as agendas do escritório
    </label>}
    {s.ativa && <p className="config-google-situacao">
      {situacaoDasAgendas(s)}{s.sincronizado_em && <span className="nota"> Última sincronização: {dataHora(s.sincronizado_em)}.</span>}
    </p>}
    {problema && <Aviso tipo="erro"><b>{problema.titulo}</b> {problema.oQueFazer}</Aviso>}
    {(pedirAutorizacao || (s.ativa && s.autorizada)) && <div className="acoes">
      {pedirAutorizacao && <button type="button" className={estiloBotao({ variante: s.autorizada ? undefined : 'principal' })} disabled={indo} onClick={aoAutorizar}>
        {indo ? 'Abrindo o Google…' : 'Autorizar a agenda'}
      </button>}
      {s.ativa && s.autorizada && <Botao forma="botao" ocupadoTexto="Sincronizando…" onClick={agora}>Sincronizar agora</Botao>}
    </div>}
  </div>;
}
