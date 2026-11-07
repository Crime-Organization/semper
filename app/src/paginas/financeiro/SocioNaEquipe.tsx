// A sociedade de um usuário, na janela dele em Equipe e acessos (só administradores, com o financeiro ligado): os
// períodos em que foi sócio, com as datas à vista. Nada acontece num clique só: tornar sócio abre o período com a data
// de entrada (hoje, já preenchida, mas à vista para mudar) e a de saída; cada período se muda ou se tira depois.
// O recebimento usa quem era sócio na data dele e guarda o resultado: mudar aqui não muda o que já foi recebido.
import { useState, type FormEvent } from 'react';
import { SD, type Socio, type Usuario } from '../../dados';
import { dadosDoSocio, errosDoSocio, periodoAtualDoSocio, periodoDoSocio, type FormDoSocio } from '../../regras/parcelas';
import { falha, feito } from '../../ui/avisos';
import { estiloBotao, Nota } from '../../ui/base';
import { BotaoDuplo } from '../../ui/Botoes';
import { Icone } from '../../ui/Icone';
import { hojeISO } from '../../ui/util';
import { CamposDoPeriodo, FormDoPeriodo } from './Socios';

function FormNovoPeriodo({ usuario, aoTerminar, aoCancelar }: { usuario: Pick<Usuario, 'nome' | 'pessoa_id'>; aoTerminar: () => void; aoCancelar: () => void }) {
  const [f, setF] = useState<FormDoSocio>({ desde: hojeISO(), ate: '' });
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDoSocio(f)).length) return;
    setOcupado(true);
    try {
      const novo = await SD.financeiroSocioCriar({ pessoa_id: usuario.pessoa_id!, ...dadosDoSocio(f) });
      feito(`${usuario.nome}: sócio ${periodoDoSocio(novo)}.`, 'sócio', () => SD.financeiroSocioExcluir(novo.id));
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label={`Novo período de sócio de ${usuario.nome}`} onSubmit={salvar}>
    <div className="financeiro-form-linha"><CamposDoPeriodo f={f} erros={conferido ? errosDoSocio(f) : {}} mudar={m => setF(x => ({ ...x, ...m }))} /></div>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar período'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

export function SocioNaEquipe({ usuario, socios, aoMudar }: { usuario: Pick<Usuario, 'nome' | 'pessoa_id'>; socios: Socio[]; aoMudar: () => void }) {
  const [aberto, setAberto] = useState<{ o: 'novo' } | { o: 'mudar'; socio: Socio } | null>(null);
  const periodos = socios.filter(s => s.pessoa_id === usuario.pessoa_id).toSorted((a, b) => b.desde.localeCompare(a.desde));
  const atual = periodoAtualDoSocio(socios, usuario.pessoa_id, hojeISO());
  const terminou = () => { setAberto(null); aoMudar(); };
  async function tirar(s: Socio) {
    try {
      await SD.financeiroSocioExcluir(s.id);
      feito(`Período de sócio tirado (${periodoDoSocio(s)}).`, 'exclusão do período', () => SD.financeiroSocioRestaurar(s.id));
      terminou();
    } catch (e) { falha(e); }
  }
  return <div className="financeiro-form">
    <Nota>{atual ? `${usuario.nome} é sócio ${periodoDoSocio(atual)}.` : `${usuario.nome} não é sócio hoje.`} Vale quem era sócio na data de cada recebimento.</Nota>
    {periodos.length > 0 && <ul className="financeiro-lista" aria-label={`Períodos de sócio de ${usuario.nome}`}>{periodos.map(s => <li key={s.id}>
      <span>Sócio {periodoDoSocio(s)}</span>
      <span className="financeiro-acoes">
        <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Mudar o período ${periodoDoSocio(s)}`} onClick={() => setAberto({ o: 'mudar', socio: s })}><Icone nome="editar" tam={13} /> Mudar</button>
        <BotaoDuplo pequeno variante="perigo" confirmar="Confirmar: tirar" aoConfirmar={() => tirar(s)}><Icone nome="lixeira" tam={13} /> Tirar</BotaoDuplo>
      </span>
    </li>)}</ul>}
    {aberto?.o === 'novo' && <FormNovoPeriodo usuario={usuario} aoTerminar={terminou} aoCancelar={() => setAberto(null)} />}
    {aberto?.o === 'mudar' && <FormDoPeriodo key={aberto.socio.id} socio={aberto.socio} aoTerminar={terminou} aoCancelar={() => setAberto(null)} />}
    {!aberto && <div className="financeiro-acoes"><button type="button" className={estiloBotao()} onClick={() => setAberto({ o: 'novo' })}>
      <Icone nome="mais" tam={15} /> {atual ? 'Outro período de sócio' : 'Tornar sócio'}</button></div>}
  </div>;
}
