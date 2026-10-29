// Versão de teste da camada de dados, com pessoas fictícias guardadas na aba do navegador.
// Usada em "npm run teste" e nos testes (unitários, de componente e de ponta a ponta). Segue o mesmo contrato de dados/supabase.ts.
// Para recomeçar do zero, rode no console: SEMPER_FALSO.reiniciar()
// Os testes de ponta a ponta (app/e2e/) usam as pessoas, colunas e o escritório da semente pelo nome:
// ao mudar a semente, rode "npm run testar-telas" para conferir.
import type {
  AcessoSigilo, Coluna, Contexto, Contrato, ContratoLista, Convite, Dados, DadosContrato, DadosEscritorio, ParticipanteGravado, FiltroContratos, FiltroPessoas, Historico, Membro, Modulo,
  Ordem, Papel, VinculoTipo, Pessoa, PessoaLista, PessoaResumida, RegistroAuditoria, Sigilo
} from './tipos';
import { telefoneNormal, TIPO_REPRESENTANTE } from '../regras/pessoa';
import { limparObjetos, numeroContrato, papeisNoContrato, siglaAdvogado, textoDosParticipantes } from '../regras/contrato';
import { normal } from '../regras/texto';
import { CLIENTES_MAXIMOS, OBJETOS_MAXIMOS, PARTICIPANTES_MAXIMOS, POR_COLUNA, POR_PAGINA, TAMANHO_CONTRATO } from './limites';
import { DIA } from '../ui/tempos';

const CHAVE = 'semper-dados-falsos';
const espera = <T>(v: T): Promise<T> => new Promise(r => setTimeout(() => r(structuredClone(v)), 60));
const novoId = () => crypto.randomUUID();
const codigo = () => Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, '0');
const codigoConvite = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
const agora = () => new Date().toISOString();
/** Quem está logado no banco fictício: o master do escritório de exemplo. */
const eu = 'u-master';

// O CPF de cada um dá a sigla dos contratos de que é responsável (2 letras do nome e 2 últimos dígitos do CPF).
type MembroFalso = Required<Omit<Membro, 'cor' | 'pessoa_id'>> & { cor: string | null; pessoa_id: string; email: string; cpf: string };
const EQUIPE: MembroFalso[] = [
  { id: 'u-master', nome: 'Mateus Freitas Gonçalves', usuario: 'mateus.goncalves', papel: 'master', ativo: true, cor: null, pessoa_id: 'p-mateus', email: 'mateus@exemplo.com', cpf: '11122233396' },
  { id: 'u-ana', nome: 'Ana Teste Lima', usuario: 'ana.lima', papel: 'admin', ativo: true, cor: null, pessoa_id: 'p-ana', email: 'ana@exemplo.com', cpf: '22233344405' },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', usuario: 'bruno.souza', papel: 'usuario', ativo: true, cor: null, pessoa_id: 'p-bruno', email: 'bruno@exemplo.com', cpf: '33344455508' },
  { id: 'u-carla', nome: 'Carla Fictícia Rocha', usuario: 'carla.rocha', papel: 'usuario', ativo: false, cor: null, pessoa_id: 'p-carla', email: 'carla@exemplo.com', cpf: '44455566619' }
];
const ETAPAS = ['Lead', 'Entrar em contato', 'Retornar contato', 'Reunião/atendimento', 'Atendimento em andamento',
  'Levantamento de informações', 'Orçamento solicitado', 'Orçamento em andamento', 'Orçamento enviado', 'Enviar carta proposta',
  'Contrato em andamento', 'Confecção de documentos', 'Mensagem de boas-vindas', 'Efetuar cobrança', 'Pesquisa de satisfação',
  'Pendência/observações', 'Pendente tratamento', 'Não conversão'];
/** Colunas iniciais do quadro de contratos (as mesmas sugestões do banco, banco/009_contratos.sql). */
const SITUACOES_CONTRATO = ['Em negociação', 'Aguardando assinatura', 'Assinado / em andamento', 'Encerrado', 'Rescindido'];
const SUGESTOES: Partial<Record<Modulo, string[]>> = { pessoas: ETAPAS, contratos: SITUACOES_CONTRATO };
/** Contrato como fica guardado: sem as pessoas, que são lidas na hora (como as junções do banco); os participantes, pelo id. */
type ContratoGuardado = Omit<Contrato, 'clientes' | 'cliente_nome' | 'participantes' | 'indicador'> & { clientes: string[]; participantes: ParticipanteGravado[] };

interface Banco {
  pessoas: Pessoa[];
  colunas: (Omit<Coluna, 'oculta'> & { modulo?: Modulo })[];   // sem módulo: pessoas (semente anterior aos contratos)
  ocultas: string[];
  historico: (Historico & { pessoa_id: string })[];
  sigilos: { id: string; pessoa_id: string; texto: string; criado_por: string; criado_em: string; atualizado_em: string }[];
  acessos: { pessoa_id: string; perfil_id: string; concedido_em: string }[];
  convites: Convite[];
  auditoria: RegistroAuditoria[];
  perfil: { nome?: string; usuario?: string; preferencias: Record<string, unknown> };
  logado: boolean;
  tiposVinculo?: VinculoTipo[];
  vinculos?: { id: string; pessoa_de: string; pessoa_para: string; tipo_id: string; descricao: string | null; criado_por: string; criado_em: string }[];
  duasEtapas?: { id: string; ativo: boolean; criado_em: string }[];
  semCodigo?: boolean;   // entrou só com a senha e ainda falta o código do aplicativo
  escritorio?: DadosEscritorio;
  contratos?: ContratoGuardado[];
  historicoContratos?: (Historico & { contrato_id: string })[];
  /** Lista de objetos do escritório (objeto_sugestoes no banco). */
  objetosSugeridos?: string[];
}
// No modo de teste, o código do aplicativo autenticador é sempre 123456.
const CODIGO_TESTE = '123456';
const QR_TESTE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="#fff"/><path d="M1 1h7v7H1zM13 1h7v7h-7zM1 13h7v7H1zM10 10h2v2h-2zM14 14h3v3h-3z" fill="#000"/></svg>');

