// Cadastro de anotação do módulo Documentos (#303), numa etapa só: o título, o texto (com negrito, itálico, títulos, listas
// e links e, desde a #344, o Markdown comum: tarefas, listas numeradas, citações, código, tabelas), o responsável e com quem ela é compartilhada. Vindo do cartão de um item (?pessoa=, ?processo=, ?contrato=,
// ?demanda=, ?tarefa= ou ?compromisso=), a anotação nasce ligada a ele e, ao salvar, a janela fecha e volta ao cartão.
// Pelo lápis do cartão da anotação, o mesmo formulário edita.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type Anotacao, type ItemDaAnotacao, type ModuloDaAnotacao } from '../dados';
import { TAMANHO_ANOTACAO } from '../dados/limites';
import {
  camposDaAnotacao, dadosDaAnotacao, errosDaAnotacao, gravaForaDaAnotacao, ITEM_DA_ANOTACAO, itemDaAnotacao, MODULOS_DA_ANOTACAO, semSairDaAnotacao,
  type CamposAnotacao
} from '../regras/anotacao';
import { RodapeDaEdicao, type EdicaoNoCartao } from '../ui/AcoesDoCartao';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { falha, feito } from '../ui/avisos';
import { Aviso, CaixaFormatada, Campo, Carregando, estiloBotao, propsDoCampo } from '../ui/base';
import { EscolhaDaEquipe } from '../ui/EscolhaDaEquipe';
import { sairDoCartao } from '../ui/sairDoCartao';
import { useCtx } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import { ENDERECO_DA_ANOTACAO } from './AnotacoesDoCartao';
import './Documentos.css';

const ENDERECO = '/documentos/';
/** Como ler o item de cada módulo, para mostrar a que a anotação nova fica ligada. */
const OBTER_ITEM: Record<ModuloDaAnotacao, (id: string) => Promise<ItemDaAnotacao | null>> = {
  pessoas: id => SD.pessoaObter(id).then(x => x && itemDaAnotacao('pessoas', x)),
  processos: id => SD.processoObter(id).then(x => x && itemDaAnotacao('processos', { ...x, cliente_nome: x.clientes.map(c => c.nome).join('; ') })),
  contratos: id => SD.contratoObter(id).then(x => x && itemDaAnotacao('contratos', x)),
  demandas: id => SD.demandaObter(id).then(x => x && itemDaAnotacao('demandas', x)),
  tarefas: id => SD.tarefaObter(id).then(x => x && itemDaAnotacao('tarefas', x)),
  compromissos: id => SD.compromissoObter(id).then(x => x && itemDaAnotacao('compromissos', x))
};
/** Há uma página antes desta na história da aba (a janela do cadastro aberta de dentro do sistema). */
const vemDeOutraPagina = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

