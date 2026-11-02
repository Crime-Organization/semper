// Versão de teste da camada de dados, com pessoas fictícias guardadas na aba do navegador.
// Usada em "npm run teste" e nos testes (unitários, de componente e de ponta a ponta). Segue o mesmo contrato de dados/supabase.ts.
// Para recomeçar do zero, rode no console: SEMPER_FALSO.reiniciar()
// Os testes de ponta a ponta (app/e2e/) usam as pessoas, colunas e o escritório da semente pelo nome:
// ao mudar a semente, rode "npm run testar-telas" para conferir.
import type {
  AcessoSigilo, LigacaoGoogle, CartaoComListas, FotoDoPerfil, PerfilProfissional, Coluna, Comentario, Contexto, DadosDemanda, DadosTarefa, RegistroDeTempo, FiltroTarefas, Tarefa, TarefaLigada, TarefaLista, ItemDaLista, ListaDoCartao, ModeloDeLista, Demanda, DemandaLigada, DemandaLista, FiltroDemandas, Contrato, ContratoLista, Convite, Dados, DadosContrato, DadosEscritorio, ParticipanteGravado, FiltroContratos, FiltroPessoas, Historico, Membro, Modulo,
  ModuloComentado, Ordem, Papel, VinculoTipo, Pessoa, PessoaLista, PessoaResumida, RegistroAuditoria, Sigilo,
  DadosPessoa, Importacao, ItemImportacao, MarcaPessoas, Pendencia, DadosOrgao, DiaLancado, Etiqueta, GrupoDeColunas, ModuloComEtiquetas, Orgao,
  CampoDeProcesso, DadosProcesso, FiltroProcessos, OpcaoDeProcesso, Processo, ProcessoLigado, ProcessoLista, TipoProcesso,
  AndamentoDeProcesso, PrazoDeProcesso, TarefaDoAcompanhamento, FaseNoPainel, ProcessoNoPainel
} from './tipos';
import { linhaDoAndamento, linhaDoPrazo, porDataDoAndamento } from '../regras/andamentos';
import { datasDoPainel, ITENS_POR_LISTA, SEM_FASE, ULTIMOS_ANDAMENTOS } from '../regras/painelProcessos';
import { cnpjComLetrasNaBusca, limparDocumento, telefoneNormal, TIPO_REPRESENTANTE } from '../regras/pessoa';
import { completarVazios, juntarObservacoes } from '../regras/importacao';
import { limparObjetos, numeroContrato, papeisNoContrato, siglaAdvogado, textoDosParticipantes } from '../regras/contrato';
import { mencaoNegada, mencoesNoTexto, MOTIVO_SEM_MENCAO } from '../regras/comentarios';
import { mencaoNegadaNaDemanda, papeisNaDemanda, veADemanda } from '../regras/demanda';
import { mencaoNegadaNaTarefa, papeisNaTarefa, veATarefa } from '../regras/tarefa';
import { numeroParaComparar, papeisNoProcesso, TIPOS_PROCESSO } from '../regras/processo';
import { tempoPorPessoa } from '../regras/cronometro';
import { errosDoPerfil, limparPerfil, perfilVazio } from '../regras/perfilProfissional';
import { inicioDoDia } from '../regras/meuTempo';
import { normal } from '../regras/texto';
import { FOTO_MAXIMA, CLIENTES_MAXIMOS, COLABORADORES_MAXIMOS, COMENTARIOS_DO_CARTAO, DEMANDAS_LIGADAS, OBJETOS_MAXIMOS, PARTICIPANTES_MAXIMOS, POR_COLUNA, POR_PAGINA, TAMANHO_CONTRATO, TAMANHO_ITEM, TAMANHO_LISTA, ITENS_DO_MODELO, TAREFAS_LIGADAS,
  LOTE_MAXIMO_DA_IMPORTACAO, TAMANHO_IMPORTACAO, TAMANHO_OBSERVACOES, HISTORICO_DO_PROCESSO, OPCOES_POR_CAMPO, TAMANHO_CAMPO, DIGITOS_DO_NUMERO } from './limites';
import { DIAS_PARADO } from './limites';
import { ANOS_DO_CALENDARIO, ANDAMENTOS_DO_PROCESSO, PRAZOS_DO_PROCESSO, TAMANHO_ANDAMENTO, TAMANHO_DIA, TAMANHO_ETIQUETA, TAMANHO_GRUPO, TAMANHO_ORGAO, TAMANHO_PRAZO } from './limites';
import { CORES } from '../regras/etiquetas';
import { anoAceito, dataExiste, padraoDoOrgao } from '../regras/calendario';
import { PRAZO_MAXIMO_DIAS, TIPOS_SEM_EXPEDIENTE } from '../regras/prazos';
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
type MembroFalso = Required<Omit<Membro, 'cor' | 'pessoa_id' | 'foto'>> & { cor: string | null; pessoa_id: string; email: string; cpf: string };
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
  /** Importações de pessoas (tabela importacoes no banco). */
  importacoes?: Importacao[];
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
  /** Cada lista é de uma demanda ou de uma tarefa (demanda_listas no banco). */
  listas?: (Omit<ListaDoCartao, 'itens'> & { demanda_id?: string; tarefa_id?: string; criado_em: string })[];
  itensDeLista?: (ItemDaLista & { lista_id: string })[];
  modelos?: ModeloDeLista[];
  /** Órgãos e dias sem expediente do escritório (orgaos e dias_sem_expediente no banco). */
  orgaos?: Orgao[];
  diasLancados?: DiaLancado[];
  /** Grupos de colunas dos quadros (quadro_grupos no banco). */
  gruposDeColunas?: (GrupoDeColunas & { modulo: Modulo })[];
  /** Etiquetas do escritório e as ligações com os cartões (etiquetas e pessoa_etiquetas, contrato_etiquetas... no banco). */
  etiquetas?: Etiqueta[];
  etiquetasAplicadas?: { modulo: ModuloComEtiquetas; cartao_id: string; etiqueta_id: string }[];
  processos?: ProcessoGuardado[];
  historicoProcessos?: (Historico & { processo_id: string })[];
  opcoesDeProcesso?: OpcaoDeProcesso[];
  camposDeProcesso?: CampoDeProcesso[];
  /** Dias sem andamento para o processo estar parado (escritorios.dias_processo_parado no banco). */
  diasParado?: number;
  andamentos?: AndamentoGuardado[];
  prazos?: PrazoGuardado[];
  /** Fotos da equipe (a pasta fotos-da-equipe no banco): os dois AVIF de cada um, guardados aqui como data: URL. */
  fotos?: Record<string, FotoDoPerfil>;
  /** Perfis profissionais da equipe (perfil_profissional no banco). */
  perfisProfissionais?: PerfilProfissional[];
  /** A conta Google ligada ao escritório (privado.ligacoes no banco). */
  ligacaoGoogle?: LigacaoGoogle | null;
  /** Pedidos de ligação ainda não concluídos (privado.ligacao_pedidos no banco). */
  pedidosGoogle?: { estado: string; pedido_em: number }[];
  tarefas?: TarefaGuardada[];
  /** Registros de tempo nas tarefas (tarefa_tempos no banco). */
  tempos?: (RegistroDeTempo & { tarefa_id: string })[];
  historicoTarefas?: (Historico & { tarefa_id: string })[];
}
/** Demanda como fica guardada: os clientes pelo id; os nomes e o contrato são lidos na hora (como as junções do banco). */
type DemandaGuardada = Omit<Demanda, 'clientes' | 'cliente_nome' | 'contrato'> & { clientes: string[] };
/** Processo como fica guardado: os clientes pelo id; os nomes são lidos na hora. */
type ProcessoGuardado = Omit<Processo, 'clientes' | 'cliente_nome'> & { clientes: string[] };
/** Tarefa como fica guardada: as pessoas pelo id; os nomes, a demanda e o contrato são lidos na hora (como as junções do banco). */
type AndamentoGuardado = Omit<AndamentoDeProcesso, 'tarefa'> & { excluido_em: string | null };
type PrazoGuardado = Omit<PrazoDeProcesso, 'tarefa'> & { excluido_em: string | null };
type TarefaGuardada = Omit<Tarefa, 'pessoas' | 'pessoa_nome' | 'demanda' | 'contrato' | 'processo'> & { pessoas: string[] };
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
    importacao_id: null, referencia: null, observacoes: null, pendencias: [],
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
    contrato_id: null, contrato_codigo: null, processo_id: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null, criado_por: eu,
    criado_em: agora(), atualizado_por: null, atualizado_em: agora(), concluida_em: null
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
// Três órgãos de exemplo, com o que cada um costuma seguir. Nenhum dia lançado: os testes lançam os seus.
bd.orgaos ??= [
  { id: novoId(), ...padraoDoOrgao('TJMG'), nome: 'Tribunal de Justiça de Minas Gerais' },
  { id: novoId(), ...padraoDoOrgao('TRF6'), nome: 'Tribunal Regional Federal da 6ª Região' },
  { id: novoId(), ...padraoDoOrgao('INPI'), nome: 'Instituto Nacional da Propriedade Industrial' }
];
bd.diasLancados ??= [];
bd.gruposDeColunas ??= [];
bd.etiquetas ??= [];
bd.etiquetasAplicadas ??= [];
// Os quadros de processos, como a função criar_quadros_de_processos da migração: grupos, colunas e marcos.
const QUADROS_DE_PROCESSOS: Record<'processos_judiciais' | 'processos_administrativos', { nome: string; fechado?: boolean; colunas: string[] }[]> = {
  processos_judiciais: [
    { nome: 'Início', colunas: ['Distribuído', 'Pedido de habilitação', 'Emendar a inicial', 'Tutela provisória', 'Aguardando citação'] },
    { nome: 'Conhecimento', colunas: ['Audiência de conciliação', 'Contestação/defesa', 'Impugnação à contestação', 'Cumprir intimação', 'Provas/saneamento/perícia', 'Audiência de instrução e julgamento', 'Alegações finais/memoriais'] },
    { nome: 'Decisão', colunas: ['Conclusos/aguardando sentença', 'Sentença proferida', 'Embargos de declaração', 'Recolhimento de custas'] },
    { nome: 'Recursal', colunas: ['Recorrer', 'Contrarrazoar', 'Agravar', 'Aguardando julgamento', 'Julgamento designado', 'Aguardando trânsito em julgado'] },
    { nome: 'Cumprimento', colunas: ['Iniciar cumprimento', 'Impugnar cumprimento', 'Pesquisas/penhora', 'Liquidação', 'RPV/precatório', 'Alvará'] },
    { nome: 'Encerrado', fechado: true, colunas: ['Baixado/arquivado'] }
  ],
  processos_administrativos: [
    { nome: 'Protocolo', colunas: ['Protocolado', 'Publicado'] },
    { nome: 'Exigências e manifestações', colunas: ['Exigência a cumprir', 'Exigência cumprida', 'Prazo de oposição', 'Manifestar contra oposição', 'Perícia médica', 'Avaliação social'] },
    { nome: 'Análise', colunas: ['Aguardando decisão'] },
    { nome: 'Decisão', colunas: ['Deferido/concedido', 'Indeferido', 'Recurso administrativo', 'Ajuizar ação'] },
    { nome: 'Concessão e vigência', colunas: ['Pagamento da concessão', 'Expedição do certificado', 'Registro em vigor', 'Retribuição anual', 'Prorrogação', 'Contra nulidade'] },
    { nome: 'Encerrado', fechado: true, colunas: ['Arquivado/baixado'] }
  ]
};
for (const [modulo, grupos] of Object.entries(QUADROS_DE_PROCESSOS) as [keyof typeof QUADROS_DE_PROCESSOS, (typeof QUADROS_DE_PROCESSOS)[keyof typeof QUADROS_DE_PROCESSOS]][]) {
  if (bd.colunas.some(c => c.modulo === modulo)) continue;
  const total = grupos.flatMap(g => g.colunas).length;
  let ordem = 0;
  grupos.forEach((g, i) => {
    const grupo = { id: novoId(), nome: g.nome, ordem: i + 1, comeca_fechado: !!g.fechado, modulo };
    bd.gruposDeColunas!.push(grupo);
    g.colunas.forEach(nome => {
      ordem++;
      bd.colunas.push({ id: novoId(), nome, ordem, criado_por: null, modulo, grupo_id: grupo.id, marco: ordem === 1 ? 'inicio' as const : ordem === total ? 'concluido' as const : null });
    });
  });
}
// Dois processos de exemplo, um de cada tipo.
bd.opcoesDeProcesso ??= [];
bd.camposDeProcesso ??= [];
bd.diasParado ??= DIAS_PARADO.padrao;
bd.andamentos ??= [];
bd.prazos ??= [];
bd.historicoProcessos ??= [];
bd.processos ??= (() => {
  const coluna = (nome: string) => bd.colunas.find(c => c.nome === nome)?.id ?? null;
  const pessoa = (nome: string) => bd.pessoas.find(p => p.nome === nome)?.id;
  const base = { campos: {}, titulo: null, responsavel_id: eu, colaboradores: [] as string[], sistema: null, polo: null, area: null, meio: null, natureza: null, gratuidade: null, comarca: null, vara: null,
    classe: null, assunto: null, juiz: null, distribuicao: null, valor_causa: null, instancia: null, segredo: false, advogado_contrario: null, observacoes: null, arquivado_em: null, arquivado_por: null,
    criado_por: eu, criado_em: agora(), atualizado_por: eu, atualizado_em: agora(), etapa_ordem: 1 };
  const lista: ProcessoGuardado[] = [];
  const jose = pessoa('JOSÉ DA SILVA TESTE'), maria = pessoa('MARIA APARECIDA EXEMPLO');
  if (jose) lista.push({ ...base, id: novoId(), codigo: codigo(), tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', orgao: 'TJMG', comarca: 'Montes Claros', vara: '2ª Vara Cível', clientes: [jose], etapa_id: coluna('Distribuído') });
  if (maria) lista.push({ ...base, id: novoId(), codigo: codigo(), tipo: 'administrativo', numero: '912345678', titulo: 'Registro da marca Exemplo', orgao: 'INPI', clientes: [maria], etapa_id: coluna('Protocolado') });
  return lista;
})();
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
    { ...tarefaNova(), ...daDemanda, id: novoId(), codigo: '5E1A7C20', titulo: 'Organizar a pasta', responsavel_id: 'u-bruno', etapa_id: 't4', etapa_ordem: 1,
      concluida_em: agora() },
    { ...tarefaNova(), ...daDemanda, id: novoId(), codigo: 'C0FFEE12', titulo: 'Emitir a GRU', responsavel_id: 'u-master', participantes: ['u-bruno'],
      etapa_id: 't2', etapa_ordem: 1, prazo: dataDaqui(2) },
    { ...tarefaNova(), ...daDemanda, id: novoId(), codigo: '9B3D4E51', titulo: 'Pedir documentos ao cliente', responsavel_id: 'u-bruno', etapa_id: 't1', etapa_ordem: 1 },
    { ...tarefaNova(), id: novoId(), codigo: 'F00D1234', titulo: 'Renovar a procuração', descricao: 'A procuração vence este mês.', responsavel_id: 'u-ana',
      participantes: ['u-master'], etapa_id: 't1', etapa_ordem: 2, prazo: dataDaqui(-1), criado_por: 'u-ana' }
  ];
}
// Sessões abertas antes do cronômetro: a tarefa já concluída ganha a data de conclusão (como a migração do tempo).
bd.tarefas.forEach(t => { t.concluida_em ??= bd.colunas.find(c => c.id === t.etapa_id)?.marco === 'concluido' ? t.atualizado_em : null; });
// Tempo de exemplo: "Emitir a GRU" (Mateus e Bruno) e "Organizar a pasta", concluída, com um ajuste do Bruno.
if (!bd.tempos) {
  const por = (titulo: string) => bd.tarefas!.find(t => t.titulo === titulo)?.id;
  const gru = por('Emitir a GRU'), pasta = por('Organizar a pasta');
  const contado = (id: number, tarefa_id: string, perfil_id: string, minutos: number) =>
    ({ id, tarefa_id, perfil_id, inicio: new Date(Date.now() - DIA).toISOString(), segundos: minutos * 60, ajuste: false, motivo: null });
  bd.tempos = gru && pasta ? [contado(1, gru, 'u-master', 80), contado(2, gru, 'u-bruno', 40), contado(3, pasta, 'u-bruno', 50),
    { id: 4, tarefa_id: pasta, perfil_id: 'u-bruno', inicio: agora(), segundos: -10 * 60, ajuste: true, motivo: 'Esqueci de pausar no almoço.' }] : [];
}
// Um comentário da Ana na semente, para ver o que é de outro autor (o master apaga, mas não edita).
bd.comentarios ??= [{ id: 'cm1', modulo: 'pessoas', cartao_id: bd.pessoas.find(p => p.nome === 'JOSÉ DA SILVA TESTE')!.id, autor_id: 'u-ana', texto: 'Cliente pediu retorno por WhatsApp, @mateus.goncalves.',
  mencoes: ['u-master'], criado_em: new Date(Date.now() - DIA).toISOString(), editado_em: null }];