function semente(): Banco {
  const colunas = ETAPAS.map((nome, i) => ({ id: 'c' + (i + 1), nome, ordem: i + 1, criado_por: null }));
  const nomes = ['JOSÉ DA SILVA TESTE', 'MARIA APARECIDA EXEMPLO', 'JOÃO PEDRO FICTÍCIO', 'ANTÔNIA SOUZA DEMONSTRAÇÃO', 'FRANCISCO LIMA MODELO',
    'LUCIANA ROCHA AMOSTRA', 'PAULO HENRIQUE SIMULADO', 'CARLA BEATRIZ PROTÓTIPO', 'RAIMUNDO NONATO ENSAIO', 'TEREZA CRISTINA PILOTO',
    'SEBASTIÃO ALVES TESTE', 'JOANA DARC EXEMPLO', 'MANOEL FERREIRA FICTÍCIO', 'ROSÂNGELA MARIA AMOSTRA', 'GERALDO MAGELA MODELO',
    'APARECIDA DE FÁTIMA ENSAIO', 'VALDIR JOSÉ SIMULADO', 'MARLENE PEREIRA PILOTO', 'EDSON ARANTES DEMONSTRAÇÃO', 'NEUSA MARIA PROTÓTIPO'];
  const empresas = ['PADARIA PÃO QUENTE EXEMPLO LTDA', 'COMERCIAL NORTE TESTE LTDA', 'ASSOCIAÇÃO DOS PRODUTORES FICTÍCIOS', 'MUNICÍPIO DE EXEMPLÓPOLIS',
    'TECNOLOGIA AMOSTRA S.A.', 'COOPERATIVA DEMONSTRAÇÃO'];
  const cpfs = ['52998224725', '11144477735', '39053344705', '74682489070', '12345678909', '98765432100', '04746201094', '61236758012'];
  const cnpjs = ['11625970000107', '11222333000181', '45723174000110'];
  const pessoas: Pessoa[] = [];
  const dia = (n: number) => new Date(Date.now() - n * DIA).toISOString();
  const p = (dados: Partial<Pessoa>) => pessoas.push(Object.assign({
    id: novoId(), codigo: codigo(), tipo: 'pf', nome: '', genero: null, nacionalidade: null, profissao: null, estado_civil: null, rg: null, rg_expedicao: null,
    nome_mae: null, nome_pai: null, nascimento: null, nascimento_municipio: null, nascimento_uf: null, natureza: null, tipo_entidade: null,
    nome_fantasia: null, porte: null, abertura: null, representantes: null, documento: null, cep: null, logradouro: null, numero: null,
    complemento: null, bairro: null, municipio: null, uf: null, telefones: [], emails: [], lgpd_base: 'contrato', lgpd_consentimento: null,
    etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null, criado_por: 'u-master', criado_em: agora(),
    atualizado_por: null, atualizado_em: agora(), resp: [{ perfil_id: 'u-master' }]
  } as Pessoa, dados));
  EQUIPE.forEach(m => p({ id: m.pessoa_id, tipo: 'contato', nome: m.nome.toUpperCase(), documento: m.cpf, emails: [m.email], telefones: ['(38) 3222-0000'], resp: [{ perfil_id: m.id }] }));
  nomes.forEach((nome, i) => p({
    nome, criado_em: dia(40 - i), atualizado_em: dia((i * 7) % 23), genero: i % 2 ? 'f' : 'm', nacionalidade: 'brasileira', profissao: ['lavrador', 'professora', 'comerciante', 'aposentada'][i % 4],
    estado_civil: ['solteiro', 'casado', 'viuvo', 'divorciado'][i % 4], documento: cpfs[i] || null, rg: `MG ${10 + i}.345.678 SSP/MG`,
    nome_mae: 'MÃE DE ' + nome.split(' ')[0], nascimento: `19${50 + i}-0${(i % 9) + 1}-1${i % 9}`, nascimento_municipio: 'Montes Claros', nascimento_uf: 'MG',
    cep: '39400121', logradouro: 'Rua das Flores', numero: String(10 + i), bairro: 'Centro', municipio: i % 3 ? 'Montes Claros' : 'Varzelândia', uf: 'MG',
    telefones: [`(38) 9${String(9000 + i).padStart(4, '0')}-${String(1000 + i * 7).slice(-4)}`], emails: i % 3 ? [] : [`pessoa${i}@exemplo.com`],
    etapa_id: i < 14 ? colunas[i % 6].id : null, etapa_ordem: i < 14 ? i : null,
    resp: i % 4 === 0 ? [{ perfil_id: 'u-master' }, { perfil_id: 'u-bruno' }] : [{ perfil_id: i % 2 ? 'u-ana' : 'u-master' }],
    criado_por: i % 2 ? 'u-ana' : 'u-master', arquivado_em: i >= 18 ? agora() : null
  }));
  empresas.forEach((nome, i) => p({
    tipo: 'pj', criado_em: dia(15 - i * 2), atualizado_em: dia(i * 3 + 1), nome, natureza: i === 2 ? 'sem_fins' : i === 3 ? 'publica' : 'empresarial',
    tipo_entidade: i === 2 ? 'Associação Privada' : i === 3 ? 'Município' : 'Sociedade Empresária Limitada',
    porte: i < 2 ? 'me' : null, documento: cnpjs[i] || null, cep: '39400121', logradouro: 'Avenida Principal', numero: String(100 + i),
    bairro: 'Centro', municipio: 'Montes Claros', uf: 'MG', telefones: ['(38) 3214-55' + (10 + i)], emails: [`contato${i}@empresa.exemplo`],
    representantes: i < 2 ? 'FULANO DE TAL e/ou BELTRANO DE TAL' : null, etapa_id: i < 3 ? colunas[6 + i].id : null, etapa_ordem: i,
    resp: [{ perfil_id: 'u-ana' }]
  }));
  return { pessoas, colunas, ocultas: [], historico: [], sigilos: [], acessos: [], convites: [], auditoria: [], perfil: { preferencias: {} }, logado: true };
}

const TIPOS_VINCULO: [string, string][] = [['Cônjuge', 'Cônjuge'], ['Companheiro(a)', 'Companheiro(a)'], ['Pai/mãe de', 'Filho(a) de'],
  ['Irmão(ã) de', 'Irmão(ã) de'], ['Sócio(a) de', 'Tem como sócio(a)'], ['Representante legal de', 'Representado(a) por'],
  ['Procurador(a) de', 'Tem como procurador(a)'], ['Funcionário(a) de', 'Empregador(a) de'], ['Contador(a) de', 'Tem como contador(a)'],
  ['Indicou', 'Indicado(a) por'], ['Outro', 'Outro']];
let bd: Banco;
try { bd = JSON.parse(sessionStorage.getItem(CHAVE) || 'null') || semente(); } catch { bd = semente(); }
bd.tiposVinculo ??= TIPOS_VINCULO.map(([nome, inverso], i) => ({ id: 'tv' + (i + 1), escritorio_id: null, nome, inverso, ordem: i === TIPOS_VINCULO.length - 1 ? 1000 : (i + 1) * 10 }));
bd.vinculos ??= [];
bd.escritorio ??= { nome: 'Escritório Exemplo (teste)', logo: null, cnpj: null, oab_registro: null, logradouro: null, numero: null, complemento: null,
  bairro: null, municipio: 'Montes Claros', uf: 'MG', cep: null, telefone: null, email: null, site: null };
