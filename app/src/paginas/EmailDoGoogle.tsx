// O e-mail do Google de alguém da equipe (#166): o que recebe, por compartilhamento, as agendas do escritório no Google
// Agenda (só para ver). Por padrão, o de entrada no SEMPER; muda em Equipe e acessos (o administrador, com a regra do nome)
// e em Minha conta (a própria pessoa). As regras ficam em regras/emailDoGoogle.ts e no banco (email_do_google_salvar).
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { SD, type EmailDoGoogle as Dados } from '../dados';
import { TAMANHO_EMAIL_DE_ACESSO } from '../dados/limites';
import { normalizarEmail } from '../regras/conta';
import { erroDoEmailDoGoogle } from '../regras/emailDoGoogle';
import { avisar, falha } from '../ui/avisos';
import { Campo, Carregando, estiloBotao, Nota, propsDoCampo } from '../ui/base';

interface Props {
  perfilId: string;
  /** Quem está logado pode mudar (a própria pessoa, ou o administrador com a regra do nome). */
  pode: boolean;
  /** Por que não pode, quando não pode (a regra do papel). */
  porQueNao?: string | null;
}

export function EmailDoGoogle({ perfilId, pode, porQueNao }: Props) {
  const id = useId();
  const [dados, setDados] = useState<Dados | null | undefined>(undefined);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(() => SD.emailDoGoogle(perfilId)
    .then(d => { setDados(d); setValor(d?.email ?? ''); })
    .catch(e => { falha(e); setDados(null); }), [perfilId]);
  useEffect(() => { void carregar(); }, [carregar]);

  if (dados === undefined) return <Carregando />;
  if (!dados) return null;
  const mudou = normalizarEmail(valor) !== (dados.email ?? '');

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!mudou || ocupado) return;
    const problema = erroDoEmailDoGoogle(valor);
    setErro(problema);
    if (problema) return;
    setOcupado(true);
    try {
      await SD.emailDoGoogleSalvar(perfilId, valor);
      const novo = normalizarEmail(valor);
      avisar(novo && novo !== dados?.padrao ? `E-mail do Google salvo: ${novo}.` : 'E-mail do Google de volta ao e-mail de entrada.');
      await carregar();
    } catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  }

  return <>
    <form className="usuario-nome" onSubmit={salvar} noValidate>
      <Campo rotulo="E-mail do Google" para={id + 'google'} erro={erro}>
        <input type="email" {...propsDoCampo(id + 'google', { erro })} value={valor} placeholder={dados.padrao ?? ''} autoComplete="off"
          maxLength={TAMANHO_EMAIL_DE_ACESSO} disabled={!pode} onChange={e => { setValor(e.target.value); setErro(null); }} />
      </Campo>
      {pode && <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={!mudou || ocupado}>{ocupado ? 'Salvando…' : 'Salvar e-mail do Google'}</button>}
    </form>
    <Nota>Recebe as agendas do escritório no Google Agenda, só para ver.
      {dados.padrao ? ' Vazio, vale o e-mail de entrada (o que aparece apagado no campo).' : ' Vazio, ninguém recebe as agendas.'}
      {!pode && porQueNao ? ` ${porQueNao}` : ''}</Nota>
  </>;
}
