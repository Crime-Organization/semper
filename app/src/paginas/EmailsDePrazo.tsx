// Os e-mails de prazo em Minha conta (#113). Ficam ligados até a pessoa desligar; a caixa de mensagens continua avisando de qualquer jeito.
import { useState } from 'react';
import { EMAILS_DE_PRAZO } from '../regras/mensagens';
import { falha } from '../ui/avisos';
import { Cartao, Nota, TituloSecao } from '../ui/base';
import { gravarPreferencia, lerPreferencia } from '../ui/preferencias';
import './Configuracoes.css';

export function EmailsDePrazo() {
  return <section aria-labelledby="tEmails" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <TituloSecao id="tEmails">E-mails de prazo</TituloSecao>
    <Cartao className="campos" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {EMAILS_DE_PRAZO.map(e => <EmailDePrazo key={e.chave} chave={e.chave} rotulo={e.rotulo} />)}
      <Nota>Com o e-mail desligado, os avisos continuam chegando em Mensagens.</Nota>
    </Cartao>
  </section>;
}

// A escolha é lida pelo servidor: a caixinha espera o banco e, se ele falhar, volta como estava, para ninguém achar que desligou sem ter desligado.
function EmailDePrazo({ chave, rotulo }: { chave: string; rotulo: string }) {
  const [ligado, setLigado] = useState(() => lerPreferencia(chave, true));
  const [ocupado, setOcupado] = useState(false);
  async function mudar(valor: boolean) {
    setLigado(valor);
    setOcupado(true);
    try {
      await gravarPreferencia(chave, valor);
    } catch (e) {
      setLigado(!valor);
      falha(e);
    }
    setOcupado(false);
  }
  return <label className="perfil-no-site">
    <input type="checkbox" checked={ligado} disabled={ocupado} onChange={e => void mudar(e.target.checked)} />
    {rotulo}
  </label>;
}
