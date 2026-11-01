// Os órgãos em que o escritório atua: a contagem padrão dos prazos de cada um e o que ele segue além dos feriados
// nacionais (o recesso, os de praxe, os da Justiça Federal). Todos consultam; os administradores mudam na hora.
import { useState, type FormEvent } from 'react';
import { SD, type DadosOrgao, type Orgao } from '../../dados';
import { TAMANHO_ORGAO } from '../../dados/limites';
import { CALENDARIOS_PRONTOS, padraoDoOrgao, SEGUE, SIGLAS_SUGERIDAS } from '../../regras/calendario';
import { CONTAGENS, type Contagem } from '../../regras/prazos';
import { avisar, falha } from '../../ui/avisos';
import { BotaoDuplo } from '../../ui/Botoes';
import { estiloBotao, naGrade, Nota, TituloSecao, Vazio } from '../../ui/base';
import { Icone } from '../../ui/Icone';

/** O nome curto de cada coluna da tabela (o nome inteiro e a explicação ficam na nota). */
const COLUNA: Record<keyof typeof CALENDARIOS_PRONTOS, string> = { recesso: 'Recesso', praxe: 'De praxe', justica_federal: 'Justiça Federal' };

export function OrgaosDoEscritorio({ orgaos, ehAdmin, aoMudar }: { orgaos: Orgao[]; ehAdmin: boolean; aoMudar: () => void }) {
  const [sigla, setSigla] = useState('');
  const [nome, setNome] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function cadastrar(e: FormEvent) {
    e.preventDefault();
    if (!sigla.trim()) { falha(new Error('Informe a sigla do órgão (ex.: TJMG).')); return; }
    setOcupado(true);
    try {
      const o = await SD.orgaoCriar({ ...padraoDoOrgao(sigla), nome: nome.trim() || null });
      avisar(`${o.sigla} cadastrado. Confira o que ele segue na tabela.`);
      setSigla(''); setNome('');
      aoMudar();
    } catch (err) { falha(err); }
    setOcupado(false);
  }
  async function mudar(o: Orgao, campos: Partial<DadosOrgao>) {
    try { await SD.orgaoAtualizar(o.id, campos); aoMudar(); } catch (err) { falha(err); }
  }
  async function excluir(o: Orgao) {
    try { await SD.orgaoExcluir(o.id); avisar(`${o.sigla} excluído.`); aoMudar(); } catch (err) { falha(err); }
  }

  return <section className="orgaos form-grade" aria-labelledby="tOrgaos">
    <TituloSecao id="tOrgaos">Órgãos</TituloSecao>
    <Nota>Cada órgão conta os prazos com os feriados nacionais e com o que estiver marcado. Na dúvida, deixe desmarcado: o prazo calculado fica mais curto, nunca mais longo.</Nota>
    <ul className="orgaos-legenda">
      {SEGUE.map(s => <li key={s}><b>{CALENDARIOS_PRONTOS[s].nome}.</b> {CALENDARIOS_PRONTOS[s].explicacao}</li>)}
    </ul>
    {!orgaos.length ? <Vazio>Nenhum órgão ainda.{ehAdmin ? ' Cadastre os tribunais e os órgãos em que o escritório atua.' : ''}</Vazio>
      : <div className="tabela"><table aria-label="Órgãos do escritório">
        <thead><tr>
          <th scope="col">Órgão</th><th scope="col">Contagem padrão</th>
          {SEGUE.map(s => <th key={s} scope="col" className="centro">{COLUNA[s]}</th>)}
          {ehAdmin && <th scope="col"><span className="sr">Ações</span></th>}
        </tr></thead>
        <tbody>{orgaos.map(o => <tr key={o.id}>
          <td><b>{o.sigla}</b>{o.nome && <div className="sub">{o.nome}</div>}</td>
          <td>{ehAdmin
            ? <select className="campo" aria-label={`Contagem padrão de ${o.sigla}`} value={o.contagem_padrao} onChange={e => mudar(o, { contagem_padrao: e.target.value as Contagem })}>
              {(Object.keys(CONTAGENS) as Contagem[]).map(c => <option key={c} value={c}>{CONTAGENS[c]}</option>)}
            </select>
            : CONTAGENS[o.contagem_padrao]}</td>
          {SEGUE.map(s => <td key={s} className="centro">{ehAdmin
            ? <input type="checkbox" className="marca" aria-label={`${o.sigla}: ${CALENDARIOS_PRONTOS[s].nome}`} checked={o[s]} onChange={e => mudar(o, { [s]: e.target.checked })} />
            : o[s] ? 'Sim' : 'Não'}</td>)}
          {ehAdmin && <td className="acoes-linha">
            <BotaoDuplo forma="mini" variante="perigo" confirmar="Confirmar exclusão" aoConfirmar={() => excluir(o)}>
              <Icone nome="lixeira" tam={13} /> Excluir
            </BotaoDuplo>
          </td>}
        </tr>)}</tbody>
      </table></div>}
    {ehAdmin && <form className="grade-form campos orgao-novo" noValidate onSubmit={cadastrar} aria-label="Cadastrar órgão">
      <div className="campo-form" style={naGrade({ p: 5, m: 3, g: 2 })}>
        <label htmlFor="og-sigla">Sigla</label>
        <input id="og-sigla" list="og-siglas" autoCapitalize="characters" maxLength={TAMANHO_ORGAO.sigla} value={sigla} onChange={e => setSigla(e.target.value)} />
        <datalist id="og-siglas">{SIGLAS_SUGERIDAS.map(s => <option key={s} value={s} />)}</datalist>
      </div>
      <div className="campo-form" style={naGrade({ p: 7, m: 6, g: 6 })}>
        <label htmlFor="og-nome">Nome <small>(opcional)</small></label>
        <input id="og-nome" maxLength={TAMANHO_ORGAO.nome} value={nome} onChange={e => setNome(e.target.value)} placeholder="ex.: Tribunal de Justiça de Minas Gerais" />
      </div>
      <div className="campo-form orgao-novo-botao" style={naGrade({ m: 3, g: 4 })}>
        <button type="submit" className={estiloBotao()} disabled={ocupado}>{ocupado ? 'Cadastrando…' : 'Cadastrar órgão'}</button>
      </div>
    </form>}
    {ehAdmin && <Nota>Excluir um órgão exclui também os dias lançados só para ele.</Nota>}
  </section>;
}
