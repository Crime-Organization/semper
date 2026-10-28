// O que o cadastro de pessoa (NovaPessoa.tsx) oferece às etapas: os campos, como mudá-los, os montadores de campo e
// as buscas de CNPJ e CEP. As etapas não conhecem umas às outras, só o formulário (padrão Mediator).
import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import type { Membro } from '../../dados';
import type { CamposCadastro } from '../../regras/cadastro';
import type { MASCARAS } from '../../regras/pessoa';

export type Retorno = { tipo: 'ok' | 'erro'; conteudo: ReactNode } | null;
export interface OpcoesTexto { maximo?: number; maiusculas?: boolean; mascara?: keyof typeof MASCARAS; placeholder?: string; numerico?: boolean; aoSair?: () => void }

export interface Formulario {
  c: CamposCadastro;
  /** O valor mais novo dos campos (as consultas e janelas, assíncronas, leem daqui). */
  cRef: RefObject<CamposCadastro>;
  pj: boolean;
  mudar: (campos: Partial<CamposCadastro>) => void;
  marcarErro: (campo: string, texto?: string) => void;
  verificarDocumento: (doc: string) => Promise<boolean>;
  buscarCNPJ: () => Promise<void>;
  buscarCEP: () => Promise<void>;
  retornoCNPJ: Retorno;
  retornoCEP: Retorno;
  botaoCNPJ: RefObject<HTMLButtonElement | null>;
  botaoCEP: RefObject<HTMLButtonElement | null>;
  botaoAvancar: RefObject<HTMLButtonElement | null>;
  /** Quem pode ser responsável: a equipe ativa e quem já é responsável (mesmo desativado). */
  opcoesResp: Membro[];
  /** Classes da pergunta de um campo (marcada com erro, se houver). */
  pc: (campo: string, extra?: string) => string;
  erro: (campo: string) => ReactNode;
  texto: (campo: keyof CamposCadastro, props?: OpcoesTexto) => ReactNode;
  data: (campo: keyof CamposCadastro) => ReactNode;
  radios: (nome: keyof CamposCadastro, opcoes: [string, string][], aoEscolher?: (v: string) => void) => ReactNode;
  ufs: (campo: keyof CamposCadastro) => ReactNode;
  lista: (campo: 'telefones' | 'emails', tel: boolean) => ReactNode;
  acrescentar: (campo: 'telefones' | 'emails') => void;
  retorno: (r: Retorno) => ReactNode;
}

export const FormularioCtx = createContext<Formulario | null>(null);

export function useFormulario() {
  const f = useContext(FormularioCtx);
  if (!f) throw new Error('As etapas do cadastro só funcionam dentro do formulário (NovaPessoa).');
  return f;
}
