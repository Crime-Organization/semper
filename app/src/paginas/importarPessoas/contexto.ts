// O que as etapas da importação de pessoas (etapas.tsx e TabelaConferencia.tsx) recebem da tela que as orquestra
// (ImportarPessoas.tsx): o estado da importação e as ações. As etapas só mostram e chamam; quem guarda é a tela.
import { createContext, useContext } from 'react';
import type { ItemImportacao } from '../../dados';
import type {
  Classificacao, Decisao, MapaResponsaveis, NomeDoArquivo, PessoaImportada, Problema
} from '../../regras/importacao';

export type EtapaImportacao = 'arquivo' | 'responsaveis' | 'conferencia' | 'gravando' | 'resumo';

/** O que se sabe do arquivo lido, além das linhas: o nome e as colunas que o SEMPER deixa de lado. */
export interface ArquivoLido {
  nome: string;
  /** Cabeçalhos que o SEMPER não conhece (ignorados). */
  desconhecidas: string[];
  /** Cabeçalhos repetidos (vale a primeira coluna). */
  repetidas: string[];
}

export interface TelaImportacao {
  irPara: (etapa: EtapaImportacao) => void;
  // Etapa 1: o arquivo.
  lgpdPadrao: string;
  mudarLgpd: (chave: string) => void;
  lendo: boolean;
  erroDoArquivo: string;
  lerArquivo: (f: File) => Promise<void>;
  arquivo: ArquivoLido | null;
  importadas: PessoaImportada[];
  // Etapa 2: os responsáveis.
  nomes: NomeDoArquivo[];
  mapa: MapaResponsaveis;
  ligar: (texto: string, perfil: string | null) => void;
  conferindo: boolean;
  conferir: () => Promise<void>;
  // Etapa 3: a conferência.
  classificacoes: Classificacao[];
  decisoes: Record<number, Decisao>;
  decidir: (linha: number, decisao: Decisao) => void;
  /** O que vai para o banco com as decisões de agora (planejar, em regras/importacao.ts). */
  plano: { itens: ItemImportacao[]; problemas: Problema[] };
  gravar: () => Promise<void>;
  // Etapa 5: o resumo.
  recomecar: () => void;
  fechar: () => void;
}

export const ImportacaoCtx = createContext<TelaImportacao | null>(null);

export function useImportacao(): TelaImportacao {
  const tela = useContext(ImportacaoCtx);
  if (!tela) throw new Error('useImportacao fora de <ImportarPessoas>');
  return tela;
}