// Contratos de exemplo, com clientes da semente e números como os do banco (sigla do responsável, sequencial, ano).
function sementeContratos(): ContratoGuardado[] {
  const ano = new Date().getFullYear();
  // [clientes (separados por ";"), responsável, objetos (separados por ";"), categoria, valor, coluna]
  const casos: [string, string, string, Contrato['categoria'], number | null, string | null][] = [
    ['JOSÉ DA SILVA TESTE', 'u-master', 'Registro de marca; Busca de anterioridade', 'pro_labore', 3000, 'k3'],
    ['MARIA APARECIDA EXEMPLO', 'u-ana', 'Ação de cobrança', 'quota_litis', null, 'k1'],
    ['PADARIA PÃO QUENTE EXEMPLO LTDA', 'u-master', 'Consultoria e assessoria jurídica', 'pro_labore', 12000, 'k3'],
    ['JOÃO PEDRO FICTÍCIO; TEREZA CRISTINA PILOTO', 'u-bruno', 'Divórcio consensual', 'pro_labore', 4500, 'k2'],
    ['ANTÔNIA SOUZA DEMONSTRAÇÃO', 'u-ana', 'Inventário extrajudicial', 'pro_labore', 8000, 'k4'],
    ['COMERCIAL NORTE TESTE LTDA', 'u-master', 'Ação de indenização por danos morais', 'sucumbencia', null, null]
  ];
  return casos.flatMap(([nomes, resp, servico, categoria, valor, etapa], i) => {
    const clientes = nomes.split('; ').map(nome => bd.pessoas.find(p => p.nome === nome)?.id).filter(id => id !== undefined);
    const m = EQUIPE.find(x => x.id === resp)!, sigla = siglaAdvogado(m.nome, m.cpf)!;
    if (!clientes.length) return [];
    return [{
      ...contratoNovo(), id: novoId(), numero: i + 1, sigla, ano, codigo: numeroContrato(sigla, i + 1, ano),
      codigo_antigo: i === 0 ? 'MA96-JO25-001/24' : null, cliente_id: clientes[0], clientes, responsavel_id: resp,
      objetos: limparObjetos(servico.split(';')), servico, categoria,
      valor, entrada: valor ? valor / 5 : null, parcelas: valor ? 5 : null, percentual_escritorio: valor ? 30 : null,
      assinado_em: etapa === 'k3' || etapa === 'k4' ? `${ano}-03-10` : null, etapa_id: etapa, etapa_ordem: etapa ? i : null, criado_por: resp
    }];
  });
}
/** Contrato com os campos que não vêm no cadastro já vazios (como os padrões do banco). */
function contratoNovo(): ContratoGuardado {
  return {
    id: '', codigo: '', numero: 0, sigla: '', ano: 0, codigo_antigo: null, cliente_id: '', clientes: [], responsavel_id: '', objetos: [], servico: '', categoria: 'pro_labore',
    valor: null, entrada: null, parcelas: null, descontos: null, assinado_em: null, primeiro_pagamento: null, percentual_escritorio: null,
    participantes: [], indicador_id: null, indicador_percentual: null, documento_url: null, observacoes: null,
    etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null, criado_por: eu, criado_em: agora(), atualizado_por: null, atualizado_em: agora()
  };
}
// Sessões abertas antes dos contratos: a equipe ganha o CPF; os contratos, as colunas e a semente deles.
for (const m of EQUIPE) { const pessoa = bd.pessoas.find(x => x.id === m.pessoa_id); if (pessoa && !pessoa.documento) pessoa.documento = m.cpf; }
if (!bd.colunas.some(c => c.modulo === 'contratos')) {
  bd.colunas.push(...SITUACOES_CONTRATO.map((nome, i) => ({ id: 'k' + (i + 1), nome, ordem: i + 1, criado_por: null, modulo: 'contratos' as const })));
}
// A coluna "Assinado / em andamento" de Contratos é a coluna-marco do contrato assinado (como a migração 014).
bd.colunas.forEach(c => { if (c.modulo === 'contratos' && c.id === 'k3') c.marco = 'assinado'; });
bd.contratos ??= sementeContratos();
bd.historicoContratos ??= [];
// Sessões abertas antes dos vários objetos: o serviço vira a lista (como a migração 010), que entra na lista do escritório.
bd.contratos.forEach(k => { k.objetos ??= limparObjetos(k.servico.split(';')); });
bd.objetosSugeridos ??= limparObjetos(bd.contratos.flatMap(k => k.objetos));
// Sessões abertas antes dos vários participantes: o participante antigo entra na lista (como a migração 012).
// E antes dos vários clientes: o cliente entra na lista (como a migração 013).
bd.contratos.forEach(k => { k.clientes ??= [k.cliente_id]; });
bd.contratos.forEach(k => {
  const antigo = k as unknown as { participante_id?: string | null; participante_percentual?: number | null };
  k.participantes ??= antigo.participante_id ? [{ pessoa_id: antigo.participante_id, percentual: antigo.participante_percentual ?? null }] : [];
});
const gravar = () => { try { sessionStorage.setItem(CHAVE, JSON.stringify(bd)); } catch { /* sem armazenamento */ } };
gravar();
(window as unknown as { SEMPER_FALSO: unknown }).SEMPER_FALSO = { reiniciar: () => { sessionStorage.removeItem(CHAVE); location.reload(); } };

const auditar = (tabela: string, acao: string, p?: { id: string; nome?: string; codigo?: string }) =>
  bd.auditoria.unshift({ id: Date.now() + Math.random(), tabela, registro_id: p?.id ?? null, acao, resumo: { nome: p?.nome, codigo: p?.codigo }, feito_por: eu, em: agora() });