// Sessões abertas antes da importação: os cadastros ganham as colunas novas vazias (como a migração da importação).
bd.pessoas.forEach(p => { p.importacao_id ??= null; p.referencia ??= null; p.observacoes ??= null; p.pendencias ??= []; });
bd.importacoes ??= [];
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
/** O filtro de cada marca de Pessoas (importadas, com pendência), como em supabase.ts. */
const MARCAS: Record<MarcaPessoas, (p: Pessoa) => boolean> = {
  importadas: p => !!p.importacao_id,
  pendentes: p => p.pendencias.length > 0
};
function filtrar(f: FiltroPessoas = {}) {
  const t = termo(f.termo);
  return bd.pessoas.filter(p => (f.situacao === 'arquivadas' ? p.arquivado_em : !p.arquivado_em)
    && (!f.tipo || p.tipo === f.tipo)
    && (!f.responsavel || p.resp.some(r => r.perfil_id === f.responsavel))
    && (!f.marca || MARCAS[f.marca](p))
    && (!f.etiqueta || temEtiqueta('pessoas', p.id, f.etiqueta))
    && (!t || busca(p).includes(t)));
}
const lista = (p: Pessoa): PessoaLista => ({
  id: p.id, codigo: p.codigo, tipo: p.tipo, nome: p.nome, nome_fantasia: p.nome_fantasia, documento: p.documento, telefones: p.telefones,
  emails: p.emails, municipio: p.municipio, uf: p.uf, etapa_id: p.etapa_id, etapa_ordem: p.etapa_ordem, arquivado_em: p.arquivado_em,
  criado_por: p.criado_por, criado_em: p.criado_em, atualizado_em: p.atualizado_em, resp: p.resp, pendencias: p.pendencias,
  importacao_id: p.importacao_id
});
/** Pessoa nova com os padrões do banco, mais o que veio no cadastro. */
const novaPessoa = (dados: DadosPessoa, extra: Partial<Pessoa> = {}) => Object.assign({ id: novoId(), codigo: codigo(), criado_por: eu, criado_em: agora(),
  atualizado_em: agora(), arquivado_em: null, etapa_id: null, etapa_ordem: null, telefones: [], emails: [], importacao_id: null, referencia: null,
  observacoes: null, pendencias: [] }, dados, extra) as unknown as Pessoa;
/** Altera um cadastro como o banco: o histórico guarda só o que mudou (menos a ordem no quadro e quem arquivou) e o registro de ações, a alteração. */
function alterarPessoa(p: Pessoa, dados: DadosPessoa) {
  const alt: Historico['alteracoes'] = {};
  const atual = p as unknown as Record<string, unknown>;
  Object.entries(dados).forEach(([k, v]) => {
    if (JSON.stringify(atual[k] ?? null) !== JSON.stringify(v ?? null) && k !== 'etapa_ordem' && k !== 'arquivado_por') alt[k] = { de: atual[k] ?? null, para: v ?? null };
  });
  const tinhaPendencia = p.pendencias.length > 0;
  Object.assign(p, dados, { atualizado_em: agora(), atualizado_por: eu });
  if (Object.keys(alt).length) bd.historico.unshift({ id: Date.now() + Math.random(), pessoa_id: p.id, alteracoes: alt, feito_por: eu, em: agora() });
  auditar('pessoas', 'alteracao', p);
  etiquetaDaPendencia(p, tinhaPendencia);
}

// ---------- importação de pessoas: as mesmas regras de supabase/migrations/20261031200000_importar_pessoas.sql ----------
/** As colunas que pessoas_importar grava numa pessoa nova (o resto do item é ignorado, como no banco). */
const COLUNAS_IMPORTADAS: (keyof DadosPessoa)[] = ['tipo', 'nome', 'genero', 'nacionalidade', 'profissao', 'estado_civil', 'rg', 'rg_expedicao',
  'nome_mae', 'nome_pai', 'nascimento', 'nascimento_municipio', 'nascimento_uf', 'natureza', 'tipo_entidade', 'nome_fantasia', 'porte', 'abertura',
  'representantes', 'documento', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf', 'telefones', 'emails', 'lgpd_base',
  'lgpd_consentimento'];
const DATAS_DO_CADASTRO: (keyof DadosPessoa)[] = ['rg_expedicao', 'nascimento', 'abertura', 'lgpd_consentimento'];
/** Os valores aceitos em pendencias (a regra "check" da coluna no banco). */
const PENDENCIAS_DO_BANCO: ReadonlySet<string> = new Set<Pendencia>(['documento_invalido', 'conferir']);
/** Data de cadastro antes deste ano foi digitada errado: o banco troca por agora (como a do futuro). */
const ANO_MINIMO_DO_CADASTRO = 1900;
/** O erro de uma linha do lote, como privado.erro_da_linha no banco: só o número da linha e o motivo, sem os valores. */
const ERRO_DA_LINHA = {
  formato: 'algum valor está em formato inválido.',
  naoEncontrado: 'cadastro não encontrado.',
  pendencia: 'algum campo está em formato inválido (pessoas_pendencias_check).',
  observacao: `a observação passaria de ${TAMANHO_OBSERVACOES.toLocaleString('pt-BR')} caracteres.`,
  repetido: 'já existe um cadastro com este CPF/CNPJ ou esta referência.',
  permissao: 'sem permissão para gravar esta linha (confira os responsáveis).'
};
type ErroDaLinha = keyof typeof ERRO_DA_LINHA;
const dataValida = (v: unknown) => v === null || v === undefined
  || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v));
