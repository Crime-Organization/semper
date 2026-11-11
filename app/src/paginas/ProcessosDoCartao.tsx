// Os processos ligados a um cartão (demanda, contrato, tarefa, compromisso), cada um num quadrinho que abre o processo.
// Quem pode alterar o cartão liga um processo que já existe ("+ Ligar processo", com busca) e desliga pelo "X", com o
// Desfazer no pé da tela, como os vínculos entre pessoas (#294).
import { useEffect, useState, type ReactNode } from 'react';
import { SD, type Coluna, type ProcessoLigado } from '../dados';
import { plural } from './importarPessoas/textos';
import { cabeOutroProcesso, SEM_SITUACAO_PROCESSO, TIPOS, TIPOS_PROCESSO } from '../regras/processo';
import { falha, feito } from '../ui/avisos';
import { Aviso, Carregando, Nota } from '../ui/base';
import { nomeDoEscolhido, type ProcessoEscolhido } from '../ui/EscolhaDeProcessos';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { LigarProcesso } from '../ui/LigarProcesso';

/** O processo no cartão. A tarefa só traz o número e o tipo; a demanda e o contrato trazem também o nome e a situação. */
export type ProcessoNoCartao = ProcessoEscolhido & Partial<Pick<ProcessoLigado, 'etapa_id' | 'arquivado_em'>>;
export interface ProcessosLidos { visiveis: ProcessoNoCartao[]; ocultos: number }

/** Ao salvar um cadastro: liga os processos que entraram e desliga os que saíram (veja mudancasNosProcessos). */
export async function gravarProcessos(m: { ligar: string[]; desligar: string[] }, ligar: (id: string) => Promise<unknown>, desligar: (id: string) => Promise<unknown>) {
  await Promise.all([...m.ligar.map(ligar), ...m.desligar.map(desligar)]);
}

interface Props {
  /** Estável entre um desenho e outro (useCallback): a lista lê de novo quando ele muda. */
  carregar: () => Promise<ProcessosLidos>;
  /** Muda quando o cartão muda (ao desfazer, por exemplo): a lista lê de novo. */
  versao: number;
  /** Quem só lê o cartão (ou o cartão arquivado) não vê ligar nem desligar. */
  somenteLer: boolean;
  ligar: (processoId: string) => Promise<unknown>;
  desligar: (processoId: string) => Promise<unknown>;
  /** Depois de ligar ou desligar: o cartão atualiza o contador e o histórico. */
  aoMudar: () => void;
  vazio: string;
  /** A tarefa e o compromisso têm um processo só. */
  maximo?: number;
  /** Quando o processo não pode sair (a audiência e a perícia precisam dele): o motivo, no lugar do "X". */
  semDesligar?: string;
  /** Outros botões ao lado de "Ligar processo" (o "Criar processo" da demanda). */
  outrasAcoes?: ReactNode;
}

export function ProcessosDoCartao({ carregar, versao, somenteLer, ligar, desligar, aoMudar, vazio, maximo, semDesligar, outrasAcoes }: Props) {
  const [lista, setLista] = useState<ProcessosLidos | string | null>(null);
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => {
    let vivo = true;
    carregar().then(x => { if (vivo) setLista(x); }).catch(e => { if (vivo) setLista((e as Error).message); });
    return () => { vivo = false; };
  }, [carregar, versao]);
  useEffect(() => {
    Promise.all(TIPOS.map(t => SD.colunasListar(TIPOS_PROCESSO[t].quadro))).then(c => setColunas(c.flat())).catch(() => {});
  }, []);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;

  const situacao = (etapa: string | null | undefined) => etapa === undefined ? null : colunas.find(c => c.id === etapa)?.nome || SEM_SITUACAO_PROCESSO;
  const nome = nomeDoEscolhido;

  async function aoLigar(id: string) {
    try {
      await ligar(id);
      feito('Processo ligado.', 'ligação do processo', async () => { await desligar(id); });
      aoMudar();
    } catch (e) { falha(e); }
  }
  async function aoDesligar(p: ProcessoNoCartao) {
    try {
      await desligar(p.id);
      feito(`Processo desligado: ${nome(p)}.`, 'desligamento do processo', async () => { await ligar(p.id); });
      aoMudar();
    } catch (e) { falha(e); }
  }

  const total = lista.visiveis.length + lista.ocultos;
  const podeLigar = !somenteLer && cabeOutroProcesso(total, maximo);
  return <>
    {lista.ocultos > 0 && <Nota>Há {plural(lista.ocultos, 'processo ligado', 'processos ligados')} aqui que você não tem acesso para abrir.</Nota>}
    <ItensLigados rotulo="Processos ligados" vazio={lista.ocultos ? undefined : vazio} itens={lista.visiveis.map(p => ({
      id: p.id, para: TIPOS_PROCESSO[p.tipo].caminho + '?id=' + p.id, codigo: p.codigo, titulo: nome(p), selo: p.arquivado_em ? 'Arquivado' : undefined,
      detalhe: [TIPOS_PROCESSO[p.tipo].nome, p.numero, situacao(p.etapa_id)].filter(Boolean).join(' · '),
      acao: somenteLer || semDesligar ? undefined
        : <button type="button" className="icone-btn" title="Desligar o processo" aria-label={`Desligar o processo ${nome(p)}`} onClick={() => aoDesligar(p)}>
          <Icone nome="fechar" tam={14} />
        </button>
    }))} />
    {!somenteLer && semDesligar && lista.visiveis.length > 0 && <Nota>{semDesligar}</Nota>}
    {(podeLigar || (!somenteLer && outrasAcoes)) && <div className="ligados-acoes">
      {podeLigar && <LigarProcesso ligados={lista.visiveis.map(p => p.id)} aoEscolher={p => aoLigar(p.id)} />}
      {!somenteLer && outrasAcoes}
    </div>}
  </>;
}
