// Em Configurações, os campos que o escritório cria nos processos: texto, data, número ou lista de opções. Só administradores
// chegam aqui. Apagar só esconde: o que já foi preenchido fica guardado e volta se o campo for reativado.
import { useEffect, useState, type FormEvent } from 'react';
import { SD, type CampoDeProcesso } from '../dados';
import { TAMANHO_CAMPO } from '../dados/limites';
import { CAMPO_NOVO, dadosDoCampo, errosDoFormDoCampo, formDoCampo, ONDE_APARECE, TIPOS_DE_CAMPO, TIPOS_DE_CAMPO_EM_ORDEM, type FormDoCampo } from '../regras/camposDeProcesso';
import { falha, feito } from '../ui/avisos';
import { Aviso, Campo, Carregando, estiloBotao, Nota, propsDoCampo, TituloSecao } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { Icone } from '../ui/Icone';
import { Recolhivel } from '../ui/Recolhivel';

/** O que o formulário está fazendo: nada (null), criando ou mudando um campo. */
type Edicao = { id?: string; bloquearTipo: boolean } | null;
const tipoNaTabela = (c: CampoDeProcesso) => c.tipo === 'lista' ? `${TIPOS_DE_CAMPO.lista.nome}: ${c.opcoes.join(', ')}` : TIPOS_DE_CAMPO[c.tipo].nome;