/** A data antiga de cadastro como o banco grava: vazia, no futuro ou antes de 1900, vira agora. */
function criadoEmDaImportacao(iso: string | null) {
  const d = iso ? new Date(iso) : null;
  return d && d.getTime() <= Date.now() && d.getUTCFullYear() >= ANO_MINIMO_DO_CADASTRO ? d.toISOString() : agora();
}
/** As pendências juntas, sem repetir, em ordem (como privado.juntar_pendencias no banco). */
const juntarPendencias = (atuais: Pendencia[], novas: Pendencia[]) => [...new Set([...atuais, ...novas])].sort();
/** O que já está tomado enquanto o lote é conferido, linha a linha (como o banco, que grava uma linha depois da outra). */
interface Tomados { documentos: Set<string>; referencias: Set<string>; observacoes: Map<string, string | null> }
/** O motivo de a linha não poder entrar, na ordem em que o banco confere; null = pode. Marca o que a linha toma. */
function problemaDaLinha(item: ItemImportacao, t: Tomados): ErroDaLinha | null {
  if (!DATAS_DO_CADASTRO.every(c => dataValida(item.dados[c]))
    || (!item.existente_id && item.criado_em && Number.isNaN(Date.parse(item.criado_em)))) return 'formato';
  const p = item.existente_id ? bd.pessoas.find(x => x.id === item.existente_id) : null;
  if (item.existente_id && !p) return 'naoEncontrado';
  if (item.pendencias.some(x => !PENDENCIAS_DO_BANCO.has(x))) return 'pendencia';
  const observacao = p ? juntarObservacoes(t.observacoes.get(p.id), item.observacoes) : item.observacoes;
  if ((observacao?.length ?? 0) > TAMANHO_OBSERVACOES) return 'observacao';
  const documento = p ? completarVazios(p, item.dados).documento : item.dados.documento;
  const referencia = p ? null : item.referencia;
  if ((documento && t.documentos.has(documento)) || (referencia && t.referencias.has(referencia))) return 'repetido';
  if (item.responsaveis.some(id => !EQUIPE.some(m => m.id === id))) return 'permissao';
  if (documento) t.documentos.add(documento);
  if (referencia) t.referencias.add(referencia);
  if (p) t.observacoes.set(p.id, observacao ?? null);
  return null;
}
/** O primeiro problema do lote, sem gravar nada (o lote é tudo ou nada, como a transação do banco); null = pode gravar. */
function problemaDoLote(lote: ItemImportacao[]): string | null {
  const t: Tomados = {
    documentos: new Set(bd.pessoas.flatMap(p => p.documento ? [p.documento] : [])),
    referencias: new Set(bd.pessoas.flatMap(p => p.referencia ? [p.referencia] : [])),
    observacoes: new Map(bd.pessoas.map(p => [p.id, p.observacoes]))
  };
  for (const item of lote) {
    const motivo = problemaDaLinha(item, t);
    if (motivo) return `Linha ${item.linha}: ${ERRO_DA_LINHA[motivo]}`;
  }
  return null;
}
/** Grava uma linha já conferida: pessoa nova, ou o cadastro existente completado (só os vazios, com completarVazios). */
function gravarLinha(item: ItemImportacao, importacaoId: string): Pessoa {
  const existente = item.existente_id ? achar(item.existente_id) : null;
  if (existente) {
    alterarPessoa(existente, { ...completarVazios(existente, item.dados), observacoes: juntarObservacoes(existente.observacoes, item.observacoes),
      pendencias: juntarPendencias(existente.pendencias, item.pendencias) });
    return existente;
  }
  const dados = Object.fromEntries(COLUNAS_IMPORTADAS.map(c => [c, item.dados[c] ?? null])) as DadosPessoa;
  const p = novaPessoa({ ...dados, telefones: item.dados.telefones ?? [], emails: item.dados.emails ?? [], observacoes: item.observacoes || null,
    pendencias: juntarPendencias([], item.pendencias) }, { criado_em: criadoEmDaImportacao(item.criado_em), importacao_id: importacaoId,
    referencia: item.referencia || null, resp: [] });
  bd.pessoas.push(p); auditar('pessoas', 'inclusao', p);
  ligarEtiqueta('pessoas', p.id, etiquetaDoSistema('importada').id);
  etiquetaDaPendencia(p, false);
  return p;
}
const ORDENS: Record<Ordem, (a: Pessoa, b: Pessoa) => number> = {
  manual: (a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || a.nome.localeCompare(b.nome),
  nome: (a, b) => a.nome.localeCompare(b.nome),
  nome_desc: (a, b) => b.nome.localeCompare(a.nome),
  novos: (a, b) => b.criado_em.localeCompare(a.criado_em),
  antigos: (a, b) => a.criado_em.localeCompare(b.criado_em),
  recentes: (a, b) => b.atualizado_em.localeCompare(a.atualizado_em)
};
const erro = (t: string) => Promise.reject(new Error(t));
/** O arquivo como data: URL, para guardar na aba (o banco fictício não tem pasta de arquivos). */
async function dataUrl(arquivo: Blob) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let texto = '';
  for (const b of bytes) texto += String.fromCharCode(b);
  return `data:${arquivo.type};base64,${btoa(texto)}`;
}
/** O pedido de ligação com o Google vale 10 minutos (como privado.ligacao_pedidos no banco). */
const VALIDADE_DO_PEDIDO_GOOGLE = 10 * 60 * 1000;
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
    && (!f.etiqueta || temEtiqueta('contratos', k.id, f.etiqueta))
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
    && (!f.etiqueta || temEtiqueta('demandas', d.id, f.etiqueta))
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
const processoDaTarefa = (id: string | null | undefined) => {
  const p = id ? bd.processos!.find(x => x.id === id) : null;
  return p ? { id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero } : null;
};
const tarefaCompleta = (t: TarefaGuardada): Tarefa => {
  const d = t.demanda_id ? bd.demandas!.find(x => x.id === t.demanda_id) : null;
  const k = t.contrato_id ? bd.contratos!.find(x => x.id === t.contrato_id) : null;
  return { ...t, pessoas: t.pessoas.map(id => resumoDe(id)!), pessoa_nome: nomesDosClientes(t.pessoas),
    demanda: d ? { id: d.id, codigo: d.codigo, titulo: d.titulo, etapa_id: d.etapa_id, criado_por: d.criado_por, responsavel_id: d.responsavel_id,
      colaboradores: d.colaboradores } : null,
    contrato: k ? { id: k.id, codigo: k.codigo, servico: k.servico } : null,
    processo: processoDaTarefa(t.processo_id) };
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
    && (!f.etiqueta || temEtiqueta('tarefas', x.id, f.etiqueta))
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
  // Como o banco: a ligação com o processo nasce com a tarefa, e só com um processo que existe.
  if (t.processo_id !== undefined && atual) throw new Error('Você não tem permissão para fazer isso.');
  if (t.processo_id && !bd.processos!.some(p => p.id === t.processo_id)) throw new Error('Processo não encontrado neste escritório.');
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
// Processos guardados na sessão antes de existirem os campos (no banco, a coluna nasce vazia).
bd.processos!.forEach(p => { p.campos ??= {}; });
// ---------- andamentos e prazos do processo ----------
const tarefaLigadaA = (id: string | null): TarefaDoAcompanhamento => {
  const t = id ? bd.tarefas!.find(x => x.id === id) : null;
  return t ? { id: t.id, codigo: t.codigo } : null;
};
/** Como o banco devolve: com a tarefa ligada e sem a coluna de exclusão (a tela não lê). */
const comTarefa = <T extends { tarefa_id: string | null; excluido_em: string | null }>({ excluido_em: _excluido, ...item }: T) => ({ ...item, tarefa: tarefaLigadaA(item.tarefa_id) });
const SEM_MUDANCA = 'Não foi possível: o processo pode ter sido arquivado, ou isto já foi excluído. Abra o cartão de novo.';
const SEM_PERMISSAO = 'Você não tem permissão para fazer isso.';
const processoAtivo = (id: string) => bd.processos!.some(p => p.id === id && !p.arquivado_em);
/** Como o gatilho do banco: cada mudança entra no histórico do processo, com a linha como estava e como ficou. */
function historicoDoAcompanhamento(processoId: string, campo: 'andamento' | 'prazo', de: string | null, para: string | null) {
  if (de === para || !bd.processos!.some(p => p.id === processoId)) return;
  bd.historicoProcessos!.unshift({ id: Date.now() + Math.random(), processo_id: processoId, alteracoes: { [campo]: { de, para } }, feito_por: eu, em: agora() });
}
/** Como as regras check do banco: o que cada andamento pode ter. */
function conferirAndamento(a: AndamentoGuardado) {
  const marcado = a.tipo === 'audiencia' || a.tipo === 'pericia';
  a.texto = a.texto.trim();
  a.local = a.local?.trim() || null;
  if (!a.texto || a.texto.length > TAMANHO_ANDAMENTO.texto || !anoAceito(a.data) || !dataExiste(a.data)) throw new Error(FORMATO_INVALIDO);
  if (!marcado && (a.hora || a.local)) throw new Error(FORMATO_INVALIDO);
  if (a.tipo !== 'intimacao' && a.tratada_em) throw new Error(FORMATO_INVALIDO);
  if (a.local && a.local.length > TAMANHO_ANDAMENTO.local) throw new Error(FORMATO_INVALIDO);
  if (a.tarefa_id && !bd.tarefas!.some(t => t.id === a.tarefa_id)) throw new Error('Tarefa não encontrada neste escritório.');
}
function conferirPrazo(p: PrazoGuardado) {
  p.descricao = p.descricao.trim();
  if (!p.descricao || p.descricao.length > TAMANHO_PRAZO.descricao || !anoAceito(p.final) || !dataExiste(p.final)) throw new Error(FORMATO_INVALIDO);
  const semCalculo = p.intimacao === null;
  if (semCalculo !== (p.dias === null) || semCalculo !== (p.contagem === null)) throw new Error(FORMATO_INVALIDO);
  if (p.intimacao && (!anoAceito(p.intimacao) || !dataExiste(p.intimacao))) throw new Error(FORMATO_INVALIDO);
  if (p.dias !== null && (!Number.isInteger(p.dias) || p.dias < 1 || p.dias > PRAZO_MAXIMO_DIAS)) throw new Error(FORMATO_INVALIDO);
  if (p.andamento_id && !bd.andamentos!.some(a => a.id === p.andamento_id && a.processo_id === p.processo_id)) throw new Error('Este andamento não é deste processo.');
  if (p.tarefa_id && !bd.tarefas!.some(t => t.id === p.tarefa_id)) throw new Error('Tarefa não encontrada neste escritório.');
}
// ---------- processos ----------
const processoCompleto = (p: ProcessoGuardado): Processo => ({ ...p, clientes: p.clientes.map(id => resumoDe(id)!), cliente_nome: nomesDosClientes(p.clientes) });
const processoLista = (p: ProcessoGuardado): ProcessoLista => ({
  id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, responsavel_id: p.responsavel_id, colaboradores: p.colaboradores, cliente_nome: nomesDosClientes(p.clientes),
  orgao: p.orgao, comarca: p.comarca, vara: p.vara, etapa_id: p.etapa_id, etapa_ordem: p.etapa_ordem, arquivado_em: p.arquivado_em, criado_por: p.criado_por, criado_em: p.criado_em, atualizado_em: p.atualizado_em
});
const buscaProcesso = (p: ProcessoGuardado) => normal([p.codigo, p.numero, p.numero.replace(/\D/g, ''), p.titulo, nomesDosClientes(p.clientes), p.orgao, p.comarca, p.vara].join(' '));
function filtrarProcessos(f: FiltroProcessos) {
  const t = termo(f.termo);
  return bd.processos!.filter(p => p.tipo === f.tipo && (f.situacao === 'arquivados' ? p.arquivado_em : !p.arquivado_em)
    && (!f.pessoa || p.responsavel_id === f.pessoa || p.colaboradores.includes(f.pessoa))
    && (!f.orgao || p.orgao === f.orgao)
    && (!f.etapa || (f.etapa === SEM_FASE ? !p.etapa_id : p.etapa_id === f.etapa))
    && (!f.etiqueta || temEtiqueta('processos', p.id, f.etiqueta))
    && (!t || buscaProcesso(p).includes(t)));
}
const nomeParaOrdem = (p: ProcessoGuardado) => normal(p.titulo || nomesDosClientes(p.clientes));
const ORDENS_PROCESSO: Record<Ordem, (a: ProcessoGuardado, b: ProcessoGuardado) => number> = {
  manual: (a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || b.criado_em.localeCompare(a.criado_em),
  nome: (a, b) => nomeParaOrdem(a).localeCompare(nomeParaOrdem(b)),
  nome_desc: (a, b) => nomeParaOrdem(b).localeCompare(nomeParaOrdem(a)),
  novos: (a, b) => b.criado_em.localeCompare(a.criado_em),
  antigos: (a, b) => a.criado_em.localeCompare(b.criado_em),
  recentes: (a, b) => b.atualizado_em.localeCompare(a.atualizado_em)
};
const acharProcesso = (id: string) => {
  const p = bd.processos!.find(x => x.id === id);
  if (!p) throw new Error('Processo não encontrado.');
  return p;
};
/** Como a regra da migração: a coluna precisa ser do quadro do tipo do processo. */
function conferirQuadroDoProcesso(tipo: TipoProcesso, etapaId: string | null | undefined) {
  if (etapaId && bd.colunas.find(c => c.id === etapaId)?.modulo !== TIPOS_PROCESSO[tipo].quadro) throw new Error('Você não tem permissão para fazer isso.');
}
/** Como o gatilho preparar e o índice de número único da migração. */
function prepararProcesso(dados: DadosProcesso, tipo: TipoProcesso, atual?: ProcessoGuardado): DadosProcesso {
  const d: DadosProcesso = { ...dados };
  conferirQuadroDoProcesso(tipo, d.etapa_id);
  const limpar = (v: string | null | undefined) => (v ?? '').trim() || null;
  if (d.numero !== undefined) {
    d.numero = (d.numero ?? '').trim();
    if (!d.numero) throw new Error('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    const comparado = numeroParaComparar(d.numero);
    if (bd.processos!.some(p => p.id !== atual?.id && p.tipo === tipo && numeroParaComparar(p.numero) === comparado)) throw new Error('Já existe um processo com esse número.');
  }
  for (const campo of ['titulo', 'sistema', 'area', 'natureza', 'comarca', 'vara'] as const) if (d[campo] !== undefined) d[campo] = limpar(d[campo]);
  if (d.orgao !== undefined) d.orgao = limpar(d.orgao)?.toUpperCase() ?? null;
  if (d.clientes !== undefined) {
    d.clientes = [...new Set(d.clientes.filter(Boolean))];
    if (!d.clientes.length) throw new Error('Escolha pelo menos um cliente.');
    if (d.clientes.length > CLIENTES_MAXIMOS) throw new Error('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    if (d.clientes.some(c => !bd.pessoas.some(p => p.id === c))) throw new Error('Cliente não encontrado neste escritório.');
  }
  const responsavel = d.responsavel_id ?? atual?.responsavel_id;
  if (!EQUIPE.some(m => m.id === responsavel)) throw new Error('O responsável precisa ser alguém da equipe do escritório.');
  if (d.colaboradores !== undefined || d.responsavel_id !== undefined) {
    const lista = [...new Set((d.colaboradores ?? atual?.colaboradores ?? []).filter(Boolean))].filter(id => id !== responsavel);
    // Confere só quem está entrando: quem já estava e saiu da equipe não trava as outras alterações.
    if (lista.some(id => !atual?.colaboradores.includes(id) && !EQUIPE.some(m => m.id === id))) throw new Error('O colaborador precisa ser alguém da equipe do escritório.');
    if (lista.length > COLABORADORES_MAXIMOS) throw new Error('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    d.colaboradores = lista;
  }
  return d;
}
/** Como o gatilho preparar_campos da migração: o valor segue o tipo do campo; o que não mudou passa sem conferir. */
const CONFERE_VALOR: Record<CampoDeProcesso['tipo'], (v: string, c: CampoDeProcesso) => boolean> = {
  texto: v => v.length <= TAMANHO_CAMPO.texto,
  numero: v => new RegExp(`^-?\\d{1,${DIGITOS_DO_NUMERO.inteiros}}(\\.\\d{1,${DIGITOS_DO_NUMERO.decimais}})?$`).test(v),
  lista: (v, c) => c.opcoes.includes(v),
  data: v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v)
};
function prepararCampos(valores: Record<string, string>, tipo: TipoProcesso, guardados: Record<string, string> = {}) {
  const novos: Record<string, string> = {};
  for (const [id, bruto] of Object.entries(valores)) {
    const v = (bruto ?? '').trim();
    if (!v) continue;
    if (guardados[id] !== v) {
      const c = bd.camposDeProcesso!.find(x => x.id === id && !x.apagado_em);
      if (!c || (c.aparece_em !== 'ambos' && c.aparece_em !== tipo)) throw new Error('Campo não encontrado neste escritório.');
      if (!CONFERE_VALOR[c.tipo](v, c)) throw new Error(`Confira o valor do campo "${c.nome}".`);
    }
    novos[id] = v;
  }
  return novos;
}
/** Como o gatilho preparar da migração: nome limpo; opções limpas e sem repetir. */
function prepararCampoDeProcesso<D extends { nome?: string; opcoes?: string[] }>(dados: D, id?: string): D {
  const d = { ...dados };
  if (d.nome !== undefined) {
    d.nome = d.nome.trim();
    if (!d.nome || d.nome.length > TAMANHO_CAMPO.nome) throw new Error('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    if (bd.camposDeProcesso!.some(c => c.id !== id && normal(c.nome) === normal(d.nome!))) throw new Error('Já existe um campo com esse nome.');
  }
  if (d.opcoes !== undefined) {
    const vistas = new Set<string>();
    d.opcoes = d.opcoes.map(o => o.trim()).filter(o => o && !vistas.has(normal(o)) && !!vistas.add(normal(o)));
    if (d.opcoes.length > OPCOES_POR_CAMPO) throw new Error('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    if (d.opcoes.some(o => o.length > TAMANHO_CAMPO.opcao)) throw new Error(`Cada opção pode ter até ${TAMANHO_CAMPO.opcao} caracteres.`);
  }
  return d;
}
/** Como o gatilho do banco: o que mudou, campo a campo, entra no histórico. */
function historicoProcesso(p: ProcessoGuardado, dados: Record<string, unknown>) {
  const atual = p as unknown as Record<string, unknown>, alt: Historico['alteracoes'] = {};
  const nomeNaEquipe = (id: unknown) => EQUIPE.find(m => m.id === id)?.nome ?? null;
  const CONVERTE: Record<string, [string, (v: unknown) => unknown]> = {
    etapa_id: ['etapa', v => nomeDaColuna(v as string | null)], responsavel_id: ['responsavel_id', nomeNaEquipe],
    colaboradores: ['colaboradores', v => (v as string[]).map(nomeNaEquipe).join(', ')], clientes: ['clientes', v => (v as string[]).map(id => resumoDe(id)?.nome).join(', ')]
  };
  const { campos: valores, ...fixos } = dados as Record<string, unknown> & { campos?: Record<string, string> };
  if (valores) for (const id of new Set([...Object.keys(p.campos), ...Object.keys(valores)])) {
    if (p.campos[id] !== valores[id]) alt['campo:' + id] = { de: p.campos[id] ?? null, para: valores[id] ?? null };
  }
  Object.entries(fixos).forEach(([campo, v]) => {
    if (campo === 'etapa_ordem' || campo === 'arquivado_por' || JSON.stringify(atual[campo] ?? null) === JSON.stringify(v ?? null)) return;
    const [chave, conv] = CONVERTE[campo] ?? [campo, (x: unknown) => x];
    alt[chave] = { de: conv(atual[campo] ?? null), para: conv(v ?? null) };
  });
  if (Object.keys(alt).length) bd.historicoProcessos!.unshift({ id: Date.now() + Math.random(), processo_id: p.id, alteracoes: alt, feito_por: eu, em: agora() });
}
const semRepetir = (valores: (string | null)[]) => [...new Set(valores.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
// ---------- etiquetas ----------
const temEtiqueta = (modulo: ModuloComEtiquetas, cartaoId: string, etiquetaId: string) =>
  bd.etiquetasAplicadas!.some(a => a.modulo === modulo && a.cartao_id === cartaoId && a.etiqueta_id === etiquetaId);
/** Como a ligação etq: do banco: o item da lista vem com as etiquetas dele. */
const comEtq = <T extends { id: string }, R>(modulo: ModuloComEtiquetas, item: (x: T) => R) => (x: T) => ({
  ...item(x), etq: bd.etiquetasAplicadas!.filter(a => a.modulo === modulo && a.cartao_id === x.id).map(({ etiqueta_id }) => ({ etiqueta_id }))
});
/** Os dados das etiquetas do sistema (privado.etiqueta_do_sistema na migração 20261101141419). */
const ETIQUETAS_DO_SISTEMA: Record<NonNullable<Etiqueta['sistema']>, Pick<Etiqueta, 'cor' | 'texto'>> = {
  importada: { cor: 'azul', texto: 'Importada' },
  incompleta: { cor: 'laranja', texto: 'Incompleta' }
};
/** A etiqueta do tipo pedido: a que já existe, a que o escritório criou com o mesmo texto, ou uma nova. */
function etiquetaDoSistema(sistema: NonNullable<Etiqueta['sistema']>): Etiqueta {
  const { cor, texto } = ETIQUETAS_DO_SISTEMA[sistema];
  const existente = bd.etiquetas!.find(e => e.sistema === sistema) ?? bd.etiquetas!.find(e => e.texto !== null && normal(e.texto) === normal(texto));
  if (existente) { existente.sistema = sistema; return existente; }
  const nova: Etiqueta = { id: novoId(), cor, texto, criado_por: null, sistema };
  bd.etiquetas!.push(nova);
  return nova;
}
function ligarEtiqueta(modulo: ModuloComEtiquetas, cartaoId: string, etiquetaId: string) {
  if (!temEtiqueta(modulo, cartaoId, etiquetaId)) bd.etiquetasAplicadas!.push({ modulo, cartao_id: cartaoId, etiqueta_id: etiquetaId });
}
function desligarEtiqueta(modulo: ModuloComEtiquetas, cartaoId: string, etiquetaId: string) {
  bd.etiquetasAplicadas = bd.etiquetasAplicadas!.filter(a => !(a.modulo === modulo && a.cartao_id === cartaoId && a.etiqueta_id === etiquetaId));
}
/** Como o gatilho etiquetas da migração: as pendências comandam "Incompleta". */
function etiquetaDaPendencia(p: Pessoa, tinhaPendencia: boolean) {
  const temPendencia = p.pendencias.length > 0;
  if (temPendencia && !tinhaPendencia) ligarEtiqueta('pessoas', p.id, etiquetaDoSistema('incompleta').id);
  if (!temPendencia && tinhaPendencia) desligarEtiqueta('pessoas', p.id, etiquetaDoSistema('incompleta').id);
}
const ehIncompleta = (modulo: ModuloComEtiquetas, etiquetaId: string) =>
  modulo === 'pessoas' && bd.etiquetas!.find(e => e.id === etiquetaId)?.sistema === 'incompleta';
/** Como os gatilhos da migração: aplicar "Incompleta" deixa a pessoa a conferir; tirar, conferida. */
function aplicarEtiqueta(modulo: ModuloComEtiquetas, id: string, etiquetaId: string) {
  ligarEtiqueta(modulo, id, etiquetaId);
  const p = bd.pessoas.find(x => x.id === id);
  if (p && ehIncompleta(modulo, etiquetaId) && !p.pendencias.length) alterarPessoa(p, { pendencias: ['conferir'] });
}
function tirarEtiqueta(modulo: ModuloComEtiquetas, id: string, etiquetaId: string) {
  desligarEtiqueta(modulo, id, etiquetaId);
  const p = bd.pessoas.find(x => x.id === id);
  if (p && ehIncompleta(modulo, etiquetaId) && p.pendencias.length) alterarPessoa(p, { pendencias: [] });
}
/** Como as regras check e os índices únicos da migração. */
function conferirEtiqueta({ cor, texto }: Pick<Etiqueta, 'cor' | 'texto'>, id?: string) {
  const invalido = 'Algum campo está em formato inválido. Confira os dados e tente de novo.';
  if (!CORES.includes(cor) || (texto !== null && (!texto.trim() || texto.length > TAMANHO_ETIQUETA))) throw new Error(invalido);
  const outras = bd.etiquetas!.filter(e => e.id !== id);
  if (texto !== null && outras.some(e => e.texto !== null && normal(e.texto) === normal(texto))) throw new Error('Já existe uma etiqueta com esse texto.');
  if (texto === null && outras.some(e => e.texto === null && e.cor === cor)) throw new Error('Já existe uma etiqueta só de cor nessa cor.');
}
// ---------- grupos de colunas ----------
/** Como as regras check e o índice de nome único: o nome limpo, sem repetir no quadro. */
function nomeDoGrupo(nome: string, modulo: Modulo, id?: string) {
  const limpo = nome.trim();
  if (!limpo || limpo.length > TAMANHO_GRUPO) throw new Error('Algum campo está em formato inválido. Confira os dados e tente de novo.');
  if (bd.gruposDeColunas!.some(g => g.id !== id && g.modulo === modulo && normal(g.nome) === normal(limpo))) throw new Error('Já existe um grupo com esse nome neste quadro.');
  return limpo;
}
/** Como a chave da coluna: o grupo precisa ser do mesmo quadro. */
function conferirGrupo(grupoId: string | null, modulo: Modulo) {
  if (grupoId && !bd.gruposDeColunas!.some(g => g.id === grupoId && g.modulo === modulo)) throw new Error('Não foi possível concluir agora. Tente de novo.');
}
// ---------- calendário de feriados e suspensões ----------
const FORMATO_INVALIDO = 'Algum campo está em formato inválido. Confira os dados e tente de novo.';
const porSigla = (a: Orgao, b: Orgao) => a.sigla.localeCompare(b.sigla, 'pt-BR');
/** Como o gatilho preparar_orgao, as regras check e o índice de sigla única da migração. */
function prepararOrgao(campos: Partial<DadosOrgao>, id?: string): Partial<DadosOrgao> {
  const o = { ...campos };
  if (o.sigla !== undefined) {
    o.sigla = o.sigla.trim().toUpperCase();
    if (!o.sigla || o.sigla.length > TAMANHO_ORGAO.sigla) throw new Error(FORMATO_INVALIDO);
    if (bd.orgaos!.some(x => x.id !== id && x.sigla === o.sigla)) throw new Error('Já existe um órgão com essa sigla.');
  }
  if (o.nome !== undefined) {
    o.nome = o.nome?.trim() || null;
    if ((o.nome?.length ?? 0) > TAMANHO_ORGAO.nome) throw new Error(FORMATO_INVALIDO);
  }
  return o;
}
/** Como as regras check de dias_sem_expediente e a chave que liga o dia a um órgão do mesmo escritório. */
function conferirDia(d: Omit<DiaLancado, 'id'>) {
  const ano = Number(d.data.slice(0, 4));
  if (!d.motivo.trim() || d.motivo.length > TAMANHO_DIA.motivo || !(d.tipo in TIPOS_SEM_EXPEDIENTE)
    || !/^\d{4}-\d{2}-\d{2}$/.test(d.data) || ano < ANOS_DO_CALENDARIO.de || ano > ANOS_DO_CALENDARIO.ate) throw new Error(FORMATO_INVALIDO);
  if (d.orgao_id !== null && !bd.orgaos!.some(o => o.id === d.orgao_id)) throw new Error('Não foi possível concluir agora. Tente de novo.');
}
// ---------- listas das demandas e das tarefas ----------
/** De cada cartão com listas: o campo que liga a lista a ele e como achá-lo (erro se não existe). */
const CARTAO_DA_LISTA: Record<CartaoComListas, { campo: 'demanda_id' | 'tarefa_id'; achar: (id: string) => unknown }> = {
  demandas: { campo: 'demanda_id', achar: acharDemanda },
  tarefas: { campo: 'tarefa_id', achar: acharTarefa },
};
const itemLido = ({ lista_id: _l, ...i }: NonNullable<Banco['itensDeLista']>[number]): ItemDaLista => i;
const listaLida = ({ demanda_id: _d, tarefa_id: _t, criado_em: _c, ...l }: NonNullable<Banco['listas']>[number]): ListaDoCartao =>
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
      escritorio: { id: 'e1', slug: 'teste', modulos: { pessoas: true, contratos: true, demandas: true, tarefas: true, processos: true }, ...bd.escritorio! },
      equipe: EQUIPE.map(({ email: _email, cpf: _cpf, ...r }) => ({ ...r, foto: bd.fotos?.[r.id]?.pequena ?? null })), ehAdmin: true, ehMaster: true
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
    return espera({ linhas: r.slice(de, de + por).map(comEtq('pessoas', lista)), total: r.length });
  },
  pessoasExportar: (f = {}) => espera(filtrar(f).sort(ORDENS.nome)),
  async pessoasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrar(f).filter(p => (p.etapa_id || null) === (etapaId || null))
      .sort(ORDENS[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(comEtq('pessoas', lista)), total: r.length });
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
    const p = novaPessoa(dados, { resp: (resp || []).map(perfil_id => ({ perfil_id })) });
    bd.pessoas.push(p); auditar('pessoas', 'inclusao', p); gravar();
    return espera({ id: p.id, codigo: p.codigo });
  },
  async pessoaAtualizar(id, dados, resp) {
    const p = achar(id);
    if (dados.documento && bd.pessoas.some(x => x.documento === dados.documento && x.id !== id)) return erro('Já existe um cadastro com este CPF/CNPJ.');
    alterarPessoa(p, dados);
    if (Array.isArray(resp)) p.resp = resp.map(perfil_id => ({ perfil_id }));
    gravar();
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
      if (bd.processos!.some(x => x.clientes.includes(id))) { motivo = 'Esta pessoa está em processos e não pode ser excluída.'; return; }
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
      recentes: ativas.slice().sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em)).slice(0, 6).map(comEtq('pessoas', lista))
    });
  },

  // ---------- importação de pessoas (o fictício é sempre administrador) ----------
  pessoasParaImportar({ documentos, referencias }) {
    const docs = new Set(documentos), refs = new Set(referencias);
    return espera(bd.pessoas.filter(p => (p.documento && docs.has(p.documento)) || (p.referencia && refs.has(p.referencia))));
  },
  async importacaoIniciar(descricao, arquivo) {
    const i: Importacao = {
      id: novoId(), descricao: (descricao.trim() || 'Importação de pessoas').slice(0, TAMANHO_IMPORTACAO.descricao),
      arquivo: arquivo?.trim().slice(0, TAMANHO_IMPORTACAO.arquivo) || null, criadas: 0, completadas: 0, incompletas: 0, feito_por: eu,
      iniciada_em: agora(), concluida_em: null
    };
    bd.importacoes!.push(i); gravar();
    return espera(i.id);
  },
  // Em duas passadas, para ser tudo ou nada como a transação do banco: confere o lote inteiro, depois grava.
  async pessoasImportar(importacaoId, lote) {
    if (!bd.importacoes!.some(i => i.id === importacaoId && i.feito_por === eu && !i.concluida_em)) return erro('Importação não encontrada ou já concluída');
    if (!Array.isArray(lote) || lote.length > LOTE_MAXIMO_DA_IMPORTACAO) return erro('Lote inválido');
    const problema = problemaDoLote(lote);
    if (problema) return erro(problema);
    const resultado = { criadas: 0, completadas: 0, ids: [] as { linha: number; id: string }[] };
    for (const item of lote) {
      const p = gravarLinha(item, importacaoId);
      resultado[item.existente_id ? 'completadas' : 'criadas']++;
      // Responsáveis: acrescenta, sem duplicar e sem remover ninguém.
      for (const perfil_id of item.responsaveis.filter(id => !p.resp.some(r => r.perfil_id === id))) {
        p.resp.push({ perfil_id }); auditar('pessoa_responsaveis', 'inclusao', { id: p.id });
      }
      resultado.ids.push({ linha: item.linha, id: p.id });
    }
    gravar();
    return espera(resultado);
  },
  async importacaoConcluir(importacaoId, completadas) {
    const i = bd.importacoes!.find(x => x.id === importacaoId && x.feito_por === eu && !x.concluida_em);
    if (!i) return erro('Importação não encontrada ou já concluída');
    const dela = bd.pessoas.filter(p => p.importacao_id === importacaoId);
    Object.assign(i, { concluida_em: agora(), criadas: dela.length, incompletas: dela.filter(p => p.pendencias.length).length,
      completadas: Math.max(completadas || 0, 0) });
    bd.auditoria.unshift({ id: Date.now() + Math.random(), tabela: 'pessoas', registro_id: i.id, acao: 'importacao', feito_por: eu, em: agora(),
      resumo: { quantidade: i.criadas, completadas: i.completadas, incompletas: i.incompletas } });
    gravar();
    return espera(i);
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
    return espera({ linhas: r.slice(de, de + por).map(comEtq('contratos', contratoLista)), total: r.length });
  },
  async contratosDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrarContratos(f).filter(k => (k.etapa_id || null) === (etapaId || null)).sort(ORDENS_CONTRATO[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(comEtq('contratos', contratoLista)), total: r.length });
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
    return espera({ linhas: r.slice(de, de + por).map(comEtq('demandas', demandaLista)), total: r.length });
  },
  demandasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrarDemandas(f).filter(d => (d.etapa_id || null) === (etapaId || null)).sort(ORDENS_PELO_TITULO[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(comEtq('demandas', demandaLista)), total: r.length });
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
    return espera({ linhas: r.slice(de, de + por).map(comEtq('tarefas', tarefaLista)), total: r.length });
  },
  tarefasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrarTarefas(f).filter(t => (t.etapa_id || null) === (etapaId || null)).sort(ORDENS_PELO_TITULO[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(comEtq('tarefas', tarefaLista)), total: r.length });
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
      // Como o on delete set null e o gatilho do banco: a intimação que ficou sem a tarefa volta a ficar a tratar.
      bd.prazos!.forEach(z => { if (z.tarefa_id === id) z.tarefa_id = null; });
      bd.andamentos!.forEach(a => { if (a.tarefa_id === id) { a.tarefa_id = null; a.tratada_em = null; } });
      bd.historicoTarefas = bd.historicoTarefas!.filter(h => h.tarefa_id !== id);
      bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'tarefas' && c.cartao_id === id));
      bd.tempos = bd.tempos!.filter(r => r.tarefa_id !== id);
      const listas = new Set(bd.listas!.filter(l => l.tarefa_id === id).map(l => l.id));
      bd.listas = bd.listas!.filter(l => !listas.has(l.id));
      bd.itensDeLista = bd.itensDeLista!.filter(i => !listas.has(i.lista_id));
      auditar('tarefas', 'exclusao', t); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só tarefas arquivadas podem ser excluídas.' : '' });
  },
  async tarefaMover(id, etapaId, ordem) {
    const t = acharTarefa(id);
    historicoTarefa(t, { etapa_id: etapaId });
    // Como o gatilho da migração do tempo: chegar à coluna das concluídas marca a data de conclusão; sair dela, apaga.
    const concluida = bd.colunas.find(c => c.id === etapaId)?.marco === 'concluido';
    Object.assign(t, { etapa_id: etapaId, etapa_ordem: ordem, atualizado_em: agora(), concluida_em: concluida ? t.concluida_em ?? agora() : null }); gravar();
  },
  tarefaHistorico: id => espera(bd.historicoTarefas!.filter(h => h.tarefa_id === id)),
  tarefasDaPessoa: (pessoaId, perfilId = null) => espera(bd.tarefas!.map(tarefaLigada(pessoaId, perfilId)).filter(t => t.papeis.length)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, TAREFAS_LIGADAS)),
  tarefasDaDemanda: demandaId => espera(tarefasNaOrdemDoQuadro(bd.tarefas!.filter(t => t.demanda_id === demandaId))),
  tarefasDoContrato: contratoId => espera(tarefasNaOrdemDoQuadro(bd.tarefas!.filter(t => t.contrato_id === contratoId))),

  // ---------- tempo nas tarefas (como supabase/migrations/20261030120000_tempo_nas_tarefas.sql) ----------
  async tempoIniciar(tarefaId, inicio, segundos) {
    acharTarefa(tarefaId);
    const id = Math.max(0, ...bd.tempos!.map(r => r.id)) + 1;
    bd.tempos!.push({ id, tarefa_id: tarefaId, perfil_id: eu, inicio, segundos, ajuste: false, motivo: null }); gravar();
    return espera(id);
  },
  async tempoGravar(id, segundos) {
    const r = bd.tempos!.find(x => x.id === id && x.perfil_id === eu && !x.ajuste);
    if (!r) return;
    if (segundos < r.segundos) return erro('O tempo contado não diminui: para corrigir, faça um ajuste.');
    r.segundos = segundos; gravar();
  },
  async tempoAjustar(tarefaId, segundos, motivo) {
    acharTarefa(tarefaId);
    if (!motivo.trim()) return erro('Diga o motivo do ajuste (ele fica registrado).');
    const id = Math.max(0, ...bd.tempos!.map(r => r.id)) + 1;
    bd.tempos!.push({ id, tarefa_id: tarefaId, perfil_id: eu, inicio: agora(), segundos, ajuste: true, motivo: motivo.trim() }); gravar();
  },
  // Quem está logado no banco fictício é administrador: vê os registros de todos (como a regra de leitura do banco).
  tempoDaTarefa: tarefaId => {
    const registros = bd.tempos!.filter(r => r.tarefa_id === tarefaId).sort((a, b) => a.inicio.localeCompare(b.inicio));
    const porPessoa = [...tempoPorPessoa(registros)].filter(([, s]) => s > 0), total = porPessoa.reduce((s, [, x]) => s + x, 0);
    const equipe = porPessoa.map(([perfil_id, s]) => ({ perfil_id, percentual: Math.round(1000 * s / total) / 10 })).sort((a, b) => b.percentual - a.percentual);
    return espera({ registros: registros.map(({ tarefa_id: _t, ...r }) => r), equipe, total });
  },
  tempoDaDemanda: demandaId => espera(Math.max(0, bd.tempos!
    .filter(r => bd.tarefas!.find(t => t.id === r.tarefa_id)?.demanda_id === demandaId).reduce((s, r) => s + r.segundos, 0))),
  // Como public.tempo_por_tarefa (supabase/migrations/20261030160000_meu_tempo.sql). Quem entra no fictício é administrador.
  tempoPorTarefa(perfilId, de, ate) {
    const [desde, antes] = [inicioDoDia(de), inicioDoDia(ate)];
    const somas = new Map<string, number>();
    for (const r of bd.tempos!) {
      const inicio = new Date(r.inicio).toISOString();
      if (r.perfil_id === perfilId && inicio >= desde && inicio < antes) somas.set(r.tarefa_id, (somas.get(r.tarefa_id) ?? 0) + r.segundos);
    }
    const linhas = [...somas].flatMap(([tarefaId, segundos]) => {
      const t = bd.tarefas!.find(x => x.id === tarefaId);
      return t && segundos > 0 ? [{ tarefa_id: t.id, codigo: t.codigo, titulo: t.titulo, demanda_codigo: t.demanda_codigo, arquivada: !!t.arquivado_em, segundos }] : [];
    });
    return espera(linhas.sort((a, b) => b.segundos - a.segundos || a.titulo.localeCompare(b.titulo, 'pt-BR')));
  },

  // ---------- foto do perfil (como supabase/migrations/20261030150000_foto_do_perfil.sql) ----------
  fotoDoPerfil: perfilId => espera(bd.fotos?.[perfilId] ?? null),
  async fotoSalvar(perfilId, grande, pequena) {
    if (!EQUIPE.some(m => m.id === perfilId)) return erro('Usuário não encontrado.');
    if ([grande, pequena].some(a => a.type !== 'image/avif' || a.size > FOTO_MAXIMA)) return erro('A foto precisa ser AVIF, com até 2 MB.');
    const [g, p] = await Promise.all([grande, pequena].map(dataUrl));
    (bd.fotos ??= {})[perfilId] = { grande: g, pequena: p, em: agora() };
    gravar(); return espera(undefined);
  },
  async fotoRemover(perfilId) {
    if (bd.fotos) delete bd.fotos[perfilId];
    gravar(); return espera(undefined);
  },

  // ---------- perfil profissional (como supabase/migrations/20261030140000_perfil_profissional.sql) ----------
  perfilProfissional: perfilId => espera((bd.perfisProfissionais ??= []).find(p => p.perfil_id === perfilId) ?? perfilVazio(perfilId)),
  async perfilProfissionalSalvar(perfilId, campos) {
    const membro = EQUIPE.find(m => m.id === perfilId);
    if (!membro) return erro('Usuário não encontrado.');
    const [problema] = Object.values(errosDoPerfil(campos));
    if (problema) return erro(problema);
    // Quem entra no banco fictício é administrador: grava o perfil de qualquer um e liga "aparecer no site".
    const antes = (bd.perfisProfissionais ??= []).find(x => x.perfil_id === perfilId);
    const p = { ...limparPerfil(campos), perfil_id: perfilId, atualizado_em: agora() };
    bd.perfisProfissionais = [...bd.perfisProfissionais.filter(x => x.perfil_id !== perfilId), p];
    auditar('perfil_profissional', antes ? 'alteracao' : 'inclusao', { id: perfilId, nome: membro.nome });
    gravar(); return espera(undefined);
  },

  // ---------- listas das demandas e das tarefas (como banco/018_listas_das_demandas.sql e a migração 20261030130000) ----------
  listasDoCartao: (modulo, id) => espera(bd.listas!.filter(l => l[CARTAO_DA_LISTA[modulo].campo] === id).sort((a, b) => a.ordem - b.ordem).map(listaLida)),
  async listaCriar(modulo, id, nome, itens = []) {
    const { campo, achar } = CARTAO_DA_LISTA[modulo];
    achar(id);
    const ordem = Math.max(0, ...bd.listas!.filter(l => l[campo] === id).map(l => l.ordem)) + 1;
    const l = { id: novoId(), [campo]: id, nome: nomeDaLista(nome), ordem, criado_em: agora() };
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

  // ---------- andamentos e prazos do processo (como supabase/migrations/20261102125539_andamentos_e_prazos.sql) ----------
  processoAndamentos: processoId => espera(bd.andamentos!.filter(a => a.processo_id === processoId && !a.excluido_em).toSorted(porDataDoAndamento)
    .slice(0, ANDAMENTOS_DO_PROCESSO).map(comTarefa)),
  async processoAndamentoCriar(processoId, dados) {
    if (!processoAtivo(processoId)) return erro(SEM_PERMISSAO);
    const a: AndamentoGuardado = { tratada_em: null, tarefa_id: null, excluido_em: null, ...dados, id: novoId(), processo_id: processoId, criado_por: eu, criado_em: agora(), atualizado_em: agora() };
    conferirAndamento(a);
    bd.andamentos!.push(a);
    historicoDoAcompanhamento(processoId, 'andamento', null, linhaDoAndamento(a));
    auditar('processo_andamentos', 'inclusao', a); gravar();
    return espera(comTarefa(a));
  },
  async processoAndamentoAtualizar(id, dados) {
    const a = bd.andamentos!.find(x => x.id === id);
    if (!a || !processoAtivo(a.processo_id)) return erro(SEM_MUDANCA);
    const novo = { ...a, ...dados, atualizado_em: agora() };
    // Como o gatilho do banco: a tarefa desligada sem mexer na marcação faz a intimação voltar a ficar a tratar.
    if (a.tarefa_id && !novo.tarefa_id && novo.tratada_em === a.tratada_em) novo.tratada_em = null;
    conferirAndamento(novo);
    historicoDoAcompanhamento(a.processo_id, 'andamento', linhaDoAndamento(a), linhaDoAndamento(novo));
    Object.assign(a, novo); auditar('processo_andamentos', 'alteracao', a); gravar();
    return espera(comTarefa(a));
  },
  async processoAndamentoExcluir(id) {
    const a = bd.andamentos!.find(x => x.id === id);
    if (!a || !processoAtivo(a.processo_id)) return erro(SEM_MUDANCA);
    if (!a.excluido_em) historicoDoAcompanhamento(a.processo_id, 'andamento', linhaDoAndamento(a), null);
    a.excluido_em ??= agora();
    auditar('processo_andamentos', 'alteracao', a); gravar();
    return espera(undefined);
  },
  async processoAndamentoRestaurar(id) {
    const a = bd.andamentos!.find(x => x.id === id);
    if (!a || !processoAtivo(a.processo_id)) return erro(SEM_MUDANCA);
    if (a.excluido_em) historicoDoAcompanhamento(a.processo_id, 'andamento', null, linhaDoAndamento(a));
    a.excluido_em = null;
    auditar('processo_andamentos', 'alteracao', a); gravar();
    return espera(undefined);
  },
  processoPrazos: processoId => espera(bd.prazos!.filter(p => p.processo_id === processoId && !p.excluido_em).toSorted((a, b) => b.final.localeCompare(a.final))
    .slice(0, PRAZOS_DO_PROCESSO).map(comTarefa)),
  async processoPrazoCriar(processoId, dados) {
    if (!processoAtivo(processoId)) return erro(SEM_PERMISSAO);
    const p: PrazoGuardado = { concluido_em: null, tarefa_id: null, excluido_em: null, ...dados, id: novoId(), processo_id: processoId, criado_por: eu, criado_em: agora(), atualizado_em: agora() };
    conferirPrazo(p);
    bd.prazos!.push(p);
    historicoDoAcompanhamento(processoId, 'prazo', null, linhaDoPrazo(p));
    auditar('processo_prazos', 'inclusao', p); gravar();
    return espera(comTarefa(p));
  },
  async processoPrazoAtualizar(id, dados) {
    const p = bd.prazos!.find(x => x.id === id);
    if (!p || !processoAtivo(p.processo_id)) return erro(SEM_MUDANCA);
    const novo = { ...p, ...dados, atualizado_em: agora() };
    conferirPrazo(novo);
    historicoDoAcompanhamento(p.processo_id, 'prazo', linhaDoPrazo(p), linhaDoPrazo(novo));
    Object.assign(p, novo); auditar('processo_prazos', 'alteracao', p); gravar();
    return espera(comTarefa(p));
  },
  async processoPrazoExcluir(id) {
    const p = bd.prazos!.find(x => x.id === id);
    if (!p || !processoAtivo(p.processo_id)) return erro(SEM_MUDANCA);
    if (!p.excluido_em) historicoDoAcompanhamento(p.processo_id, 'prazo', linhaDoPrazo(p), null);
    p.excluido_em ??= agora();
    auditar('processo_prazos', 'alteracao', p); gravar();
    return espera(undefined);
  },
  async processoPrazoRestaurar(id) {
    const p = bd.prazos!.find(x => x.id === id);
    if (!p || !processoAtivo(p.processo_id)) return erro(SEM_MUDANCA);
    if (p.excluido_em) historicoDoAcompanhamento(p.processo_id, 'prazo', null, linhaDoPrazo(p));
    p.excluido_em = null;
    auditar('processo_prazos', 'alteracao', p); gravar();
    return espera(undefined);
  },
  tarefasDoProcesso: processoId => espera(tarefasNaOrdemDoQuadro(bd.tarefas!.filter(t => t.processo_id === processoId))),

  // ---------- painel de processos (como public.painel_de_processos) ----------
  async processosPainel({ hoje, meus }) {
    const { ate_prazos, ate_marcados } = datasDoPainel(hoje);
    const base = new Map(bd.processos!.filter(p => !p.arquivado_em && (!meus || p.responsavel_id === eu || p.colaboradores.includes(eu))).map(p => [p.id, p]));
    const noPainel = (p: ProcessoGuardado): ProcessoNoPainel => ({ id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, cliente_nome: nomesDosClientes(p.clientes),
      responsavel_id: p.responsavel_id, colaboradores: p.colaboradores, clientes: p.clientes });
    const andamentos = bd.andamentos!.filter(a => !a.excluido_em && base.has(a.processo_id)).map(({ processo_id, excluido_em: _e, ...a }) => ({ ...a, processo: noPainel(base.get(processo_id)!) }));
    const prazos = bd.prazos!.filter(z => !z.excluido_em && !z.concluido_em && base.has(z.processo_id) && z.final <= ate_prazos)
      .toSorted((a, b) => a.final.localeCompare(b.final)).map(z => ({ id: z.id, descricao: z.descricao, final: z.final, tarefa_id: z.tarefa_id, processo: noPainel(base.get(z.processo_id)!) }));
    const marcados = andamentos.filter(a => (a.tipo === 'audiencia' || a.tipo === 'pericia') && a.data >= hoje && a.data <= ate_marcados)
      .toSorted((a, b) => a.data.localeCompare(b.data) || (a.hora ?? '99').localeCompare(b.hora ?? '99'));
    const intimacoes = andamentos.filter(a => a.tipo === 'intimacao' && !a.tratada_em && !a.tarefa_id)
      .toSorted((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em));
    const parados = [...base.values()].flatMap(p => {
      if (bd.colunas.find(c => c.id === p.etapa_id)?.marco === 'concluido') return [];
      const datas = bd.andamentos!.filter(a => a.processo_id === p.id && !a.excluido_em && a.data <= hoje).map(a => a.data).toSorted();
      const ultimo = datas.at(-1) ?? p.distribuicao ?? p.criado_em.slice(0, 10);
      const dias = Math.round((Date.parse(hoje) - Date.parse(ultimo)) / DIA);
      return dias > bd.diasParado! ? [{ processo: noPainel(p), ultimo, dias }] : [];
    }).toSorted((a, b) => b.dias - a.dias);
    const fases = new Map<string, FaseNoPainel>();
    for (const p of base.values()) {
      const chave = p.tipo + '/' + p.etapa_id;
      fases.set(chave, { tipo: p.tipo, etapa_id: p.etapa_id, n: (fases.get(chave)?.n ?? 0) + 1 });
    }
    return espera({
      prazos: prazos.slice(0, ITENS_POR_LISTA), total_prazos: prazos.length,
      marcados: marcados.slice(0, ITENS_POR_LISTA), total_marcados: marcados.length,
      intimacoes: intimacoes.slice(0, ITENS_POR_LISTA), total_intimacoes: intimacoes.length,
      ultimos: andamentos.filter(a => a.data <= hoje).toSorted(porDataDoAndamento).slice(0, ULTIMOS_ANDAMENTOS),
      parados: parados.slice(0, ITENS_POR_LISTA), total_parados: parados.length,
      dias_parado: bd.diasParado!,
      fases: [...fases.values()]
    });
  },
  async processosDiasParadoSalvar(dias) {
    if (!Number.isInteger(dias) || dias < DIAS_PARADO.minimo || dias > DIAS_PARADO.maximo) return erro(FORMATO_INVALIDO);
    bd.diasParado = dias; gravar();
    return espera(undefined);
  },

  // ---------- processos (como supabase/migrations/20261101155218_processos.sql) ----------
  processosListar(f) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const r = filtrarProcessos(f).sort(ORDENS_PROCESSO[f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos']);
    return espera({ linhas: r.slice(de, de + por).map(comEtq('processos', processoLista)), total: r.length });
  },
  processosDaEtapa(etapaId, f, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrarProcessos(f).filter(p => (p.etapa_id || null) === (etapaId || null)).sort(ORDENS_PROCESSO[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(comEtq('processos', processoLista)), total: r.length });
  },
  processoObter: id => { const p = bd.processos!.find(x => x.id === id); return espera(p ? processoCompleto(p) : null); },
  async processoCriar({ tipo, ...dados }) {
    const pronto = prepararProcesso({ colaboradores: [], clientes: [], ...dados }, tipo);
    pronto.campos = prepararCampos(pronto.campos ?? {}, tipo);
    const p = { titulo: null, colaboradores: [], orgao: null, sistema: null, polo: null, area: null, meio: null, natureza: null, gratuidade: null, comarca: null, vara: null, classe: null, assunto: null,
      juiz: null, distribuicao: null, valor_causa: null, instancia: null, segredo: false, advogado_contrario: null, observacoes: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null,
      ...pronto, id: novoId(), codigo: codigo(), tipo, criado_por: eu, criado_em: agora(), atualizado_por: eu, atualizado_em: agora() } as ProcessoGuardado;
    bd.processos!.push(p); auditar('processos', 'inclusao', p); gravar();
    return espera({ id: p.id, codigo: p.codigo });
  },
  async processoAtualizar(id, dados) {
    const p = acharProcesso(id), novos = prepararProcesso(dados, p.tipo, p);
    if (novos.campos !== undefined) novos.campos = prepararCampos(novos.campos, p.tipo, p.campos);
    historicoProcesso(p, novos);
    Object.assign(p, novos, { atualizado_em: agora(), atualizado_por: eu });
    auditar('processos', 'alteracao', p); gravar();
    return espera({ id, codigo: p.codigo });
  },
  async processosArquivar(ids, arquivar = true) {
    ids.forEach(id => {
      const p = bd.processos!.find(x => x.id === id); if (!p) return;
      historicoProcesso(p, { arquivado_em: arquivar ? agora() : null });
      Object.assign(p, { arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? eu : null, atualizado_em: agora() });
    });
    gravar(); return espera(ids.length);
  },
  async processosExcluir(ids) {
    let excluidas = 0;
    ids.forEach(id => {
      const p = bd.processos!.find(x => x.id === id);
      if (!p || !p.arquivado_em) return;
      bd.processos = bd.processos!.filter(x => x.id !== id);
      bd.historicoProcessos = bd.historicoProcessos!.filter(h => h.processo_id !== id);
      bd.andamentos = bd.andamentos!.filter(a => a.processo_id !== id);
      bd.prazos = bd.prazos!.filter(z => z.processo_id !== id);
      bd.tarefas!.forEach(t => { if (t.processo_id === id) t.processo_id = null; });
      bd.etiquetasAplicadas = bd.etiquetasAplicadas!.filter(a => !(a.modulo === 'processos' && a.cartao_id === id));
      auditar('processos', 'exclusao', p); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só processos arquivados podem ser excluídos, por quem os criou ou por um administrador.' : '' });
  },
  async processoMover(id, etapaId, ordem) {
    const p = acharProcesso(id);
    conferirQuadroDoProcesso(p.tipo, etapaId);
    historicoProcesso(p, { etapa_id: etapaId });
    Object.assign(p, { etapa_id: etapaId, etapa_ordem: ordem, atualizado_em: agora() }); gravar();
  },
  processoHistorico: id => espera(bd.historicoProcessos!.filter(h => h.processo_id === id).slice(0, HISTORICO_DO_PROCESSO)),
  processosDaPessoa: (pessoaId, perfilId = null) => espera(bd.processos!.map((p): ProcessoLigado => ({
    id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, cliente_nome: nomesDosClientes(p.clientes), etapa_id: p.etapa_id, arquivado_em: p.arquivado_em, criado_em: p.criado_em,
    papeis: papeisNoProcesso(p, pessoaId, perfilId)
  })).filter(p => p.papeis.length).sort((a, b) => b.criado_em.localeCompare(a.criado_em))),
  processoOpcoes: () => espera([...bd.opcoesDeProcesso!].sort((a, b) => a.valor.localeCompare(b.valor, 'pt-BR'))),
  async processoOpcaoCriar(campo, valor) {
    const limpo = valor.trim();
    if (!limpo) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    if (bd.opcoesDeProcesso!.some(o => o.campo === campo && normal(o.valor) === normal(limpo))) return erro('Essa opção já está na lista.');
    const o: OpcaoDeProcesso = { id: novoId(), campo, valor: limpo };
    bd.opcoesDeProcesso!.push(o); gravar(); return espera(o);
  },
  processoCampos: () => espera([...bd.camposDeProcesso!]),
  async processoCampoCriar(dados) {
    const c: CampoDeProcesso = { ...prepararCampoDeProcesso(dados), id: novoId(), apagado_em: null };
    if ((c.tipo === 'lista') !== (c.opcoes.length > 0)) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    bd.camposDeProcesso!.push(c); gravar();
    return espera(c);
  },
  async processoCampoAtualizar(id, dados) {
    const c = bd.camposDeProcesso!.find(x => x.id === id);
    if (!c) return erro('Campo não encontrado neste escritório.');
    const d = prepararCampoDeProcesso(dados, id);
    if (d.opcoes !== undefined && (c.tipo === 'lista') !== (d.opcoes.length > 0)) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    Object.assign(c, d); gravar();
    return espera({ ...c });
  },
  async processoCampoExcluir(id) {
    if (bd.processos!.some(p => p.campos[id] !== undefined)) return espera(false);
    bd.camposDeProcesso = bd.camposDeProcesso!.filter(c => c.id !== id); gravar();
    return espera(true);
  },
  async processoOpcaoExcluir(id) {
    bd.opcoesDeProcesso = bd.opcoesDeProcesso!.filter(o => o.id !== id); gravar();
    return espera(undefined);
  },
  processoSugestoes: tipo => {
    const doTipo = bd.processos!.filter(p => p.tipo === tipo);
    return espera({ orgaos: semRepetir(doTipo.map(p => p.orgao)), comarcas: semRepetir(doTipo.map(p => p.comarca)), varas: semRepetir(doTipo.map(p => p.vara)) });
  },

  // ---------- etiquetas (como supabase/migrations/20261101131705_etiquetas.sql) ----------
  etiquetasListar: () => espera(bd.etiquetas!),
  async etiquetaCriar(cor, texto) {
    conferirEtiqueta({ cor, texto });
    const e: Etiqueta = { id: novoId(), cor, texto, criado_por: eu };
    bd.etiquetas!.push(e); gravar(); return espera(e);
  },
  async etiquetaAtualizar(id, campos) {
    const e = bd.etiquetas!.find(x => x.id === id); if (!e) return;
    conferirEtiqueta(campos, id);
    Object.assign(e, campos); gravar();
  },
  async etiquetaExcluir(id) {
    if (bd.etiquetas!.find(e => e.id === id)?.sistema) return;   // a regra "apagar" não alcança as do sistema
    bd.etiquetas = bd.etiquetas!.filter(e => e.id !== id);
    bd.etiquetasAplicadas = bd.etiquetasAplicadas!.filter(a => a.etiqueta_id !== id);   // on delete cascade
    gravar();
  },
  etiquetasDoCartao: (modulo, id) => espera(bd.etiquetasAplicadas!.filter(a => a.modulo === modulo && a.cartao_id === id).map(a => a.etiqueta_id)),
  async etiquetaAplicar(modulo, id, etiquetaId) {
    if (!bd.etiquetas!.some(e => e.id === etiquetaId)) return erro('Não foi possível concluir agora. Tente de novo.');
    aplicarEtiqueta(modulo, id, etiquetaId); gravar();
  },
  async etiquetaTirar(modulo, id, etiquetaId) { tirarEtiqueta(modulo, id, etiquetaId); gravar(); },
  async etiquetaAplicarEmLote(modulo, ids, etiquetaId) {
    if (!bd.etiquetas!.some(e => e.id === etiquetaId)) return erro('Não foi possível concluir agora. Tente de novo.');
    ids.forEach(id => aplicarEtiqueta(modulo, id, etiquetaId)); gravar();
  },
  async etiquetaTirarEmLote(modulo, ids, etiquetaId) { ids.forEach(id => tirarEtiqueta(modulo, id, etiquetaId)); gravar(); },

  // ---------- calendário (como supabase/migrations/20261101112711_calendario_de_prazos.sql) ----------
  orgaosListar: () => espera([...bd.orgaos!].sort(porSigla)),
  async orgaoCriar(o) {
    const novo = { id: novoId(), ...o, ...prepararOrgao(o) } as Orgao;
    bd.orgaos!.push(novo); gravar(); return espera(novo);
  },
  // Quem está logado aqui é administrador: um órgão que já não existe (outro administrador excluiu) não dá erro, como no banco.
  async orgaoAtualizar(id, campos) {
    const o = bd.orgaos!.find(x => x.id === id); if (!o) return;
    Object.assign(o, prepararOrgao(campos, id)); gravar();
  },
  async orgaoExcluir(id) {
    bd.orgaos = bd.orgaos!.filter(o => o.id !== id);
    bd.diasLancados = bd.diasLancados!.filter(d => d.orgao_id !== id);   // on delete cascade
    gravar();
  },
  diasListar: (de, ate) => espera(bd.diasLancados!.filter(d => d.data >= de && d.data <= ate).sort((a, b) => a.data.localeCompare(b.data))),
  // O mesmo dia para o mesmo órgão (ou para todos) substitui o que havia (a regra dias_sem_expediente_unico).
  async diasLancar(linhas) {
    linhas.forEach(conferirDia);
    for (const l of linhas) {
      const ja = bd.diasLancados!.find(d => d.data === l.data && d.orgao_id === l.orgao_id);
      if (ja) Object.assign(ja, { motivo: l.motivo, tipo: l.tipo });
      else bd.diasLancados!.push({ id: novoId(), ...l });
    }
    gravar(); return espera(linhas.length);
  },
  async diasExcluir(ids) { const fora = new Set(ids); bd.diasLancados = bd.diasLancados!.filter(d => !fora.has(d.id)); gravar(); },

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
  async colunaCriar(modulo, nome, ordem, grupoId = null) {
    if (bd.colunas.some(c => (c.modulo ?? 'pessoas') === modulo && normal(c.nome) === normal(nome))) return erro('Já existe uma coluna com esse nome neste quadro.');
    conferirGrupo(grupoId, modulo);
    const c = { id: novoId(), nome: nome.trim(), ordem, criado_por: eu, grupo_id: grupoId }; bd.colunas.push({ ...c, modulo }); gravar(); return espera({ ...c, oculta: false });
  },
  async colunaAgrupar(id, grupoId, ordem) {
    const c = bd.colunas.find(x => x.id === id); if (!c) return;
    conferirGrupo(grupoId, c.modulo ?? 'pessoas');
    Object.assign(c, { grupo_id: grupoId, ordem }); gravar();
  },
  gruposListar: modulo => espera(bd.gruposDeColunas!.filter(g => g.modulo === modulo).sort((a, b) => a.ordem - b.ordem).map(({ modulo: _m, ...g }) => g)),
  async grupoCriar(modulo, nome, ordem) {
    const g = { id: novoId(), nome: nomeDoGrupo(nome, modulo), ordem, comeca_fechado: false };
    bd.gruposDeColunas!.push({ ...g, modulo }); gravar(); return espera(g);
  },
  // Como no banco: um grupo que já não existe (outro administrador excluiu) não dá erro.
  async grupoAtualizar(id, campos) {
    const g = bd.gruposDeColunas!.find(x => x.id === id); if (!g) return;
    Object.assign(g, campos, campos.nome === undefined ? {} : { nome: nomeDoGrupo(campos.nome, g.modulo, id) }); gravar();
  },
  async grupoExcluir(id) {
    bd.gruposDeColunas = bd.gruposDeColunas!.filter(g => g.id !== id);
    for (const c of bd.colunas) if (c.grupo_id === id) c.grupo_id = null;   // on delete set null
    gravar();
  },
  async colunaOcultar(id, ocultar) { bd.ocultas = ocultar ? [...new Set([...bd.ocultas, id])] : bd.ocultas.filter(x => x !== id); gravar(); },
  async colunaRenomear(id, nome) { const c = bd.colunas.find(x => x.id === id); if (c) c.nome = nome; gravar(); },
  async colunaOrdenar(id, ordem) { const c = bd.colunas.find(x => x.id === id); if (c) c.ordem = ordem; gravar(); },
  async colunaExcluir(id) {
    if (bd.colunas.find(c => c.id === id)?.marco) return erro('Só administradores excluem colunas, e a coluna-marco não pode ser excluída.');
    for (const p of bd.processos!) if (p.etapa_id === id) { historicoProcesso(p, { etapa_id: null }); p.etapa_id = null; }
    for (const d of bd.demandas!) if (d.etapa_id === id) { historicoDemanda(d, { etapa_id: null }); d.etapa_id = null; }
    for (const t of bd.tarefas!) if (t.etapa_id === id) { historicoTarefa(t, { etapa_id: null }); t.etapa_id = null; }
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
  // ---------- ligação com a conta Google (sem Google: a "volta" já vem como ligada) ----------
  ligacaoGoogle: () => espera(bd.ligacaoGoogle ?? null),
  // Como no banco: iniciar só cria o pedido; a "volta do Google" traz o estado e um código, e concluir é que liga.
  async ligacaoGoogleIniciar(voltarPara) {
    const estado = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    bd.pedidosGoogle = [...(bd.pedidosGoogle ?? []), { estado, pedido_em: Date.now() }];
    gravar();
    const volta = new URL(voltarPara, location.origin);
    volta.searchParams.set('google_estado', estado);
    volta.searchParams.set('google_codigo', 'codigo-de-teste');
    return espera(volta.pathname + volta.search);
  },
  async ligacaoGoogleConcluir(estado) {
    const pedido = (bd.pedidosGoogle ?? []).find(p => p.estado === estado);
    bd.pedidosGoogle = (bd.pedidosGoogle ?? []).filter(p => p.estado !== estado);
    if (!pedido || Date.now() - pedido.pedido_em > VALIDADE_DO_PEDIDO_GOOGLE) { gravar(); return espera('expirado' as const); }
    bd.ligacaoGoogle = { conta_email: 'contato@exemplo.com', escopos: ['https://www.googleapis.com/auth/contacts'], ligado_em: agora(), ligado_por: eu };
    auditar('ligacoes', 'inclusao', { id: 'google', nome: 'contato@exemplo.com' });
    gravar(); return espera('ligado' as const);
  },
  async ligacaoGoogleDesligar() {
    if (bd.ligacaoGoogle) auditar('ligacoes', 'exclusao', { id: 'google', nome: bd.ligacaoGoogle.conta_email });
    bd.ligacaoGoogle = null;
    gravar(); return espera(undefined);
  },

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
