// Versão de teste da camada de dados, com pessoas fictícias guardadas na aba do navegador.
// Usada em "npm run teste" e nos testes (unitários, de componente e de ponta a ponta). Segue o mesmo contrato de dados/supabase.ts.
// Para recomeçar do zero, rode no console: SEMPER_FALSO.reiniciar()
// Os testes de ponta a ponta (app/e2e/) usam as pessoas, colunas e o escritório da semente pelo nome:
// ao mudar a semente, rode "npm run testar-telas" para conferir.
import type {
  AcessoSigilo, Coluna, Comentario, Contexto, DadosDemanda, DadosTarefa, FiltroTarefas, Tarefa, TarefaLigada, TarefaLista, ItemDaLista, ListaDaDemanda, ModeloDeLista, Demanda, DemandaLigada, DemandaLista, FiltroDemandas, Contrato, ContratoLista, Convite, Dados, DadosContrato, DadosEscritorio, ParticipanteGravado, FiltroContratos, FiltroPessoas, Historico, Membro, Modulo,
  ModuloComentado, Ordem, Papel, VinculoTipo, Pessoa, PessoaLista, PessoaResumida, RegistroAuditoria, Sigilo
} from './tipos';
import { cnpjComLetrasNaBusca, limparDocumento, telefoneNormal, TIPO_REPRESENTANTE } from '../regras/pessoa';
import { limparObjetos, numeroContrato, papeisNoContrato, siglaAdvogado, textoDosParticipantes } from '../regras/contrato';
import { mencaoNegada, mencoesNoTexto, MOTIVO_SEM_MENCAO } from '../regras/comentarios';
import { mencaoNegadaNaDemanda, papeisNaDemanda, veADemanda } from '../regras/demanda';
import { mencaoNegadaNaTarefa, papeisNaTarefa, veATarefa } from '../regras/tarefa';
import { normal } from '../regras/texto';
import { CLIENTES_MAXIMOS, COLABORADORES_MAXIMOS, COMENTARIOS_DO_CARTAO, DEMANDAS_LIGADAS, OBJETOS_MAXIMOS, PARTICIPANTES_MAXIMOS, POR_COLUNA, POR_PAGINA, TAMANHO_CONTRATO, TAMANHO_ITEM, TAMANHO_LISTA, ITENS_DO_MODELO, TAREFAS_LIGADAS } from './limites';
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
  { id: 'u-master', funcao: 'advogado', nome: 'Mateus Freitas Gonçalves', usuario: 'mateus.goncalves', papel: 'master', ativo: true, cor: null, pessoa_id: 'p-mateus', email: 'mateus@exemplo.com', cpf: '11122233396' },
  { id: 'u-ana', funcao: 'advogado', nome: 'Ana Teste Lima', usuario: 'ana.lima', papel: 'admin', ativo: true, cor: null, pessoa_id: 'p-ana', email: 'ana@exemplo.com', cpf: '22233344405' },
  { id: 'u-bruno', funcao: 'estagiario', nome: 'Bruno Exemplo Souza', usuario: 'bruno.souza', papel: 'usuario', ativo: true, cor: null, pessoa_id: 'p-bruno', email: 'bruno@exemplo.com', cpf: '33344455508' },
  { id: 'u-carla', funcao: 'administrativo', nome: 'Carla Fictícia Rocha', usuario: 'carla.rocha', papel: 'usuario', ativo: false, cor: null, pessoa_id: 'p-carla', email: 'carla@exemplo.com', cpf: '44455566619' }
];
const ETAPAS = ['Lead', 'Entrar em contato', 'Retornar contato', 'Reunião/atendimento', 'Atendimento em andamento',
  'Levantamento de informações', 'Orçamento solicitado', 'Orçamento em andamento', 'Orçamento enviado', 'Enviar carta proposta',
  'Contrato em andamento', 'Confecção de documentos', 'Mensagem de boas-vindas', 'Efetuar cobrança', 'Pesquisa de satisfação',
  'Pendência/observações', 'Pendente tratamento', 'Não conversão'];
