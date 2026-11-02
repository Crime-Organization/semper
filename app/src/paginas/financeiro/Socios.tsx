// Quem é sócio, desde quando e até quando. O recebimento usa quem era sócio na data dele, e guarda o resultado: mudar a lista depois
// não muda o passado. Só administradores.
import { useId, useState, type FormEvent } from 'react';
import { SD, type Socio } from '../../dados';
import { dadosDoSocio, errosDoSocio, periodoDoSocio, type FormDoSocio } from '../../regras/parcelas';
import { avisar, falha, feito } from '../../ui/avisos';
import { BuscaPessoa } from '../../ui/BuscaPessoa';
import { Campo, estiloBotao, Nota, propsDoCampo } from '../../ui/base';
import { BotaoDuplo } from '../../ui/Botoes';
import { Icone } from '../../ui/Icone';

function CamposDoPeriodo({ f, erros, mudar }: { f: FormDoSocio; erros: Partial<Record<keyof FormDoSocio, string>>; mudar: (m: Partial<FormDoSocio>) => void }) {
  const id = useId();
  return <>
    <Campo rotulo="Desde" para={id + 'desde'} obrigatorio erro={erros.desde}>
      <input type="date" {...propsDoCampo(id + 'desde', { erro: erros.desde })} value={f.desde} onChange={e => mudar({ desde: e.target.value })} />
    </Campo>
    <Campo rotulo="Até" para={id + 'ate'} erro={erros.ate} dica="Em branco enquanto for sócio.">
      <input type="date" {...propsDoCampo(id + 'ate', { erro: erros.ate })} value={f.ate} onChange={e => mudar({ ate: e.target.value })} />
    </Campo>
  </>;
}

function FormNovoSocio({ hoje, aoTerminar, aoCancelar }: { hoje: string; aoTerminar: () => void; aoCancelar: () => void }) {
  const [pessoa, setPessoa] = useState<{ id: string; nome: string } | null>(null);
  const [f, setF] = useState<FormDoSocio>({ desde: hoje, ate: '' });
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || !pessoa || Object.keys(errosDoSocio(f)).length) return;
    setOcupado(true);
    try {
      const novo = await SD.financeiroSocioCriar({ pessoa_id: pessoa.id, ...dadosDoSocio(f) });
      feito(`${novo.nome} entrou na lista de sócios.`, 'sócio', () => SD.financeiroSocioExcluir(novo.id));
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label="Novo sócio" onSubmit={salvar}>
    <BuscaPessoa rotulo="Pessoa" escolhida={pessoa} aoEscolher={setPessoa} placeholder="Busque pelo nome ou CPF" />
    {conferido && !pessoa && <Nota>Escolha a pessoa.</Nota>}
    <div className="financeiro-form-linha"><CamposDoPeriodo f={f} erros={conferido ? errosDoSocio(f) : {}} mudar={m => setF(x => ({ ...x, ...m }))} /></div>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar sócio'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

function FormDoPeriodo({ socio, aoTerminar, aoCancelar }: { socio: Socio; aoTerminar: () => void; aoCancelar: () => void }) {
  const [f, setF] = useState<FormDoSocio>({ desde: socio.desde, ate: socio.ate ?? '' });
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDoSocio(f)).length) return;
    setOcupado(true);
    try {
      await SD.financeiroSocioAtualizar(socio.id, dadosDoSocio(f));
      avisar('Período atualizado.');
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label={`Mudar o período de ${socio.nome}`} onSubmit={salvar}>
    <div className="financeiro-form-linha"><CamposDoPeriodo f={f} erros={conferido ? errosDoSocio(f) : {}} mudar={m => setF(x => ({ ...x, ...m }))} /></div>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar período'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

export function SociosDoEscritorio({ socios, hoje, aoMudar }: { socios: Socio[]; hoje: string; aoMudar: () => void }) {
  const [aberto, setAberto] = useState<{ o: 'novo' } | { o: 'mudar'; socio: Socio } | null>(null);
  const terminou = () => { setAberto(null); aoMudar(); };
  async function excluir(s: Socio) {
    try {
      await SD.financeiroSocioExcluir(s.id);
      feito(`${s.nome} saiu da lista de sócios.`, 'exclusão do sócio', () => SD.financeiroSocioRestaurar(s.id));
      terminou();
    } catch (e) { falha(e); }
  }
  return <div className="financeiro-form">
    <Nota>Vale quem era sócio na data de cada recebimento. Mudar aqui não altera o que já foi recebido.</Nota>
    {socios.length > 0 && <ul className="financeiro-lista" aria-label="Sócios">{socios.map(s => <li key={s.id}>
      <span><b>{s.nome}</b> {periodoDoSocio(s)}</span>
      <span className="financeiro-acoes">
        <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Mudar o período de ${s.nome}`} onClick={() => setAberto({ o: 'mudar', socio: s })}><Icone nome="editar" tam={13} /> Mudar</button>
        <BotaoDuplo pequeno variante="perigo" confirmar="Confirmar: tirar" aoConfirmar={() => excluir(s)}><Icone nome="lixeira" tam={13} /> Tirar</BotaoDuplo>
      </span>
    </li>)}</ul>}
    {aberto?.o === 'novo' && <FormNovoSocio hoje={hoje} aoTerminar={terminou} aoCancelar={() => setAberto(null)} />}
    {aberto?.o === 'mudar' && <FormDoPeriodo key={aberto.socio.id} socio={aberto.socio} aoTerminar={terminou} aoCancelar={() => setAberto(null)} />}
    {aberto?.o !== 'novo' && <div className="financeiro-acoes"><button type="button" className={estiloBotao()} onClick={() => setAberto({ o: 'novo' })}><Icone nome="mais" tam={15} /> Novo sócio</button></div>}
  </div>;
}