export default function NovaAnotacao({ edicao }: { edicao?: EdicaoNoCartao } = {}) {
  const ctx = useCtx();
  const navegar = useNavigate();
  /** Marcada logo antes de sair por conta própria: aí o aviso de sair sem salvar não pergunta. */
  const saidaLiberada = useRef(false);
  const [params] = useSearchParams();
  const idAtualizar = edicao?.id ?? params.get('id');
  // O item de onde se veio: o primeiro módulo cujo parâmetro está no endereço.
  const moduloDeOrigem = idAtualizar ? undefined : MODULOS_DA_ANOTACAO.find(m => params.get(ITEM_DA_ANOTACAO[m].parametro));
  const idDeOrigem = moduloDeOrigem ? params.get(ITEM_DA_ANOTACAO[moduloDeOrigem].parametro)! : null;

  // Quem cadastra já vem como responsável.
  const [c, setC] = useState<CamposAnotacao>(() => ({ titulo: '', texto: '', responsavelId: ctx.perfil.id, participantes: [] }));
  const [alvo, setAlvo] = useState<Anotacao | null>(null);
  const [pronto, setPronto] = useState(!idAtualizar);
  const [origem, setOrigem] = useState<ItemDaAnotacao | null | undefined>(undefined);   // undefined: lendo ou sem origem
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useTitulo(edicao ? null : alvo ? 'Atualizar anotação' : 'Nova anotação');

  const mudar = (campos: Partial<CamposAnotacao>) => setC(atual => ({ ...atual, ...campos }));
  useEffect(() => {
    if (idAtualizar) {
      SD.anotacaoObter(idAtualizar)
        .then(a => { if (!a) throw new Error('Anotação não encontrada.'); setAlvo(a); setC(camposDaAnotacao(a)); })
        .catch(falha)
        .finally(() => setPronto(true));
      return;
    }
    if (moduloDeOrigem && idDeOrigem) OBTER_ITEM[moduloDeOrigem](idDeOrigem).then(setOrigem).catch(() => setOrigem(null));
  }, [idAtualizar, moduloDeOrigem, idDeOrigem]);
  // Ao abrir, o foco vai para o título.
  useEffect(() => {
    const t = setTimeout(() => document.getElementById('titulo')?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, [pronto]);

  // Enquanto o item de onde se veio é lido, ainda não se sabe se a anotação nasce ligada: o Salvar espera.
  const lendoOrigem = !!moduloDeOrigem && origem === undefined;
  const erros = conferido ? errosDaAnotacao(c) : {};
  // Responsável: qualquer um da equipe ativa, e quem já é o responsável (mesmo desativado, para não sair sem querer).
  const opcoesResp = ctx.equipe.filter(m => m.ativo !== false || m.id === c.responsavelId);

  async function salvar() {
    if (ocupado || lendoOrigem) return;   // o Enter não respeita o botão desligado
    setConferido(true);
    if (Object.keys(errosDaAnotacao(c)).length) {
      requestAnimationFrame(() => document.querySelector('.pergunta.erro')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return;
    }
    const dados = dadosDaAnotacao(c);
    setOcupado(true);
    try {
      if (alvo) {
        // Para desfazer: a anotação como estava, no mesmo formato que o cadastro grava.
        const antes = dadosDaAnotacao(camposDaAnotacao(alvo));
        const eu = ctx.perfil.id, { dados: gravar, ficou } = semSairDaAnotacao(dados, eu, gravaForaDaAnotacao(ctx, alvo.criado_por === eu),
          { responsavel_id: alvo.responsavel_id, lista: alvo.participantes });
        await SD.anotacaoAtualizar(alvo.id, gravar);
        if (ficou) {
          // A pessoa se tirou da anotação: o resto já foi gravado com ela dentro, e a saída vem por último (ela pode deixar de vê-la).
          await sairDoCartao('anotacoes', alvo.id, 'Anotação atualizada. Você saiu dela, e a saída ficou no histórico.');
          saidaLiberada.current = true;
          navegar(ENDERECO);
          return;
        }
        feito('Anotação atualizada.', 'atualização da anotação', async () => {
          await SD.anotacaoAtualizar(alvo.id, antes);
          return { tipo: 'anotacaoAtualizada', id: alvo.id };
        });
        saidaLiberada.current = true;
        if (edicao) edicao.aoTerminar(true); else navegar(ENDERECO_DA_ANOTACAO + alvo.id);
        return;
      }
      // Liga ao item lido: se ele não foi encontrado, a anotação é salva sem ligação, como o aviso diz.
      const ligarA = origem ? { modulo: origem.modulo, id: origem.id } : undefined;
      const r = await SD.anotacaoCriar(dados, ligarA);
      feito(`Anotação ${r.codigo} cadastrada.`, 'cadastro da anotação', async () => {
        await SD.anotacoesArquivar([r.id], true);
        const x = await SD.anotacoesExcluir([r.id]);
        if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
        return { tipo: 'anotacaoCriada', id: r.id };
      });
      saidaLiberada.current = true;
      // Vinda do cartão de um item, a janela fecha e o cartão dele mostra a anotação nova; senão, abre o cartão dela.
      if (ligarA && vemDeOutraPagina()) navegar(-1); else navegar(ENDERECO_DA_ANOTACAO + r.id);
    } catch (err) {
      falha(err);
      setOcupado(false);
    }
  }
  // Enter no título salva (no texto, ele quebra a linha).
  function teclar(e: KeyboardEvent<HTMLFormElement>) {
    const el = e.target as HTMLElement;
    if (e.key !== 'Enter' || e.defaultPrevented || el.tagName !== 'INPUT') return;
    e.preventDefault();
    void salvar();
  }

  const campos = <>
    {origem && <Aviso tipo="info">Será ligada a: <b>{ITEM_DA_ANOTACAO[origem.modulo].rotulo} {origem.nome}</b> <span className="codigo">{origem.codigo}</span></Aviso>}
    {origem === null && <Aviso tipo="erro">O item de onde você veio não foi encontrado. A anotação será salva sem ligação.</Aviso>}
    <Campo rotulo="Título" para="titulo" obrigatorio erro={erros.titulo}>
      <input type="text" {...propsDoCampo('titulo', { erro: erros.titulo })} maxLength={TAMANHO_ANOTACAO.titulo} value={c.titulo} onChange={e => mudar({ titulo: e.target.value })} />
    </Campo>
    <Campo rotulo="Texto" para="texto" erro={erros.texto} dica="Use # para títulos, - para listas, - [ ] para tarefas, 1. para listas numeradas, > para citações, `código` e [texto](https://…) para links, ou os botões da barra.">
      <CaixaFormatada {...propsDoCampo('texto', { dica: true, erro: erros.texto })} className="anotacao-caixa" maxLength={TAMANHO_ANOTACAO.texto} valor={c.texto}
        aoMudar={texto => mudar({ texto })} />
    </Campo>
    <Campo rotulo="Responsável" para="responsavelId" obrigatorio erro={erros.responsavelId} dica="Quem responde pela anotação: qualquer um da equipe.">
      <select {...propsDoCampo('responsavelId', { dica: true, erro: erros.responsavelId })} value={c.responsavelId}
        onChange={e => mudar({ responsavelId: e.target.value, participantes: c.participantes.filter(x => x !== e.target.value) })}>
        <option value="">Escolha…</option>
        {opcoesResp.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
    </Campo>
    <EscolhaDaEquipe rotulo="Compartilhar com" dica="Quem da equipe também vê e altera a anotação." adicionar="Adicionar pessoa da equipe"
      equipe={ctx.equipe} escolhidos={c.participantes} fora={c.responsavelId ? [c.responsavelId] : []} aoMudar={participantes => mudar({ participantes })} />
  </>;

  // No cartão (o lápis): os campos, com Cancelar e Salvar no pé.
  if (edicao) return !pronto ? <Carregando />
    : !alvo ? <Aviso tipo="erro">Não foi possível abrir para editar. Feche e tente de novo.</Aviso>
    : <form className="form-grade edicao-cartao" noValidate autoComplete="off" aria-label="Editar anotação" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
      <section className="etapa ativa">{campos}</section>
      <RodapeDaEdicao ocupado={ocupado} aoCancelar={() => edicao.aoTerminar(false)} aoSalvar={() => void salvar()} />
    </form>;

  const voltar = ENDERECO + (idAtualizar ? '?id=' + idAtualizar : '');
  return <div className="passos">
    <AvisoAoSair estado={c} liberada={saidaLiberada} ocupado={ocupado} />
    <header>
      <p className="olho"><Link to={voltar}>Documentos</Link></p>
      <h1 className="titulo">{alvo ? 'Atualizar anotação' : 'Nova anotação'}<span className="ponto">.</span></h1>
    </header>
    {alvo && <Aviso tipo="info">Você está atualizando a anotação <b>{alvo.codigo}</b>. As informações anteriores ficam no histórico.</Aviso>}
    {!pronto ? <Carregando /> : <form className="form-grade" noValidate autoComplete="off" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
      <section className="etapa ativa" aria-label="Anotação">{campos}</section>
      <div className="navegar">
        <span />
        <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={ocupado || lendoOrigem} onClick={() => void salvar()}>
          {ocupado ? 'Salvando…' : alvo ? 'Salvar alterações' : 'Salvar anotação'}
        </button>
      </div>
    </form>}
  </div>;
}