/** Colunas iniciais do quadro de contratos (as mesmas sugestões do banco, banco/009_contratos.sql). */
const SITUACOES_CONTRATO = ['Em negociação', 'Aguardando assinatura', 'Assinado / em andamento', 'Encerrado', 'Rescindido'];
/** Colunas iniciais do quadro de demandas (banco/017_demandas.sql): a primeira e a última são colunas-marco. */
const SITUACOES_DEMANDA = ['Para fazer', 'Fazendo', 'Aguardando retorno', 'Concluído'];
/** Colunas iniciais do quadro de tarefas (banco/020_tarefas.sql): a primeira e a última são colunas-marco. */
const SITUACOES_TAREFA = ['Para fazer', 'Fazendo', 'Aguardando retorno', 'Concluída'];
const SUGESTOES: Partial<Record<Modulo, string[]>> = { pessoas: ETAPAS, contratos: SITUACOES_CONTRATO, demandas: SITUACOES_DEMANDA, tarefas: SITUACOES_TAREFA };
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
  comentarios?: (Comentario & { modulo: ModuloComentado; cartao_id: string })[];
  demandas?: DemandaGuardada[];
  historicoDemandas?: (Historico & { demanda_id: string })[];
  /** Contratos que já geraram as demandas automáticas (privado.contratos_com_demandas no banco). */
  contratosComDemandas?: string[];
  listas?: (Omit<ListaDaDemanda, 'itens'> & { demanda_id: string; criado_em: string })[];
  itensDeLista?: (ItemDaLista & { lista_id: string })[];
  modelos?: ModeloDeLista[];
  tarefas?: TarefaGuardada[];
  historicoTarefas?: (Historico & { tarefa_id: string })[];
}
/** Demanda como fica guardada: os clientes pelo id; os nomes e o contrato são lidos na hora (como as junções do banco). */
type DemandaGuardada = Omit<Demanda, 'clientes' | 'cliente_nome' | 'contrato'> & { clientes: string[] };
/** Tarefa como fica guardada: as pessoas pelo id; os nomes, a demanda e o contrato são lidos na hora (como as junções do banco). */
type TarefaGuardada = Omit<Tarefa, 'pessoas' | 'pessoa_nome' | 'demanda' | 'contrato'> & { pessoas: string[] };
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
/** Demanda com os campos que não vêm no cadastro já vazios (como os padrões do banco). */
function demandaNova(): DemandaGuardada {
  return {
    id: '', codigo: '', titulo: '', descricao: null, prazo: null, responsavel_id: '', colaboradores: [], clientes: [], contrato_id: null,
    contrato_codigo: null, objeto: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null, criado_por: eu,
    criado_em: agora(), atualizado_por: null, atualizado_em: agora()
  };
}
/** Tarefa com os campos que não vêm no cadastro já vazios (como os padrões do banco). */
function tarefaNova(): TarefaGuardada {
  return {
    id: '', codigo: '', titulo: '', descricao: null, prazo: null, responsavel_id: '', participantes: [], pessoas: [], demanda_id: null, demanda_codigo: null,
    contrato_id: null, contrato_codigo: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null, criado_por: eu,
    criado_em: agora(), atualizado_por: null, atualizado_em: agora()
  };
}
/** A data de daqui a alguns dias (negativo: dias atrás), como o banco guarda (aaaa-mm-dd). */
const dataDaqui = (dias: number) => new Date(Date.now() + dias * DIA).toISOString().slice(0, 10);
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
// Colunas de demandas: "Para fazer" e "Concluído" são as colunas-marco (como a migração 017).
if (!bd.colunas.some(c => c.modulo === 'demandas')) {
  bd.colunas.push(...SITUACOES_DEMANDA.map((nome, i) => ({ id: 'd' + (i + 1), nome, ordem: i + 1, criado_por: null, modulo: 'demandas' as const,
    marco: i === 0 ? 'inicio' as const : i === SITUACOES_DEMANDA.length - 1 ? 'concluido' as const : null })));
}
bd.historicoDemandas ??= [];
if (!bd.demandas) {
  const k = bd.contratos.find(x => x.servico.startsWith('Registro de marca'))!;
  const avulsa = bd.pessoas.find(p => p.nome === 'MARIA APARECIDA EXEMPLO')!;
  bd.contratosComDemandas = [k.id];
  bd.demandas = [
    { ...demandaNova(), id: novoId(), codigo: 'D3A1F09C', titulo: 'Registro de marca', objeto: 'Registro de marca', responsavel_id: k.responsavel_id,
      clientes: [...k.clientes], contrato_id: k.id, contrato_codigo: k.codigo, etapa_id: 'd2', etapa_ordem: 1, colaboradores: ['u-bruno'], prazo: dataDaqui(7) },
    { ...demandaNova(), id: novoId(), codigo: '7B42C0DE', titulo: 'Busca de anterioridade', objeto: 'Busca de anterioridade', responsavel_id: k.responsavel_id,
      clientes: [...k.clientes], contrato_id: k.id, contrato_codigo: k.codigo, etapa_id: 'd1', etapa_ordem: 1 },
    { ...demandaNova(), id: novoId(), codigo: 'A90E5B13', titulo: 'Notificar o devedor', descricao: 'Mandar a notificação extrajudicial antes da ação.',
      responsavel_id: 'u-bruno', colaboradores: ['u-ana'], clientes: avulsa ? [avulsa.id] : [], etapa_id: 'd1', etapa_ordem: 2, prazo: dataDaqui(-2), criado_por: 'u-bruno' }
  ];
}
bd.contratosComDemandas ??= [];
// Uma lista de exemplo na demanda "Registro de marca": os documentos de pessoa jurídica, um já entregue.
if (!bd.listas) {
  const d = bd.demandas.find(x => x.titulo === 'Registro de marca'), lista = novoId();
  bd.listas = d ? [{ id: lista, demanda_id: d.id, nome: 'Pessoa jurídica', ordem: 1, criado_em: agora() }] : [];
  bd.itensDeLista = d ? [
    { id: novoId(), lista_id: lista, texto: 'Comprovante de inscrição e de situação cadastral', prazo: null, feito_em: agora(), feito_por: 'u-ana', ordem: 1 },
    { id: novoId(), lista_id: lista, texto: 'Quadro de sócios e administradores', prazo: dataDaqui(3), feito_em: null, feito_por: null, ordem: 2 },
    { id: novoId(), lista_id: lista, texto: 'Atos constitutivos', prazo: null, feito_em: null, feito_por: null, ordem: 3 }
  ] : [];
}
bd.itensDeLista ??= [];
// Dois modelos de exemplo, com os documentos do modelo do Trello do escritório.
bd.modelos ??= [
  { id: novoId(), nome: 'Documentos de pessoa física', itens: ['Documento pessoal', 'Comprovante de residência'], criado_por: 'u-ana', atualizado_em: agora() },
  { id: novoId(), nome: 'Documentos de pessoa jurídica', itens: ['Comprovante de inscrição e de situação cadastral', 'Quadro de sócios e administradores', 'Atos constitutivos'],
    criado_por: 'u-ana', atualizado_em: agora() }
];
// Colunas de tarefas: "Para fazer" e "Concluída" são as colunas-marco (como a migração 020).
if (!bd.colunas.some(c => c.modulo === 'tarefas')) {
  bd.colunas.push(...SITUACOES_TAREFA.map((nome, i) => ({ id: 't' + (i + 1), nome, ordem: i + 1, criado_por: null, modulo: 'tarefas' as const,
    marco: i === 0 ? 'inicio' as const : i === SITUACOES_TAREFA.length - 1 ? 'concluido' as const : null })));
}
bd.historicoTarefas ??= [];
// Tarefas de exemplo: três da demanda "Registro de marca" (uma já concluída) e uma avulsa, da Ana, com o prazo vencido.
if (!bd.tarefas) {
  const d = bd.demandas.find(x => x.titulo === 'Registro de marca');
  const daDemanda = d ? { demanda_id: d.id, demanda_codigo: d.codigo, contrato_id: d.contrato_id, contrato_codigo: d.contrato_codigo, pessoas: [...d.clientes] } : {};
  bd.tarefas = [
    { ...tarefaNova(), ...daDemanda, id: novoId(), codigo: '5E1A7C20', titulo: 'Organizar a pasta', responsavel_id: 'u-bruno', etapa_id: 't4', etapa_ordem: 1 },
    { ...tarefaNova(), ...daDemanda, id: novoId(), codigo: 'C0FFEE12', titulo: 'Emitir a GRU', responsavel_id: 'u-master', participantes: ['u-bruno'],
      etapa_id: 't2', etapa_ordem: 1, prazo: dataDaqui(2) },
    { ...tarefaNova(), ...daDemanda, id: novoId(), codigo: '9B3D4E51', titulo: 'Pedir documentos ao cliente', responsavel_id: 'u-bruno', etapa_id: 't1', etapa_ordem: 1 },
    { ...tarefaNova(), id: novoId(), codigo: 'F00D1234', titulo: 'Renovar a procuração', descricao: 'A procuração vence este mês.', responsavel_id: 'u-ana',
      participantes: ['u-master'], etapa_id: 't1', etapa_ordem: 2, prazo: dataDaqui(-1), criado_por: 'u-ana' }
  ];
}
// Um comentário da Ana na semente, para ver o que é de outro autor (o master apaga, mas não edita).
bd.comentarios ??= [{ id: 'cm1', modulo: 'pessoas', cartao_id: bd.pessoas.find(p => p.nome === 'JOSÉ DA SILVA TESTE')!.id, autor_id: 'u-ana', texto: 'Cliente pediu retorno por WhatsApp, @mateus.goncalves.',
  mencoes: ['u-master'], criado_em: new Date(Date.now() - DIA).toISOString(), editado_em: null }];
