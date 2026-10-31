// Regras do cadastro de pessoa em etapas (paginas/NovaPessoa.tsx): os campos do formulário, quais etapas cada
// tipo de pessoa percorre e a validação de cada etapa. Tudo puro, sem tela nem banco: a conferência de CPF/CNPJ
// já cadastrado (que depende do banco) é pedida de volta pelo resultado, em "documento".
import type { TipoPessoa } from '../dados/tipos';
import {
  cepValido, cnpjValido, cpfValido, dig, ehIndividual, emailValido, ENTIDADES, fmtCNPJ, lerData, limparDocumento, telefoneValido
} from './pessoa';

export type Etapa = 's-tipo' | 's-ident' | 's-pf' | 's-entidade' | 's-empresa' | 's-endereco' | 's-contato';
/** Linha de uma lista do formulário (telefones, e-mails); k identifica a linha na tela. */
export interface Linha { k: number; v: string }
export interface CamposCadastro {
  tipo: '' | TipoPessoa;
  nome: string; cnpjBusca: string; natureza: string;
  genero: string; nac: '' | 'brasileira' | 'outra'; nacOutra: string; profissao: string; ec: string; cpf: string;
  rg: string; rgExp: string; mae: string; pai: string; nasc: string; nascMun: string; nascUf: string;
  entidade: string; fantasia: string; porte: string; cnpj: string; abertura: string; representantes: string;
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string;
  telefones: Linha[]; emails: Linha[]; resp: string[]; lgpdBase: string; lgpdData: string;
}

/** Mensagem de cada campo quando falta ou está inválido (a validação pode trocar por uma mais específica). */
export const MSG: Record<string, string> = {
  tipo: 'Selecione o tipo de cadastro.', nome: 'Informe o nome.', cnpjBusca: 'Informe um CNPJ válido.',
  genero: 'Selecione o gênero (usado na concordância da qualificação).', cpf: 'Informe um CPF válido.', rgExp: 'Data inválida.',
  nasc: 'Data inválida.', cnpj: 'Informe um CNPJ válido.', abertura: 'Data inválida.', cep: 'O CEP tem 8 dígitos.',
  telefones: 'Informe pelo menos um telefone com DDD.', emails: 'Confira o formato do e-mail.', lgpdData: 'Data inválida.'
};

export const maiusculas = (v: string) => v.toUpperCase().replace(/\s+/g, ' ').trim();

/** Etapas que cada tipo de pessoa percorre. A do tipo de entidade só aparece quando a natureza jurídica foi escolhida. */
export function fluxo(c: CamposCadastro): Etapa[] {
  if (c.tipo === 'pf') return ['s-tipo', 's-ident', 's-pf', 's-endereco', 's-contato'];
  if (c.tipo === 'pj') return ['s-tipo', 's-ident', ...(c.natureza ? ['s-entidade' as const] : []), 's-empresa', 's-endereco', 's-contato'];
  if (c.tipo === 'contato') return ['s-tipo', 's-ident', 's-contato'];
  return ['s-tipo'];
}

/** Resultado de validar uma etapa. */
export interface ResultadoEtapa {
  /** Erros novos, por campo. Vazio: a etapa está certa. */
  erros: Record<string, string>;
  /** Campos conferidos agora: os erros antigos deles saem (ficam só os de "erros"). */
  conferidos: string[];
  /** Ajustes a gravar nos campos antes de seguir (ex.: o nome em maiúsculas). */
  ajustes: Partial<CamposCadastro>;
  /** CPF ou CNPJ (só os números) a conferir no banco, quando a etapa está certa. */
  documento?: string;
}

/** Ferramenta de cada validação: marcar(campo, condição) registra o campo como conferido e o erro, se houver. */
function conferir() {
  const r: ResultadoEtapa = { erros: {}, conferidos: ['rgExp', 'nasc', 'abertura', 'lgpdData'], ajustes: {} };
  const marcar = (campo: string, cond: boolean, texto?: string) => { r.conferidos.push(campo); if (!cond) r.erros[campo] = texto || MSG[campo]; };
  const data = (valor: string, campo: string) => { try { lerData(valor); } catch (e) { r.erros[campo] = (e as Error).message; } };
  return { r, marcar, data, certo: () => !Object.keys(r.erros).length };
}
/** Mensagem do documento inválido: o CNPJ pode ter letras (CNPJ alfanumérico); o CPF, só números. */
export const DOCUMENTO_INVALIDO: Record<'CPF' | 'CNPJ', string> = {
  CPF: 'CPF inválido: confira os números.',
  CNPJ: 'CNPJ inválido: confira as letras e os números.'
};
const documentoInvalido = (d: string, rotulo: 'CPF' | 'CNPJ') => d ? DOCUMENTO_INVALIDO[rotulo] : `Informe o ${rotulo}.`;