export function CamposDoProcesso() {
  const [campos, setCampos] = useState<CampoDeProcesso[] | null>(null);
  const [erroLeitura, setErroLeitura] = useState('');
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [form, setForm] = useState<FormDoCampo>(CAMPO_NOVO);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const ler = () => SD.processoCampos().then(c => { setCampos(c); setErroLeitura(''); }).catch(e => setErroLeitura((e as Error).message));
  useEffect(() => { void ler(); }, []);

  if (erroLeitura) return <Aviso tipo="erro">{erroLeitura}</Aviso>;
  if (!campos) return <Carregando />;

  const ativos = campos.filter(c => !c.apagado_em), apagados = campos.filter(c => c.apagado_em);
  const erros = conferido ? errosDoFormDoCampo(form, campos, edicao?.id) : {};
  const mudar = (m: Partial<FormDoCampo>) => setForm(f => ({ ...f, ...m }));
  function abrirForm(campo?: CampoDeProcesso) {
    setForm(campo ? formDoCampo(campo) : CAMPO_NOVO);
    setEdicao(campo ? { id: campo.id, bloquearTipo: true } : { bloquearTipo: false });
    setConferido(false);
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDoFormDoCampo(form, campos!, edicao?.id)).length) return;
    const { tipo, ...mudanca } = dadosDoCampo(form);
    setOcupado(true);
    try {
      if (edicao?.id) {
        await SD.processoCampoAtualizar(edicao.id, mudanca);
        feito('Campo atualizado.', 'atualização do campo', ler);
      } else {
        const novo = await SD.processoCampoCriar({ ...mudanca, tipo });
        feito(`Campo "${novo.nome}" criado.`, 'criação do campo', async () => { await SD.processoCampoAtualizar(novo.id, { apagado_em: new Date().toISOString() }); await ler(); });
      }
      setEdicao(null);
      await ler();
    } catch (e) { falha(e); } finally { setOcupado(false); }
  }
  async function apagar(c: CampoDeProcesso, apagar: boolean) {
    await SD.processoCampoAtualizar(c.id, { apagado_em: apagar ? new Date().toISOString() : null });
    feito(apagar ? `Campo "${c.nome}" apagado. O que já foi preenchido fica guardado.` : `Campo "${c.nome}" reativado.`, apagar ? 'apagamento do campo' : 'reativação do campo', async () => {
      await SD.processoCampoAtualizar(c.id, { apagado_em: apagar ? null : new Date().toISOString() });
      await ler();
    });
    await ler();
  }

  return <section className="cartao config-campos" aria-labelledby="tCampos">
    <TituloSecao id="tCampos">Campos dos processos</TituloSecao>
    <Nota>Campos próprios do escritório, que aparecem no cadastro e no cartão dos processos. Nenhum é obrigatório.</Nota>

    {ativos.length ? <div className="tabela"><table>
      <thead><tr><th scope="col">Nome</th><th scope="col">Tipo</th><th scope="col">Aparece em</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
      <tbody>{ativos.map(c => <tr key={c.id}>
        <td>{c.nome}</td><td>{tipoNaTabela(c)}</td><td>{ONDE_APARECE[c.aparece_em]}</td>
        <td><span className="config-campos-acoes">
          <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Mudar o campo ${c.nome}`} onClick={() => abrirForm(c)}><Icone nome="editar" tam={13} /> Mudar</button>
          <BotaoDuplo pequeno variante="perigo" confirmar={`Confirmar: apagar ${c.nome}`} aoConfirmar={() => apagar(c, true).catch(falha)}><Icone nome="lixeira" tam={13} /> Apagar</BotaoDuplo>
        </span></td>
      </tr>)}</tbody>
    </table></div> : <Nota>Nenhum campo criado ainda.</Nota>}

    {edicao ? <form className="campos form-grade" noValidate aria-label={edicao.id ? 'Mudar campo' : 'Novo campo'} onSubmit={salvar}>
      <Campo rotulo="Nome do campo" para="campo-nome" obrigatorio erro={erros.nome}>
        <input type="text" {...propsDoCampo('campo-nome', { erro: erros.nome })} maxLength={TAMANHO_CAMPO.nome} value={form.nome} onChange={e => mudar({ nome: e.target.value })} />
      </Campo>
      <Campo rotulo="Tipo" para="campo-tipo" dica={edicao.bloquearTipo ? 'O tipo não muda depois de criado, para o que já foi preenchido continuar válido.' : 'Depois de criado, o tipo não muda.'}>
        <select {...propsDoCampo('campo-tipo', { dica: true })} disabled={edicao.bloquearTipo} value={form.tipo} onChange={e => mudar({ tipo: e.target.value as FormDoCampo['tipo'] })}>
          {TIPOS_DE_CAMPO_EM_ORDEM.map(t => <option key={t} value={t}>{TIPOS_DE_CAMPO[t].nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Aparece em" para="campo-aparece">
        <select {...propsDoCampo('campo-aparece')} value={form.aparece_em} onChange={e => mudar({ aparece_em: e.target.value as FormDoCampo['aparece_em'] })}>
          {Object.entries(ONDE_APARECE).map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}
        </select>
      </Campo>
      {form.tipo === 'lista' && <Campo rotulo="Opções" para="campo-opcoes" obrigatorio erro={erros.opcoes} dica="Uma por linha. Retirar uma opção não muda os processos que já a usam.">
        <textarea {...propsDoCampo('campo-opcoes', { dica: true, erro: erros.opcoes })} value={form.opcoes} onChange={e => mudar({ opcoes: e.target.value })} />
      </Campo>}
      <div className="config-campos-acoes">
        <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : edicao.id ? 'Salvar campo' : 'Criar campo'}</button>
        <button type="button" className={estiloBotao()} onClick={() => setEdicao(null)}>Cancelar</button>
      </div>
    </form> : <div><button type="button" className={estiloBotao()} onClick={() => abrirForm()}><Icone nome="mais" tam={15} /> Novo campo</button></div>}

    {apagados.length > 0 && <Recolhivel titulo="Campos apagados" icone="lixeira" preferencia="configuracoes.campos.apagados" contador={apagados.length}>
      <ul className="config-campos-apagados">{apagados.map(c => <li key={c.id}>
        <span>{c.nome}</span>
        <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Reativar o campo ${c.nome}`} onClick={() => { apagar(c, false).catch(falha); }}>Reativar</button>
      </li>)}</ul>
    </Recolhivel>}
  </section>;
}