const busca = (p: Pessoa) => normal([p.nome, p.nome_fantasia, p.documento, p.codigo, ...(p.telefones || []).map(telefoneNormal), ...(p.emails || []), p.municipio].join(' '));
function termo(texto?: string) {
  const t = String(texto || '').trim();
  if (!t) return '';
  if (/\d/.test(t) && /^[\d\s.\-/()+]+$/.test(t)) return t.replace(/\D/g, '');
  return normal(t);
}
function filtrar(f: FiltroPessoas = {}) {
  const t = termo(f.termo);
  return bd.pessoas.filter(p => (f.situacao === 'arquivadas' ? p.arquivado_em : !p.arquivado_em)
    && (!f.tipo || p.tipo === f.tipo)
    && (!f.responsavel || p.resp.some(r => r.perfil_id === f.responsavel))
    && (!t || busca(p).includes(t)));
}
const lista = (p: Pessoa): PessoaLista => ({
  id: p.id, codigo: p.codigo, tipo: p.tipo, nome: p.nome, nome_fantasia: p.nome_fantasia, documento: p.documento, telefones: p.telefones,
  emails: p.emails, municipio: p.municipio, uf: p.uf, etapa_id: p.etapa_id, etapa_ordem: p.etapa_ordem, arquivado_em: p.arquivado_em,
  criado_por: p.criado_por, criado_em: p.criado_em, atualizado_em: p.atualizado_em, resp: p.resp
});
const ORDENS: Record<Ordem, (a: Pessoa, b: Pessoa) => number> = {
  manual: (a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || a.nome.localeCompare(b.nome),
  nome: (a, b) => a.nome.localeCompare(b.nome),
  nome_desc: (a, b) => b.nome.localeCompare(a.nome),
  novos: (a, b) => b.criado_em.localeCompare(a.criado_em),
  antigos: (a, b) => a.criado_em.localeCompare(b.criado_em),
  recentes: (a, b) => b.atualizado_em.localeCompare(a.atualizado_em)
};
const erro = (t: string) => Promise.reject(new Error(t));
// Como no banco: o vínculo incluído ou retirado entra no histórico das duas pessoas.
function historicoVinculo(v: NonNullable<Banco['vinculos']>[number], incluido: boolean) {
  const t = bd.tiposVinculo!.find(x => x.id === v.tipo_id)!, obs = v.descricao ? ` (${v.descricao})` : '';
  const nome = (id: string) => bd.pessoas.find(p => p.id === id)?.nome || 'pessoa excluída';
  for (const [pessoa, texto] of [[v.pessoa_de, `${t.nome} ${nome(v.pessoa_para)}${obs}`], [v.pessoa_para, `${t.inverso} ${nome(v.pessoa_de)}${obs}`]]) {
    bd.historico.unshift({ id: Date.now() + Math.random(), pessoa_id: pessoa, alteracoes: { vinculo: incluido ? { de: null, para: texto } : { de: texto, para: null } }, feito_por: eu, em: agora() });
  }
}
const achar = (id: string) => {
  const p = bd.pessoas.find(x => x.id === id);
  if (!p) throw new Error('Cadastro não encontrado.');
  return p;
};

// ---------- contratos ----------
const resumoDe = (id: string | null): PessoaResumida | null => {
  const p = id ? bd.pessoas.find(x => x.id === id) : null;
  return p ? { id: p.id, codigo: p.codigo, nome: p.nome, tipo: p.tipo, arquivado_em: p.arquivado_em } : null;
};
const contratoCompleto = (k: ContratoGuardado): Contrato =>
  ({ ...k, clientes: k.clientes.map(id => resumoDe(id)!), cliente_nome: nomeDoCliente(k), participantes: k.participantes.map(p => ({ pessoa: resumoDe(p.pessoa_id)!, percentual: p.percentual })),
     indicador: resumoDe(k.indicador_id) });
const contratoLista = (k: ContratoGuardado): ContratoLista => ({
  id: k.id, codigo: k.codigo, codigo_antigo: k.codigo_antigo, servico: k.servico, categoria: k.categoria, valor: k.valor,
  responsavel_id: k.responsavel_id, etapa_id: k.etapa_id, etapa_ordem: k.etapa_ordem, arquivado_em: k.arquivado_em,
  criado_por: k.criado_por, criado_em: k.criado_em, atualizado_em: k.atualizado_em, cliente_nome: nomeDoCliente(k)
});
/** Como cliente_nome no banco: os nomes de todos os clientes, juntos ("A; B"). */
const nomeDoCliente = (k: ContratoGuardado) => k.clientes.map(id => bd.pessoas.find(p => p.id === id)?.nome ?? 'pessoa excluída').join('; ');
// Como a coluna "busca" do banco: o número entra também só com os dígitos, para a busca por "0163/2026" achar.
const buscaContrato = (k: ContratoGuardado) => normal([k.codigo, k.codigo.replace(/\D/g, ''), k.codigo_antigo, k.servico, nomeDoCliente(k)].join(' '));
function filtrarContratos(f: FiltroContratos = {}) {
  const t = termo(f.termo);
  return bd.contratos!.filter(k => (f.situacao === 'arquivados' ? k.arquivado_em : !k.arquivado_em)
    && (!f.responsavel || k.responsavel_id === f.responsavel)
    && (!f.categoria || k.categoria === f.categoria)
    && (!t || buscaContrato(k).includes(t)));
}
// Na ordem "nome", vale o nome do cliente; nos empates, o contrato mais novo primeiro.
const ORDENS_CONTRATO: Record<Ordem, (a: ContratoGuardado, b: ContratoGuardado) => number> = {
  manual: (a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || b.numero - a.numero,
  nome: (a, b) => nomeDoCliente(a).localeCompare(nomeDoCliente(b)) || b.numero - a.numero,
  nome_desc: (a, b) => nomeDoCliente(b).localeCompare(nomeDoCliente(a)) || b.numero - a.numero,
  novos: (a, b) => b.criado_em.localeCompare(a.criado_em) || b.numero - a.numero,
  antigos: (a, b) => a.criado_em.localeCompare(b.criado_em) || a.numero - b.numero,
  recentes: (a, b) => b.atualizado_em.localeCompare(a.atualizado_em) || b.numero - a.numero
};
const acharContrato = (id: string) => {
  const k = bd.contratos!.find(x => x.id === id);
  if (!k) throw new Error('Contrato não encontrado.');
  return k;
};
const nomeDaColuna = (id: string | null) => bd.colunas.find(c => c.id === id)?.nome || null;
// Das pessoas, do responsável e da coluna, o histórico guarda o nome (como no banco), não o id.
const nomeDaPessoa = (id: unknown) => bd.pessoas.find(p => p.id === id)?.nome ?? null;
const NOME_NO_HISTORICO: Record<string, [string, (id: unknown) => unknown]> = {
  clientes: ['clientes', lista => (lista as string[] | null ?? []).map(nomeDaPessoa).join(', ') || null],
  participantes: ['participantes', lista => textoDosParticipantes((lista as ParticipanteGravado[] | null ?? [])
    .map(p => ({ nome: nomeDaPessoa(p.pessoa_id) ?? 'pessoa excluída', percentual: p.percentual })))],
  indicador_id: ['indicador_id', nomeDaPessoa],
  responsavel_id: ['responsavel_id', id => EQUIPE.find(m => m.id === id)?.nome ?? null],
  etapa_id: ['etapa', id => nomeDaColuna((id as string) || null)]
};
// A mudança dos objetos entra no histórico uma vez só, pelo texto de "servico" ("a; b" → "a; c").
const FORA_DO_HISTORICO = new Set(['etapa_ordem', 'arquivado_por', 'objetos', 'cliente_id']);
/** Como o gatilho do banco: o que mudou, campo a campo, entra no histórico do contrato. */
function historicoContrato(k: ContratoGuardado, dados: Record<string, unknown>) {
  const atual = k as unknown as Record<string, unknown>, alt: Historico['alteracoes'] = {};
  Object.entries(dados).forEach(([campo, v]) => {
    if (!FORA_DO_HISTORICO.has(campo) && JSON.stringify(atual[campo] ?? null) !== JSON.stringify(v ?? null)) {
      const [chave, nome] = NOME_NO_HISTORICO[campo] ?? [campo, (x: unknown) => x];
      alt[chave] = { de: nome(atual[campo] ?? null), para: nome(v ?? null) };
    }
  });
  if (Object.keys(alt).length) bd.historicoContratos!.unshift({ id: Date.now() + Math.random(), contrato_id: k.id, alteracoes: alt, feito_por: eu, em: agora() });
}
/**
 * Como os gatilhos da migração 010: objetos limpos e "servico" igual a eles. Quem grava só o texto (a versão anterior
 * do site) tem os objetos tirados dele, separados por ";".
 */
function ajustarObjetos(dados: DadosContrato, atual?: ContratoGuardado): DadosContrato {
  if (atual && dados.objetos === undefined && dados.servico === undefined) return dados;
  const mesmosObjetos = JSON.stringify(dados.objetos ?? atual?.objetos) === JSON.stringify(atual?.objetos);
  const doTexto = atual ? mesmosObjetos && dados.servico !== undefined && dados.servico !== atual.servico : !dados.objetos?.length;
  const objetos = limparObjetos(doTexto ? (dados.servico ?? '').split(';') : dados.objetos ?? atual!.objetos);
  if (!objetos.length) throw new Error('Informe ao menos um objeto do contrato.');
  if (objetos.length > OBJETOS_MAXIMOS) throw new Error(`Um contrato pode ter até ${OBJETOS_MAXIMOS} objetos.`);
  if (objetos.some(o => o.length > TAMANHO_CONTRATO.objeto)) throw new Error(`Cada objeto do contrato pode ter até ${TAMANHO_CONTRATO.objeto} caracteres.`);
  return { ...dados, objetos, servico: objetos.join('; ') };
}
/**
 * Como o gatilho da migração 013: clientes do escritório, sem repetir, ao menos um e no máximo 10; o primeiro fica em
 * cliente_id. Quem grava só cliente_id (a versão anterior do site) troca a lista por esse cliente.
 */
function ajustarClientes(dados: DadosContrato, atual?: ContratoGuardado): DadosContrato {
  if (atual && dados.clientes === undefined && dados.cliente_id === undefined) return dados;
  const doAntigo = atual ? dados.clientes === undefined && dados.cliente_id !== atual.cliente_id : !dados.clientes?.length;
  const lista = [...new Set((doAntigo ? [dados.cliente_id ?? ''] : dados.clientes ?? atual!.clientes).filter(Boolean))];
  if (!lista.length) throw new Error('Escolha o cliente.');
  if (lista.length > CLIENTES_MAXIMOS) throw new Error(`Um contrato pode ter até ${CLIENTES_MAXIMOS} clientes.`);
  if (lista.some(id => !bd.pessoas.some(p => p.id === id))) throw new Error('Cliente não encontrado neste escritório.');
  return { ...dados, clientes: lista, cliente_id: lista[0] };
}
/**
 * Como o gatilho da migração 012: cada participante do escritório, sem repetir, diferente do indicador, com % de 0 a 100.
 * Só confere quando a lista ou o indicador mudam.
 */
function ajustarParticipantes(dados: DadosContrato, atual?: ContratoGuardado): DadosContrato {
  if (dados.participantes === undefined && dados.indicador_id === undefined) return dados;
  const lista = dados.participantes ?? atual?.participantes ?? [], indicador = dados.indicador_id ?? atual?.indicador_id ?? null;
  if (lista.length > PARTICIPANTES_MAXIMOS) throw new Error(`Um contrato pode ter até ${PARTICIPANTES_MAXIMOS} participantes.`);
  lista.forEach((p, i) => {
    if (p.percentual !== null && (p.percentual < 0 || p.percentual > 100)) throw new Error('Use um percentual de 0 a 100.');
    if (p.pessoa_id === indicador) throw new Error('O indicador e os participantes precisam ser pessoas diferentes.');
    if (lista.findIndex(x => x.pessoa_id === p.pessoa_id) < i) throw new Error('A mesma pessoa aparece duas vezes nos participantes.');
    if (!bd.pessoas.some(x => x.id === p.pessoa_id)) throw new Error('Participante não encontrado neste escritório.');
  });
  return dados.participantes === undefined ? dados : { ...dados, participantes: lista.map(p => ({ pessoa_id: p.pessoa_id, percentual: p.percentual })) };
}
/** Cada objeto salvo entra na lista do escritório, uma vez só (ignorando maiúsculas e acentos). */
const guardarObjetos = (objetos: string[]) => { bd.objetosSugeridos = limparObjetos([...bd.objetosSugeridos!, ...objetos]); };
/** Pessoas que aparecem em algum contrato (cliente, participante ou indicador) não podem ser excluídas. */
const temContrato = (pessoaId: string) => bd.contratos!.some(k =>
  [...k.clientes, k.indicador_id].includes(pessoaId) || k.participantes.some(p => p.pessoa_id === pessoaId));

export const SD: Dados = {
  sessao: () => espera(bd.logado ? { user: { id: eu, email: 'mateus@exemplo.com' } } : null),
  entrar: async () => { bd.logado = true; bd.semCodigo = !!bd.duasEtapas?.some(f => f.ativo); gravar(); },
  primeiroAcesso: async () => ({ entrou: false }),
  recuperarSenha: async () => {},
  confirmarLink: async () => { bd.logado = true; gravar(); },
  novaSenha: async () => {},
  sair: async () => { bd.logado = false; bd.semCodigo = false; gravar(); },
  aoMudarSessao: () => () => {},
  async contexto() {
    if (!bd.logado) return null;
    const m = EQUIPE[0];
    const c: Contexto = {
      usuario: { id: eu, email: m.email },
      perfil: { id: eu, escritorio_id: 'e1', pessoa_id: m.pessoa_id, nome: bd.perfil.nome || m.nome, usuario: bd.perfil.usuario || m.usuario,
        papel: 'master', ativo: true, cor: null, oab: null, preferencias: bd.perfil.preferencias },
      escritorio: { id: 'e1', slug: 'teste', modulos: { pessoas: true, contratos: true }, ...bd.escritorio! },
      equipe: EQUIPE.map(({ email: _email, cpf: _cpf, ...r }) => r), ehAdmin: true, ehMaster: true
    };
    return espera(c);
  },
  async salvarPerfil(campos) { Object.assign(bd.perfil, campos); gravar(); },

  duasEtapasFatores: () => espera(bd.duasEtapas ?? []),
  async duasEtapasIniciar() {
    const f = { id: novoId(), ativo: false, criado_em: agora() };
    bd.duasEtapas = [...(bd.duasEtapas ?? []).filter(x => x.ativo), f]; gravar();
    return espera({ id: f.id, qr: QR_TESTE, segredo: 'JBSWY3DPEHPK3PXP' });
  },
  async duasEtapasConfirmar(id, codigo) {
    if (codigo !== CODIGO_TESTE) return erro('Código incorreto ou vencido. (No modo de teste, use 123456.)');
    const f = bd.duasEtapas?.find(x => x.id === id); if (f) f.ativo = true; gravar();
  },
  async duasEtapasDesativar(id) { bd.duasEtapas = (bd.duasEtapas ?? []).filter(x => x.id !== id); gravar(); },
  duasEtapasPendente: () => espera(!!bd.logado && !!bd.semCodigo),
  async duasEtapasEntrar(codigo) { if (codigo !== CODIGO_TESTE) return erro("Código incorreto ou vencido. (No modo de teste, use 123456.)"); bd.semCodigo = false; gravar(); },
  async salvarPreferencia(k, v) { bd.perfil.preferencias = { ...bd.perfil.preferencias, [k]: v }; gravar(); },

  async pessoasListar(f = {}) {
    let r = filtrar(f);
    r = r.sort(ORDENS[f.ordem && f.ordem !== 'manual' ? f.ordem : 'nome']);
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    return espera({ linhas: r.slice(de, de + por).map(lista), total: r.length });
  },
  pessoasExportar: (f = {}) => espera(filtrar(f).sort(ORDENS.nome)),
  async pessoasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrar(f).filter(p => (p.etapa_id || null) === (etapaId || null))
      .sort(ORDENS[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(lista), total: r.length });
  },
  pessoaObter: id => espera(bd.pessoas.find(p => p.id === id) || null),
  pessoaPorDocumento: (doc, exceto) => {
    const p = bd.pessoas.find(x => x.documento === doc && x.id !== exceto);
    return espera(p ? { id: p.id, codigo: p.codigo, nome: p.nome, tipo: p.tipo, arquivado_em: p.arquivado_em } : null);
  },
  pessoasPorTelefones: (tels, exceto) => {
    const t = tels.map(telefoneNormal).filter(x => x.length >= 8);
    return espera(bd.pessoas.filter(p => p.id !== exceto && p.telefones.some(x => t.includes(telefoneNormal(x)))).slice(0, 5)
      .map(p => ({ id: p.id, codigo: p.codigo, nome: p.nome, tipo: p.tipo })));
  },
  async pessoaCriar(dados, resp) {
    if (dados.documento && bd.pessoas.some(p => p.documento === dados.documento)) return erro('Já existe um cadastro com este CPF/CNPJ.');
    const p = Object.assign({ id: novoId(), codigo: codigo(), criado_por: eu, criado_em: agora(), atualizado_em: agora(), arquivado_em: null,
      etapa_id: null, etapa_ordem: null, telefones: [], emails: [] }, dados, { resp: (resp || []).map(perfil_id => ({ perfil_id })) }) as unknown as Pessoa;
    bd.pessoas.push(p); auditar('pessoas', 'inclusao', p); gravar();
    return espera({ id: p.id, codigo: p.codigo });
  },
  async pessoaAtualizar(id, dados, resp) {
    const p = achar(id);
    if (dados.documento && bd.pessoas.some(x => x.documento === dados.documento && x.id !== id)) return erro('Já existe um cadastro com este CPF/CNPJ.');
    const alt: Historico['alteracoes'] = {};
    const atual = p as unknown as Record<string, unknown>;
    Object.entries(dados).forEach(([k, v]) => {
      if (JSON.stringify(atual[k] ?? null) !== JSON.stringify(v ?? null) && k !== 'etapa_ordem' && k !== 'arquivado_por') alt[k] = { de: atual[k] ?? null, para: v ?? null };
    });
    Object.assign(p, dados, { atualizado_em: agora(), atualizado_por: eu });
    if (Array.isArray(resp)) p.resp = resp.map(perfil_id => ({ perfil_id }));
    if (Object.keys(alt).length) bd.historico.unshift({ id: Date.now(), pessoa_id: id, alteracoes: alt, feito_por: eu, em: agora() });
    auditar('pessoas', 'alteracao', p); gravar();
    return espera({ id, codigo: p.codigo });
  },
  async pessoasArquivar(ids, arquivar = true) {
    ids.forEach(id => {
      const p = bd.pessoas.find(x => x.id === id); if (!p) return;
      bd.historico.unshift({ id: Date.now() + Math.random(), pessoa_id: id, alteracoes: { arquivado_em: { de: p.arquivado_em, para: arquivar ? agora() : null } }, feito_por: eu, em: agora() });
      p.arquivado_em = arquivar ? agora() : null; p.atualizado_em = agora();
    });
    gravar(); return espera(ids.length);
  },
  async pessoasExcluir(ids) {
    let excluidas = 0, motivo = '';
    ids.forEach(id => {
      const p = bd.pessoas.find(x => x.id === id);
      if (!p || !p.arquivado_em) return;
      if (EQUIPE.some(m => m.pessoa_id === id)) { motivo = 'Esta pessoa é usuária do sistema e não pode ser excluída.'; return; }
      if (temContrato(id)) { motivo = 'Esta pessoa está em contratos e não pode ser excluída.'; return; }
      bd.pessoas = bd.pessoas.filter(x => x.id !== id); auditar('pessoas', 'exclusao', p); excluidas++;
      const ligados = bd.vinculos!.filter(v => v.pessoa_de === id || v.pessoa_para === id);
      bd.vinculos = bd.vinculos!.filter(v => !ligados.includes(v));
      ligados.forEach(v => historicoVinculo(v, false));
    });
    gravar(); return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo });
  },
  async pessoaMover(id, etapaId, ordem) {
    const p = achar(id);
    const nome = (c: string | null) => bd.colunas.find(x => x.id === c)?.nome || null;
    if ((p.etapa_id || null) !== (etapaId || null)) {
      bd.historico.unshift({ id: Date.now(), pessoa_id: id, alteracoes: { etapa: { de: nome(p.etapa_id), para: nome(etapaId) } }, feito_por: eu, em: agora() });
    }
    p.etapa_id = etapaId; p.etapa_ordem = ordem; p.atualizado_em = agora(); gravar();
  },
  pessoaHistorico: id => espera(bd.historico.filter(h => h.pessoa_id === id)),
  async responsavelIncluir(pid, perfil) { achar(pid).resp.push({ perfil_id: perfil }); gravar(); },
  async responsavelRemover(pid, perfil) { const p = achar(pid); p.resp = p.resp.filter(r => r.perfil_id !== perfil); gravar(); },
  async pessoasResumo() {
    const ativas = bd.pessoas.filter(p => !p.arquivado_em);
    return espera({
      total: ativas.length, minhas: ativas.filter(p => p.resp.some(r => r.perfil_id === eu)).length, mes: ativas.length,
      arquivadas: bd.pessoas.length - ativas.length,
      recentes: ativas.slice().sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em)).slice(0, 6).map(lista)
    });
  },

  sigilosListar: pid => espera<Sigilo[]>(bd.sigilos.filter(s => s.pessoa_id === pid)
    .map(s => ({ ...s, autor: EQUIPE.find(m => m.id === s.criado_por)?.nome || null, pode_editar: true }))),
  async sigiloSalvar(pid, texto, id) {
    const s = id ? bd.sigilos.find(x => x.id === id) : null;
    if (s) Object.assign(s, { texto, atualizado_em: agora() });
    else { id = novoId(); bd.sigilos.push({ id, pessoa_id: pid, texto, criado_por: eu, criado_em: agora(), atualizado_em: agora() }); }
    gravar(); return id as string;
  },
  async sigiloApagar(id) { bd.sigilos = bd.sigilos.filter(s => s.id !== id); gravar(); },
  sigiloAcessos: pid => espera<AcessoSigilo[]>(bd.acessos.filter(a => a.pessoa_id === pid)
    .map(a => ({ ...a, nome: EQUIPE.find(m => m.id === a.perfil_id)?.nome || 'Usuário removido', pode_conceder: true }))),
  async sigiloConceder(pid, perfil, conceder = true) {
    bd.acessos = bd.acessos.filter(a => !(a.pessoa_id === pid && a.perfil_id === perfil));
    if (conceder) bd.acessos.push({ pessoa_id: pid, perfil_id: perfil, concedido_em: agora() });
    gravar();
  },

  vinculoTiposListar: () => espera(bd.tiposVinculo!.slice().sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))),
  async vinculoTipoCriar(nome, inverso) {
    if (bd.tiposVinculo!.some(t => normal(t.nome) === normal(nome) && normal(t.inverso) === normal(inverso || nome))) return erro('Esse tipo de vínculo já existe.');
    const t: VinculoTipo = { id: novoId(), escritorio_id: 'e1', nome: nome.trim(), inverso: (inverso || nome).trim(), ordem: 500 };
    bd.tiposVinculo!.push(t); gravar(); return espera(t);
  },
  vinculosListar: pid => espera(bd.vinculos!.filter(v => v.pessoa_de === pid || v.pessoa_para === pid).map(v => {
    const resumo = (id: string) => { const p = achar(id); return { id: p.id, codigo: p.codigo, nome: p.nome, tipo: p.tipo, arquivado_em: p.arquivado_em }; };
    const t = bd.tiposVinculo!.find(x => x.id === v.tipo_id)!;
    return { ...v, de: resumo(v.pessoa_de), para: resumo(v.pessoa_para), tipo: { id: t.id, nome: t.nome, inverso: t.inverso } };
  })),
  async vinculoCriar(de, para, tipoId, descricao = null) {
    if (de === para) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    const par = [de, para].sort().join();
    if (bd.vinculos!.some(v => v.tipo_id === tipoId && [v.pessoa_de, v.pessoa_para].sort().join() === par)) return erro('Essas duas pessoas já têm esse vínculo.');
    const v = { id: novoId(), pessoa_de: de, pessoa_para: para, tipo_id: tipoId, descricao: descricao?.trim() || null, criado_por: eu, criado_em: agora() };
    bd.vinculos!.push(v); historicoVinculo(v, true); gravar(); return v.id;
  },
  async vinculoApagar(id) {
    const v = bd.vinculos!.find(x => x.id === id); if (!v) return;
    bd.vinculos = bd.vinculos!.filter(x => x.id !== id); historicoVinculo(v, false); gravar();
  },
  representantesVinculados: ids => {
    const tipos = new Set(bd.tiposVinculo!.filter(t => t.nome === TIPO_REPRESENTANTE).map(t => t.id));
    return espera(bd.vinculos!.filter(v => tipos.has(v.tipo_id) && ids.includes(v.pessoa_para))
      .flatMap(v => { const pessoa = bd.pessoas.find(p => p.id === v.pessoa_de); return pessoa ? [{ pj_id: v.pessoa_para, pessoa, funcao: v.descricao }] : []; }));
  },

  // ---------- contratos ----------
  async contratosListar(f = {}) {
    const r = filtrarContratos(f).sort(ORDENS_CONTRATO[f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos']);
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    return espera({ linhas: r.slice(de, de + por).map(contratoLista), total: r.length });
  },
  async contratosDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrarContratos(f).filter(k => (k.etapa_id || null) === (etapaId || null)).sort(ORDENS_CONTRATO[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(contratoLista), total: r.length });
  },
  contratoObter: id => { const k = bd.contratos!.find(x => x.id === id); return espera(k ? contratoCompleto(k) : null); },
  // Como o gatilho do banco: o número vem da sigla do responsável (CPF no cadastro dele), do sequencial do ano e do ano.
  // O sequencial é o maior número que existe no ano, mais um: o número do último contrato excluído volta a ser usado.
  async contratoCriar(dados) {
    const resp = EQUIPE.find(m => m.id === dados.responsavel_id);
    const sigla = resp ? siglaAdvogado(resp.nome, bd.pessoas.find(p => p.id === resp.pessoa_id)?.documento) : null;
    if (!resp || !sigla) return erro(`Cadastre o CPF de ${resp?.nome || 'quem é o responsável'} em Pessoas para gerar o número do contrato.`);
    const d = ajustarClientes(ajustarParticipantes(ajustarObjetos(dados)));
    const ano = new Date().getFullYear(), numero = Math.max(0, ...bd.contratos!.filter(x => x.ano === ano).map(x => x.numero)) + 1;
    const k: ContratoGuardado = { ...contratoNovo(), ...d, id: novoId(), numero, sigla, ano, codigo: numeroContrato(sigla, numero, ano) };
    bd.contratos!.push(k); guardarObjetos(k.objetos); auditar('contratos', 'inclusao', k); gravar();
    return espera({ id: k.id, codigo: k.codigo });
  },
  async contratoAtualizar(id, dados) {
    const k = acharContrato(id), d = ajustarClientes(ajustarParticipantes(ajustarObjetos(dados, k), k), k);
    historicoContrato(k, d);
    Object.assign(k, d, { atualizado_em: agora(), atualizado_por: eu });
    guardarObjetos(k.objetos); auditar('contratos', 'alteracao', k); gravar();
    return espera({ id, codigo: k.codigo });
  },
  async contratosArquivar(ids, arquivar = true) {
    ids.forEach(id => {
      const k = bd.contratos!.find(x => x.id === id); if (!k) return;
      historicoContrato(k, { arquivado_em: arquivar ? agora() : null });
      Object.assign(k, { arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? eu : null, atualizado_em: agora() });
    });
    gravar(); return espera(ids.length);
  },
  async contratosExcluir(ids) {
    let excluidas = 0;
    ids.forEach(id => {
      const k = bd.contratos!.find(x => x.id === id);
      if (!k || !k.arquivado_em) return;
      bd.contratos = bd.contratos!.filter(x => x.id !== id);
      bd.historicoContratos = bd.historicoContratos!.filter(h => h.contrato_id !== id);
      auditar('contratos', 'exclusao', k); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só contratos arquivados podem ser excluídos.' : '' });
  },
  async contratoMover(id, etapaId, ordem) {
    const k = acharContrato(id);
    if ((k.etapa_id || null) !== (etapaId || null)) {
      bd.historicoContratos!.unshift({ id: Date.now() + Math.random(), contrato_id: id, alteracoes: { etapa: { de: nomeDaColuna(k.etapa_id), para: nomeDaColuna(etapaId) } }, feito_por: eu, em: agora() });
    }
    Object.assign(k, { etapa_id: etapaId, etapa_ordem: ordem, atualizado_em: agora() }); gravar();
  },
  contratoHistorico: id => espera(bd.historicoContratos!.filter(h => h.contrato_id === id)),
  objetosSugeridos: () => espera([...bd.objetosSugeridos!].sort((a, b) => a.localeCompare(b, 'pt-BR'))),
  contratosDaPessoa: (pessoaId, perfilId = null) => espera(bd.contratos!
    .map(k => ({ k, papeis: papeisNoContrato({ ...k, participantes: k.participantes.map(p => p.pessoa_id) }, pessoaId, perfilId) }))
    .filter(x => x.papeis.length)
    .sort((a, b) => b.k.criado_em.localeCompare(a.k.criado_em))
    .map(({ k, papeis }) => ({ id: k.id, codigo: k.codigo, servico: k.servico, etapa_id: k.etapa_id, arquivado_em: k.arquivado_em, criado_em: k.criado_em, papeis }))),

  // ---------- quadros: cada módulo tem as suas colunas ----------
  colunasListar: modulo => espera(bd.colunas.filter(c => (c.modulo ?? 'pessoas') === modulo).sort((a, b) => a.ordem - b.ordem)
    .map(({ modulo: _m, ...c }) => ({ ...c, oculta: bd.ocultas.includes(c.id) }))),
  sugestoesListar: modulo => espera(SUGESTOES[modulo] ?? []),
  async colunaCriar(modulo, nome, ordem) {
    if (bd.colunas.some(c => (c.modulo ?? 'pessoas') === modulo && normal(c.nome) === normal(nome))) return erro('Já existe uma coluna com esse nome neste quadro.');
    const c = { id: novoId(), nome: nome.trim(), ordem, criado_por: eu }; bd.colunas.push({ ...c, modulo }); gravar(); return espera({ ...c, oculta: false });
  },
  async colunaOcultar(id, ocultar) { bd.ocultas = ocultar ? [...new Set([...bd.ocultas, id])] : bd.ocultas.filter(x => x !== id); gravar(); },
  async colunaRenomear(id, nome) { const c = bd.colunas.find(x => x.id === id); if (c) c.nome = nome; gravar(); },
  async colunaOrdenar(id, ordem) { const c = bd.colunas.find(x => x.id === id); if (c) c.ordem = ordem; gravar(); },
  async colunaExcluir(id) {
    if (bd.colunas.find(c => c.id === id)?.marco) return erro('Só administradores excluem colunas, e a coluna-marco não pode ser excluída.');
    bd.colunas = bd.colunas.filter(c => c.id !== id);
    for (const item of [...bd.pessoas, ...bd.contratos!]) if (item.etapa_id === id) item.etapa_id = null;
    gravar();
  },

  equipeListar: () => espera(EQUIPE.map(({ cpf: _cpf, ...m }) => ({ ...m, criado_em: agora(), ultimo_acesso: m.ativo ? agora() : null, confirmado: m.id !== 'u-bruno' }))),
  async conviteCriar(pid, email, papel: Papel) {
    const p = achar(pid);
    // Como o índice convites_email_pendente do banco: um só convite pendente por e-mail.
    if (bd.convites.some(c => c.email.toLowerCase() === email.toLowerCase())) return erro('Este e-mail já tem um convite pendente.');
    const c: Convite = { id: novoId(), email, nome: p.nome, papel, pessoa_id: pid, criado_em: agora() }; bd.convites.unshift(c); gravar();
    return espera({ ...c, codigo: codigoConvite() });
  },
  conviteNovoLink: () => espera(codigoConvite()),
  async equipeDefinirPapel(id, papel) { const m = EQUIPE.find(x => x.id === id); if (m) m.papel = papel; },
  async equipeDefinirAtivo(id, ativo) { const m = EQUIPE.find(x => x.id === id); if (m) m.ativo = ativo; },
  convitesListar: () => espera(bd.convites),
  async conviteCancelar(id) { bd.convites = bd.convites.filter(c => c.id !== id); gravar(); },
  auditoriaListar: (n = 50) => espera(bd.auditoria.slice(0, n)),
  async escritorioSalvar(dados) {
    const atual = bd.escritorio!;
    bd.escritorio = { ...atual, ...dados, logo: dados.logo === undefined ? atual.logo : dados.logo };
    bd.auditoria.unshift({ id: Date.now() + Math.random(), tabela: 'escritorios', registro_id: 'e1', acao: 'alteracao', resumo: { nome: dados.nome }, feito_por: eu, em: agora() });
    gravar(); await espera(null);
  },
  async exportacaoRegistrar(tabela, descricao, quantidade) {
    bd.auditoria.unshift({ id: Date.now() + Math.random(), tabela, registro_id: null, acao: 'exportacao', resumo: { descricao, quantidade }, feito_por: eu, em: agora() });
    gravar();
  }
};