const gravar = () => { try { sessionStorage.setItem(CHAVE, JSON.stringify(bd)); } catch { /* sem armazenamento */ } };
gravar();
(window as unknown as { SEMPER_FALSO: unknown }).SEMPER_FALSO = { reiniciar: () => { sessionStorage.removeItem(CHAVE); location.reload(); } };

const auditar = (tabela: string, acao: string, p?: { id: string; nome?: string; codigo?: string }) =>
  bd.auditoria.unshift({ id: Date.now() + Math.random(), tabela, registro_id: p?.id ?? null, acao, resumo: { nome: p?.nome, codigo: p?.codigo }, feito_por: eu, em: agora() });
const busca = (p: Pessoa) => normal([p.nome, p.nome_fantasia, p.documento, p.codigo, ...(p.telefones || []).map(telefoneNormal), ...(p.emails || []), p.municipio].join(' '));
function termo(texto?: string) {
  const t = String(texto || '').trim();
  if (!t) return '';
  const cnpj = cnpjComLetrasNaBusca(t);
  if (cnpj) return cnpj;
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
// ---------- demandas ----------
const nomesDosClientes = (ids: string[]) => ids.map(id => bd.pessoas.find(p => p.id === id)?.nome ?? 'pessoa excluída').join('; ');
const demandaCompleta = (d: DemandaGuardada): Demanda => {
  const k = d.contrato_id ? bd.contratos!.find(x => x.id === d.contrato_id) : null;
  return { ...d, clientes: d.clientes.map(id => resumoDe(id)!), cliente_nome: nomesDosClientes(d.clientes),
    contrato: k ? { id: k.id, codigo: k.codigo, servico: k.servico } : null };
};
const demandaLista = (d: DemandaGuardada): DemandaLista => ({
  id: d.id, codigo: d.codigo, titulo: d.titulo, prazo: d.prazo, responsavel_id: d.responsavel_id, colaboradores: d.colaboradores,
  cliente_nome: nomesDosClientes(d.clientes), contrato_codigo: d.contrato_codigo, etapa_id: d.etapa_id, etapa_ordem: d.etapa_ordem,
  arquivado_em: d.arquivado_em, criado_por: d.criado_por, criado_em: d.criado_em, atualizado_em: d.atualizado_em
});
const buscaDemanda = (d: DemandaGuardada) => normal([d.codigo, d.titulo, d.descricao, nomesDosClientes(d.clientes), d.contrato_codigo].join(' '));
function filtrarDemandas(f: FiltroDemandas = {}) {
  const t = termo(f.termo);
  return bd.demandas!.filter(d => (f.situacao === 'arquivadas' ? d.arquivado_em : !d.arquivado_em)
    && (!f.pessoa || d.responsavel_id === f.pessoa || d.colaboradores.includes(f.pessoa))
    && (!t || buscaDemanda(d).includes(t)));
}
/** Ordem das demandas e das tarefas ("nome" é o título). */
type PeloTitulo = Pick<DemandaGuardada, 'titulo' | 'etapa_ordem' | 'criado_em' | 'atualizado_em'>;
const ORDENS_PELO_TITULO: Record<Ordem, (a: PeloTitulo, b: PeloTitulo) => number> = {
  manual: (a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || b.criado_em.localeCompare(a.criado_em),
  nome: (a, b) => a.titulo.localeCompare(b.titulo),
  nome_desc: (a, b) => b.titulo.localeCompare(a.titulo),
  novos: (a, b) => b.criado_em.localeCompare(a.criado_em),
  antigos: (a, b) => a.criado_em.localeCompare(b.criado_em),
  recentes: (a, b) => b.atualizado_em.localeCompare(a.atualizado_em)
};
const acharDemanda = (id: string) => {
  const d = bd.demandas!.find(x => x.id === id);
  if (!d) throw new Error('Demanda não encontrada.');
  return d;
};
/**
 * Como o gatilho preparar da migração 017: título limpo; clientes do escritório, sem repetir; responsável e colaboradores
 * da equipe, sem repetir e sem o responsável entre os colaboradores; o número do contrato copiado.
 */
function prepararDemanda(dados: DadosDemanda, atual?: DemandaGuardada): DadosDemanda & { contrato_codigo?: string | null } {
  const d: DadosDemanda & { contrato_codigo?: string | null } = { ...dados };
  if (d.titulo !== undefined) {
    d.titulo = d.titulo.trim();
    if (!d.titulo) throw new Error('Dê um título à demanda.');
  }
  if (d.clientes !== undefined) {
    d.clientes = [...new Set(d.clientes.filter(Boolean))];
    if (d.clientes.length > CLIENTES_MAXIMOS) throw new Error(`Uma demanda pode ter até ${CLIENTES_MAXIMOS} clientes.`);
    if (d.clientes.some(id => !bd.pessoas.some(p => p.id === id))) throw new Error('Cliente não encontrado neste escritório.');
  }
  const responsavel = d.responsavel_id ?? atual?.responsavel_id;
  if (!EQUIPE.some(m => m.id === responsavel)) throw new Error('O responsável precisa ser alguém da equipe do escritório.');
  if (d.colaboradores !== undefined || d.responsavel_id !== undefined) {
    const lista = [...new Set((d.colaboradores ?? atual?.colaboradores ?? []).filter(Boolean))].filter(id => id !== responsavel);
    if (lista.some(id => !EQUIPE.some(m => m.id === id))) throw new Error('O colaborador precisa ser alguém da equipe do escritório.');
    if (lista.length > COLABORADORES_MAXIMOS) throw new Error(`Uma demanda pode ter até ${COLABORADORES_MAXIMOS} colaboradores.`);
    d.colaboradores = lista;
  }
  if (d.contrato_id !== undefined) {
    const k = d.contrato_id ? bd.contratos!.find(x => x.id === d.contrato_id) : null;
    if (d.contrato_id && !k) throw new Error('Contrato não encontrado neste escritório.');
    d.contrato_codigo = k?.codigo ?? null;
  }
  return d;
}
// Do responsável, dos colaboradores, dos clientes, do contrato e da coluna, o histórico guarda os nomes (como no banco).
const nomesDaEquipe = (ids: unknown) => (ids as string[] | null ?? []).map(id => EQUIPE.find(m => m.id === id)?.nome ?? 'usuário removido').join(', ') || null;
const NOME_NO_HISTORICO_DEMANDA: Record<string, [string, (v: unknown, d: DemandaGuardada) => unknown]> = {
  responsavel_id: ['responsavel_id', id => EQUIPE.find(m => m.id === id)?.nome ?? null],
  colaboradores: ['colaboradores', nomesDaEquipe],
  clientes: ['clientes', lista => (lista as string[] | null ?? []).map(nomeDaPessoa).join(', ') || null],
  contrato_id: ['contrato', id => bd.contratos!.find(k => k.id === id)?.codigo ?? null],
  etapa_id: ['etapa', id => nomeDaColuna((id as string) || null)]
};
const FORA_DO_HISTORICO_DEMANDA = new Set(['etapa_ordem', 'arquivado_por', 'contrato_codigo']);
/** Como o gatilho do banco: o que mudou, campo a campo, entra no histórico da demanda. */
function historicoDemanda(d: DemandaGuardada, dados: Record<string, unknown>) {
  const atual = d as unknown as Record<string, unknown>, alt: Historico['alteracoes'] = {};
  Object.entries(dados).forEach(([campo, v]) => {
    if (!FORA_DO_HISTORICO_DEMANDA.has(campo) && JSON.stringify(atual[campo] ?? null) !== JSON.stringify(v ?? null)) {
      const [chave, nome] = NOME_NO_HISTORICO_DEMANDA[campo] ?? [campo, (x: unknown) => x];
      alt[chave] = { de: nome(atual[campo] ?? null, d), para: nome(v ?? null, d) };
    }
  });
  if (Object.keys(alt).length) bd.historicoDemandas!.unshift({ id: Date.now() + Math.random(), demanda_id: d.id, alteracoes: alt, feito_por: eu, em: agora() });
}
/**
 * Como o gatilho demandas_automaticas da migração 017: o contrato que chega à coluna-marco "assinado" ganha uma demanda
 * por objeto, em "Para fazer", com os clientes e o responsável dele. Uma vez só por contrato.
 */
function demandasDoContratoAssinado(k: ContratoGuardado) {
  const assinado = bd.colunas.find(c => c.id === k.etapa_id)?.marco === 'assinado';
  if (!assinado || bd.contratosComDemandas!.includes(k.id)) return;
  bd.contratosComDemandas!.push(k.id);
  const inicio = bd.colunas.find(c => c.modulo === 'demandas' && c.marco === 'inicio')?.id ?? null, base = Date.now() / 1000;
  k.objetos.forEach((objeto, i) => bd.demandas!.push({ ...demandaNova(), id: novoId(), codigo: codigo(), titulo: objeto, objeto,
    responsavel_id: k.responsavel_id, clientes: [...k.clientes], contrato_id: k.id, contrato_codigo: k.codigo, etapa_id: inicio, etapa_ordem: base + i / 1000 }));
}
const demandaLigada = (pessoaId: string, perfilId: string | null) => (d: DemandaGuardada): DemandaLigada => ({
  id: d.id, codigo: d.codigo, titulo: d.titulo, prazo: d.prazo, etapa_id: d.etapa_id, arquivado_em: d.arquivado_em, criado_em: d.criado_em,
  papeis: papeisNaDemanda(d, pessoaId, perfilId)
});
// ---------- tarefas ----------
const tarefaCompleta = (t: TarefaGuardada): Tarefa => {
  const d = t.demanda_id ? bd.demandas!.find(x => x.id === t.demanda_id) : null;
  const k = t.contrato_id ? bd.contratos!.find(x => x.id === t.contrato_id) : null;
  return { ...t, pessoas: t.pessoas.map(id => resumoDe(id)!), pessoa_nome: nomesDosClientes(t.pessoas),
    demanda: d ? { id: d.id, codigo: d.codigo, titulo: d.titulo, etapa_id: d.etapa_id, criado_por: d.criado_por, responsavel_id: d.responsavel_id,
      colaboradores: d.colaboradores } : null,
    contrato: k ? { id: k.id, codigo: k.codigo, servico: k.servico } : null };
};
const tarefaLista = (t: TarefaGuardada): TarefaLista => ({
  id: t.id, codigo: t.codigo, titulo: t.titulo, prazo: t.prazo, responsavel_id: t.responsavel_id, participantes: t.participantes,
  pessoa_nome: nomesDosClientes(t.pessoas), demanda_codigo: t.demanda_codigo, contrato_codigo: t.contrato_codigo, etapa_id: t.etapa_id,
  etapa_ordem: t.etapa_ordem, arquivado_em: t.arquivado_em, criado_por: t.criado_por, criado_em: t.criado_em, atualizado_em: t.atualizado_em
});
const buscaTarefa = (t: TarefaGuardada) => normal([t.codigo, t.titulo, t.descricao, nomesDosClientes(t.pessoas), t.demanda_codigo, t.contrato_codigo].join(' '));
function filtrarTarefas(f: FiltroTarefas = {}) {
  const t = termo(f.termo);
  return bd.tarefas!.filter(x => (f.situacao === 'arquivadas' ? x.arquivado_em : !x.arquivado_em)
    && (!f.pessoa || x.responsavel_id === f.pessoa || x.participantes.includes(f.pessoa))
    && (!t || buscaTarefa(x).includes(t)));
}
const acharTarefa = (id: string) => {
  const t = bd.tarefas!.find(x => x.id === id);
  if (!t) throw new Error('Tarefa não encontrada.');
  return t;
};
/**
 * Como o gatilho preparar da migração 020: título limpo; pessoas do escritório, sem repetir; responsável e participantes
 * da equipe, sem repetir e sem o responsável entre os participantes; os códigos da demanda e do contrato copiados.
 */
function prepararTarefa(dados: DadosTarefa, atual?: TarefaGuardada): DadosTarefa & { demanda_codigo?: string | null; contrato_codigo?: string | null } {
  const t: DadosTarefa & { demanda_codigo?: string | null; contrato_codigo?: string | null } = { ...dados };
  if (t.titulo !== undefined) {
    t.titulo = t.titulo.trim();
    if (!t.titulo) throw new Error('Dê um título à tarefa.');
  }
  if (t.pessoas !== undefined) {
    t.pessoas = [...new Set(t.pessoas.filter(Boolean))];
    if (t.pessoas.length > CLIENTES_MAXIMOS) throw new Error(`Uma tarefa pode ter até ${CLIENTES_MAXIMOS} pessoas ligadas.`);
    if (t.pessoas.some(id => !bd.pessoas.some(p => p.id === id))) throw new Error('Pessoa não encontrada neste escritório.');
  }
  const responsavel = t.responsavel_id ?? atual?.responsavel_id;
  if (!EQUIPE.some(m => m.id === responsavel)) throw new Error('O responsável precisa ser alguém da equipe do escritório.');
  if (t.participantes !== undefined || t.responsavel_id !== undefined) {
    const lista = [...new Set((t.participantes ?? atual?.participantes ?? []).filter(Boolean))].filter(id => id !== responsavel);
    if (lista.some(id => !EQUIPE.some(m => m.id === id))) throw new Error('O participante precisa ser alguém da equipe do escritório.');
    if (lista.length > COLABORADORES_MAXIMOS) throw new Error(`Uma tarefa pode ter até ${COLABORADORES_MAXIMOS} participantes.`);
    t.participantes = lista;
  }
  if (t.demanda_id !== undefined) {
    const d = t.demanda_id ? bd.demandas!.find(x => x.id === t.demanda_id) : null;
    if (t.demanda_id && !d) throw new Error('Demanda não encontrada neste escritório.');
    t.demanda_codigo = d?.codigo ?? null;
  }
  if (t.contrato_id !== undefined) {
    const k = t.contrato_id ? bd.contratos!.find(x => x.id === t.contrato_id) : null;
    if (t.contrato_id && !k) throw new Error('Contrato não encontrado neste escritório.');
    t.contrato_codigo = k?.codigo ?? null;
  }
  return t;
}
// Do responsável, dos participantes, das pessoas, da demanda, do contrato e da coluna, o histórico guarda os nomes (como no banco).
const NOME_NO_HISTORICO_TAREFA: Record<string, [string, (v: unknown) => unknown]> = {
  responsavel_id: ['responsavel_id', id => EQUIPE.find(m => m.id === id)?.nome ?? null],
  participantes: ['participantes', nomesDaEquipe],
  pessoas: ['pessoas', lista => (lista as string[] | null ?? []).map(nomeDaPessoa).join(', ') || null],
  demanda_id: ['demanda', id => bd.demandas!.find(d => d.id === id)?.codigo ?? null],
  contrato_id: ['contrato', id => bd.contratos!.find(k => k.id === id)?.codigo ?? null],
  etapa_id: ['etapa', id => nomeDaColuna((id as string) || null)]
};
const FORA_DO_HISTORICO_TAREFA = new Set(['etapa_ordem', 'arquivado_por', 'demanda_codigo', 'contrato_codigo']);
/** Como o gatilho do banco: o que mudou, campo a campo, entra no histórico da tarefa. */
function historicoTarefa(t: TarefaGuardada, dados: Record<string, unknown>) {
  const atual = t as unknown as Record<string, unknown>, alt: Historico['alteracoes'] = {};
  Object.entries(dados).forEach(([campo, v]) => {
    if (!FORA_DO_HISTORICO_TAREFA.has(campo) && JSON.stringify(atual[campo] ?? null) !== JSON.stringify(v ?? null)) {
      const [chave, nome] = NOME_NO_HISTORICO_TAREFA[campo] ?? [campo, (x: unknown) => x];
      alt[chave] = { de: nome(atual[campo] ?? null), para: nome(v ?? null) };
    }
  });
  if (Object.keys(alt).length) bd.historicoTarefas!.unshift({ id: Date.now() + Math.random(), tarefa_id: t.id, alteracoes: alt, feito_por: eu, em: agora() });
}
const tarefaLigada = (pessoaId: string, perfilId: string | null) => (t: TarefaGuardada): TarefaLigada => ({
  id: t.id, codigo: t.codigo, titulo: t.titulo, prazo: t.prazo, etapa_id: t.etapa_id, arquivado_em: t.arquivado_em, criado_em: t.criado_em,
  papeis: pessoaId ? papeisNaTarefa(t, pessoaId, perfilId) : []
});
/** Na ordem do quadro (como as demandas do contrato). */
const tarefasNaOrdemDoQuadro = (lista: TarefaGuardada[]) => lista
  .sort((a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || a.criado_em.localeCompare(b.criado_em))
  .slice(0, TAREFAS_LIGADAS).map(tarefaLigada('', null));
// ---------- modelos de lista ----------
/** Como o gatilho preparar e o índice de nome único: nome limpo e sem repetir; itens limpos, sem linhas vazias. */
function prepararModelo(campos: Partial<Pick<ModeloDeLista, 'nome' | 'itens'>>, id?: string) {
  const m: Partial<Pick<ModeloDeLista, 'nome' | 'itens'>> = {};
  if (campos.nome !== undefined) {
    m.nome = nomeDaLista(campos.nome);
    if (bd.modelos!.some(x => x.id !== id && normal(x.nome) === normal(m.nome))) throw new Error('Já existe um modelo de lista com esse nome.');
  }
  if (campos.itens !== undefined) {
    m.itens = campos.itens.map(i => i.trim()).filter(Boolean);
    if (m.itens.length > ITENS_DO_MODELO) throw new Error(`Um modelo pode ter até ${ITENS_DO_MODELO} itens.`);
    if (m.itens.some(i => i.length > TAMANHO_ITEM)) throw new Error(`Cada item do modelo pode ter até ${TAMANHO_ITEM} caracteres.`);
  }
  return m;
}
// ---------- listas das demandas ----------
const itemLido = ({ lista_id: _l, ...i }: NonNullable<Banco['itensDeLista']>[number]): ItemDaLista => i;
const listaLida = ({ demanda_id: _d, criado_em: _c, ...l }: NonNullable<Banco['listas']>[number]): ListaDaDemanda =>
  ({ ...l, itens: bd.itensDeLista!.filter(i => i.lista_id === l.id).sort((a, b) => a.ordem - b.ordem).map(itemLido) });
/** Como as regras do banco: nome e texto sem espaços nas pontas e não vazios, no tamanho de cada um. */
function nomeDaLista(nome: string) {
  const n = nome.trim();
  if (!n) throw new Error('Dê um nome à lista.');
  if (n.length > TAMANHO_LISTA) throw new Error(`O nome da lista pode ter até ${TAMANHO_LISTA} caracteres.`);
  return n;
}
function textoDoItem(texto: string) {
  const t = texto.trim();
  if (!t) throw new Error('Escreva o item.');
  if (t.length > TAMANHO_ITEM) throw new Error(`O item pode ter até ${TAMANHO_ITEM} caracteres.`);
  return t;
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
    if (!EQUIPE.some(m => m.pessoa_id === p.pessoa_id) && !atual?.participantes.some(x => x.pessoa_id === p.pessoa_id))
      throw new Error('O participante precisa ser alguém da equipe do escritório.');
  });
  return dados.participantes === undefined ? dados : { ...dados, participantes: lista.map(p => ({ pessoa_id: p.pessoa_id, percentual: p.percentual })) };
}
/** Como o gatilho da migração 015: o responsável é sempre um advogado da equipe (conferido ao criar e ao trocar). */
function conferirResponsavel(id: string | undefined) {
  if (EQUIPE.find(m => m.id === id)?.funcao !== 'advogado') throw new Error('O responsável do contrato precisa ser um advogado da equipe.');
}
/** Como o gatilho preparar do banco: o texto sem espaços nas pontas e as menções achadas nele; em contratos, só advogados. */
function prepararComentario(modulo: ModuloComentado, bruto: string, cartaoId: string) {
  const texto = bruto.trim();
  if (!texto) throw new Error('Escreva o comentário.');
  const mencoes = mencoesNoTexto(texto, EQUIPE), primeiro = (lista: typeof mencoes) => lista.sort((a, b) => a.nome.localeCompare(b.nome))[0];
  const negado = primeiro(mencoes.filter(m => MOTIVO_SEM_MENCAO[modulo](m)));
  if (negado) throw new Error(mencaoNegada(negado.nome));
  const demanda = modulo === 'demandas' ? bd.demandas!.find(d => d.id === cartaoId) : null;
  const deFora = demanda ? primeiro(mencoes.filter(m => !veADemanda(demanda, m))) : null;
  if (deFora) throw new Error(mencaoNegadaNaDemanda(deFora.nome));
  // Na tarefa: só quem a vê (quem está nela ou vê a demanda ligada a ela).
  const tarefa = modulo === 'tarefas' ? bd.tarefas!.find(t => t.id === cartaoId) : null;
  const daTarefa = tarefa ? bd.demandas!.find(d => d.id === tarefa.demanda_id) ?? null : null;
  const foraDaTarefa = tarefa ? primeiro(mencoes.filter(m => !veATarefa(tarefa, m, daTarefa))) : null;
  if (foraDaTarefa) throw new Error(mencaoNegadaNaTarefa(foraDaTarefa.nome));
  return { texto, mencoes: mencoes.map(m => m.id) };
}
/** O cartão de cada módulo existe? (No banco, a ligação do comentário com o cartão.) */
const CARTAO_EXISTE: Record<ModuloComentado, (id: string) => boolean> = {
  pessoas: id => bd.pessoas.some(p => p.id === id),
  contratos: id => bd.contratos!.some(k => k.id === id),
  demandas: id => bd.demandas!.some(d => d.id === id),
  tarefas: id => bd.tarefas!.some(t => t.id === id)
};
const comentarioLido = ({ modulo: _modulo, cartao_id: _cartao, ...c }: NonNullable<Banco['comentarios']>[number]): Comentario => c;
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
        papel: 'master', funcao: m.funcao, ativo: true, cor: null, oab: null, preferencias: bd.perfil.preferencias },
      escritorio: { id: 'e1', slug: 'teste', modulos: { pessoas: true, contratos: true, demandas: true, tarefas: true }, ...bd.escritorio! },
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
      if (bd.demandas!.some(d => d.clientes.includes(id))) { motivo = 'Esta pessoa está em demandas e não pode ser excluída.'; return; }
      if (bd.tarefas!.some(t => t.pessoas.includes(id))) { motivo = 'Esta pessoa está em tarefas e não pode ser excluída.'; return; }
      bd.pessoas = bd.pessoas.filter(x => x.id !== id); auditar('pessoas', 'exclusao', p); excluidas++;
      bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'pessoas' && c.cartao_id === id));
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
    conferirResponsavel(dados.responsavel_id);
    const sigla = resp ? siglaAdvogado(resp.nome, bd.pessoas.find(p => p.id === resp.pessoa_id)?.documento) : null;
    if (!resp || !sigla) return erro(`Cadastre o CPF de ${resp?.nome || 'quem é o responsável'} em Pessoas para gerar o número do contrato.`);
    const d = ajustarClientes(ajustarParticipantes(ajustarObjetos(dados)));
    const ano = new Date().getFullYear(), numero = Math.max(0, ...bd.contratos!.filter(x => x.ano === ano).map(x => x.numero)) + 1;
    const k: ContratoGuardado = { ...contratoNovo(), ...d, id: novoId(), numero, sigla, ano, codigo: numeroContrato(sigla, numero, ano) };
    bd.contratos!.push(k); guardarObjetos(k.objetos); demandasDoContratoAssinado(k); auditar('contratos', 'inclusao', k); gravar();
    return espera({ id: k.id, codigo: k.codigo });
  },
  async contratoAtualizar(id, dados) {
    const k = acharContrato(id);
    if (dados.responsavel_id !== undefined && dados.responsavel_id !== k.responsavel_id) conferirResponsavel(dados.responsavel_id);
    const d = ajustarClientes(ajustarParticipantes(ajustarObjetos(dados, k), k), k);
    historicoContrato(k, d);
    Object.assign(k, d, { atualizado_em: agora(), atualizado_por: eu });
    guardarObjetos(k.objetos); demandasDoContratoAssinado(k); auditar('contratos', 'alteracao', k); gravar();
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
      bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'contratos' && c.cartao_id === id));
      bd.demandas!.forEach(d => { if (d.contrato_id === id) d.contrato_id = null; });
      bd.tarefas!.forEach(t => { if (t.contrato_id === id) Object.assign(t, { contrato_id: null, contrato_codigo: null }); });
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
    Object.assign(k, { etapa_id: etapaId, etapa_ordem: ordem, atualizado_em: agora() }); demandasDoContratoAssinado(k); gravar();
  },
  contratoHistorico: id => espera(bd.historicoContratos!.filter(h => h.contrato_id === id)),
  objetosSugeridos: () => espera([...bd.objetosSugeridos!].sort((a, b) => a.localeCompare(b, 'pt-BR'))),
  contratosDaPessoa: (pessoaId, perfilId = null) => espera(bd.contratos!
    .map(k => ({ k, papeis: papeisNoContrato({ ...k, participantes: k.participantes.map(p => p.pessoa_id) }, pessoaId, perfilId) }))
    .filter(x => x.papeis.length)
    .sort((a, b) => b.k.criado_em.localeCompare(a.k.criado_em))
    .map(({ k, papeis }) => ({ id: k.id, codigo: k.codigo, servico: k.servico, etapa_id: k.etapa_id, arquivado_em: k.arquivado_em, criado_em: k.criado_em, papeis }))),

  // ---------- demandas ----------
  demandasListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const r = filtrarDemandas(f).sort(ORDENS_PELO_TITULO[f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos']);
    return espera({ linhas: r.slice(de, de + por).map(demandaLista), total: r.length });
  },
  demandasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrarDemandas(f).filter(d => (d.etapa_id || null) === (etapaId || null)).sort(ORDENS_PELO_TITULO[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(demandaLista), total: r.length });
  },
  demandaObter: id => { const d = bd.demandas!.find(x => x.id === id); return espera(d ? demandaCompleta(d) : null); },
  async demandaCriar(dados) {
    const d: DemandaGuardada = { ...demandaNova(), ...prepararDemanda({ clientes: [], colaboradores: [], ...dados }) as Partial<DemandaGuardada>, id: novoId(), codigo: codigo() };
    bd.demandas!.push(d); auditar('demandas', 'inclusao', d); gravar();
    return espera({ id: d.id, codigo: d.codigo });
  },
  async demandaAtualizar(id, dados) {
    const d = acharDemanda(id), novos = prepararDemanda(dados, d);
    historicoDemanda(d, novos);
    Object.assign(d, novos, { atualizado_em: agora(), atualizado_por: eu });
    auditar('demandas', 'alteracao', d); gravar();
    return espera({ id, codigo: d.codigo });
  },
  async demandasArquivar(ids, arquivar = true) {
    ids.forEach(id => {
      const d = bd.demandas!.find(x => x.id === id); if (!d) return;
      historicoDemanda(d, { arquivado_em: arquivar ? agora() : null });
      Object.assign(d, { arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? eu : null, atualizado_em: agora() });
    });
    gravar(); return espera(ids.length);
  },
  async demandasExcluir(ids) {
    let excluidas = 0;
    ids.forEach(id => {
      const d = bd.demandas!.find(x => x.id === id);
      if (!d || !d.arquivado_em) return;
      bd.demandas = bd.demandas!.filter(x => x.id !== id);
      bd.historicoDemandas = bd.historicoDemandas!.filter(h => h.demanda_id !== id);
      bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'demandas' && c.cartao_id === id));
      // Como o "on delete set null" do banco: as tarefas da demanda ficam, só desligadas dela.
      bd.tarefas!.forEach(t => { if (t.demanda_id === id) Object.assign(t, { demanda_id: null, demanda_codigo: null }); });
      const listas = new Set(bd.listas!.filter(l => l.demanda_id === id).map(l => l.id));
      bd.listas = bd.listas!.filter(l => !listas.has(l.id));
      bd.itensDeLista = bd.itensDeLista!.filter(i => !listas.has(i.lista_id));
      auditar('demandas', 'exclusao', d); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só demandas arquivadas podem ser excluídas.' : '' });
  },
  async demandaMover(id, etapaId, ordem) {
    const d = acharDemanda(id);
    historicoDemanda(d, { etapa_id: etapaId });
    Object.assign(d, { etapa_id: etapaId, etapa_ordem: ordem, atualizado_em: agora() }); gravar();
  },
  demandaHistorico: id => espera(bd.historicoDemandas!.filter(h => h.demanda_id === id)),
  demandasDaPessoa: (pessoaId, perfilId = null) => espera(bd.demandas!.map(demandaLigada(pessoaId, perfilId)).filter(d => d.papeis.length)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, DEMANDAS_LIGADAS)),
  demandasDoContrato: contratoId => espera(bd.demandas!.filter(d => d.contrato_id === contratoId)
    .sort((a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || a.criado_em.localeCompare(b.criado_em))
    .slice(0, DEMANDAS_LIGADAS).map(d => ({ ...demandaLigada('', null)(d), papeis: [] }))),

  // ---------- tarefas (como banco/020_tarefas.sql) ----------
  tarefasListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const r = filtrarTarefas(f).sort(ORDENS_PELO_TITULO[f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos']);
    return espera({ linhas: r.slice(de, de + por).map(tarefaLista), total: r.length });
  },
  tarefasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrarTarefas(f).filter(t => (t.etapa_id || null) === (etapaId || null)).sort(ORDENS_PELO_TITULO[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(tarefaLista), total: r.length });
  },
  tarefaObter: id => { const t = bd.tarefas!.find(x => x.id === id); return espera(t ? tarefaCompleta(t) : null); },
  async tarefaCriar(dados) {
    const t: TarefaGuardada = { ...tarefaNova(), ...prepararTarefa({ pessoas: [], participantes: [], ...dados }) as Partial<TarefaGuardada>, id: novoId(), codigo: codigo() };
    bd.tarefas!.push(t); auditar('tarefas', 'inclusao', t); gravar();
    return espera({ id: t.id, codigo: t.codigo });
  },
  async tarefaAtualizar(id, dados) {
    const t = acharTarefa(id), novos = prepararTarefa(dados, t);
    historicoTarefa(t, novos);
    Object.assign(t, novos, { atualizado_em: agora(), atualizado_por: eu });
    auditar('tarefas', 'alteracao', t); gravar();
    return espera({ id, codigo: t.codigo });
  },
  async tarefasArquivar(ids, arquivar = true) {
    ids.forEach(id => {
      const t = bd.tarefas!.find(x => x.id === id); if (!t) return;
      historicoTarefa(t, { arquivado_em: arquivar ? agora() : null });
      Object.assign(t, { arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? eu : null, atualizado_em: agora() });
    });
    gravar(); return espera(ids.length);
  },
  async tarefasExcluir(ids) {
    let excluidas = 0;
    ids.forEach(id => {
      const t = bd.tarefas!.find(x => x.id === id);
      if (!t || !t.arquivado_em) return;
      bd.tarefas = bd.tarefas!.filter(x => x.id !== id);
      bd.historicoTarefas = bd.historicoTarefas!.filter(h => h.tarefa_id !== id);
      bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'tarefas' && c.cartao_id === id));
      auditar('tarefas', 'exclusao', t); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só tarefas arquivadas podem ser excluídas.' : '' });
  },
  async tarefaMover(id, etapaId, ordem) {
    const t = acharTarefa(id);
    historicoTarefa(t, { etapa_id: etapaId });
    Object.assign(t, { etapa_id: etapaId, etapa_ordem: ordem, atualizado_em: agora() }); gravar();
  },
  tarefaHistorico: id => espera(bd.historicoTarefas!.filter(h => h.tarefa_id === id)),
  tarefasDaPessoa: (pessoaId, perfilId = null) => espera(bd.tarefas!.map(tarefaLigada(pessoaId, perfilId)).filter(t => t.papeis.length)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, TAREFAS_LIGADAS)),
  tarefasDaDemanda: demandaId => espera(tarefasNaOrdemDoQuadro(bd.tarefas!.filter(t => t.demanda_id === demandaId))),
  tarefasDoContrato: contratoId => espera(tarefasNaOrdemDoQuadro(bd.tarefas!.filter(t => t.contrato_id === contratoId))),

  // ---------- listas das demandas (como banco/018_listas_das_demandas.sql) ----------
  listasDaDemanda: demandaId => espera(bd.listas!.filter(l => l.demanda_id === demandaId).sort((a, b) => a.ordem - b.ordem).map(listaLida)),
  async listaCriar(demandaId, nome, itens = []) {
    acharDemanda(demandaId);
    const ordem = Math.max(0, ...bd.listas!.filter(l => l.demanda_id === demandaId).map(l => l.ordem)) + 1;
    const l = { id: novoId(), demanda_id: demandaId, nome: nomeDaLista(nome), ordem, criado_em: agora() };
    bd.listas!.push(l);
    itens.forEach((texto, i) => bd.itensDeLista!.push({ id: novoId(), lista_id: l.id, texto: textoDoItem(texto), prazo: null, feito_em: null, feito_por: null, ordem: i + 1 }));
    gravar(); return espera(listaLida(l));
  },
  async listaAtualizar(id, { nome, ordem }) {
    const l = bd.listas!.find(x => x.id === id); if (!l) return erro('Lista não encontrada.');
    Object.assign(l, nome === undefined ? {} : { nome: nomeDaLista(nome) }, ordem === undefined ? {} : { ordem }); gravar();
  },
  async listaExcluir(id) {
    bd.listas = bd.listas!.filter(l => l.id !== id); bd.itensDeLista = bd.itensDeLista!.filter(i => i.lista_id !== id); gravar();
  },
  async itemCriar(listaId, texto) {
    if (!bd.listas!.some(l => l.id === listaId)) return erro('Lista não encontrada.');
    const ordem = Math.max(0, ...bd.itensDeLista!.filter(i => i.lista_id === listaId).map(i => i.ordem)) + 1;
    const item = { id: novoId(), lista_id: listaId, texto: textoDoItem(texto), prazo: null, feito_em: null, feito_por: null, ordem };
    bd.itensDeLista!.push(item); gravar();
    return espera(itemLido(item));
  },
  // Como o gatilho preparar: marcar anota agora e quem marcou; mexer num item já feito não troca isso; desmarcar apaga os dois.
  async itemAtualizar(id, { feito, texto, ...campos }) {
    const item = bd.itensDeLista!.find(x => x.id === id); if (!item) return erro('Item não encontrado.');
    Object.assign(item, campos, texto === undefined ? {} : { texto: textoDoItem(texto) });
    if (feito === false) Object.assign(item, { feito_em: null, feito_por: null });
    if (feito && !item.feito_em) Object.assign(item, { feito_em: agora(), feito_por: eu });
    gravar(); return espera(itemLido(item));
  },
  async itemExcluir(id) { bd.itensDeLista = bd.itensDeLista!.filter(i => i.id !== id); gravar(); },

  // ---------- modelos de lista (como banco/019_modelos_de_lista.sql) ----------
  modelosListar: () => espera([...bd.modelos!].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))),
  async modeloCriar(nome, itens) {
    const m = { id: novoId(), ...prepararModelo({ nome, itens }), criado_por: eu, atualizado_em: agora() } as ModeloDeLista;
    bd.modelos!.push(m); gravar(); return espera(m);
  },
  async modeloAtualizar(id, campos) {
    const m = bd.modelos!.find(x => x.id === id); if (!m) return erro('Modelo não encontrado.');
    Object.assign(m, prepararModelo(campos, id), { atualizado_em: agora() }); gravar();
  },
  // Quem está logado no banco fictício é o master: exclui os de qualquer um.
  async modeloExcluir(id) { bd.modelos = bd.modelos!.filter(m => m.id !== id); gravar(); },

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

  // ---------- comentários (como o gatilho e as regras de banco/016_comentarios.sql) ----------
  comentariosListar: (modulo, cartaoId) => espera(bd.comentarios!.filter(c => c.modulo === modulo && c.cartao_id === cartaoId)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, COMENTARIOS_DO_CARTAO).map(comentarioLido)),
  async comentarioCriar(modulo, cartaoId, texto) {
    if (!CARTAO_EXISTE[modulo](cartaoId)) return erro('Este cartão não foi encontrado. Ele pode ter sido excluído.');
    const c = { id: novoId(), modulo, cartao_id: cartaoId, autor_id: eu, ...prepararComentario(modulo, texto, cartaoId), criado_em: agora(), editado_em: null };
    bd.comentarios!.push(c); gravar();
    return espera(comentarioLido(c));
  },
  async comentarioEditar(id, texto) {
    const c = bd.comentarios!.find(x => x.id === id);
    if (!c || c.autor_id !== eu) return erro('Só quem escreveu o comentário pode editá-lo.');
    Object.assign(c, prepararComentario(c.modulo, texto, c.cartao_id), { editado_em: agora() }); gravar();
    return espera(comentarioLido(c));
  },
  async comentarioExcluir(id) {
    const c = bd.comentarios!.find(x => x.id === id);
    // Quem está logado no banco fictício é o master: apaga os de qualquer autor.
    if (!c) return erro('Só quem escreveu o comentário ou um administrador pode apagá-lo.');
    bd.comentarios = bd.comentarios!.filter(x => x !== c); auditar('comentarios', 'exclusao', { id }); gravar();
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
  async equipeDefinirFuncao(id, funcao) {
    const m = EQUIPE.find(x => x.id === id); if (!m) return erro('Usuário não encontrado');
    m.funcao = funcao; auditar('perfis', 'alteracao', { id, nome: m.nome }); gravar();
  },
  convitesListar: () => espera(bd.convites),
  async conviteCancelar(id) { bd.convites = bd.convites.filter(c => c.id !== id); gravar(); },
  auditoriaListar: (n = 50) => espera(bd.auditoria.slice(0, n)),
  async escritorioSalvar(dados) {
    const atual = bd.escritorio!;
    // Como public.escritorio_salvar: o CNPJ só com letras e números, em maiúsculas.
    bd.escritorio = { ...atual, ...dados, cnpj: limparDocumento(dados.cnpj) || null, logo: dados.logo === undefined ? atual.logo : dados.logo };
    bd.auditoria.unshift({ id: Date.now() + Math.random(), tabela: 'escritorios', registro_id: 'e1', acao: 'alteracao', resumo: { nome: dados.nome }, feito_por: eu, em: agora() });
    gravar(); await espera(null);
  },
  async exportacaoRegistrar(tabela, descricao, quantidade) {
    bd.auditoria.unshift({ id: Date.now() + Math.random(), tabela, registro_id: null, acao: 'exportacao', resumo: { descricao, quantidade }, feito_por: eu, em: agora() });
    gravar();
  }
};
