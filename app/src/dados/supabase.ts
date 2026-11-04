// Camada de dados do SEMPER: a única parte do site que conversa com o Supabase.
// As telas usam só o objeto SD (veja dados/index.ts); o contrato está em dados/tipos.ts.
import { AuthClient, isAuthSessionMissingError } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import { StorageClient } from '@supabase/storage-js';
import { MARCA } from '../marca';
import { CATEGORIAS_DE_AJUSTE } from '../regras/caixa';
import { normalizarEmail, RECUSA_DA_TROCA } from '../regras/conta';
import { cnpjComLetrasNaBusca, telefoneNormal, TIPO_REPRESENTANTE } from '../regras/pessoa';
import { caminhoDaFoto } from '../regras/foto';
import { inicioDoDia } from '../regras/meuTempo';
import { perfilVazio } from '../regras/perfilProfissional';
import { normal } from '../regras/texto';
import { traduzir } from './erros';
import type { Lancamento, MeuValor, MovimentoDoLucro, Parcela, ParcelaDoEscritorio, Repasse, Socio, ValorAPassar } from './tipos';
import { PARCELAS_DA_PESSOA } from './limites';
import { COMPROMISSOS_LIGADOS, HISTORICO_DO_COMPROMISSO, ITENS_DA_AGENDA, PROCESSOS_PARA_LIGAR, ANDAMENTOS_DO_PROCESSO, PRAZOS_DO_PROCESSO, CHAVES_POR_CONSULTA, IDS_POR_EXCLUSAO, LINHAS_POR_CONSULTA, HISTORICO_DO_PROCESSO, PROCESSOS_LIGADOS, PROCESSOS_PARA_SUGERIR, FOTO_GRANDE, FOTO_PEQUENA, COMENTARIOS_DO_CARTAO, CONTRATOS_DA_PESSOA, DEMANDAS_LIGADAS, OBJETOS_SUGERIDOS, POR_COLUNA, POR_PAGINA, REGISTRO_DE_ACOES, TAREFAS_LIGADAS, TROCAS_DE_EMAIL_MOSTRADAS } from './limites';
import { papeisNoContrato } from '../regras/contrato';
import { papeisNaDemanda } from '../regras/demanda';
import { papeisNoCompromisso } from '../regras/compromisso';
import { papeisNoProcesso } from '../regras/processo';
import { datasDoPainel, ITENS_POR_LISTA, SEM_FASE, ULTIMOS_ANDAMENTOS } from '../regras/painelProcessos';
import { papeisNaTarefa } from '../regras/tarefa';
import { FUNCAO_INICIAL } from '../regras/equipe';
import type { Compromisso, FiltroCompromissos, OrdemCompromisso, PrazoNaAgenda, AndamentoDeProcesso, PrazoDeProcesso, LigacaoGoogle, RecusaDaTrocaDeEmail, ResultadoDaLigacao, CartaoComListas, Membro, TempoNaTarefaDoPeriodo, Comentario, Contexto, Contrato, Dados, Demanda, DemandaLigada, ItemDaLista, ListaDoCartao, ModeloDeLista, DiaLancado, Etiqueta, GrupoDeColunas, ModuloComEtiquetas, Orgao, Processo, FiltroProcessos, FiltroContratos, FiltroDemandas, FiltroPessoas, FiltroTarefas, Funcao, MarcaPessoas, Ordem, ModuloComentado, Participacao, Pessoa, PessoaResumida, RepresentanteVinculado, Tarefa, TarefaLigada, Usuario } from './tipos';

// Só as partes do Supabase que o SEMPER usa (login, banco e as fotos da equipe), montadas como o supabase-js faz:
// metade do peso do pacote completo. A chave da sessão é a mesma de sempre, então quem já está
// logado continua logado.
const URL_BASE = MARCA.supabaseUrl.replace(/\/+$/, '');
const CHAVE = MARCA.supabaseChave;
const auth = new AuthClient({
  url: URL_BASE + '/auth/v1',
  headers: { Authorization: `Bearer ${CHAVE}`, apikey: CHAVE },
  storageKey: `sb-${new URL(URL_BASE).hostname.split('.')[0]}-auth-token`,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'implicit'
});
// Cada consulta leva a chave do projeto e o token de quem está logado (sem sessão, vai a própria chave).
const comSessao: typeof fetch = async (entrada, init) => {
  const { data } = await auth.getSession();
  const cabecalhos = new Headers(init?.headers);
  if (!cabecalhos.has('apikey')) cabecalhos.set('apikey', CHAVE);
  if (!cabecalhos.has('Authorization')) cabecalhos.set('Authorization', `Bearer ${data.session?.access_token ?? CHAVE}`);
  return fetch(entrada, { ...init, headers: cabecalhos });
};
const db = new PostgrestClient(URL_BASE + '/rest/v1', { fetch: comSessao });
const sb = { auth, from: (tabela: string) => db.from(tabela), rpc: (nome: string, args?: Record<string, unknown>) => db.rpc(nome, args) };
/** A pasta privada das fotos da equipe (supabase/migrations/20261030150000_foto_do_perfil.sql). */
const fotos = new StorageClient(URL_BASE + '/storage/v1', {}, comSessao).from('fotos-da-equipe');
/** Por quanto tempo vale o link de uma foto, em segundos: um dia (a cada entrada, as bolinhas pedem links novos). */
const LINK_DA_FOTO = 24 * 60 * 60;
/** Links das fotos, na ordem dos caminhos (null onde não houver). */
async function linksDasFotos(caminhos: string[]): Promise<(string | null)[]> {
  if (!caminhos.length) return [];
  const { data } = await rodar(fotos.createSignedUrls(caminhos, LINK_DA_FOTO));
  return (data as { signedUrl: string | null }[]).map(l => l.signedUrl);
}
let ctx: Contexto | null = null;

// Resposta do Supabase: devolve os dados ou lança o erro já traduzido. O banco responde em formato
// livre (any); daqui para fora valem os tipos de dados/tipos.ts.
type Livre = any;
type Resposta = { data: unknown; error: unknown; count?: number | null };
async function rodar(promessa: PromiseLike<Resposta>): Promise<{ data: Livre; count: number | null }> {
  let r: Resposta;
  try { r = await promessa; } catch (e) { throw traduzir(e); }
  if (r.error) throw traduzir(r.error);
  return { data: r.data, count: r.count ?? null };
}
const uid = () => ctx?.usuario?.id;

// ---------- pessoas ----------
const CAMPOS_LISTA = 'id, codigo, tipo, nome, nome_fantasia, documento, telefones, emails, municipio, uf, etapa_id, etapa_ordem, arquivado_em, criado_por, criado_em, atualizado_em, pendencias, importacao_id, resp:pessoa_responsaveis(perfil_id)';
/** O cadastro completo, com os responsáveis. */
const CAMPOS_PESSOA = '*, resp:pessoa_responsaveis(perfil_id)';
/** O filtro de cada marca de Pessoas (importadas, com pendência). */
const MARCAS: Record<MarcaPessoas, (q: Livre) => Livre> = {
  importadas: q => q.not('importacao_id', 'is', null),
  pendentes: q => q.neq('pendencias', '{}')
};

// Ordem das listas. O id no fim desempata, para a paginação não repetir nem pular ninguém.
function ordenar(q: Livre, ordem: Ordem) {
  if (ordem === 'manual') q = q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('nome');
  else if (ordem === 'nome_desc') q = q.order('nome', { ascending: false });
  else if (ordem === 'novos') q = q.order('criado_em', { ascending: false });
  else if (ordem === 'antigos') q = q.order('criado_em', { ascending: true });
  else if (ordem === 'recentes') q = q.order('atualizado_em', { ascending: false });
  else q = q.order('nome');
  return q.order('id');
}

// Texto de busca: só dígitos quando a pessoa digita CPF/telefone; sem acentos no resto.
function termoBusca(texto?: string) {
  const t = String(texto || '').trim();
  if (!t) return '';
  const cnpj = cnpjComLetrasNaBusca(t);
  if (cnpj) return cnpj;
  if (/\d/.test(t) && /^[\d\s.\-/()+]+$/.test(t)) return t.replace(/\D/g, '');
  return normal(t).replace(/[%_\\]/g, m => '\\' + m);
}
/** A tabela que liga os cartões de cada módulo às etiquetas, e a coluna do cartão nela. */
const ETIQUETAS_DO_MODULO: Record<ModuloComEtiquetas, { tabela: string; coluna: string }> = {
  pessoas: { tabela: 'pessoa_etiquetas', coluna: 'pessoa_id' },
  contratos: { tabela: 'contrato_etiquetas', coluna: 'contrato_id' },
  demandas: { tabela: 'demanda_etiquetas', coluna: 'demanda_id' },
  tarefas: { tabela: 'tarefa_etiquetas', coluna: 'tarefa_id' },
  processos: { tabela: 'processo_etiquetas', coluna: 'processo_id' },
  compromissos: { tabela: 'compromisso_etiquetas', coluna: 'compromisso_id' }
};
/** Os campos da lista mais as etiquetas do item; filtrando por uma etiqueta, só vêm os itens que a têm (ligação !inner, com outro nome, para o item continuar trazendo todas). */
function comEtiquetas(campos: string, modulo: ModuloComEtiquetas, f: { etiqueta?: string }) {
  const { tabela } = ETIQUETAS_DO_MODULO[modulo];
  return `${campos}, etq:${tabela}(etiqueta_id)` + (f.etiqueta ? `, filtro_etq:${tabela}!inner(etiqueta_id)` : '');
}
const porEtiqueta = (q: Livre, f: { etiqueta?: string }) => f.etiqueta ? q.eq('filtro_etq.etiqueta_id', f.etiqueta) : q;

function filtrar(q: Livre, f: FiltroPessoas = {}) {
  q = porEtiqueta(q, f);
  q = f.situacao === 'arquivadas' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
  if (f.tipo) q = q.eq('tipo', f.tipo);
  if (f.responsavel) q = q.eq('filtro.perfil_id', f.responsavel);
  if (f.marca) q = MARCAS[f.marca](q);
  const t = termoBusca(f.termo);
  if (t) q = q.ilike('busca', `%${t}%`);
  return q;
}
const selecao =(f: FiltroPessoas) => comEtiquetas(CAMPOS_LISTA + (f.responsavel ? ', filtro:pessoa_responsaveis!inner(perfil_id)' : ''), 'pessoas', f);

async function sincronizarResponsaveis(pessoaId: string, responsaveis?: string[]) {
  if (!Array.isArray(responsaveis)) return;
  const { data: atuais } = await rodar(sb.from('pessoa_responsaveis').select('perfil_id').eq('pessoa_id', pessoaId));
  const ja = new Set<string>(atuais.map((r: { perfil_id: string }) => r.perfil_id)), quer = new Set(responsaveis);
  const incluir = [...quer].filter(id => !ja.has(id)).map(perfil_id => ({ pessoa_id: pessoaId, perfil_id }));
  const tirar = [...ja].filter(id => !quer.has(id));
  if (incluir.length) await rodar(sb.from('pessoa_responsaveis').insert(incluir));
  if (tirar.length) await rodar(sb.from('pessoa_responsaveis').delete().eq('pessoa_id', pessoaId).in('perfil_id', tirar));
}

const rpc = (nome: string, args?: Record<string, unknown>) => rodar(sb.rpc(nome, args)).then(r => r.data);

// ---------- comentários ----------
const CAMPOS_COMENTARIO = 'id, autor_id, texto, mencoes, criado_em, editado_em';
/** A coluna da tabela comentarios que diz de qual cartão é o comentário, em cada módulo. */
const CARTAO_DO_COMENTARIO: Record<ModuloComentado, string> = { pessoas: 'pessoa_id', contratos: 'contrato_id', demandas: 'demanda_id', tarefas: 'tarefa_id', compromissos: 'compromisso_id' };

// ---------- contratos ----------
const PESSOA_RESUMIDA = 'id, codigo, nome, tipo, arquivado_em';
const CAMPOS_CONTRATO_LISTA = 'id, codigo, codigo_antigo, servico, categoria, valor, responsavel_id, etapa_id, etapa_ordem, arquivado_em, '
  + 'criado_por, criado_em, atualizado_em, cliente_nome';
const CAMPOS_CONTRATO = 'id, codigo, numero, sigla, ano, codigo_antigo, cliente_id, cliente_nome, responsavel_id, objetos, servico, categoria, valor, entrada, parcelas, '
  + 'descontos, assinado_em, primeiro_pagamento, percentual_escritorio, indicador_id, indicador_percentual, '
  + 'documento_url, observacoes, etapa_id, etapa_ordem, arquivado_em, arquivado_por, criado_por, criado_em, atualizado_por, atualizado_em, '
  + `indicador:pessoas!contratos_indicador_id_fkey(${PESSOA_RESUMIDA}), clientela:contrato_clientes(ordem, pessoa:pessoas(${PESSOA_RESUMIDA})), `
  + `participacoes:contrato_participantes(percentual, ordem, pessoa:pessoas(${PESSOA_RESUMIDA}))`;
/** Clientes e participantes do contrato na ordem do cadastro (o banco os copia das listas gravadas no contrato). */
type ContratoLido = Omit<Contrato, 'clientes' | 'participantes'> & {
  clientela: { ordem: number; pessoa: PessoaResumida }[]; participacoes: (Participacao & { ordem: number })[];
};
const comParticipantes = ({ clientela, participacoes, ...k }: ContratoLido): Contrato => ({ ...k,
  clientes: clientela.toSorted((a, b) => a.ordem - b.ordem).map(c => c.pessoa),
  participantes: participacoes.toSorted((a, b) => a.ordem - b.ordem).map(({ pessoa, percentual }) => ({ pessoa, percentual })) });
