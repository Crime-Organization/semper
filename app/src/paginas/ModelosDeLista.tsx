// Modelos de checklist do escritório (#358; no código e no banco, "modelos de lista"), como "Documentos de pessoa jurídica":
// criar, editar e excluir. Numa demanda ou tarefa, um clique em "Adicionar checklist" usa o modelo (copia o nome e os itens);
// mudar o modelo depois não muda os checklists feitos. Comuns a toda a equipe; quem criou ou um administrador exclui. Chega-se
// aqui pelo menu ⋯ de Demandas e pelo de Tarefas.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { SD, type ModeloDeLista } from '../dados';
import { ITENS_DO_MODELO, TAMANHO_LISTA } from '../dados/limites';
import { arvoreDosItens } from '../regras/gruposDaLista';
import { itensDoTexto, textoDosItens } from '../regras/listas';
import { avisar, falha } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Aviso, Campo, Carregando, Cartao, estiloBotao, Nota, propsDoCampo, Vazio } from '../ui/base';
import { Icone } from '../ui/Icone';
import { useCtx } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import './Demandas.css';

/** O que está sendo editado: um modelo existente (pelo id) ou um novo. */
type Edicao = { id: string | null; nome: string; texto: string };

export default function ModelosDeLista() {
  useTitulo('Modelos de checklist');
  const ctx = useCtx();
  const [modelos, setModelos] = useState<ModeloDeLista[] | string | null>(null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const carregar = useCallback(() => SD.modelosListar().then(setModelos).catch(e => setModelos((e as Error).message)), []);
  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    const nome = edicao.nome.trim(), itens = itensDoTexto(edicao.texto);
    if (!nome) { falha(new Error('Dê um nome ao modelo.')); return; }
    if (itens.length > ITENS_DO_MODELO) { falha(new Error(`Um modelo pode ter até ${ITENS_DO_MODELO} itens.`)); return; }
    try {
      if (edicao.id) await SD.modeloAtualizar(edicao.id, { nome, arvore: arvoreDosItens(itens) });
      else await SD.modeloCriar(nome, arvoreDosItens(itens));
      avisar(edicao.id ? 'Modelo atualizado.' : 'Modelo criado.');
      setEdicao(null);
      await carregar();
    } catch (err) { falha(err); }
  }
  async function excluir(m: ModeloDeLista) {
    try { await SD.modeloExcluir(m.id); await carregar(); } catch (err) { falha(err); }
  }

  const formulario = edicao && <Cartao>
    <form className="modelo-form" noValidate onSubmit={salvar} aria-label={edicao.id ? 'Editar modelo' : 'Novo modelo'}>
      <Campo rotulo="Nome do modelo" para="modelo-nome" obrigatorio>
        <input type="text" {...propsDoCampo('modelo-nome')} className="campo" maxLength={TAMANHO_LISTA} value={edicao.nome}
          onChange={e => setEdicao({ ...edicao, nome: e.target.value })} autoFocus />
      </Campo>
      <Campo rotulo="Itens" para="modelo-itens" dica="Um por linha, na ordem em que devem aparecer.">
        <textarea {...propsDoCampo('modelo-itens', { dica: true })} className="campo" rows={8} value={edicao.texto}
          onChange={e => setEdicao({ ...edicao, texto: e.target.value })} />
      </Campo>
      <div className="modelo-form-acoes">
        <button type="submit" className={estiloBotao({ variante: 'principal', pequeno: true })}>Salvar modelo</button>
        <button type="button" className={estiloBotao({ pequeno: true })} onClick={() => setEdicao(null)}>Cancelar</button>
      </div>
    </form>
  </Cartao>;

  return <div className="miolo">
    <header>
      <p className="olho"><Link to="/demandas/">Demandas</Link> · <Link to="/tarefas/">Tarefas</Link></p>
      <h1 className="titulo">Modelos de checklist<span className="ponto">.</span></h1>
      <p className="lead">Checklists prontos para usar nas demandas e nas tarefas com um clique, em "Adicionar checklist". Mudar um modelo não muda os checklists já feitos com ele.</p>
      <Nota>Modelo com o mesmo nome de um objeto de contrato (por exemplo, "Registro de marca") vira as tarefas da demanda desse objeto: quando o contrato é assinado, cada item do modelo nasce como uma tarefa dela.</Nota>
    </header>
    {!edicao && <div><button type="button" className={estiloBotao({ variante: 'principal' })} onClick={() => setEdicao({ id: null, nome: '', texto: '' })}>
      <Icone nome="mais" tam={15} /> Novo modelo
    </button></div>}
    {edicao && !edicao.id && formulario}
    {modelos === null ? <Carregando />
      : typeof modelos === 'string' ? <Aviso tipo="erro">{modelos}</Aviso>
      : !modelos.length ? <Vazio>Nenhum modelo ainda. Crie o primeiro, ou salve como modelo um checklist de uma demanda ou de uma tarefa.</Vazio>
      : <ul className="modelos" aria-label="Modelos de checklist">{modelos.map(m => edicao?.id === m.id
        ? <li key={m.id}>{formulario}</li>
        : <li key={m.id} aria-label={`Modelo ${m.nome}`}><Cartao className="modelo">
          <header>
            <h2>{m.nome}</h2>
            <span className="nota">{m.itens.length === 1 ? '1 item' : `${m.itens.length} itens`}</span>
          </header>
          {m.itens.length ? <ol>{m.itens.map((i, n) => <li key={n}>{i}</li>)}</ol> : <Nota>Sem itens.</Nota>}
          <div className="modelo-form-acoes">
            <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => setEdicao({ id: m.id, nome: m.nome, texto: textoDosItens(m.itens) })}>
              <Icone nome="editar" tam={13} /> Editar
            </button>
            {(m.criado_por === ctx.perfil.id || ctx.ehAdmin) &&
              <BotaoDuplo forma="mini" variante="perigo" confirmar="Confirmar exclusão" aoConfirmar={() => excluir(m)}><Icone nome="lixeira" tam={13} /> Excluir</BotaoDuplo>}
          </div>
        </Cartao></li>)}</ul>}
  </div>;
}
