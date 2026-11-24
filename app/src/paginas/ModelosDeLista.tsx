// Modelos de checklist do escritório (#358; no código e no banco, "modelos de lista"), como "Documentos de pessoa jurídica":
// criar, editar e excluir. Numa demanda, tarefa ou contrato, um clique em "Adicionar checklist" usa o modelo (copia o nome, os
// grupos e os itens); mudar o modelo depois não muda os checklists feitos. Comuns a toda a equipe; quem criou ou um
// administrador exclui. Chega-se aqui pelo menu ⋯ de Demandas, de Tarefas e de Contratos. Desde a #309, o modelo é montado com a
// mesma árvore do checklist do cartão (grupos e subgrupos numerados, Subir, Descer, Mover para grupo), em memória até "Salvar".
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { SD, type ModeloDeLista } from '../dados';
import { TAMANHO_LISTA } from '../dados/limites';
import {
  aplicarPosicoes, arvoreDaLista, arvoreDoChecklist, comOsNovos, limparArvore, listaDoModelo, mudancasDePosicao, semOGrupo, tamanhoDoModelo,
  type ChecklistDaArvore
} from '../regras/gruposDaLista';
import { avisar, falha } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Aviso, BotaoDeIcone, Campo, Carregando, Cartao, estiloBotao, Nota, propsDoCampo, Vazio } from '../ui/base';
import { Icone } from '../ui/Icone';
import { useCtx } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import { TituloComAjuda } from '../ui/BotaoDeAjuda';
import { ArvoreDoChecklist, type AcoesDaArvore } from './listas/ArvoreDoChecklist';
import './Demandas.css';

/** O que está sendo editado: um modelo existente (pelo id) ou um novo, com a árvore em memória. */
type Edicao = { id: string | null; nome: string; lista: ChecklistDaArvore };
/** Os ids dos grupos e itens novos do editor (só valem na tela). */
const PREFIXO_NOVO = 'novo-';
/** Salvar com um item escrito e não adicionado perderia o item: o salvar espera a pessoa decidir. */
const ITEM_NAO_ADICIONADO = 'Há um item escrito e ainda não adicionado. Tecle Enter ou clique em Adicionar para ele entrar no modelo, ou apague o texto.';

