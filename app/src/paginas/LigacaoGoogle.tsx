// Conta Google do escritório (#164), em Configurações: o administrador liga a conta Google do escritório para o SEMPER
// criar e atualizar os contatos (e, depois, as agendas, #166). A autorização acontece no Google; na volta, o endereço
// traz o resultado (?google=ligado), que vira um aviso. Desligar apaga a ligação e a autorização guardada.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SD, type LigacaoGoogle as Ligacao, type ResultadoDaLigacao } from '../dados';
import { avisar, falha } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Carregando, estiloBotao, Nota, TituloSecao } from '../ui/base';
import { dataHora } from '../ui/util';

/** O que cada resultado da volta do Google mostra (o servidor põe ?google=… no endereço). */
const RESULTADOS: Record<ResultadoDaLigacao, { ok: boolean; texto: string }> = {
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
  // Volta do Google. Com o estado e o código no endereço, a página (logada com quem pediu) conclui a ligação; com
  // ?google=… (a pessoa recusou), só mostra o aviso. O endereço é limpo na hora (o código não fica no histórico). O React,
  // em desenvolvimento, roda o efeito duas vezes antes de o endereço mudar: o que já foi tratado não se repete.
  const estado = busca.get('google_estado'), codigo = busca.get('google_codigo'), resultado = busca.get('google');
  const tratado = useRef<string | null>(null);
  useEffect(() => {
    const chave = estado ?? resultado;
    if (!chave || tratado.current === chave) return;
    tratado.current = chave;
    setBusca(b => { ['google', 'google_estado', 'google_codigo'].forEach(k => b.delete(k)); return b; }, { replace: true });
    const mostrar = (r: ResultadoDaLigacao) => {
      const { ok, texto } = RESULTADOS[r] ?? RESULTADOS.erro;
      if (ok) avisar(texto); else falha(new Error(texto));
    };
    if (!estado || !codigo) { mostrar((resultado ?? 'erro') as ResultadoDaLigacao); return; }
    setIndo(true);
    SD.ligacaoGoogleConcluir(estado, codigo).then(mostrar).catch(() => mostrar('erro')).finally(() => { setIndo(false); void carregar(); });
  }, [estado, codigo, resultado, setBusca, carregar]);
  // Voltando do Google pelo botão Voltar do navegador, a página reaparece como estava: o botão não fica preso em "Abrindo…".
  useEffect(() => {
    const destravar = () => setIndo(false);
    addEventListener('pageshow', destravar);
    return () => removeEventListener('pageshow', destravar);
  }, []);

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
