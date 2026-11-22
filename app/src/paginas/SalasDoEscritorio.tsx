// Em Configurações, as salas do escritório (#308): nome e capacidade, para marcar compromissos nelas sem horário duplicado. Só
// administradores chegam aqui. Sala não se exclui: desativada, ela some das opções novas, e os compromissos antigos continuam com
// o nome dela; reativada, volta às opções. As regras do formulário ficam em regras/sala.ts.
import { useEffect, useState, type FormEvent } from 'react';
import { SD, type Sala } from '../dados';
import { TAMANHO_SALA } from '../dados/limites';
import { capacidadeDaSala, dadosDaSala, errosDaSala, formDaSala, nomeDaSala, SALA_NOVA, type FormDaSala } from '../regras/sala';
import { falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Campo, Carregando, estiloBotao, Nota, propsDoCampo, TituloSecao } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { Icone } from '../ui/Icone';
import { Recolhivel } from '../ui/Recolhivel';

/** O que o formulário está fazendo: nada (null), criando (sem id) ou mudando uma sala. */
type Edicao = { id?: string } | null;

export function SalasDoEscritorio() {
  const [salas, setSalas] = useState<Sala[] | null>(null);
  const [erroLeitura, setErroLeitura] = useState('');
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [form, setForm] = useState<FormDaSala>(SALA_NOVA);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const ler = () => SD.salasListar().then(s => { setSalas(s); setErroLeitura(''); }).catch(e => setErroLeitura((e as Error).message));
  useEffect(() => { void ler(); }, []);
  // Depois de desfazer, mesmo tendo saído e voltado a esta página: mostra a lista como ficou.
  useMudancas(() => { void ler(); });

  if (erroLeitura) return <Aviso tipo="erro">{erroLeitura}</Aviso>;
  if (!salas) return <Carregando />;

  const ativas = salas.filter(s => s.ativa), desativadas = salas.filter(s => !s.ativa);
  const erros = conferido ? errosDaSala(form, salas, edicao?.id) : {};
  const mudar = (m: Partial<FormDaSala>) => setForm(f => ({ ...f, ...m }));
  function abrirForm(sala?: Sala) {
    setForm(sala ? formDaSala(sala) : SALA_NOVA);
    setEdicao(sala ? { id: sala.id } : {});
    setConferido(false);
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDaSala(form, salas!, edicao?.id)).length) return;
    const dados = dadosDaSala(form);
    setOcupado(true);
    try {
      if (edicao?.id) {
        const antes = salas!.find(s => s.id === edicao.id)!, id = edicao.id;
        await SD.salaAtualizar(id, dados);
        feito(`Sala "${dados.nome}" atualizada.`, 'atualização da sala', async () => { await SD.salaAtualizar(id, { nome: antes.nome, capacidade: antes.capacidade }); });
      } else {
        const nova = await SD.salaCriar(dados);
        // Sala não se exclui (um compromisso pode já estar nela): desfazer a desativa.
        feito(`Sala "${nova.nome}" cadastrada.`, 'cadastro da sala', async () => { await SD.salaAtualizar(nova.id, { ativa: false }); });
      }
      setEdicao(null);
      await ler();
    } catch (e) { falha(e); } finally { setOcupado(false); }
  }
  async function ativar(s: Sala, ativa: boolean) {
    await SD.salaAtualizar(s.id, { ativa });
    feito(ativa ? `Sala "${s.nome}" reativada.` : `Sala "${s.nome}" desativada. Os compromissos que já estão nela continuam com ela.`,
      ativa ? 'reativação da sala' : 'desativação da sala', async () => { await SD.salaAtualizar(s.id, { ativa: !ativa }); });
    await ler();
  }

  return <section className="cartao config-campos" aria-labelledby="tSalas">
    <TituloSecao id="tSalas">Salas</TituloSecao>
    <Nota>As salas do escritório, para marcar os compromissos nelas. O SEMPER não deixa marcar dois compromissos na mesma sala no mesmo horário.</Nota>

    {ativas.length ? <div className="tabela"><table>
      <thead><tr><th scope="col">Sala</th><th scope="col">Capacidade</th><th scope="col"><span className="sr">Ações</span></th></tr></thead>
      <tbody>{ativas.map(s => <tr key={s.id}>
        <td>{s.nome}</td><td>{capacidadeDaSala(s.capacidade)}</td>
        <td><span className="config-campos-acoes">
          <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Mudar a sala ${s.nome}`} onClick={() => abrirForm(s)}><Icone nome="editar" tam={13} /> Mudar</button>
          <BotaoDuplo pequeno confirmar={`Confirmar: desativar ${s.nome}`} aoConfirmar={() => ativar(s, false).catch(falha)}><Icone nome="arquivo" tam={13} /> Desativar</BotaoDuplo>
        </span></td>
      </tr>)}</tbody>
    </table></div> : <Nota>Nenhuma sala cadastrada ainda.</Nota>}

    {edicao ? <form className="config-campos-form" noValidate aria-label={edicao.id ? 'Mudar sala' : 'Nova sala'} onSubmit={salvar}>
      <Campo rotulo="Nome da sala" para="sala-nome" obrigatorio erro={erros.nome}>
        <input type="text" {...propsDoCampo('sala-nome', { erro: erros.nome })} maxLength={TAMANHO_SALA.nome} value={form.nome} onChange={e => mudar({ nome: e.target.value })} />
      </Campo>
      <Campo rotulo="Capacidade" para="sala-capacidade" obrigatorio erro={erros.capacidade} dica="Quantas pessoas cabem.">
        <input type="number" inputMode="numeric" min={1} max={TAMANHO_SALA.capacidadeMaxima} {...propsDoCampo('sala-capacidade', { dica: true, erro: erros.capacidade })}
          value={form.capacidade} onChange={e => mudar({ capacidade: e.target.value })} />
      </Campo>
      <div className="config-campos-acoes">
        <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : edicao.id ? 'Salvar sala' : 'Cadastrar sala'}</button>
        <button type="button" className={estiloBotao()} onClick={() => setEdicao(null)}>Cancelar</button>
      </div>
    </form> : <div><button type="button" className={estiloBotao()} onClick={() => abrirForm()}><Icone nome="mais" tam={15} /> Nova sala</button></div>}

    {desativadas.length > 0 && <Recolhivel titulo="Salas desativadas" icone="arquivo" preferencia="configuracoes.salas.desativadas" contador={desativadas.length}>
      <ul className="config-campos-apagados">{desativadas.map(s => <li key={s.id}>
        <span>{nomeDaSala(s)}</span>
        <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Reativar a sala ${s.nome}`} onClick={() => { ativar(s, true).catch(falha); }}>Reativar</button>
      </li>)}</ul>
    </Recolhivel>}
  </section>;
}