// Ordem dos contratos ("nome" é o do cliente, copiado no contrato pelo banco). O id no fim desempata a paginação.
const ORDENS_CONTRATO: Record<Ordem, (q: Livre) => Livre> = {
  manual: q => q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('numero', { ascending: false }),
  nome: q => q.order('cliente_nome').order('numero', { ascending: false }),
  nome_desc: q => q.order('cliente_nome', { ascending: false }).order('numero', { ascending: false }),
  novos: q => q.order('criado_em', { ascending: false }),
  antigos: q => q.order('criado_em', { ascending: true }),
  recentes: q => q.order('atualizado_em', { ascending: false })
};
const ordenarContratos = (q: Livre, ordem: Ordem) => ORDENS_CONTRATO[ordem](q).order('id');
function filtrarContratos(q: Livre, f: FiltroContratos = {}) {
  q = porEtiqueta(q, f);
  q = f.situacao === 'arquivados' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
  if (f.responsavel) q = q.eq('responsavel_id', f.responsavel);
  if (f.categoria) q = q.eq('categoria', f.categoria);
  const t = termoBusca(f.termo);
  if (t) q = q.ilike('busca', `%${t}%`);
  return q;
}

// ---------- demandas ----------
const CAMPOS_DEMANDA_LISTA = 'id, codigo, titulo, prazo, responsavel_id, colaboradores, cliente_nome, contrato_codigo, etapa_id, etapa_ordem, '
  + 'arquivado_em, criado_por, criado_em, atualizado_em';
// O contrato vem pela regra de leitura dos contratos: quem não pode abri-lo recebe null (e fica só o número).
const CAMPOS_DEMANDA = 'id, codigo, titulo, descricao, prazo, responsavel_id, colaboradores, cliente_nome, contrato_id, contrato_codigo, objeto, '
  + 'etapa_id, etapa_ordem, arquivado_em, arquivado_por, criado_por, criado_em, atualizado_por, atualizado_em, '
  + `clientela:demanda_clientes(ordem, pessoa:pessoas(${PESSOA_RESUMIDA})), contrato:contratos(id, codigo, servico)`;
type DemandaLida = Omit<Demanda, 'clientes'> & { clientela: { ordem: number; pessoa: PessoaResumida }[] };
const comClientes = ({ clientela, ...d }: DemandaLida): Demanda => ({ ...d, clientes: clientela.toSorted((a, b) => a.ordem - b.ordem).map(c => c.pessoa) });
// Ordem das demandas e das tarefas ("nome" é o título). O id no fim desempata a paginação.
const ORDENS_PELO_TITULO: Record<Ordem, (q: Livre) => Livre> = {
  manual: q => q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('criado_em', { ascending: false }),
  nome: q => q.order('titulo'),
  nome_desc: q => q.order('titulo', { ascending: false }),
  novos: q => q.order('criado_em', { ascending: false }),
  antigos: q => q.order('criado_em', { ascending: true }),
  recentes: q => q.order('atualizado_em', { ascending: false })
};
const ordenarPeloTitulo = (q: Livre, ordem: Ordem) => ORDENS_PELO_TITULO[ordem](q).order('id');
function filtrarDemandas(q: Livre, f: FiltroDemandas = {}) {
  q = porEtiqueta(q, f);
  q = f.situacao === 'arquivadas' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
  if (f.pessoa) q = q.or(`responsavel_id.eq.${f.pessoa},colaboradores.cs.{${f.pessoa}}`);
  const t = termoBusca(f.termo);
  if (t) q = q.ilike('busca', `%${t}%`);
  return q;
}
// ---------- compromissos ----------
/** Quem só lê a Agenda geral não muda: o banco devolve zero linhas, sem erro. Sem isto, a tela diria que mudou. */
const NAO_MUDOU = 'Você não tem permissão para fazer isso.';
const CAMPOS_COMPROMISSO_LISTA = 'id, codigo, tipo, titulo, data, hora, hora_fim, modalidade, local, geral, responsavel_id, participantes, pessoa_nome, processo_id, processo_codigo, processo_numero, '
  + 'etapa_id, etapa_ordem, arquivado_em, criado_por, criado_em, atualizado_em';
// O processo vem pelas regras de leitura dele: quem não pode abri-lo recebe null (e fica só o código e o número).
const CAMPOS_COMPROMISSO = 'id, codigo, tipo, titulo, data, hora, hora_fim, modalidade, local, resultado, observacoes, geral, responsavel_id, participantes, pessoa_nome, processo_id, processo_codigo, processo_numero, '
  + 'etapa_id, etapa_ordem, arquivado_em, arquivado_por, criado_por, criado_em, atualizado_por, atualizado_em, '
  + `ligadas:compromisso_pessoas(ordem, pessoa:pessoas(${PESSOA_RESUMIDA})), processo:processos(id, codigo, tipo, numero, titulo, cliente_nome, criado_por, responsavel_id, colaboradores)`;
const CAMPOS_COMPROMISSO_LIGADO = 'id, codigo, tipo, titulo, data, hora, hora_fim, pessoa_nome, processo_numero, etapa_id, arquivado_em, pessoas, responsavel_id, participantes';
type CompromissoLido = Omit<Compromisso, 'pessoas'> & { ligadas: { ordem: number; pessoa: PessoaResumida }[] };
const compromissoComPessoas = ({ ligadas, ...c }: CompromissoLido): Compromisso => ({ ...c, pessoas: ligadas.toSorted((a, b) => a.ordem - b.ordem).map(l => l.pessoa) });
// Na ordem "nome", vale o nome do cartão ou, sem ele, as pessoas (a coluna nome_ordem). O id no fim desempata a paginação.
const ORDENS_COMPROMISSO: Record<OrdemCompromisso, (q: Livre) => Livre> = {
  data: q => q.order('data').order('hora', { nullsFirst: true }),
  data_desc: q => q.order('data', { ascending: false }).order('hora', { ascending: false, nullsFirst: false }),
  manual: q => q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('criado_em', { ascending: false }),
  nome: q => q.order('nome_ordem'),
  nome_desc: q => q.order('nome_ordem', { ascending: false }),
  novos: q => q.order('criado_em', { ascending: false }),
  antigos: q => q.order('criado_em', { ascending: true }),
  recentes: q => q.order('atualizado_em', { ascending: false })
};
const ordenarCompromissos = (q: Livre, ordem: OrdemCompromisso) => ORDENS_COMPROMISSO[ordem](q).order('id');
function filtrarCompromissos(q: Livre, f: FiltroCompromissos) {
  q = porEtiqueta(q, f);
  q = f.situacao === 'arquivados' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
  if (f.pessoa) q = q.or(`responsavel_id.eq.${f.pessoa},participantes.cs.{${f.pessoa}}`);
  if (f.tipo) q = q.eq('tipo', f.tipo);
  const t = termoBusca(f.termo);
  if (t) q = q.ilike('busca', `%${t}%`);
  return q;
}

// ---------- andamentos e prazos do processo ----------
const CAMPOS_ANDAMENTO = 'id, processo_id, tipo, data, hora, local, texto, tratada_em, tarefa_id, criado_por, criado_em, atualizado_em, tarefa:tarefas(id, codigo)';
const CAMPOS_PRAZO = 'id, processo_id, descricao, final, intimacao, dias, contagem, disponibilizacao, sem_recesso, andamento_id, tarefa_id, concluido_em, '
  + 'criado_por, criado_em, atualizado_em, tarefa:tarefas(id, codigo)';
/** O banco devolve a hora com os segundos ("14:30:00"); a tela e o formulário usam hh:mm. */
const andamentoLido = (a: AndamentoDeProcesso): AndamentoDeProcesso => ({ ...a, hora: a.hora?.slice(0, 5) ?? null });
/** Nenhuma linha mudou: o processo foi arquivado, ou o item já não existe. */
const SEM_MUDANCA = 'Não foi possível: o processo pode ter sido arquivado, ou isto já foi excluído. Abra o cartão de novo.';
const primeira = <T,>(linha: T | null): T => { if (!linha) throw new Error(SEM_MUDANCA); return linha; };

// ---------- caixa ----------
const CAMPOS_DA_CONTA = 'id, nome, tem_das, saldo_inicial, saldo_inicial_em, arquivada_em';
const CAMPOS_DO_LANCAMENTO = 'id, conta_id, data, tipo, categoria, valor, descricao, par_id, origem, criado_por, criado_em, atualizado_em';
const CAMPOS_DA_PARCELA = 'id, contrato_id, numero, vencimento, valor, recebimento_id, recebida_em, recebido';
const CAMPOS_DA_PARCELA_DO_ESCRITORIO = CAMPOS_DA_PARCELA + ', contrato:contratos!inner(codigo, cliente_nome, responsavel_id, arquivado_em)';
const CAMPOS_DO_RECEBIMENTO = 'id, parcela_id, contrato_id, conta_id, data, valor, taxa_maquina, aliquota_das, parte_na_conta, responsavel_socio, na_conta, ficou_com_advogado, das, liquido, escritorio, responsavel_recebe, responsavel_fica, escritorio_final, contribuicao_socio, terceiros, socio_indicador';
const CAMPOS_DO_REPASSE = 'id, recebimento_id, tipo, nome, descricao, valor, conta_sugerida, conta_paga, pago_em, criado_em';
const CAMPOS_DO_SOCIO = 'id, pessoa_id, desde, ate, pessoa:pessoas(nome)';
type LinhaDaParcela = Parcela & { contrato: { codigo: string; cliente_nome: string; responsavel_id: string | null; arquivado_em: string | null } };
const parcelaDoEscritorio = ({ contrato, ...p }: LinhaDaParcela): ParcelaDoEscritorio => ({ ...p, contrato_codigo: contrato.codigo, cliente_nome: contrato.cliente_nome, responsavel_id: contrato.responsavel_id });
/** O contrato arquivado sai das listas, mas o que já foi recebido continua contando. */
const naLista = (p: LinhaDaParcela) => !!p.recebimento_id || !p.contrato.arquivado_em;
type LinhaDoSocio = Omit<Socio, 'nome'> & { pessoa: { nome: string } | null };
const socioLido = ({ pessoa, ...s }: LinhaDoSocio): Socio => ({ ...s, nome: pessoa?.nome ?? 'Pessoa excluída' });
/** Nenhuma linha mudou: a pessoa não é mais administradora, ou o item não existe mais. */
const naoEsta = (linha: unknown) => { if (!linha) throw new Error('Não foi possível: atualize a página e confira.'); };

// ---------- processos ----------
const CAMPOS_PROCESSO_LISTA = 'id, codigo, tipo, numero, titulo, responsavel_id, colaboradores, cliente_nome, orgao, comarca, vara, etapa_id, etapa_ordem, '
  + 'arquivado_em, criado_por, criado_em, atualizado_em';
const CAMPOS_PROCESSO = 'id, codigo, tipo, numero, titulo, responsavel_id, colaboradores, cliente_nome, orgao, sistema, polo, area, meio, natureza, gratuidade, comarca, vara, '
  + 'classe, assunto, juiz, distribuicao, valor_causa, instancia, segredo, advogado_contrario, observacoes, campos, etapa_id, etapa_ordem, arquivado_em, arquivado_por, '
  + `criado_por, criado_em, atualizado_por, atualizado_em, clientela:processo_clientes(ordem, pessoa:pessoas(${PESSOA_RESUMIDA}))`;
