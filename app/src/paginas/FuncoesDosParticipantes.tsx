// Em Configurações, as funções dos participantes da tarefa (#313): a lista do escritório, que diz por que cada participante está na
// tarefa ("Executa", a de fábrica, e as que o escritório cria, #421). Só administradores chegam aqui. A função de execução conta em
// "Delegadas a mim". A função em uso não se apaga (o banco recusa e diz em quantas tarefas ela está): troca-se antes a função dessas
// pessoas. As regras do formulário ficam em regras/funcoesNaTarefa.ts; a lista que as outras telas usam, em ui/funcoesNaTarefa.ts.
import { useEffect, useState, type FormEvent } from 'react';
import { SD, type FuncaoNaTarefa } from '../dados';
import { TAMANHO_FUNCAO_NA_TAREFA } from '../dados/limites';
import { dadosDaFuncao, errosDaFuncao, formDaFuncao, FUNCAO_NOVA, funcoesNaOrdem, type FormDaFuncao } from '../regras/funcoesNaTarefa';
import { falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Campo, Carregando, Escolhas, estiloBotao, Nota, propsDoCampo, Selo, TituloSecao } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { recarregarFuncoes } from '../ui/funcoesNaTarefa';
import { Icone } from '../ui/Icone';

/** O que o formulário está fazendo: nada (null), criando (sem id) ou mudando uma função. */
type Edicao = { id?: string } | null;

export function FuncoesDosParticipantes() {
  const [funcoes, setFuncoes] = useState<FuncaoNaTarefa[] | null>(null);
  const [erroLeitura, setErroLeitura] = useState('');
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [form, setForm] = useState<FormDaFuncao>(FUNCAO_NOVA);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // Lê a lista daqui e avisa as outras telas (o cadastro, o cartão e os filtros das tarefas) de que ela mudou.
  const ler = () => SD.funcoesNaTarefaListar().then(f => { setFuncoes(funcoesNaOrdem(f)); setErroLeitura(''); void recarregarFuncoes(); })
    .catch(e => setErroLeitura((e as Error).message));
  useEffect(() => { void ler(); }, []);
  useMudancas(() => { void ler(); });

  if (erroLeitura) return <Aviso tipo="erro">{erroLeitura}</Aviso>;
  if (!funcoes) return <Carregando />;

  const erros = conferido ? errosDaFuncao(form, funcoes, edicao?.id) : {};
  const mudar = (m: Partial<FormDaFuncao>) => setForm(f => ({ ...f, ...m }));
  function abrirForm(f?: FuncaoNaTarefa) {
    setForm(f ? formDaFuncao(f) : FUNCAO_NOVA);
    setEdicao(f ? { id: f.id } : {});
    setConferido(false);
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDaFuncao(form, funcoes!, edicao?.id)).length) return;
    const dados = dadosDaFuncao(form);
    setOcupado(true);
    try {
      if (edicao?.id) {
        const antes = funcoes!.find(f => f.id === edicao.id)!, id = edicao.id;
        await SD.funcaoNaTarefaAtualizar(id, dados);
        feito(`Função "${dados.nome}" atualizada.`, 'atualização da função', async () => { await SD.funcaoNaTarefaAtualizar(id, formDaFuncao(antes)); });
      } else {
        const nova = await SD.funcaoNaTarefaCriar(dados);
        feito(`Função "${nova.nome}" cadastrada.`, 'cadastro da função', async () => { await SD.funcaoNaTarefaExcluir(nova.id); });
      }
      setEdicao(null);
      await ler();
    } catch (e) { falha(e); } finally { setOcupado(false); }
  }
  async function apagar(f: FuncaoNaTarefa) {
    try {
      await SD.funcaoNaTarefaExcluir(f.id);
      feito(`Função "${f.nome}" apagada.`, 'exclusão da função', async () => { await SD.funcaoNaTarefaCriar(formDaFuncao(f)); });
      await ler();
    } catch (e) { falha(e); }
  }

  return <section className="cartao config-campos" aria-labelledby="tFuncoes">
    <TituloSecao id="tFuncoes">Funções dos participantes da tarefa</TituloSecao>
    <Nota>Por que cada participante está na tarefa. A função de execução diz quem recebeu a tarefa para fazer e conta em "Delegadas a mim".
      Quem entra numa tarefa sem escolher fica com a primeira função da lista que não é de execução. A função não muda quem vê a tarefa.</Nota>

    {funcoes.length ? <div className="tabela"><table>
      <thead><tr><th scope="col">Função</th><th scope="col">Execução</th><th scope="col"><span className="sr">Ações</span></th></tr></thead>
      <tbody>{funcoes.map(f => <tr key={f.id}>
        <td>{f.nome}</td><td>{f.executa ? <Selo tipo="ok">Executa a tarefa</Selo> : <span className="nota">—</span>}</td>
        <td><span className="config-campos-acoes">
          <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Mudar a função ${f.nome}`} onClick={() => abrirForm(f)}><Icone nome="editar" tam={13} /> Mudar</button>
          <BotaoDuplo pequeno confirmar={`Confirmar: apagar ${f.nome}`} aoConfirmar={() => apagar(f)}><Icone nome="lixeira" tam={13} /> Apagar</BotaoDuplo>
        </span></td>
      </tr>)}</tbody>
    </table></div> : <Nota>Nenhuma função cadastrada: os participantes ficam sem função.</Nota>}

    {edicao ? <form className="config-campos-form" noValidate aria-label={edicao.id ? 'Mudar função' : 'Nova função'} onSubmit={salvar}>
      <Campo rotulo="Nome da função" para="funcao-nome" obrigatorio erro={erros.nome} dica="Ex.: Executa.">
        <input type="text" {...propsDoCampo('funcao-nome', { dica: true, erro: erros.nome })} maxLength={TAMANHO_FUNCAO_NA_TAREFA.nome} value={form.nome}
          onChange={e => mudar({ nome: e.target.value })} />
      </Campo>
      <Escolhas rotulo="Execução">
        <label><input type="checkbox" checked={form.executa} onChange={e => mudar({ executa: e.target.checked })} />Quem tem esta função recebeu a tarefa para fazer</label>
      </Escolhas>
      <div className="config-campos-acoes">
        <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : edicao.id ? 'Salvar função' : 'Cadastrar função'}</button>
        <button type="button" className={estiloBotao()} onClick={() => setEdicao(null)}>Cancelar</button>
      </div>
    </form> : <div><button type="button" className={estiloBotao()} onClick={() => abrirForm()}><Icone nome="mais" tam={15} /> Nova função</button></div>}
  </section>;
}
