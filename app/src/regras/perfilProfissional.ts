// Regras do perfil profissional (a base das páginas da equipe no site do escritório): o perfil vazio, a limpeza antes
// de gravar e a conferência de cada campo, nas mesmas medidas do banco. Tudo puro, sem tela nem banco.
import type { CamposDoPerfil, PerfilProfissional } from '../dados/tipos';
import { LINHAS_DO_PERFIL, ORDEM_NO_SITE_MAXIMA, TAMANHO_PERFIL } from '../dados/limites';
import { emailValido, UFS } from './pessoa';

/** O perfil de quem ainda não preencheu nada. */
export function perfilVazio(perfilId: string): PerfilProfissional {
  return {
    perfil_id: perfilId, nome_exibicao: '', cargo: '', oab: [], areas: [], bio_curta: '', biografia: '', formacao: [], idiomas: [],
    experiencia: [], associacoes: [], publicacoes: [], lattes: '', email_publico: '', telefone_publico: '', linkedin: '', redes: [],
    no_site: false, ordem_no_site: null, atualizado_em: null
  };
}

/** Campos do perfil que se gravam (sem de quem é e a data). */
export const camposDoPerfil = ({ perfil_id: _p, atualizado_em: _a, ...campos }: PerfilProfissional): CamposDoPerfil => campos;

/** Nome que aparece no site: o de exibição, se houver; se não, o do cadastro. */
export const nomeNoSite = (perfil: Pick<PerfilProfissional, 'nome_exibicao'>, nome: string) => perfil.nome_exibicao.trim() || nome;

/** Linhas de uma lista sem espaços nas pontas; as linhas todas em branco saem. */
function limparLinhas<T extends object>(linhas: T[]): T[] {
  return linhas
    .map(l => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, String(v).trim()])) as T)
    .filter(l => Object.values(l).some(Boolean));
}
/** Textos sem espaços nas pontas, sem vazios e sem repetidos. */
const limparTextos = (textos: string[]) => [...new Set(textos.map(t => t.trim()).filter(Boolean))];

/** Como o perfil vai para o banco: textos sem espaços nas pontas, e-mail em minúsculas, UF em maiúsculas, sem linhas em branco. */
export function limparPerfil(c: CamposDoPerfil): CamposDoPerfil {
  return {
    ...c,
    nome_exibicao: c.nome_exibicao.trim(), cargo: c.cargo.trim(), bio_curta: c.bio_curta.trim(), biografia: c.biografia.trim(),
    lattes: c.lattes.trim(), email_publico: c.email_publico.trim().toLowerCase(), telefone_publico: c.telefone_publico.trim(),
    linkedin: c.linkedin.trim(),
    oab: limparLinhas(c.oab).map(o => ({ ...o, uf: o.uf.toUpperCase() })),
    areas: limparTextos(c.areas), idiomas: limparTextos(c.idiomas), associacoes: limparTextos(c.associacoes),
    formacao: limparLinhas(c.formacao), experiencia: limparLinhas(c.experiencia), publicacoes: limparLinhas(c.publicacoes),
    redes: limparLinhas(c.redes)
  };
}

export type ErrosDoPerfil = Partial<Record<keyof CamposDoPerfil, string>>;

const linkValido = (v: string) => !v || /^https?:\/\/\S+$/i.test(v);
const MSG_LINK = 'Cole o link completo, começando com https://.';
const longo = (v: string, maximo: number) => v.length > maximo ? `Use até ${maximo} letras.` : null;
/** A lista tem linhas demais, ou algum texto dela passa do tamanho (o link tem a própria medida). */
function listaGrande(linhas: object[]) {
  if (linhas.length > LINHAS_DO_PERFIL) return `Use até ${LINHAS_DO_PERFIL} linhas.`;
  const passou = linhas.some(l => Object.entries(l).some(([k, v]) => String(v).length > (k === 'link' ? TAMANHO_PERFIL.link : TAMANHO_PERFIL.item)));
  return passou ? `Cada texto tem até ${TAMANHO_PERFIL.item} letras.` : null;
}
const textosGrandes = (textos: string[]) => listaGrande(textos.map(texto => ({ texto })));

/** Conferência de cada campo, já limpo: a mensagem de erro, ou null. */
const CONFERIR: { [K in keyof CamposDoPerfil]?: (c: CamposDoPerfil) => string | null } = {
  nome_exibicao: c => longo(c.nome_exibicao, TAMANHO_PERFIL.nome_exibicao),
  cargo: c => longo(c.cargo, TAMANHO_PERFIL.cargo),
  bio_curta: c => c.bio_curta.length > TAMANHO_PERFIL.bio_curta ? `A bio curta tem até ${TAMANHO_PERFIL.bio_curta} letras (2 ou 3 linhas).` : null,
  biografia: c => longo(c.biografia, TAMANHO_PERFIL.biografia),
  oab: c => listaGrande(c.oab)
    ?? (c.oab.some(o => !o.numero) ? 'Informe o número de cada inscrição.' : null)
    ?? (c.oab.some(o => !UFS.includes(o.uf)) ? 'Escolha a seccional (UF) de cada inscrição.' : null),
  areas: c => textosGrandes(c.areas),
  idiomas: c => textosGrandes(c.idiomas),
  associacoes: c => textosGrandes(c.associacoes),
  formacao: c => listaGrande(c.formacao) ?? (c.formacao.some(f => !f.curso) ? 'Informe o curso de cada formação.' : null),
  experiencia: c => listaGrande(c.experiencia) ?? (c.experiencia.some(e => !e.cargo) ? 'Informe o cargo de cada experiência.' : null),
  publicacoes: c => listaGrande(c.publicacoes)
    ?? (c.publicacoes.some(p => !p.titulo) ? 'Informe o título de cada publicação.' : null)
    ?? (c.publicacoes.every(p => linkValido(p.link)) ? null : MSG_LINK),
  redes: c => listaGrande(c.redes)
    ?? (c.redes.some(r => !r.nome || !r.link) ? 'Informe o nome e o link de cada rede.' : null)
    ?? (c.redes.every(r => linkValido(r.link)) ? null : MSG_LINK),
  lattes: c => linkValido(c.lattes) ? longo(c.lattes, TAMANHO_PERFIL.link) : 'Cole o link do Currículo Lattes, começando com http://lattes.cnpq.br/.',
  linkedin: c => linkValido(c.linkedin) ? longo(c.linkedin, TAMANHO_PERFIL.link) : MSG_LINK,
  email_publico: c => !c.email_publico || (emailValido(c.email_publico) && c.email_publico.length <= TAMANHO_PERFIL.email) ? null : 'Confira o e-mail.',
  telefone_publico: c => longo(c.telefone_publico, TAMANHO_PERFIL.telefone),
  ordem_no_site: c => c.ordem_no_site === null || (Number.isInteger(c.ordem_no_site) && c.ordem_no_site >= 0 && c.ordem_no_site <= ORDEM_NO_SITE_MAXIMA)
    ? null : `Use um número de 0 a ${ORDEM_NO_SITE_MAXIMA}.`
};

/** Os erros do perfil (conferido depois de limpo), por campo. Sem erros: {}. */
export function errosDoPerfil(c: CamposDoPerfil): ErrosDoPerfil {
  const limpo = limparPerfil(c);
  return Object.fromEntries(Object.entries(CONFERIR).map(([campo, conferir]) => [campo, conferir(limpo)]).filter(([, erro]) => erro));
}