export default function ModelosDeLista() {
  useTitulo('Modelos de checklist');
  const ctx = useCtx();
  const [modelos, setModelos] = useState<ModeloDeLista[] | string | null>(null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const carregar = useCallback(() => SD.modelosListar().then(setModelos).catch(e => setModelos((e as Error).message)), []);
  useEffect(() => { void carregar(); }, [carregar]);
  const editar = (m: ModeloDeLista | null) => setEdicao({ id: m?.id ?? null, nome: m?.nome ?? '', lista: listaDoModelo(m?.arvore ?? []) });

  async function salvar(arvore: ReturnType<typeof limparArvore>) {
    if (!edicao || typeof arvore === 'string') return;
    const nome = edicao.nome.trim();
    if (!nome) { falha(new Error('Dê um nome ao modelo.')); return; }
    try {
      if (edicao.id) await SD.modeloAtualizar(edicao.id, { nome, arvore });
      else await SD.modeloCriar(nome, arvore);
      avisar(edicao.id ? 'Modelo atualizado.' : 'Modelo criado.');
      setEdicao(null);
      await carregar();
    } catch (err) { falha(err); }
  }
  async function excluir(m: ModeloDeLista) {
    try { await SD.modeloExcluir(m.id); await carregar(); } catch (err) { falha(err); }
  }

  const formulario = edicao && <Cartao>
    <EditorDoModelo edicao={edicao} aoMudar={setEdicao} aoSalvar={salvar} aoCancelar={() => setEdicao(null)} />
  </Cartao>;

  return <div className="miolo">
    <header>
      <p className="olho"><Link to="/demandas/">Demandas</Link> · <Link to="/tarefas/">Tarefas</Link> · <Link to="/contratos/">Contratos</Link></p>
      <TituloComAjuda tela="modelosDeLista" />
      <p className="lead">Checklists prontos para usar nas demandas, nas tarefas e nos contratos com um clique, em "Adicionar checklist". Os itens podem ficar em grupos e subgrupos numerados (1., 1.1, 2.1.1). Mudar um modelo não muda os checklists já feitos com ele.</p>
      <Nota>Modelo com o mesmo nome de um objeto de contrato (por exemplo, "Registro de marca") vira as tarefas da demanda desse objeto: quando o contrato é assinado, cada item do modelo nasce como uma tarefa dela. Os grupos não viram tarefas, só os itens.</Nota>
    </header>
    {!edicao && <div><button type="button" className={estiloBotao({ variante: 'principal' })} onClick={() => editar(null)}>
      <Icone nome="mais" tam={15} /> Novo modelo
    </button></div>}
    {edicao && !edicao.id && formulario}
    {modelos === null ? <Carregando />
      : typeof modelos === 'string' ? <Aviso tipo="erro">{modelos}</Aviso>
      : !modelos.length ? <Vazio>Nenhum modelo ainda. Crie o primeiro, ou salve como modelo um checklist de uma demanda, de uma tarefa ou de um contrato.</Vazio>
      : <ul className="modelos" aria-label="Modelos de checklist">{modelos.map(m => edicao?.id === m.id
        ? <li key={m.id} className="modelo-em-edicao">{formulario}</li>
        : <li key={m.id} aria-label={`Modelo ${m.nome}`}><Cartao className="modelo">
          <header>
            <h2>{m.nome}</h2>
            <span className="nota">{tamanhoDoModelo(m.arvore)}</span>
          </header>
          {m.itens.length ? <ArvoreDoChecklist arvore={arvoreDaLista(listaDoModelo(m.arvore))} modo="modelo" rotuloDoNovo="" aoFocarNoTopo={() => {}} />
            : <Nota>Sem itens.</Nota>}
          <div className="modelo-form-acoes">
            <BotaoDeIcone icone="editar" rotulo="Editar" dica="Editar o modelo" onClick={() => editar(m)} />
            {(m.criado_por === ctx.perfil.id || ctx.ehAdmin) &&
              <BotaoDuplo icone="lixeira" rotulo="Excluir" dica="Excluir o modelo" variante="perigo" confirmar="Confirmar exclusão" aoConfirmar={() => excluir(m)} />}
          </div>
        </Cartao></li>)}</ul>}
  </div>;
}

/**
 * O editor de um modelo: o nome e a mesma árvore do checklist do cartão (sem as caixas de marcar e sem data), que muda em memória
 * com as mesmas regras (regras/gruposDaLista.ts). O que passa dos limites (grupos, itens, níveis) aparece num aviso e trava o salvar.
 */
function EditorDoModelo({ edicao, aoMudar, aoSalvar, aoCancelar }: {
  edicao: Edicao; aoMudar: (e: Edicao) => void; aoSalvar: (arvore: ReturnType<typeof limparArvore>) => Promise<void>; aoCancelar: () => void;
}) {
  const campoDoNome = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  /** Se algum campo de item novo tem texto escrito e não adicionado. */
  const [pendente, setPendente] = useState(false);
  const { lista } = edicao;
  const arvore = useMemo(() => arvoreDaLista(lista), [lista]);
  const limpa = useMemo(() => limparArvore(arvoreDoChecklist(lista)), [lista]);
  const mudar = (fn: (l: ChecklistDaArvore) => ChecklistDaArvore) => aoMudar({ ...edicao, lista: fn(lista) });
  const acoes: AcoesDaArvore = {
    renomearItem: (item, texto) => mudar(l => ({ ...l, itens: l.itens.map(i => i.id === item.id ? { ...i, texto } : i) })),
    renomearGrupo: (grupo, nome) => mudar(l => ({ ...l, grupos: l.grupos.map(g => g.id === grupo.id ? { ...g, nome } : g) })),
    reordenar: async depois => { mudar(l => aplicarPosicoes(l, mudancasDePosicao(l, depois))); return true; },
    acrescentar: async (grupoId, nova) => {
      const r = comOsNovos(lista, grupoId, nova, () => `${PREFIXO_NOVO}${++seq.current}`);
      aoMudar({ ...edicao, lista: r.lista });
      return r.grupos;
    },
    excluirItem: async item => mudar(l => ({ ...l, itens: l.itens.filter(i => i.id !== item.id) })),
    excluirGrupo: async grupo => mudar(l => semOGrupo(l, grupo.id)),
  };
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (pendente) { avisar(ITEM_NAO_ADICIONADO, 'erro'); return; }
    void aoSalvar(limpa);
  }
  return <form className="modelo-form" noValidate onSubmit={enviar} aria-label={edicao.id ? 'Editar modelo' : 'Novo modelo'}>
    <Campo rotulo="Nome do modelo" para="modelo-nome" obrigatorio>
      <input type="text" {...propsDoCampo('modelo-nome')} ref={campoDoNome} className="campo" maxLength={TAMANHO_LISTA} value={edicao.nome}
        onChange={e => aoMudar({ ...edicao, nome: e.target.value })} autoFocus />
    </Campo>
    <div className="modelo-arvore" role="group" aria-label="Grupos e itens do modelo">
      <p className="rotulo-caps">Grupos e itens</p>
      <ArvoreDoChecklist arvore={arvore} modo="modelo" acoes={acoes} rotuloDoNovo="Novo item do modelo" aoFocarNoTopo={() => campoDoNome.current?.focus()}
        aoMudarPendente={setPendente} />
    </div>
    {typeof limpa === 'string' && <Aviso tipo="erro">{limpa}</Aviso>}
    <div className="modelo-form-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal', pequeno: true })} disabled={typeof limpa === 'string'}>Salvar modelo</button>
      <button type="button" className={estiloBotao({ pequeno: true })} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}
