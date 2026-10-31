// Conta Google do escritório (#164), em Configurações: o administrador liga a conta Google do escritório para o SEMPER
// criar e atualizar os contatos (e, depois, as agendas, #166). A autorização acontece no Google; na volta, o endereço
// traz o resultado (?google=ligado), que vira um aviso. Desligar apaga a ligação e a autorização guardada.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SD, type LigacaoGoogle as Ligacao } from '../dados';
import { avisar, falha } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Carregando, estiloBotao, Nota, TituloSecao } from '../ui/base';
import { dataHora } from '../ui/util';

/** O que cada resultado da volta do Google mostra (o servidor põe ?google=… no endereço). */
const RESULTADOS: Record<string, { ok: boolean; texto: string }> = {
  ligado: { ok: true, texto: 'Conta Google ligada. O SEMPER já pode usar os contatos dessa conta.' },
  recusado: { ok: false, texto: 'A autorização no Google foi cancelada. Nada foi ligado.' },
  'sem-permissao': { ok: false, texto: 'Faltou permitir o acesso aos contatos na tela do Google. Clique de novo em "Conectar conta Google" e deixe os contatos marcados.' },
  expirado: { ok: false, texto: 'O pedido de ligação venceu. Clique de novo em "Conectar conta Google".' },
  erro: { ok: false, texto: 'Não foi possível ligar a conta Google. Tente de novo em alguns minutos.' }
};

export function LigacaoGoogle() {
  const [ligacao, setLigacao] = useState<Ligacao | null | undefined>(undefined);
  const [indo, setIndo] = useState(false);
  const [busca, setBusca] = useSearchParams();
  const carregar = useCallback(() => SD.ligacaoGoogle().then(setLigacao).catch(e => { falha(e); setLigacao(null); }), []);
  useEffect(() => { void carregar(); }, [carregar]);
  // Volta do Google: mostra o resultado uma vez e limpa o endereço (recarregar a página não repete o aviso). O React,
  // em desenvolvimento, roda o efeito duas vezes antes de o endereço mudar: o resultado já mostrado não se repete.
  const resultado = busca.get('google');
  const mostrado = useRef<string | null>(null);
  useEffect(() => {
    if (!resultado || mostrado.current === resultado) return;
    mostrado.current = resultado;
    const r = RESULTADOS[resultado] ?? RESULTADOS.erro;
    if (r.ok) avisar(r.texto); else falha(new Error(r.texto));
    setBusca(b => { b.delete('google'); return b; }, { replace: true });
  }, [resultado, setBusca]);

  async function conectar() {
    setIndo(true);
    try { location.assign(await SD.ligacaoGoogleIniciar(location.origin + '/configuracoes/')); }
    catch (e) { falha(e); setIndo(false); }
  }
  async function desligar() {
    try { await SD.ligacaoGoogleDesligar(); avisar('Conta Google desligada. O SEMPER deixou de usar essa conta.'); await carregar(); }
    catch (e) { falha(e); }
  }

  return <section className="cartao config-google" aria-labelledby="tGoogle">
    <TituloSecao id="tGoogle">Conta Google</TituloSecao>
    <Nota>Ligue a conta Google do escritório para o SEMPER criar e atualizar os contatos dela (e, em breve, as agendas).
      A autorização fica guardada no servidor do SEMPER, protegida; ninguém a vê pelo navegador.</Nota>
    {ligacao === undefined ? <Carregando />
      : ligacao ? <div className="config-google-ligada">
        <p className="config-google-conta">Ligada: <b>{ligacao.conta_email}</b> <span className="nota">desde {dataHora(ligacao.ligado_em)}</span></p>
        <div className="acoes">
          <button type="button" className={estiloBotao()} disabled={indo} onClick={conectar}>{indo ? 'Abrindo o Google…' : 'Ligar outra conta'}</button>
          <BotaoDuplo variante="perigo" confirmar="Confirmar: desligar" aoConfirmar={desligar}>Desligar</BotaoDuplo>
        </div>
      </div>
      : <div className="acoes">
        <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={indo} onClick={conectar}>{indo ? 'Abrindo o Google…' : 'Conectar conta Google'}</button>
      </div>}
  </section>;
}