type ProcessoLido = Omit<Processo, 'clientes'> & { clientela: { ordem: number; pessoa: PessoaResumida }[] };
const processoComClientes = ({ clientela, ...p }: ProcessoLido): Processo => ({ ...p, clientes: clientela.toSorted((a, b) => a.ordem - b.ordem).map(c => c.pessoa) });
// Na ordem "nome", vale o nome do cartão ou, sem ele, os clientes (a coluna nome_ordem). O id no fim desempata a paginação.
const ORDENS_PROCESSO: Record<Ordem, (q: Livre) => Livre> = {
  manual: q => q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('criado_em', { ascending: false }),
  nome: q => q.order('nome_ordem'),
  nome_desc: q => q.order('nome_ordem', { ascending: false }),
  novos: q => q.order('criado_em', { ascending: false }),
  antigos: q => q.order('criado_em', { ascending: true }),
  recentes: q => q.order('atualizado_em', { ascending: false })
};
const ordenarProcessos = (q: Livre, ordem: Ordem) => ORDENS_PROCESSO[ordem](q).order('id');
/** A coluna vem do endereço: um valor que não é identificador (link cortado) não acha nada, em vez de dar erro no banco. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function filtrarProcessos(q: Livre, f: FiltroProcessos) {
  q = porEtiqueta(q, f).eq('tipo', f.tipo);
  q = f.situacao === 'arquivados' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
  if (f.pessoa) q = q.or(`responsavel_id.eq.${f.pessoa},colaboradores.cs.{${f.pessoa}}`);
  if (f.orgao) q = q.eq('orgao', f.orgao);
  if (f.etapa) q = f.etapa === SEM_FASE ? q.is('etapa_id', null) : UUID.test(f.etapa) ? q.eq('etapa_id', f.etapa) : q.in('id', []);
  const t = termoBusca(f.termo);
  if (t) q = q.ilike('busca', `%${t}%`);
  return q;
}
const CAMPOS_DO_CAMPO = 'id, nome, tipo, aparece_em, opcoes, apagado_em';
/** Os valores diferentes de um campo, em ordem. */
const semRepetir = (linhas: Record<string, string | null>[], campo: string) => [...new Set(linhas.map(l => l[campo]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

// ---------- tarefas ----------
const CAMPOS_TAREFA_LISTA = 'id, codigo, titulo, prazo, responsavel_id, participantes, pessoa_nome, demanda_codigo, contrato_codigo, '
  + 'etapa_id, etapa_ordem, arquivado_em, criado_por, criado_em, atualizado_em';
// A demanda e o contrato vêm pelas regras de leitura deles: quem não pode abri-los recebe null (e fica só o código).
const CAMPOS_TAREFA = 'id, codigo, titulo, descricao, prazo, responsavel_id, participantes, pessoa_nome, demanda_id, demanda_codigo, '
  + 'contrato_id, contrato_codigo, processo_id, etapa_id, etapa_ordem, arquivado_em, arquivado_por, criado_por, criado_em, atualizado_por, atualizado_em, concluida_em, '
  + `ligadas:tarefa_pessoas(ordem, pessoa:pessoas(${PESSOA_RESUMIDA})), `
  + 'demanda:demandas(id, codigo, titulo, etapa_id, criado_por, responsavel_id, colaboradores), contrato:contratos(id, codigo, servico), processo:processos!tarefas_processo_id_fkey(id, codigo, tipo, numero)';
type TarefaLida = Omit<Tarefa, 'pessoas'> & { ligadas: { ordem: number; pessoa: PessoaResumida }[] };
const comPessoas = ({ ligadas, ...t }: TarefaLida): Tarefa => ({ ...t, pessoas: ligadas.toSorted((a, b) => a.ordem - b.ordem).map(l => l.pessoa) });
function filtrarTarefas(q: Livre, f: FiltroTarefas = {}) {
  q = porEtiqueta(q, f);
  q = f.situacao === 'arquivadas' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
  if (f.pessoa) q = q.or(`responsavel_id.eq.${f.pessoa},participantes.cs.{${f.pessoa}}`);
  const t = termoBusca(f.termo);
  if (t) q = q.ilike('busca', `%${t}%`);
  return q;
}
type TarefaParaLigar = Pick<Tarefa, 'id' | 'codigo' | 'titulo' | 'prazo' | 'etapa_id' | 'arquivado_em' | 'criado_em' | 'responsavel_id' | 'participantes'>
  & { pessoas: string[] };
const CAMPOS_TAREFA_LIGADA = 'id, codigo, titulo, prazo, etapa_id, arquivado_em, criado_em, responsavel_id, participantes, pessoas';
const tarefaLigada = (pessoaId: string, perfilId: string | null) => ({ pessoas, responsavel_id, participantes, ...t }: TarefaParaLigar): TarefaLigada =>
  ({ ...t, papeis: pessoaId ? papeisNaTarefa({ pessoas, responsavel_id, participantes }, pessoaId, perfilId) : [] });
// Na ordem do quadro (como as demandas do contrato).
const naOrdemDoQuadro = (q: Livre) => q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('criado_em').limit(TAREFAS_LIGADAS);

const CAMPOS_MODELO = 'id, nome, itens, criado_por, atualizado_em';
const CAMPOS_ORGAO = 'id, sigla, nome, contagem_padrao, recesso, praxe, justica_federal';
const CAMPOS_DIA = 'id, data, motivo, tipo, orgao_id';
const CAMPOS_GRUPO = 'id, nome, ordem, comeca_fechado';
const CAMPOS_ETIQUETA = 'id, cor, texto, criado_por, sistema';
/** Nenhuma linha mudou: quem não é administrador só muda as etiquetas que criou; para o administrador, outro já tinha excluído. */
const conferirDonoDaEtiqueta = (linhas: unknown[]) => {
  if (!linhas.length && ctx && !ctx.ehAdmin) throw new Error('Só quem criou a etiqueta ou um administrador pode mudá-la.');
};
/** Nenhuma linha mudou: quem não é administrador não pode mudar; para o administrador, outro já tinha excluído o grupo. */
const conferirAdminNosGrupos = (linhas: unknown[]) => {
  if (!linhas.length && ctx && !ctx.ehAdmin) throw new Error('Só os administradores mudam os grupos de colunas.');
};
/** Nenhuma linha mudou: quem não é administrador não pode mudar; para o administrador, outro já tinha excluído (a tela só recarrega). */
const conferirAdminNoCalendario = (linhas: unknown[]) => {
  if (!linhas.length && ctx && !ctx.ehAdmin) throw new Error('Só os administradores mudam o calendário.');
};
const CAMPOS_TEMPO = 'id, perfil_id, inicio, segundos, ajuste, motivo';
const CAMPOS_LISTA_CARTAO = 'id, nome, ordem', CAMPOS_ITEM_LISTA = 'id, texto, prazo, feito_em, feito_por, ordem';
const CAMPOS_PERFIL_PROFISSIONAL = 'perfil_id, nome_exibicao, cargo, oab, areas, bio_curta, biografia, formacao, idiomas, experiencia, associacoes, '
  + 'publicacoes, lattes, email_publico, telefone_publico, linkedin, redes, no_site, ordem_no_site, atualizado_em';
/** A coluna de demanda_listas que liga a lista ao cartão dela. */
const DONO_DA_LISTA: Record<CartaoComListas, 'demanda_id' | 'tarefa_id'> = { demandas: 'demanda_id', tarefas: 'tarefa_id' };
type DemandaParaLigar = Pick<Demanda, 'id' | 'codigo' | 'titulo' | 'prazo' | 'etapa_id' | 'arquivado_em' | 'criado_em' | 'responsavel_id' | 'colaboradores'>
  & { clientes: string[] };
const CAMPOS_DEMANDA_LIGADA = 'id, codigo, titulo, prazo, etapa_id, arquivado_em, criado_em, responsavel_id, colaboradores, clientes';
const ligada = (pessoaId: string, perfilId: string | null) => ({ clientes, responsavel_id, colaboradores, ...d }: DemandaParaLigar): DemandaLigada =>
  ({ ...d, papeis: papeisNaDemanda({ clientes, responsavel_id, colaboradores }, pessoaId, perfilId) });

export const SD: Dados = {
  // ---------- sessão ----------
  async sessao() { const { data } = await sb.auth.getSession(); return data.session; },
  async entrar(email, senha) { await rodar(sb.auth.signInWithPassword({ email: email.trim(), password: senha })); ctx = null; },
  // O código do convite vai nos dados do cadastro; o banco só cria a conta se ele bater com o do convite.
  async primeiroAcesso(email, senha, voltarPara, codigo) {
    const { data } = await rodar(sb.auth.signUp({ email: email.trim().toLowerCase(), password: senha, options: { emailRedirectTo: voltarPara, data: { convite: codigo } } }));
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Este e-mail já tem conta. Use "Entrar" ou recupere a senha.');
    }
    return { entrou: !!data.session };
  },
  async recuperarSenha(email, voltarPara) { await rodar(sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: voltarPara })); },
  // Os e-mails trazem só um código de uso único (token_hash), não a chave de acesso: ele é trocado aqui pela sessão.
  async confirmarLink(codigo, tipo) {
    const { data } = await rodar(sb.auth.verifyOtp({ token_hash: codigo, type: tipo }));
    ctx = null;
    return { comSessao: !!data.session };
  },
  async contaEmail() {
    const { data } = await rodar(sb.auth.getUser());
    return { atual: data.user?.email ?? '', pendente: data.user?.new_email ?? null };
  },
  async trocarEmail(novo) {
    const { data } = await rodar(sb.auth.updateUser({ email: normalizarEmail(novo) }));
    // Pendente, nada do contexto muda. Esquecê-lo aqui faria falhar o que depende de quem está logado, até recarregar a página.
    if (!data.user?.new_email) ctx = null;
    return { atual: data.user?.email ?? '', pendente: data.user?.new_email ?? null };
  },
  async novaSenha(senha) { await rodar(sb.auth.updateUser({ password: senha })); },
  async sair() { ctx = null; await sb.auth.signOut(); },
  async sessaoEncerrada() { const { error } = await sb.auth.getUser(); return isAuthSessionMissingError(error); },
  aoMudarSessao(cb) {
    const { data } = sb.auth.onAuthStateChange(evento => cb(evento));
    return () => data.subscription.unsubscribe();
  },

  // ---------- verificação em duas etapas (aplicativo autenticador, TOTP) ----------
  async duasEtapasFatores() {
    const { data } = await rodar(sb.auth.mfa.listFactors());
    return (data.all || []).filter((f: Livre) => f.factor_type === 'totp')
      .map((f: Livre) => ({ id: f.id, ativo: f.status === 'verified', criado_em: f.created_at }));
  },
  async duasEtapasIniciar() {
    // Uma ativação começada e não confirmada impediria a nova: sai antes.
    const { data: l } = await rodar(sb.auth.mfa.listFactors());
    for (const f of (l.all || []).filter((x: Livre) => x.factor_type === 'totp' && x.status !== 'verified')) {
      await rodar(sb.auth.mfa.unenroll({ factorId: f.id }));
    }
    const { data } = await rodar(sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'SEMPER ' + new Date().toISOString().slice(0, 16) }));
    return { id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
  },
  async duasEtapasConfirmar(id, codigo) { await rodar(sb.auth.mfa.challengeAndVerify({ factorId: id, code: codigo })); ctx = null; },
  async duasEtapasDesativar(id) { await rodar(sb.auth.mfa.unenroll({ factorId: id })); ctx = null; },
  async duasEtapasPendente() {
    try {
      const { data } = await rodar(sb.auth.mfa.getAuthenticatorAssuranceLevel());
      return data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
    } catch { return false; }
  },
  async duasEtapasEntrar(codigo) {
    const { data } = await rodar(sb.auth.mfa.listFactors());
    const f = (data.totp || [])[0];
    if (!f) throw new Error('Nenhum aplicativo autenticador ativo nesta conta.');
    await rodar(sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: codigo }));
    ctx = null;
  },

  // Quem está logado: perfil, escritório e equipe. null se não houver sessão.
  async contexto(forcar = false) {
    if (ctx && !forcar) return ctx;
    const s = await SD.sessao();
    if (!s) return null;
    const { data: perfil } = await rodar(sb.from('perfis')
      .select('id, escritorio_id, pessoa_id, nome, usuario, papel, funcao, ativo, cor, oab, preferencias').eq('id', s.user.id).maybeSingle());
    if (!perfil) return { usuario: s.user, perfil: null, equipe: [], ehAdmin: false, ehMaster: false };
    const [{ data: escritorio }, { data: equipe }] = await Promise.all([
      rodar(sb.from('escritorios').select('id, slug, modulos, nome, logo, cnpj, oab_registro, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, email, site')
        .eq('id', perfil.escritorio_id).maybeSingle()),
      rodar(sb.from('perfis').select('id, nome, usuario, papel, funcao, ativo, cor, pessoa_id, perfil_profissional(foto_em)').order('nome'))
    ]);
    // A foto pequena de quem tem foto, para as bolinhas (um pedido só para a equipe toda).
    const membros = (equipe || []) as (Membro & { perfil_profissional: { foto_em: string | null } | { foto_em: string | null }[] | null })[];
    const fotoEm = (m: typeof membros[number]) => [m.perfil_profissional].flat()[0]?.foto_em ?? null;
    const comFoto = membros.filter(fotoEm);
    const links = await linksDasFotos(comFoto.map(m => caminhoDaFoto(perfil.escritorio_id, m.id, FOTO_PEQUENA))).catch(() => []);
    const fotoDe = new Map(comFoto.map((m, i) => [m.id, links[i] ?? null]));
    ctx = {
      usuario: s.user, perfil, escritorio, equipe: membros.map(({ perfil_profissional: _p, ...m }) => ({ ...m, foto: fotoDe.get(m.id) ?? null })),
      ehAdmin: ['master', 'admin'].includes(perfil.papel), ehMaster: perfil.papel === 'master'
    };
    return ctx;
  },

  async salvarPerfil(campos) {
    await rodar(sb.from('perfis').update(campos).eq('id', uid()));
    if (ctx?.perfil) Object.assign(ctx.perfil, campos);
  },
  async salvarPreferencia(chave, valor) {
    if (!ctx?.perfil) return;
    const preferencias = { ...ctx.perfil.preferencias, [chave]: valor };
    ctx.perfil.preferencias = preferencias;
    try { await sb.from('perfis').update({ preferencias }).eq('id', uid()); } catch { /* preferência não é crítica */ }
  },

  // ---------- pessoas ----------
  async pessoasListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    let q = filtrar(sb.from('pessoas').select(selecao(f), { count: 'exact' }), f);
    q = ordenar(q, f.ordem && f.ordem !== 'manual' ? f.ordem : 'nome');
    const { data, count } = await rodar(q.range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  },

  // Exportação: todas as pessoas do filtro, com o cadastro completo, em lotes de 1.000 (o máximo de uma consulta).
  async pessoasExportar(f = {}) {
    const lote = 1000, todas: Pessoa[] = [];
    for (let de = 0; ; de += lote) {
      const q = filtrar(sb.from('pessoas').select(comEtiquetas(CAMPOS_PESSOA + (f.responsavel ? ', filtro:pessoa_responsaveis!inner(perfil_id)' : ''), 'pessoas', f)), f);
      const { data } = await rodar(ordenar(q, 'nome').range(de, de + lote - 1));
      todas.push(...data);
      if (data.length < lote) return todas;
    }
  },

  // Cartões de uma coluna do kanban (etapaId null = "Sem etapa").
  async pessoasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    let q = filtrar(sb.from('pessoas').select(selecao(f), { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    q = ordenar(q, f.ordem || 'manual');
    const { data, count } = await rodar(q.range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  },

  async pessoaObter(id) {
    const { data } = await rodar(sb.from('pessoas').select(CAMPOS_PESSOA).eq('id', id).maybeSingle());
    return data;
  },
  async pessoaPorDocumento(documento, excetoId) {
    let q = sb.from('pessoas').select('id, codigo, nome, tipo, arquivado_em').eq('documento', documento);
    if (excetoId) q = q.neq('id', excetoId);
    const { data } = await rodar(q.maybeSingle());
    return data;
  },
  async pessoasPorTelefones(telefones, excetoId) {
    const tels = [...new Set((telefones || []).map(telefoneNormal).filter(t => t.length >= 8))];
    if (!tels.length) return [];
    let q = sb.from('pessoas').select('id, codigo, nome, tipo, telefones').overlaps('telefones_normais', tels).limit(5);
    if (excetoId) q = q.neq('id', excetoId);
    const { data } = await rodar(q);
    return data;
  },

  async pessoaCriar(dados, responsaveis) {
    const { data } = await rodar(sb.from('pessoas').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    await sincronizarResponsaveis(data.id, responsaveis);
    return data;
  },
  async pessoaAtualizar(id, dados, responsaveis) {
    const { data } = await rodar(sb.from('pessoas').update(dados).eq('id', id).select('id, codigo').single());
    await sincronizarResponsaveis(id, responsaveis);
    return data;
  },
  async pessoasArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('pessoas')
      .update({ arquivado_em: arquivar ? new Date().toISOString() : null, arquivado_por: arquivar ? uid() : null })
      .in('id', ids).select('id'));
    return data.length;
  },
  // Exclui uma a uma: se alguma não puder (ex.: é usuária do sistema), as outras seguem.
  async pessoasExcluir(ids) {
    const r = await Promise.allSettled(ids.map(id => rodar(sb.from('pessoas').delete().eq('id', id).select('id'))));
    const excluidas = r.filter(x => x.status === 'fulfilled' && x.value.data.length).length;
    const falha = r.find(x => x.status === 'rejected') as PromiseRejectedResult | undefined;
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: falha ? (falha.reason as Error).message : '' };
  },
  async pessoaMover(id, etapaId, ordem) {
    await rodar(sb.from('pessoas').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id));
  },
  async pessoaHistorico(id) {
    const { data } = await rodar(sb.from('pessoa_historico').select('id, alteracoes, feito_por, em')
      .eq('pessoa_id', id).order('em', { ascending: false }).limit(100));
    return data;
  },
  async responsavelIncluir(pessoaId, perfilId) { await rodar(sb.from('pessoa_responsaveis').insert({ pessoa_id: pessoaId, perfil_id: perfilId })); },
  async responsavelRemover(pessoaId, perfilId) { await rodar(sb.from('pessoa_responsaveis').delete().eq('pessoa_id', pessoaId).eq('perfil_id', perfilId)); },

  async pessoasResumo() {
    const conta = (q: PromiseLike<Resposta>) => rodar(q).then(r => r.count || 0);
    const base = () => sb.from('pessoas').select('id', { count: 'exact', head: true });
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const [total, minhas, mes, arquivadas, { data: recentes }] = await Promise.all([
      conta(base().is('arquivado_em', null)),
      conta(sb.from('pessoas').select('id, filtro:pessoa_responsaveis!inner(perfil_id)', { count: 'exact', head: true })
        .is('arquivado_em', null).eq('filtro.perfil_id', uid())),
      conta(base().is('arquivado_em', null).gte('criado_em', inicioMes.toISOString())),
      conta(base().not('arquivado_em', 'is', null)),
      rodar(sb.from('pessoas').select(CAMPOS_LISTA).is('arquivado_em', null).order('atualizado_em', { ascending: false }).limit(6))
    ]);
    return { total, minhas, mes, arquivadas, recentes };
  },

  // ---------- importação de pessoas (supabase/migrations/20261031200000_importar_pessoas.sql) ----------
  // Os CPF/CNPJ e as referências vão no corpo do pedido (POST), não no endereço; em partes, porque cada consulta
  // devolve no máximo 1.000 linhas (cada chave acha no máximo um cadastro).
  async pessoasParaImportar({ documentos, referencias }) {
    const achadas = new Map<string, Pessoa>();
    const partes: [string[], string[]][] = [];
    for (let i = 0; i < documentos.length; i += CHAVES_POR_CONSULTA) partes.push([documentos.slice(i, i + CHAVES_POR_CONSULTA), []]);
    for (let i = 0; i < referencias.length; i += CHAVES_POR_CONSULTA) partes.push([[], referencias.slice(i, i + CHAVES_POR_CONSULTA)]);
    for (const [docs, refs] of partes) {
      const { data } = await rodar(sb.rpc('pessoas_para_importar', { p_documentos: docs, p_referencias: refs }).select(CAMPOS_PESSOA));
      for (const p of data as Pessoa[]) achadas.set(p.id, p);
    }
    return [...achadas.values()];
  },
  importacaoIniciar: (descricao, arquivo) => rpc('importacao_iniciar', { p_descricao: descricao, p_arquivo: arquivo }),
  pessoasImportar: (importacaoId, lote) => rpc('pessoas_importar', { p_importacao: importacaoId, p_lote: lote }),
  importacaoConcluir: (importacaoId, completadas) => rpc('importacao_concluir', { p_importacao: importacaoId, p_completadas: completadas }),

  // ---------- informações sigilosas (só por funções do banco, que registram cada leitura) ----------
  sigilosListar: pessoaId => rpc('sigilos_listar', { p_pessoa: pessoaId }),
  sigiloSalvar: (pessoaId, texto, id = null) => rpc('sigilo_salvar', { p_pessoa: pessoaId, p_texto: texto, p_id: id }),
  sigiloApagar: id => rpc('sigilo_apagar', { p_id: id }),
  sigiloAcessos: pessoaId => rpc('sigilo_acessos', { p_pessoa: pessoaId }),
  sigiloConceder: (pessoaId, perfilId, conceder = true) => rpc('sigilo_conceder', { p_pessoa: pessoaId, p_perfil: perfilId, p_conceder: conceder }),

  // ---------- vínculos entre pessoas ----------
  async vinculoTiposListar() {
    const { data } = await rodar(sb.from('vinculo_tipos').select('id, escritorio_id, nome, inverso, ordem').order('ordem').order('nome'));
    return data;
  },
  async vinculoTipoCriar(nome, inverso) {
    const { data } = await rodar(sb.from('vinculo_tipos').insert({ nome: nome.trim(), inverso: (inverso || nome).trim(), criado_por: uid() })
      .select('id, escritorio_id, nome, inverso, ordem').single());
    return data;
  },
  async vinculosListar(pessoaId) {
    const pessoa = 'id, codigo, nome, tipo, arquivado_em';
    const { data } = await rodar(sb.from('pessoa_vinculos')
      .select(`id, pessoa_de, pessoa_para, tipo_id, descricao, criado_por, criado_em,
        de:pessoas!pessoa_vinculos_pessoa_de_fkey(${pessoa}), para:pessoas!pessoa_vinculos_pessoa_para_fkey(${pessoa}),
        tipo:vinculo_tipos!pessoa_vinculos_tipo_id_fkey(id, nome, inverso)`)
      .or(`pessoa_de.eq.${pessoaId},pessoa_para.eq.${pessoaId}`).order('criado_em'));
    return data;
  },
  async vinculoCriar(de, para, tipoId, descricao = null) {
    const { data } = await rodar(sb.from('pessoa_vinculos')
      .insert({ pessoa_de: de, pessoa_para: para, tipo_id: tipoId, descricao: descricao?.trim() || null, criado_por: uid() }).select('id').single());
    return data.id;
  },
  async vinculoApagar(id) { await rodar(sb.from('pessoa_vinculos').delete().eq('id', id)); },
  // Quem representa cada pessoa jurídica: vínculos do tipo "Representante legal de", com o cadastro completo do
  // representante (lado "de"). Em lotes de 150, para a consulta não ficar longa demais.
  async representantesVinculados(pjIds) {
    const ids = [...new Set(pjIds)];
    if (!ids.length) return [];
    const { data: tipos } = await rodar(sb.from('vinculo_tipos').select('id').eq('nome', TIPO_REPRESENTANTE));
    if (!tipos.length) return [];
    const saida: RepresentanteVinculado[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await rodar(sb.from('pessoa_vinculos')
        .select('pessoa_para, descricao, de:pessoas!pessoa_vinculos_pessoa_de_fkey(*)')
        .in('tipo_id', tipos.map((t: { id: string }) => t.id)).in('pessoa_para', ids.slice(i, i + 150)).order('criado_em'));
      for (const v of data) if (v.de) saida.push({ pj_id: v.pessoa_para, pessoa: v.de, funcao: v.descricao });
    }
    return saida;
  },

  // ---------- contratos ----------
  async contratosListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const q = filtrarContratos(sb.from('contratos').select(comEtiquetas(CAMPOS_CONTRATO_LISTA, 'contratos', f), { count: 'exact' }), f);
    const { data, count } = await rodar(ordenarContratos(q, f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos').range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  },
  async contratosDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    let q = filtrarContratos(sb.from('contratos').select(comEtiquetas(CAMPOS_CONTRATO_LISTA, 'contratos', f), { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    const { data, count } = await rodar(ordenarContratos(q, f.ordem || 'manual').range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  },
  async contratoObter(id) {
    const { data } = await rodar(sb.from('contratos').select(CAMPOS_CONTRATO).eq('id', id).maybeSingle());
    return data ? comParticipantes(data) : null;
  },
  // O número (sigla, sequencial e ano) é dado pelo banco ao gravar.
  async contratoCriar(dados) {
    const { data } = await rodar(sb.from('contratos').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    return data;
  },
  async contratoAtualizar(id, dados) {
    const { data } = await rodar(sb.from('contratos').update(dados).eq('id', id).select('id, codigo').single());
    return data;
  },
  async contratosArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('contratos')
      .update({ arquivado_em: arquivar ? new Date().toISOString() : null, arquivado_por: arquivar ? uid() : null })
      .in('id', ids).select('id'));
    return data.length;
  },
  async contratosExcluir(ids) {
    const { data } = await rodar(sb.from('contratos').delete().in('id', ids).select('id'));
    const excluidas = data.length;
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só contratos arquivados podem ser excluídos, por quem os criou ou por um administrador.' : '' };
  },
  async contratoMover(id, etapaId, ordem) {
    await rodar(sb.from('contratos').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id));
  },
  async contratoHistorico(id) {
    const { data } = await rodar(sb.from('contrato_historico').select('id, alteracoes, feito_por, em')
      .eq('contrato_id', id).order('em', { ascending: false }).limit(100));
    return data;
  },
  // Os contratos em que a pessoa aparece: os do indicador e do responsável numa consulta; os de cliente e de
  // participante vêm de contrato_clientes e contrato_participantes (um contrato pode ter vários), e os que faltam são
  // lidos à parte.
  async contratosDaPessoa(pessoaId, perfilId = null) {
    type Linha = { id: string; codigo: string; servico: string; etapa_id: string | null; arquivado_em: string | null; criado_em: string;
      clientes: string[]; responsavel_id: string; indicador_id: string | null; participacoes: { pessoa_id: string }[] };
    const campos = 'id, codigo, servico, etapa_id, arquivado_em, criado_em, clientes, responsavel_id, indicador_id, participacoes:contrato_participantes(pessoa_id)';
    const filtros = [`indicador_id.eq.${pessoaId}`, ...(perfilId ? [`responsavel_id.eq.${perfilId}`] : [])];
    const ligados = (tabela: string) => rodar(sb.from(tabela).select('contrato_id').eq('pessoa_id', pessoaId).limit(CONTRATOS_DA_PESSOA));
    const [diretos, cliente, participa] = await Promise.all([
      rodar(sb.from('contratos').select(campos).or(filtros.join(',')).order('criado_em', { ascending: false }).limit(CONTRATOS_DA_PESSOA)),
      ligados('contrato_clientes'), ligados('contrato_participantes')
    ]);
    const lidos: Linha[] = diretos.data;
    const faltam = [...new Set([...cliente.data, ...participa.data].map((x: { contrato_id: string }) => x.contrato_id))].filter(id => !lidos.some(k => k.id === id));
    const outros: Linha[] = faltam.length ? (await rodar(sb.from('contratos').select(campos).in('id', faltam))).data : [];
    return [...lidos, ...outros]
      .toSorted((a, b) => b.criado_em.localeCompare(a.criado_em))
      .map(({ participacoes, clientes, responsavel_id, indicador_id, ...k }) => ({ ...k,
        papeis: papeisNoContrato({ clientes, responsavel_id, indicador_id, participantes: participacoes.map(p => p.pessoa_id) }, pessoaId, perfilId) }));
  },
  // O banco guarda cada objeto salvo num contrato na lista do escritório (supabase/migrations/20261027000010_contrato_objetos.sql).
  async objetosSugeridos() {
    const { data } = await rodar(sb.from('objeto_sugestoes').select('descricao').order('descricao').limit(OBJETOS_SUGERIDOS));
    return data.map((x: { descricao: string }) => x.descricao);
  },

  // ---------- demandas ----------
  async demandasListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const q = filtrarDemandas(sb.from('demandas').select(comEtiquetas(CAMPOS_DEMANDA_LISTA, 'demandas', f), { count: 'exact' }), f);
    const { data, count } = await rodar(ordenarPeloTitulo(q, f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos').range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  },
  async demandasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    let q = filtrarDemandas(sb.from('demandas').select(comEtiquetas(CAMPOS_DEMANDA_LISTA, 'demandas', f), { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    const { data, count } = await rodar(ordenarPeloTitulo(q, f.ordem || 'manual').range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  },
  async demandaObter(id) {
    const { data } = await rodar(sb.from('demandas').select(CAMPOS_DEMANDA).eq('id', id).maybeSingle());
    return data ? comClientes(data) : null;
  },
  // O código é dado pelo banco ao gravar.
  async demandaCriar(dados) {
    const { data } = await rodar(sb.from('demandas').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    return data;
  },
  async demandaAtualizar(id, dados) {
    const { data } = await rodar(sb.from('demandas').update(dados).eq('id', id).select('id, codigo').single());
    return data;
  },
  async demandasArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('demandas')
      .update({ arquivado_em: arquivar ? new Date().toISOString() : null, arquivado_por: arquivar ? uid() : null })
      .in('id', ids).select('id'));
    return data.length;
  },
  async demandasExcluir(ids) {
    const { data } = await rodar(sb.from('demandas').delete().in('id', ids).select('id'));
    const excluidas = data.length;
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só demandas arquivadas podem ser excluídas, por quem as criou ou por um administrador.' : '' };
  },
  async demandaMover(id, etapaId, ordem) {
    await rodar(sb.from('demandas').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id));
  },
  async demandaHistorico(id) {
    const { data } = await rodar(sb.from('demanda_historico').select('id, alteracoes, feito_por, em')
      .eq('demanda_id', id).order('em', { ascending: false }).limit(100));
    return data;
  },
  // Responsável e colaborador numa consulta (pelo usuário); cliente pela lista de clientes (vem de demanda_clientes).
  async demandasDaPessoa(pessoaId, perfilId = null) {
    const filtros = [`clientes.cs.{${pessoaId}}`, ...(perfilId ? [`responsavel_id.eq.${perfilId}`, `colaboradores.cs.{${perfilId}}`] : [])];
    const { data } = await rodar(sb.from('demandas').select(CAMPOS_DEMANDA_LIGADA).or(filtros.join(','))
      .order('criado_em', { ascending: false }).limit(DEMANDAS_LIGADAS));
    return (data as DemandaParaLigar[]).map(ligada(pessoaId, perfilId));
  },
  async demandasDoContrato(contratoId) {
    const { data } = await rodar(sb.from('demandas').select(CAMPOS_DEMANDA_LIGADA).eq('contrato_id', contratoId)
      .order('etapa_ordem', { ascending: true, nullsFirst: false }).order('criado_em').limit(DEMANDAS_LIGADAS));
    return (data as DemandaParaLigar[]).map(({ clientes: _c, responsavel_id: _r, colaboradores: _o, ...d }) => ({ ...d, papeis: [] }));
  },

  // ---------- compromissos ----------
  async compromissosListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const q = filtrarCompromissos(sb.from('compromissos').select(comEtiquetas(CAMPOS_COMPROMISSO_LISTA, 'compromissos', f), { count: 'exact' }), f);
    const { data, count } = await rodar(ordenarCompromissos(q, f.ordem && f.ordem !== 'manual' ? f.ordem : 'data').range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  },
  async compromissosDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    let q = filtrarCompromissos(sb.from('compromissos').select(comEtiquetas(CAMPOS_COMPROMISSO_LISTA, 'compromissos', f), { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    const { data, count } = await rodar(ordenarCompromissos(q, f.ordem || 'manual').range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  },
  async compromissosDoPeriodo(de, ate, f = {}) {
    const q = filtrarCompromissos(sb.from('compromissos').select(comEtiquetas(CAMPOS_COMPROMISSO_LISTA, 'compromissos', f)), { ...f, situacao: 'ativos' });
    const { data } = await rodar(ordenarCompromissos(q.gte('data', de).lte('data', ate), 'data').limit(ITENS_DA_AGENDA));
    return data;
  },
  async compromissoObter(id) {
    const { data } = await rodar(sb.from('compromissos').select(CAMPOS_COMPROMISSO).eq('id', id).maybeSingle());
    return data ? compromissoComPessoas(data) : null;
  },
  async compromissoCriar(dados) {
    const { data } = await rodar(sb.from('compromissos').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    return data;
  },
  async compromissoAtualizar(id, dados) {
    const { data } = await rodar(sb.from('compromissos').update(dados).eq('id', id).select('id, codigo').single());
    return data;
  },
  async compromissosArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('compromissos')
      .update(arquivar ? { arquivado_em: new Date().toISOString(), arquivado_por: uid() } : { arquivado_em: null, arquivado_por: null })
      .in('id', ids).select('id'));
    if (ids.length && !data.length) throw new Error(NAO_MUDOU);
    return data.length;
  },
  async compromissosExcluir(ids) {
    const { data } = await rodar(sb.from('compromissos').delete().in('id', ids).select('id'));
    const excluidas = data.length;
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só compromissos arquivados podem ser excluídos, por quem os criou ou por um administrador.' : '' };
  },
  async compromissoMover(id, etapaId, ordem) {
    const { data } = await rodar(sb.from('compromissos').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id).select('id'));
    if (!data.length) throw new Error(NAO_MUDOU);
  },
  async compromissoHistorico(id) {
    const { data } = await rodar(sb.from('compromisso_historico').select('id, alteracoes, feito_por, em')
      .eq('compromisso_id', id).order('em', { ascending: false }).limit(HISTORICO_DO_COMPROMISSO));
    return data;
  },
  async compromissosDaPessoa(pessoaId, perfilId = null) {
    const filtros = [`pessoas.cs.{${pessoaId}}`, ...(perfilId ? [`responsavel_id.eq.${perfilId}`, `participantes.cs.{${perfilId}}`] : [])];
    const { data } = await rodar(sb.from('compromissos').select(CAMPOS_COMPROMISSO_LIGADO).or(filtros.join(','))
      .order('data', { ascending: false }).order('hora', { ascending: false }).limit(COMPROMISSOS_LIGADOS));
    return data.map(({ pessoas, responsavel_id, participantes, ...c }: Livre) => ({ ...c, papeis: papeisNoCompromisso({ pessoas, responsavel_id, participantes }, pessoaId, perfilId) }));
  },
  async compromissosDoProcesso(processoId) {
    const { data } = await rodar(sb.from('compromissos').select(CAMPOS_COMPROMISSO_LIGADO).eq('processo_id', processoId)
      .order('data', { ascending: false }).order('hora', { ascending: false }).limit(COMPROMISSOS_LIGADOS));
    return data.map(({ pessoas: _pessoas, responsavel_id: _responsavel, participantes: _participantes, ...c }: Livre) => ({ ...c, papeis: [] }));
  },
  async prazosDoPeriodo(de, ate, f = {}) {
    // Os prazos do que já foi concluído (na coluna-marco de concluídos) não aparecem.
    const [{ data: concluidas }, { data: demandas }, { data: tarefas }] = await Promise.all([
      rodar(sb.from('quadro_colunas').select('id').eq('marco', 'concluido').in('modulo', ['demandas', 'tarefas'])),
      rodar(filtrarDemandas(sb.from('demandas').select('id, codigo, titulo, prazo, responsavel_id, etapa_id'), f).gte('prazo', de).lte('prazo', ate).order('prazo').limit(ITENS_DA_AGENDA)),
      rodar(filtrarTarefas(sb.from('tarefas').select('id, codigo, titulo, prazo, responsavel_id, etapa_id'), f).gte('prazo', de).lte('prazo', ate).order('prazo').limit(ITENS_DA_AGENDA))
    ]);
    const fim = new Set(concluidas.map((c: Livre) => c.id));
    const naAgenda = (origem: PrazoNaAgenda['origem'], linhas: Livre[]): PrazoNaAgenda[] => linhas.filter(l => !fim.has(l.etapa_id))
      .map(({ etapa_id: _etapa, ...l }) => ({ origem, ...l }));
    return [...naAgenda('demandas', demandas), ...naAgenda('tarefas', tarefas)];
  },
  async processosParaLigar(termo = '') {
    let q = sb.from('processos').select('id, codigo, tipo, numero, titulo, cliente_nome').is('arquivado_em', null);
    const t = termoBusca(termo);
    if (t) q = q.ilike('busca', `%${t}%`);
    const { data } = await rodar(q.order('criado_em', { ascending: false }).limit(PROCESSOS_PARA_LIGAR));
    return data;
  },

  // ---------- andamentos e prazos do processo ----------
  async processoAndamentos(processoId) {
    const { data } = await rodar(sb.from('processo_andamentos').select(CAMPOS_ANDAMENTO).eq('processo_id', processoId).is('excluido_em', null)
      .order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(ANDAMENTOS_DO_PROCESSO));
    return (data as AndamentoDeProcesso[]).map(andamentoLido);
  },
  async processoAndamentoCriar(processoId, dados) {
    const { data } = await rodar(sb.from('processo_andamentos').insert({ ...dados, processo_id: processoId, criado_por: uid() }).select(CAMPOS_ANDAMENTO).single());
    return andamentoLido(data);
  },
  async processoAndamentoAtualizar(id, dados) {
    const { data } = await rodar(sb.from('processo_andamentos').update(dados).eq('id', id).select(CAMPOS_ANDAMENTO).maybeSingle());
    return andamentoLido(primeira<AndamentoDeProcesso>(data));
  },
  async processoAndamentoExcluir(id) {
    const { data } = await rodar(sb.from('processo_andamentos').update({ excluido_em: new Date().toISOString() }).eq('id', id).select('id').maybeSingle());
    primeira(data);
  },
  async processoAndamentoRestaurar(id) {
    const { data } = await rodar(sb.from('processo_andamentos').update({ excluido_em: null }).eq('id', id).select('id').maybeSingle());
    primeira(data);
  },
  async processoPrazos(processoId) {
    const { data } = await rodar(sb.from('processo_prazos').select(CAMPOS_PRAZO).eq('processo_id', processoId).is('excluido_em', null).order('final', { ascending: false }).limit(PRAZOS_DO_PROCESSO));
    return data;
  },
  async processoPrazoCriar(processoId, dados) {
    const { data } = await rodar(sb.from('processo_prazos').insert({ ...dados, processo_id: processoId, criado_por: uid() }).select(CAMPOS_PRAZO).single());
    return data;
  },
  async processoPrazoAtualizar(id, dados) {
    const { data } = await rodar(sb.from('processo_prazos').update(dados).eq('id', id).select(CAMPOS_PRAZO).maybeSingle());
    return primeira<PrazoDeProcesso>(data);
  },
  async processoPrazoExcluir(id) {
    const { data } = await rodar(sb.from('processo_prazos').update({ excluido_em: new Date().toISOString() }).eq('id', id).select('id').maybeSingle());
    primeira(data);
  },
  async processoPrazoRestaurar(id) {
    const { data } = await rodar(sb.from('processo_prazos').update({ excluido_em: null }).eq('id', id).select('id').maybeSingle());
    primeira(data);
  },
  async tarefasDoProcesso(processoId) {
    const { data } = await rodar(naOrdemDoQuadro(sb.from('tarefas').select(CAMPOS_TAREFA_LIGADA).eq('processo_id', processoId)));
    return (data as TarefaParaLigar[]).map(tarefaLigada('', null));
  },

  // ---------- processo e demanda ----------
  async processoDemandaLigar(processoId, demandaId) {
    await rodar(sb.from('processo_demandas').upsert({ processo_id: processoId, demanda_id: demandaId, criado_por: uid() }, { onConflict: 'processo_id,demanda_id', ignoreDuplicates: true }));
  },
  async demandasDoProcesso(processoId) {
    const { data } = await rodar(sb.from('processo_demandas').select(`demanda:demandas(${CAMPOS_DEMANDA_LIGADA}, contrato_id, criado_por)`).eq('processo_id', processoId).order('criado_em').limit(DEMANDAS_LIGADAS));
    // Quem não pode ver a demanda recebe a ligação sem ela: fica de fora.
    return (data as { demanda: Livre }[]).flatMap(({ demanda }) => {
      if (!demanda) return [];
      const { clientes: _c, ...d } = demanda;
      return [{ ...d, papeis: [] }];
    });
  },
  async processosDaDemanda(demandaId) {
    const { data } = await rodar(sb.from('processo_demandas').select('processo:processos(id, codigo, tipo, numero, titulo, cliente_nome, etapa_id, arquivado_em, criado_em)').eq('demanda_id', demandaId).order('criado_em').limit(PROCESSOS_LIGADOS));
    // Quem não pode ver o processo recebe a ligação sem ele: conta, mas não abre.
    const linhas = data as { processo: Livre }[];
    const visiveis = linhas.flatMap(({ processo }) => processo ? [{ ...processo, papeis: [] }] : []);
    return { visiveis, ocultos: linhas.length - visiveis.length };
  },

  // ---------- caixa ----------
  async financeiroContas() {
    const { data } = await rodar(sb.from('financeiro_contas').select(CAMPOS_DA_CONTA).order('criado_em'));
    return data;
  },
  async financeiroContaCriar(dados) {
    const { data } = await rodar(sb.from('financeiro_contas').insert({ ...dados, criado_por: uid() }).select(CAMPOS_DA_CONTA).single());
    return data;
  },
  async financeiroContaAtualizar(id, dados) {
    const { data } = await rodar(sb.from('financeiro_contas').update(dados).eq('id', id).select('id').maybeSingle());
    naoEsta(data);
  },
  // Em partes: o saldo do mês soma tudo, e um corte deixaria o saldo final errado sem ninguém ver.
  async financeiroLancamentos(contaId, de, ate) {
    const todos: Lancamento[] = [];
    for (let i = 0; ; i += LINHAS_POR_CONSULTA) {
      const { data } = await rodar(sb.from('financeiro_lancamentos').select(CAMPOS_DO_LANCAMENTO).eq('conta_id', contaId).is('excluido_em', null).gte('data', de).lte('data', ate)
        .order('data').order('criado_em').order('id').range(i, i + LINHAS_POR_CONSULTA - 1));
      todos.push(...data);
      if (data.length < LINHAS_POR_CONSULTA) return todos;
    }
  },
  async financeiroAjustesDeSaldo() {
    const todos: Lancamento[] = [];
    for (let i = 0; ; i += LINHAS_POR_CONSULTA) {
      const { data } = await rodar(sb.from('financeiro_lancamentos').select(CAMPOS_DO_LANCAMENTO).in('categoria', CATEGORIAS_DE_AJUSTE).is('excluido_em', null)
        .order('data', { ascending: false }).order('criado_em', { ascending: false }).order('id').range(i, i + LINHAS_POR_CONSULTA - 1));
      todos.push(...data);
      if (data.length < LINHAS_POR_CONSULTA) return todos;
    }
  },
  financeiroSaldoAntes: (contaId, data) => rpc('financeiro_saldo_antes', { p_conta: contaId, p_data: data }).then(Number),
  async financeiroLancamentoCriar(dados) {
    const { data } = await rodar(sb.from('financeiro_lancamentos').insert({ ...dados, criado_por: uid() }).select(CAMPOS_DO_LANCAMENTO).single());
    return data;
  },
  async financeiroLancamentoAtualizar(id, dados) {
    const { data } = await rodar(sb.from('financeiro_lancamentos').update(dados).eq('id', id).select('id').maybeSingle());
    naoEsta(data);
  },
  async financeiroLancamentoExcluir(id) {
    const { data } = await rodar(sb.from('financeiro_lancamentos').update({ excluido_em: new Date().toISOString() }).eq('id', id).select('id').maybeSingle());
    naoEsta(data);
  },
  async financeiroLancamentoRestaurar(id) {
    const { data } = await rodar(sb.from('financeiro_lancamentos').update({ excluido_em: null }).eq('id', id).select('id').maybeSingle());
    naoEsta(data);
  },
  financeiroTransferir: ({ de, para, data, valor, descricao }) => rpc('financeiro_transferir', { p_de: de, p_para: para, p_data: data, p_valor: valor, p_descricao: descricao }),
  async financeiroHistorico(lancamentoId) {
    const { data } = await rodar(sb.from('financeiro_historico').select('id, alteracoes, feito_por, em').eq('lancamento_id', lancamentoId).order('em', { ascending: false }).limit(HISTORICO_DO_PROCESSO));
    return data;
  },
  async financeiroDas() {
    const { data } = await rodar(sb.from('financeiro_das').select('mes, aliquota').order('mes'));
    return (data as { mes: string; aliquota: number | string }[]).map(a => ({ mes: a.mes, aliquota: Number(a.aliquota) }));
  },
  async financeiroDasSalvar(mes, aliquota) {
    await rodar(sb.from('financeiro_das').upsert({ mes, aliquota, atualizado_por: uid() }, { onConflict: 'escritorio_id,mes' }));
  },
  // ---------- parcelas, recebimentos e repasses ----------
  async parcelasDoContrato(contratoId) {
    const { data } = await rodar(sb.from('contrato_parcelas').select(CAMPOS_DA_PARCELA).eq('contrato_id', contratoId).is('excluido_em', null).order('numero'));
    return data;
  },
  async parcelasHistorico(contratoId) {
    const { data } = await rodar(sb.from('contrato_parcelas_historico').select('id, alteracoes, feito_por, em').eq('contrato_id', contratoId).order('em', { ascending: false }).limit(HISTORICO_DO_PROCESSO));
    return data;
  },
  async parcelasDaPessoa(pessoaId) {
    const { data: ligados } = await rodar(sb.from('contrato_clientes').select('contrato_id').eq('pessoa_id', pessoaId).limit(CONTRATOS_DA_PESSOA));
    if (!ligados.length) return [];
    // O filtro do contrato arquivado é aqui, então lê até juntar o limite: as arquivadas não podem ocupar o lugar das outras.
    const todas: ParcelaDoEscritorio[] = [];
    for (let i = 0; ; i += LINHAS_POR_CONSULTA) {
      const { data } = await rodar(sb.from('contrato_parcelas').select(CAMPOS_DA_PARCELA_DO_ESCRITORIO).in('contrato_id', ligados.map((x: { contrato_id: string }) => x.contrato_id)).is('excluido_em', null)
        .order('vencimento', { ascending: false }).order('numero', { ascending: false }).order('id').range(i, i + LINHAS_POR_CONSULTA - 1));
      todas.push(...(data as unknown as LinhaDaParcela[]).filter(naLista).map(parcelaDoEscritorio));
      if (todas.length >= PARCELAS_DA_PESSOA || data.length < LINHAS_POR_CONSULTA) return todas.slice(0, PARCELAS_DA_PESSOA);
    }
  },
  async parcelasDoPeriodo(de, ate, hoje) {
    // As trazidas de antes do período são as atrasadas: num mês futuro, o que ainda vai vencer não entra.
    const antesDe = hoje < de ? hoje : de;
    const todas: ParcelaDoEscritorio[] = [];
    for (let i = 0; ; i += LINHAS_POR_CONSULTA) {
      const { data } = await rodar(sb.from('contrato_parcelas').select(CAMPOS_DA_PARCELA_DO_ESCRITORIO).is('excluido_em', null)
        .or(`and(vencimento.gte.${de},vencimento.lte.${ate}),and(recebimento_id.is.null,vencimento.lt.${antesDe})`)
        .order('vencimento').order('id').range(i, i + LINHAS_POR_CONSULTA - 1));
      todas.push(...(data as unknown as LinhaDaParcela[]).filter(naLista).map(parcelaDoEscritorio));
      if (data.length < LINHAS_POR_CONSULTA) return todas;
    }
  },
  async parcelaCriar(contratoId, dados) {
    const { data } = await rodar(sb.from('contrato_parcelas').insert({ contrato_id: contratoId, ...dados, criado_por: uid() }).select(CAMPOS_DA_PARCELA).single());
    return data;
  },
  async parcelaAtualizar(id, dados) {
    const { data } = await rodar(sb.from('contrato_parcelas').update(dados).eq('id', id).select('id').maybeSingle());
    if (!data) throw new Error('Não foi possível: atualize a página e confira.');
  },
  async parcelaExcluir(id) {
    const { data } = await rodar(sb.from('contrato_parcelas').update({ excluido_em: new Date().toISOString() }).eq('id', id).select('id').maybeSingle());
    if (!data) throw new Error('Não foi possível: atualize a página e confira.');
  },
  async parcelaRestaurar(id) {
    const { data } = await rodar(sb.from('contrato_parcelas').update({ excluido_em: null }).eq('id', id).select('id').maybeSingle());
    if (!data) throw new Error('Não foi possível: atualize a página e confira.');
  },
  parcelasGerar: contratoId => rpc('contrato_gerar_parcelas', { p_contrato: contratoId }),
  financeiroParaReceber: (parcelaId, data) => rpc('financeiro_para_receber', { p_parcela: parcelaId, p_data: data }),
  financeiroReceber: ({ parcela, data, valor, conta, taxa }) => rpc('financeiro_receber', { p_parcela: parcela, p_data: data, p_valor: valor, p_conta: conta, p_taxa: taxa }),
  async financeiroRecebimento(id) {
    const { data } = await rodar(sb.from('financeiro_recebimentos').select(CAMPOS_DO_RECEBIMENTO).eq('id', id).maybeSingle());
    return data;
  },
  financeiroMeusValores: async (de, ate) => await rpc('financeiro_meus_valores', { p_de: de, p_ate: ate }) as MeuValor[],
  financeiroAPassar: async (de, ate) => await rpc('financeiro_a_passar', { p_de: de, p_ate: ate }) as ValorAPassar[],
  financeiroTerceiroMarcarPago: async (recebimento, pessoa, data) => { await rpc('financeiro_terceiro_marcar_pago', { p_recebimento: recebimento, p_pessoa: pessoa, p_data: data }); },
  financeiroTerceiroDesfazerPago: async (recebimento, pessoa) => { await rpc('financeiro_terceiro_desfazer_pago', { p_recebimento: recebimento, p_pessoa: pessoa }); },
  financeiroEstornar: async id => { await rpc('financeiro_estornar', { p_recebimento: id }); },
  financeiroRestaurarRecebimento: async id => { await rpc('financeiro_restaurar_recebimento', { p_recebimento: id }); },
  async financeiroRepasses(de, ate) {
    const todos: Repasse[] = [];
    for (let i = 0; ; i += LINHAS_POR_CONSULTA) {
      const { data } = await rodar(sb.from('financeiro_repasses').select(CAMPOS_DO_REPASSE).is('cancelado_em', null)
        .or(`pago_em.is.null,and(pago_em.gte.${de},pago_em.lte.${ate})`).order('criado_em').order('id').range(i, i + LINHAS_POR_CONSULTA - 1));
      todos.push(...data);
      if (data.length < LINHAS_POR_CONSULTA) return todos;
    }
  },
  financeiroPagarRepasse: async (id, conta, data) => { await rpc('financeiro_pagar_repasse', { p_repasse: id, p_conta: conta, p_data: data }); },
  financeiroDesfazerPagamento: async id => { await rpc('financeiro_desfazer_pagamento', { p_repasse: id }); },
  financeiroLucro: async () => await rpc('financeiro_lucro') as MovimentoDoLucro,
  financeiroPagarLucro: async ({ pessoa, conta, data, valor, descricao }) =>
    await rpc('financeiro_pagar_lucro', { p_pessoa: pessoa, p_conta: conta, p_data: data, p_valor: valor, p_descricao: descricao }) as string,
  financeiroDesfazerLucro: async id => { await rpc('financeiro_desfazer_lucro', { p_retirada: id }); },
  financeiroRestaurarLucro: async id => { await rpc('financeiro_restaurar_lucro', { p_retirada: id }); },
  async financeiroSocios() {
    const { data } = await rodar(sb.from('financeiro_socios').select(CAMPOS_DO_SOCIO).is('excluido_em', null).order('desde', { ascending: false }));
    return (data as unknown as LinhaDoSocio[]).map(socioLido);
  },
  async financeiroSocioCriar(dados) {
    const { data } = await rodar(sb.from('financeiro_socios').insert({ ...dados, criado_por: uid() }).select(CAMPOS_DO_SOCIO).single());
    return socioLido(data as unknown as LinhaDoSocio);
  },
  async financeiroSocioAtualizar(id, dados) {
    const { data } = await rodar(sb.from('financeiro_socios').update(dados).eq('id', id).select('id').maybeSingle());
    if (!data) throw new Error('Não foi possível: atualize a página e confira.');
  },
  async financeiroSocioExcluir(id) {
    const { data } = await rodar(sb.from('financeiro_socios').update({ excluido_em: new Date().toISOString() }).eq('id', id).select('id').maybeSingle());
    if (!data) throw new Error('Não foi possível: atualize a página e confira.');
  },
  async financeiroSocioRestaurar(id) {
    const { data } = await rodar(sb.from('financeiro_socios').update({ excluido_em: null }).eq('id', id).select('id').maybeSingle());
    if (!data) throw new Error('Não foi possível: atualize a página e confira.');
  },
  async financeiroAjustes() {
    const { data } = await rodar(sb.from('financeiro_ajustes').select('id, alteracoes, feito_por, em').order('em', { ascending: false }).limit(HISTORICO_DO_PROCESSO));
    return data;
  },

  // ---------- painel de processos ----------
  processosPainel: ({ hoje, meus }) => {
    const { ate_prazos, ate_marcados } = datasDoPainel(hoje);
    return rpc('painel_de_processos', { p_hoje: hoje, p_ate_prazos: ate_prazos, p_ate_marcados: ate_marcados, p_meus: meus, p_limite: ITENS_POR_LISTA, p_ultimos: ULTIMOS_ANDAMENTOS });
  },
  async processosDiasParadoSalvar(dias) { await rpc('dias_processo_parado_salvar', { p_dias: dias }); },

  // ---------- processos ----------
  async processosListar(f) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const q = filtrarProcessos(sb.from('processos').select(comEtiquetas(CAMPOS_PROCESSO_LISTA, 'processos', f), { count: 'exact' }), f);
    const { data, count } = await rodar(ordenarProcessos(q, f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos').range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  },
  async processosDaEtapa(etapaId, f, deslocamento = 0, limite = POR_COLUNA) {
    let q = filtrarProcessos(sb.from('processos').select(comEtiquetas(CAMPOS_PROCESSO_LISTA, 'processos', f), { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    const { data, count } = await rodar(ordenarProcessos(q, f.ordem || 'manual').range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  },
  async processoObter(id) {
    const { data } = await rodar(sb.from('processos').select(CAMPOS_PROCESSO).eq('id', id).maybeSingle());
    return data ? processoComClientes(data) : null;
  },
  // O código é dado pelo banco ao gravar.
  async processoCriar(dados) {
    const { data } = await rodar(sb.from('processos').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    return data;
  },
  async processoAtualizar(id, dados) {
    const { data } = await rodar(sb.from('processos').update(dados).eq('id', id).select('id, codigo').single());
    return data;
  },
  async processosArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('processos')
      .update({ arquivado_em: arquivar ? new Date().toISOString() : null, arquivado_por: arquivar ? uid() : null })
      .in('id', ids).select('id'));
    return data.length;
  },
  async processosExcluir(ids) {
    const { data } = await rodar(sb.from('processos').delete().in('id', ids).select('id'));
    const excluidas = data.length;
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só processos arquivados podem ser excluídos, por quem os criou ou por um administrador.' : '' };
  },
  async processoMover(id, etapaId, ordem) {
    await rodar(sb.from('processos').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id));
  },
  async processoHistorico(id) {
    const { data } = await rodar(sb.from('processo_historico').select('id, alteracoes, feito_por, em')
      .eq('processo_id', id).order('em', { ascending: false }).limit(HISTORICO_DO_PROCESSO));
    return data;
  },
  async processosDaPessoa(pessoaId, perfilId = null) {
    const filtros = [`clientes.cs.{${pessoaId}}`, ...(perfilId ? [`responsavel_id.eq.${perfilId}`, `colaboradores.cs.{${perfilId}}`] : [])];
    const { data } = await rodar(sb.from('processos').select('id, codigo, tipo, numero, titulo, cliente_nome, etapa_id, arquivado_em, criado_em, clientes, responsavel_id, colaboradores')
      .or(filtros.join(',')).order('criado_em', { ascending: false }).limit(PROCESSOS_LIGADOS));
    return data.map(({ clientes, responsavel_id, colaboradores, ...p }: Livre) => ({ ...p, papeis: papeisNoProcesso({ clientes, responsavel_id, colaboradores }, pessoaId, perfilId) }));
  },
  async processoOpcoes() {
    const { data } = await rodar(sb.from('processo_opcoes').select('id, campo, valor').order('valor'));
    return data;
  },
  async processoOpcaoCriar(campo, valor) {
    const { data } = await rodar(sb.from('processo_opcoes').insert({ campo, valor: valor.trim() }).select('id, campo, valor').single());
    return data;
  },
  async processoOpcaoExcluir(id) {
    await rodar(sb.from('processo_opcoes').delete().eq('id', id));
  },
  async processoCampos() {
    const { data } = await rodar(sb.from('processo_campos').select(CAMPOS_DO_CAMPO).order('criado_em'));
    return data;
  },
  async processoCampoCriar(dados) {
    const { data } = await rodar(sb.from('processo_campos').insert(dados).select(CAMPOS_DO_CAMPO).single());
    return data;
  },
  async processoCampoAtualizar(id, dados) {
    const { data } = await rodar(sb.from('processo_campos').update(dados).eq('id', id).select(CAMPOS_DO_CAMPO).single());
    return data;
  },
  async processoCampoExcluir(id) {
    const { data } = await rodar(sb.from('processo_campos').delete().eq('id', id).select('id'));
    return data.length > 0;
  },
  async processoSugestoes(tipo) {
    const { data } = await rodar(sb.from('processos').select('orgao, comarca, vara').eq('tipo', tipo).order('atualizado_em', { ascending: false }).limit(PROCESSOS_PARA_SUGERIR));
    return { orgaos: semRepetir(data, 'orgao'), comarcas: semRepetir(data, 'comarca'), varas: semRepetir(data, 'vara') };
  },

  // ---------- tarefas ----------
  async tarefasListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const q = filtrarTarefas(sb.from('tarefas').select(comEtiquetas(CAMPOS_TAREFA_LISTA, 'tarefas', f), { count: 'exact' }), f);
    const { data, count } = await rodar(ordenarPeloTitulo(q, f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos').range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  },
  async tarefasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    let q = filtrarTarefas(sb.from('tarefas').select(comEtiquetas(CAMPOS_TAREFA_LISTA, 'tarefas', f), { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    const { data, count } = await rodar(ordenarPeloTitulo(q, f.ordem || 'manual').range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  },
  async tarefaObter(id) {
    const { data } = await rodar(sb.from('tarefas').select(CAMPOS_TAREFA).eq('id', id).maybeSingle());
    return data ? comPessoas(data) : null;
  },
  // O código é dado pelo banco ao gravar.
  async tarefaCriar(dados) {
    const { data } = await rodar(sb.from('tarefas').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    return data;
  },
  async tarefaAtualizar(id, dados) {
    const { data } = await rodar(sb.from('tarefas').update(dados).eq('id', id).select('id, codigo').single());
    return data;
  },
  async tarefasArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('tarefas')
      .update({ arquivado_em: arquivar ? new Date().toISOString() : null, arquivado_por: arquivar ? uid() : null })
      .in('id', ids).select('id'));
    return data.length;
  },
  async tarefasExcluir(ids) {
    const { data } = await rodar(sb.from('tarefas').delete().in('id', ids).select('id'));
    const excluidas = data.length;
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só tarefas arquivadas podem ser excluídas, por quem as criou ou por um administrador.' : '' };
  },
  async tarefaMover(id, etapaId, ordem) {
    await rodar(sb.from('tarefas').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id));
  },
  async tarefaHistorico(id) {
    const { data } = await rodar(sb.from('tarefa_historico').select('id, alteracoes, feito_por, em')
      .eq('tarefa_id', id).order('em', { ascending: false }).limit(100));
    return data;
  },
  // Responsável e participante numa consulta (pelo usuário); pessoa ligada pela lista de pessoas (vem de tarefa_pessoas).
  async tarefasDaPessoa(pessoaId, perfilId = null) {
    const filtros = [`pessoas.cs.{${pessoaId}}`, ...(perfilId ? [`responsavel_id.eq.${perfilId}`, `participantes.cs.{${perfilId}}`] : [])];
    const { data } = await rodar(sb.from('tarefas').select(CAMPOS_TAREFA_LIGADA).or(filtros.join(','))
      .order('criado_em', { ascending: false }).limit(TAREFAS_LIGADAS));
    return (data as TarefaParaLigar[]).map(tarefaLigada(pessoaId, perfilId));
  },
  async tarefasDaDemanda(demandaId) {
    const { data } = await rodar(naOrdemDoQuadro(sb.from('tarefas').select(CAMPOS_TAREFA_LIGADA).eq('demanda_id', demandaId)));
    return (data as TarefaParaLigar[]).map(tarefaLigada('', null));
  },
  async tarefasDoContrato(contratoId) {
    const { data } = await rodar(naOrdemDoQuadro(sb.from('tarefas').select(CAMPOS_TAREFA_LIGADA).eq('contrato_id', contratoId)));
    return (data as TarefaParaLigar[]).map(tarefaLigada('', null));
  },

  // ---------- tempo nas tarefas ----------
  async tempoIniciar(tarefaId, inicio, segundos) {
    const { data } = await rodar(sb.from('tarefa_tempos').insert({ tarefa_id: tarefaId, inicio, segundos, perfil_id: uid() }).select('id').single());
    return data.id;
  },
  async tempoGravar(id, segundos) { await rodar(sb.from('tarefa_tempos').update({ segundos }).eq('id', id)); },
  async tempoAjustar(tarefaId, segundos, motivo) {
    await rodar(sb.from('tarefa_tempos').insert({ tarefa_id: tarefaId, segundos, ajuste: true, motivo: motivo.trim(), perfil_id: uid() }));
  },
  // Os registros que a regra de leitura deixa ver (os da pessoa; os de todos, para administradores) e o resumo da
  // equipe, que o banco calcula sem abrir as durações de cada um.
  async tempoDaTarefa(tarefaId) {
    const [{ data: registros }, { data: resumo }] = await Promise.all([
      rodar(sb.from('tarefa_tempos').select(CAMPOS_TEMPO).eq('tarefa_id', tarefaId).order('inicio')),
      rodar(sb.rpc('resumo_do_tempo', { p_tarefa: tarefaId }))
    ]);
    const linhas = resumo as { perfil_id: string | null; percentual: number; total: number }[];
    return { registros, equipe: linhas.map(l => ({ perfil_id: l.perfil_id, percentual: Number(l.percentual) })), total: Number(linhas[0]?.total ?? 0) };
  },
  async tempoDaDemanda(demandaId) {
    const { data } = await rodar(sb.rpc('tempo_da_demanda', { p_demanda: demandaId }));
    return Number(data ?? 0);
  },
  // Os dias viram instantes no fuso do aparelho: "esta semana" é a semana de quem está olhando.
  async tempoPorTarefa(perfilId, de, ate) {
    const { data } = await rodar(sb.rpc('tempo_por_tarefa', { p_perfil: perfilId, p_de: inicioDoDia(de), p_ate: inicioDoDia(ate) }));
    return (data as TempoNaTarefaDoPeriodo[]).map(l => ({ ...l, segundos: Number(l.segundos) }));
  },

  // ---------- perfil profissional ----------
  async perfilProfissional(perfilId) {
    const { data } = await rodar(sb.from('perfil_profissional').select(CAMPOS_PERFIL_PROFISSIONAL).eq('perfil_id', perfilId));
    return data[0] ?? perfilVazio(perfilId);
  },
  // Altera se já existe; se não, cria. (O upsert do Supabase mandaria também perfil_id, que ninguém altera.)
  async perfilProfissionalSalvar(perfilId, campos) {
    const { data } = await rodar(sb.from('perfil_profissional').update(campos).eq('perfil_id', perfilId).select('perfil_id'));
    if (!data.length) await rodar(sb.from('perfil_profissional').insert({ perfil_id: perfilId, ...campos }));
  },

  // ---------- foto do perfil ----------
  async fotoDoPerfil(perfilId) {
    const { data } = await rodar(sb.from('perfil_profissional').select('foto_em').eq('perfil_id', perfilId));
    const em = data[0]?.foto_em;
    if (!em || !ctx?.perfil) return null;
    const [grande, pequena] = await linksDasFotos([FOTO_GRANDE, FOTO_PEQUENA].map(lado => caminhoDaFoto(ctx!.perfil!.escritorio_id, perfilId, lado)));
    return grande && pequena ? { grande, pequena, em } : null;
  },
  // Os dois arquivos primeiro; a data no perfil só depois que os dois chegaram.
  async fotoSalvar(perfilId, grande, pequena) {
    if (!ctx?.perfil) throw new Error('Entre de novo para enviar a foto.');
    const opcoes = { contentType: 'image/avif', upsert: true, cacheControl: '3600' };
    for (const [lado, arquivo] of [[FOTO_GRANDE, grande], [FOTO_PEQUENA, pequena]] as const) {
      await rodar(fotos.upload(caminhoDaFoto(ctx.perfil.escritorio_id, perfilId, lado), arquivo, opcoes));
    }
    const foto_em = new Date().toISOString();
    const { data } = await rodar(sb.from('perfil_profissional').update({ foto_em }).eq('perfil_id', perfilId).select('perfil_id'));
    if (!data.length) await rodar(sb.from('perfil_profissional').insert({ perfil_id: perfilId, foto_em }));
  },
  async fotoRemover(perfilId) {
    if (!ctx?.perfil) throw new Error('Entre de novo para tirar a foto.');
    await rodar(sb.from('perfil_profissional').update({ foto_em: null }).eq('perfil_id', perfilId));
    await rodar(fotos.remove([FOTO_GRANDE, FOTO_PEQUENA].map(lado => caminhoDaFoto(ctx!.perfil!.escritorio_id, perfilId, lado))));
  },

  // ---------- listas das demandas e das tarefas ----------
  async listasDoCartao(modulo, id) {
    const { data } = await rodar(sb.from('demanda_listas').select(`${CAMPOS_LISTA_CARTAO}, itens:demanda_lista_itens(${CAMPOS_ITEM_LISTA})`)
      .eq(DONO_DA_LISTA[modulo], id).order('ordem').order('criado_em'));
    return (data as ListaDoCartao[]).map(l => ({ ...l, itens: l.itens.toSorted((a, b) => a.ordem - b.ordem) }));
  },
  // No fim das listas do cartão: depois da maior posição que já existe. Os itens vêm na ordem dada.
  async listaCriar(modulo, id, nome, itens = []) {
    const dono = DONO_DA_LISTA[modulo];
    const { data: ultima } = await rodar(sb.from('demanda_listas').select('ordem').eq(dono, id).order('ordem', { ascending: false }).limit(1));
    const { data: lista } = await rodar(sb.from('demanda_listas').insert({ [dono]: id, nome, ordem: (ultima[0]?.ordem ?? 0) + 1 })
      .select(CAMPOS_LISTA_CARTAO).single());
    const { data: criados } = itens.length
      ? await rodar(sb.from('demanda_lista_itens').insert(itens.map((texto, i) => ({ lista_id: lista.id, texto, ordem: i + 1 }))).select(CAMPOS_ITEM_LISTA))
      : { data: [] };
    return { ...lista, itens: (criados as ItemDaLista[]).toSorted((a, b) => a.ordem - b.ordem) };
  },
  async listaAtualizar(id, campos) { await rodar(sb.from('demanda_listas').update(campos).eq('id', id)); },
  async listaExcluir(id) { await rodar(sb.from('demanda_listas').delete().eq('id', id)); },
  async itemCriar(listaId, texto) {
    const { data: ultimo } = await rodar(sb.from('demanda_lista_itens').select('ordem').eq('lista_id', listaId).order('ordem', { ascending: false }).limit(1));
    const { data } = await rodar(sb.from('demanda_lista_itens').insert({ lista_id: listaId, texto, ordem: (ultimo[0]?.ordem ?? 0) + 1 })
      .select(CAMPOS_ITEM_LISTA).single());
    return data;
  },
  // Marcar manda a hora daqui, mas quem vale é o banco (ele anota a hora dele e quem marcou).
  async itemAtualizar(id, { feito, ...campos }) {
    const mudar = feito === undefined ? campos : { ...campos, feito_em: feito ? new Date().toISOString() : null };
    const { data } = await rodar(sb.from('demanda_lista_itens').update(mudar).eq('id', id).select(CAMPOS_ITEM_LISTA).single());
    return data;
  },
  async itemExcluir(id) { await rodar(sb.from('demanda_lista_itens').delete().eq('id', id)); },

  // ---------- modelos de lista ----------
  async modelosListar() {
    const { data } = await rodar(sb.from('lista_modelos').select(CAMPOS_MODELO).order('nome'));
    return data as ModeloDeLista[];
  },
  async modeloCriar(nome, itens) {
    const { data } = await rodar(sb.from('lista_modelos').insert({ nome, itens, criado_por: uid() }).select(CAMPOS_MODELO).single());
    return data as ModeloDeLista;
  },
  async modeloAtualizar(id, campos) { await rodar(sb.from('lista_modelos').update(campos).eq('id', id)); },
  async modeloExcluir(id) {
    const { data } = await rodar(sb.from('lista_modelos').delete().eq('id', id).select('id'));
    if (!data.length) throw new Error('Só quem criou o modelo ou um administrador pode excluí-lo.');
  },

  // ---------- etiquetas ----------
  async etiquetasListar() {
    const { data } = await rodar(sb.from('etiquetas').select(CAMPOS_ETIQUETA).order('criado_em'));
    return data as Etiqueta[];
  },
  async etiquetaCriar(cor, texto) {
    const { data } = await rodar(sb.from('etiquetas').insert({ cor, texto, criado_por: uid() }).select(CAMPOS_ETIQUETA).single());
    return data as Etiqueta;
  },
  async etiquetaAtualizar(id, campos) {
    const { data } = await rodar(sb.from('etiquetas').update(campos).eq('id', id).select('id'));
    conferirDonoDaEtiqueta(data);
  },
  async etiquetaExcluir(id) {
    const { data } = await rodar(sb.from('etiquetas').delete().eq('id', id).select('id'));
    conferirDonoDaEtiqueta(data);
  },
  async etiquetasDoCartao(modulo, id) {
    const { tabela, coluna } = ETIQUETAS_DO_MODULO[modulo];
    const { data } = await rodar(sb.from(tabela).select('etiqueta_id').eq(coluna, id));
    return data.map((x: { etiqueta_id: string }) => x.etiqueta_id);
  },
  async etiquetaAplicar(modulo, id, etiquetaId) {
    const { tabela, coluna } = ETIQUETAS_DO_MODULO[modulo];
    await rodar(sb.from(tabela).upsert({ [coluna]: id, etiqueta_id: etiquetaId }, { onConflict: `${coluna},etiqueta_id`, ignoreDuplicates: true }));
  },
  async etiquetaTirar(modulo, id, etiquetaId) {
    const { tabela, coluna } = ETIQUETAS_DO_MODULO[modulo];
    await rodar(sb.from(tabela).delete().eq(coluna, id).eq('etiqueta_id', etiquetaId));
  },
  async etiquetaAplicarEmLote(modulo, ids, etiquetaId) {
    const { tabela, coluna } = ETIQUETAS_DO_MODULO[modulo];
    await rodar(sb.from(tabela).upsert(ids.map(id => ({ [coluna]: id, etiqueta_id: etiquetaId })), { onConflict: `${coluna},etiqueta_id`, ignoreDuplicates: true }));
  },
  // Em partes, para o endereço da consulta não ficar grande demais.
  async etiquetaTirarEmLote(modulo, ids, etiquetaId) {
    const { tabela, coluna } = ETIQUETAS_DO_MODULO[modulo];
    for (let i = 0; i < ids.length; i += IDS_POR_EXCLUSAO) {
      await rodar(sb.from(tabela).delete().in(coluna, ids.slice(i, i + IDS_POR_EXCLUSAO)).eq('etiqueta_id', etiquetaId));
    }
  },

  // ---------- calendário de feriados e suspensões ----------
  async orgaosListar() {
    const { data } = await rodar(sb.from('orgaos').select(CAMPOS_ORGAO).order('sigla'));
    return data as Orgao[];
  },
  async orgaoCriar(o) {
    const { data } = await rodar(sb.from('orgaos').insert(o).select(CAMPOS_ORGAO).single());
    return data as Orgao;
  },
  async orgaoAtualizar(id, campos) {
    const { data } = await rodar(sb.from('orgaos').update(campos).eq('id', id).select('id'));
    conferirAdminNoCalendario(data);
  },
  async orgaoExcluir(id) {
    const { data } = await rodar(sb.from('orgaos').delete().eq('id', id).select('id'));
    conferirAdminNoCalendario(data);
  },
  // Em partes: um prazo longo pede vários anos, e cada dia lançado é uma linha por órgão.
  async diasListar(de, ate) {
    const todos: DiaLancado[] = [];
    for (let i = 0; ; i += LINHAS_POR_CONSULTA) {
      const { data } = await rodar(sb.from('dias_sem_expediente').select(CAMPOS_DIA).gte('data', de).lte('data', ate)
        .order('data').order('id').range(i, i + LINHAS_POR_CONSULTA - 1));
      todos.push(...data);
      if (data.length < LINHAS_POR_CONSULTA) return todos;
    }
  },
  // O mesmo dia para o mesmo órgão (ou para todos) substitui o que havia: a regra dias_sem_expediente_unico do banco.
  async diasLancar(linhas) {
    if (!linhas.length) return 0;
    const { count } = await rodar(sb.from('dias_sem_expediente').upsert(linhas, { onConflict: 'escritorio_id,data,orgao_id', count: 'exact' }));
    return count ?? linhas.length;
  },
  // Em partes, para o endereço da consulta não ficar grande demais.
  async diasExcluir(ids) {
    for (let i = 0; i < ids.length; i += IDS_POR_EXCLUSAO) {
      const { data } = await rodar(sb.from('dias_sem_expediente').delete().in('id', ids.slice(i, i + IDS_POR_EXCLUSAO)).select('id'));
      conferirAdminNoCalendario(data);
    }
  },

  // ---------- quadros (kanban) ----------
  async colunasListar(modulo) {
    const [{ data: colunas }, { data: ocultas }] = await Promise.all([
      rodar(sb.from('quadro_colunas').select('id, nome, ordem, criado_por, marco, grupo_id').eq('modulo', modulo).order('ordem').order('id')),
      rodar(sb.from('quadro_colunas_ocultas').select('coluna_id'))
    ]);
    const o = new Set(ocultas.map((x: { coluna_id: string }) => x.coluna_id));
    return colunas.map((c: { id: string }) => ({ ...c, oculta: o.has(c.id) }));
  },
  async sugestoesListar(modulo) {
    const { data } = await rodar(sb.from('quadro_sugestoes').select('nome').eq('modulo', modulo).order('ordem'));
    return data.map((x: { nome: string }) => x.nome);
  },
  async colunaCriar(modulo, nome, ordem, grupoId = null) {
    const { data } = await rodar(sb.from('quadro_colunas').insert({ modulo, nome: nome.trim(), ordem, criado_por: uid(), grupo_id: grupoId })
      .select('id, nome, ordem, criado_por, grupo_id').single());
    return { ...data, oculta: false };
  },
  async colunaAgrupar(id, grupoId, ordem) { await rodar(sb.from('quadro_colunas').update({ grupo_id: grupoId, ordem }).eq('id', id)); },
  async gruposListar(modulo) {
    const { data } = await rodar(sb.from('quadro_grupos').select(CAMPOS_GRUPO).eq('modulo', modulo).order('ordem'));
    return data as GrupoDeColunas[];
  },
  async grupoCriar(modulo, nome, ordem) {
    const { data } = await rodar(sb.from('quadro_grupos').insert({ modulo, nome: nome.trim(), ordem }).select(CAMPOS_GRUPO).single());
    return data as GrupoDeColunas;
  },
  async grupoAtualizar(id, campos) {
    const { data } = await rodar(sb.from('quadro_grupos').update(campos).eq('id', id).select('id'));
    conferirAdminNosGrupos(data);
  },
  async grupoExcluir(id) {
    const { data } = await rodar(sb.from('quadro_grupos').delete().eq('id', id).select('id'));
    conferirAdminNosGrupos(data);
  },
  async colunaOcultar(id, ocultar) {
    if (ocultar) await rodar(sb.from('quadro_colunas_ocultas').insert({ coluna_id: id, perfil_id: uid() }));
    else await rodar(sb.from('quadro_colunas_ocultas').delete().eq('coluna_id', id).eq('perfil_id', uid()));
  },
  async colunaRenomear(id, nome) { await rodar(sb.from('quadro_colunas').update({ nome: nome.trim() }).eq('id', id)); },
  async colunaOrdenar(id, ordem) { await rodar(sb.from('quadro_colunas').update({ ordem }).eq('id', id)); },
  async colunaExcluir(id) {
    const { data } = await rodar(sb.from('quadro_colunas').delete().eq('id', id).select('id'));
    if (!data.length) throw new Error('Só administradores excluem colunas, e a coluna-marco não pode ser excluída.');
  },

  // ---------- comentários ----------
  async comentariosListar(modulo, cartaoId) {
    const { data } = await rodar(sb.from('comentarios').select(CAMPOS_COMENTARIO).eq(CARTAO_DO_COMENTARIO[modulo], cartaoId)
      .order('criado_em', { ascending: false }).limit(COMENTARIOS_DO_CARTAO));
    return data as Comentario[];
  },
  async comentarioCriar(modulo, cartaoId, texto) {
    const { data } = await rodar(sb.from('comentarios').insert({ [CARTAO_DO_COMENTARIO[modulo]]: cartaoId, texto }).select(CAMPOS_COMENTARIO).single());
    return data as Comentario;
  },
  async comentarioEditar(id, texto) {
    const { data } = await rodar(sb.from('comentarios').update({ texto }).eq('id', id).select(CAMPOS_COMENTARIO));
    if (!data.length) throw new Error('Só quem escreveu o comentário pode editá-lo.');
    return data[0] as Comentario;
  },
  async comentarioExcluir(id) {
    const { data } = await rodar(sb.from('comentarios').delete().eq('id', id).select('id'));
    if (!data.length) throw new Error('Só quem escreveu o comentário ou um administrador pode apagá-lo.');
  },

  // ---------- ligação com a conta Google ----------
  async ligacaoGoogle() {
    const linhas = await rpc('ligacao_google') as LigacaoGoogle[];
    return linhas[0] ?? null;
  },
  // O banco cria o pedido (só administradores) e devolve o "estado"; o navegador vai à função do servidor, que leva ao Google.
  async ligacaoGoogleIniciar(voltarPara) {
    const estado = await rpc('ligacao_google_iniciar', { p_voltar_para: voltarPara }) as string;
    return `${URL_BASE}/functions/v1/google-conectar?estado=${encodeURIComponent(estado)}`;
  },
  // A função do servidor confere quem está logado (a sessão vai junto pelo comSessao) e troca o código no Google.
  async ligacaoGoogleConcluir(estado, codigo) {
    const r = await comSessao(`${URL_BASE}/functions/v1/google-concluir`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado, codigo })
    });
    const { resultado } = await r.json().catch(() => ({ resultado: 'erro' })) as { resultado?: ResultadoDaLigacao };
    return resultado ?? 'erro';
  },
  async ligacaoGoogleDesligar() { await rpc('ligacao_google_desligar'); },

  // ---------- equipe e administração ----------
  // A lista do banco é de antes da função (supabase/migrations/20261027000015_funcao_na_equipe.sql): a função de cada um vem dos perfis.
  async equipeListar() {
    const [usuarios, { data: funcoes }] = await Promise.all([rpc('equipe_listar'), rodar(sb.from('perfis').select('id, funcao'))]);
    const funcaoDe = new Map<string, Funcao>(funcoes.map((f: { id: string; funcao: Funcao }) => [f.id, f.funcao]));
    return usuarios.map((u: Usuario) => ({ ...u, funcao: funcaoDe.get(u.id) ?? FUNCAO_INICIAL }));
  },
  conviteCriar: (pessoaId, email, papel) => rpc('convite_criar', { p_pessoa: pessoaId, p_email: email, p_papel: papel }),
  conviteNovoLink: id => rpc('convite_novo_link', { p_id: id }),
  equipeDefinirPapel: (perfilId, papel) => rpc('equipe_definir_papel', { p_perfil: perfilId, p_papel: papel }),
  equipeDefinirAtivo: (perfilId, ativo) => rpc('equipe_definir_ativo', { p_perfil: perfilId, p_ativo: ativo }),
  equipeDefinirFuncao: (perfilId, funcao) => rpc('equipe_definir_funcao', { p_perfil: perfilId, p_funcao: funcao }),
  // A função do servidor confere quem está logado (a sessão vai junto pelo comSessao), e o banco decide se a troca pode acontecer.
  async equipeTrocarEmail(perfilId, email) {
    const r = await comSessao(`${URL_BASE}/functions/v1/equipe-trocar-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil: perfilId, email: normalizarEmail(email) })
    });
    const { resultado } = await r.json().catch(() => ({ resultado: 'erro' })) as { resultado?: RecusaDaTrocaDeEmail | 'trocado' };
    if (resultado !== 'trocado') throw new Error(RECUSA_DA_TROCA[resultado ?? 'erro'] ?? RECUSA_DA_TROCA.erro);
  },
  async convitesListar() {
    const { data } = await rodar(sb.from('convites').select('id, email, nome, papel, pessoa_id, criado_em')
      .is('usado_em', null).order('criado_em', { ascending: false }));
    return data;
  },
  async conviteCancelar(id) {
    const { data } = await rodar(sb.from('convites').delete().eq('id', id).select('id'));
    if (!data.length) throw new Error('Só o master cancela convites de administradores.');
  },
  async exportacaoRegistrar(tabela, descricao, quantidade) {
    await rpc('exportacao_registrar', { p_tabela: tabela, p_descricao: descricao, p_quantidade: quantidade });
  },

  async escritorioSalvar(dados) {
    await rpc('escritorio_salvar', { p: dados });
    ctx = null;   // a barra lateral e os convites passam a usar os dados novos
  },
  async trocasDeEmailListar(limite = TROCAS_DE_EMAIL_MOSTRADAS) {
    const { data } = await rodar(sb.from('auditoria').select('id, tabela, registro_id, acao, resumo, feito_por, em')
      .eq('acao', 'troca_email').order('em', { ascending: false }).limit(limite));
    return data;
  },
  async auditoriaListar(limite = REGISTRO_DE_ACOES) {
    const { data } = await rodar(sb.from('auditoria').select('id, tabela, registro_id, acao, resumo, feito_por, em')
      .order('em', { ascending: false }).limit(limite));
    return data;
  }
};
