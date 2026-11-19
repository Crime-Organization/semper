// O que o cadastro de pessoa (NovaPessoa.tsx) oferece às etapas: os campos, como mudá-los, os montadores de campo e
// as buscas de CNPJ e CEP. As etapas não conhecem umas às outras, só o formulário (padrão Mediator).
import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import type { Membro } from '../../dados';
import type { CamposCadastro } from '../../regras/cadastro';
import type { MASCARAS } from '../../regras/pessoa';
import type { NivelDaSecao } from '../../ui/base';

export type Retorno = { tipo: 'ok' | 'erro'; conteudo: ReactNode } | null;
/** As listas do contato (várias linhas, com um botão de acrescentar). */
export type ListaDoContato = 'telefones' | 'emails';
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
  /** A equipe toda: a escolha dos responsáveis mostra só quem pode entrar. */
  equipe: Membro[];
  /** A mensagem de erro do campo, se houver (para o Campo e o Escolhas). */
  erroDe: (campo: string) => string | undefined;
  texto: (campo: keyof CamposCadastro, props?: OpcoesTexto) => ReactNode;
  data: (campo: keyof CamposCadastro) => ReactNode;
  radios: (nome: keyof CamposCadastro, opcoes: [string, string][], aoEscolher?: (v: string) => void) => ReactNode;
  ufs: (campo: keyof CamposCadastro) => ReactNode;
  lista: (campo: ListaDoContato, tel: boolean) => ReactNode;
  acrescentar: (campo: ListaDoContato) => void;
  /** O grupo de cada lista do contato, que recebe o foco quando uma linha é tirada (veja useFocoNoGrupo). */
  grupoDe: (campo: ListaDoContato) => RefObject<HTMLDivElement | null>;
  retorno: (r: Retorno) => ReactNode;
  /** O nível do título de cada etapa: 2 no cadastro, 3 no lápis do cartão (abaixo do título do cartão). */
  nivel: NivelDaSecao;
}

export const FormularioCtx = createContext<Formulario | null>(null);

export function useFormulario() {
  const f = useContext(FormularioCtx);
  if (!f) throw new Error('As etapas do cadastro só funcionam dentro do formulário (NovaPessoa).');
  return f;
}