/** Validação de cada etapa (padrão State: cada etapa sabe se está certa). */
export const VALIDACAO: Record<Etapa, (a: CamposCadastro) => ResultadoEtapa> = {
  's-tipo': a => {
    const { r, marcar } = conferir();
    marcar('tipo', !!a.tipo);
    return r;
  },
  's-ident': a => {
    const { r, marcar, certo } = conferir();
    const nome = maiusculas(a.nome);
    r.ajustes.nome = nome;
    marcar('nome', !!nome);
    if (a.tipo === 'pj') {
      const d = limparDocumento(a.cnpjBusca);
      marcar('cnpjBusca', cnpjValido(d), documentoInvalido(d, 'CNPJ'));
      if (certo()) { if (!a.cnpj) r.ajustes.cnpj = fmtCNPJ(d); r.documento = d; }
    }
    return r;
  },
  's-pf': a => {
    const { r, marcar, data, certo } = conferir();
    marcar('genero', !!a.genero);
    const d = dig(a.cpf);
    marcar('cpf', cpfValido(d), documentoInvalido(d, 'CPF'));
    data(a.rgExp, 'rgExp');
    data(a.nasc, 'nasc');
    if (certo()) r.documento = d;
    return r;
  },
  's-entidade': () => conferir().r,
  's-empresa': a => {
    const { r, marcar, data, certo } = conferir();
    if (ehIndividual(a.entidade)) marcar('genero', !!a.genero, 'Selecione o gênero do(a) titular (usado na concordância da qualificação).');
    const d = limparDocumento(a.cnpj);
    marcar('cnpj', cnpjValido(d), documentoInvalido(d, 'CNPJ'));
    data(a.abertura, 'abertura');
    if (certo()) r.documento = d;
    return r;
  },
  's-endereco': a => {
    const { r, marcar } = conferir();
    const cep = dig(a.cep);
    marcar('cep', !cep || cepValido(cep));
    return r;
  },
  's-contato': a => {
    const { r, marcar, data } = conferir();
    const tels = a.telefones.map(t => dig(t.v)).filter(Boolean);
    marcar('telefones', tels.length > 0 && tels.every(telefoneValido), tels.length ? 'Confira os telefones: use DDD + número.' : undefined);
    marcar('emails', a.emails.map(x => x.v.trim()).filter(Boolean).every(emailValido));
    if (a.lgpdBase === 'consentimento') data(a.lgpdData, 'lgpdData');
    return r;
  }
};

/** O que a etapa conhece do cadastro ao ser aberta. */
export interface AoEntrar {
  /** Tipo de entidade do cadastro sendo atualizado, se houver. */
  entidadeDoCadastro?: string | null;
  /** Linha nova e vazia de uma lista (telefones, e-mails), com chave própria. */
  novaLinha: () => Linha;
}
/** Ajustes que uma etapa pede nos campos quando é aberta (as que não estão aqui não pedem nada). */
export const AO_ENTRAR: Partial<Record<Etapa, (a: CamposCadastro, ctx: AoEntrar) => Partial<CamposCadastro>>> = {
  // A entidade escolhida precisa ser da natureza atual; senão, volta a do cadastro (se for dessa natureza) ou fica em branco.
  's-entidade': (a, { entidadeDoCadastro: t }) => {
    const lista = ENTIDADES[a.natureza] || [];
    return lista.includes(a.entidade) ? {} : { entidade: t && lista.includes(t) ? t : '' };
  },
  // O contato abre com uma linha para o telefone e outra para o e-mail.
  's-contato': (a, { novaLinha }) => ({
    ...(a.telefones.length ? {} : { telefones: [novaLinha()] }),
    ...(a.emails.length ? {} : { emails: [novaLinha()] })
  })
};
