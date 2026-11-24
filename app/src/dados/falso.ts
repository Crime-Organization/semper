// Versão de teste da camada de dados, com pessoas fictícias guardadas na aba do navegador.
// Usada em "npm run teste" e nos testes (unitários, de componente e de ponta a ponta). Segue o mesmo contrato de dados/supabase.ts.
// Para recomeçar do zero, rode no console: SEMPER_FALSO.reiniciar()
// Os testes de ponta a ponta (app/e2e/) usam as pessoas, colunas e o escritório da semente pelo nome:
// ao mudar a semente, rode "npm run testar-telas" para conferir.
import type {
  AcessoSigilo, LigacaoGoogle, ProblemaDaSincronizacao, ContatoParaConferir, MotivoParaConferir, CartaoComListas, FotoDoPerfil, PerfilProfissional, Coluna, Comentario, Contexto, DadosDemanda, DadosTarefa, RegistroDeTempo, FiltroTarefas, Tarefa, TarefaLigada, TarefaLista, GrupoDaLista, ItemDaLista, ListaDoCartao, ModeloDeLista, NoDoModelo, Demanda, DemandaLigada, DemandaLista, FiltroDemandas, Contrato, ContratoLista, Convite, Dados, DadosContrato, DadosEscritorio, ParticipanteGravado, FiltroContratos, FiltroPessoas, Historico, Membro, Modulo,
  Mensagem, GrupoDaEquipe, ModuloComentado, Ordem, Papel, VinculoTipo, Pessoa, PessoaLista, PessoaResumida, RegistroAuditoria, Sigilo,
  DadosPessoa, Importacao, ItemImportacao, MarcaPessoas, Pendencia, DadosOrgao, DiaLancado, Etiqueta, GrupoDeColunas, ModuloComEtiquetas, Orgao,
  ComoEntrarNoProcesso, ModuloComSaida, Funcao, TipoMensagem, ModuloDoPrazo, PrazoDaMensagem, PrazoParado, AvisoDePrazo, Lembrete, Compromisso, CompromissoLigado, CompromissoLista, DadosCompromisso, ModuloDoCompromisso, Sala, OcupacaoDaSala, DadosSala, FiltroCompromissos, OrdemCompromisso, PrazoNaAgenda,
  OrdemComPrazo, CampoDeProcesso, DadosProcesso, FiltroProcessos, OpcaoDeProcesso, Processo, ProcessoLigado, ProcessoLista, TipoProcesso, PapelDaDemandaNoProcesso,
  AliquotaDoDas, ContaFinanceira, Lancamento, DadosLancamento, AndamentoDeProcesso, PrazoDeProcesso, TarefaDoAcompanhamento, FaseNoPainel, ProcessoNoPainel
} from './tipos';
import { ehAjuste, motivoParaNaoExcluirConta } from '../regras/caixa';
import { compararPeloPrazo } from '../regras/ordemPorPrazo';
import { compararPeloInicio, INICIO_VAZIO, inicioDoCriadoEm, inicioNosLimites } from '../regras/dataDeInicio';
import { erroDoNovoEmail, normalizarEmail, RECUSA_DA_TROCA } from '../regras/conta';
import { RECUSA_DA_RESERVA, erroDoNomeDaEquipe, nomeNaEquipe } from '../regras/equipe';
import { LINK_VENCIDO } from './erros';
// A primeira sincronização com o Google Contatos usa as mesmas regras de correspondência da função do servidor.
import { corresponder, type ContatoDaConta } from '../../../supabase/functions/_compartilhado/correspondenciaDeContatos';
import { CATEGORIAS_DE_ANDAMENTO, categoriaCombina, comCategoriaAcertada, linhaDoAndamento, linhaDoPrazo, porDataDoAndamento } from '../regras/andamentos';
import { dasDoMes, dividirRecebimento, erroDoDas, PARTE_INTEGRAL } from '../regras/financeiro';
import { resumoDaConferencia } from '../regras/conferencia';
import { chegouAoAssinado, cruzaOutroPeriodo, parcelaAntiga, parcelasDoContrato, partesDoRecebimento, periodoDoSocio } from '../regras/parcelas';
import { datasDoPainel, ITENS_POR_LISTA, SEM_FASE, ULTIMOS_ANDAMENTOS } from '../regras/painelProcessos';
import { periodoDosGraficos } from '../regras/graficosDeProcessos';
import { daPessoa } from '../regras/filtroDoPainel';
import { cnpjComLetrasNaBusca, limparDocumento, telefoneNormal, TIPO_REPRESENTANTE } from '../regras/pessoa';
import { completarVazios, juntarObservacoes } from '../regras/importacao';
import { limparObjetos, mesmoObjeto, numeroContrato, OBJETO_A_DEFINIR, objetosDefinidos, papeisNoContrato, siglaAdvogado, textoDosParticipantes, alteraOContrato, contratosEmQueEsta, veOContrato } from '../regras/contrato';
import { mencaoNegada, mencoesNoTexto, MODULOS_MENCIONAVEIS, MOTIVO_SEM_MENCAO } from '../regras/comentarios';
import { estaNaDemanda, mencaoNegadaNaDemanda, papeisNaDemanda, veADemanda } from '../regras/demanda';
import {
  CONTINUA_NAO_CONCLUI, CONTINUA_NAO_EXCLUI, CONTINUA_SEM_EQUIPE, DESCRICAO_DA_CONTINUA, grupoPeloGatilho, NOME_DA_GERAL, semAContinuaComDemanda, tituloDaContinua, usaAContinua, voltaAContinua
} from '../regras/demandaContinua';
import { MESMA_DEMANDA, outraDaRelacao, parDaRelacao } from '../regras/demandasRelacionadas';
import { DEMANDAS_RELACIONADAS } from './limites';
import { CONTRATOS_DA_TAREFA_CHEIA, contratosDaTarefa, DEMANDAS_DA_TAREFA_CHEIA, demandasDaTarefa, diligenciaAoGravar, estaNaTarefa, mencaoNegadaNaTarefa, papeisNaTarefa, veATarefa } from '../regras/tarefa';
import { hojeNaAgenda } from '../regras/agenda';
import { dataDaVez, DEMANDA_NA_SERIE_DE_OUTROS, regraNoLimite, SEGUINTES_DE_OUTROS, vezDaData, vezesParaGerar, vezNaLista } from '../regras/repeticao';
import { diaDaDemanda, tituloDaDemanda } from '../regras/demandaDoCompromisso';
import { DEMANDA_DO_COMPROMISSO } from './limites';
import type { AvisoDaDemandaDoCompromisso, DemandaDoCompromissoDaMensagem, RepeticaoCompromisso, RepeticaoCriada } from './tipos';
import { fmtHora, mencaoNegadaNoCompromisso, nomeDoCompromisso, papeisNoCompromisso, participaDoCompromisso, TIPOS_COMPROMISSO, veOCompromisso } from '../regras/compromisso';
import { colunaCancelada, DIAS_DO_AVISO_DE_PRAZO, paginaDoPrazo } from '../regras/mensagens';
import { somarDias } from '../regras/prazos';
import { instanteDoLembrete, lembreteChegou, LEMBRETES } from '../regras/lembrete';
import {
  alteraOProcesso, mencaoNegadaNoProcesso, motivoSemMencaoNoProcesso, numeroParaComparar, papeisNoProcesso, processosComPartes, relacionadosDoProcesso, ehTipoDeProcesso, TIPOS_PROCESSO,
  LIGACOES, PAPEIS_DA_PARTE, PAPEL_REPETIDO, type QuadroDeProcesso
} from '../regras/processo';
import { tempoPorPessoa } from '../regras/cronometro';
import { APRESENTACOES_DA_MARCA, CONCESSAO_ANTES_DO_DEPOSITO, NATUREZAS_DA_MARCA, TIPOS_DE_PROTECAO } from '../regras/propriedadeIntelectual';
import { CLASSE_NICE_MAIOR, TAMANHO_PROTECAO, VARIACOES_DO_DESENHO } from './limites';
import { diaNoHistorico, NO_HISTORICO, REGISTRO_DE_TEMPO_INTOCAVEL, registroNoHistorico } from '../regras/registrosDeTempo';
import { errosDoPerfil, limparPerfil, perfilVazio } from '../regras/perfilProfissional';
import { inicioDoDia } from '../regras/meuTempo';
import { normal } from '../regras/texto';
import { conflitoNaSala, horarioNaSala, SALA_REPETIDA } from '../regras/sala';
import { avisoDoObjetoEmUso, erroDoNomeDoObjeto, JUNTAR_SO_UM, OBJETO_A_DEFINIR_FIXO } from '../regras/objetos';
import type { ObjetoDoEscritorio, TrocaDeObjetos } from './tipos';
import { ehAcompanhaDeFabrica, FUNCAO_REPETIDA, funcaoEmUso, funcoesAoGravar, funcoesNaOrdem, nomeRepetido, quemTrocouDeFuncao, SEM_FUNCAO, semAFuncao, temAFuncao } from '../regras/funcoesNaTarefa';
import type { DadosFuncaoNaTarefa, FuncaoNaTarefa } from './tipos';
import { colunaEquivalente, colunasDaInvestigacaoNoQuadro, ehTipoQueSaiu, numeroQueNaoRepete, QUADRO_ADMINISTRATIVO, TIPO_QUE_FICA, tipoQueFica } from '../regras/investigacaoNoAdministrativo';
import { COLUNA_DE_APROVACAO_DAS_TAREFAS, colunaDeAprovacaoNoQuadro, COLUNAS_NOVAS_DAS_TAREFAS, COLUNAS_NOVAS_POR_TAREFA, planoDasColunasNovas, type ColunasNovas } from '../regras/colunasPadrao';
import { aprovaATarefa, colunaDaDevolucao, comentarioDaDevolucao, conferirMudancaDaAprovacao, esperaAprovacao, etapaComAprovacao, NAO_ESPERA_APROVACAO, SO_QUEM_PEDIU_APROVA } from '../regras/aprovacaoDaTarefa';
import { entraNoPedido, estaPeloGrupo, integrantesAtivos, meusGrupos, pedidoDoFiltroDeGrupo, recusaDeSairPeloGrupo } from '../regras/gruposDaEquipe';
import { AJUSTE_MAXIMO, GRUPOS_POR_ITEM, PERIODO_MAXIMO, TAMANHO_GRUPO_DA_EQUIPE, TAMANHO_MOTIVO } from './limites';
import { arvoreDaLista, arvoreDoModelo, comAArvoreNova, erroAoAcrescentar, erroDaArvore, itensDaArvore, limparArvore, planoDoChecklist, ARVORE_FORA_DE_ORDEM, CHECKLIST_MUDOU } from '../regras/gruposDaLista';
import { MENSAGENS_DA_CAIXA, FOTO_MAXIMA, CLIENTES_MAXIMOS, COLABORADORES_MAXIMOS, COMENTARIOS_DO_CARTAO, DEMANDAS_LIGADAS, OBJETOS_MAXIMOS, PARTICIPANTES_MAXIMOS, POR_COLUNA, POR_PAGINA, TAMANHO_CONTRATO, TAMANHO_ITEM, TAMANHO_LISTA, TAREFAS_LIGADAS,
  LOTE_MAXIMO_DA_IMPORTACAO, TAMANHO_IMPORTACAO, TAMANHO_OBSERVACOES, HISTORICO_DO_PROCESSO, OPCOES_POR_CAMPO, TAMANHO_CAMPO, DIGITOS_DO_NUMERO, TROCAS_DE_EMAIL_MOSTRADAS, TROCAS_DE_EMAIL_POR_HORA } from './limites';
import { fmtCentavos } from '../regras/caixa';
import { fmtData } from '../regras/pessoa';
import { CONTRATOS_POR_TAREFA, DEMANDAS_POR_TAREFA, DIAS_PARADO, PARCELAS_DA_PESSOA, TAMANHO_CONFERENCIA, TAMANHO_TAREFA } from './limites';
import type { CategoriaDeLancamento, LinhaDaConferencia, MeuValor, MovimentoDoLucro, ParaReceber, Parcela, ParcelaDoEscritorio, RecebimentoGravado, Repasse, Socio, ValorAPassar } from './tipos';
import { TAMANHO_FINANCEIRO, VALOR_MAXIMO_DO_LANCAMENTO } from './limites';
import { PARTES_MAXIMAS } from './limites';
import { ANOS_DO_CALENDARIO, ANDAMENTOS_DO_PROCESSO, COMPROMISSOS_LIGADOS, HISTORICO_DO_COMPROMISSO, ITENS_DA_AGENDA, ITENS_DO_COMPROMISSO, PROCESSOS_PARA_LIGAR, TAMANHO_FUNCAO_NA_TAREFA, TAMANHO_SALA, TAMANHO_COMPROMISSO, PRAZOS_DO_PROCESSO, TAMANHO_ANDAMENTO, TAMANHO_DIA, TAMANHO_ETIQUETA, TAMANHO_GRUPO, TAMANHO_ORGAO, TAMANHO_PRAZO } from './limites';
import { CORES } from '../regras/etiquetas';
import type { Anotacao, AnotacaoLigada, AnotacaoLigadaComTexto, AnotacaoLista, DadosAnotacao, FiltroAnotacoes, ItemDaAnotacao, ModuloDaAnotacao, ModuloMencionavel, Pasta } from './tipos';
import { erroAoMoverPasta, erroDoNomeDaPasta, nomeDaPasta, PASTA_APAGADA, PASTA_COM_CONTEUDO, PASTA_SUMIU, textoDoCaminho } from '../regras/pastas';
import type { ContratoDoCartao, DemandaDaTarefa, EquipeDoContrato } from './tipos';
import type { FiltroParaLigar, LigacaoDeUmSo } from './tipos';
import { ANOTACOES_LIGADAS, HISTORICO_DA_ANOTACAO, ITENS_DA_ANOTACAO, ITENS_PARA_LIGAR, TAMANHO_ANOTACAO } from './limites';
import type { GrupoDoPedido, ItemParaPedir, ModuloDoPedido, PedidoDaMensagem } from './tipos';
import type { PapelDaParte, ParteDoProcesso } from './tipos';
import { LISTA_CHEIA, RECUSA_DO_PEDIDO } from '../regras/pedidoDeParticipacao';
import type { EntrouComo, ItemDaInclusao } from './tipos';
import { avisoDaMudanca, mudancasDaEquipe, type EquipeDoItem, type SequenciaDeMudancas } from '../regras/inclusao';
import { AVISO_DESFEITO } from '../ui/tempos';
import { juntarAsCaixas } from '../regras/mensagens';
import {
  ABRE_A_ANOTACAO, alteraAAnotacao, ITEM_DA_ANOTACAO, excluiAAnotacao, itemDaAnotacao, ligaNaAnotacao, mencaoNegadaNaAnotacao, modulosLigados, motivoSemMencaoNaAnotacao, veAAnotacao, type ChavesDaEquipe
} from '../regras/anotacao';
import { anoAceito, dataExiste, padraoDoOrgao } from '../regras/calendario';
import { PRAZO_MAXIMO_DIAS, TIPOS_SEM_EXPEDIENTE } from '../regras/prazos';
import { DIA, HORA, SEGUNDO } from '../ui/tempos';
import { arquivadosComOContrato } from '../regras/arquivarContrato';
import { excluidosComOsContratos, RECUSA_DA_EXCLUSAO, tarefasDeCadaContrato } from '../regras/exclusaoDoContrato';
import { semAPessoa } from '../regras/esquecimentoNaCopia';

const CHAVE = 'semper-dados-falsos';
const espera = <T>(v: T): Promise<T> => new Promise(r => setTimeout(() => r(structuredClone(v)), 60));
const novoId = () => crypto.randomUUID();
const codigo = () => Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, '0');
const codigoConvite = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
const agora = () => new Date().toISOString();
/** Quem está logado no banco fictício: o master do escritório de exemplo, ou a conta que um teste escolher (SEMPER_FALSO.entrarComo). */
let eu = 'u-master';

// O CPF de cada um dá a sigla dos contratos de que é responsável (2 letras do nome e 2 últimos dígitos do CPF).
type MembroFalso = Required<Omit<Membro, 'cor' | 'pessoa_id' | 'foto' | 'reservada' | 'excluido'>> & { cor: string | null; pessoa_id: string; email: string; cpf: string; reservada?: boolean; excluido?: boolean };
const EQUIPE: MembroFalso[] = [
  { id: 'u-master', funcao: 'advogado', nome: 'Mauro Teixeira Duarte', usuario: 'mauro.duarte', papel: 'master', ativo: true, cor: null, pessoa_id: 'p-mauro', email: 'mauro@exemplo.com', cpf: '11122233396' },
  { id: 'u-ana', funcao: 'advogado', nome: 'Ana Teste Lima', usuario: 'ana.lima', papel: 'admin', ativo: true, cor: null, pessoa_id: 'p-ana', email: 'ana@exemplo.com', cpf: '22233344405' },
  { id: 'u-bruno', funcao: 'estagiario', nome: 'Bruno Exemplo Souza', usuario: 'bruno.souza', papel: 'usuario', ativo: true, cor: null, pessoa_id: 'p-bruno', email: 'bruno@exemplo.com', cpf: '33344455508' },
  { id: 'u-carla', funcao: 'administrativo', nome: 'Carla Fictícia Rocha', usuario: 'carla.rocha', papel: 'usuario', ativo: false, cor: null, pessoa_id: 'p-carla', email: 'carla@exemplo.com', cpf: '44455566619' }
];
const ETAPAS = ['Lead', 'Entrar em contato', 'Retornar contato', 'Reunião/atendimento', 'Atendimento em andamento',
  'Levantamento de informações', 'Orçamento solicitado', 'Orçamento em andamento', 'Orçamento enviado', 'Enviar carta proposta',
  'Contrato em andamento', 'Confecção de documentos', 'Mensagem de boas-vindas', 'Efetuar cobrança', 'Pesquisa de satisfação',
  'Pendência/observações', 'Pendente tratamento', 'Não conversão'];
/** Colunas iniciais do quadro de contratos (as mesmas sugestões do banco, supabase/migrations/20261027000009_contratos.sql). */
const SITUACOES_CONTRATO = ['Em negociação', 'Aguardando assinatura', 'Assinado / em andamento', 'Encerrado', 'Rescindido'];
/** Colunas iniciais do quadro de demandas (supabase/migrations/20261027000017_demandas.sql): a primeira e a última são colunas-marco. */
const SITUACOES_DEMANDA = ['Para fazer', 'Fazendo', 'Aguardando retorno', 'Concluído'];
/** Colunas iniciais do quadro de tarefas (supabase/migrations/20261027000020_tarefas.sql): a primeira e a última são colunas-marco. */
const SITUACOES_TAREFA = ['Para fazer', 'Fazendo', 'Aguardando retorno', 'Concluída'];
const SITUACOES_COMPROMISSO = ['Agendado', 'Confirmado', 'Realizado', 'Cancelado'];
// As sugestões das tarefas têm as colunas de espera (#314) depois de "Fazendo", como quadro_sugestoes no banco.
const SUGESTOES_TAREFA = [...SITUACOES_TAREFA.slice(0, 2), ...COLUNAS_NOVAS_DAS_TAREFAS.colunas.map(c => c.nome), ...SITUACOES_TAREFA.slice(2)];
const SUGESTOES: Partial<Record<Modulo, string[]>> = { pessoas: ETAPAS, contratos: SITUACOES_CONTRATO, demandas: SITUACOES_DEMANDA, tarefas: SUGESTOES_TAREFA };
/** Contrato como fica guardado: sem as pessoas, que são lidas na hora (como as junções do banco); os participantes, pelo id. */
type ContratoGuardado = Omit<Contrato, 'clientes' | 'cliente_nome' | 'participantes' | 'indicador'> & { clientes: string[]; participantes: ParticipanteGravado[] };
/** Modelo de checklist como fica guardado: a árvore é nula no modelo de antes (a leitura a monta pelos itens). */
type ModeloGuardado = Omit<ModeloDeLista, 'arvore'> & { arvore: NoDoModelo[] | null };
/** O aviso de quem entrou num item (#377), como uma linha de mensagens_de_inclusao: só ids, nada do item. */
interface MensagemDeInclusaoGuardada {
  id: string; perfil_id: string; incluido_por: string | null; modulo: ModuloDoPedido; item_id: string; entrou_como: EntrouComo; criado_em: string; lido_em: string | null;
  /** O grupo da equipe pelo qual a pessoa entrou (#378), quando não estava no item por conta própria. */
  grupo_id?: string | null;
}

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
  /**
   * A visualização fechada (#363): em tarefas, demandas, processos e compromissos, cada um vê só os itens de que faz parte, como no banco.
   * Sem ela, o banco fictício mostra tudo nesses módulos. Só os testes ligam: SEMPER_FALSO.fecharVisibilidade(true).
   */
  visibilidadeFechada?: boolean;
  /** Os pedidos para participar (#363), como a tabela pedidos_de_participacao. */
  pedidos?: PedidoGuardado[];
  /** As mensagens dos pedidos, como a tabela mensagens_de_participacao. */
  mensagensDePedido?: { id: string; perfil_id: string; pedido_id: string; tipo: 'pedido' | 'resposta'; criado_em: string; lido_em: string | null }[];
  /** Os avisos de quem entrou num item (#377), como a tabela mensagens_de_inclusao. */
  mensagensDeInclusao?: MensagemDeInclusaoGuardada[];
  /** Os grupos da equipe com quem está em cada um (#378), como as tabelas grupos_da_equipe e grupo_integrantes. */
  gruposDaEquipe?: GrupoDaEquipe[];
  /** A mensagem de quem entrou num grupo (#378), como a tabela mensagens_de_grupo: uma por pessoa e grupo. */
  mensagensDeGrupo?: { id: string; perfil_id: string; grupo_id: string; incluido_por: string | null; criado_em: string; lido_em: string | null }[];
  /** Os avisos das demandas que nascem dos compromissos que se repetem (#307), como a tabela mensagens_de_compromisso. */
  mensagensDeCompromisso?: MensagemDeCompromissoGuardada[];
  /** As sequências de mudanças no papel de cada pessoa em cada item (#377), como a tabela privado.mudancas_na_equipe. */
  mudancasNaEquipe?: (SequenciaDeMudancas & { perfil_id: string; item_id: string })[];
  /** A chave "equipe_ve_tudo" do escritório. Só os testes ligam: SEMPER_FALSO.equipeVeTudo(true). */
  equipeVeTudo?: boolean;
  /** A fase de adaptação: toda a equipe edita tudo, menos o financeiro. */
  equipeEditaTudo?: boolean;
  /** A função de cada conta, quando um teste a muda: SEMPER_FALSO.mudarFuncao('u-bruno', 'advogado'). */
  funcoesDeTeste?: Record<string, Funcao>;
  logado: boolean;
  /** A sessão acabou em outro lugar (troca de e-mail pelo administrador, "Sair" em outro aparelho). Só os testes ligam: SEMPER_FALSO.encerrarSessao(). */
  sessaoEncerrada?: boolean;
  /** A conta logada, quando não é o master. Só os testes mudam: SEMPER_FALSO.entrarComo('u-bruno'). */
  logadoComo?: string;
  tiposVinculo?: VinculoTipo[];
  vinculos?: { id: string; pessoa_de: string; pessoa_para: string; tipo_id: string; descricao: string | null; criado_por: string; criado_em: string }[];
  duasEtapas?: { id: string; ativo: boolean; criado_em: string }[];
  semCodigo?: boolean;   // entrou só com a senha e ainda falta o código do aplicativo
  emailDaConta?: string;   // o e-mail de acesso, depois de uma troca confirmada
  emailPendente?: { email: string; links: string[] } | null;   // a troca esperando os links de confirmação, e os já abertos
  escritorio?: DadosEscritorio;
  contratos?: ContratoGuardado[];
  historicoContratos?: (Historico & { contrato_id: string })[];
  /** Lista de objetos do escritório (objeto_sugestoes no banco), cada um com o id, como no banco (#281). */
  objetoSugestoes?: { id: string; descricao: string }[];
  /** A lista de antes da edição dos objetos (#281), só com os nomes: passa para objetoSugestoes ao abrir. */
  objetosSugeridos?: string[];
  comentarios?: (Comentario & { modulo: ModuloComentado; cartao_id: string; autor_sem_vinculo?: boolean;
    /** No contrato: quem foi mencionado estando num grupo dele (#378); para essas pessoas, a menção não dá os valores. */
    mencoes_pelo_grupo?: string[] })[];
  mensagens?: { id: string; perfil_id: string; tipo: TipoMensagem; comentario_id: string | null; criado_em: string; lido_em: string | null;
    /** Só no aviso de prazo: o módulo e o item (o prazo do processo, ou o próprio cartão), a data e qual aviso é. */
    modulo?: ModuloDoPrazo; item_id?: string; prazo_data?: string; prazo_aviso?: AvisoDePrazo;
    /** Só no lembrete: o instante em que ele chega e a antecedência que o cartão tinha (como mensagens.lembrete_em e lembrete_antes). */
    lembrete_em?: string; lembrete_antes?: Lembrete }[];
  demandas?: DemandaGuardada[];
  historicoDemandas?: (Historico & { demanda_id: string })[];
  /** Contratos que já geraram as demandas automáticas (privado.contratos_com_demandas no banco). */
  contratosComDemandas?: string[];
  /** O contrato que nasceu de cada pessoa em "Contrato fechado" (privado.contratos_do_cliente_fechado no banco). */
  contratosDoClienteFechado?: Record<string, string>;
  /** Se as colunas do cliente ao contrato já foram preparadas (a migração roda uma vez só). */
  colunasDoClienteAoContrato?: boolean;
  /** Cada lista é de uma demanda, de uma tarefa ou de um contrato (demanda_listas no banco). */
  listas?: (Omit<ListaDoCartao, 'itens' | 'grupos'> & { demanda_id?: string; tarefa_id?: string; contrato_id?: string; criado_em: string })[];
  itensDeLista?: (ItemDaLista & { lista_id: string })[];
  /** Os grupos dos checklists (demanda_lista_grupos no banco, #309). */
  gruposDeLista?: (GrupoDaLista & { lista_id: string })[];
  /** A árvore é nula no modelo de antes (lista_modelos.arvore no banco). */
  modelos?: ModeloGuardado[];
  /** Órgãos e dias sem expediente do escritório (orgaos e dias_sem_expediente no banco). */
  orgaos?: Orgao[];
  diasLancados?: DiaLancado[];
  /** Grupos de colunas dos quadros (quadro_grupos no banco). */
  gruposDeColunas?: (GrupoDeColunas & { modulo: Modulo })[];
  /** As tarefas do quadro cujas colunas padrão novas já foram acrescentadas nesta sessão (#314, #315), como as migrações. */
  colunasNovas?: number[];
  /** Etiquetas do escritório e as ligações com os cartões (etiquetas e pessoa_etiquetas, contrato_etiquetas... no banco). */
  etiquetas?: Etiqueta[];
  etiquetasAplicadas?: { modulo: ModuloComEtiquetas; cartao_id: string; etiqueta_id: string }[];
  processos?: ProcessoGuardado[];
  /** As pessoas com papel nos processos (processo_partes, #316). */
  processoPartes?: { id: string; processo_id: string; pessoa_id: string; papel: PapelDaParte; criado_em: string }[];
  historicoProcessos?: (Historico & { processo_id: string })[];
  compromissos?: CompromissoGuardado[];
  historicoCompromissos?: (Historico & { compromisso_id: string })[];
  /** Tarefas, demandas e contratos ligados aos compromissos (compromisso_ligacoes no banco, #306). */
  /** `item_nome`: o item como o histórico mostra ("Tarefa T1"), guardado ao ligar, para o histórico de quando o item é excluído. */
  compromissoLigacoes?: { compromisso_id: string; modulo: ModuloDoCompromisso; item_id: string; item_nome?: string | null; criado_em: string }[];
  /** As salas do escritório (salas no banco, #308). */
  salas?: Sala[];
  /** As funções dos participantes da tarefa (funcoes_na_tarefa no banco, #313). */
  funcoesNaTarefa?: FuncaoNaTarefa[];
  /** As séries dos compromissos que se repetem (compromisso_repeticoes no banco, #307). */
  repeticoes?: RepeticaoGuardada[];
  opcoesDeProcesso?: OpcaoDeProcesso[];
  camposDeProcesso?: CampoDeProcesso[];
  contasFinanceiras?: ContaFinanceira[];
  lancamentos?: LancamentoGuardado[];
  historicoLancamentos?: (Historico & { lancamento_id: string })[];
  dasDoEscritorio?: AliquotaDoDas[];
  ajustesFinanceiros?: Historico[];
  parcelas?: ParcelaGuardada[];
  conferencia?: LinhaDaConferencia[];
  historicoConferencia?: (Historico & { conferencia_id: string })[];
  recebimentos?: RecebimentoGuardado[];
  repasses?: RepasseGuardado[];
  /** O que o responsável já passou a cada terceiro (financeiro_terceiros_pagos no banco). */
  terceirosPagos?: TerceiroPago[];
  socios?: SocioGuardado[];
  retiradas?: RetiradaGuardada[];
  /** Os contratos que já geraram as parcelas (uma vez só, como privado.contratos_com_parcelas). */
  contratosComParcelas?: string[];
  historicoParcelas?: (Historico & { contrato_id: string })[];
  /** As demandas ligadas aos processos (processo_demandas no banco). */
  processoDemandas?: { processo_id: string; demanda_id: string; papel?: PapelDaDemandaNoProcesso }[];
  /** As demandas relacionadas (demandas_relacionadas no banco, #310): as duas em ordem, a menor primeiro. Os números vêm das demandas. */
  demandasRelacionadas?: { demanda_a: string; demanda_b: string }[];
  /** O que cada contrato arquivou junto (privado.arquivados_com_contrato no banco, #284): o id da demanda ou da tarefa. */
  arquivadosComContrato?: { contrato_id: string; id: string }[];
  /** A cópia escondida do dinheiro que saiu com o contrato excluído (financeiro_excluidos no banco, #284). Ninguém lê pela tela. */
  financeiroExcluidos?: { contrato_id: string; contrato_codigo: string; tipo: 'recebimento' | 'parcela_importada'; parcela_numero: number; data: string | null;
    valor: number; conta_id: string | null; estornado: boolean; copia: unknown; excluido_por: string; excluido_em: string }[];
  /** Os processos ligados aos contratos (contrato_processos no banco). */
  contratoProcessos?: { contrato_id: string; processo_id: string }[];
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
  /** A sincronização dos contatos (a chave e o problema em privado.ligacoes, a fila em contatos_google_fila no banco). */
  contatosGoogle?: {
    ativos: boolean; fila: string[]; com_falha: number; problema: ProblemaDaSincronizacao | null; problema_em: string | null; sincronizado_em: string | null;
    /** Quando terminou a primeira sincronização (contatos_primeira_em em privado.ligacoes); vazio: por fazer. */
    primeira_em?: string | null;
    /** Pessoa → o contato ligado a ela no Google (contatos_google no banco). */
    ligados?: Record<string, string>;
    /** A lista Para conferir, com as decisões (contatos_google_conferir no banco). */
    conferir?: DuvidaGuardada[];
    /** A conta Google simulada: os contatos que já estão lá antes da primeira sincronização (os testes põem aqui). */
    noGoogle?: ContatoDaConta[];
    /** A conta Google simulada não responde: a primeira sincronização falha (os testes põem aqui). */
    googleFora?: boolean;
  };
  tarefas?: TarefaGuardada[];
  /** Registros de tempo nas tarefas (tarefa_tempos no banco). */
  tempos?: (RegistroDeTempo & { tarefa_id: string })[];
  historicoTarefas?: (Historico & { tarefa_id: string })[];
  /** Anotações do módulo Documentos (anotacoes, anotacao_ligacoes e anotacao_historico no banco). */
  anotacoes?: Anotacao[];
  /** Cada ligação, a um item só (no banco, uma coluna por módulo). */
  anotacaoLigacoes?: { anotacao_id: string; modulo: ModuloDaAnotacao; item_id: string; criado_por: string; criado_em: string }[];
  historicoAnotacoes?: (Historico & { anotacao_id: string })[];
  /** Pastas dos documentos (anotacao_pastas no banco, #342). */
  pastas?: Pasta[];
}
/** Demanda como fica guardada: os clientes pelo id; os nomes e o contrato são lidos na hora (como as junções do banco). */
type DemandaGuardada = Omit<Demanda, 'clientes' | 'cliente_nome' | 'contrato'> & { clientes: string[] };
/** Processo como fica guardado: os clientes pelo id; os nomes são lidos na hora. */
type ProcessoGuardado = Omit<Processo, 'clientes' | 'cliente_nome'> & { clientes: string[] };
/** Compromisso como fica guardado: as pessoas pelo id; os nomes e o processo são lidos na hora. */
type CompromissoGuardado = Omit<Compromisso, 'pessoas' | 'pessoa_nome' | 'processo'> & { pessoas: string[]; demanda_gerada_em?: string | null };
/** O aviso da demanda que nasceu de um compromisso (#307), como fica guardado: quem recebe e os ids (o título vem da demanda, na hora). */
type MensagemDeCompromissoGuardada = Omit<DemandaDoCompromissoDaMensagem, 'demanda'> & { id: string; perfil_id: string; demanda_id: string; criado_em: string; lido_em: string | null };
/** Tarefa como fica guardada: as pessoas pelo id; os nomes, a demanda e o contrato são lidos na hora (como as junções do banco). */
type LancamentoGuardado = Lancamento & { excluido_em: string | null };
type ParcelaGuardada = Parcela & { excluido_em: string | null };
type RecebimentoGuardado = RecebimentoGravado & { responsavel_id: string | null; estornado_em: string | null; lancamento_id: string; lancamento_taxa_id: string | null; socio_pessoa_id: string | null; socio_nome: string | null };
type RetiradaGuardada = MovimentoDoLucro['retiradas'][number] & { lancamento_id: string; excluido_em: string | null };
type RepasseGuardado = Repasse & { cancelado_em: string | null; lancamento_id: string | null; perfil_id: string | null; pessoa_id: string | null };
interface TerceiroPago { recebimento_id: string; pessoa_id: string; pago_em: string; marcado_por: string; marcado_em: string }
type SocioGuardado = Omit<Socio, 'nome'> & { excluido_em: string | null };
type AndamentoGuardado = Omit<AndamentoDeProcesso, 'tarefa'> & { excluido_em: string | null };
type PrazoGuardado = Omit<PrazoDeProcesso, 'tarefa'> & { excluido_em: string | null };
/** O pedido para participar como fica guardado (o tipo do processo vem na leitura). */
type PedidoGuardado = Omit<PedidoDaMensagem, 'tipo_do_processo'> & { criado_em: string; respondido_em: string | null };
type TarefaGuardada = Omit<Tarefa, 'pessoas' | 'pessoa_nome' | 'demanda' | 'contrato' | 'processo' | 'demandas_ligadas' | 'contratos_ligados'> & { pessoas: string[] };
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
/** Exemplos de cada caso: confere, só na planilha do advogado, só no caixa e de outra pessoa da equipe. */
function sementeConferencia(): LinhaDaConferencia[] {
  const base = { ano: 2026, responsavel_id: eu, servico: 'Honorários', referencia: null, parcela_id: null, valor_esperado: null, conta_caixa: null, motivo: null, situacao: null, observacao: null, marcado_por: null, marcado_em: null };
  return [
    { ...base, id: 'conf-1', cliente: 'CLIENTE QUE CONFERE', referencia: 'MA96-0001-2026', data_pago: '2026-03-10', valor_pago: 100000, valor_esperado: 30000, data_caixa: '2026-03-11', valor_caixa: 30000, conta_caixa: 'PJ', sugestao: 'confere' },
    { ...base, id: 'conf-2', cliente: 'CLIENTE SEM ENTRADA', data_pago: '2026-04-05', valor_pago: 50000, data_caixa: null, valor_caixa: null, sugestao: 'nao_confere', motivo: 'Sem entrada na planilha geral' },
    { ...base, id: 'conf-3', cliente: 'CLIENTE SÓ NO CAIXA', data_pago: null, valor_pago: null, data_caixa: '2026-05-20', valor_caixa: 15000, conta_caixa: 'PF', sugestao: 'nao_confere', motivo: 'Só na planilha geral' },
    { ...base, id: 'conf-4', responsavel_id: 'u-ana', cliente: 'CLIENTE DA ANA', data_pago: '2026-02-01', valor_pago: 20000, data_caixa: '2026-02-01', valor_caixa: 6000, conta_caixa: 'PJ', sugestao: 'confere' },
    { ...base, id: 'conf-5', ano: 2025, cliente: 'CLIENTE DE 2025', data_pago: '2025-08-01', valor_pago: 40000, data_caixa: '2025-08-02', valor_caixa: 12000, conta_caixa: 'PJ', sugestao: 'confere' },
  ];
}

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
    id: '', codigo: '', titulo: '', descricao: null, prazo: null, prazo_hora: null, lembrete: null, responsavel_id: '', colaboradores: [], clientes: [], contrato_id: null,
    contrato_codigo: null, objeto: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null, criado_por: eu,
    criado_em: agora(), atualizado_por: null, atualizado_em: agora(), data_inicio: inicioDoCriadoEm(agora())
  };
}
/** Tarefa com os campos que não vêm no cadastro já vazios (como os padrões do banco). */
function tarefaNova(): TarefaGuardada {
  return {
    id: '', codigo: '', titulo: '', descricao: null, prazo: null, prazo_hora: null, lembrete: null, responsavel_id: '', participantes: [], pessoas: [], demanda_id: null, demanda_codigo: null,
    diligencia: false, diligencia_motivo: null, solicitante_id: null, funcoes: {}, precisa_aprovacao: false,
    contrato_id: null, contrato_codigo: null, demanda_ids: [], contrato_ids: [], processo_id: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null, criado_por: eu,
    criado_em: agora(), atualizado_por: null, atualizado_em: agora(), concluida_em: null, data_inicio: inicioDoCriadoEm(agora())
  };
}
/** A data de daqui a alguns dias (negativo: dias atrás), como o banco guarda (aaaa-mm-dd), contada a partir do dia em Brasília. */
const dataDaqui = (dias: number) => somarDias(hojeNaAgenda(), dias);
/** Contrato com os campos que não vêm no cadastro já vazios (como os padrões do banco). */
function contratoNovo(): ContratoGuardado {
  return {
    id: '', codigo: '', numero: 0, sigla: '', ano: 0, codigo_antigo: null, cliente_id: '', clientes: [], responsavel_id: '', objetos: [], servico: '', categoria: 'pro_labore',
    valor: null, entrada: null, parcelas: null, descontos: null, negociacao_inicio: null, assinado_em: null, primeiro_pagamento: null, percentual_escritorio: null,
    participantes: [], indicador_id: null, indicador_percentual: null, documento_url: null, conta_destino_id: null, observacoes: null,
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
bd.contratos.forEach(k => { k.conta_destino_id ??= null; });
bd.contratosDoClienteFechado ??= {};
// Do cliente ao contrato (como a migração cliente_ao_contrato): em Contratos, "Aguardando assinatura" é coluna-marco; em
// Pessoas, entram "Em negociação" e "Contrato fechado" (coluna-marco), no fim do quadro, se ainda não existem.
/** Meia posição: a coluna nova fica logo antes da do assinado (como a migração). */
const MEIA_POSICAO = 0.5;
if (!bd.colunasDoClienteAoContrato) {
  bd.colunasDoClienteAoContrato = true;
  const deContratos = bd.colunas.filter(c => c.modulo === 'contratos');
  if (!deContratos.some(c => c.marco === 'aguardando_assinatura')) {
    const mesmoNome = deContratos.find(c => normal(c.nome) === normal('Aguardando assinatura'));
    const assinado = deContratos.find(c => c.marco === 'assinado');
    if (mesmoNome) mesmoNome.marco = 'aguardando_assinatura';
    else bd.colunas.push({ id: novoId(), nome: 'Aguardando assinatura', modulo: 'contratos', criado_por: null, marco: 'aguardando_assinatura',
      ordem: assinado ? assinado.ordem - MEIA_POSICAO : Math.max(0, ...deContratos.map(c => c.ordem)) + 1 });
  }
  for (const [nome, marco] of [['Em negociação', null], ['Contrato fechado', 'contrato_fechado']] as const) {
    const dePessoas = bd.colunas.filter(c => (c.modulo ?? 'pessoas') === 'pessoas');
    if (marco && dePessoas.some(c => c.marco === marco)) continue;
    const mesmoNome = dePessoas.find(c => normal(c.nome) === normal(nome));
    if (mesmoNome) { if (marco) mesmoNome.marco = marco; continue; }
    bd.colunas.push({ id: novoId(), nome, ordem: Math.max(0, ...dePessoas.map(c => c.ordem)) + 1, criado_por: null, marco });
  }
}
bd.historicoContratos ??= [];
// Sessões abertas antes dos vários objetos: o serviço vira a lista (como a migração 010), que entra na lista do escritório.
bd.contratos.forEach(k => { k.objetos ??= limparObjetos(k.servico.split(';')); });
// Sessões abertas antes do início das negociações (#311): a data fica vazia, como a coluna nova do banco.
bd.contratos.forEach(k => { k.negociacao_inicio ??= null; });
bd.objetoSugestoes ??= objetosDefinidos(bd.objetosSugeridos ?? bd.contratos.flatMap(k => k.objetos)).map(descricao => ({ id: novoId(), descricao }));
delete bd.objetosSugeridos;
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
    { id: novoId(), lista_id: lista, texto: 'Comprovante de inscrição e de situação cadastral', prazo: null, feito_em: agora(), feito_por: 'u-ana', ordem: 1, grupo_id: null, criado_em: agora() },
    { id: novoId(), lista_id: lista, texto: 'Quadro de sócios e administradores', prazo: dataDaqui(3), feito_em: null, feito_por: null, ordem: 2, grupo_id: null, criado_em: agora() },
    { id: novoId(), lista_id: lista, texto: 'Atos constitutivos', prazo: null, feito_em: null, feito_por: null, ordem: 3, grupo_id: null, criado_em: agora() }
  ] : [];
}
bd.itensDeLista ??= [];
bd.gruposDeLista ??= [];
// Itens guardados na sessão antes dos grupos (no banco, a coluna nasce vazia).
bd.itensDeLista.forEach(i => { i.grupo_id ??= null; i.criado_em ??= ''; });
// Três modelos de exemplo: dois com os documentos do modelo do Trello do escritório (sem grupos, como os de antes) e um com
// grupos e subgrupos (#309).
bd.modelos ??= [
  { id: novoId(), nome: 'Documentos de pessoa física', itens: ['Documento pessoal', 'Comprovante de residência'], arvore: null, criado_por: 'u-ana', atualizado_em: agora() },
  { id: novoId(), nome: 'Documentos de pessoa jurídica', itens: ['Comprovante de inscrição e de situação cadastral', 'Quadro de sócios e administradores', 'Atos constitutivos'],
    arvore: null, criado_por: 'u-ana', atualizado_em: agora() },
  { id: novoId(), nome: 'Benefício previdenciário', ...modeloDaArvore([
    { texto: 'Documentos pessoais', filhos: [{ texto: 'RG' }, { texto: 'CPF' }] },
    { texto: 'Benefício', filhos: [
      { texto: 'Aposentadoria por idade', filhos: [{ texto: 'CNIS' }, { texto: 'Carteira de trabalho' }] },
      { texto: 'Auxílio-doença', filhos: [{ texto: 'Laudo médico' }] }] }]), criado_por: 'u-ana', atualizado_em: agora() }
];
// Modelos guardados na sessão antes da árvore: são os de antes.
bd.modelos.forEach(m => { m.arvore ??= null; });
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
// Os quadros de processos, como a função criar_quadros_de_processos da migração: grupos, colunas e marcos. Desde a #406, só o judicial
// e o administrativo (os da sessão aberta antes, extrajudicial e de investigações, ficam, como no banco).
const QUADROS_DE_PROCESSOS: Record<QuadroDeProcesso, { nome: string; fechado?: boolean; colunas: string[] }[]> = {
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
/** O grupo da busca pelo código de cada tipo de processo, como privado.grupo_do_tipo_de_processo no banco. */
const GRUPO_DO_TIPO: Record<TipoProcesso, GrupoDoPedido> = { judicial: 'judiciais', administrativo: 'administrativos' };
/** Folga entre a última coluna e o primeiro grupo de um quadro, a mesma de privado.folga_dos_grupos() no banco (#296). */
const FOLGA_DOS_GRUPOS = 1_000_000;
for (const [modulo, grupos] of Object.entries(QUADROS_DE_PROCESSOS) as[keyof typeof QUADROS_DE_PROCESSOS, (typeof QUADROS_DE_PROCESSOS)[keyof typeof QUADROS_DE_PROCESSOS]][]) {
  if (bd.colunas.some(c => c.modulo === modulo)) continue;
  const total = grupos.flatMap(g => g.colunas).length;
  let ordem = 0;
  grupos.forEach((g, i) => {
    // Como o gatilho zz_grupos_depois_das_colunas (#296): os grupos ficam depois de todas as colunas, com a folga.
    const grupo = { id: novoId(), nome: g.nome, ordem: total + FOLGA_DOS_GRUPOS + i + 1, comeca_fechado: !!g.fechado, modulo };
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
bd.contasFinanceiras ??= [];
bd.lancamentos ??= [];
bd.historicoLancamentos ??= [];
bd.dasDoEscritorio ??= [];
bd.ajustesFinanceiros ??= [];
bd.parcelas ??= [];
bd.conferencia ??= sementeConferencia();
bd.historicoConferencia ??= [];
bd.recebimentos ??= [];
bd.repasses ??= [];
bd.terceirosPagos ??= [];
bd.socios ??= [];
bd.retiradas ??= [];
// Como ao ligar o módulo no banco: o que já foi assinado não gera sozinho, nem se sair e voltar para a coluna.
bd.contratosComParcelas ??= (bd.contratos ?? []).filter(k => k.assinado_em).map(k => k.id);
bd.historicoParcelas ??= [];
bd.processoDemandas ??= [];
bd.demandasRelacionadas ??= [];
bd.arquivadosComContrato ??= [];
bd.financeiroExcluidos ??= [];
bd.processoPartes ??= [];
bd.contratoProcessos ??= [];
bd.diasParado ??= DIAS_PARADO.padrao;
bd.andamentos ??= [];
bd.prazos ??= [];
bd.historicoProcessos ??= [];
bd.processos ??= (() => {
  const coluna = (nome: string) => bd.colunas.find(c => c.nome === nome)?.id ?? null;
  const pessoa = (nome: string) => bd.pessoas.find(p => p.nome === nome)?.id;
  const base = { campos: {}, titulo: null, responsavel_id: eu, colaboradores: [] as string[], sistema: null, polo: null, area: null, meio: null, natureza: null, gratuidade: null, comarca: null, vara: null,
    classe: null, assunto: null, juiz: null, distribuicao: null, valor_causa: null, instancia: null, segredo: false, advogado_contrario: null, observacoes: null, arquivado_em: null, arquivado_por: null,
    criado_por: eu, criado_em: agora(), atualizado_por: eu, atualizado_em: agora(), etapa_ordem: 1, origem_id: null, ligacao: null };
  const lista: ProcessoGuardado[] = [];
  const jose = pessoa('JOSÉ DA SILVA TESTE'), maria = pessoa('MARIA APARECIDA EXEMPLO');
  if (jose) lista.push({ ...base, id: novoId(), codigo: codigo(), tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', orgao: 'TJMG', comarca: 'Montes Claros', vara: '2ª Vara Cível', clientes: [jose], etapa_id: coluna('Distribuído') });
  if (maria) lista.push({ ...base, id: novoId(), codigo: codigo(), tipo: 'administrativo', numero: '912345678', titulo: 'Registro da marca Exemplo', orgao: 'INPI', clientes: [maria], etapa_id: coluna('Protocolado') });
  return lista;
})();
// Colunas de compromissos: "Agendado" e "Realizado" são as colunas-marco (como a migração de compromissos).
if (!bd.colunas.some(c => c.modulo === 'compromissos')) {
  bd.colunas.push(...SITUACOES_COMPROMISSO.map((nome, i) => ({ id: novoId(), nome, ordem: i + 1, criado_por: null, modulo: 'compromissos' as const,
    marco: nome === 'Agendado' ? 'inicio' as const : nome === 'Realizado' ? 'concluido' as const : null })));
}
bd.historicoCompromissos ??= [];
bd.compromissoLigacoes ??= [];
bd.salas ??= [];
// A função de fábrica dos participantes da tarefa (#313): só "Executa" (#421), como a migração e o gatilho do escritório novo.
bd.funcoesNaTarefa ??= [{ id: 'fn-executa', nome: 'Executa', executa: true, ordem: 1 }];
/** O id da "Acompanha" que vinha de fábrica antes da #421 (só para tirá-la das sessões abertas antes). */
const ACOMPANHA_DE_FABRICA = 'fn-acompanha';
bd.repeticoes ??= [];
// Compromissos de exemplo: a audiência do processo de JOSÉ DA SILVA TESTE, amanhã, e a reunião de equipe de hoje, na Agenda geral.
bd.compromissos ??= (() => {
  const coluna = bd.colunas.find(c => c.modulo === 'compromissos' && c.nome === 'Agendado')?.id ?? null;
  const processo = bd.processos!.find(p => p.tipo === 'judicial');
  const base = { hora_fim: null, resultado: null, observacoes: null, participantes: [] as string[], responsavel_id: eu, etapa_id: coluna, etapa_ordem: 1, arquivado_em: null, arquivado_por: null,
    criado_por: eu, criado_em: agora(), atualizado_por: eu, atualizado_em: agora() };
  const lista: CompromissoGuardado[] = [{ ...base, id: novoId(), codigo: codigo(), tipo: 'reuniao', titulo: 'Reunião de equipe', data: hojeNaAgenda(), hora: '09:00:00', modalidade: 'presencial', local: 'Sala de reuniões',
    geral: true, pessoas: [], processo_id: null, processo_codigo: null, processo_numero: null }];
  if (processo) lista.push({ ...base, id: novoId(), codigo: codigo(), tipo: 'audiencia', titulo: null, data: somarDias(hojeNaAgenda(), 1), hora: '14:00:00', modalidade: 'presencial', local: 'Fórum de Montes Claros',
    geral: false, pessoas: processo.clientes, processo_id: processo.id, processo_codigo: processo.codigo, processo_numero: processo.numero });
  return lista;
})();
// Colunas de tarefas: "Para fazer" e "Concluída" são as colunas-marco (como a migração 020).
if (!bd.colunas.some(c => c.modulo === 'tarefas')) {
  bd.colunas.push(...SITUACOES_TAREFA.map((nome, i) => ({ id: 't' + (i + 1), nome, ordem: i + 1, criado_por: null, modulo: 'tarefas' as const,
    marco: i === 0 ? 'inicio' as const : i === SITUACOES_TAREFA.length - 1 ? 'concluido' as const : null })));
}
bd.historicoTarefas ??= [];
// Colunas padrão que chegaram depois (#314, #315): acrescentadas uma vez em cada sessão, sem repetir as que já existem, como as
// migrações fazem com o escritório que já existe (e o gatilho, com o escritório novo).
bd.colunasNovas ??= [];
/** A tarefa que pôs as colunas da investigação no quadro administrativo (a marca de que a sessão já as ganhou). */
const TAREFA_DA_INVESTIGACAO = 406;
/** Acrescenta ao quadro as colunas padrão que faltam (como privado.acrescentar_colunas_padrao). */
function acrescentarColunasPadrao(modulo: Modulo, novas: ColunasNovas) {
  const grupos = bd.gruposDeColunas!.filter(g => g.modulo === modulo);
  const plano = planoDasColunasNovas(bd.colunas.filter(c => c.modulo === modulo), grupos, novas);
  if (!plano) return;
  let grupoId = plano.grupoId;
  if (plano.grupoNovo) {
    grupoId = novoId();
    bd.gruposDeColunas!.push({ id: grupoId, ...plano.grupoNovo, comeca_fechado: false, modulo });
  }
  bd.colunas.push(...plano.colunas.map(c => ({ id: novoId(), ...c, criado_por: null, modulo, grupo_id: grupoId, marco: null })));
}
for (const { tarefa, modulo, novas } of COLUNAS_NOVAS_POR_TAREFA) {
  if (bd.colunasNovas.includes(tarefa)) continue;
  bd.colunasNovas.push(tarefa);
  acrescentarColunasPadrao(modulo, novas);
}
// As colunas da investigação no quadro administrativo (#406), uma vez, como privado.investigacao_no_administrativo. Os processos dos
// tipos que saíram são convertidos no fim do arquivo (converterTiposQueSairam), depois que tudo o que a conversão usa existe.
if (!bd.colunasNovas.includes(TAREFA_DA_INVESTIGACAO)) {
  bd.colunasNovas.push(TAREFA_DA_INVESTIGACAO);
  const modulo = QUADRO_ADMINISTRATIVO;
  const novas = colunasDaInvestigacaoNoQuadro(bd.colunas.filter(c => c.modulo === modulo), bd.gruposDeColunas!.filter(g => g.modulo === modulo));
  bd.colunas.push(...novas.map(c => ({ id: novoId(), ...c, criado_por: null, modulo, marco: null })));
}
// A coluna de aprovação das tarefas (#313), como privado.marcar_coluna_de_aprovacao: a "Aguardando: análise do solicitante" (ou a de
// nome parecido); sem ela, uma nova depois de "Fazendo". Uma vez: depois, a marca fica, mesmo que a coluna seja renomeada.
const colunasDeTarefas = () => bd.colunas.filter(c => c.modulo === 'tarefas');
if (colunasDeTarefas().length && !colunasDeTarefas().some(c => c.de_aprovacao)) {
  if (!colunaDeAprovacaoNoQuadro(colunasDeTarefas())) acrescentarColunasPadrao('tarefas', COLUNA_DE_APROVACAO_DAS_TAREFAS);
  const aprovacao = colunaDeAprovacaoNoQuadro(colunasDeTarefas());
  if (aprovacao) aprovacao.de_aprovacao = true;
}
// Sessões abertas antes da data de início (#357): cada demanda começa no dia em que foi criada (como a migração data_de_inicio).
bd.demandas.forEach(d => { d.data_inicio ??= inicioDoCriadoEm(d.criado_em); });
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
// Sessões abertas antes da data de início (#357): cada tarefa começa no dia em que foi criada (como a migração data_de_inicio).
bd.tarefas.forEach(t => { t.data_inicio ??= inicioDoCriadoEm(t.criado_em); });
// Sessões abertas antes da diligência (#313): a tarefa é comum, sem motivo (como o padrão da migração).
bd.tarefas.forEach(t => { t.diligencia ??= false; t.diligencia_motivo ??= null; });
// Sessões abertas antes das funções e do solicitante (#313): sem solicitante; os participantes ficam sem função (#421).
bd.tarefas.forEach(t => { t.solicitante_id ??= null; t.funcoes = funcoesDaTarefaNoFalso(t); });
// Sessões abertas antes da #421: a "Acompanha" de fábrica sai, e quem estava nela fica sem função (como a migração). Renomeada ou
// marcada como de execução, o escritório a adotou, e ela fica.
const acompanhaDeFabrica = bd.funcoesNaTarefa?.find(f => ehAcompanhaDeFabrica(f, f.id === ACOMPANHA_DE_FABRICA));
if (acompanhaDeFabrica) {
  bd.funcoesNaTarefa = bd.funcoesNaTarefa!.filter(f => f !== acompanhaDeFabrica);
  bd.tarefas.forEach(t => { t.funcoes = semAFuncao(t.funcoes, acompanhaDeFabrica.id); });
}
// Sessões abertas antes da aprovação (#313): a tarefa não precisa de aprovação (como o padrão da migração).
bd.tarefas.forEach(t => { t.precisa_aprovacao ??= false; });
bd.tarefas.forEach(t => { t.concluida_em ??= bd.colunas.find(c => c.id === t.etapa_id)?.marco === 'concluido' ? t.atualizado_em : null; });
// Tempo de exemplo: "Emitir a GRU" (Mauro e Bruno) e "Organizar a pasta", concluída, com um ajuste do Bruno.
if (!bd.tempos) {
  const por = (titulo: string) => bd.tarefas!.find(t => t.titulo === titulo)?.id;
  const gru = por('Emitir a GRU'), pasta = por('Organizar a pasta');
  const contado = (id: number, tarefa_id: string, perfil_id: string, minutos: number) =>
    ({ id, tarefa_id, perfil_id, inicio: new Date(Date.now() - DIA).toISOString(), segundos: minutos * 60, ajuste: false, motivo: null, corrigido_em: null, motivo_da_correcao: null });
  bd.tempos = gru && pasta ? [contado(1, gru, 'u-master', 80), contado(2, gru, 'u-bruno', 40), contado(3, pasta, 'u-bruno', 50),
    { id: 4, tarefa_id: pasta, perfil_id: 'u-bruno', inicio: agora(), segundos: -10 * 60, ajuste: true, motivo: 'Esqueci de pausar no almoço.', corrigido_em: null, motivo_da_correcao: null }] : [];
}
// Sessões abertas antes da correção dos registros (#400): os registros ganham as colunas novas vazias (como a migração).
bd.tempos.forEach(r => { r.corrigido_em ??= null; r.motivo_da_correcao ??= null; });
// Um comentário da Ana na semente, para ver o que é de outro autor (o master apaga, mas não edita).
bd.comentarios ??= [{ id: 'cm1', modulo: 'pessoas', cartao_id: bd.pessoas.find(p => p.nome === 'JOSÉ DA SILVA TESTE')!.id, autor_id: 'u-ana', texto: 'Cliente pediu retorno por WhatsApp, @mauro.duarte.',
  mencoes: ['u-master'], criado_em: new Date(Date.now() - DIA).toISOString(), editado_em: null }];
// Sessões abertas antes da importação: os cadastros ganham as colunas novas vazias (como a migração da importação).
bd.pessoas.forEach(p => { p.importacao_id ??= null; p.referencia ??= null; p.observacoes ??= null; p.pendencias ??= []; });
bd.importacoes ??= [];
// As menções que já existiam entram como lidas, como na migração.
bd.mensagens ??= bd.comentarios.flatMap(c => c.mencoes.filter(perfil => perfil !== c.autor_id)
  .map(perfil => ({ id: novoId(), perfil_id: perfil, tipo: 'mencao' as const, comentario_id: c.id, criado_em: c.criado_em, lido_em: agora() })));
// Anotações (#303): a coleção começa vazia, para não mudar a contagem das seções dos outros módulos.
bd.anotacoes ??= [];
bd.anotacaoLigacoes ??= [];
bd.historicoAnotacoes ??= [];
// Pastas (#342): começam vazias; as anotações de antes ficam fora de qualquer pasta (a coluna nova nasce nula no banco).
bd.pastas ??= [];
bd.anotacoes.forEach(a => { a.pasta_id ??= null; });
// Pedidos para participar (#363): começam vazios.
bd.pedidos ??= [];
bd.mensagensDePedido ??= [];
// Avisos de quem entrou num item (#377): começam vazios.
bd.mensagensDeInclusao ??= [];
bd.gruposDaEquipe ??= [];
bd.mensagensDeGrupo ??= [];
bd.mensagensDeCompromisso ??= [];
bd.mudancasNaEquipe ??= [];
eu = bd.logadoComo ?? eu;
const trocasDeEmail = () => bd.auditoria.filter(r => r.acao === 'troca_email');
const gravar = () => { try { sessionStorage.setItem(CHAVE, JSON.stringify(bd)); } catch { /* sem armazenamento */ } };
gravar();
for (const [id, funcao] of Object.entries(bd.funcoesDeTeste ?? {})) EQUIPE.find(m => m.id === id)!.funcao = funcao;
(window as unknown as { SEMPER_FALSO: unknown }).SEMPER_FALSO = {
  reiniciar: () => { sessionStorage.removeItem(CHAVE); location.reload(); },
  encerrarSessao: () => { bd.sessaoEncerrada = true; gravar(); },
  // Por enquanto, as regras de quem vê o quê só valem para os contratos, as parcelas e as anotações; nos outros módulos, toda conta vê tudo.
  entrarComo: (id: string) => { bd.logadoComo = id; eu = id; gravar(); },
  gerarAvisosDePrazo: (hoje?: string) => gerarAvisosDePrazo(hoje),
  /** A rotina dos lembretes num instante (ISO, ex.: '2030-11-15T13:05:00-03:00'); sem ele, agora. */
  gerarLembretes: (quando?: string) => gerarLembretes(quando ? new Date(quando) : undefined),
  equipeVeTudo: (ligada: boolean) => { bd.equipeVeTudo = ligada; gravar(); },
  /** Fecha a visualização (#363): cada um vê só as tarefas, demandas, processos e compromissos de que faz parte. */
  fecharVisibilidade: (ligada: boolean) => { bd.visibilidadeFechada = ligada; gravar(); },
  /** A parcela como a importação do histórico a traz já paga (#214): recebida, sem recebimento no Caixa. */
  importarParcelaPaga: (id: string, recebidaEm: string, recebido: number) => { Object.assign(acharParcela(id), { recebida_em: recebidaEm, recebido }); gravar(); },
  mudarFuncao: (id: string, funcao: Funcao) => { bd.funcoesDeTeste = { ...bd.funcoesDeTeste, [id]: funcao }; EQUIPE.find(m => m.id === id)!.funcao = funcao; gravar(); }
};

const auditar = (tabela: string, acao: string, p?: { id: string; nome?: string; codigo?: string }, detalhes?: Pick<NonNullable<RegistroAuditoria['resumo']>, 'parcela' | 'recebimento' | 'pago_em' | 'valor' | 'cascata'>) =>
  bd.auditoria.unshift({ id: Date.now() + Math.random(), tabela, registro_id: p?.id ?? null, acao, resumo: { nome: p?.nome, codigo: p?.codigo, ...detalhes }, feito_por: eu, em: agora() });
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
    const antes = { ...existente };
    alterarPessoa(existente, { ...completarVazios(existente, item.dados), observacoes: juntarObservacoes(existente.observacoes, item.observacoes),
      pendencias: juntarPendencias(existente.pendencias, item.pendencias) });
    if (mudouNoGoogle(antes, existente)) enfileirarNoGoogle(existente);
    return existente;
  }
  const dados = Object.fromEntries(COLUNAS_IMPORTADAS.map(c => [c, item.dados[c] ?? null])) as DadosPessoa;
  const p = novaPessoa({ ...dados, telefones: item.dados.telefones ?? [], emails: item.dados.emails ?? [], observacoes: item.observacoes || null,
    pendencias: juntarPendencias([], item.pendencias) }, { criado_em: criadoEmDaImportacao(item.criado_em), importacao_id: importacaoId,
    referencia: item.referencia || null, resp: [] });
  bd.pessoas.push(p); auditar('pessoas', 'inclusao', p); enfileirarNoGoogle(p);
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
/** O que vai ao Google Contatos: mudar outra coisa da pessoa não põe na fila (como o gatilho contato_google no banco). */
const CAMPOS_NO_GOOGLE = ['nome', 'tipo', 'telefones', 'emails', 'nascimento', 'abertura'] as const;
const mudouNoGoogle = (antes: Pick<Pessoa, (typeof CAMPOS_NO_GOOGLE)[number]>, depois: Pessoa) =>
  CAMPOS_NO_GOOGLE.some(k => JSON.stringify(antes[k] ?? null) !== JSON.stringify(depois[k] ?? null));
/** Como o gatilho contato_google: pessoa ativa, com a conta ligada e a sincronização ligada, entra na fila (uma vez só). */
function enfileirarNoGoogle(p: Pessoa) {
  const c = bd.contatosGoogle;
  if (!bd.ligacaoGoogle || !c?.ativos || p.arquivado_em || c.fila.includes(p.id)) return;
  c.fila.push(p.id);
}
/** Uma dúvida da primeira sincronização, como contatos_google_conferir no banco. */
interface DuvidaGuardada {
  id: string; recurso: string; nome: string | null; telefones: string[]; emails: string[]; aniversario: string | null;
  motivo: MotivoParaConferir; candidatos: string[]; criado_em: string; decisao: 'ligada' | 'outra' | 'ignorada' | null;
}
/** Como privado.contato_google_em_duvida: a pessoa está numa dúvida aberta e ainda sem contato; não vai ao Google até a decisão. */
function emDuvidaNoGoogle(id: string) {
  const c = bd.contatosGoogle;
  return !c?.ligados?.[id] && !!c?.conferir?.some(k => !k.decisao && k.candidatos.includes(id));
}
const duvidasAbertas = () => (bd.contatosGoogle?.conferir ?? []).filter(k => !k.decisao);
/** Como contatos_google_primeira_concluir: liga os certos, guarda as dúvidas (a decidida não volta) e põe na fila quem ficou sem contato. */
function primeiraSincronizacaoFalsa(c: NonNullable<Banco['contatosGoogle']>) {
  const ligados = c.ligados ??= {};
  const conferir = c.conferir ??= [];
  const r = corresponder(c.noGoogle ?? [], bd.pessoas.map(p => ({
    id: p.id, tipo: p.tipo, nome: p.nome, telefones: p.telefones, emails: p.emails, nascimento: p.nascimento, abertura: p.abertura, recurso: ligados[p.id] ?? null
  })));
  const jaLigados = new Set(Object.values(ligados));
  let novosLigados = 0;
  for (const l of r.ligar) {
    if (ligados[l.pessoa_id] || jaLigados.has(l.recurso)) continue;
    ligados[l.pessoa_id] = l.recurso; jaLigados.add(l.recurso); novosLigados++;
  }
  for (const k of r.conferir) {
    if (!conferir.some(x => x.recurso === k.recurso)) conferir.push({ ...k, id: novoId(), criado_em: agora(), decisao: null });
  }
  // A dúvida aberta (de uma primeira anterior) cujo contato acabou de ser ligado a alguém já está resolvida.
  c.conferir = conferir.filter(k => k.decisao || !jaLigados.has(k.recurso));
  for (const p of bd.pessoas) if (!p.arquivado_em && !ligados[p.id] && !emDuvidaNoGoogle(p.id) && !c.fila.includes(p.id)) c.fila.push(p.id);
  c.primeira_em = agora();
  auditar('ligacoes', 'alteracao', { id: 'google', nome: bd.ligacaoGoogle?.conta_email });
  return { ligados: novosLigados, para_conferir: duvidasAbertas().length, novos: c.fila.filter(id => !ligados[id] && !emDuvidaNoGoogle(id)).length };
}
/** A dúvida como a tela recebe (contatos_google_para_conferir): as pessoas possíveis com os dados de hoje. */
function duvidaParaATela(k: DuvidaGuardada): ContatoParaConferir {
  const candidatos = k.candidatos.map(id => bd.pessoas.find(p => p.id === id)).filter((p): p is Pessoa => !!p).map(p => ({
    id: p.id, codigo: p.codigo, tipo: p.tipo, nome: p.nome, telefones: p.telefones ?? [], emails: p.emails ?? [], nascimento: p.nascimento, abertura: p.abertura,
    arquivada: !!p.arquivado_em, ligada: !!bd.contatosGoogle?.ligados?.[p.id]
  }));
  return { id: k.id, nome: k.nome, telefones: k.telefones, emails: k.emails, aniversario: k.aniversario, motivo: k.motivo, criado_em: k.criado_em, candidatos };
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
  responsavel_id: k.responsavel_id, negociacao_inicio: k.negociacao_inicio ?? null, etapa_id: k.etapa_id, etapa_ordem: k.etapa_ordem, arquivado_em: k.arquivado_em,
  criado_por: k.criado_por, criado_em: k.criado_em, atualizado_em: k.atualizado_em, cliente_nome: nomeDoCliente(k), grupos: k.grupos ?? [],
  ...(vejoContrato(k) ? { ve_financeiro: true } : { ve_financeiro: false, categoria: null as unknown as ContratoLista['categoria'], valor: null })
});
/** Como cliente_nome no banco: os nomes de todos os clientes, juntos ("A; B"). */
const nomeDoCliente = (k: ContratoGuardado) => k.clientes.map(id => bd.pessoas.find(p => p.id === id)?.nome ?? 'pessoa excluída').join('; ');
// Como a coluna "busca" do banco: o número entra também só com os dígitos, para a busca por "0163/2026" achar.
const buscaContrato = (k: ContratoGuardado) => normal([k.codigo, k.codigo.replace(/\D/g, ''), k.codigo_antigo, k.servico, nomeDoCliente(k)].join(' '));
const membroLogado = () => EQUIPE.find(m => m.id === eu)!;
/** Com a chave ligada, quem não está no cartão só lê. Desligada, o banco fictício segue sem regra de alterar nesses módulos. */
const soLeNoFalso = (estaNoCartao: boolean) => !!bd.equipeVeTudo && !bd.equipeEditaTudo && !estaNoCartao;
/** Como privado.sou_admin. */
const souAdmin = () => ['master', 'admin'].includes(membroLogado().papel);
/** Os grupos de alguém da equipe (#378): só de quem está ativo, sem a conta reservada e sem exclusão (como privado.integrantes_dos_grupos). */
const gruposDoMembro = (m: Pick<Membro, 'id' | 'ativo' | 'reservada' | 'excluido'>) => m.ativo === false || m.reservada || m.excluido ? [] : meusGrupos(bd.gruposDaEquipe, m.id);
/** Como privado.meus_grupos: os grupos de quem está logado. */
const meusGruposNoFalso = () => gruposDoMembro(membroLogado());
type QuemEstaNoContrato = Pick<ContratoGuardado, 'id' | 'criado_por' | 'responsavel_id' | 'participantes'>;
const pessoasDoContrato = (k: QuemEstaNoContrato) => ({ ...k, participantes: k.participantes.map(p => p.pessoa_id) });
/** Quem está no contrato, como o cartão da demanda e o da tarefa o recebem (só os campos que o banco manda, #326). */
const equipeDoContrato = (k: QuemEstaNoContrato): EquipeDoContrato =>
  ({ id: k.id, criado_por: k.criado_por, responsavel_id: k.responsavel_id, participantes: k.participantes.map(p => p.pessoa_id) });
/** O contrato no cartão da demanda ou da tarefa: como o banco, só para quem pode abri-lo, e com quem está nele. */
const contratoQueVejo = (id: string | null | undefined) => {
  const k = id ? bd.contratos!.find(x => x.id === id) : null;
  return k && vejoContrato(k) ? k : null;
};
const contratoDoCartao = (id: string | null | undefined): ContratoDoCartao | null => {
  const k = contratoQueVejo(id);
  return k && { ...equipeDoContrato(k), codigo: k.codigo, servico: k.servico };
};
/** Como public.cartao_sair: tira quem está logado e deixa no histórico. Devolve se a pessoa estava no cartão. */
const SAIR_DO_CARTAO: Record<ModuloComSaida, (id: string) => boolean> = {
  tarefas: id => {
    const t = bd.tarefas!.find(x => x.id === id);
    if (!t?.participantes.includes(eu)) return false;
    const novos = { participantes: t.participantes.filter(p => p !== eu) };
    historicoTarefa(t, novos); Object.assign(t, novos, { atualizado_em: agora(), atualizado_por: eu });
    auditar('tarefas', 'alteracao', t);
    return true;
  },
  demandas: id => {
    const d = bd.demandas!.find(x => x.id === id);
    if (!d?.colaboradores.includes(eu)) return false;
    const novos = { colaboradores: d.colaboradores.filter(p => p !== eu) };
    historicoDemanda(d, novos); Object.assign(d, novos, { atualizado_em: agora(), atualizado_por: eu });
    auditar('demandas', 'alteracao', d);
    return true;
  },
  processos: id => {
    const p = bd.processos!.find(x => x.id === id);
    if (!p?.colaboradores.includes(eu)) return false;
    const novos = { colaboradores: p.colaboradores.filter(c => c !== eu) };
    historicoProcesso(p, novos); Object.assign(p, novos, { atualizado_em: agora(), atualizado_por: eu });
    auditar('processos', 'alteracao', p);
    return true;
  },
  compromissos: id => {
    const c = bd.compromissos!.find(x => x.id === id);
    if (!c?.participantes.includes(eu)) return false;
    const novos = { participantes: c.participantes.filter(p => p !== eu) };
    historicoCompromisso(c, novos); Object.assign(c, novos, { atualizado_em: agora(), atualizado_por: eu });
    auditar('compromissos', 'alteracao', { id: c.id, codigo: c.codigo });
    return true;
  },
  anotacoes: id => {
    const a = bd.anotacoes!.find(x => x.id === id);
    if (!a?.participantes.includes(eu)) return false;
    const novos = { participantes: a.participantes.filter(p => p !== eu) };
    historicoAnotacao(a, novos); Object.assign(a, novos, { atualizado_em: agora(), atualizado_por: eu });
    auditar('anotacoes', 'alteracao', { id: a.id, codigo: a.codigo });
    return true;
  }
};
/** Como public.processo_me_incluir: o que muda no processo em cada forma de entrar. */
const ENTRAR_NO_PROCESSO: Record<ComoEntrarNoProcesso, (p: ProcessoGuardado) => Partial<ProcessoGuardado>> = {
  colaborador: p => p.responsavel_id === eu || p.colaboradores.includes(eu) ? {} : { colaboradores: [...p.colaboradores, eu] },
  responsavel: p => p.responsavel_id === eu ? {} : { responsavel_id: eu, colaboradores: [...p.colaboradores.filter(c => c !== eu), p.responsavel_id] }
};
/** Como privado.contratos_em_que_me_mencionaram: mencionar a si mesmo não conta, nem a menção de quem não era parte ao comentar,
 *  nem a de quem estava num grupo do contrato ao ser mencionado (#378). */
const meMencionaramNoContrato = (id: string) =>
  bd.comentarios!.some(c => c.modulo === 'contratos' && c.cartao_id === id && c.autor_id !== eu && c.mencoes.includes(eu) && !c.autor_sem_vinculo
    && !c.mencoes_pelo_grupo?.includes(eu));
/** Como a regra de leitura dos contratos no banco. */
const vejoContrato = (k: QuemEstaNoContrato) => veOContrato(pessoasDoContrato(k), membroLogado(), meMencionaramNoContrato(k.id));
/** Quem está num grupo da equipe do contrato o alcança sem os valores (#378), como a view contratos_da_equipe. */
const peloGrupoDoContrato = (k: Pick<ContratoGuardado, 'grupos'>) => estaPeloGrupo(k.grupos, meusGruposNoFalso());
/** Como a regra de alterar dos contratos no banco: quem só foi mencionado lê, mas não altera. */
const alteroContrato = (k: QuemEstaNoContrato) => alteraOContrato(pessoasDoContrato(k), membroLogado());
const vejoContratoDoId = (id: string) => bd.contratos!.some(k => k.id === id && vejoContrato(k));
/** Como contratos_da_equipe: quem é parte e, com a chave ligada, toda a equipe. */
const alcancoContrato = (k: QuemEstaNoContrato & Pick<ContratoGuardado, 'grupos'>) => !!bd.equipeVeTudo || vejoContrato(k) || peloGrupoDoContrato(k);
const alcancoContratoDoId = (id: string) => bd.contratos!.some(k => k.id === id && alcancoContrato(k));
/** Como privado.contratos_em_que_estou (#326): os contratos que quem está logado criou, de que é responsável ou participante. */
const contratosDoMembro = (m: Membro) => contratosEmQueEsta(bd.contratos!.map(pessoasDoContrato), m);
/** Também os contratos dos grupos de quem está logado (#378): as demandas e as tarefas deles abrem, só para ler. */
const contratosEmQueEstou = () => [...contratosDoMembro(membroLogado()), ...bd.contratos!.filter(peloGrupoDoContrato).map(k => k.id)];
const demandaDaTarefaNoFalso = (t: Pick<TarefaGuardada, 'demanda_id'>) => bd.demandas!.find(d => d.id === t.demanda_id) ?? null;
/** Todas as demandas ligadas à tarefa (#283), na ordem. */
const demandasDaTarefaNoFalso = (t: Pick<TarefaGuardada, 'demanda_id' | 'demanda_ids'>) =>
  demandasDaTarefa(t).flatMap(id => bd.demandas!.filter(d => d.id === id));

/** A demanda ou a tarefa arquivada, desarquivada ou excluída sozinha perde a marca de "arquivada junto com o contrato" (#284). */
const esquecerArquivadoComContrato = (id: string) => { bd.arquivadosComContrato = bd.arquivadosComContrato!.filter(m => m.id !== id); };

/**
 * Como o gatilho privado.contrato_arquiva_em_cascata (#284): arquivar o contrato arquiva junto as demandas e as tarefas dele
 * (regras/arquivarContrato.ts), em nome de quem arquivou o contrato; desarquivar traz de volta só as que têm a marca dele.
 */
function arquivarEmCascata(contratoId: string, arquivar: boolean) {
  const campos = () => ({ arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? eu : null, atualizado_em: agora() });
  const mudar = (ids: ReadonlySet<string>) => {
    bd.demandas!.filter(d => ids.has(d.id)).forEach(d => { historicoDemanda(d, { arquivado_em: campos().arquivado_em }); Object.assign(d, campos()); });
    bd.tarefas!.filter(t => ids.has(t.id)).forEach(t => { historicoTarefa(t, { arquivado_em: campos().arquivado_em }); Object.assign(t, campos()); });
  };
  if (!arquivar) {
    mudar(new Set(bd.arquivadosComContrato!.filter(m => m.contrato_id === contratoId).map(m => m.id)));
    bd.arquivadosComContrato = bd.arquivadosComContrato!.filter(m => m.contrato_id !== contratoId);
    return;
  }
  const junto = arquivadosComOContrato(contratoId, {
    demandas: bd.demandas!,
    tarefas: bd.tarefas!.map(t => ({ id: t.id, arquivado_em: t.arquivado_em, demandas: demandasDaTarefa(t), contratos: contratosDaTarefa(t), processo_id: t.processo_id })),
    contratoAtivo: id => bd.contratos!.some(k => k.id === id && !k.arquivado_em),
    processoAtivo: id => bd.processos!.some(p => p.id === id && !p.arquivado_em)
  });
  const ids = [...junto.demandas, ...junto.tarefas];
  mudar(new Set(ids));
  ids.forEach(id => bd.arquivadosComContrato!.push({ contrato_id: contratoId, id }));
}
/** Apaga a demanda e o que cai junto com ela no banco (o delete e as cascatas). */
function apagarDemanda(d: DemandaGuardada) {
  const id = d.id;
  bd.demandas = bd.demandas!.filter(x => x.id !== id);
  bd.processoDemandas = bd.processoDemandas!.filter(l => l.demanda_id !== id);
  bd.demandasRelacionadas = bd.demandasRelacionadas!.filter(l => l.demanda_a !== id && l.demanda_b !== id);
  soltarDasAnotacoes('demandas', id);
  soltarDosCompromissos('demandas', id);
  bd.historicoDemandas = bd.historicoDemandas!.filter(h => h.demanda_id !== id);
  bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'demandas' && c.cartao_id === id));
  // Como o "on delete set null" do banco: as tarefas da demanda ficam, só desligadas dela.
  // Com várias (#283), ela sai só da lista de cada tarefa, e a próxima vira a principal.
  bd.tarefas!.forEach(t => { if (demandasDaTarefa(t).includes(id)) Object.assign(t, prepararTarefa({ demanda_ids: demandasDaTarefa(t).filter(x => x !== id) }, t)); });
  excluirListasDoCartao('demanda_id', id);
  esquecerArquivadoComContrato(id);
  auditar('demandas', 'exclusao', d);
}
/** Apaga a tarefa e o que cai junto com ela no banco (o tempo registrado, os comentários, as listas). */
function apagarTarefa(t: TarefaGuardada) {
  const id = t.id;
  bd.tarefas = bd.tarefas!.filter(x => x.id !== id);
  // Como o on delete set null e o gatilho do banco: a intimação que ficou sem a tarefa volta a ficar a tratar.
  bd.prazos!.forEach(z => { if (z.tarefa_id === id) z.tarefa_id = null; });
  bd.andamentos!.forEach(a => { if (a.tarefa_id === id) { a.tarefa_id = null; a.tratada_em = null; } });
  bd.historicoTarefas = bd.historicoTarefas!.filter(h => h.tarefa_id !== id);
  bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'tarefas' && c.cartao_id === id));
  bd.tempos = bd.tempos!.filter(r => r.tarefa_id !== id);
  soltarDasAnotacoes('tarefas', id);
  soltarDosCompromissos('tarefas', id);
  excluirListasDoCartao('tarefa_id', id);
  esquecerArquivadoComContrato(id);
  auditar('tarefas', 'exclusao', t);
}
// ---------- excluir o contrato em cascata (#284), como public.contratos_excluir ----------
/** Como privado.contratos_que_excluo: arquivados, cadastrados por quem pede (ou ele é administrador). */
const contratosQueExcluo = (ids: string[]) => bd.contratos!.filter(k => ids.includes(k.id) && k.arquivado_em && (k.criado_por === eu || souAdmin())).map(k => k.id);
/** A parcela importada como paga: recebida sem recebimento (não passou pelo Caixa). */
const importadaComoPaga = (p: ParcelaGuardada) => !p.recebimento_id && !!p.recebida_em && !p.excluido_em;
/** O que sai junto com os contratos (regras/exclusaoDoContrato.ts). */
const escritorioParaExcluir = () => ({
  demandas: bd.demandas!,
  tarefas: bd.tarefas!.map(t => ({ id: t.id, arquivado_em: t.arquivado_em, demandas: demandasDaTarefa(t), contratos: contratosDaTarefa(t), processo_id: t.processo_id }))
});
const excluidosNoFalso = (ids: string[]) => excluidosComOsContratos(ids, escritorioParaExcluir());
/** Como privado.resumo_da_exclusao: as contagens, os valores e os pagamentos já feitos. */
function resumoDaExclusaoNoFalso(ids: string[]) {
  const junto = excluidosNoFalso(ids);
  const recebimentos = bd.recebimentos!.filter(r => ids.includes(r.contrato_id)), validos = recebimentos.filter(r => !r.estornado_em);
  const idsDosRecebimentos = new Set(recebimentos.map(r => r.id));
  const importadas = bd.parcelas!.filter(p => ids.includes(p.contrato_id) && importadaComoPaga(p));
  const soma = <T,>(lista: T[], valor: (x: T) => number) => lista.reduce((s, x) => s + valor(x), 0);
  const ondeFoi = (recebimentoId: string) => {
    const r = recebimentos.find(x => x.id === recebimentoId)!;
    return { codigo: acharContrato(r.contrato_id).codigo, parcela: acharParcela(r.parcela_id).numero, r };
  };
  const pagos = [
    ...bd.repasses!.filter(x => idsDosRecebimentos.has(x.recebimento_id) && x.pago_em && !x.cancelado_em)
      .map(x => { const { codigo, parcela } = ondeFoi(x.recebimento_id); return { codigo, parcela, nome: x.nome, valor: x.valor }; }),
    ...bd.terceirosPagos!.filter(m => idsDosRecebimentos.has(m.recebimento_id)).map(m => {
      const { codigo, parcela, r } = ondeFoi(m.recebimento_id);
      const t = r.terceiros.find(x => x.id === m.pessoa_id);
      return { codigo, parcela, nome: t?.nome ?? 'Pessoa excluída', valor: t?.valor ?? 0 };
    })
  ].toSorted((a, b) => a.codigo.localeCompare(b.codigo) || a.parcela - b.parcela || a.nome.localeCompare(b.nome));
  return {
    demandas: junto.demandas.length, tarefas: junto.tarefas.length,
    segundos: Math.max(0, soma(bd.tempos!.filter(r => junto.tarefas.includes(r.tarefa_id)), r => r.segundos)),
    parcelas: bd.parcelas!.filter(p => ids.includes(p.contrato_id) && !p.excluido_em).length,
    recebimentos: validos.length, estornados: recebimentos.length - validos.length,
    recebido: soma(validos, r => r.valor), taxas: soma(validos, r => r.taxa_maquina),
    repasses: soma(bd.repasses!.filter(x => idsDosRecebimentos.has(x.recebimento_id) && !x.cancelado_em), x => x.valor),
    correcoes: soma(bd.lancamentos!.filter(l => l.corrige_recebimento && idsDosRecebimentos.has(l.corrige_recebimento) && !l.excluido_em), l => l.valor),
    importadas: importadas.length, importado: soma(importadas, p => p.recebido ?? 0),
    pagos, junto
  };
}
/** Como a regra de leitura das demandas: quem está nela e, só para ler, quem está no contrato ligado a ela (#326). */
const vejoDemanda = (d: DemandaGuardada) => veADemanda(d, membroLogado(), contratosEmQueEstou(), meusGruposNoFalso());
/** Como a regra de leitura das tarefas: quem está nela ou numa das demandas e, só para ler, quem está num dos contratos dela ou no de uma das demandas (#326, #283). */
const vejoTarefa = (t: TarefaGuardada) => veATarefa(t, membroLogado(), demandasDaTarefaNoFalso(t), contratosEmQueEstou(), meusGruposNoFalso());
/** Como privado.altero_o_contrato: quem é parte e, na fase de adaptação, toda a equipe. */
const alteroContratoDoId = (id: string) => bd.contratos!.some(k => k.id === id && (alteroContrato(k) || !!bd.equipeEditaTudo));
/** Como as colunas de contratos_da_equipe para quem não é parte. */
const contratoSemValores = (k: Contrato): Contrato => ({ ...k, ve_financeiro: false, categoria: null as unknown as Contrato['categoria'], valor: null, entrada: null, parcelas: null, descontos: null,
  primeiro_pagamento: null, percentual_escritorio: null, indicador: null, indicador_id: null, indicador_percentual: null, conta_destino_id: null, documento_url: null, observacoes: null,
  participantes: k.participantes.map(p => ({ ...p, percentual: null })) });
/** Como privado.cuido_do_contrato: um administrador ou o responsável. */
/** Algum valor do recebimento já foi pago (repasse não cancelado, ou participante/indicador marcado como pago)? */
const recebimentoTemPagamento = (id: string) => bd.repasses!.some(x => x.recebimento_id === id && x.pago_em && !x.cancelado_em) || (bd.terceirosPagos ?? []).some(x => x.recebimento_id === id);
const cuidoDoContrato = (id: string) => bd.contratos!.some(k => k.id === id && (souAdmin() || k.responsavel_id === eu));
function filtrarContratos(f: FiltroContratos = {}) {
  const t = termo(f.termo);
  return bd.contratos!.filter(k => alcancoContrato(k) && (!f.paraLigar || vejoContrato(k)) && (f.situacao === 'arquivados' ? k.arquivado_em : !k.arquivado_em)
    && (!f.responsavel || k.responsavel_id === f.responsavel)
    && (!f.categoria || (vejoContrato(k) && k.categoria === f.categoria))
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
  const k = bd.contratos!.find(x => x.id === id && vejoContrato(x));
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
  conta_destino_id: ['conta_destino_id', id => bd.contasFinanceiras!.find(c => c.id === id)?.nome ?? null],
  responsavel_id: ['responsavel_id', id => EQUIPE.find(m => m.id === id)?.nome ?? null],
  grupos: ['grupos', nomesDosGrupos],
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
// ---------- hora e lembrete do prazo (tarefas e demandas, #286) ----------
/** A hora como o banco aceita (hh:mm ou hh:mm:ss). */
const HORA_DO_BANCO = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
/**
 * Como a regra "not null" da coluna (migração data_de_inicio): a data de início pode mudar, mas não ficar vazia (#357). A vazia
 * chega ao banco de verdade como null (supabase.ts, inicioVazioComoNulo), e ele a recusa pela mesma regra.
 */
function conferirInicio(dados: Pick<DadosTarefa, 'data_inicio'>) {
  if (dados.data_inicio !== undefined && !dados.data_inicio) throw new Error(INICIO_VAZIO);
}
/**
 * Como as colunas prazo_hora (time) e lembrete (com a regra dos valores aceitos) do banco: a hora volta com os segundos,
 * e o lembrete fora da lista é recusado. Como no banco, nada amarra os dois ao prazo (a tela é que confere).
 */
function horaELembreteDoBanco(dados: Pick<DadosTarefa, 'prazo_hora' | 'lembrete'>): Pick<DadosTarefa, 'prazo_hora' | 'lembrete'> {
  const r: Pick<DadosTarefa, 'prazo_hora' | 'lembrete'> = {};
  if (dados.prazo_hora !== undefined) {
    if (dados.prazo_hora && !HORA_DO_BANCO.test(dados.prazo_hora)) throw new Error(FORMATO_INVALIDO);
    r.prazo_hora = dados.prazo_hora ? fmtHora(dados.prazo_hora) + ':00' : null;
  }
  if (dados.lembrete !== undefined) {
    if (dados.lembrete !== null && !Object.hasOwn(LEMBRETES, String(dados.lembrete))) throw new Error(FORMATO_INVALIDO);
    r.lembrete = dados.lembrete;
  }
  return r;
}

// ---------- demandas ----------
const nomesDosClientes = (ids: string[]) => ids.map(id => bd.pessoas.find(p => p.id === id)?.nome ?? 'pessoa excluída').join('; ');
const demandaCompleta = (d: DemandaGuardada): Demanda =>
  ({ ...d, continua: !!d.continua, continua_grupo_id: d.continua_grupo_id ?? null, clientes: d.clientes.map(id => resumoDe(id)!), cliente_nome: nomesDosClientes(d.clientes),
    contrato: contratoDoCartao(d.contrato_id) });
const demandaLista = (d: DemandaGuardada): DemandaLista => ({
  id: d.id, codigo: d.codigo, titulo: d.titulo, prazo: d.prazo, prazo_hora: d.prazo_hora ?? null, data_inicio: d.data_inicio, responsavel_id: d.responsavel_id, colaboradores: d.colaboradores,
  grupos: d.grupos ?? [], continua: !!d.continua, cliente_nome: nomesDosClientes(d.clientes), contrato_codigo: d.contrato_codigo, etapa_id: d.etapa_id, etapa_ordem: d.etapa_ordem,
  arquivado_em: d.arquivado_em, criado_por: d.criado_por, criado_em: d.criado_em, atualizado_em: d.atualizado_em
});
const buscaDemanda = (d: DemandaGuardada) => normal([d.codigo, d.titulo, d.descricao, nomesDosClientes(d.clientes), d.contrato_codigo].join(' '));
function filtrarDemandas(f: FiltroDemandas = {}) {
  const t = termo(f.termo);
  return bd.demandas!.filter(d => vejoNoModulo('demandas', d.id) && (!f.paraLigar || !soLeNoFalso(estaNaDemanda(d, membroLogado(), meusGruposNoFalso()))) && (f.situacao === 'arquivadas' ? d.arquivado_em : !d.arquivado_em)
    && (!f.pessoa || d.responsavel_id === f.pessoa || d.colaboradores.includes(f.pessoa)) && (f.contrato !== 'sem' || !d.contrato_id) && noGrupoDoFiltro(d, f.grupo)
    && (!f.etiqueta || temEtiqueta('demandas', d.id, f.etiqueta)) && inicioNosLimites(d.data_inicio, f)
    && (!t || buscaDemanda(d).includes(t)));
}
/** Ordem das demandas e das tarefas ("nome" é o título). Pelo prazo, a mesma regra do banco, com o id desempatando (#291). */
type PeloTitulo = Pick<DemandaGuardada, 'id' | 'titulo' | 'etapa_ordem' | 'criado_em' | 'atualizado_em' | 'prazo' | 'prazo_hora' | 'data_inicio'>;
const ORDENS_PELO_TITULO: Record<OrdemComPrazo, (a: PeloTitulo, b: PeloTitulo) => number> = {
  manual: (a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || b.criado_em.localeCompare(a.criado_em),
  nome: (a, b) => a.titulo.localeCompare(b.titulo),
  nome_desc: (a, b) => b.titulo.localeCompare(a.titulo),
  novos: (a, b) => b.criado_em.localeCompare(a.criado_em),
  antigos: (a, b) => a.criado_em.localeCompare(b.criado_em),
  recentes: (a, b) => b.atualizado_em.localeCompare(a.atualizado_em),
  prazo: (a, b) => compararPeloPrazo(a, b) || a.id.localeCompare(b.id),
  prazo_desc: (a, b) => compararPeloPrazo(a, b, -1) || a.id.localeCompare(b.id),
  inicio: (a, b) => compararPeloInicio(a, b) || a.id.localeCompare(b.id),
  inicio_desc: (a, b) => compararPeloInicio(a, b, -1) || a.id.localeCompare(b.id)
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
  conferirInicio(dados);
  const d: DadosDemanda & { contrato_codigo?: string | null } = { ...dados, ...horaELembreteDoBanco(dados) };
  if (d.grupos !== undefined) d.grupos = gruposAoGravar(d.grupos, atual?.grupos);
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
    // Confere só quem está entrando: quem já estava e saiu da equipe não trava as outras alterações.
    if (lista.some(id => !atual?.colaboradores.includes(id) && !EQUIPE.some(m => m.id === id))) throw new Error('O colaborador precisa ser alguém da equipe do escritório.');
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
  grupos: ['grupos', nomesDosGrupos],
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
/**
 * Como o gatilho privado.preparar_grupos (#378): tira os repetidos, confere só os grupos que entram (o que já estava não trava nada)
 * e recusa passar de GRUPOS_POR_ITEM.
 */
function gruposAoGravar(grupos: string[] | undefined, antes: string[] | undefined) {
  const lista = [...new Set((grupos ?? []).filter(Boolean))];
  if (lista.some(id => !(antes ?? []).includes(id) && !bd.gruposDaEquipe!.some(g => g.id === id))) throw new Error('Grupo não encontrado neste escritório.');
  if (lista.length > GRUPOS_POR_ITEM) throw new Error(`Um item pode ter até ${GRUPOS_POR_ITEM} grupos.`);
  return lista;
}
/** A recusa de quem não é administrador nas funções dos grupos (a mesma do banco). */
const SO_ADMINISTRADOR_NOS_GRUPOS = 'Só um administrador cuida dos grupos.';
/** Como privado.grupo_do_administrador: só administrador, e o grupo de outro escritório (ou que não existe) responde igual. */
function grupoDoAdministrador(id: string) {
  if (!souAdmin()) throw new Error(SO_ADMINISTRADOR_NOS_GRUPOS);
  const g = bd.gruposDaEquipe!.find(x => x.id === id);
  if (!g) throw new Error('Grupo não encontrado neste escritório.');
  return g;
}
/** Como privado.conferir_nome_do_grupo: sem os espaços das pontas, até TAMANHO_GRUPO_DA_EQUIPE letras, único sem diferença de maiúsculas. */
function nomeDoGrupoDaEquipe(bruto: string, id?: string) {
  const nome = (bruto ?? '').trim();
  if (!nome) throw new Error('Escreva o nome do grupo.');
  if (nome.length > TAMANHO_GRUPO_DA_EQUIPE) throw new Error(`O nome do grupo pode ter até ${TAMANHO_GRUPO_DA_EQUIPE} letras.`);
  if (bd.gruposDaEquipe!.some(g => g.id !== id && g.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Já existe um grupo com este nome.');
  return nome;
}
/** Os módulos com grupos, na ordem da contagem do banco (public.grupo_contar_itens). */
const MODULOS_DOS_GRUPOS: ModuloDoPedido[] = ['demandas', 'tarefas', 'processos', 'compromissos', 'contratos', 'anotacoes'];
type ItemComGrupos = { id: string; grupos?: string[]; atualizado_em: string; atualizado_por: string | null };
const ITENS_COM_GRUPOS: Record<ModuloDoPedido, () => ItemComGrupos[]> = {
  demandas: () => bd.demandas!, tarefas: () => bd.tarefas!, processos: () => bd.processos!, compromissos: () => bd.compromissos!,
  contratos: () => bd.contratos!, anotacoes: () => bd.anotacoes!
};
/** A linha do histórico de cada módulo quando o grupo sai do item (a exclusão do grupo). */
const HISTORICO_DOS_GRUPOS: Record<ModuloDoPedido, (id: string, novos: { grupos: string[] }) => void> = {
  demandas: (id, novos) => historicoDemanda(bd.demandas!.find(x => x.id === id)!, novos),
  tarefas: (id, novos) => historicoTarefa(bd.tarefas!.find(x => x.id === id)!, novos),
  processos: (id, novos) => historicoProcesso(bd.processos!.find(x => x.id === id)!, novos),
  compromissos: (id, novos) => historicoCompromisso(bd.compromissos!.find(x => x.id === id)!, novos),
  contratos: (id, novos) => historicoContrato(bd.contratos!.find(x => x.id === id)!, novos),
  anotacoes: (id, novos) => historicoAnotacao(bd.anotacoes!.find(x => x.id === id)!, novos)
};
/** Os grupos, pelo nome, como privado.nomes_dos_grupos ("grupo excluído" para o que não existe mais). */
function nomesDosGrupos(ids: unknown) {
  return (ids as string[] | null ?? []).map(id => bd.gruposDaEquipe!.find(g => g.id === id)?.nome ?? 'grupo excluído')
    .sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', ') || null;
}
/** Como privado.parcelas_do_contrato_assinado: nascem uma vez só, quando o contrato chega à coluna de assinado. */
function parcelasDoContratoAssinado(k: ContratoGuardado) {
  if (bd.colunas.find(c => c.id === k.etapa_id)?.marco !== 'assinado' || bd.contratosComParcelas!.includes(k.id)) return;
  bd.contratosComParcelas!.push(k.id);
  // Nunca por cima do que já foi lançado à mão.
  if (bd.parcelas!.some(p => p.contrato_id === k.id && !p.excluido_em)) return;
  gerarParcelas(k);
}
function gerarParcelas(k: ContratoGuardado) {
  const novas = parcelasDoContrato(k, hojeNoFalso());
  novas.forEach(p => novaParcela(k.id, p));
  if (novas.length) historicoDaParcela(k.id, { Parcelas: { de: null, para: `${novas.length} geradas, somando ${fmtCentavos(novas.reduce((s, p) => s + p.valor, 0))}` } });
  return novas.length;
}
const hojeNoFalso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
function novaParcela(contratoId: string, dados: { vencimento: string; valor: number }) {
  const numero = Math.max(0, ...bd.parcelas!.filter(p => p.contrato_id === contratoId).map(p => p.numero)) + 1;
  const p: ParcelaGuardada = { id: novoId(), contrato_id: contratoId, numero, ...dados, recebimento_id: null, recebida_em: null, recebido: null, excluido_em: null };
  bd.parcelas!.push(p);
  return p;
}
const historicoDaParcela = (contratoId: string, alteracoes: Historico['alteracoes']) => {
  bd.historicoParcelas!.unshift({ id: Date.now() + Math.random(), contrato_id: contratoId, alteracoes, feito_por: eu, em: agora() });
};
// "A definir" não vira demanda, e o contrato só fica marcado quando tem objeto de verdade; no contrato assinado que tinha
// "A definir", os objetos que entram no lugar dele viram demandas (só esses). Cada demanda ganha as tarefas do modelo de
// lista de mesmo nome (migração cliente_ao_contrato). antes: a coluna e os objetos de antes da mudança.
function demandasDoContratoAssinado(k: ContratoGuardado, antes?: Pick<ContratoGuardado, 'etapa_id' | 'objetos'>) {
  const assinado = bd.colunas.find(c => c.id === k.etapa_id)?.marco === 'assinado';
  let objetos = objetosDefinidos(k.objetos);
  if (!assinado || !objetos.length) return;
  if (antes && (antes.etapa_id || null) === (k.etapa_id || null)) {
    // Só os objetos mudaram, num contrato que já estava assinado: vale apenas para o que entra no lugar do "A definir".
    if (objetosDefinidos(antes.objetos).length === limparObjetos(antes.objetos).length) return;
    const jaTinha = new Set([...antes.objetos, ...bd.demandas!.filter(d => d.contrato_id === k.id).map(d => d.objeto ?? '')].map(normal));
    objetos = objetos.filter(o => !jaTinha.has(normal(o)));
    if (!objetos.length) return;
    if (!bd.contratosComDemandas!.includes(k.id)) bd.contratosComDemandas!.push(k.id);
  } else {
    if (bd.contratosComDemandas!.includes(k.id)) return;
    bd.contratosComDemandas!.push(k.id);
    // O objeto que já tem demanda neste contrato (a criada na hora, #349) não ganha outra.
    objetos = objetos.filter(o => !bd.demandas!.some(d => d.contrato_id === k.id && mesmoObjeto(d.objeto, o)));
  }
  const base = Date.now() / 1000;
  objetos.forEach((objeto, i) => demandaDoObjeto(k, objeto, base + i / 1000));
}
/** A demanda de um objeto do contrato, como as automáticas: em "Para fazer", com os clientes e o responsável dele e as tarefas do modelo. */
function demandaDoObjeto(k: ContratoGuardado, objeto: string, ordem: number) {
  const inicio = bd.colunas.find(c => c.modulo === 'demandas' && c.marco === 'inicio')?.id ?? null;
  const d: DemandaGuardada = { ...demandaNova(), id: novoId(), codigo: codigo(), titulo: objeto, objeto,
    responsavel_id: k.responsavel_id, clientes: [...k.clientes], contrato_id: k.id, contrato_codigo: k.codigo, etapa_id: inicio, etapa_ordem: ordem };
  bd.demandas!.push(d);
  tarefasDoModelo(d);
  return d;
}
/** Como privado.tarefas_do_modelo: a demanda ganha uma tarefa por item do modelo de lista com o mesmo nome do objeto. */
function tarefasDoModelo(d: DemandaGuardada) {
  const modelo = bd.modelos!.find(m => normal(m.nome) === normal(d.objeto));
  const itens = (modelo?.itens ?? []).map(i => i.trim()).filter(Boolean);
  if (!itens.length) return;
  const inicio = bd.colunas.find(c => c.modulo === 'tarefas' && c.marco === 'inicio')?.id ?? null, base = Date.now() / 1000;
  // O título da tarefa tem o tamanho dela (o item do modelo pode ser maior), como no banco.
  itens.forEach((item, i) => bd.tarefas!.push({ ...tarefaNova(), id: novoId(), codigo: codigo(), titulo: item.slice(0, TAMANHO_TAREFA.titulo), responsavel_id: d.responsavel_id, pessoas: [...d.clientes],
    demanda_id: d.id, demanda_codigo: d.codigo, contrato_id: d.contrato_id, contrato_codigo: d.contrato_codigo, etapa_id: inicio, etapa_ordem: base + i / 1000 }));
}
const demandaLigada = (pessoaId: string, perfilId: string | null) => (d: DemandaGuardada): DemandaLigada => ({
  id: d.id, codigo: d.codigo, titulo: d.titulo, objeto: d.objeto, prazo: d.prazo, prazo_hora: d.prazo_hora ?? null, etapa_id: d.etapa_id, arquivado_em: d.arquivado_em, criado_em: d.criado_em,
  papeis: papeisNaDemanda(d, pessoaId, perfilId)
});
// ---------- tarefas ----------
const processoDaTarefa = (id: string | null | undefined) => {
  const p = id ? bd.processos!.find(x => x.id === id) : null;
  return p ? { id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, cliente_nome: nomesDosClientes(p.clientes) } : null;
};
/** A demanda como a tarefa a mostra, com quem está no contrato dela (se quem lê pode abri-lo). */
const demandaNaTarefa = (d: DemandaGuardada): DemandaDaTarefa => {
  const contratoDaDemanda = contratoQueVejo(d.contrato_id);
  return { id: d.id, codigo: d.codigo, titulo: d.titulo, etapa_id: d.etapa_id, criado_por: d.criado_por, responsavel_id: d.responsavel_id,
    colaboradores: d.colaboradores, grupos: d.grupos ?? [], continua: !!d.continua, contrato_id: d.contrato_id, contrato: contratoDaDemanda && equipeDoContrato(contratoDaDemanda) };
};
const tarefaCompleta = (t: TarefaGuardada): Tarefa => {
  const d = t.demanda_id ? bd.demandas!.find(x => x.id === t.demanda_id) : null;
  return { ...t, solicitante_id: t.solicitante_id ?? null, funcoes: funcoesDaTarefaNoFalso(t), demanda_ids: t.demanda_ids ?? [], contrato_ids: t.contrato_ids ?? [], pessoas: t.pessoas.map(id => resumoDe(id)!), pessoa_nome: nomesDosClientes(t.pessoas),
    demanda: d ? demandaNaTarefa(d) : null,
    contrato: contratoDoCartao(t.contrato_id),
    // Como o banco (#283): cada ligada com o código, e a demanda (ou o contrato) só para quem pode abri-la.
    demandas_ligadas: demandasDaTarefa(t).map(id => {
      const x = bd.demandas!.find(y => y.id === id);
      return { id, codigo: x?.codigo ?? '', item: x && vejoDemanda(x) ? demandaNaTarefa(x) : null };
    }),
    contratos_ligados: contratosDaTarefa(t).map(id => ({ id, codigo: bd.contratos!.find(k => k.id === id)?.codigo ?? '', item: contratoDoCartao(id) })),
    processo: processoDaTarefa(t.processo_id) };
};
const equipeNaLista = (d: DemandaGuardada) => ({ criado_por: d.criado_por, responsavel_id: d.responsavel_id, colaboradores: d.colaboradores, grupos: d.grupos ?? [],
  continua: !!d.continua });
const tarefaLista = (t: TarefaGuardada): TarefaLista => {
  // Como o banco, quem está na demanda ligada (as listagens do banco fictício não filtram quem vê, e quem não vê a demanda não está nela).
  const d = demandaDaTarefaNoFalso(t);
  return {
    id: t.id, codigo: t.codigo, titulo: t.titulo, prazo: t.prazo, prazo_hora: t.prazo_hora ?? null, data_inicio: t.data_inicio, responsavel_id: t.responsavel_id, participantes: t.participantes,
    grupos: t.grupos ?? [], diligencia: !!t.diligencia, pessoa_nome: nomesDosClientes(t.pessoas), demanda_codigo: t.demanda_codigo, contrato_codigo: t.contrato_codigo, etapa_id: t.etapa_id,
    etapa_ordem: t.etapa_ordem, arquivado_em: t.arquivado_em, criado_por: t.criado_por, criado_em: t.criado_em, atualizado_em: t.atualizado_em,
    equipe_da_demanda: d ? equipeNaLista(d) : null,
    // As outras demandas ligadas (#283), como o banco as lê numa leitura a mais: só as que quem lê vê, na ordem da lista.
    equipes_das_outras_demandas: demandasDaTarefa(t).slice(1).flatMap(id => bd.demandas!.filter(x => x.id === id && vejoDemanda(x)).map(equipeNaLista))
  };
};
const buscaTarefa = (t: TarefaGuardada) => normal([t.codigo, t.titulo, t.descricao, nomesDosClientes(t.pessoas), t.demanda_codigo, t.contrato_codigo].join(' '));
/**
 * O filtro "Grupo da equipe" (#378): o item tem algum dos grupos pedidos ou é a contínua de um deles; a Geral, a contínua Geral (#416;
 * como porGrupo em supabase.ts).
 */
const noGrupoDoFiltro = (item: Partial<Pick<DemandaGuardada, 'grupos' | 'continua' | 'continua_grupo_id'>>, filtro: string | undefined) => {
  const pedido = pedidoDoFiltroDeGrupo(filtro, meusGruposNoFalso());
  return !pedido || entraNoPedido(pedido, item);
};
/** Nas tarefas, também as das demandas do grupo e as da contínua dele (como public.tarefas_do_filtro_de_grupo). */
const daTarefaNoGrupo = (x: TarefaGuardada, f: FiltroTarefas) =>
  noGrupoDoFiltro({ grupos: x.grupos }, f.grupo) || (!!f.grupo && demandasDaTarefaNoFalso(x).some(d => noGrupoDoFiltro(d, f.grupo)));
function filtrarTarefas(f: FiltroTarefas = {}) {
  const t = termo(f.termo);
  return bd.tarefas!.filter(x => vejoNoModulo('tarefas', x.id) && (f.situacao === 'arquivadas' ? x.arquivado_em : !x.arquivado_em)
    && (!f.pessoa || x.responsavel_id === f.pessoa || x.participantes.includes(f.pessoa)) && daTarefaNoGrupo(x, f)
    && (!f.solicitante || x.solicitante_id === f.solicitante) && (!f.funcao || temAFuncao(funcoesDaTarefaNoFalso(x), f.funcao))
    && (!f.etiqueta || temEtiqueta('tarefas', x.id, f.etiqueta)) && inicioNosLimites(x.data_inicio, f)
    && (!t || buscaTarefa(x).includes(t)));
}
/** Leva a tarefa à coluna, com o histórico. Como o gatilho da migração do tempo: chegar à coluna das concluídas marca a data de
 *  conclusão; sair dela, apaga. */
function gravarColunaDaTarefa(t: TarefaGuardada, etapa: string | null, ordem: number | null) {
  historicoTarefa(t, { etapa_id: etapa });
  const concluida = bd.colunas.find(c => c.id === etapa)?.marco === 'concluido';
  Object.assign(t, { etapa_id: etapa, etapa_ordem: ordem, atualizado_em: agora(), atualizado_por: eu, concluida_em: concluida ? t.concluida_em ?? agora() : null });
}
/** Como privado.tarefa_que_aprovo (#313): a tarefa que espera a aprovação de quem está logado, ou a recusa do banco. */
function tarefaQueAprovo(id: string): TarefaGuardada {
  const t = bd.tarefas!.find(x => x.id === id);
  if (!t) throw new Error('Tarefa não encontrada neste escritório.');
  if (!aprovaATarefa(t, membroLogado())) throw new Error(SO_QUEM_PEDIU_APROVA);
  if (!esperaAprovacao(t, colunasDeTarefas())) throw new Error(NAO_ESPERA_APROVACAO);
  return t;
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
// ---------- a demanda contínua (#313), como supabase/migrations/20261123003418_demanda_continua.sql ----------
/** Como privado.demanda_continua: acha (ou cria) a contínua do grupo (null: a Geral), com o administrador mais antigo como responsável. */
function continuaNoFalso(grupoId: string | null): DemandaGuardada {
  const ja = bd.demandas!.find(d => d.continua && (d.continua_grupo_id ?? null) === grupoId);
  if (ja) return ja;
  const g = grupoId ? bd.gruposDaEquipe!.find(x => x.id === grupoId) : null;
  if (grupoId && !g) throw new Error('Grupo não encontrado neste escritório.');
  const ativos = EQUIPE.filter(m => m.ativo !== false);
  const responsavel = (ativos.find(m => m.papel === 'master') ?? ativos.find(m => m.papel === 'admin'))?.id ?? eu;
  const d: DemandaGuardada = { ...demandaNova(), id: novoId(), codigo: codigo(), titulo: tituloDaContinua(g?.nome ?? NOME_DA_GERAL), descricao: DESCRICAO_DA_CONTINUA,
    responsavel_id: responsavel, criado_por: responsavel, continua: true, continua_grupo_id: grupoId,
    etapa_id: bd.colunas.find(c => c.modulo === 'demandas' && c.marco === 'inicio')?.id ?? null, etapa_ordem: Date.now() / 1000 };
  bd.demandas!.push(d);
  return d;
}
/** Como privado.uso_a_continua: quem pode ligar a tarefa à contínua (e vê-la). */
const usoAContinuaNoFalso = (d: DemandaGuardada) => usaAContinua(d, souAdmin(), meusGruposNoFalso());
/** Como privado.guardar_continua: a contínua não vai para as concluídas nem recebe colaboradores, grupos, clientes ou contrato. */
function guardarContinua(d: DemandaGuardada, novos: Partial<DadosDemanda> & { etapa_id?: string | null }) {
  if (!d.continua) return;
  if (novos.etapa_id !== undefined && novos.etapa_id !== d.etapa_id && bd.colunas.find(c => c.id === novos.etapa_id)?.marco === 'concluido') {
    throw new Error(CONTINUA_NAO_CONCLUI);
  }
  if (novos.colaboradores?.length || novos.grupos?.length || novos.clientes?.length || novos.contrato_id) throw new Error(CONTINUA_SEM_EQUIPE);
}
/** Como o gatilho "continua": a tarefa nova sem demanda, de alguém logado, entra na contínua do grupo dele (um só) ou na Geral. */
const naContinuaSemDemanda = (dados: DadosTarefa): DadosTarefa => dados.demanda_id || dados.demanda_ids?.length ? dados
  : { ...dados, demanda_ids: [continuaNoFalso(grupoPeloGatilho(meusGruposNoFalso())).id] };
function prepararTarefa(dados: DadosTarefa, atual?: TarefaGuardada): DadosTarefa & { demanda_codigo?: string | null; contrato_codigo?: string | null } {
  conferirInicio(dados);
  const t: DadosTarefa & { demanda_codigo?: string | null; contrato_codigo?: string | null } = { ...dados, ...horaELembreteDoBanco(dados) };
  if (t.grupos !== undefined) t.grupos = gruposAoGravar(t.grupos, atual?.grupos);
  // Como o banco: a tarefa nasce com um processo que existe; trocar depois só aceita um processo ativo.
  if (t.processo_id && !bd.processos!.some(p => p.id === t.processo_id)) throw new Error('Processo não encontrado neste escritório.');
  if (t.processo_id && atual && t.processo_id !== atual.processo_id && !processoAtivo(t.processo_id)) throw new Error('Processo não encontrado neste escritório.');
  if (t.titulo !== undefined) {
    t.titulo = t.titulo.trim();
    if (!t.titulo) throw new Error('Dê um título à tarefa.');
  }
  // Como o gatilho preparar_diligencia (#313): o motivo limpo, obrigatório na diligência e apagado fora dela.
  if (t.diligencia !== undefined || t.diligencia_motivo !== undefined) Object.assign(t, diligenciaAoGravar(t, atual));
  if (t.pessoas !== undefined) {
    t.pessoas = [...new Set(t.pessoas.filter(Boolean))];
    if (t.pessoas.length > CLIENTES_MAXIMOS) throw new Error(`Uma tarefa pode ter até ${CLIENTES_MAXIMOS} pessoas ligadas.`);
    if (t.pessoas.some(id => !bd.pessoas.some(p => p.id === id))) throw new Error('Pessoa não encontrada neste escritório.');
  }
  const responsavel = t.responsavel_id ?? atual?.responsavel_id;
  if (!EQUIPE.some(m => m.id === responsavel)) throw new Error('O responsável precisa ser alguém da equipe do escritório.');
  if (t.participantes !== undefined || t.responsavel_id !== undefined) {
    const lista = [...new Set((t.participantes ?? atual?.participantes ?? []).filter(Boolean))].filter(id => id !== responsavel);
    // Confere só quem está entrando: quem já estava e saiu da equipe não trava as outras alterações.
    if (lista.some(id => !atual?.participantes.includes(id) && !EQUIPE.some(m => m.id === id))) throw new Error('O participante precisa ser alguém da equipe do escritório.');
    if (lista.length > COLABORADORES_MAXIMOS) throw new Error(`Uma tarefa pode ter até ${COLABORADORES_MAXIMOS} participantes.`);
    t.participantes = lista;
  }
  // Como o gatilho aa_aprovacao (#313): só quem aprova tira a aprovação ou troca o solicitante da tarefa que precisa de aprovação.
  if (atual) conferirMudancaDaAprovacao(t, atual, membroLogado());
  // Como o gatilho preparar_pedido (#313): o solicitante que entra é da equipe; o participante tem a função escolhida ou nenhuma (#421).
  if (t.solicitante_id && t.solicitante_id !== atual?.solicitante_id && !EQUIPE.some(m => m.id === t.solicitante_id)) {
    throw new Error('O solicitante precisa ser alguém da equipe do escritório.');
  }
  if (t.funcoes !== undefined || t.participantes !== undefined) {
    t.funcoes = funcoesAoGravar(t.participantes ?? atual?.participantes ?? [], t.funcoes ?? atual?.funcoes ?? {}, bd.funcoesNaTarefa!, atual?.funcoes);
  }
  const demandas = listaAoGravar(t.demanda_ids, t.demanda_id, atual && { lista: demandasDaTarefa(atual), principal: atual.demanda_id });
  if (demandas) {
    if (demandas.some(id => !bd.demandas!.some(d => d.id === id))) throw new Error('Demanda não encontrada neste escritório.');
    // A contínua que entra (#313): só quem pode usá-la (como a conferência de ligacoes_da_tarefa), menos a volta da tarefa à contínua
    // (o Desfazer de ligá-la a uma demanda), que quem altera a tarefa faz mesmo fora do grupo dela.
    const antes = atual ? demandasDaTarefa(atual) : [];
    const ehContinuaNoFalso = (id: string) => bd.demandas!.some(d => d.id === id && d.continua);
    if (!voltaAContinua(atual ? antes : null, demandas, ehContinuaNoFalso)
      && demandas.some(id => !antes.includes(id) && bd.demandas!.some(d => d.id === id && d.continua && !usoAContinuaNoFalso(d)))) {
      throw new Error('Demanda não encontrada neste escritório.');
    }
    if (demandas.length > DEMANDAS_POR_TAREFA) throw new Error(DEMANDAS_DA_TAREFA_CHEIA);
    // A tarefa que ganha uma demanda de verdade sai da contínua (#313).
    const finais = semAContinuaComDemanda(demandas, id => bd.demandas!.some(d => d.id === id && d.continua));
    Object.assign(t, { demanda_ids: finais, demanda_id: finais[0] ?? null, demanda_codigo: bd.demandas!.find(d => d.id === finais[0])?.codigo ?? null });
  }
  const contratos = listaAoGravar(t.contrato_ids, t.contrato_id, atual && { lista: contratosDaTarefa(atual), principal: atual.contrato_id });
  if (contratos) {
    if (contratos.some(id => !bd.contratos!.some(k => k.id === id))) throw new Error('Contrato não encontrado neste escritório.');
    if (contratos.length > CONTRATOS_POR_TAREFA) throw new Error(CONTRATOS_DA_TAREFA_CHEIA);
    Object.assign(t, { contrato_ids: contratos, contrato_id: contratos[0] ?? null, contrato_codigo: bd.contratos!.find(k => k.id === contratos[0])?.codigo ?? null });
  }
  return t;
}
/**
 * Como o gatilho "ligacoes" do banco (#283): a lista gravada vale; sem ela, quem grava só a principal (a versão anterior do site) troca
 * só a principal (a antiga sai, a nova entra no lugar); na inclusão, a principal entra no começo. Sem repetir. undefined: nada muda.
 */
function listaAoGravar(lista: string[] | undefined, principal: string | null | undefined, antes?: { lista: string[]; principal: string | null }): string[] | undefined {
  if (lista !== undefined) return [...new Set([...(antes ? [] : principal ? [principal] : []), ...lista])];
  if (principal === undefined || (antes && principal === antes.principal)) return antes ? undefined : principal ? [principal] : [];
  const resto = (antes?.lista ?? []).filter(id => id !== antes?.principal && id !== principal);
  return principal ? [principal, ...resto] : resto;
}
// Do responsável, dos participantes, das pessoas, da demanda, do contrato e da coluna, o histórico guarda os nomes (como no banco).
const NOME_NO_HISTORICO_TAREFA: Record<string, [string, (v: unknown) => unknown]> = {
  responsavel_id: ['responsavel_id', id => EQUIPE.find(m => m.id === id)?.nome ?? null],
  solicitante_id: ['solicitante_id', id => EQUIPE.find(m => m.id === id)?.nome ?? null],
  participantes: ['participantes', nomesDaEquipe],
  grupos: ['grupos', nomesDosGrupos],
  pessoas: ['pessoas', lista => (lista as string[] | null ?? []).map(nomeDaPessoa).join(', ') || null],
  demanda_id: ['demanda', id => bd.demandas!.find(d => d.id === id)?.codigo ?? null],
  contrato_id: ['contrato', id => bd.contratos!.find(k => k.id === id)?.codigo ?? null],
  // As listas (#283) pelos códigos, em ordem, como privado.codigos_das_demandas e codigos_dos_contratos.
  demanda_ids: ['demandas', lista => (lista as string[] | null ?? []).map(id => bd.demandas!.find(d => d.id === id)?.codigo ?? 'demanda excluída').join(', ') || null],
  contrato_ids: ['contratos', lista => (lista as string[] | null ?? []).map(id => bd.contratos!.find(k => k.id === id)?.codigo ?? 'contrato excluído').join(', ') || null],
  // Como privado.nome_do_processo_no_historico: o número ou, sem número, o código.
  processo_id: ['processo', id => { const p = bd.processos!.find(x => x.id === id); return p ? p.numero || p.codigo : null; }],
  etapa_id: ['etapa', id => nomeDaColuna((id as string) || null)]
};
const FORA_DO_HISTORICO_TAREFA = new Set(['etapa_ordem', 'arquivado_por', 'demanda_codigo', 'contrato_codigo']);
/** Como o gatilho do banco: o que mudou, campo a campo, entra no histórico da tarefa. */
function historicoTarefa(t: TarefaGuardada, dados: Record<string, unknown>) {
  const atual = t as unknown as Record<string, unknown>, alt: Historico['alteracoes'] = {};
  const mudou = (campo: string, v: unknown) => JSON.stringify(atual[campo] ?? null) !== JSON.stringify(v ?? null);
  // A lista mudou: ela já conta a troca da principal (como o banco, #283).
  const pelaLista: Record<string, string> = { demanda_id: 'demanda_ids', contrato_id: 'contrato_ids' };
  Object.entries(dados).forEach(([campo, v]) => {
    const lista = pelaLista[campo];
    if (lista && lista in dados && mudou(lista, (dados as Record<string, unknown>)[lista])) return;
    // As funções (#313): só a troca de função de quem continua na tarefa, também de e para nenhuma (#421), pelos nomes (como
    // privado.funcoes_trocadas_no_historico).
    if (campo === 'funcoes') {
      const antes = t.funcoes ?? {}, depois = (v ?? {}) as Record<string, string>;
      const novos = (dados.participantes ?? t.participantes) as string[], ficaram = t.participantes.filter(p => novos.includes(p));
      const de = funcoesNoHistorico(antes, depois, ficaram, antes), para = funcoesNoHistorico(antes, depois, ficaram, depois);
      if (para) alt.funcoes = { de, para };
      return;
    }
    if (!FORA_DO_HISTORICO_TAREFA.has(campo) && mudou(campo, v)) {
      const [chave, nome] = NOME_NO_HISTORICO_TAREFA[campo] ?? [campo, (x: unknown) => x];
      alt[chave] = { de: nome(atual[campo] ?? null), para: nome(v ?? null) };
    }
  });
  if (Object.keys(alt).length) bd.historicoTarefas!.unshift({ id: Date.now() + Math.random(), tarefa_id: t.id, alteracoes: alt, feito_por: eu, em: agora() });
}
/** A tarefa em que quem está logado apaga, corrige e devolve registros de tempo: a que vê (como as regras de leitura das tarefas). */
const vejoATarefaDoTempo = (tarefaId: string) => {
  const t = bd.tarefas!.find(x => x.id === tarefaId);
  return !!t && (souAdmin() || !!bd.equipeVeTudo || vejoTarefa(t));
};
/** O registro de tempo em que quem está logado mexe: o próprio, ou o de qualquer um para administradores (como as regras do banco). */
const registroQueMexo = (id: number) => bd.tempos!.find(r => r.id === id && (r.perfil_id === eu || souAdmin()) && vejoATarefaDoTempo(r.tarefa_id));
/** O nome de quem é da equipe, como o histórico o escreve. */
const nomeDoMembro = (id: string | null) => EQUIPE.find(m => m.id === id)?.nome ?? null;
/** As funções de quem continua na tarefa e trocou de função, como estão em `lado`: "Ana: Executa, Bruno: Sem função" (null: ninguém trocou). */
function funcoesNoHistorico(antes: Record<string, string>, depois: Record<string, string>, ficaram: readonly string[], lado: Record<string, string>) {
  const nomeDaFuncao = (f: string | undefined) => f ? bd.funcoesNaTarefa!.find(x => x.id === f)?.nome ?? 'função apagada' : SEM_FUNCAO;
  const nomes = quemTrocouDeFuncao(antes, depois, ficaram).map(p => `${nomeDoMembro(p) ?? 'Usuário removido'}: ${nomeDaFuncao(lado[p])}`);
  return nomes.length ? nomes.sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', ') : null;
}
/** Como o gatilho do banco: apagar, corrigir e devolver um registro de tempo entram no histórico da tarefa, sem a duração. */
function historicoDoTempo(r: { tarefa_id: string }, texto: string) {
  bd.historicoTarefas!.unshift({ id: Date.now() + Math.random(), tarefa_id: r.tarefa_id, alteracoes: { tempo: { de: null, para: texto } }, feito_por: eu, em: agora() });
}
const tarefaLigada = (pessoaId: string, perfilId: string | null) => (t: TarefaGuardada): TarefaLigada => ({
  id: t.id, codigo: t.codigo, titulo: t.titulo, prazo: t.prazo, prazo_hora: t.prazo_hora ?? null, etapa_id: t.etapa_id, arquivado_em: t.arquivado_em, criado_em: t.criado_em,
  contrato_id: t.contrato_id,
  papeis: pessoaId ? papeisNaTarefa(t, pessoaId, perfilId) : []
});
/** Na ordem do quadro (como as demandas do contrato). */
const tarefasNaOrdemDoQuadro = (lista: TarefaGuardada[]) => lista
  .sort((a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || a.criado_em.localeCompare(b.criado_em))
  .slice(0, TAREFAS_LIGADAS).map(tarefaLigada('', null));
// ---------- modelos de lista ----------
/** Como o gatilho preparar (20261119142702): a árvore limpa e, em "itens", as folhas dela. */
function modeloDaArvore(arvore: NoDoModelo[]): Pick<ModeloGuardado, 'arvore' | 'itens'> {
  const limpa = limparArvore(arvore);
  if (typeof limpa === 'string') throw new Error(limpa);
  return { arvore: limpa, itens: itensDaArvore(limpa) };
}
/** Como o gatilho preparar e o índice de nome único: nome limpo e sem repetir; a árvore limpa, com as folhas em "itens". */
function prepararModelo(campos: Partial<Pick<ModeloDeLista, 'nome' | 'arvore'>>, id?: string) {
  const m: Partial<Pick<ModeloGuardado, 'nome' | 'itens' | 'arvore'>> = {};
  if (campos.nome !== undefined) {
    m.nome = nomeDaLista(campos.nome);
    if (bd.modelos!.some(x => x.id !== id && normal(x.nome) === normal(m.nome))) throw new Error('Já existe um modelo de checklist com esse nome.');
  }
  return campos.arvore === undefined ? m : { ...m, ...modeloDaArvore(campos.arvore) };
}
/** O modelo lido: a árvore nula vira a dos itens; a defasada (a versão anterior mudou os itens) é ajustada a eles. */
const modeloLido = (m: ModeloGuardado): ModeloDeLista => ({ ...m, arvore: arvoreDoModelo(m) });
// Processos guardados na sessão antes de existirem os campos (no banco, a coluna nasce vazia).
bd.processos!.forEach(p => { p.campos ??= {}; });
// ---------- compromissos ----------
/** O número do processo é lido na hora: o banco copia para o compromisso quando ele muda. */
const processoDoCompromisso = (c: CompromissoGuardado) => bd.processos!.find(p => p.id === c.processo_id) ?? null;
const compromissoLista = (c: CompromissoGuardado): CompromissoLista => ({
  id: c.id, codigo: c.codigo, tipo: c.tipo, titulo: c.titulo, data: c.data, hora: c.hora, hora_fim: c.hora_fim, modalidade: c.modalidade, local: c.local, geral: c.geral, responsavel_id: c.responsavel_id,
  participantes: c.participantes, grupos: c.grupos ?? [], pessoa_nome: nomesDosClientes(c.pessoas), processo_id: c.processo_id, processo_codigo: c.processo_codigo, processo_numero: processoDoCompromisso(c)?.numero ?? c.processo_numero,
  sala_id: c.sala_id ?? null, repeticao_id: c.repeticao_id ?? null,
  etapa_id: c.etapa_id, etapa_ordem: c.etapa_ordem, arquivado_em: c.arquivado_em, criado_por: c.criado_por, criado_em: c.criado_em, atualizado_em: c.atualizado_em
});
const compromissoCompleto = (c: CompromissoGuardado): Compromisso => {
  const p = processoDoCompromisso(c);
  const serie = serieDoFalso(c.repeticao_id);
  return { ...c, sala_id: c.sala_id ?? null, repeticao_id: c.repeticao_id ?? null, repeticao_data: c.repeticao_data ?? null,
    repeticao: serie && { id: serie.id, frequencia: serie.frequencia, intervalo: serie.intervalo, inicio: serie.inicio, ate: serie.ate, vezes: serie.vezes,
      demanda_dias_antes: serie.demanda_dias_antes ?? null }, demanda_gerada_id: c.demanda_gerada_id ?? null, pessoa_nome: nomesDosClientes(c.pessoas), pessoas: c.pessoas.map(id => resumoDe(id)!), processo_numero: p?.numero ?? c.processo_numero,
    processo: p && { id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, cliente_nome: nomesDosClientes(p.clientes), criado_por: p.criado_por, responsavel_id: p.responsavel_id, colaboradores: p.colaboradores, grupos: p.grupos ?? [] } };
};
const compromissoLigado = (c: CompromissoGuardado, papeis: CompromissoLigado['papeis']): CompromissoLigado => ({
  id: c.id, codigo: c.codigo, tipo: c.tipo, titulo: c.titulo, data: c.data, hora: c.hora, hora_fim: c.hora_fim, pessoa_nome: nomesDosClientes(c.pessoas),
  processo_numero: processoDoCompromisso(c)?.numero ?? c.processo_numero, etapa_id: c.etapa_id, arquivado_em: c.arquivado_em, papeis
});
const buscaCompromisso = (c: CompromissoGuardado) => {
  const numero = processoDoCompromisso(c)?.numero ?? c.processo_numero ?? '';
  return normal([c.codigo, c.titulo, nomesDosClientes(c.pessoas), c.local, c.processo_codigo, numero, numero.replace(/\D/g, '')].join(' '));
};
function filtrarCompromissos(f: FiltroCompromissos = {}) {
  const t = termo(f.termo);
  return bd.compromissos!.filter(c => vejoNoModulo('compromissos', c.id) && (f.situacao === 'arquivados' ? c.arquivado_em : !c.arquivado_em)
    && (!f.pessoa || c.responsavel_id === f.pessoa || c.participantes.includes(f.pessoa))
    && (!f.tipo || c.tipo === f.tipo)
    && (!f.sala || c.sala_id === f.sala)
    && (!f.etiqueta || temEtiqueta('compromissos', c.id, f.etiqueta))
    && (!f.soAProxima || !c.repeticao_id || !!c.arquivado_em || vezNaLista(vezesNaLista(c.repeticao_id), hojeNaAgenda()) === c.id)
    && (!t || buscaCompromisso(c).includes(t)));
}
const nomeOrdemCompromisso = (c: CompromissoGuardado) => normal(c.titulo || nomesDosClientes(c.pessoas));
const quandoCompromisso = (c: CompromissoGuardado) => `${c.data} ${c.hora ?? ''}`;
const ORDENS_COMPROMISSO: Record<OrdemCompromisso, (a: CompromissoGuardado, b: CompromissoGuardado) => number> = {
  data: (a, b) => quandoCompromisso(a).localeCompare(quandoCompromisso(b)),
  data_desc: (a, b) => quandoCompromisso(b).localeCompare(quandoCompromisso(a)),
  manual: (a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || b.criado_em.localeCompare(a.criado_em),
  nome: (a, b) => nomeOrdemCompromisso(a).localeCompare(nomeOrdemCompromisso(b)),
  nome_desc: (a, b) => nomeOrdemCompromisso(b).localeCompare(nomeOrdemCompromisso(a)),
  novos: (a, b) => b.criado_em.localeCompare(a.criado_em),
  antigos: (a, b) => a.criado_em.localeCompare(b.criado_em),
  recentes: (a, b) => b.atualizado_em.localeCompare(a.atualizado_em)
};
const acharCompromisso = (id: string) => {
  const c = bd.compromissos!.find(x => x.id === id);
  if (!c) throw new Error('Compromisso não encontrado.');
  return c;
};
/** Como a regra da migração: a coluna precisa ser do quadro de compromissos. */
function conferirQuadroDoCompromisso(etapaId: string | null | undefined) {
  if (etapaId && bd.colunas.find(c => c.id === etapaId)?.modulo !== 'compromissos') throw new Error('Você não tem permissão para fazer isso.');
}
/** O banco guarda a hora com os segundos. */
const horaComSegundos = (hora: string | null | undefined) => hora ? hora.slice(0, 5) + ':00' : null;
/** Como o gatilho preparar e as regras check da migração. */
function prepararCompromisso(dados: DadosCompromisso, atual?: CompromissoGuardado): DadosCompromisso {
  const d: DadosCompromisso = { ...dados };
  if (d.grupos !== undefined) d.grupos = gruposAoGravar(d.grupos, atual?.grupos);
  conferirQuadroDoCompromisso(d.etapa_id);
  const limpar = (v: string | null | undefined) => (v ?? '').trim() || null;
  for (const campo of ['titulo', 'local', 'resultado', 'observacoes'] as const) if (d[campo] !== undefined) d[campo] = limpar(d[campo]);
  for (const campo of ['hora', 'hora_fim'] as const) if (d[campo] !== undefined) d[campo] = horaComSegundos(d[campo]);
  if (d.pessoas !== undefined) {
    d.pessoas = [...new Set(d.pessoas.filter(Boolean))];
    if (d.pessoas.length > CLIENTES_MAXIMOS) throw new Error(FORMATO_INVALIDO);
    if (d.pessoas.some(c => !bd.pessoas.some(p => p.id === c))) throw new Error('Pessoa não encontrada neste escritório.');
  }
  const responsavel = d.responsavel_id ?? atual?.responsavel_id;
  if (!EQUIPE.some(m => m.id === responsavel)) throw new Error('O responsável precisa ser alguém da equipe do escritório.');
  if (d.participantes !== undefined || d.responsavel_id !== undefined) {
    const lista = [...new Set((d.participantes ?? atual?.participantes ?? []).filter(Boolean))].filter(id => id !== responsavel);
    // Confere só quem está entrando: quem já estava e saiu da equipe não trava as outras alterações.
    if (lista.some(id => !atual?.participantes.includes(id) && !EQUIPE.some(m => m.id === id))) throw new Error('O participante precisa ser alguém da equipe do escritório.');
    if (lista.length > COLABORADORES_MAXIMOS) throw new Error(FORMATO_INVALIDO);
    d.participantes = lista;
  }
  if (d.processo_id !== undefined && d.processo_id !== atual?.processo_id) {
    const p = d.processo_id ? bd.processos!.find(x => x.id === d.processo_id) : null;
    if (d.processo_id && !p) throw new Error('Processo não encontrado neste escritório.');
    Object.assign(d, { processo_codigo: p?.codigo ?? null, processo_numero: p?.numero ?? null });
  }
  // Os tamanhos e as regras check valem para como o compromisso fica.
  if ((Object.keys(TAMANHO_COMPROMISSO) as (keyof typeof TAMANHO_COMPROMISSO)[]).some(campo => (d[campo]?.length ?? 0) > TAMANHO_COMPROMISSO[campo])) throw new Error(FORMATO_INVALIDO);
  const fica = { ...atual, ...d } as CompromissoGuardado;
  const tipo = TIPOS_COMPROMISSO[fica.tipo];
  if (!tipo) throw new Error(FORMATO_INVALIDO);
  if (tipo.doProcesso && !fica.processo_id) throw new Error('Audiência e perícia precisam de um processo.');
  const invalido = !fica.data || (tipo.doProcesso && !fica.modalidade) || (!tipo.doProcesso && (!fica.titulo || !!fica.resultado)) || (tipo.exigeHora && !fica.hora)
    || (!!fica.hora_fim && (!fica.hora || fica.hora_fim <= fica.hora));
  if (invalido) throw new Error(FORMATO_INVALIDO);
  conferirSalaNoFalso(fica, atual);
  return d;
}
// ---------- salas do escritório (como supabase/migrations/20261122132438_salas_do_escritorio.sql, #308) ----------
/** Os compromissos ativos e não cancelados que ocupam a sala no dia, fora um, pela hora (como privado.ocupacoes_da_sala). */
const ocupacoesNoFalso = (salaId: string, data: string, fora: string | null | undefined) => bd.compromissos!
  .filter(c => c.sala_id === salaId && c.data === data && c.id !== fora && !c.arquivado_em && !colunaCancelada(nomeDaColuna(c.etapa_id)))
  .sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? '') || a.codigo.localeCompare(b.codigo));
/** Como o gatilho conferir_sala: a sala existe, a escolhida agora está ativa, e está livre no horário (o arquivado e o cancelado não ocupam). */
function conferirSalaNoFalso(fica: Pick<CompromissoGuardado, 'sala_id' | 'data' | 'hora' | 'hora_fim' | 'etapa_id' | 'arquivado_em'> & { id?: string }, atual?: Pick<CompromissoGuardado, 'id' | 'sala_id'>) {
  if (!fica.sala_id) return;
  const s = bd.salas!.find(x => x.id === fica.sala_id);
  if (!s) throw new Error('Sala não encontrada neste escritório.');
  if (!s.ativa && (!atual || atual.sala_id !== fica.sala_id)) throw new Error(`A sala ${s.nome} está desativada. Escolha outra sala.`);
  if (fica.arquivado_em || colunaCancelada(nomeDaColuna(fica.etapa_id))) return;
  const conflito = conflitoNaSala({ hora: fica.hora, horaFim: fica.hora_fim }, ocupacoesNoFalso(s.id, fica.data, atual?.id ?? fica.id));
  if (conflito) throw new Error(`A sala ${s.nome} já está ocupada ${horarioNaSala(conflito)} pelo compromisso ${conflito.codigo}. Escolha outro horário ou outra sala.`);
}
/** Como o gatilho preparar e as regras da tabela: o nome limpo, até TAMANHO_SALA, sem repetir (maiúsculas e acentos não contam), e a capacidade de 1 a 999. */
function prepararSala(dados: Partial<DadosSala>, id?: string): Partial<DadosSala> {
  const d = { ...dados };
  if (d.nome !== undefined) {
    d.nome = d.nome.trim();
    if (!d.nome || d.nome.length > TAMANHO_SALA.nome) throw new Error(FORMATO_INVALIDO);
    if (bd.salas!.some(s => s.id !== id && normal(s.nome) === normal(d.nome))) throw new Error(SALA_REPETIDA);
  }
  if (d.capacidade !== undefined && !(Number.isInteger(d.capacidade) && d.capacidade >= 1 && d.capacidade <= TAMANHO_SALA.capacidadeMaxima)) throw new Error(FORMATO_INVALIDO);
  return d;
}

// ---------- funções dos participantes da tarefa (#313) ----------
/**
 * A função de cada participante, como o banco a guarda: a escolhida ou nenhuma (#421); quem não é participante não entra. Vale também
 * para a tarefa gravada antes das funções ou por um caminho que não as escolhe (como o gatilho preparar_pedido, para qualquer gravação).
 */
function funcoesDaTarefaNoFalso(t: Pick<TarefaGuardada, 'participantes'> & { funcoes?: Record<string, string> }) {
  return funcoesAoGravar(t.participantes, t.funcoes ?? {}, bd.funcoesNaTarefa ?? [], t.funcoes ?? {});
}
/** Como o gatilho preparar e as regras da tabela: o nome limpo, até TAMANHO_FUNCAO_NA_TAREFA, sem repetir (maiúsculas e acentos não contam). */
function prepararFuncaoNaTarefa(dados: Partial<DadosFuncaoNaTarefa>, id?: string): Partial<DadosFuncaoNaTarefa> {
  const d = { ...dados };
  if (d.nome !== undefined) {
    d.nome = d.nome.trim();
    if (!d.nome || d.nome.length > TAMANHO_FUNCAO_NA_TAREFA.nome) throw new Error(FORMATO_INVALIDO);
    if (nomeRepetido(d.nome, bd.funcoesNaTarefa!, id)) throw new Error(FUNCAO_REPETIDA);
  }
  return d;
}

/** Como o gatilho do banco: o que mudou, campo a campo, entra no histórico. */
function historicoCompromisso(c: CompromissoGuardado, dados: Record<string, unknown>) {
  const atual = c as unknown as Record<string, unknown>, alt: Historico['alteracoes'] = {};
  const nomeNaEquipe = (id: unknown) => EQUIPE.find(m => m.id === id)?.nome ?? null;
  const numeroDoProcesso = (id: unknown) => bd.processos!.find(p => p.id === id)?.numero ?? null;
  const CONVERTE: Record<string, [string, (v: unknown) => unknown]> = {
    etapa_id: ['etapa', v => nomeDaColuna(v as string | null)], responsavel_id: ['responsavel_id', nomeNaEquipe], processo_id: ['processo', numeroDoProcesso],
    sala_id: ['sala', v => bd.salas!.find(s => s.id === v)?.nome ?? null],
    participantes: ['participantes', v => (v as string[]).map(nomeNaEquipe).join(', ')], grupos: ['grupos', nomesDosGrupos], pessoas: ['pessoas', v => (v as string[]).map(id => resumoDe(id)?.nome).join(', ')]
  };
  Object.entries(dados).forEach(([campo, v]) => {
    if (['etapa_ordem', 'arquivado_por', 'processo_codigo', 'processo_numero'].includes(campo) || JSON.stringify(atual[campo] ?? null) === JSON.stringify(v ?? null)) return;
    const [chave, conv] = CONVERTE[campo] ?? [campo, (x: unknown) => x];
    alt[chave] = { de: conv(atual[campo] ?? null), para: conv(v ?? null) };
  });
  if (Object.keys(alt).length) bd.historicoCompromissos!.unshift({ id: Date.now() + Math.random(), compromisso_id: c.id, alteracoes: alt, feito_por: eu, em: agora() });
  // Como o gatilho demanda_acompanha (#307, parte B): toda forma de mudar o compromisso passa por aqui, antes de gravar.
  demandaAcompanhaNoFalso(c, dados);
}
/** O compromisso sai, com os comentários, as etiquetas e o histórico dele. */
function apagarCompromisso(c: CompromissoGuardado) {
  bd.compromissos = bd.compromissos!.filter(x => x.id !== c.id);
  bd.historicoCompromissos = bd.historicoCompromissos!.filter(h => h.compromisso_id !== c.id);
  bd.etiquetasAplicadas = bd.etiquetasAplicadas!.filter(a => !(a.modulo === 'compromissos' && a.cartao_id === c.id));
  bd.comentarios = bd.comentarios!.filter(x => !(x.modulo === 'compromissos' && x.cartao_id === c.id));
  soltarDasAnotacoes('compromissos', c.id);
  bd.compromissoLigacoes = bd.compromissoLigacoes!.filter(l => l.compromisso_id !== c.id);
  auditar('compromissos', 'exclusao', { id: c.id, codigo: c.codigo });
}
/** Como o gatilho audiencias_saem_junto e o on delete set null: as audiências e perícias saem; os outros ficam sem a ligação. */
function compromissosDoProcessoExcluido(processoId: string) {
  for (const c of bd.compromissos!.filter(x => x.processo_id === processoId)) {
    if (TIPOS_COMPROMISSO[c.tipo].doProcesso) { apagarCompromisso(c); continue; }
    historicoCompromisso(c, { processo_id: null });
    Object.assign(c, { processo_id: null, processo_codigo: null, processo_numero: null });
  }
}
// ---------- tarefas, demandas e contratos ligados (como supabase/migrations/20261122130038_ligacoes_dos_compromissos.sql, #306) ----------
const ligacoesDoCompromisso = (id: string) => bd.compromissoLigacoes!.filter(l => l.compromisso_id === id);
/** Como privado.altero_o_compromisso: o compromisso ativo, por quem o muda (a regra "alterar" dele). */
const alteroCompromisso = (c: CompromissoGuardado) =>
  !c.arquivado_em && (!!bd.equipeEditaTudo || participaDoCompromisso(c, membroLogado(), processoDoCompromisso(c), meusGruposNoFalso()));
/** O item como o histórico mostra ("Tarefa T1"), como privado.codigo_do_item_do_compromisso; o item que já saiu, pelo nome guardado ao ligar. */
const nomeDoItemDoCompromisso = (modulo: ModuloDoCompromisso, itemId: string, guardado?: string | null) => {
  const achado = ITEM_NO_FALSO[modulo](itemId);
  return achado ? `${ITEM_DA_ANOTACAO[modulo].rotulo} ${achado.item.codigo}` : guardado ?? null;
};
/** Como o gatilho do banco: ligar e desligar entram no histórico do compromisso, com o código do item. */
function historicoDaLigacao(compromissoId: string, item: string | null, ligou: boolean) {
  bd.historicoCompromissos!.unshift({ id: Date.now() + Math.random(), compromisso_id: compromissoId, feito_por: eu, em: agora(),
    alteracoes: { ligacao: ligou ? { de: null, para: item } : { de: item, para: null } } });
}
/** Como o on delete cascade das ligações: o item excluído sai dos compromissos (e o histórico de cada um registra, pelo nome guardado). */
function soltarDosCompromissos(modulo: ModuloDoCompromisso, itemId: string) {
  const saem = bd.compromissoLigacoes!.filter(l => l.modulo === modulo && l.item_id === itemId);
  saem.forEach(l => historicoDaLigacao(l.compromisso_id, nomeDoItemDoCompromisso(modulo, itemId, l.item_nome), false));
  bd.compromissoLigacoes = bd.compromissoLigacoes!.filter(l => !saem.includes(l));
}
// ---------- compromissos que se repetem (como supabase/migrations/20261122232804_compromissos_que_se_repetem.sql, #307) ----------
/** A série como fica guardada: a regra, a primeira data, a última data que já virou compromisso e quem a criou. */
type RepeticaoGuardada = RepeticaoCompromisso & { gerada_ate: string; criado_por: string | null };
const serieDoFalso = (id: string | null | undefined) => bd.repeticoes!.find(r => r.id === id) ?? null;
const naColunaDeConcluido = (etapa: string | null) => bd.colunas.find(c => c.id === etapa)?.marco === 'concluido';
/** Como privado.compromisso_em_aberto: nem arquivado, nem na coluna de concluído ("Realizado") ou na "Cancelado". */
const compromissoEmAberto = (c: CompromissoGuardado) => !c.arquivado_em && !naColunaDeConcluido(c.etapa_id) && !colunaCancelada(nomeDaColuna(c.etapa_id));
/** As datas da série que quem está logado vê, para o quadro escolher a próxima (public.no_quadro roda com a permissão de quem lê). */
const vezesNaLista = (serieId: string) => bd.compromissos!.filter(x => x.repeticao_id === serieId && vejoNoModulo('compromissos', x.id))
  .map(x => ({ id: x.id, data: x.data, hora: x.hora, aberta: compromissoEmAberto(x) }));
/** Como privado.esta_e_as_seguintes: este e os seguintes da série ainda em aberto que quem está logado muda, na ordem da série. */
const estaEAsSeguintes = (c: CompromissoGuardado) => bd.compromissos!
  .filter(x => x.repeticao_id === c.repeticao_id && (x.id === c.id || (x.repeticao_data! > c.repeticao_data! && compromissoEmAberto(x) && alteroCompromisso(x))))
  .sort((a, b) => a.repeticao_data!.localeCompare(b.repeticao_data!));
/**
 * Como privado.altero_as_datas_em_aberto: quem está logado muda todas as datas em aberto da série, as de uma vez em diante (`vezDesde`,
 * a data que a regra deu) e as de um dia em diante (`diaDesde`). Null não filtra.
 */
const alteroAsDatasEmAberto = (serieId: string, vezDesde: string | null, diaDesde: string | null) => bd.compromissos!
  .filter(x => x.repeticao_id === serieId && (vezDesde === null || x.repeticao_data! >= vezDesde) && (diaDesde === null || x.data >= diaDesde) && compromissoEmAberto(x))
  .every(alteroCompromisso);
/**
 * Como privado.gerar_repeticoes: cada data nova copia a última da série ainda ativa (pessoas, equipe, processo, sala, ligações e
 * etiquetas), na coluna de início do quadro; a sala ocupada numa data fica de fora só nela. Sem nenhuma ativa, a série não cresce.
 */
function gerarRepeticoesNoFalso(serie: RepeticaoGuardada, hoje = hojeNaAgenda()): RepeticaoCriada {
  const criada: RepeticaoCriada = { ids: [], semSala: [] };
  const modelo = bd.compromissos!.filter(c => c.repeticao_id === serie.id && !c.arquivado_em).sort((a, b) => b.repeticao_data!.localeCompare(a.repeticao_data!))[0];
  if (!modelo) return criada;
  const inicio = bd.colunas.find(c => c.modulo === 'compromissos' && c.marco === 'inicio')?.id ?? null;
  for (const { data } of vezesParaGerar(serie, serie.gerada_ate, hoje)) {
    let sala = modelo.sala_id ?? null;
    if (sala && (!bd.salas!.find(s => s.id === sala)?.ativa || conflitoNaSala({ hora: modelo.hora, horaFim: modelo.hora_fim }, ocupacoesNoFalso(sala, data, null)))) {
      sala = null;
      criada.semSala.push(data);
    }
    const c: CompromissoGuardado = { ...modelo, id: novoId(), codigo: codigo(), data, sala_id: sala, resultado: null, etapa_id: inicio, etapa_ordem: Date.now() / 1000,
      participantes: modelo.participantes.filter(id => EQUIPE.some(m => m.id === id)), arquivado_em: null, arquivado_por: null,
      criado_por: serie.criado_por ?? modelo.criado_por, criado_em: agora(), atualizado_por: serie.criado_por, atualizado_em: agora(), repeticao_id: serie.id, repeticao_data: data };
    bd.compromissos!.push(c);
    // A ligação com a demanda que nasceu de outra data não vem junto (cada data tem a sua, #307 parte B).
    ligacoesDoCompromisso(modelo.id).filter(l => !(l.modulo === 'demandas' && demandaGeradaPorAlgum(l.item_id)))
      .forEach(l => bd.compromissoLigacoes!.push({ ...l, compromisso_id: c.id, criado_em: agora() }));
    bd.etiquetasAplicadas!.filter(a => a.modulo === 'compromissos' && a.cartao_id === modelo.id).forEach(a => bd.etiquetasAplicadas!.push({ ...a, cartao_id: c.id }));
    criada.ids.push(c.id);
    serie.gerada_ate = data;
  }
  return criada;
}
// ---------- a demanda de cada data (como supabase/migrations/20261123000750_demandas_dos_compromissos.sql, #307 parte B) ----------
const demandaGeradaPorAlgum = (demandaId: string) => bd.compromissos!.some(c => c.demanda_gerada_id === demandaId);
/** Como privado.avisar_da_demanda_do_compromisso: o responsável da demanda, se ativo e se não foi ele quem fez (`por`; null: a rotina). */
function avisarDaDemandaNoFalso(d: DemandaGuardada, compromissoId: string, aviso: AvisoDaDemandaDoCompromisso, antes: string | null, nova: string | null, por: string | null) {
  if (!recebeAviso(d.responsavel_id) || d.responsavel_id === por) return;
  bd.mensagensDeCompromisso!.push({ id: novoId(), perfil_id: d.responsavel_id, aviso, demanda_id: d.id, compromisso_id: compromissoId, data_antes: antes, data_nova: nova,
    criado_em: agora(), lido_em: null });
}
/**
 * Como privado.gerar_demanda_do_compromisso: a data em aberto, de hoje em diante, que ainda não gerou e cujo dia de nascer chegou (o
 * banco fictício tem todos os módulos ligados). O responsável é o do compromisso ou, se saiu da equipe, quem criou a repetição.
 */
function gerarDemandaNoFalso(c: CompromissoGuardado, hoje: string, por: string | null): string | null {
  const serie = serieDoFalso(c.repeticao_id), dias = serie?.demanda_dias_antes;
  if (!serie || !dias || c.demanda_gerada_em || c.data < hoje || !compromissoEmAberto(c) || diaDaDemanda(c.data, dias, bd.diasLancados!) > hoje) return null;
  const responsavel = [c.responsavel_id, serie.criado_por].find(p => p && recebeAviso(p));
  if (!responsavel) return null;
  const contrato = ligacoesDoCompromisso(c.id).find(l => l.modulo === 'contratos')?.item_id ?? null;
  const inicio = bd.colunas.find(x => x.modulo === 'demandas' && x.marco === 'inicio')?.id ?? null;
  const d: DemandaGuardada = { ...demandaNova(), ...prepararDemanda({ titulo: tituloDaDemanda(c.titulo, c.data), prazo: c.data, prazo_hora: c.hora, responsavel_id: responsavel,
    colaboradores: c.participantes.filter(recebeAviso), clientes: c.pessoas, grupos: c.grupos ?? [], contrato_id: contrato, etapa_id: inicio, etapa_ordem: Date.now() / 1000 }) as Partial<DemandaGuardada>,
  id: novoId(), codigo: codigo(), criado_por: serie.criado_por ?? c.criado_por };
  bd.demandas!.push(d);
  Object.assign(c, { demanda_gerada_id: d.id, demanda_gerada_em: agora() });
  if (ligacoesDoCompromisso(c.id).length < ITENS_DO_COMPROMISSO) {
    const item_nome = nomeDoItemDoCompromisso('demandas', d.id);
    bd.compromissoLigacoes!.push({ compromisso_id: c.id, modulo: 'demandas', item_id: d.id, item_nome, criado_em: agora() });
    historicoDaLigacao(c.id, item_nome, true);
  }
  avisarDaDemandaNoFalso(d, c.id, 'demanda_nova', null, c.data, por);
  return d.id;
}
/** Como privado.gerar_demandas_das_series: as datas de uma série (ou de todas, com null) que já estão no prazo, na ordem das datas. */
const gerarDemandasNoFalso = (serieId: string | null, hoje: string, por: string | null) => bd.compromissos!
  .filter(c => c.repeticao_id && (serieId === null || c.repeticao_id === serieId))
  .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
  .flatMap(c => { const id = gerarDemandaNoFalso(c, hoje, por); return id ? [id] : []; });
/**
 * Como o gatilho demanda_acompanha: a data mudada leva o prazo da demanda (se ainda era a data antiga) e o título (se ainda era o de
 * quando ela nasceu), e avisa; o compromisso cancelado (coluna "Cancelado" ou arquivado sem ter sido realizado) avisa, e a demanda fica.
 */
function demandaAcompanhaNoFalso(c: CompromissoGuardado, dados: Record<string, unknown>) {
  const d = c.demanda_gerada_id ? bd.demandas!.find(x => x.id === c.demanda_gerada_id) : undefined;
  if (!d) return;
  const depois = { ...c, ...Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined)) } as CompromissoGuardado;
  if ((depois.data !== c.data || depois.hora !== c.hora) && !d.arquivado_em && d.prazo === c.data) {
    const novos = { prazo: depois.data, prazo_hora: d.prazo_hora === c.hora ? depois.hora : d.prazo_hora,
      titulo: depois.data !== c.data && d.titulo === tituloDaDemanda(c.titulo, c.data) ? tituloDaDemanda(depois.titulo, depois.data) : d.titulo };
    historicoDemanda(d, novos);
    Object.assign(d, novos, { atualizado_em: agora() });
  }
  if (depois.data !== c.data) avisarDaDemandaNoFalso(d, c.id, 'data_mudou', c.data, depois.data, eu);
  if (compromissoEmAberto(c) && !compromissoEmAberto(depois) && !naColunaDeConcluido(depois.etapa_id)) avisarDaDemandaNoFalso(d, c.id, 'cancelado', null, depois.data, eu);
}
/** Como a regra de leitura de mensagens_de_compromisso: cada um lê as suas; a demanda excluída leva as dela (a chave estrangeira). */
const minhasMensagensDeCompromisso = () => bd.mensagensDeCompromisso!.filter(m => m.perfil_id === eu && bd.demandas!.some(d => d.id === m.demanda_id));
function mensagemDeCompromissoLida({ id, perfil_id: _perfil, demanda_id, criado_em, lido_em, ...aviso }: MensagemDeCompromissoGuardada): Mensagem {
  const d = bd.demandas!.find(x => x.id === demanda_id);
  return { id, tipo: 'demandaDoCompromisso', criado_em, lido_em, comentario: null, prazo: null, pedido: null, inclusao: null,
    demandaDoCompromisso: { ...aviso, demanda: d && vejoNoModulo('demandas', d.id) ? { id: d.id, codigo: d.codigo, titulo: d.titulo } : null } };
}

// Como as rotinas diárias estender-repeticoes e gerar-demandas-dos-compromissos: ao abrir o banco fictício, as séries ganham as datas que
// entraram no horizonte, e as datas no prazo ganham a demanda (sem ninguém logado: o responsável é avisado).
bd.repeticoes!.filter(r => r.ate === null || r.gerada_ate < r.ate).forEach(r => gerarRepeticoesNoFalso(r));
gerarDemandasNoFalso(null, hojeNaAgenda(), null);

// ---------- anotações (como supabase/migrations/20261117143714_anotacoes.sql) ----------
// Aqui a regra de quem vê e quem altera vale de verdade (regras/anotacao.ts), e a visibilidade de cada item ligado segue as
// regras puras de cada módulo, como as do banco (mesmo onde a listagem do módulo, no banco fictício, ainda mostra tudo).
const chavesDaEquipe = (): ChavesDaEquipe => ({ equipeVeTudo: !!bd.equipeVeTudo, equipeEditaTudo: !!bd.equipeEditaTudo });
/** Cada módulo a que a anotação se liga: o item, como aparece no cartão dela, e se quem está logado o vê pelas regras do módulo. */
const ITEM_NO_FALSO: Record<ModuloDaAnotacao, (id: string) => { item: ItemDaAnotacao; vejo: boolean } | null> = {
  pessoas: id => { const p = bd.pessoas.find(x => x.id === id); return p ? { item: itemDaAnotacao('pessoas', p), vejo: true } : null; },
  processos: id => {
    const p = bd.processos!.find(x => x.id === id);
    return p ? { item: itemDaAnotacao('processos', { ...p, cliente_nome: nomesDosClientes(p.clientes) }), vejo: alteraOProcesso(p, membroLogado(), meusGruposNoFalso()) } : null;
  },
  contratos: id => { const k = bd.contratos!.find(x => x.id === id); return k ? { item: itemDaAnotacao('contratos', k), vejo: alcancoContrato(k) } : null; },
  demandas: id => { const d = bd.demandas!.find(x => x.id === id); return d ? { item: itemDaAnotacao('demandas', d), vejo: vejoDemanda(d) } : null; },
  tarefas: id => {
    const t = bd.tarefas!.find(x => x.id === id);
    return t ? { item: itemDaAnotacao('tarefas', t), vejo: vejoTarefa(t) } : null;
  },
  compromissos: id => {
    const c = bd.compromissos!.find(x => x.id === id);
    return c ? { item: itemDaAnotacao('compromissos', c), vejo: veOCompromisso(c, membroLogado(), processoDoCompromisso(c), meusGruposNoFalso()) } : null;
  }
};
/**
 * Os módulos que cada chave da equipe abre no banco: a de ver tudo abre demandas, tarefas, processos (20261109102349_equipe_ve_tudo.sql)
 * e contratos (a view contratos_da_equipe), mas não compromissos; a de editar tudo abre os quatro módulos da fase de adaptação
 * (20261109140344_fase_de_adaptacao.sql), mas não contratos. As pessoas, todo o escritório vê.
 */
const ABRE_COM_A_CHAVE: Record<ModuloDaAnotacao, Record<keyof ChavesDaEquipe, boolean>> = {
  pessoas: { equipeVeTudo: true, equipeEditaTudo: true },
  processos: { equipeVeTudo: true, equipeEditaTudo: true },
  contratos: { equipeVeTudo: true, equipeEditaTudo: false },
  demandas: { equipeVeTudo: true, equipeEditaTudo: true },
  tarefas: { equipeVeTudo: true, equipeEditaTudo: true },
  compromissos: { equipeVeTudo: false, equipeEditaTudo: true }
};
/** As linhas de cada módulo mencionável com !código nos comentários (#297). */
const ITENS_MENCIONAVEIS: Record<ModuloMencionavel, () => { id: string; codigo: string }[]> = {
  tarefas: () => bd.tarefas!, demandas: () => bd.demandas!, contratos: () => bd.contratos!, processos: () => bd.processos!, pessoas: () => bd.pessoas
};
/** Quem está logado vê o item, pelas regras do módulo ou pela chave da equipe que abre esse módulo? */
const vejoOItem = (modulo: ModuloDaAnotacao, id: string) => {
  const x = ITEM_NO_FALSO[modulo](id), chaves = chavesDaEquipe(), abre = ABRE_COM_A_CHAVE[modulo];
  return !!x && (x.vejo || (chaves.equipeVeTudo && abre.equipeVeTudo) || (chaves.equipeEditaTudo && abre.equipeEditaTudo));
};
const ligacoesDaAnotacao = (id: string) => bd.anotacaoLigacoes!.filter(l => l.anotacao_id === id);
/** Como a regra de leitura do banco (com privado.anotacoes_pelos_itens). */
const vejoAnotacao = (a: Anotacao) => veAAnotacao(a, membroLogado(), chavesDaEquipe(),
  ligacoesDaAnotacao(a.id).some(l => ABRE_A_ANOTACAO[l.modulo] && vejoOItem(l.modulo, l.item_id)), meusGruposNoFalso());
const alteroAnotacao = (a: Anotacao) => alteraAAnotacao(a, membroLogado(), chavesDaEquipe(), meusGruposNoFalso());
/** Como a regra de leitura das etiquetas da anotação: segue quem vê a anotação. */
const vejoAnotacaoDoId = (id: string) => bd.anotacoes!.some(a => a.id === id && vejoAnotacao(a));
/** Se quem está logado vê o processo (como a regra de leitura dele, que a dos comentários consulta, #362). */
const vejoProcessoDoId = (id: string) => bd.processos!.some(p => p.id === id) && vejoNoModulo('processos', id);
/** Como privado.altero_a_anotacao, que as regras de aplicar e tirar etiquetas usam: a anotação ativa, por quem a altera. */
const alteroAnotacaoDoId = (id: string) => bd.anotacoes!.some(a => a.id === id && ligaNaAnotacao(a, membroLogado(), chavesDaEquipe(), meusGruposNoFalso()));
/** Quem pode tirar a etiqueta do cartão: nas anotações, só quem as altera; nos outros módulos, como antes. */
const podeTirarEtiqueta = (modulo: ModuloComEtiquetas, id: string) => modulo !== 'anotacoes' || alteroAnotacaoDoId(id);

// ---------- pedir para participar (como supabase/migrations/20261118220000_pedidos_de_participacao.sql, #363) ----------
/**
 * Quem está logado vê o item, como a listagem do módulo no banco fictício: contratos e anotações seguem as regras de sempre; tarefas,
 * demandas, processos e compromissos, só com a visualização fechada (SEMPER_FALSO.fecharVisibilidade); sem ela, toda conta vê tudo.
 */
const vejoNoModulo = (modulo: ModuloDaAnotacao, id: string) => !bd.visibilidadeFechada || vejoOItem(modulo, id);
/** Um item de qualquer módulo, num formato só (como privado.item_do_pedido): a equipe são os perfis (no contrato, os das pessoas). */
interface ItemDoPedidoNoFalso {
  id: string; codigo: string; criado_por: string | null; responsavel_id: string; equipe: string[]; arquivado: boolean; grupo: GrupoDoPedido; numero?: string;
  /** Quantos estão na lista, como o banco conta (no contrato, a divisão inteira, mesmo quem não é da equipe). */
  quantos: number;
  /** Quem está logado já vê o item (a busca não o oferece). */
  vejo: () => boolean;
  /**
   * O código basta para quem está logado achar o item. No contrato, cujo código dá para adivinhar, só para quem vê uma demanda ou
   * tarefa ligada a ele, e nunca para o indicador (como public.itens_para_pedir e privado.itens_pelo_codigo).
   */
  achavel: () => boolean;
  /** Quem está logado é o indicador do contrato: não pede (não entra na divisão como participante). */
  souIndicador: () => boolean;
  /** Põe o perfil na coluna do lápis, com o histórico do lápis. */
  por: (perfil: string) => void;
  /** Uma linha no histórico do item. */
  registrar: (alteracoes: Historico['alteracoes']) => void;
}
const linhaDoHistorico = (alteracoes: Historico['alteracoes']) => ({ id: Date.now() + Math.random(), alteracoes, feito_por: eu, em: agora() });
const ITENS_DO_PEDIDO: Record<ModuloDoPedido, () => ItemDoPedidoNoFalso[]> = {
  tarefas: () => bd.tarefas!.map(t => ({ id: t.id, codigo: t.codigo, criado_por: t.criado_por, responsavel_id: t.responsavel_id, equipe: t.participantes, arquivado: !!t.arquivado_em, quantos: t.participantes.length, achavel: () => true, souIndicador: () => false,
    grupo: 'tarefas' as const, vejo: () => vejoNoModulo('tarefas', t.id),
    por: (perfil: string) => { const novos = { participantes: [...t.participantes, perfil] }; historicoTarefa(t, novos); Object.assign(t, novos, { atualizado_em: agora(), atualizado_por: eu }); },
    registrar: (a: Historico['alteracoes']) => { bd.historicoTarefas!.unshift({ ...linhaDoHistorico(a), tarefa_id: t.id }); } })),
  demandas: () => bd.demandas!.map(d => ({ id: d.id, codigo: d.codigo, criado_por: d.criado_por, responsavel_id: d.responsavel_id, equipe: d.colaboradores, arquivado: !!d.arquivado_em, quantos: d.colaboradores.length, achavel: () => true, souIndicador: () => false,
    grupo: 'demandas' as const, vejo: () => vejoNoModulo('demandas', d.id),
    por: (perfil: string) => { const novos = { colaboradores: [...d.colaboradores, perfil] }; historicoDemanda(d, novos); Object.assign(d, novos, { atualizado_em: agora(), atualizado_por: eu }); },
    registrar: (a: Historico['alteracoes']) => { bd.historicoDemandas!.unshift({ ...linhaDoHistorico(a), demanda_id: d.id }); } })),
  processos: () => bd.processos!.map(p => ({ id: p.id, codigo: p.codigo, criado_por: p.criado_por, responsavel_id: p.responsavel_id, equipe: p.colaboradores, arquivado: !!p.arquivado_em, quantos: p.colaboradores.length, achavel: () => true, souIndicador: () => false,
    grupo: GRUPO_DO_TIPO[p.tipo], numero: numeroParaComparar(p.numero ?? ''), vejo: () => vejoNoModulo('processos', p.id),
    por: (perfil: string) => { const novos = { colaboradores: [...p.colaboradores, perfil] }; historicoProcesso(p, novos); Object.assign(p, novos, { atualizado_em: agora(), atualizado_por: eu }); },
    registrar: (a: Historico['alteracoes']) => { bd.historicoProcessos!.unshift({ ...linhaDoHistorico(a), processo_id: p.id }); } })),
  compromissos: () => bd.compromissos!.map(c => ({ id: c.id, codigo: c.codigo, criado_por: c.criado_por, responsavel_id: c.responsavel_id, equipe: c.participantes, arquivado: !!c.arquivado_em, quantos: c.participantes.length, achavel: () => true, souIndicador: () => false,
    grupo: 'compromissos' as const, vejo: () => vejoNoModulo('compromissos', c.id),
    por: (perfil: string) => { const novos = { participantes: [...c.participantes, perfil] }; historicoCompromisso(c, novos); Object.assign(c, novos, { atualizado_em: agora(), atualizado_por: eu }); },
    registrar: (a: Historico['alteracoes']) => { bd.historicoCompromissos!.unshift({ ...linhaDoHistorico(a), compromisso_id: c.id }); } })),
  anotacoes: () => bd.anotacoes!.map(a => ({ id: a.id, codigo: a.codigo, criado_por: a.criado_por, responsavel_id: a.responsavel_id, equipe: a.participantes, arquivado: !!a.arquivado_em, quantos: a.participantes.length, achavel: () => true, souIndicador: () => false,
    grupo: 'anotacoes' as const, vejo: () => vejoAnotacao(a),
    por: (perfil: string) => { const novos = { participantes: [...a.participantes, perfil] }; historicoAnotacao(a, novos); Object.assign(a, novos, { atualizado_em: agora(), atualizado_por: eu }); },
    registrar: (x: Historico['alteracoes']) => { bd.historicoAnotacoes!.unshift({ ...linhaDoHistorico(x), anotacao_id: a.id }); } })),
  contratos: () => bd.contratos!.map(k => ({ id: k.id, codigo: k.codigo, criado_por: k.criado_por, responsavel_id: k.responsavel_id,
    equipe: EQUIPE.filter(m => k.participantes.some(p => p.pessoa_id === m.pessoa_id)).map(m => m.id), arquivado: !!k.arquivado_em,
    quantos: k.participantes.length, grupo: 'contratos' as const, vejo: () => alcancoContrato(k),
    achavel: () => !(k.indicador_id && k.indicador_id === membroLogado().pessoa_id)
      && (bd.demandas!.some(d => d.contrato_id === k.id && vejoNoModulo('demandas', d.id)) || bd.tarefas!.some(t => contratosDaTarefa(t).includes(k.id) && vejoNoModulo('tarefas', t.id))),
    souIndicador: () => !!k.indicador_id && k.indicador_id === membroLogado().pessoa_id,
    por: (perfil: string) => {
      // A trava da divisão (o banco fictício tem o financeiro sempre ligado): com parcelas, mesmo excluídas, só um administrador.
      if (!souAdmin() && bd.parcelas!.some(x => x.contrato_id === k.id)) throw new Error(RECUSA_DO_PEDIDO.travaDaDivisao);
      // Pelas mesmas conferências do lápis (o indicador não entra como participante, por exemplo).
      const novos = ajustarParticipantes({ participantes: [...k.participantes, { pessoa_id: EQUIPE.find(m => m.id === perfil)!.pessoa_id, percentual: 0 }] }, k);
      historicoContrato(k, novos); Object.assign(k, novos, { atualizado_em: agora(), atualizado_por: eu });
    },
    registrar: (a: Historico['alteracoes']) => { bd.historicoContratos!.unshift({ ...linhaDoHistorico(a), contrato_id: k.id }); } }))
};
const MODULOS_DO_PEDIDO = Object.keys(ITENS_DO_PEDIDO) as ModuloDoPedido[];
/** Os grupos da equipe do item, como privado.grupos_do_item (#378). */
const GRUPOS_DO_ITEM: Record<ModuloDoPedido, (id: string) => string[] | undefined> = {
  tarefas: id => bd.tarefas!.find(x => x.id === id)?.grupos,
  demandas: id => bd.demandas!.find(x => x.id === id)?.grupos,
  processos: id => bd.processos!.find(x => x.id === id)?.grupos,
  compromissos: id => bd.compromissos!.find(x => x.id === id)?.grupos,
  contratos: id => bd.contratos!.find(x => x.id === id)?.grupos,
  anotacoes: id => bd.anotacoes!.find(x => x.id === id)?.grupos
};
/** Os integrantes ativos dos grupos do item (como privado.integrantes_dos_grupos): a equipe "efetiva" dos avisos. */
const integrantesDoItem = (modulo: ModuloDoPedido, id: string) => {
  const doItem = GRUPOS_DO_ITEM[modulo](id) ?? [];
  return [...new Set(bd.gruposDaEquipe!.filter(g => doItem.includes(g.id)).flatMap(g => integrantesAtivos(g, EQUIPE).map(m => m.id)))];
};
const itemDoPedido = (modulo: ModuloDoPedido, id: string) => (MODULOS_DO_PEDIDO.includes(modulo) ? ITENS_DO_PEDIDO[modulo]().find(x => x.id === id) : null) ?? null;
/** Como privado.aprovo_o_pedido: um administrador, o responsável ou quem criou. */
const aprovoNoItem = (i: ItemDoPedidoNoFalso) => souAdmin() || eu === i.criado_por || eu === i.responsavel_id;
/** Como privado.aprovadores_do_pedido: os administradores ativos, o responsável e quem criou (se ativos). */
const aprovadoresDoPedido = (i: ItemDoPedidoNoFalso) =>
  EQUIPE.filter(m => m.ativo && !m.reservada && !m.excluido && (['master', 'admin'].includes(m.papel) || m.id === i.criado_por || m.id === i.responsavel_id)).map(m => m.id);
const pedidoPendente = (itemId: string, perfil: string) => bd.pedidos!.find(p => p.item_id === itemId && p.pedido_por === perfil && p.situacao === 'pendente');
/** Como a regra de leitura dos pedidos: quem pediu vê os seus; quem aprova vê os do item. */
const vejoOPedido = (p: PedidoGuardado) => { const i = itemDoPedido(p.modulo, p.item_id); return p.pedido_por === eu || (!!i && aprovoNoItem(i)); };
const minhasMensagensDePedido = () => bd.mensagensDePedido!.filter(m => m.perfil_id === eu && bd.pedidos!.some(p => p.id === m.pedido_id));
function mensagemDePedidoLida(m: NonNullable<Banco['mensagensDePedido']>[number]): Mensagem {
  const p = bd.pedidos!.find(x => x.id === m.pedido_id)!, i = itemDoPedido(p.modulo, p.item_id);
  const processo = p.modulo === 'processos' && i?.vejo() ? bd.processos!.find(x => x.id === p.item_id) : null;
  const { criado_em: _criado, respondido_em: _respondido, ...pedido } = p;
  return { id: m.id, tipo: m.tipo, criado_em: m.criado_em, lido_em: m.lido_em, comentario: null, prazo: null, inclusao: null,
    pedido: vejoOPedido(p) ? { ...pedido, tipo_do_processo: processo?.tipo ?? null } : null };
}
/** Como privado.por_no_item: põe quem pediu no item (lista cheia, quem saiu da equipe e o contrato sem pessoa recusam). */
function porQuemPediu(i: ItemDoPedidoNoFalso, modulo: ModuloDoPedido, perfil: string) {
  const membro = EQUIPE.find(m => m.id === perfil);
  if (!membro?.ativo || membro.excluido) throw new Error(RECUSA_DO_PEDIDO.inativo);
  if (modulo === 'contratos' && !membro.pessoa_id) throw new Error(RECUSA_DO_PEDIDO.semPessoaParaOContrato);
  if (i.equipe.includes(perfil) || i.responsavel_id === perfil) return;
  if (i.quantos >= LISTA_CHEIA[modulo].maximo) throw new Error(LISTA_CHEIA[modulo].aviso);
  i.por(perfil);
}
// ---------- aviso de quem entra num item (como supabase/migrations/20261119193326_aviso_ao_ser_incluido.sql, #377) ----------
/** A equipe do item como está agora (como privado.item_do_pedido): o responsável e os perfis (no contrato, os das pessoas). */
const equipeDoItemNoFalso = (modulo: ModuloDoPedido, id: string): EquipeDoItem | null => {
  const i = itemDoPedido(modulo, id);
  return i && { responsavel_id: i.responsavel_id, equipe: [...new Set([...i.equipe, ...integrantesDoItem(modulo, id)])] };
};
/** Quem recebe o aviso: ativo, sem a conta reservada e sem quem foi excluído (como a ligação com perfis no banco). */
const recebeAviso = (perfil: string) => EQUIPE.some(m => m.id === perfil && m.ativo && !m.reservada && !m.excluido);
/**
 * Como os gatilhos aviso_de_inclusao: compara a equipe de antes (null: o item é novo) com a de agora e, para cada pessoa cujo papel
 * mudou, acerta os avisos pela sequência de mudanças (avisoDaMudanca, como privado.mudancas_na_equipe): os da sequência que ela não
 * leu e que não valem mais saem (o desfazer); o que vale é criado se ela ainda não tem um dele na sequência, e entrar de novo depois
 * renova o antigo. Só as funções em que a pessoa grava o item chamam (como o "when current_user = 'authenticated'" do banco):
 * as criações automáticas, a aprovação do pedido (por) e entrar ou sair sozinho não chamam.
 */
function avisarInclusao(modulo: ModuloDoPedido, id: string, antes: EquipeDoItem | null) {
  const depois = equipeDoItemNoFalso(modulo, id);
  if (!depois) return;
  const agoraMs = Date.now();
  // As sequências que acabaram não contam mais (como o delete do começo da função no banco).
  bd.mudancasNaEquipe = bd.mudancasNaEquipe!.filter(s => agoraMs - s.em < AVISO_DESFEITO);
  for (const mudanca of mudancasDaEquipe(antes, depois)) {
    const daPessoa = (s: { perfil_id: string; item_id: string }) => s.perfil_id === mudanca.perfil && s.item_id === id;
    const { sequencia, aviso } = avisoDaMudanca(mudanca, bd.mudancasNaEquipe.find(daPessoa), agoraMs);
    bd.mudancasNaEquipe = [...bd.mudancasNaEquipe.filter(s => !daPessoa(s)), { perfil_id: mudanca.perfil, item_id: id, ...sequencia }];
    const daSequencia = (m: MensagemDeInclusaoGuardada) => daPessoa(m) && Date.parse(m.criado_em) >= sequencia.desde;
    bd.mensagensDeInclusao = bd.mensagensDeInclusao!.filter(m => !(daSequencia(m) && !m.lido_em && m.entrou_como !== aviso));
    if (!aviso || mudanca.perfil === eu || !recebeAviso(mudanca.perfil) || bd.mensagensDeInclusao.some(m => daSequencia(m) && m.entrou_como === aviso)) continue;
    const ja = bd.mensagensDeInclusao.find(m => daPessoa(m) && m.entrou_como === aviso);
    const grupo_id = grupoDoAviso(modulo, id, mudanca.perfil);
    if (ja) Object.assign(ja, { criado_em: agora(), lido_em: null, incluido_por: eu, grupo_id });
    else bd.mensagensDeInclusao.push({ id: novoId(), perfil_id: mudanca.perfil, incluido_por: eu, modulo, item_id: id, entrou_como: aviso, criado_em: agora(), lido_em: null, grupo_id });
  }
}
/**
 * Como a marca do grupo nos avisos de inclusão (#378): quem não está no item por conta própria entrou pelo primeiro grupo do item
 * que o tem, em ordem de nome; quem está por conta própria, por nenhum (null).
 */
function grupoDoAviso(modulo: ModuloDoPedido, id: string, perfil: string) {
  const i = itemDoPedido(modulo, id);
  if (!i || i.responsavel_id === perfil || i.equipe.includes(perfil)) return null;
  const doItem = GRUPOS_DO_ITEM[modulo](id) ?? [];
  return bd.gruposDaEquipe!.filter(g => doItem.includes(g.id) && g.integrantes.includes(perfil))
    .toSorted((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))[0]?.id ?? null;
}
/** Como a regra de leitura de mensagens_de_grupo (#378): cada um lê as suas; o grupo excluído leva as dele (a chave estrangeira). */
const minhasMensagensDeGrupo = () => bd.mensagensDeGrupo!.filter(m => m.perfil_id === eu && bd.gruposDaEquipe!.some(g => g.id === m.grupo_id));
function mensagemDeGrupoLida(m: NonNullable<Banco['mensagensDeGrupo']>[number]): Mensagem {
  const g = bd.gruposDaEquipe!.find(x => x.id === m.grupo_id)!;
  return { id: m.id, tipo: 'grupo', criado_em: m.criado_em, lido_em: m.lido_em, comentario: null, prazo: null, pedido: null, inclusao: null,
    grupo: { grupo_id: g.id, nome: g.nome, incluido_por: m.incluido_por } };
}
/** O item apagado leva os avisos dele (a chave estrangeira do banco). */
const minhasMensagensDeInclusao = () => bd.mensagensDeInclusao!.filter(m => m.perfil_id === eu && !!itemDoPedido(m.modulo, m.item_id));
/** O item de cada módulo, como a ligação do banco o traz. */
const ITEM_DA_INCLUSAO_NO_FALSO: Record<ModuloDoPedido, (id: string) => ItemDaInclusao | null> = {
  tarefas: id => { const t = bd.tarefas!.find(x => x.id === id); return t ? { id, codigo: t.codigo, nome: t.titulo, tipo_do_processo: null } : null; },
  demandas: id => { const d = bd.demandas!.find(x => x.id === id); return d ? { id, codigo: d.codigo, nome: d.titulo, tipo_do_processo: null } : null; },
  processos: id => { const p = bd.processos!.find(x => x.id === id); return p ? { id, codigo: p.codigo, nome: p.titulo || p.numero, tipo_do_processo: p.tipo } : null; },
  compromissos: id => {
    const c = bd.compromissos!.find(x => x.id === id);
    return c ? { id, codigo: c.codigo, nome: nomeDoCompromisso({ tipo: c.tipo, titulo: c.titulo, pessoa_nome: nomesDosClientes(c.pessoas), processo_numero: c.processo_numero }), tipo_do_processo: null } : null;
  },
  anotacoes: id => { const a = bd.anotacoes!.find(x => x.id === id); return a ? { id, codigo: a.codigo, nome: a.titulo, tipo_do_processo: null } : null; },
  contratos: id => { const k = bd.contratos!.find(x => x.id === id); return k ? { id, codigo: k.codigo, nome: k.servico, tipo_do_processo: null } : null; }
};
/**
 * Como public.ainda_faz_parte e a ligação com o item: o item só vem enquanto quem está logado é o responsável ou está na equipe, e o
 * vê. Ver por outro caminho (a chave da equipe, ser administrador, ter criado) não conta.
 */
function mensagemDeInclusaoLida(m: MensagemDeInclusaoGuardada): Mensagem {
  const i = itemDoPedido(m.modulo, m.item_id)!, fazParte = i.responsavel_id === eu || i.equipe.includes(eu) || integrantesDoItem(m.modulo, m.item_id).includes(eu);
  return { id: m.id, tipo: 'inclusao', criado_em: m.criado_em, lido_em: m.lido_em, comentario: null, prazo: null, pedido: null,
    inclusao: { modulo: m.modulo, entrou_como: m.entrou_como, incluido_por: m.incluido_por, item: fazParte && i.vejo() ? ITEM_DA_INCLUSAO_NO_FALSO[m.modulo](m.item_id) : null,
      grupo: bd.gruposDaEquipe!.find(g => g.id === m.grupo_id)?.nome ?? null } };
}
/** Como o gatilho preparar e as regras check da migração: confere só quem está entrando na equipe da anotação. */
function prepararAnotacao(dados: DadosAnotacao, atual?: Anotacao): DadosAnotacao {
  const d: DadosAnotacao = { ...dados };
  if (d.grupos !== undefined) d.grupos = gruposAoGravar(d.grupos, atual?.grupos);
  if (d.titulo !== undefined) d.titulo = (d.titulo ?? '').trim();
  if (d.texto !== undefined) d.texto = d.texto ?? '';
  const ativo = (id: string | undefined) => EQUIPE.some(m => m.id === id && m.ativo && !m.excluido);
  const responsavel = d.responsavel_id ?? atual?.responsavel_id;
  if ((!atual || (d.responsavel_id !== undefined && d.responsavel_id !== atual.responsavel_id)) && !ativo(responsavel)) {
    throw new Error('O responsável precisa ser alguém da equipe do escritório.');
  }
  if (d.participantes !== undefined || d.responsavel_id !== undefined) {
    const lista = [...new Set((d.participantes ?? atual?.participantes ?? []).filter(Boolean))].filter(id => id !== responsavel);
    if (lista.some(id => !atual?.participantes.includes(id) && !ativo(id))) throw new Error('O participante precisa ser alguém da equipe do escritório.');
    if (lista.length > COLABORADORES_MAXIMOS) throw new Error(FORMATO_INVALIDO);
    d.participantes = lista;
  }
  // Como a chave estrangeira anotacoes_pasta_fkey: a pasta existe neste escritório (apagada por um colega, erros.ts diz que sumiu).
  if (d.pasta_id && !bd.pastas!.some(x => x.id === d.pasta_id)) throw new Error(PASTA_SUMIU);
  const fica = { ...atual, ...d };
  if (!fica.titulo || fica.titulo.length > TAMANHO_ANOTACAO.titulo || (fica.texto ?? '').length > TAMANHO_ANOTACAO.texto) throw new Error(FORMATO_INVALIDO);
  return d;
}
/** Como o gatilho do histórico: o que mudou, com os nomes da equipe; o texto entra sem o conteúdo (a tela mostra "Texto alterado"). */
const HISTORICO_DO_CAMPO_DA_ANOTACAO: Record<string, (de: unknown, para: unknown) => Historico['alteracoes'][string]> = {
  texto: () => ({ de: null, para: null }),
  responsavel_id: (de, para) => ({ de: EQUIPE.find(m => m.id === de)?.nome ?? null, para: EQUIPE.find(m => m.id === para)?.nome ?? null }),
  participantes: (de, para) => ({ de: nomesDosMembros(de as string[]), para: nomesDosMembros(para as string[]) }),
  grupos: (de, para) => ({ de: nomesDosGrupos(de), para: nomesDosGrupos(para) }),
  // Como privado.caminho_da_pasta: o caminho, e não o id (#342).
  pasta_id: (de, para) => ({ de: textoDoCaminho(bd.pastas!, de as string | null) || null, para: textoDoCaminho(bd.pastas!, para as string | null) || null })
};
/** Como privado.nomes_da_equipe: os nomes juntos, na ordem; sem ninguém, null. */
const nomesDosMembros = (ids: string[]) => ids.length ? ids.map(id => EQUIPE.find(m => m.id === id)?.nome ?? 'usuário removido').join(', ') : null;
function historicoAnotacao(a: Anotacao, dados: Record<string, unknown>) {
  const atual = a as unknown as Record<string, unknown>, alt: Historico['alteracoes'] = {};
  Object.entries(dados).forEach(([campo, v]) => {
    if (campo === 'arquivado_por' || JSON.stringify(atual[campo] ?? null) === JSON.stringify(v ?? null)) return;
    alt[campo] = (HISTORICO_DO_CAMPO_DA_ANOTACAO[campo] ?? ((de, para) => ({ de, para })))(atual[campo] ?? null, v ?? null);
  });
  if (Object.keys(alt).length) bd.historicoAnotacoes!.unshift({ id: Date.now() + Math.random(), anotacao_id: a.id, alteracoes: alt, feito_por: eu, em: agora() });
}
/** Como o gatilho ligada_a: a lista dos módulos ligados, em ordem e sem repetir (não conta como alteração da anotação). */
const refazerLigadaA = (id: string) => {
  const a = bd.anotacoes!.find(x => x.id === id);
  if (a) a.ligada_a = modulosLigados(ligacoesDaAnotacao(id).map(l => l.modulo));
};
/** Como o gatilho e as regras de ligar do banco, na mesma ordem: o item existe; repetido não faz nada; até ITENS_DA_ANOTACAO; e quem liga altera a anotação e vê o item. */
function ligarNaAnotacaoFalsa(a: Anotacao, modulo: ModuloDaAnotacao, itemId: string): boolean {
  if (!ITEM_NO_FALSO[modulo](itemId)) throw new Error('Item não encontrado neste escritório.');
  const pode = ligaNaAnotacao(a, membroLogado(), chavesDaEquipe(), meusGruposNoFalso());
  const ligacoes = ligacoesDaAnotacao(a.id);
  if (pode && ligacoes.some(l => l.modulo === modulo && l.item_id === itemId)) return false;
  if (ligacoes.length >= ITENS_DA_ANOTACAO) throw new Error(`Uma anotação pode ser ligada a no máximo ${ITENS_DA_ANOTACAO} itens.`);
  if (!pode || !vejoOItem(modulo, itemId)) throw new Error(SEM_PERMISSAO);
  bd.anotacaoLigacoes!.push({ anotacao_id: a.id, modulo, item_id: itemId, criado_por: eu, criado_em: agora() });
  refazerLigadaA(a.id);
  return true;
}
/** Como o on delete cascade das ligações: o item excluído sai das anotações, e a lista dos módulos ligados é refeita. */
function soltarDasAnotacoes(modulo: ModuloDaAnotacao, itemId: string) {
  const saem = (bd.anotacaoLigacoes ?? []).filter(l => l.modulo === modulo && l.item_id === itemId);
  if (!saem.length) return;
  bd.anotacaoLigacoes = bd.anotacaoLigacoes!.filter(l => !saem.includes(l));
  saem.forEach(l => refazerLigadaA(l.anotacao_id));
}
const anotacaoLista = (a: Anotacao): AnotacaoLista => comEtq('anotacoes', (x: Anotacao) => ({
  id: x.id, codigo: x.codigo, titulo: x.titulo, responsavel_id: x.responsavel_id, participantes: x.participantes, grupos: x.grupos ?? [], ligada_a: x.ligada_a,
  pasta_id: x.pasta_id ?? null, criado_por: x.criado_por, criado_em: x.criado_em, atualizado_em: x.atualizado_em, arquivado_em: x.arquivado_em
}))(a);
const anotacaoLigada = (a: Anotacao): AnotacaoLigada => ({
  id: a.id, codigo: a.codigo, titulo: a.titulo, criado_por: a.criado_por, criado_em: a.criado_em, atualizado_em: a.atualizado_em, arquivado_em: a.arquivado_em
});
const anotacaoLigadaComTexto = (a: Anotacao): AnotacaoLigadaComTexto => ({ ...anotacaoLigada(a), texto: a.texto });
/** As anotações ligadas ao item que quem está logado vê, as atualizadas mais recentemente primeiro (com e sem o texto, #360). */
const anotacoesLigadasAoItem = (modulo: ModuloDaAnotacao, itemId: string) => bd.anotacoes!
  .filter(a => vejoAnotacao(a) && ligacoesDaAnotacao(a.id).some(l => l.modulo === modulo && l.item_id === itemId))
  .sort(ORDENS_ANOTACAO.recentes).slice(0, ANOTACOES_LIGADAS);
// Como a coluna "busca" do banco: o código, o título e o texto, sem acento.
const buscaAnotacao = (a: Anotacao) => normal([a.codigo, a.titulo, a.texto].join(' '));
function filtrarAnotacoes(f: FiltroAnotacoes = {}) {
  // Um número com pontuação (CNJ, CPF) vira só os dígitos, mas o texto da anotação o guarda como foi escrito: busca as duas formas.
  const t = termo(f.termo), escrito = normal(f.termo), achou = (a: Anotacao) => buscaAnotacao(a).includes(t) || buscaAnotacao(a).includes(escrito);
  return bd.anotacoes!.filter(a => vejoAnotacao(a) && (f.situacao === 'arquivadas' ? a.arquivado_em : !a.arquivado_em)
    && (!f.ligadaA || (f.ligadaA === 'nenhum' ? !a.ligada_a.length : a.ligada_a.includes(f.ligadaA)))
    && (!f.autor || a.criado_por === f.autor)
    && (!f.desde || a.criado_em >= f.desde)
    && (!f.pastas || (!!a.pasta_id && f.pastas.includes(a.pasta_id)))
    && (!f.etiqueta || temEtiqueta('anotacoes', a.id, f.etiqueta))
    && (!t || achou(a)));
}
// Não há quadro: a ordem manual é a das atualizadas por último (como em supabase.ts).
const ORDENS_ANOTACAO: Record<Ordem, (a: Anotacao, b: Anotacao) => number> = {
  manual: (a, b) => b.atualizado_em.localeCompare(a.atualizado_em),
  nome: (a, b) => a.titulo.localeCompare(b.titulo),
  nome_desc: (a, b) => b.titulo.localeCompare(a.titulo),
  novos: (a, b) => b.criado_em.localeCompare(a.criado_em),
  antigos: (a, b) => a.criado_em.localeCompare(b.criado_em),
  recentes: (a, b) => b.atualizado_em.localeCompare(a.atualizado_em)
};
/** A anotação sai com as ligações e o histórico dela (on delete cascade). */
function apagarAnotacao(a: Anotacao) {
  bd.anotacoes = bd.anotacoes!.filter(x => x.id !== a.id);
  bd.anotacaoLigacoes = bd.anotacaoLigacoes!.filter(l => l.anotacao_id !== a.id);
  bd.historicoAnotacoes = bd.historicoAnotacoes!.filter(h => h.anotacao_id !== a.id);
  bd.etiquetasAplicadas = bd.etiquetasAplicadas!.filter(x => !(x.modulo === 'anotacoes' && x.cartao_id === a.id));
  // Os comentários vão junto, e com eles as mensagens das menções (minhasMensagens só conta as de comentário que existe).
  bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'anotacoes' && c.cartao_id === a.id));
  auditar('anotacoes', 'exclusao', { id: a.id, codigo: a.codigo });
}
/**
 * Os itens que cada módulo oferece para ligar: a listagem do módulo, pela busca (como em supabase.ts). Aqui vem a listagem inteira:
 * no banco fictício ela ainda mostra tudo, e o corte em ITENS_PARA_LIGAR só vem depois de tirar o que a pessoa não vê (no banco,
 * a regra de leitura filtra antes do limite).
 */
const TODOS = { porPagina: Number.MAX_SAFE_INTEGER };
const PARA_LIGAR: Record<ModuloDaAnotacao, (termo: string) => Promise<ItemDaAnotacao[]>> = {
  pessoas: async termo => (await SD.pessoasListar({ termo, ...TODOS })).linhas.map(x => itemDaAnotacao('pessoas', x)),
  processos: async termo => (await SD.processosParaLigar(termo)).map(x => itemDaAnotacao('processos', { ...x, arquivado_em: null })),
  contratos: async termo => (await SD.contratosListar({ termo, ...TODOS })).linhas.map(x => itemDaAnotacao('contratos', x)),
  demandas: async termo => (await SD.demandasListar({ termo, ...TODOS })).linhas.map(x => itemDaAnotacao('demandas', x)),
  tarefas: async termo => (await SD.tarefasListar({ termo, ...TODOS })).linhas.map(x => itemDaAnotacao('tarefas', x)),
  compromissos: async termo => (await SD.compromissosListar({ termo, ...TODOS })).linhas.map(x => itemDaAnotacao('compromissos', x))
};

// ---------- ligar a um cartão um item que já existe (#341, etapa 2; como em supabase.ts) ----------
/** Como a regra de alterar do banco nas buscas para ligar: quem está no item e, na fase de adaptação, toda a equipe. */
const alteroNoFalso = (estaNele: boolean) => !!bd.equipeEditaTudo || estaNele;
/** Como privado.estou_na_demanda_do_id (#310): quem está logado altera a demanda; com `ativa`, só se ela não está arquivada. */
const estouNaDemandaDoId = (id: string, ativa: boolean) => {
  const d = bd.demandas!.find(x => x.id === id);
  return !!d && (!ativa || !d.arquivado_em) && alteroNoFalso(estaNaDemanda(d, membroLogado(), meusGruposNoFalso()));
};
/** O que cada busca para ligar sabe do seu módulo: quem altera, o texto da busca, a lista de pessoas e as ligações de um só. */
interface ModuloParaLigar<T> { altero: (x: T) => boolean; busca: (x: T) => string; pessoas?: (x: T) => string[]; sem?: Partial<Record<LigacaoDeUmSo, (x: T) => string | null>> }
/** Como paraLigar, em supabase.ts: só os ativos que quem lê altera, pela busca, fora os já ligados e os que já têm a pessoa, os mais novos primeiro. */
function paraLigarNoFalso<T extends { id: string; arquivado_em: string | null; criado_em: string }>(lista: T[], f: FiltroParaLigar<LigacaoDeUmSo>, m: ModuloParaLigar<T>) {
  const t = termo(f.termo), fora = new Set(f.fora ?? []), sem = f.sem && m.sem?.[f.sem];
  return lista.filter(x => !x.arquivado_em && m.altero(x) && !fora.has(x.id) && !sem?.(x)
    && (!f.semAPessoa || !m.pessoas?.(x).includes(f.semAPessoa))
    && (!t || m.busca(x).includes(t)))
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em) || a.id.localeCompare(b.id)).slice(0, ITENS_PARA_LIGAR);
}

// ---------- andamentos e prazos do processo ----------
const tarefaLigadaA = (id: string | null): TarefaDoAcompanhamento => {
  const t = id ? bd.tarefas!.find(x => x.id === id) : null;
  return t ? { id: t.id, codigo: t.codigo } : null;
};
/** Como o banco devolve: com a tarefa ligada e sem a coluna de exclusão (a tela não lê). */
const comTarefa = <T extends { tarefa_id: string | null; excluido_em: string | null }>({ excluido_em: _excluido, ...item }: T) => ({ ...item, tarefa: tarefaLigadaA(item.tarefa_id) });
const SEM_MUDANCA = 'Não foi possível: o processo pode ter sido arquivado, ou isto já foi excluído. Abra o cartão de novo.';
const SEM_PERMISSAO = 'Você não tem permissão para fazer isso.';
/** O que o banco diz quando uma chave estrangeira recusa sem uma mensagem própria (erros.ts). */
const NAO_DEU = 'Não foi possível concluir agora. Tente de novo.';
// ---------- caixa ----------
const semOExcluido = ({ excluido_em: _e, ...l }: LancamentoGuardado): Lancamento => l;
const CATEGORIAS_DE_ENTRADA = ['recebimento', 'outra_entrada', 'ajuste_a_mais'], CATEGORIAS_DE_SAIDA = ['despesa', 'das', 'repasse', 'indicacao', 'divisao_lucro', 'ajuste_a_menos', 'correcao_recebimento'];
/** Como as regras check e o gatilho do banco. */
function conferirLancamento(l: LancamentoGuardado) {
  l.descricao = l.descricao.trim();
  const conta = bd.contasFinanceiras!.find(c => c.id === l.conta_id);
  if (!conta) throw new Error('Conta não encontrada neste escritório.');
  if (!Number.isInteger(l.valor) || l.valor <= 0 || l.valor > VALOR_MAXIMO_DO_LANCAMENTO || !l.descricao || l.descricao.length > TAMANHO_FINANCEIRO.descricao || !dataExiste(l.data) || !anoAceito(l.data)) throw new Error(FORMATO_INVALIDO);
  const servePara = l.categoria === 'transferencia' || (l.tipo === 'entrada' ? CATEGORIAS_DE_ENTRADA : CATEGORIAS_DE_SAIDA).includes(l.categoria);
  if (!servePara) throw new Error(FORMATO_INVALIDO);
  return conta;
}
function conferirContaEData(l: LancamentoGuardado) {
  const conta = conferirLancamento(l);
  if (conta.arquivada_em) throw new Error('Esta conta está arquivada.');
  if (l.data < conta.saldo_inicial_em) throw new Error('Esta data é anterior ao saldo inicial da conta.');
}
function historicoDoLancamento(l: LancamentoGuardado, novo: Partial<LancamentoGuardado>) {
  const alteracoes: Historico['alteracoes'] = {};
  for (const k of ['conta_id', 'data', 'tipo', 'categoria', 'valor', 'descricao', 'excluido_em'] as const) {
    if (novo[k] === undefined || novo[k] === l[k]) continue;
    const nomeDaConta = (id: unknown) => bd.contasFinanceiras!.find(c => c.id === id)?.nome ?? null;
    if (k === 'conta_id') alteracoes.conta = { de: nomeDaConta(l[k]), para: nomeDaConta(novo[k]) };
    else alteracoes[k] = { de: l[k], para: novo[k] };
  }
  if (Object.keys(alteracoes).length) bd.historicoLancamentos!.unshift({ id: Date.now() + Math.random(), lancamento_id: l.id, alteracoes, feito_por: eu, em: agora() });
}
const SEM_ACESSO_AO_CAIXA = 'Não foi possível: atualize a página e confira.';
const LANCAMENTO_DE_ORIGEM = 'Este lançamento nasceu de um recebimento, de um repasse ou de uma divisão de lucro: desfaça por lá.';
const SEM_PARTE_NA_CONTA = 'O contrato não diz quanto vai para a conta da empresa. Preencha em "Atualizar contrato".';
const SOCIO_NO_PERIODO = 'Esta pessoa já é sócia nesse período.';
const CATEGORIA_DO_REPASSE: Record<Repasse['tipo'], CategoriaDeLancamento> = { responsavel: 'repasse', socio_indicador: 'indicacao' };
const semExcluida = ({ excluido_em: _e, ...p }: ParcelaGuardada): Parcela => p;
function acharParcela(id: string) {
  const p = bd.parcelas!.find(x => x.id === id);
  if (!p) throw new Error('Só o responsável pelo contrato ou um administrador registra o recebimento.');
  return p;
}
/** Como privado.recebimento_do_terceiro. As contas que recebem aqui são sempre o master, que cuida de todos os contratos. */
const pessoaDoResponsavel = (r: Pick<RecebimentoGuardado, 'responsavel_id'>) => EQUIPE.find(m => m.id === r.responsavel_id)?.pessoa_id;
const nomeDoResponsavel = (r: Pick<RecebimentoGuardado, 'responsavel_id'>) => EQUIPE.find(m => m.id === r.responsavel_id)?.nome ?? 'Usuário removido';
/** Quem recebeu o dinheiro ou um administrador (como privado.marco_o_que_recebi). */
const marcoOQueRecebi = (r: Pick<RecebimentoGuardado, 'responsavel_id'>) => souAdmin() || r.responsavel_id === eu;
function recebimentoDoTerceiro(recebimento: string, pessoa: string) {
  const r = bd.recebimentos!.find(x => x.id === recebimento);
  if (!r || !marcoOQueRecebi(r)) throw new Error('Só quem recebeu o dinheiro ou um administrador marca este valor como pago.');
  if (r.estornado_em) throw new Error('Este recebimento foi estornado.');
  if (pessoa === pessoaDoResponsavel(r) || !r.terceiros.some(t => t.id === pessoa && t.valor > 0)) throw new Error('Esta pessoa não recebe nada deste recebimento.');
  return r;
}
/** O que o registro de ações guarda da marcação de pago, como o gatilho do banco (privado.auditar_terceiro_pago). */
const auditarMarcacao = (acao: string, r: RecebimentoGuardado, pessoa: string, pagoEm: string) => auditar('financeiro_terceiros_pagos', acao, { id: pessoa, codigo: bd.contratos!.find(k => k.id === r.contrato_id)?.codigo }, {
  parcela: bd.parcelas!.find(p => p.id === r.parcela_id)?.numero, recebimento: r.id, pago_em: pagoEm, valor: r.terceiros.find(t => t.id === pessoa)?.valor
});
const nomeDoSocio = (id: string) => bd.pessoas.find(p => p.id === id)?.nome ?? 'Pessoa excluída';
const socioLido = ({ excluido_em: _e, ...s }: SocioGuardado): Socio => ({ ...s, nome: nomeDoSocio(s.pessoa_id) });
/** Como privado.socio_do_recebimento: o recebimento guarda de qual sócio ele é. */
function socioDoRecebimento(k: ContratoGuardado, responsavelSocio: boolean) {
  const pessoa = responsavelSocio ? EQUIPE.find(m => m.id === k.responsavel_id)?.pessoa_id ?? null : null;
  return { socio_pessoa_id: pessoa, socio_nome: pessoa ? nomeDoSocio(pessoa) : null };
}
const partesDe = (k: ContratoGuardado, data: string) => partesDoRecebimento(k, bd.socios!.filter(s => !s.excluido_em), EQUIPE.find(m => m.id === k.responsavel_id)?.pessoa_id, data, nomeDoSocio);
function parcelaDoEscritorio(p: ParcelaGuardada): ParcelaDoEscritorio {
  const k = bd.contratos!.find(x => x.id === p.contrato_id);
  return { ...semExcluida(p), contrato_codigo: k?.codigo ?? '', cliente_nome: k ? nomesDosClientes(k.clientes) : '', responsavel_id: k?.responsavel_id ?? null, total_parcelas: k?.parcelas ?? null };
}
/** O contrato arquivado sai das listas, mas o que já foi recebido continua contando. */
const naLista = (p: ParcelaGuardada) => !!p.recebida_em || !bd.contratos!.find(k => k.id === p.contrato_id)?.arquivado_em;
const ajusteDoSocio = (s: SocioGuardado, de: string | null, para: string | null) => registrarAjuste({ ['Sócio: ' + nomeDoSocio(s.pessoa_id)]: { de, para } });
const registrarAjuste = (alteracoes: Historico['alteracoes']) => { bd.ajustesFinanceiros!.unshift({ id: Date.now() + Math.random(), alteracoes, feito_por: eu, em: agora() }); };
/** Como as regras check da conta. */
function conferirConta(c: Pick<ContaFinanceira, 'nome' | 'saldo_inicial' | 'saldo_inicial_em'>) {
  if (!c.nome.trim() || c.nome.trim().length > TAMANHO_FINANCEIRO.nomeDaConta || !dataExiste(c.saldo_inicial_em) || !anoAceito(c.saldo_inicial_em) || !Number.isInteger(c.saldo_inicial) || Math.abs(c.saldo_inicial) > VALOR_MAXIMO_DO_LANCAMENTO) throw new Error(FORMATO_INVALIDO);
}
function novoLancamento(dados: DadosLancamento & { par_id?: string | null; origem?: Lancamento['origem'] }) {
  const l: LancamentoGuardado = { par_id: null, origem: null, ...dados, id: novoId(), excluido_em: null, criado_por: eu, criado_em: agora(), atualizado_em: agora() };
  conferirContaEData(l);
  return l;
}
const TAREFA_JA_LIGADA = 'Já existe uma tarefa ligada a este item.';
const processoAtivo = (id: string) => bd.processos!.some(p => p.id === id && !p.arquivado_em);
/** O processo como aparece no cartão da demanda e no do contrato. */
const processoNoCartao = (p: ProcessoGuardado): ProcessoLigado => ({ id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo,
  cliente_nome: nomesDosClientes(p.clientes), etapa_id: p.etapa_id, arquivado_em: p.arquivado_em, criado_em: p.criado_em, papeis: [] });
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
  // O tipo da lista pronta (#362): vazio, ou um da lista que combina com o tipo de sempre (as duas regras check do banco).
  if (a.categoria && (!(a.categoria in CATEGORIAS_DE_ANDAMENTO) || !categoriaCombina(a))) throw new Error(FORMATO_INVALIDO);
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
type ParteGuardada = NonNullable<Banco['processoPartes']>[number];
/** A pessoa com papel como o cartão a mostra (#316). */
const parteNoCartao = (x: ParteGuardada): ParteDoProcesso => ({ id: x.id, processo_id: x.processo_id, papel: x.papel, pessoa: resumoDe(x.pessoa_id)! });
/** Como o gatilho historico de processo_partes: quem entrou (para) ou saiu (de), com o nome e o papel. */
function historicoDaParte(x: ParteGuardada, lado: 'de' | 'para') {
  const parte = { pessoa_id: x.pessoa_id, nome: resumoDe(x.pessoa_id)?.nome ?? null, papel: x.papel };
  bd.historicoProcessos!.unshift({ id: Date.now() + Math.random(), processo_id: x.processo_id, feito_por: eu, em: agora(),
    alteracoes: { partes: lado === 'para' ? { de: null, para: parte } : { de: parte, para: null } } });
}
/** LGPD, como o gatilho esquecer_nas_partes: a pessoa excluída sai das entradas de papel do histórico. */
function esquecerNasPartes(pessoaId: string) {
  for (const h of bd.historicoProcessos!) {
    const a = h.alteracoes.partes as { de: Record<string, unknown> | null; para: Record<string, unknown> | null } | undefined;
    if (!a) continue;
    for (const lado of ['de', 'para'] as const) {
      const v = a[lado];
      if (v?.pessoa_id === pessoaId) { const { pessoa_id: _sai, ...resto } = v; a[lado] = { ...resto, nome: 'pessoa excluída' }; }
    }
  }
}
/** Como o gatilho conferir_origem e a regra processos_origem_com_ligacao: a origem é um processo que quem cria vê, e diz a ligação. */
function conferirOrigemDoProcesso(d: DadosProcesso) {
  if (!d.origem_id) return;
  if (!d.ligacao || !(d.ligacao in LIGACOES)) throw new Error(FORMATO_INVALIDO);
  if (!bd.processos!.some(p => p.id === d.origem_id && vejoNoModulo('processos', p.id))) throw new Error('O processo de origem não foi encontrado neste escritório.');
}
const processoCompleto =(p: ProcessoGuardado): Processo => ({ ...PI_VAZIA, ...p, clientes: p.clientes.map(id => resumoDe(id)!), cliente_nome: nomesDosClientes(p.clientes) });
const processoLista = (p: ProcessoGuardado): ProcessoLista => ({
  id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, responsavel_id: p.responsavel_id, colaboradores: p.colaboradores, grupos: p.grupos ?? [], cliente_nome: nomesDosClientes(p.clientes),
  orgao: p.orgao, comarca: p.comarca, vara: p.vara, etapa_id: p.etapa_id, etapa_ordem: p.etapa_ordem, arquivado_em: p.arquivado_em, criado_por: p.criado_por, criado_em: p.criado_em, atualizado_em: p.atualizado_em
});
const buscaProcesso = (p: ProcessoGuardado) => normal([p.codigo, p.numero, p.numero.replace(/\D/g, ''), p.titulo, nomesDosClientes(p.clientes), p.orgao, p.comarca, p.vara].join(' '));
function filtrarProcessos(f: FiltroProcessos) {
  const t = termo(f.termo);
  return bd.processos!.filter(p => p.tipo === f.tipo && vejoNoModulo('processos', p.id) && (f.situacao === 'arquivados' ? p.arquivado_em : !p.arquivado_em)
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
  // O processo guardado antes da #317 ganha os campos de PI vazios, como a migração faz (o histórico não vê mudança onde não houve).
  for (const [campo, vazio] of Object.entries(PI_VAZIA)) if (!(campo in p)) (p as Record<string, unknown>)[campo] = vazio;
  return p;
};
/** Como a regra da migração: a coluna precisa ser do quadro do tipo do processo. */
function conferirQuadroDoProcesso(tipo: TipoProcesso, etapaId: string | null | undefined) {
  if (etapaId && bd.colunas.find(c => c.id === etapaId)?.modulo !== TIPOS_PROCESSO[tipo].quadro) throw new Error('Você não tem permissão para fazer isso.');
}
/** Como o gatilho preparar e o índice de número único da migração. */
function prepararProcesso(dados: DadosProcesso, tipo: TipoProcesso, atual?: ProcessoGuardado): DadosProcesso {
  const d: DadosProcesso = { ...dados };
  conferirProtecao(d, atual);
  if (d.grupos !== undefined) d.grupos = gruposAoGravar(d.grupos, atual?.grupos);
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
/** Os campos de propriedade intelectual vazios (#317), como nascem no banco. */
const PI_VAZIA = { protecao: null, deposito: null, concessao: null, publicacao: null, criacao: null, apresentacao_marca: null, natureza_marca: null,
  classes_nice: [] as number[], especificacao: null, variacoes: null, linguagem: null };
/** As regras check da migração propriedade_intelectual (#317): as listas, as classes de 1 a 45, os tamanhos e a concessão depois do depósito. */
function conferirProtecao(d: DadosProcesso, atual?: ProcessoGuardado) {
  const naLista = (v: string | null | undefined, lista: object) => v === undefined || v === null || Object.hasOwn(lista, v);
  const ateTamanho = (v: string | null | undefined, max: number) => !v || v.length <= max;
  const classes = d.classes_nice;
  const valido = naLista(d.protecao, TIPOS_DE_PROTECAO) && naLista(d.apresentacao_marca, APRESENTACOES_DA_MARCA) && naLista(d.natureza_marca, NATUREZAS_DA_MARCA)
    && (classes === undefined || (classes.length <= CLASSE_NICE_MAIOR && classes.every(n => Number.isInteger(n) && n >= 1 && n <= CLASSE_NICE_MAIOR)))
    && ateTamanho(d.especificacao, TAMANHO_PROTECAO.especificacao) && ateTamanho(d.linguagem, TAMANHO_PROTECAO.linguagem)
    && (d.variacoes === undefined || d.variacoes === null || (Number.isInteger(d.variacoes) && d.variacoes >= 1 && d.variacoes <= VARIACOES_DO_DESENHO));
  if (!valido) throw new Error(FORMATO_INVALIDO);
  const deposito = d.deposito !== undefined ? d.deposito : atual?.deposito, concessao = d.concessao !== undefined ? d.concessao : atual?.concessao;
  if (deposito && concessao && concessao < deposito) throw new Error(CONCESSAO_ANTES_DO_DEPOSITO);
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
    colaboradores: ['colaboradores', v => (v as string[]).map(nomeNaEquipe).join(', ')], grupos: ['grupos', nomesDosGrupos], clientes: ['clientes', v => (v as string[]).map(id => resumoDe(id)?.nome).join(', ')]
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
// ---------- listas das demandas, das tarefas e dos contratos ----------
/** De cada cartão com listas: o campo que liga a lista a ele, como achá-lo (erro se não existe) e se quem está logado pode mexer
 *  nos checklists dele (como privado.altero_a_lista, 20261119142702: no contrato, quem só foi mencionado lê, mas não mexe). */
const CARTAO_DA_LISTA: Record<CartaoComListas, { campo: 'demanda_id' | 'tarefa_id' | 'contrato_id'; achar: (id: string) => unknown; altero: (id: string) => boolean }> = {
  demandas: { campo: 'demanda_id', achar: acharDemanda, altero: () => true },
  tarefas: { campo: 'tarefa_id', achar: acharTarefa, altero: () => true },
  contratos: { campo: 'contrato_id', achar: acharContrato, altero: alteroContratoDoId },
};
type ItemGuardado = NonNullable<Banco['itensDeLista']>[number];
type GrupoGuardado = NonNullable<Banco['gruposDeLista']>[number];
const itemLido = ({ lista_id: _l, ...i }: ItemGuardado): ItemDaLista => i;
const grupoLido = ({ lista_id: _l, ...g }: GrupoGuardado): GrupoDaLista => g;
const itensDaLista = (id: string) => bd.itensDeLista!.filter(i => i.lista_id === id);
const gruposDaLista = (id: string) => bd.gruposDeLista!.filter(g => g.lista_id === id);
const listaLida = ({ demanda_id: _d, tarefa_id: _t, contrato_id: _k, criado_em: _c, ...l }: NonNullable<Banco['listas']>[number]): ListaDoCartao =>
  ({ ...l, itens: itensDaLista(l.id).sort((a, b) => a.ordem - b.ordem).map(itemLido), grupos: gruposDaLista(l.id).map(grupoLido) });
/** Se quem está logado pode mexer no checklist (pelo cartão dele). Quem não pode: criar é recusado (SEM_PERMISSAO, como a regra
 *  RLS "tudo"); mudar e excluir não acham a linha e não mudam nada, sem erro, como no banco. */
function alteroALista(listaId: string | undefined) {
  const l = bd.listas!.find(x => x.id === listaId);
  return !l?.contrato_id || CARTAO_DA_LISTA.contratos.altero(l.contrato_id);
}
/** A recusa de checklist_reordenar a quem não pode mexer no checklist. */
const NAO_ALTERA_O_CHECKLIST = 'Você não pode alterar este checklist.';
const listaDoItem = (id: string) => bd.itensDeLista!.find(i => i.id === id)?.lista_id;
const listaDoGrupo = (id: string) => bd.gruposDeLista!.find(g => g.id === id)?.lista_id;
/** Como o gatilho que confere a árvore (20261119142702): a mudança só fica se a árvore do checklist continua certa; senão,
 *  tudo volta como estava e o erro é o do banco. */
function conferirArvore(listaId: string, mudar: () => void) {
  const [itens, grupos] = [bd.itensDeLista!.map(i => ({ ...i })), bd.gruposDeLista!.map(g => ({ ...g }))];
  mudar();
  const erro = erroDaArvore({ grupos: gruposDaLista(listaId), itens: itensDaLista(listaId) });
  if (!erro) return;
  [bd.itensDeLista, bd.gruposDeLista] = [itens, grupos];
  throw new Error(erro);
}
/** Como o "on delete cascade": excluir o cartão exclui as listas dele, com os grupos e os itens. */
function excluirListasDoCartao(campo: 'demanda_id' | 'tarefa_id' | 'contrato_id', id: string) {
  const listas = new Set(bd.listas!.filter(l => l[campo] === id).map(l => l.id));
  bd.listas = bd.listas!.filter(l => !listas.has(l.id));
  bd.itensDeLista = bd.itensDeLista!.filter(i => !listas.has(i.lista_id));
  bd.gruposDeLista = bd.gruposDeLista!.filter(g => !listas.has(g.lista_id));
}
/** O grupo e o que fica dentro dele, em qualquer nível. */
function gruposDentro(id: string): Set<string> {
  const dentro = new Set([id]);
  for (let crescendo = true; crescendo;) {
    const antes = dentro.size;
    bd.gruposDeLista!.forEach(g => { if (g.pai_id && dentro.has(g.pai_id)) dentro.add(g.id); });
    crescendo = dentro.size > antes;
  }
  return dentro;
}
function nomeDoGrupoDoChecklist(nome: string) {
  const n = nome.trim();
  if (!n) throw new Error('Dê um nome ao grupo.');
  if (n.length > TAMANHO_LISTA) throw new Error(`O nome do grupo pode ter até ${TAMANHO_LISTA} caracteres.`);
  return n;
}
/** Como as regras do banco: nome e texto sem espaços nas pontas e não vazios, no tamanho de cada um. */
function nomeDaLista(nome: string) {
  const n = nome.trim();
  if (!n) throw new Error('Dê um nome ao checklist.');
  if (n.length > TAMANHO_LISTA) throw new Error(`O nome do checklist pode ter até ${TAMANHO_LISTA} caracteres.`);
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
/** Como o gatilho conta_destino: a conta de destino do contrato é uma conta ativa do escritório. */
function conferirContaDeDestino(id: string | null | undefined) {
  if (id && !bd.contasFinanceiras!.some(c => c.id === id && !c.arquivada_em)) throw new Error('Escolha uma conta ativa do escritório para o dinheiro deste contrato.');
}
/** Como o gatilho da migração 015: o responsável é sempre um advogado da equipe (conferido ao criar e ao trocar). */
function conferirResponsavel(id: string | undefined) {
  if (EQUIPE.find(m => m.id === id)?.funcao !== 'advogado') throw new Error('O responsável do contrato precisa ser um advogado da equipe.');
}
/**
 * Como o começo do gatilho preparar do banco: o texto sem espaços nas pontas, nunca vazio. No banco ele é um gatilho "before", que
 * roda ANTES das regras de acesso: o texto vazio é recusado com esta mensagem mesmo num cartão que quem está logado não vê ou que
 * não existe (nos dois casos a mesma resposta, que não revela nada).
 */
function textoDoComentario(bruto: string) {
  const texto = bruto.trim();
  if (!texto) throw new Error('Escreva o comentário.');
  return texto;
}
/**
 * Como o gatilho preparar do banco (o texto e as menções achadas nele) e os gatilhos "after" que conferem as menções (em contratos,
 * só advogados; na demanda, na tarefa e no compromisso, só quem os vê). Só roda depois de o cartão ser alcançado (CARTAO_ALCANCADO),
 * como no banco, onde a conferência das menções vem depois das regras de acesso (#365).
 */
function prepararComentario(modulo: ModuloComentado, bruto: string, cartaoId: string, peloGrupoAntes: readonly string[] = []) {
  const texto = textoDoComentario(bruto);
  const mencoes = mencoesNoTexto(texto, EQUIPE), primeiro = (lista: typeof mencoes) => lista.sort((a, b) => a.nome.localeCompare(b.nome))[0];
  const negado = primeiro(mencoes.filter(m => MOTIVO_SEM_MENCAO[modulo](m)));
  if (negado) throw new Error(mencaoNegada(negado.nome));
  const demanda = modulo === 'demandas' ? bd.demandas!.find(d => d.id === cartaoId) : null;
  const deFora = demanda && !bd.equipeVeTudo ? primeiro(mencoes.filter(m => !veADemanda(demanda, m, contratosDoMembro(m), gruposDoMembro(m)))) : null;
  if (deFora) throw new Error(mencaoNegadaNaDemanda(deFora.nome));
  // Na tarefa: só quem a vê (quem está nela, na demanda ligada a ela ou no contrato de uma das duas, #326).
  const tarefa = modulo === 'tarefas' ? bd.tarefas!.find(t => t.id === cartaoId) : null;
  const daTarefa = tarefa ? demandasDaTarefaNoFalso(tarefa) : null;
  const foraDaTarefa = tarefa && !bd.equipeVeTudo ? primeiro(mencoes.filter(m => !veATarefa(tarefa, m, daTarefa, contratosDoMembro(m), gruposDoMembro(m)))) : null;
  if (foraDaTarefa) throw new Error(mencaoNegadaNaTarefa(foraDaTarefa.nome));
  // No compromisso: só quem o vê (quem está nele, quem vê o processo ligado ou todos, na Agenda geral).
  const compromisso = modulo === 'compromissos' ? bd.compromissos!.find(c => c.id === cartaoId) : null;
  const doCompromisso = compromisso ? processoDoCompromisso(compromisso) : null;
  const foraDoCompromisso = compromisso && !bd.equipeEditaTudo ? primeiro(mencoes.filter(m => !veOCompromisso(compromisso, m, doCompromisso, gruposDoMembro(m)))) : null;
  if (foraDoCompromisso) throw new Error(mencaoNegadaNoCompromisso(foraDoCompromisso.nome));
  // Na anotação: só quem a vê sem depender de um item ligado (como privado.mencao_na_anotacao; as chaves da equipe abrem a todos).
  const anotacao = modulo === 'anotacoes' ? bd.anotacoes!.find(a => a.id === cartaoId) : null;
  const foraDaAnotacao = anotacao ? primeiro(mencoes.filter(m => !estaPeloGrupo(anotacao.grupos, gruposDoMembro(m)) && motivoSemMencaoNaAnotacao(anotacao, chavesDaEquipe())(m))) : null;
  if (foraDaAnotacao) throw new Error(mencaoNegadaNaAnotacao(foraDaAnotacao.nome));
  // No processo (#362): só quem está nele e os administradores (como privado.mencao_no_processo; as chaves da equipe abrem a todos).
  const processo = modulo === 'processos' && !bd.equipeVeTudo && !bd.equipeEditaTudo ? bd.processos!.find(p => p.id === cartaoId) : null;
  const foraDoProcesso = processo ? primeiro(mencoes.filter(m => !estaPeloGrupo(processo.grupos, gruposDoMembro(m)) && motivoSemMencaoNoProcesso(processo)(m))) : null;
  if (foraDoProcesso) throw new Error(mencaoNegadaNoProcesso(foraDoProcesso.nome));
  // Como o gatilho do banco: o comentário de quem não é parte (pela chave ou por um grupo do contrato, #378) guarda a marca de que a
  // menção dele não vale, com a chave ligada ou desligada.
  // E guarda quem foi mencionado estando num grupo do contrato: a menção não dá os valores a essa pessoa, nem depois de ela sair do
  // grupo. Na edição, quem já estava marcado e continua mencionado segue marcado.
  const contrato = modulo === 'contratos' ? bd.contratos!.find(k => k.id === cartaoId) : null;
  const mencoesPeloGrupo = contrato ? mencoes.filter(m => estaPeloGrupo(contrato.grupos, gruposDoMembro(m)) || peloGrupoAntes.includes(m.id)).map(m => m.id) : [];
  return { texto, mencoes: mencoes.map(m => m.id), autor_sem_vinculo: modulo === 'contratos' && !vejoContratoDoId(cartaoId), mencoes_pelo_grupo: mencoesPeloGrupo };
}
/**
 * O cartão de cada módulo existe e quem está logado chega a ele, como na listagem do módulo? (No banco, as regras dos comentários
 * consultam o cartão pelas regras de leitura dele.) Quem não chega ao cartão recebe a recusa de sempre das regras de acesso
 * (SEM_PERMISSAO, o texto em que o erros.ts traduz o 42501 do banco), a mesma de quando ele não existe, antes de qualquer
 * conferência de menção: a recusa da menção diria que o cartão existe e quem está nele (#365).
 */
const CARTAO_ALCANCADO: Record<ModuloComentado, (id: string) => boolean> = {
  pessoas: id => bd.pessoas.some(p => p.id === id),
  contratos: alcancoContratoDoId,
  demandas: id => bd.demandas!.some(d => d.id === id) && vejoNoModulo('demandas', id),
  tarefas: id => bd.tarefas!.some(t => t.id === id) && vejoNoModulo('tarefas', id),
  compromissos: id => bd.compromissos!.some(c => c.id === id) && vejoNoModulo('compromissos', id),
  // Como a regra de leitura e a de incluir: a consulta à anotação passa pela regra de leitura dela (quem a vê lê e comenta).
  anotacoes: id => vejoAnotacaoDoId(id),
  // Como a regra de leitura do processo: quem o vê lê e comenta, mesmo só lendo o processo (#362).
  processos: id => vejoProcessoDoId(id)
};
/** O código e o nome do cartão do comentário, para a caixa de mensagens. */
const CARTAO_DA_MENSAGEM: Record<ModuloComentado, (id: string) => { codigo: string; nome: string | null; tipo_do_processo?: Processo['tipo'] } | undefined> = {
  pessoas: id => bd.pessoas.find(p => p.id === id),
  contratos: id => { const k = bd.contratos!.find(x => x.id === id); return k && { codigo: k.codigo, nome: k.servico }; },
  demandas: id => { const d = bd.demandas!.find(x => x.id === id); return d && { codigo: d.codigo, nome: d.titulo }; },
  tarefas: id => { const t = bd.tarefas!.find(x => x.id === id); return t && { codigo: t.codigo, nome: t.titulo }; },
  compromissos: id => { const c = bd.compromissos!.find(x => x.id === id); return c && { codigo: c.codigo, nome: c.titulo }; },
  anotacoes: id => { const a = bd.anotacoes!.find(x => x.id === id); return a && { codigo: a.codigo, nome: a.titulo }; },
  processos: id => { const p = bd.processos!.find(x => x.id === id); return p && { codigo: p.codigo, nome: p.titulo ?? null, tipo_do_processo: p.tipo }; }
};
/** Se quem está logado vê o cartão (como a regra de leitura dos comentários, que passa pela do cartão). */
const VEJO_O_CARTAO: Record<ModuloComentado, (id: string) => boolean> = {
  pessoas: id => bd.pessoas.some(p => p.id === id),
  contratos: alcancoContratoDoId,
  demandas: id => { const d = bd.demandas!.find(x => x.id === id); return !!d && (!!bd.equipeVeTudo || vejoDemanda(d)); },
  tarefas: id => {
    const t = bd.tarefas!.find(x => x.id === id);
    return !!t && (!!bd.equipeVeTudo || vejoTarefa(t));
  },
  compromissos: id => { const c = bd.compromissos!.find(x => x.id === id); return !!c && veOCompromisso(c, membroLogado(), processoDoCompromisso(c), meusGruposNoFalso()); },
  anotacoes: id => vejoAnotacaoDoId(id),
  processos: id => vejoProcessoDoId(id)
};
/** Como o gatilho privado.mensagens_do_comentario: quem foi marcado recebe a mensagem, menos quem escreveu; quem deixou de ser marcado perde a dele. */
function mensagensDoComentario(c: NonNullable<Banco['comentarios']>[number]) {
  bd.mensagens = bd.mensagens!.filter(m => m.comentario_id !== c.id || c.mencoes.includes(m.perfil_id) || !EQUIPE.find(p => p.id === m.perfil_id)?.ativo);
  for (const perfil of c.mencoes) {
    if (perfil !== c.autor_id && !bd.mensagens.some(m => m.comentario_id === c.id && m.perfil_id === perfil)) {
      bd.mensagens.push({ id: novoId(), perfil_id: perfil, tipo: 'mencao', comentario_id: c.id, criado_em: agora(), lido_em: null });
    }
  }
}
/** As mensagens de quem está logado. Apagar o comentário (ou o cartão) apaga a mensagem, como o "on delete cascade". */
const minhasMensagens = () => bd.mensagens!.filter(m => m.perfil_id === eu && (m.tipo === 'prazo' ? !!prazoDoAviso(m) : bd.comentarios!.some(c => c.id === m.comentario_id)));
/**
 * Os prazos de cada módulo (como privado.prazos_da_equipe). `vale` é falso no que a rotina ignora (arquivado, excluído, cancelado, tarefa repetida); o cartão continua existindo para o aviso já criado.
 * A antecedência do lembrete não vem do cartão: vem da própria mensagem (lembrete_antes, em mensagemLida).
 */
interface PrazoDaEquipe { perfil_id: string; modulo: ModuloDoPrazo; item_id: string; vale: boolean; aberto: boolean; prazo: Omit<PrazoDaMensagem, 'data' | 'aviso' | 'antecedencia'>; data: string | null }
const concluidoNaColuna = (etapa: string | null) => bd.colunas.find(c => c.id === etapa)?.marco === 'concluido';
const tarefaRepeteOPrazo = (t: { id: string; prazo: string | null; responsavel_id: string }) => bd.prazos!.some(z => {
  const p = bd.processos!.find(x => x.id === z.processo_id);
  return z.tarefa_id === t.id && !z.excluido_em && z.final === t.prazo && p?.responsavel_id === t.responsavel_id && !p.arquivado_em;
});
const paradoNoCartao = (x: { arquivado_em: string | null }): PrazoParado | null => x.arquivado_em ? 'arquivado' : null;
const PRAZOS_DA_EQUIPE: Record<ModuloDoPrazo, () => PrazoDaEquipe[]> = {
  processos: () => bd.prazos!.flatMap(z => {
    const p = bd.processos!.find(x => x.id === z.processo_id);
    return p ? [{ perfil_id: p.responsavel_id, modulo: 'processos' as const, item_id: z.id, vale: !z.excluido_em && !p.arquivado_em, aberto: !z.concluido_em, data: z.final,
      prazo: { modulo: 'processos' as const, pagina: paginaDoPrazo('processos', p.tipo), cartao_id: p.id, cartao_codigo: p.codigo, titulo: z.descricao, hora: null, concluido: !!z.concluido_em,
        parado: z.excluido_em ? 'excluido' as const : p.arquivado_em ? 'arquivado' as const : null } }] : [];
  }),
  demandas: () => bd.demandas!.map(d => ({ perfil_id: d.responsavel_id, modulo: 'demandas' as const, item_id: d.id, vale: !!d.prazo && !d.arquivado_em, aberto: !concluidoNaColuna(d.etapa_id), data: d.prazo,
    prazo: { modulo: 'demandas' as const, pagina: paginaDoPrazo('demandas'), cartao_id: d.id, cartao_codigo: d.codigo, titulo: d.titulo, hora: fmtHora(d.prazo_hora) || null, concluido: concluidoNaColuna(d.etapa_id), parado: paradoNoCartao(d) } })),
  tarefas: () => bd.tarefas!.map(t => ({ perfil_id: t.responsavel_id, modulo: 'tarefas' as const, item_id: t.id, vale: !!t.prazo && !t.arquivado_em && !tarefaRepeteOPrazo(t), aberto: !concluidoNaColuna(t.etapa_id), data: t.prazo,
    prazo: { modulo: 'tarefas' as const, pagina: paginaDoPrazo('tarefas'), cartao_id: t.id, cartao_codigo: t.codigo, titulo: t.titulo, hora: fmtHora(t.prazo_hora) || null, concluido: concluidoNaColuna(t.etapa_id), parado: paradoNoCartao(t) } })),
  compromissos: () => bd.compromissos!.map(c => ({ perfil_id: c.responsavel_id, modulo: 'compromissos' as const, item_id: c.id,
    vale: !c.arquivado_em && !colunaCancelada(bd.colunas.find(x => x.id === c.etapa_id)?.nome), aberto: !concluidoNaColuna(c.etapa_id), data: c.data,
    prazo: { modulo: 'compromissos' as const, pagina: paginaDoPrazo('compromissos'), cartao_id: c.id, cartao_codigo: c.codigo, concluido: concluidoNaColuna(c.etapa_id),
      parado: colunaCancelada(bd.colunas.find(x => x.id === c.etapa_id)?.nome) ? 'cancelado' as const : paradoNoCartao(c),
      titulo: nomeDoCompromisso({ tipo: c.tipo, titulo: c.titulo, pessoa_nome: nomesDosClientes(c.pessoas), processo_numero: c.processo_numero }), hora: fmtHora(c.hora) || null } }))
};
const prazosDaEquipe = () => (Object.keys(PRAZOS_DA_EQUIPE) as ModuloDoPrazo[]).flatMap(m => PRAZOS_DA_EQUIPE[m]());
const prazoDoAviso = (m: NonNullable<Banco['mensagens']>[number]) => prazosDaEquipe().find(p => p.item_id === m.item_id);
/** Depois de quantos dias do prazo o aviso sai da caixa (como privado.gerar_avisos_de_prazo). */
const DIAS_DO_AVISO_ANTIGO = 30;
/** A rotina diária (como privado.gerar_avisos_de_prazo). No banco fictício não há relógio: só os testes chamam, por SEMPER_FALSO.gerarAvisosDePrazo(). */
function gerarAvisosDePrazo(hoje = hojeNaAgenda()) {
  bd.mensagens = bd.mensagens!.filter(m => m.tipo !== 'prazo' || m.prazo_data! >= somarDias(hoje, -DIAS_DO_AVISO_ANTIGO));
  const abertos = prazosDaEquipe().filter(p => p.vale && p.aberto && EQUIPE.find(x => x.id === p.perfil_id)?.ativo);
  const vale = (m: NonNullable<Banco['mensagens']>[number]) => abertos.some(p => p.item_id === m.item_id && p.perfil_id === m.perfil_id && p.data === m.prazo_data);
  // A limpeza só olha os avisos de 3 dias e do dia: os lembretes têm a rotina deles (gerarLembretes).
  bd.mensagens = bd.mensagens!.filter(m => m.tipo !== 'prazo' || m.lido_em || !AVISOS_DA_ROTINA_DIARIA.has(m.prazo_aviso!) || vale(m));
  const limite = somarDias(hoje, DIAS_DO_AVISO_DE_PRAZO);
  for (const p of abertos.filter(x => x.data! >= hoje && x.data! <= limite)) {
    const prazo_aviso = p.data === hoje ? 'hoje' as const : 'proximo' as const;
    if (!bd.mensagens.some(m => m.tipo === 'prazo' && m.perfil_id === p.perfil_id && m.item_id === p.item_id && m.prazo_data === p.data && m.prazo_aviso === prazo_aviso)) {
      bd.mensagens.push({ id: novoId(), perfil_id: p.perfil_id, tipo: 'prazo', comentario_id: null, criado_em: agora(), lido_em: null, modulo: p.modulo, item_id: p.item_id, prazo_data: p.data!, prazo_aviso });
    }
  }
  const temOAvisoDoDia = (m: NonNullable<Banco['mensagens']>[number]) => bd.mensagens!.some(h => h.prazo_aviso === 'hoje' && h.perfil_id === m.perfil_id && h.item_id === m.item_id && h.prazo_data === m.prazo_data);
  bd.mensagens = bd.mensagens.filter(m => m.lido_em || m.prazo_aviso !== 'proximo' || !temOAvisoDoDia(m));
  gravar();
}
/** Os avisos que a rotina diária cria e limpa (privado.gerar_avisos_de_prazo); o lembrete não é dela. */
const AVISOS_DA_ROTINA_DIARIA: ReadonlySet<AvisoDePrazo> = new Set(['proximo', 'hoje']);
/** Os cartões que podem ter lembrete, com quem está junto do responsável em cada um (como privado.lembretes_da_equipe). */
type CartaoComLembrete = Pick<TarefaGuardada, 'id' | 'prazo' | 'prazo_hora' | 'lembrete' | 'etapa_id' | 'arquivado_em' | 'responsavel_id'>;
const CARTOES_COM_LEMBRETE: Record<'demandas' | 'tarefas', () => { cartao: CartaoComLembrete; junto: string[] }[]> = {
  demandas: () => bd.demandas!.map(d => ({ cartao: d, junto: d.colaboradores })),
  tarefas: () => bd.tarefas!.map(t => ({ cartao: t, junto: t.participantes }))
};
interface LembreteDaEquipe { perfil_id: string; modulo: 'demandas' | 'tarefas'; item_id: string; data: string; hora: string | null; antecedencia: Lembrete; instante: string }
/**
 * Um lembrete por pessoa que recebe e por cartão aberto (como privado.lembretes_da_equipe): não concluído, não arquivado,
 * com prazo e lembrete. Recebem o responsável e quem está junto (participantes ou colaboradores), se estão ativos.
 */
const lembretesDaEquipe = (): LembreteDaEquipe[] => (Object.keys(CARTOES_COM_LEMBRETE) as ('demandas' | 'tarefas')[]).flatMap(modulo => CARTOES_COM_LEMBRETE[modulo]()
  .filter(({ cartao: x }) => !!x.prazo && x.lembrete !== null && x.lembrete !== undefined && !x.arquivado_em && !concluidoNaColuna(x.etapa_id))
  .flatMap(({ cartao: x, junto }) => [...new Set([x.responsavel_id, ...junto])].filter(id => EQUIPE.find(m => m.id === id)?.ativo).map(perfil_id => ({
    perfil_id, modulo, item_id: x.id, data: x.prazo!, hora: x.prazo_hora ?? null, antecedencia: x.lembrete!,
    instante: instanteDoLembrete(x.prazo!, x.prazo_hora, x.lembrete!).toISOString()
  }))));
/**
 * A rotina dos lembretes (como privado.gerar_lembretes, que no banco roda a cada minuto). No banco fictício não há relógio:
 * só os testes chamam, por SEMPER_FALSO.gerarLembretes(quando). O lembrete não lido que não bate mais com o cartão (pessoa,
 * cartão, data, instante e antecedência) sai; o que chegou (do instante dele até a tolerância depois do prazo) entra; se a
 * data é a mesma e o instante ou a antecedência mudou, chega de novo: volta ao topo da caixa, não lido.
 */
function gerarLembretes(quando = new Date()) {
  const valem = lembretesDaEquipe();
  const bate = (m: NonNullable<Banco['mensagens']>[number]) => valem.some(l => l.perfil_id === m.perfil_id && l.item_id === m.item_id && l.data === m.prazo_data
    && l.instante === m.lembrete_em && l.antecedencia === m.lembrete_antes);
  bd.mensagens = bd.mensagens!.filter(m => m.prazo_aviso !== 'lembrete' || m.lido_em || bate(m));
  for (const l of valem.filter(x => lembreteChegou(x.data, x.hora, x.antecedencia, quando))) {
    // O mesmo índice único do banco: uma mensagem por pessoa, cartão, data e tipo de aviso.
    const ja = bd.mensagens.find(m => m.prazo_aviso === 'lembrete' && m.perfil_id === l.perfil_id && m.item_id === l.item_id && m.prazo_data === l.data);
    const lembrete = { lembrete_em: l.instante, lembrete_antes: l.antecedencia };
    if (!ja) bd.mensagens.push({ id: novoId(), perfil_id: l.perfil_id, tipo: 'prazo', comentario_id: null, criado_em: agora(), lido_em: null, modulo: l.modulo, item_id: l.item_id,
      prazo_data: l.data, prazo_aviso: 'lembrete', ...lembrete });
    else if (ja.lembrete_em !== l.instante || ja.lembrete_antes !== l.antecedencia) Object.assign(ja, { ...lembrete, criado_em: agora(), lido_em: null });
  }
  gravar();
}
/** Se quem está logado vê o cartão do prazo (como a regra de leitura de cada módulo). */
const vejoOCartaoDoPrazo = (p: PrazoDaEquipe) => p.modulo === 'processos' || VEJO_O_CARTAO[p.modulo](p.prazo.cartao_id);
function mensagemLida(m: NonNullable<Banco['mensagens']>[number]): Mensagem {
  const { id, tipo, criado_em, lido_em } = m;
  if (tipo === 'prazo') {
    const p = prazoDoAviso(m)!, aviso = m.prazo_aviso ?? 'proximo';
    return { id, tipo, criado_em, lido_em, comentario: null, pedido: null, inclusao: null, prazo: vejoOCartaoDoPrazo(p)
      ? { ...p.prazo, data: p.data ?? m.prazo_data!, aviso, antecedencia: aviso === 'lembrete' ? m.lembrete_antes ?? null : null } : null };
  }
  const c = bd.comentarios!.find(x => x.id === m.comentario_id)!, cartao = VEJO_O_CARTAO[c.modulo](c.cartao_id) ? CARTAO_DA_MENSAGEM[c.modulo](c.cartao_id) : undefined;
  return { id, tipo, criado_em, lido_em, prazo: null, pedido: null, inclusao: null, comentario: cartao ? { id: c.id, autor_id: c.autor_id, texto: c.texto, modulo: c.modulo, cartao_id: c.cartao_id, cartao_codigo: cartao.codigo, cartao_nome: cartao.nome,
    tipo_do_processo: cartao.tipo_do_processo ?? null } : null };
}
const comentarioLido = ({ modulo: _modulo, cartao_id: _cartao, ...c }: NonNullable<Banco['comentarios']>[number]): Comentario => c;
/** Cada objeto salvo entra na lista do escritório, uma vez só (ignorando maiúsculas e acentos). */
// "A definir" não entra nas sugestões (como privado.guardar_objetos).
const guardarObjetos = (objetos: string[]) => objetosDefinidos(objetos).forEach(o => {
  if (!bd.objetoSugestoes!.some(s => mesmoObjeto(s.descricao, o))) bd.objetoSugestoes!.push({ id: novoId(), descricao: o });
});
// ---------- a lista de objetos editável (como supabase/migrations/20261122232558_editar_objetos_de_contrato.sql, #281) ----------
/** Como privado.objeto_para_mudar: só administradores, o objeto precisa estar na lista e não pode ser o "A definir" antigo. */
function objetoParaMudar(id: string) {
  if (!souAdmin()) throw new Error(SEM_PERMISSAO);
  const s = bd.objetoSugestoes!.find(x => x.id === id);
  if (!s) throw new Error('Objeto não encontrado.');
  if (mesmoObjeto(s.descricao, OBJETO_A_DEFINIR)) throw new Error(OBJETO_A_DEFINIR_FIXO);
  return s;
}
/** Os contratos (ativos e arquivados) que usam o objeto. */
const contratosComObjeto = (descricao: string) => bd.contratos!.filter(k => k.objetos.some(o => mesmoObjeto(o, descricao)));
/**
 * Como privado.trocar_objetos: os nomes de `de` viram `para` nas demandas (e no título que ainda é igual ao nome antigo), depois
 * nos contratos (sem repetir) e no modelo de lista de mesmo nome. Cada demanda e cada contrato ganham a mudança no histórico.
 */
function trocarObjetosNoFalso(de: string[], para: string): TrocaDeObjetos {
  const casa = (t: string | null) => de.some(x => mesmoObjeto(t, x));
  const contratos = bd.contratos!.filter(k => k.objetos.some(casa));
  const demandas = bd.demandas!.filter(d => casa(d.objeto) && d.objeto !== para);
  demandas.forEach(d => {
    const mudanca = { objeto: para, titulo: mesmoObjeto(d.titulo, d.objeto) ? para : d.titulo };
    historicoDemanda(d, mudanca);
    Object.assign(d, mudanca, { atualizado_em: agora() });
  });
  const mudaram = contratos.filter(k => {
    const objetos = limparObjetos(k.objetos.map(o => casa(o) ? para : o));
    if (JSON.stringify(objetos) === JSON.stringify(k.objetos)) return false;
    const mudanca = { objetos, servico: objetos.join('; ') };
    historicoContrato(k, mudanca);
    Object.assign(k, mudanca, { atualizado_em: agora(), atualizado_por: eu });
    return true;
  });
  // O modelo mais antigo com um nome que sai, se ainda não há modelo com o nome novo e o nome cabe no modelo.
  const modelo = para.length <= TAMANHO_LISTA && !bd.modelos!.some(m => mesmoObjeto(m.nome, para)) ? bd.modelos!.find(m => casa(m.nome)) : undefined;
  if (modelo) Object.assign(modelo, { nome: para, atualizado_em: agora() });
  return {
    contratos: mudaram.length, demandas: demandas.length, modelos: modelo ? 1 : 0,
    // Os modelos que ficaram com um nome que saiu: as demandas seguintes não ganham as tarefas deles (a tela avisa).
    modelos_sem_objeto: bd.modelos!.filter(m => casa(m.nome) && !mesmoObjeto(m.nome, para)).length,
    contratos_com_duas_demandas: contratos.filter(k => bd.demandas!.filter(d => d.contrato_id === k.id && mesmoObjeto(d.objeto, para)).length > 1).length
  };
}
/** Pessoas que aparecem em algum contrato (cliente, participante ou indicador) não podem ser excluídas. */
const temContrato = (pessoaId: string) => bd.contratos!.some(k =>
  [...k.clientes, k.indicador_id].includes(pessoaId) || k.participantes.some(p => p.pessoa_id === pessoaId));

/** A troca de e-mail pede dois links, um no e-mail atual e outro no novo, como no Supabase com a troca segura ligada. */
const LINKS_DA_TROCA_DE_EMAIL = 2;
const meuEmail = () => bd.emailDaConta ?? EQUIPE[0].email;
const emailDaConta = () => ({ atual: meuEmail(), pendente: bd.emailPendente?.email ?? null });

/**
 * Como as regras de leitura do banco conferem a linha nova: com estes grupos, quem está logado continua vendo o item? (Quem tira o único
 * grupo pelo qual via o item é recusado, com ou sem a leitura de volta.)
 */
function vejoComOsGrupos(item: { grupos?: string[] }, grupos: string[], vejo: () => boolean) {
  const antes = item.grupos;
  item.grupos = grupos;
  try { return vejo(); } finally { item.grupos = antes; }
}
/**
 * Como as bolinhas gravam os grupos de cada item (#378, SD.itemDefinirGrupos): quem não altera o item é recusado, e quem deixaria de
 * vê-lo com os grupos novos também (vejoComOsGrupos). O contrato vai pela função própria.
 */
const GRUPOS_AO_GRAVAR: Record<ModuloDoPedido, (id: string, grupos: string[]) => Promise<unknown>> = {
  contratos: (id, grupos) => SD.contratoDefinirGrupos(id, grupos),
  demandas: async (id, grupos) => {
    const d = acharDemanda(id);
    if (soLeNoFalso(estaNaDemanda(d, membroLogado(), meusGruposNoFalso())) || !vejoComOsGrupos(d, grupos, () => vejoNoModulo('demandas', id))) return erro(SEM_PERMISSAO);
    return SD.demandaAtualizar(id, { grupos });
  },
  tarefas: async (id, grupos) => {
    const t = acharTarefa(id);
    if (soLeNoFalso(estaNaTarefa(t, membroLogado(), demandasDaTarefaNoFalso(t), meusGruposNoFalso())) || !vejoComOsGrupos(t, grupos, () => vejoNoModulo('tarefas', id))) return erro(SEM_PERMISSAO);
    return SD.tarefaAtualizar(id, { grupos });
  },
  processos: async (id, grupos) => {
    const p = acharProcesso(id);
    if (soLeNoFalso(alteraOProcesso(p, membroLogado(), meusGruposNoFalso())) || !vejoComOsGrupos(p, grupos, () => vejoNoModulo('processos', id))) return erro(SEM_PERMISSAO);
    return SD.processoAtualizar(id, { grupos });
  },
  compromissos: async (id, grupos) => {
    // Como a regra "alterar" (privado.estou_no_compromisso): quem só vê o compromisso da Agenda geral, sem participar, não muda nada.
    const c = acharCompromisso(id);
    const altero = !!bd.equipeEditaTudo || participaDoCompromisso(c, membroLogado(), processoDoCompromisso(c), meusGruposNoFalso());
    if (!altero || !vejoComOsGrupos(c, grupos, () => vejoNoModulo('compromissos', id))) return erro(SEM_PERMISSAO);
    return SD.compromissoAtualizar(id, { grupos });
  },
  anotacoes: async (id, grupos) => {
    const a = bd.anotacoes!.find(x => x.id === id);
    if (!a || !alteroAnotacao(a) || !vejoComOsGrupos(a, grupos, () => vejoAnotacao(a))) return erro(SEM_PERMISSAO);
    const novos = prepararAnotacao({ grupos }, a), antes = equipeDoItemNoFalso('anotacoes', id);
    historicoAnotacao(a, novos);
    Object.assign(a, novos, { atualizado_em: agora(), atualizado_por: eu });
    avisarInclusao('anotacoes', id, antes);
    auditar('anotacoes', 'alteracao', { id: a.id, codigo: a.codigo }); gravar();
  }
};

export const SD: Dados = {
  sessao: () => espera(bd.logado ? { user: { id: eu, email: meuEmail() } } : null),
  entrar: async () => { bd.logado = true; bd.semCodigo = !!bd.duasEtapas?.some(f => f.ativo); gravar(); },
  primeiroAcesso: async () => ({ entrou: false }),
  recuperarSenha: async () => {},
  async confirmarLink(codigo, tipo) {
    if (tipo !== 'email_change') { bd.logado = true; gravar(); return { comSessao: true }; }
    const troca = bd.emailPendente;
    if (!troca || troca.links.includes(codigo)) return erro(LINK_VENCIDO);
    troca.links.push(codigo);
    if (troca.links.length < LINKS_DA_TROCA_DE_EMAIL) { gravar(); return { comSessao: false }; }
    bd.emailDaConta = troca.email;
    bd.emailPendente = null;
    bd.logado = true;
    // O segundo link cria uma sessão nova, que ainda não passou pelo código do aplicativo.
    bd.semCodigo = !!bd.duasEtapas?.some(f => f.ativo);
    gravar();
    return { comSessao: true };
  },
  contaEmail: () => espera(emailDaConta()),
  async trocarEmail(novo) {
    const email = normalizarEmail(novo);
    if (EQUIPE.some(m => m.id !== eu && m.email === email)) return erro('Este e-mail já é usado em outra conta do SEMPER.');
    bd.emailPendente = { email, links: [] };
    gravar();
    return emailDaConta();
  },
  novaSenha: async () => {},
  sair: async () => { bd.logado = false; bd.semCodigo = false; bd.sessaoEncerrada = false; gravar(); },
  sessaoEncerrada: () => espera(!!bd.sessaoEncerrada),
  aoMudarSessao: () => () => {},
  // ---------- grupos da equipe (#378), como as funções grupo_* do banco: só administradores ----------
  async grupoDaEquipeCriar(nome) {
    if (!souAdmin()) return erro(SO_ADMINISTRADOR_NOS_GRUPOS);
    const g: GrupoDaEquipe = { id: novoId(), nome: nomeDoGrupoDaEquipe(nome), integrantes: [] };
    bd.gruposDaEquipe!.push(g); auditar('grupos_da_equipe', 'inclusao', { id: g.id, nome: g.nome }); gravar();
    return espera(g.id);
  },
  async grupoDaEquipeRenomear(id, nome) {
    const g = grupoDoAdministrador(id);
    const antes = g.nome;
    g.nome = nomeDoGrupoDaEquipe(nome, id); auditar('grupos_da_equipe', 'alteracao', { id, nome: g.nome });
    // Como o gatilho renomear_continua (#313): a contínua do grupo acompanha o nome, se o título ainda é o de fábrica.
    for (const d of bd.demandas!) if (d.continua && d.continua_grupo_id === id && d.titulo === tituloDaContinua(antes)) d.titulo = tituloDaContinua(g.nome);
    gravar();
  },
  async grupoDaEquipeIncluir(id, perfilId) {
    const g = grupoDoAdministrador(id), m = EQUIPE.find(x => x.id === perfilId);
    if (!m?.ativo || m.reservada || m.excluido) return erro('O integrante precisa ser alguém da equipe do escritório.');
    if (g.integrantes.includes(perfilId)) return;
    g.integrantes.push(perfilId);
    if (perfilId !== eu) {
      const ja = bd.mensagensDeGrupo!.find(x => x.perfil_id === perfilId && x.grupo_id === id);
      if (ja) Object.assign(ja, { criado_em: agora(), lido_em: null, incluido_por: eu });
      else bd.mensagensDeGrupo!.push({ id: novoId(), perfil_id: perfilId, grupo_id: id, incluido_por: eu, criado_em: agora(), lido_em: null });
    }
    gravar();
  },
  async grupoDaEquipeTirar(id, perfilId) {
    const g = grupoDoAdministrador(id);
    g.integrantes = g.integrantes.filter(p => p !== perfilId);
    // O desfazer: a mensagem ainda não lida de menos de AVISO_DESFEITO some.
    bd.mensagensDeGrupo = bd.mensagensDeGrupo!.filter(x => !(x.perfil_id === perfilId && x.grupo_id === id && !x.lido_em && Date.now() - Date.parse(x.criado_em) < AVISO_DESFEITO));
    gravar();
  },
  async grupoDaEquipeContarItens(id) {
    grupoDoAdministrador(id);
    const contagem = MODULOS_DOS_GRUPOS.map(modulo => ({ modulo, quantos: ITENS_COM_GRUPOS[modulo]().filter(x => x.grupos?.includes(id)).length }));
    return espera(contagem.filter(c => c.quantos > 0));
  },
  async grupoDaEquipeExcluir(id) {
    const g = grupoDoAdministrador(id);
    for (const modulo of MODULOS_DOS_GRUPOS) {
      for (const x of ITENS_COM_GRUPOS[modulo]().filter(i => i.grupos?.includes(id))) {
        const novos = { grupos: x.grupos!.filter(v => v !== id) };
        HISTORICO_DOS_GRUPOS[modulo](x.id, novos);
        Object.assign(x, novos, { atualizado_em: agora(), atualizado_por: eu });
      }
    }
    // Como o gatilho continua_para_a_geral (#313): as tarefas da contínua do grupo vão para a Geral, e a contínua dele some.
    const antiga = bd.demandas!.find(d => d.continua && d.continua_grupo_id === id);
    if (antiga) {
      const geral = continuaNoFalso(null);
      for (const t of bd.tarefas!.filter(x => demandasDaTarefa(x).includes(antiga.id))) {
        const novos = prepararTarefa({ demanda_ids: demandasDaTarefa(t).map(x => x === antiga.id ? geral.id : x) }, t);
        historicoTarefa(t, novos);
        Object.assign(t, novos, { atualizado_em: agora(), atualizado_por: eu });
      }
      bd.demandas = bd.demandas!.filter(d => d.id !== antiga.id);
    }
    bd.gruposDaEquipe = bd.gruposDaEquipe!.filter(x => x.id !== id);
    bd.mensagensDeGrupo = bd.mensagensDeGrupo!.filter(x => x.grupo_id !== id);
    auditar('grupos_da_equipe', 'exclusao', { id, nome: g.nome }); gravar();
  },
  async itemDefinirGrupos(modulo, id, grupos) {
    await GRUPOS_AO_GRAVAR[modulo](id, grupos);
  },
  async contexto() {
    if (!bd.logado) return null;
    // Como no banco: sem a sessão, a regra de leitura não devolve nem o próprio perfil.
    if (bd.sessaoEncerrada) return espera({ usuario: { id: eu, email: meuEmail() }, perfil: null, equipe: [], ehAdmin: false, ehMaster: false });
    const m = membroLogado(), ehMaster = m.papel === 'master';
    const c: Contexto = {
      usuario: { id: eu, email: meuEmail() },
      perfil: { id: eu, escritorio_id: 'e1', pessoa_id: m.pessoa_id, nome: (ehMaster && bd.perfil.nome) || m.nome, usuario: (ehMaster && bd.perfil.usuario) || m.usuario,
        papel: m.papel, funcao: m.funcao, ativo: true, cor: null, oab: null, preferencias: bd.perfil.preferencias },
      escritorio: { id: 'e1', slug: 'teste', modulos: { pessoas: true, contratos: true, demandas: true, tarefas: true, processos: true, compromissos: true, anotacoes: true, financeiro: true, equipe_ve_tudo: !!bd.equipeVeTudo, equipe_edita_tudo: !!bd.equipeEditaTudo }, ...bd.escritorio! },
      equipe: EQUIPE.map(({ email: _email, cpf: _cpf, ...r }) => ({ ...r, nome: nomeNaEquipe(r.nome, r.excluido), foto: bd.fotos?.[r.id]?.pequena ?? null })),
      grupos: bd.gruposDaEquipe!.toSorted((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), ehAdmin: souAdmin(), ehMaster
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
    bd.pessoas.push(p); auditar('pessoas', 'inclusao', p); enfileirarNoGoogle(p); gravar();
    return espera({ id: p.id, codigo: p.codigo });
  },
  async pessoaAtualizar(id, dados, resp) {
    const p = achar(id);
    if (dados.documento && bd.pessoas.some(x => x.documento === dados.documento && x.id !== id)) return erro('Já existe um cadastro com este CPF/CNPJ.');
    const antes = { ...p };
    alterarPessoa(p, dados);
    if (mudouNoGoogle(antes, p)) enfileirarNoGoogle(p);
    if (Array.isArray(resp)) p.resp = resp.map(perfil_id => ({ perfil_id }));
    gravar();
    return espera({ id, codigo: p.codigo });
  },
  async pessoasArquivar(ids, arquivar = true) {
    ids.forEach(id => {
      const p = bd.pessoas.find(x => x.id === id); if (!p) return;
      bd.historico.unshift({ id: Date.now() + Math.random(), pessoa_id: id, alteracoes: { arquivado_em: { de: p.arquivado_em, para: arquivar ? agora() : null } }, feito_por: eu, em: agora() });
      const desarquivada = !!p.arquivado_em && !arquivar;
      p.arquivado_em = arquivar ? agora() : null; p.atualizado_em = agora();
      if (desarquivada) enfileirarNoGoogle(p);
    });
    gravar(); return espera(ids.length);
  },
  async pessoasExcluir(ids) {
    let excluidas = 0, motivo = '';
    ids.forEach(id => {
      const p = bd.pessoas.find(x => x.id === id);
      if (!p || !p.arquivado_em) return;
      // Como perfis_pessoa_fkey: quem foi excluído da equipe solta o cadastro (privado.soltar_perfil_excluido).
      if (EQUIPE.some(m => m.pessoa_id === id && !m.excluido)) { motivo = 'Esta pessoa é usuária do sistema e não pode ser excluída.'; return; }
      if (temContrato(id)) { motivo = 'Esta pessoa está em contratos e não pode ser excluída.'; return; }
      if (bd.demandas!.some(d => d.clientes.includes(id))) { motivo = 'Esta pessoa está em demandas e não pode ser excluída.'; return; }
      if (bd.tarefas!.some(t => t.pessoas.includes(id))) { motivo = 'Esta pessoa está em tarefas e não pode ser excluída.'; return; }
      if (bd.processos!.some(x => x.clientes.includes(id)) || bd.processoPartes!.some(x => x.pessoa_id === id)) { motivo = 'Esta pessoa está em processos e não pode ser excluída.'; return; }
      if (bd.compromissos!.some(c => c.pessoas.includes(id))) { motivo = 'Esta pessoa está em compromissos e não pode ser excluída.'; return; }
      if (bd.anotacaoLigacoes!.some(l => l.modulo === 'pessoas' && l.item_id === id)) { motivo = 'Esta pessoa está ligada a anotações e não pode ser excluída.'; return; }
      if (bd.socios!.some(s => s.pessoa_id === id) || bd.repasses!.some(r => r.pessoa_id === id)) { motivo = 'Esta pessoa está no financeiro e não pode ser excluída.'; return; }
      bd.pessoas = bd.pessoas.filter(x => x.id !== id); auditar('pessoas', 'exclusao', p); excluidas++;
      bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'pessoas' && c.cartao_id === id));
      esquecerNasPartes(id);
      // LGPD, como o gatilho esquecer_nos_excluidos: o nome dela sai da cópia escondida dos recebimentos excluídos (#412).
      bd.financeiroExcluidos = bd.financeiroExcluidos!.map(x => semAPessoa(x, p));
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
  contratoVer: id => {
    const k = bd.contratos!.find(x => x.id === id && alcancoContrato(x));
    return espera(k ? (vejoContrato(k) ? contratoCompleto(k) : contratoSemValores(contratoCompleto(k))) : null);
  },
  contratoObter: id => { const k = bd.contratos!.find(x => x.id === id && vejoContrato(x)); return espera(k ? contratoCompleto(k) : null); },
  // Como o gatilho do banco: o número vem da sigla do responsável (CPF no cadastro dele), do sequencial do ano e do ano.
  // O sequencial é o maior número que existe no ano, mais um: o número do último contrato excluído volta a ser usado.
  async contratoCriar(dados) {
    const resp = EQUIPE.find(m => m.id === dados.responsavel_id);
    conferirResponsavel(dados.responsavel_id);
    const sigla = resp ? siglaAdvogado(resp.nome, bd.pessoas.find(p => p.id === resp.pessoa_id)?.documento) : null;
    if (!resp || !sigla) return erro(`Cadastre o CPF de ${resp?.nome || 'quem é o responsável'} em Pessoas para gerar o número do contrato.`);
    const d = ajustarClientes(ajustarParticipantes(ajustarObjetos(dados)));
    conferirContaDeDestino(d.conta_destino_id);
    const ano = new Date().getFullYear(), numero = Math.max(0, ...bd.contratos!.filter(x => x.ano === ano).map(x => x.numero)) + 1;
    const k: ContratoGuardado = { ...contratoNovo(), ...d, id: novoId(), numero, sigla, ano, codigo: numeroContrato(sigla, numero, ano) };
    bd.contratos!.push(k); guardarObjetos(k.objetos); demandasDoContratoAssinado(k); parcelasDoContratoAssinado(k); avisarInclusao('contratos', k.id, null); auditar('contratos', 'inclusao', k); gravar();
    return espera({ id: k.id, codigo: k.codigo });
  },
  // Como public.pessoa_fechar_contrato: um contrato só (se a pessoa já é cliente de um não arquivado, o que nasceu dela
  // ou o mais recente, é ele); o responsável é quem moveu (se é advogado) ou o primeiro advogado responsável pela pessoa.
  // No banco fictício, o módulo Contratos está sempre ligado.
  async pessoaFecharContrato(pessoaId) {
    const p = achar(pessoaId);
    const ativos = bd.contratos!.filter(k => k.clientes.includes(pessoaId) && !k.arquivado_em);
    const anterior = ativos.find(k => k.id === bd.contratosDoClienteFechado![pessoaId])
      ?? ativos.toSorted((a, b) => b.criado_em.localeCompare(a.criado_em) || a.id.localeCompare(b.id))[0];
    if (anterior) return espera({ id: anterior.id, codigo: anterior.codigo, novo: false });
    const advogado = (id: string) => EQUIPE.find(m => m.id === id && m.funcao === 'advogado' && m.ativo)?.id;
    const responsavel = advogado(eu) ?? p.resp.map(r => advogado(r.perfil_id)).find(Boolean);
    if (!responsavel) return erro('O contrato não nasceu: inclua um advogado entre os responsáveis por esta pessoa (no cartão dela) e mova de novo.');
    const etapa = bd.colunas.find(c => c.modulo === 'contratos' && c.marco === 'aguardando_assinatura')?.id ?? null;
    const { id, codigo: numero } = await SD.contratoCriar({ clientes: [pessoaId], responsavel_id: responsavel, objetos: [OBJETO_A_DEFINIR], categoria: 'pro_labore',
      etapa_id: etapa, etapa_ordem: Date.now() / 1000 });
    // Como no banco: o contrato que o sistema cria (com o responsável que ele escolheu) não avisa ninguém (#377).
    bd.mensagensDeInclusao = bd.mensagensDeInclusao!.filter(m => m.item_id !== id);
    bd.contratosDoClienteFechado![pessoaId] = id; gravar();
    return espera({ id, codigo: numero, novo: true });
  },
  contasParaEscolher: () => espera(bd.contasFinanceiras!.filter(c => !c.arquivada_em).map(({ id, nome }) => ({ id, nome }))),
  async contratoAtualizar(id, dados) {
    const k = acharContrato(id);
    if (dados.responsavel_id !== undefined && dados.responsavel_id !== k.responsavel_id) conferirResponsavel(dados.responsavel_id);
    if (!alteroContrato(k)) return erro('Você não tem permissão para fazer isso.');
    const d = ajustarClientes(ajustarParticipantes(ajustarObjetos(dados, k), k), k);
    // Como no banco, a leitura confere também a linha nova: quem deixaria de ver o contrato não grava.
    if (!vejoContrato({ ...k, ...d })) return erro('Você não tem permissão para fazer isso.');
    if (d.conta_destino_id !== undefined && d.conta_destino_id !== k.conta_destino_id) conferirContaDeDestino(d.conta_destino_id);
    historicoContrato(k, d);
    const etapaAntes = k.etapa_id, antes = { etapa_id: k.etapa_id, objetos: [...k.objetos] }, equipeAntes = equipeDoItemNoFalso('contratos', id);
    Object.assign(k, d, { atualizado_em: agora(), atualizado_por: eu });
    avisarInclusao('contratos', id, equipeAntes);
    guardarObjetos(k.objetos); demandasDoContratoAssinado(k, antes);
    // Como o gatilho do banco: só quando a coluna muda.
    if (k.etapa_id !== etapaAntes) parcelasDoContratoAssinado(k);
    auditar('contratos', 'alteracao', k); gravar();
    return espera({ id, codigo: k.codigo });
  },
  async contratosArquivar(ids, arquivar = true) {
    // Como o banco: um update só, e o gatilho de cada contrato roda depois, com todos os da lista já arquivados (ou desarquivados).
    const mudaram = ids.flatMap(id => {
      const k = bd.contratos!.find(x => x.id === id && alteroContrato(x)); if (!k) return [];
      const mudou = !k.arquivado_em === arquivar;
      historicoContrato(k, { arquivado_em: arquivar ? agora() : null });
      Object.assign(k, { arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? eu : null, atualizado_em: agora() });
      return mudou ? [k.id] : [];
    });
    mudaram.forEach(id => arquivarEmCascata(id, arquivar));
    gravar(); return espera(ids.length);
  },
  contratoExclusaoPrevia(ids) {
    const ok = contratosQueExcluo(ids), r = resumoDaExclusaoNoFalso(ok), admin = souAdmin();
    const ve = admin || ok.every(cuidoDoContrato);
    return espera({
      contratos: ok.length, nao_excluiveis: new Set(ids).size - ok.length,
      demandas: r.demandas, tarefas: r.tarefas, segundos: r.segundos, parcelas: r.parcelas,
      recebimentos: r.recebimentos, estornados: r.estornados, importadas: r.importadas,
      com_dinheiro: r.recebimentos > 0 || r.importadas > 0, sou_admin: admin, tem_pagamento: r.pagos.length > 0,
      valores: ve ? { recebido: r.recebido, taxas: r.taxas, repasses: r.repasses, correcoes: r.correcoes, importado: r.importado } : null,
      pagos: ve ? r.pagos : []
    });
  },
  async contratosExcluir(ids) {
    const ok = contratosQueExcluo(ids);
    if (!ok.length) return espera({ excluidas: 0, naoExcluidas: ids.length, motivo: RECUSA_DA_EXCLUSAO.nenhum });
    const r = resumoDaExclusaoNoFalso(ok);
    if (r.pagos.length) return erro(RECUSA_DA_EXCLUSAO.pagamento);
    if ((r.recebimentos > 0 || r.importadas > 0) && !souAdmin()) return erro(RECUSA_DA_EXCLUSAO.administrador);
    // O resumo de cada contrato, contado antes de apagar; entra na linha da exclusão dele, como no banco (uma linha só). Cada tarefa
    // que sai conta uma vez, no primeiro contrato (pelo código) a que está ligada, também a que só sai por estarem juntos na lista.
    const pelaOrdem = ok.map(acharContrato).toSorted((a, b) => a.codigo.localeCompare(b.codigo)).map(k => k.id);
    const deCada = tarefasDeCadaContrato(pelaOrdem, r.junto, escritorioParaExcluir());
    const resumos = new Map(pelaOrdem.map(id => {
      const { pagos: _p, junto: _j, ...cascata } = resumoDaExclusaoNoFalso([id]);
      const segundos = Math.max(0, bd.tempos!.filter(x => deCada[id].includes(x.tarefa_id)).reduce((s, x) => s + x.segundos, 0));
      return [id, { ...cascata, tarefas: deCada[id].length, segundos }];
    }));
    // O Financeiro: a cópia escondida de cada recebimento (também o estornado) e de cada parcela importada como paga; depois, tudo sai.
    const recebimentos = bd.recebimentos!.filter(x => ok.includes(x.contrato_id)), idsDosRecebimentos = new Set(recebimentos.map(x => x.id));
    const repasses = bd.repasses!.filter(x => idsDosRecebimentos.has(x.recebimento_id));
    const lancamentos = new Set([...recebimentos.flatMap(x => [x.lancamento_id, x.lancamento_taxa_id]), ...repasses.map(x => x.lancamento_id)].filter(Boolean));
    const copia = { excluido_por: eu, excluido_em: agora() };
    recebimentos.forEach(x => bd.financeiroExcluidos!.push({ contrato_id: x.contrato_id, contrato_codigo: acharContrato(x.contrato_id).codigo, tipo: 'recebimento',
      parcela_numero: acharParcela(x.parcela_id).numero, data: x.data, valor: x.valor, conta_id: x.conta_id, estornado: !!x.estornado_em, ...copia,
      copia: { recebimento: x, repasses: repasses.filter(y => y.recebimento_id === x.id), terceiros_pagos: bd.terceirosPagos!.filter(m => m.recebimento_id === x.id),
        lancamentos: bd.lancamentos!.filter(l => lancamentos.has(l.id) || l.corrige_recebimento === x.id) } }));
    bd.parcelas!.filter(p => ok.includes(p.contrato_id) && importadaComoPaga(p)).forEach(p => bd.financeiroExcluidos!.push({ contrato_id: p.contrato_id,
      contrato_codigo: acharContrato(p.contrato_id).codigo, tipo: 'parcela_importada', parcela_numero: p.numero, data: p.recebida_em, valor: p.recebido ?? 0, conta_id: null,
      estornado: false, ...copia, copia: { parcela: p } }));
    bd.repasses = bd.repasses!.filter(x => !idsDosRecebimentos.has(x.recebimento_id));
    bd.terceirosPagos = bd.terceirosPagos!.filter(m => !idsDosRecebimentos.has(m.recebimento_id));
    bd.recebimentos = bd.recebimentos!.filter(x => !idsDosRecebimentos.has(x.id));
    bd.lancamentos = bd.lancamentos!.filter(l => !lancamentos.has(l.id) && !(l.corrige_recebimento && idsDosRecebimentos.has(l.corrige_recebimento)));
    // As tarefas que só pertencem a estes contratos e as demandas; por fim, os contratos.
    bd.tarefas!.filter(t => r.junto.tarefas.includes(t.id)).forEach(apagarTarefa);
    bd.demandas!.filter(d => r.junto.demandas.includes(d.id)).forEach(apagarDemanda);
    let excluidas = 0;
    ok.forEach(id => {
      const k = bd.contratos!.find(x => x.id === id)!;
      bd.contratos = bd.contratos!.filter(x => x.id !== id);
      bd.parcelas = bd.parcelas!.filter(p => p.contrato_id !== id);
      bd.historicoParcelas = bd.historicoParcelas!.filter(h => h.contrato_id !== id);
      bd.historicoContratos = bd.historicoContratos!.filter(h => h.contrato_id !== id);
      bd.contratoProcessos = bd.contratoProcessos!.filter(l => l.contrato_id !== id);
      bd.arquivadosComContrato = bd.arquivadosComContrato!.filter(m => m.contrato_id !== id);
      excluirListasDoCartao('contrato_id', id);
      soltarDasAnotacoes('contratos', id);
      soltarDosCompromissos('contratos', id);
      bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'contratos' && c.cartao_id === id));
      bd.demandas!.forEach(d => { if (d.contrato_id === id) d.contrato_id = null; });
      // Como o banco (#283): o contrato sai da lista de cada tarefa; a tarefa continua, ligada aos outros.
      bd.tarefas!.forEach(t => { if (contratosDaTarefa(t).includes(id)) Object.assign(t, prepararTarefa({ contrato_ids: contratosDaTarefa(t).filter(x => x !== id) }, t)); });
      auditar('contratos', 'exclusao', k, { cascata: resumos.get(id) }); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? RECUSA_DA_EXCLUSAO.nenhum : '' });
  },
  async contratoDefinirGrupos(id, grupos) {
    const k = bd.contratos!.find(x => x.id === id && !x.arquivado_em);
    if (!k) return erro('Contrato não encontrado neste escritório.');
    if (!alteroContrato(k)) return erro('Só quem é parte do contrato põe ou tira grupos.');
    const novos = { grupos: gruposAoGravar(grupos, k.grupos) }, antes = equipeDoItemNoFalso('contratos', id);
    historicoContrato(k, novos);
    Object.assign(k, novos, { atualizado_em: agora(), atualizado_por: eu });
    avisarInclusao('contratos', id, antes);
    gravar();
  },
  async contratoAlterarSemValores(id, dados) {
    if (!bd.equipeEditaTudo && !bd.contratos!.some(x => x.id === id && peloGrupoDoContrato(x))) return erro('Você não tem permissão para fazer isso.');
    const k = bd.contratos!.find(x => x.id === id);
    if (!k || k.arquivado_em) return erro('Contrato não encontrado neste escritório.');
    Object.assign(k, dados, { atualizado_em: agora() });
    gravar();
  },
  async faseDeAdaptacaoDefinir(ligada) {
    if (!souAdmin()) return erro('Só um administrador muda esta opção.');
    bd.equipeVeTudo = ligada; bd.equipeEditaTudo = ligada; gravar();
  },
  async contratoMover(id, etapaId, ordem) {
    const k = bd.equipeEditaTudo ? bd.contratos!.find(x => x.id === id)! : acharContrato(id);
    if (!alteroContrato(k) && !bd.equipeEditaTudo) return erro('Você não tem permissão para fazer isso.');
    if ((k.etapa_id || null) !== (etapaId || null)) {
      bd.historicoContratos!.unshift({ id: Date.now() + Math.random(), contrato_id: id, alteracoes: { etapa: { de: nomeDaColuna(k.etapa_id), para: nomeDaColuna(etapaId) } }, feito_por: eu, em: agora() });
    }
    const antes = { etapa_id: k.etapa_id, objetos: [...k.objetos] };
    Object.assign(k, { etapa_id: etapaId, etapa_ordem: ordem, atualizado_em: agora() }); demandasDoContratoAssinado(k, antes); parcelasDoContratoAssinado(k); gravar();
  },
  contratoHistorico: id => espera(bd.historicoContratos!.filter(h => h.contrato_id === id && vejoContratoDoId(id))),
  objetosSugeridos: () => espera(bd.objetoSugestoes!.map(s => s.descricao).sort((a, b) => a.localeCompare(b, 'pt-BR'))),
  async objetosDoEscritorio() {
    if (!souAdmin()) return erro(SEM_PERMISSAO);
    // Como o banco: o objeto que está num contrato e ficou fora da lista entra nela agora.
    bd.contratos!.forEach(k => guardarObjetos(k.objetos)); gravar();
    // O "A definir" antigo que tenha ficado na lista não aparece (como o banco).
    return espera(bd.objetoSugestoes!.filter(s => !mesmoObjeto(s.descricao, OBJETO_A_DEFINIR)).map((s): ObjetoDoEscritorio => {
      const contratos = contratosComObjeto(s.descricao);
      return { id: s.id, descricao: s.descricao, contratos_ativos: contratos.filter(k => !k.arquivado_em).length,
        contratos_arquivados: contratos.filter(k => k.arquivado_em).length, demandas: bd.demandas!.filter(d => mesmoObjeto(d.objeto, s.descricao)).length };
    }).sort((a, b) => normal(a.descricao).localeCompare(normal(b.descricao), 'pt-BR')));
  },
  async objetoRenomear(id, nome) {
    const s = objetoParaMudar(id), novo = nome.trim();
    const recusa = erroDoNomeDoObjeto(novo, bd.objetoSugestoes!, id);
    if (recusa) return erro(recusa);
    if (novo === s.descricao) return espera({ contratos: 0, demandas: 0, modelos: 0, modelos_sem_objeto: 0, contratos_com_duas_demandas: 0 });
    const antigo = s.descricao;
    s.descricao = novo;
    const troca = trocarObjetosNoFalso([antigo], novo); gravar();
    return espera(troca);
  },
  async objetosJuntar(ids, fica) {
    const f = objetoParaMudar(fica), outros = [...new Set(ids)].filter(x => x !== fica);
    if (!outros.length) return erro(JUNTAR_SO_UM);
    const saem = bd.objetoSugestoes!.filter(s => outros.includes(s.id));
    if (saem.length !== outros.length) return erro('Objeto não encontrado.');
    if (saem.some(s => mesmoObjeto(s.descricao, OBJETO_A_DEFINIR))) return erro(OBJETO_A_DEFINIR_FIXO);
    bd.objetoSugestoes = bd.objetoSugestoes!.filter(s => !outros.includes(s.id));
    const troca = trocarObjetosNoFalso(saem.map(s => s.descricao), f.descricao); gravar();
    return espera(troca);
  },
  async objetoApagar(id) {
    const s = objetoParaMudar(id), usam = contratosComObjeto(s.descricao).length;
    if (usam) return erro(avisoDoObjetoEmUso(usam));
    bd.objetoSugestoes = bd.objetoSugestoes!.filter(x => x.id !== id); gravar();
    return espera(undefined);
  },
  contratosDaPessoa: (pessoaId, perfilId = null) => espera(bd.contratos!
    .filter(alcancoContrato)
    .map(k => ({ k, papeis: papeisNoContrato({ ...k, indicador_id: vejoContrato(k) ? k.indicador_id : null, participantes: k.participantes.map(p => p.pessoa_id) }, pessoaId, perfilId) }))
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
  demandaObter: id => { const d = bd.demandas!.find(x => x.id === id && vejoNoModulo('demandas', x.id)); return espera(d ? demandaCompleta(d) : null); },
  async demandaCriar(dados) {
    const d: DemandaGuardada = { ...demandaNova(), ...prepararDemanda({ clientes: [], colaboradores: [], ...dados }) as Partial<DemandaGuardada>, id: novoId(), codigo: codigo() };
    bd.demandas!.push(d); avisarInclusao('demandas', d.id, null); auditar('demandas', 'inclusao', d); gravar();
    return espera({ id: d.id, codigo: d.codigo });
  },
  async demandaAtualizar(id, dados) {
    const d = acharDemanda(id), novos = prepararDemanda(dados, d), antes = equipeDoItemNoFalso('demandas', id);
    guardarContinua(d, novos);
    historicoDemanda(d, novos);
    Object.assign(d, novos, { atualizado_em: agora(), atualizado_por: eu });
    avisarInclusao('demandas', id, antes);
    auditar('demandas', 'alteracao', d); gravar();
    return espera({ id, codigo: d.codigo });
  },
  async demandasArquivar(ids, arquivar = true) {
    ids = ids.filter(id => { const d = bd.demandas!.find(x => x.id === id); return !d || !soLeNoFalso(estaNaDemanda(d, membroLogado(), meusGruposNoFalso())); });
    // A contínua (#313) nunca é arquivada: fica de fora, como no supabase.ts.
    if (arquivar) ids = ids.filter(id => !bd.demandas!.some(x => x.id === id && x.continua));
    ids.forEach(id => {
      const d = bd.demandas!.find(x => x.id === id); if (!d) return;
      historicoDemanda(d, { arquivado_em: arquivar ? agora() : null });
      Object.assign(d, { arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? eu : null, atualizado_em: agora() });
      esquecerArquivadoComContrato(id);
    });
    gravar(); return espera(ids.length);
  },
  async demandasExcluir(ids) {
    let excluidas = 0;
    ids.forEach(id => {
      const d = bd.demandas!.find(x => x.id === id);
      if (!d || !d.arquivado_em) return;
      if (d.continua) throw new Error(CONTINUA_NAO_EXCLUI);
      apagarDemanda(d); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só demandas arquivadas podem ser excluídas.' : '' });
  },
  async demandaMover(id, etapaId, ordem) {
    const d = acharDemanda(id);
    if (soLeNoFalso(estaNaDemanda(d, membroLogado(), meusGruposNoFalso()))) return erro('Você não tem permissão para fazer isso.');
    guardarContinua(d, { etapa_id: etapaId });
    historicoDemanda(d, { etapa_id: etapaId });
    Object.assign(d, { etapa_id: etapaId, etapa_ordem: ordem, atualizado_em: agora() }); gravar();
  },
  demandaHistorico: id => espera(bd.historicoDemandas!.filter(h => h.demanda_id === id)),
  demandasDaPessoa: (pessoaId, perfilId = null) => espera(bd.demandas!.map(demandaLigada(pessoaId, perfilId)).filter(d => d.papeis.length)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, DEMANDAS_LIGADAS)),
  demandasDoContrato: contratoId => espera(bd.demandas!.filter(d => d.contrato_id === contratoId)
    .sort((a, b) => (a.etapa_ordem ?? Infinity) - (b.etapa_ordem ?? Infinity) || a.criado_em.localeCompare(b.criado_em))
    .slice(0, DEMANDAS_LIGADAS).map(d => ({ ...demandaLigada('', null)(d), papeis: [] }))),
  // Como public.contrato_criar_demanda (#349).
  async contratoCriarDemanda(contratoId, objeto) {
    if (!alteroContratoDoId(contratoId)) return erro(SEM_PERMISSAO);
    const k = acharContrato(contratoId);
    if (k.arquivado_em) return erro('Este contrato está arquivado. Desarquive para criar a demanda.');
    const doContrato = objetosDefinidos(k.objetos).find(o => mesmoObjeto(o, objeto));
    if (!doContrato) return erro('Este objeto não está no contrato.');
    if (bd.demandas!.some(d => d.contrato_id === k.id && mesmoObjeto(d.objeto, doContrato))) return erro('Este objeto já tem uma demanda.');
    const d = demandaDoObjeto(k, doContrato, Date.now() / 1000);
    auditar('demandas', 'inclusao', d); gravar();
    return espera({ id: d.id, codigo: d.codigo });
  },

  // Como public.demanda_continua (#313): quem pode usá-la (a Geral, toda a equipe; a de um grupo, quem está nele e o administrador).
  async demandaContinua(grupoId) {
    if (grupoId && !souAdmin() && !meusGruposNoFalso().includes(grupoId)) return erro(SEM_PERMISSAO);
    const d = continuaNoFalso(grupoId); gravar();
    return espera(d.id);
  },

  // ---------- demandas relacionadas (como supabase/migrations/20261122125913_demandas_relacionadas.sql, #310) ----------
  demandasRelacionadas(demandaId) {
    // Como a regra de leitura da ligação: quem vê uma das duas demandas vê a ligação.
    const linhas = bd.demandasRelacionadas!.filter(l => (demandaId === l.demanda_a || demandaId === l.demanda_b)
      && (vejoNoModulo('demandas', l.demanda_a) || vejoNoModulo('demandas', l.demanda_b))).slice(0, DEMANDAS_RELACIONADAS);
    // Cada ponta como a regra de leitura das demandas: a que quem lê não vê fica só com o número.
    const ponta = (id: string) => {
      const d = bd.demandas!.find(x => x.id === id);
      return d && vejoNoModulo('demandas', id) ? { titulo: d.titulo, prazo: d.prazo, prazo_hora: d.prazo_hora ?? null, etapa_id: d.etapa_id, arquivado_em: d.arquivado_em } : null;
    };
    const codigoDe = (id: string) => bd.demandas!.find(x => x.id === id)?.codigo ?? '';
    return espera(linhas.map(l => outraDaRelacao({ ...l, codigo_a: codigoDe(l.demanda_a), codigo_b: codigoDe(l.demanda_b), a: ponta(l.demanda_a), b: ponta(l.demanda_b) }, demandaId)));
  },
  async demandaRelacionar(demandaId, outraId) {
    // Como a regra "incluir": quem está nas duas, com as duas ativas; e nunca a demanda com ela mesma (a regra de ordem do banco).
    if (demandaId === outraId) return erro(MESMA_DEMANDA);
    if (![demandaId, outraId].every(id => estouNaDemandaDoId(id, true))) return erro(SEM_PERMISSAO);
    const [demanda_a, demanda_b] = parDaRelacao(demandaId, outraId);
    const nova = !bd.demandasRelacionadas!.some(l => l.demanda_a === demanda_a && l.demanda_b === demanda_b);
    if (nova) bd.demandasRelacionadas!.push({ demanda_a, demanda_b });
    gravar();
    return espera(nova);
  },
  async demandaDesrelacionar(demandaId, outraId) {
    // Como a regra "apagar": quem está numa das duas, mesmo arquivada.
    const [demanda_a, demanda_b] = parDaRelacao(demandaId, outraId);
    const ligada = bd.demandasRelacionadas!.some(l => l.demanda_a === demanda_a && l.demanda_b === demanda_b);
    if (!ligada || ![demanda_a, demanda_b].some(id => estouNaDemandaDoId(id, false))) return erro(SEM_PERMISSAO);
    bd.demandasRelacionadas = bd.demandasRelacionadas!.filter(l => !(l.demanda_a === demanda_a && l.demanda_b === demanda_b));
    gravar();
    return espera(undefined);
  },

  // ---------- tarefas (como supabase/migrations/20261027000020_tarefas.sql) ----------
  tarefasListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const r = filtrarTarefas(f).sort(ORDENS_PELO_TITULO[f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos']);
    return espera({ linhas: r.slice(de, de + por).map(comEtq('tarefas', tarefaLista)), total: r.length });
  },
  tarefasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrarTarefas(f).filter(t => (t.etapa_id || null) === (etapaId || null)).sort(ORDENS_PELO_TITULO[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(comEtq('tarefas', tarefaLista)), total: r.length });
  },
  tarefaObter: id => { const t = bd.tarefas!.find(x => x.id === id && vejoNoModulo('tarefas', x.id)); return espera(t ? tarefaCompleta(t) : null); },
  async tarefaCriar(dados) {
    const t: TarefaGuardada = { ...tarefaNova(), ...prepararTarefa(naContinuaSemDemanda({ pessoas: [], participantes: [], ...dados })) as Partial<TarefaGuardada>,
      id: novoId(), codigo: codigo() };
    // Como o gatilho aa_aprovacao (#313): também quem cria já concluída, sem aprovar.
    t.etapa_id = etapaComAprovacao(t, t.etapa_id, colunasDeTarefas(), membroLogado());
    bd.tarefas!.push(t); avisarInclusao('tarefas', t.id, null); auditar('tarefas', 'inclusao', t); gravar();
    return espera({ id: t.id, codigo: t.codigo });
  },
  async tarefaAtualizar(id, dados) {
    const t = acharTarefa(id), novos = prepararTarefa(dados, t), antes = equipeDoItemNoFalso('tarefas', id);
    historicoTarefa(t, novos);
    Object.assign(t, novos, { atualizado_em: agora(), atualizado_por: eu });
    avisarInclusao('tarefas', id, antes);
    auditar('tarefas', 'alteracao', t); gravar();
    return espera({ id, codigo: t.codigo });
  },
  async tarefasArquivar(ids, arquivar = true) {
    ids = ids.filter(id => { const t = bd.tarefas!.find(x => x.id === id); return !t || !soLeNoFalso(estaNaTarefa(t, membroLogado(), demandasDaTarefaNoFalso(t), meusGruposNoFalso())); });
    ids.forEach(id => {
      const t = bd.tarefas!.find(x => x.id === id); if (!t) return;
      historicoTarefa(t, { arquivado_em: arquivar ? agora() : null });
      Object.assign(t, { arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? eu : null, atualizado_em: agora() });
      esquecerArquivadoComContrato(id);
    });
    gravar(); return espera(ids.length);
  },
  async tarefasExcluir(ids) {
    let excluidas = 0;
    ids.forEach(id => {
      const t = bd.tarefas!.find(x => x.id === id);
      if (!t || !t.arquivado_em) return;
      apagarTarefa(t); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só tarefas arquivadas podem ser excluídas.' : '' });
  },
  async tarefaMover(id, etapaId, ordem) {
    const t = acharTarefa(id);
    if (soLeNoFalso(estaNaTarefa(t, membroLogado(), demandasDaTarefaNoFalso(t), meusGruposNoFalso()))) return erro('Você não tem permissão para fazer isso.');
    // Como o gatilho aa_aprovacao (#313): a que precisa de aprovação, concluída por quem não a pediu (mesmo um administrador), vai
    // para a coluna de aprovação; quem aprova e a tira de lá para as concluídas a aprova.
    const etapa = etapaComAprovacao(t, etapaId, colunasDeTarefas(), membroLogado(), t.etapa_id);
    gravarColunaDaTarefa(t, etapa, ordem); gravar();
    return etapa;   // sem a espera das leituras: como antes, a gravação responde já
  },
  // Como public.tarefa_aprovar e public.tarefa_devolver (#313).
  async tarefaAprovar(id) {
    const t = tarefaQueAprovo(id), fim = colunasDeTarefas().find(c => c.marco === 'concluido');
    if (!fim) return erro('O quadro de tarefas não tem a coluna das concluídas.');
    gravarColunaDaTarefa(t, fim.id, Date.now() / SEGUNDO); gravar();
    return espera(fim.id);
  },
  async tarefaDevolver(id, comentario) {
    const t = tarefaQueAprovo(id), texto = comentarioDaDevolucao(comentario), volta = colunaDaDevolucao(colunasDeTarefas());
    if (!volta) return erro('O quadro de tarefas não tem a coluna para onde a tarefa volta.');
    const c = { id: novoId(), modulo: 'tarefas' as const, cartao_id: id, autor_id: eu, ...prepararComentario('tarefas', texto, id), criado_em: agora(), editado_em: null };
    bd.comentarios!.push(c); mensagensDoComentario(c);
    gravarColunaDaTarefa(t, volta.id, Date.now() / SEGUNDO); gravar();
    return espera(volta.id);
  },
  tarefaHistorico: id => espera(bd.historicoTarefas!.filter(h => h.tarefa_id === id)),
  tarefasDaPessoa: (pessoaId, perfilId = null) => espera(bd.tarefas!.map(tarefaLigada(pessoaId, perfilId)).filter(t => t.papeis.length)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, TAREFAS_LIGADAS)),
  // Como a regra de leitura das tarefas: só as que quem lê vê (na contínua, #313, as tarefas avulsas dos outros não aparecem).
  tarefasDaDemanda: demandaId => espera(tarefasNaOrdemDoQuadro(bd.tarefas!.filter(t => demandasDaTarefa(t).includes(demandaId) && vejoNoModulo('tarefas', t.id)))),
  tarefasDoContrato: contratoId => espera(tarefasNaOrdemDoQuadro(bd.tarefas!.filter(t => contratosDaTarefa(t).includes(contratoId)))),
  // Como tarefasGraficos do supabase.ts: as tarefas que quem está logado vê (as não arquivadas e as arquivadas concluídas no período)
  // e o tempo do período, o próprio ou, para o administrador, o de todos (como as regras de leitura de tarefa_tempos).
  tarefasGraficos({ desde, pessoa }) {
    const inicio = inicioDoDia(desde);
    const daPessoaNaTarefa = (t: TarefaGuardada) => !pessoa || t.responsavel_id === pessoa || t.participantes.includes(pessoa);
    const tarefas = bd.tarefas!.filter(t => vejoNoModulo('tarefas', t.id) && daPessoaNaTarefa(t) && (!t.arquivado_em || (!!t.concluida_em && t.concluida_em >= inicio)));
    const tempos = bd.tempos!.filter(r => (r.perfil_id === eu || souAdmin()) && vejoATarefaDoTempo(r.tarefa_id) && (!pessoa || r.perfil_id === pessoa)
      && new Date(r.inicio).toISOString() >= inicio);
    return espera({
      tarefas: tarefas.map(t => ({ id: t.id, etapa_id: t.etapa_id, concluida_em: t.concluida_em, arquivado_em: t.arquivado_em })),
      tempos: tempos.map(r => ({ inicio: r.inicio, segundos: r.segundos }))
    });
  },

  // ---------- tempo nas tarefas (como supabase/migrations/20261030120000_tempo_nas_tarefas.sql) ----------
  async tempoIniciar(tarefaId, inicio, segundos) {
    acharTarefa(tarefaId);
    const id = Math.max(0, ...bd.tempos!.map(r => r.id)) + 1;
    bd.tempos!.push({ id, tarefa_id: tarefaId, perfil_id: eu, inicio, segundos, ajuste: false, motivo: null, corrigido_em: null, motivo_da_correcao: null }); gravar();
    return espera(id);
  },
  // Como privado.conferir_tempo e supabase.ts: o registro apagado (ou de outra pessoa) não muda nada, e o corrigido recusa o cronômetro
  // (PERIODO_CORRIGIDO no banco): nos dois, false.
  async tempoGravar(id, segundos) {
    const r = bd.tempos!.find(x => x.id === id && x.perfil_id === eu && !x.ajuste);
    if (!r || r.corrigido_em) return espera(false);
    if (segundos < r.segundos) return erro('O tempo contado não diminui: para corrigir, faça um ajuste.');
    r.segundos = segundos; gravar();
    return espera(true);
  },
  async tempoAjustar(tarefaId, segundos, motivo) {
    acharTarefa(tarefaId);
    if (!motivo.trim()) return erro('Diga o motivo do ajuste (ele fica registrado).');
    const id = Math.max(0, ...bd.tempos!.map(r => r.id)) + 1;
    bd.tempos!.push({ id, tarefa_id: tarefaId, perfil_id: eu, inicio: agora(), segundos, ajuste: true, motivo: motivo.trim(), corrigido_em: null, motivo_da_correcao: null }); gravar();
  },
  // Como a migração do apagar e corrigir (supabase/migrations/20261121164027_tempo_apagar_e_corrigir.sql): o dono ou um administrador;
  // a duração nos limites da tabela; tudo vai ao histórico da tarefa, sem a duração.
  async tempoCorrigir(id, { segundos, inicio, motivo }) {
    const r = registroQueMexo(id);
    if (!r) return erro(REGISTRO_DE_TEMPO_INTOCAVEL);
    if (!motivo.trim()) return erro('Diga o motivo da correção (ele fica no histórico da tarefa).');
    // A regra tempo_corrigido do banco: o motivo vai até TAMANHO_MOTIVO caracteres.
    if (motivo.trim().length > TAMANHO_MOTIVO) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    if (new Date(inicio).getTime() > Date.now() + DIA) return erro('O dia do registro não pode ser depois de hoje.');
    if (r.ajuste ? !segundos || Math.abs(segundos) > AJUSTE_MAXIMO : segundos < 0 || segundos > PERIODO_MAXIMO) return erro('A duração está fora do que o registro aceita.');
    const diaAntes = diaNoHistorico(r.inicio), diaDepois = diaNoHistorico(inicio);
    historicoDoTempo(r, NO_HISTORICO.corrigido(registroNoHistorico(nomeDoMembro(r.perfil_id), r.ajuste, r.inicio), diaAntes === diaDepois ? null : diaDepois, motivo));
    Object.assign(r, { segundos, inicio, corrigido_em: agora(), motivo_da_correcao: motivo.trim() }); gravar();
  },
  async tempoApagar(id) {
    const r = registroQueMexo(id);
    if (!r) return erro(REGISTRO_DE_TEMPO_INTOCAVEL);
    bd.tempos = bd.tempos!.filter(x => x !== r);
    historicoDoTempo(r, NO_HISTORICO.apagado(registroNoHistorico(nomeDoMembro(r.perfil_id), r.ajuste, r.inicio))); gravar();
  },
  async tempoDevolver(tarefaId, registro) {
    if (!souAdmin() && registro.perfil_id !== eu) return erro('Só quem registrou o tempo, ou um administrador, devolve o registro.');
    // Como public.tempo_devolver: a tarefa que quem pede vê (a mesma condição de apagar); o registro volta novo, sem a correção.
    if (!vejoATarefaDoTempo(tarefaId)) return erro('Tarefa não encontrada.');
    const id = Math.max(0, ...bd.tempos!.map(r => r.id)) + 1;
    const r = { ...registro, id, tarefa_id: tarefaId, motivo: registro.ajuste ? registro.motivo : null, corrigido_em: null, motivo_da_correcao: null };
    bd.tempos!.push(r);
    historicoDoTempo(r, NO_HISTORICO.devolvido(registroNoHistorico(nomeDoMembro(r.perfil_id), r.ajuste, r.inicio))); gravar();
    return espera(id);
  },
  // Como a regra de leitura do banco: cada um vê os próprios registros; os administradores, os de todos. O resumo usa todos.
  tempoDaTarefa: tarefaId => {
    const registros = bd.tempos!.filter(r => r.tarefa_id === tarefaId).sort((a, b) => a.inicio.localeCompare(b.inicio));
    const porPessoa = [...tempoPorPessoa(registros)].filter(([, s]) => s > 0), total = porPessoa.reduce((s, [, x]) => s + x, 0);
    const equipe = porPessoa.map(([perfil_id, s]) => ({ perfil_id, percentual: Math.round(1000 * s / total) / 10 })).sort((a, b) => b.percentual - a.percentual);
    return espera({ registros: registros.filter(r => souAdmin() || r.perfil_id === eu).map(({ tarefa_id: _t, ...r }) => r), equipe, total });
  },
  tempoDaDemanda: demandaId => espera(Math.max(0, bd.tempos!
    .filter(r => { const t = bd.tarefas!.find(x => x.id === r.tarefa_id); return !!t && demandasDaTarefa(t).includes(demandaId); }).reduce((s, r) => s + r.segundos, 0))),
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

  // ---------- listas das demandas, das tarefas e dos contratos (como supabase/migrations/20261027000018_listas_das_demandas.sql, a migração
  // 20261030130000 e a 20261119142702, dos grupos) ----------
  listasDoCartao: (modulo, id) => espera(bd.listas!.filter(l => l[CARTAO_DA_LISTA[modulo].campo] === id).sort((a, b) => a.ordem - b.ordem).map(listaLida)),
  // Como checklist_criar: a lista, os grupos e os itens de uma vez; se a árvore não serve, nada fica.
  async listaCriar(modulo, id, nome, arvore = []) {
    const { campo, achar, altero } = CARTAO_DA_LISTA[modulo];
    achar(id);
    if (!altero(id)) return erro(SEM_PERMISSAO);
    const ordem = Math.max(0, ...bd.listas!.filter(l => l[campo] === id).map(l => l.ordem)) + 1;
    const l = { id: novoId(), [campo]: id, nome: nomeDaLista(nome), ordem, criado_em: agora() };
    const plano = planoDoChecklist(arvore), chaves = new Map(plano.grupos.map(g => [g.chave, novoId()]));
    const idDoPai = (chave: string | null) => chave === null ? null : chaves.get(chave)!;
    const grupos = plano.grupos.map(g => ({ id: chaves.get(g.chave)!, lista_id: l.id, nome: nomeDoGrupoDoChecklist(g.nome), pai_id: idDoPai(g.pai), ordem: g.ordem, criado_em: agora() }));
    const itens = plano.itens.map(i => ({ id: novoId(), lista_id: l.id, texto: textoDoItem(i.texto), prazo: null, feito_em: null, feito_por: null, ordem: i.ordem,
      grupo_id: idDoPai(i.pai), criado_em: agora() }));
    const erroDoPlano = erroDaArvore({ grupos, itens });
    if (erroDoPlano) return erro(erroDoPlano);
    bd.listas!.push(l); bd.gruposDeLista!.push(...grupos); bd.itensDeLista!.push(...itens);
    gravar(); return espera(listaLida(l));
  },
  async listaAtualizar(id, { nome, ordem }) {
    const l = bd.listas!.find(x => x.id === id); if (!l) return erro('Checklist não encontrado.');
    if (!alteroALista(id)) return;
    Object.assign(l, nome === undefined ? {} : { nome: nomeDaLista(nome) }, ordem === undefined ? {} : { ordem }); gravar();
  },
  async listaExcluir(id) {
    if (!alteroALista(id)) return;
    bd.listas = bd.listas!.filter(l => l.id !== id);
    bd.itensDeLista = bd.itensDeLista!.filter(i => i.lista_id !== id);
    bd.gruposDeLista = bd.gruposDeLista!.filter(g => g.lista_id !== id);
    gravar();
  },
  async grupoDoChecklistCriar(listaId, nome, { pai_id, ordem }) {
    if (!bd.listas!.some(l => l.id === listaId)) return erro('Checklist não encontrado.');
    if (!alteroALista(listaId)) return erro(SEM_PERMISSAO);
    const g = { id: novoId(), lista_id: listaId, nome: nomeDoGrupoDoChecklist(nome), pai_id, ordem, criado_em: agora() };
    conferirArvore(listaId, () => { bd.gruposDeLista!.push(g); });
    gravar(); return espera(grupoLido(g));
  },
  async grupoDoChecklistAtualizar(id, { nome }) {
    const g = bd.gruposDeLista!.find(x => x.id === id); if (!g) return erro('Grupo não encontrado.');
    if (!alteroALista(g.lista_id)) return;
    g.nome = nomeDoGrupoDoChecklist(nome); gravar();
  },
  // Como o "on delete cascade": os subgrupos e os itens de dentro vão junto.
  async grupoDoChecklistExcluir(id) {
    if (!alteroALista(listaDoGrupo(id))) return;
    const fora = gruposDentro(id);
    bd.gruposDeLista = bd.gruposDeLista!.filter(g => !fora.has(g.id));
    bd.itensDeLista = bd.itensDeLista!.filter(i => !i.grupo_id || !fora.has(i.grupo_id));
    gravar();
  },
  // Sem "onde", como a versão anterior: no fim do checklist, depois da maior posição de grupos e itens, no primeiro nível.
  async itemCriar(listaId, texto, onde) {
    if (!bd.listas!.some(l => l.id === listaId)) return erro('Checklist não encontrado.');
    if (!alteroALista(listaId)) return erro(SEM_PERMISSAO);
    const { pai_id, ordem } = onde ?? { pai_id: null, ordem: Math.max(0, ...[...itensDaLista(listaId), ...gruposDaLista(listaId)].map(x => x.ordem)) + 1 };
    const item = { id: novoId(), lista_id: listaId, texto: textoDoItem(texto), prazo: null, feito_em: null, feito_por: null, ordem, grupo_id: pai_id, criado_em: agora() };
    conferirArvore(listaId, () => { bd.itensDeLista!.push(item); });
    gravar(); return espera(itemLido(item));
  },
  // Como o gatilho preparar: marcar anota agora e quem marcou; mexer num item já feito não troca isso; desmarcar apaga os dois.
  async itemAtualizar(id, { feito, texto, ...campos }) {
    const item = bd.itensDeLista!.find(x => x.id === id); if (!item) return erro('Item não encontrado.');
    // No banco, a linha que a regra esconde não volta, e o .single() de supabase.ts recusa.
    if (!alteroALista(item.lista_id)) return erro(NAO_DEU);
    Object.assign(item, campos, texto === undefined ? {} : { texto: textoDoItem(texto) });
    if (feito === false) Object.assign(item, { feito_em: null, feito_por: null });
    if (feito && !item.feito_em) Object.assign(item, { feito_em: agora(), feito_por: eu });
    gravar(); return espera(itemLido(item));
  },
  async itemExcluir(id) {
    if (!alteroALista(listaDoItem(id))) return;
    bd.itensDeLista = bd.itensDeLista!.filter(i => i.id !== id); gravar();
  },
  // Como checklist_reordenar: tudo de uma vez; um id que não é do checklist, ou uma árvore que não serve, desfaz tudo.
  async listaReordenar(listaId, posicoes) {
    if (!alteroALista(listaId)) return erro(NAO_ALTERA_O_CHECKLIST);
    const [grupos, itens] = [gruposDaLista(listaId), itensDaLista(listaId)];
    const doChecklist = (p: (typeof posicoes)[number]) => (p.tipo === 'grupo' ? grupos : itens).some(x => x.id === p.id);
    if (!posicoes.every(doChecklist)) return erro(CHECKLIST_MUDOU);
    conferirArvore(listaId, () => posicoes.forEach(p => {
      if (p.tipo === 'grupo') Object.assign(grupos.find(g => g.id === p.id)!, { pai_id: p.pai_id, ordem: p.ordem });
      else Object.assign(itens.find(i => i.id === p.id)!, { grupo_id: p.pai_id, ordem: p.ordem });
    }));
    gravar();
  },
  // Como checklist_acrescentar (20261119175248): o que renumerar, os grupos e os itens de uma vez; se algo não serve, nada fica.
  async listaAcrescentar(listaId, grupoId, arvore, onde) {
    if (!bd.listas!.some(l => l.id === listaId) || !alteroALista(listaId)) return erro(NAO_ALTERA_O_CHECKLIST);
    const atual = { grupos: gruposDaLista(listaId), itens: itensDaLista(listaId) }, plano = planoDoChecklist(arvore);
    const motivo = erroAoAcrescentar(arvoreDaLista(atual), grupoId, arvore)
      || (onde.ordens.length === plano.grupos.length + plano.itens.length ? '' : ARVORE_FORA_DE_ORDEM);
    if (motivo) return erro(motivo);
    const limparNos = (nos: NoDoModelo[]): NoDoModelo[] =>
      nos.map(n => n.filhos ? { texto: nomeDoGrupoDoChecklist(n.texto), filhos: limparNos(n.filhos) } : { texto: textoDoItem(n.texto) });
    const limpa = limparNos(arvore);
    if (!onde.renumerar.every(p => (p.tipo === 'grupo' ? atual.grupos : atual.itens).some(x => x.id === p.id))) return erro(CHECKLIST_MUDOU);
    const { lista, grupos } = comAArvoreNova(atual, grupoId, limpa, onde, novoId);
    const daLista = <T extends { criado_em: string }>(x: T) => ({ ...x, lista_id: listaId, criado_em: x.criado_em || agora() });
    conferirArvore(listaId, () => {
      bd.gruposDeLista = [...bd.gruposDeLista!.filter(g => g.lista_id !== listaId), ...lista.grupos.map(daLista)];
      bd.itensDeLista = [...bd.itensDeLista!.filter(i => i.lista_id !== listaId), ...lista.itens.map(daLista)];
    });
    gravar(); return espera(grupos);
  },

  // ---------- compromissos (como supabase/migrations/20261102141258_compromissos.sql) ----------
  compromissosListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const r = filtrarCompromissos(f).sort(ORDENS_COMPROMISSO[f.ordem && f.ordem !== 'manual' ? f.ordem : 'data']);
    return espera({ linhas: r.slice(de, de + por).map(comEtq('compromissos', compromissoLista)), total: r.length });
  },
  compromissosDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    const r = filtrarCompromissos(f).filter(c => (c.etapa_id || null) === (etapaId || null)).sort(ORDENS_COMPROMISSO[f.ordem || 'manual']);
    return espera({ linhas: r.slice(deslocamento, deslocamento + limite).map(comEtq('compromissos', compromissoLista)), total: r.length });
  },
  compromissosDoPeriodo(de, ate, f = {}) {
    const r = filtrarCompromissos({ ...f, situacao: 'ativos' }).filter(c => c.data >= de && c.data <= ate).sort(ORDENS_COMPROMISSO.data).slice(0, ITENS_DA_AGENDA);
    return espera(r.map(comEtq('compromissos', compromissoLista)));
  },
  compromissoObter: id => { const c = bd.compromissos!.find(x => x.id === id && vejoNoModulo('compromissos', x.id)); return espera(c ? compromissoCompleto(c) : null); },
  async compromissoCriar(dados) {
    const pronto = prepararCompromisso({ participantes: [], pessoas: [], processo_id: null, ...dados });
    const c = { titulo: null, hora: null, hora_fim: null, modalidade: null, local: null, resultado: null, observacoes: null, geral: false, processo_codigo: null, processo_numero: null, etapa_id: null, etapa_ordem: null,
      arquivado_em: null, arquivado_por: null, grupos: [], ...pronto, id: novoId(), codigo: codigo(), criado_por: eu, criado_em: agora(), atualizado_por: eu, atualizado_em: agora() } as CompromissoGuardado;
    bd.compromissos!.push(c); avisarInclusao('compromissos', c.id, null); auditar('compromissos', 'inclusao', { id: c.id, codigo: c.codigo }); gravar();
    return espera({ id: c.id, codigo: c.codigo });
  },
  async compromissoAtualizar(id, dados) {
    const c = acharCompromisso(id), novos = prepararCompromisso(dados, c), antes = equipeDoItemNoFalso('compromissos', id);
    historicoCompromisso(c, novos);
    Object.assign(c, novos, { atualizado_em: agora(), atualizado_por: eu });
    avisarInclusao('compromissos', id, antes);
    auditar('compromissos', 'alteracao', { id: c.id, codigo: c.codigo }); gravar();
    return espera({ id, codigo: c.codigo });
  },
  async compromissosArquivar(ids, arquivar = true) {
    ids.forEach(id => {
      const c = bd.compromissos!.find(x => x.id === id); if (!c) return;
      // Desarquivar confere a sala de novo, como o gatilho do banco.
      if (!arquivar) conferirSalaNoFalso({ ...c, arquivado_em: null }, c);
      historicoCompromisso(c, { arquivado_em: arquivar ? agora() : null });
      Object.assign(c, { arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? eu : null, atualizado_em: agora() });
    });
    gravar(); return espera(ids.length);
  },
  async compromissosExcluir(ids) {
    let excluidas = 0;
    ids.forEach(id => {
      const c = bd.compromissos!.find(x => x.id === id);
      if (!c || !c.arquivado_em) return;
      apagarCompromisso(c); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só compromissos arquivados podem ser excluídos, por quem os criou ou por um administrador.' : '' });
  },
  async compromissoMover(id, etapaId, ordem) {
    const c = acharCompromisso(id);
    conferirQuadroDoCompromisso(etapaId);
    // Sair da coluna "Cancelado" confere a sala de novo, como o gatilho do banco.
    conferirSalaNoFalso({ ...c, etapa_id: etapaId }, c);
    historicoCompromisso(c, { etapa_id: etapaId });
    Object.assign(c, { etapa_id: etapaId, etapa_ordem: ordem, atualizado_em: agora() }); gravar();
  },
  compromissoHistorico: id => espera(bd.historicoCompromissos!.filter(h => h.compromisso_id === id).slice(0, HISTORICO_DO_COMPROMISSO)),
  compromissosDaPessoa: (pessoaId, perfilId = null) => espera(bd.compromissos!.map(c => compromissoLigado(c, papeisNoCompromisso(c, pessoaId, perfilId)))
    .filter(c => c.papeis.length).sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`)).slice(0, COMPROMISSOS_LIGADOS)),
  compromissosDoProcesso: processoId => espera(bd.compromissos!.filter(c => c.processo_id === processoId).map(c => compromissoLigado(c, []))
    .sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`)).slice(0, COMPROMISSOS_LIGADOS)),
  salasListar: () => espera([...bd.salas!].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))),
  // ---------- funções dos participantes da tarefa (como supabase/migrations/20261122232702_tarefa_solicitante_e_funcoes.sql, #313) ----------
  funcoesNaTarefaListar: () => espera(funcoesNaOrdem(bd.funcoesNaTarefa!).map(f => ({ ...f }))),
  async funcaoNaTarefaCriar(dados) {
    if (!souAdmin()) return erro(SEM_PERMISSAO);
    const d = prepararFuncaoNaTarefa(dados) as DadosFuncaoNaTarefa;
    const f: FuncaoNaTarefa = { ...d, executa: !!d.executa, id: novoId(), ordem: Math.max(0, ...bd.funcoesNaTarefa!.map(x => x.ordem)) + 1 };
    bd.funcoesNaTarefa!.push(f); gravar();
    return espera({ ...f });
  },
  async funcaoNaTarefaAtualizar(id, dados) {
    const f = bd.funcoesNaTarefa!.find(x => x.id === id);
    if (!f || !souAdmin()) return erro(SEM_PERMISSAO);
    Object.assign(f, prepararFuncaoNaTarefa(dados, id)); gravar();
  },
  async funcaoNaTarefaExcluir(id) {
    const f = bd.funcoesNaTarefa!.find(x => x.id === id);
    if (!f || !souAdmin()) return erro(SEM_PERMISSAO);
    // Como o gatilho conferir_em_uso: a função em uso (em qualquer tarefa, arquivada ou não) não é apagada.
    const emUso = bd.tarefas!.filter(t => Object.values(funcoesDaTarefaNoFalso(t)).includes(id)).length;
    if (emUso) return erro(funcaoEmUso(f.nome, emUso));
    bd.funcoesNaTarefa = bd.funcoesNaTarefa!.filter(x => x.id !== id); gravar();
  },
  async salaCriar(dados) {
    if (!souAdmin()) return erro(SEM_PERMISSAO);
    const d = prepararSala(dados) as DadosSala;
    const s: Sala = { ...d, id: novoId(), ativa: true, criado_em: agora() };
    bd.salas!.push(s); gravar();
    return espera({ ...s });
  },
  async salaAtualizar(id, dados) {
    const s = bd.salas!.find(x => x.id === id);
    if (!s || !souAdmin()) return erro(SEM_PERMISSAO);
    Object.assign(s, prepararSala(dados, id), dados.ativa === undefined ? {} : { ativa: dados.ativa }); gravar();
  },
  salaOcupacao: (salaId, data, fora = null) => espera(bd.salas!.some(s => s.id === salaId)
    ? ocupacoesNoFalso(salaId, data, fora).map((c): OcupacaoDaSala => ({ id: c.id, codigo: c.codigo, tipo: c.tipo, hora: c.hora, hora_fim: c.hora_fim,
      titulo: vejoNoModulo('compromissos', c.id) ? c.titulo : null }))
    : []),
  compromissosDoItem: (modulo, itemId) => espera(bd.compromissoLigacoes!.filter(l => l.modulo === modulo && l.item_id === itemId)
    .flatMap(l => { const c = bd.compromissos!.find(x => x.id === l.compromisso_id && vejoNoModulo('compromissos', x.id)); return c ? [compromissoLigado(c, [])] : []; })
    .sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`)).slice(0, COMPROMISSOS_LIGADOS)),
  compromissoItens(id) {
    const ligacoes = bd.compromissos!.some(c => c.id === id && vejoNoModulo('compromissos', c.id)) ? ligacoesDoCompromisso(id) : [];
    const visiveis = ligacoes.flatMap(l => vejoOItem(l.modulo, l.item_id) ? [{ ...ITEM_NO_FALSO[l.modulo](l.item_id)!.item, modulo: l.modulo }] : []);
    return espera({ visiveis, ocultos: ligacoes.length - visiveis.length });
  },
  // Como o gatilho e as regras de ligar do banco, na mesma ordem: o item existe; repetido não faz nada; até ITENS_DO_COMPROMISSO; e quem
  // liga muda o compromisso ativo e vê o item.
  async compromissoLigar(id, modulo, itemId) {
    const c = bd.compromissos!.find(x => x.id === id);
    if (!c) return erro(SEM_PERMISSAO);
    if (!ITEM_NO_FALSO[modulo](itemId)) throw new Error('Item não encontrado neste escritório.');
    const pode = alteroCompromisso(c), ligacoes = ligacoesDoCompromisso(id);
    if (pode && ligacoes.some(l => l.modulo === modulo && l.item_id === itemId)) return espera(false);
    if (ligacoes.length >= ITENS_DO_COMPROMISSO) throw new Error(`Um compromisso pode ser ligado a no máximo ${ITENS_DO_COMPROMISSO} itens.`);
    if (!pode || !vejoOItem(modulo, itemId)) return erro(SEM_PERMISSAO);
    const item_nome = nomeDoItemDoCompromisso(modulo, itemId);
    bd.compromissoLigacoes!.push({ compromisso_id: id, modulo, item_id: itemId, item_nome, criado_em: agora() });
    historicoDaLigacao(id, item_nome, true); gravar();
    return espera(true);
  },
  // Como as funções do banco (20261122232804_compromissos_que_se_repetem.sql, #307), com as mesmas conferências e mensagens.
  async compromissoRepetir(id, regra) {
    const c = bd.compromissos!.find(x => x.id === id);
    if (!c || !alteroCompromisso(c)) return erro(SEM_PERMISSAO);
    if (!TIPOS_COMPROMISSO[c.tipo].repete) throw new Error('Audiência e perícia não se repetem.');
    if (c.repeticao_id) throw new Error('Este compromisso já se repete.');
    if (regra.ate !== null && regra.ate <= c.data) throw new Error('A data final precisa ser depois da data do compromisso.');
    if (!regraNoLimite(regra)) throw new Error(FORMATO_INVALIDO);
    const serie: RepeticaoGuardada = { id: novoId(), frequencia: regra.frequencia, intervalo: regra.intervalo, ate: regra.ate, vezes: regra.vezes, inicio: c.data, gerada_ate: c.data, criado_por: eu };
    bd.repeticoes!.push(serie);
    Object.assign(c, { repeticao_id: serie.id, repeticao_data: c.data });
    const criada = gerarRepeticoesNoFalso(serie);
    gravar(); return espera(criada);
  },
  async compromissoMudarSeguintes(id, q) {
    const c = bd.compromissos!.find(x => x.id === id);
    if (!c || !alteroCompromisso(c)) return erro(SEM_PERMISSAO);
    const serie = serieDoFalso(c.repeticao_id);
    if (!serie) throw new Error('Este compromisso não se repete.');
    if (!alteroAsDatasEmAberto(serie.id, c.repeticao_data!, null)) throw new Error(SEGUINTES_DE_OUTROS);
    const lista = estaEAsSeguintes(c), hora = horaComSegundos(q.hora), hora_fim = horaComSegundos(q.hora_fim);
    const mudar = (x: CompromissoGuardado, campos: Partial<CompromissoGuardado>) => {
      conferirSalaNoFalso({ ...x, ...campos }, x);
      historicoCompromisso(x, campos);
      Object.assign(x, campos, { atualizado_em: agora(), atualizado_por: eu });
    };
    if (q.data === c.data) {
      lista.forEach(x => mudar(x, { hora, hora_fim }));
      gravar(); return espera(lista.length);
    }
    // A data mudou: a série recomeça dali (a antiga termina na véspera desta), com o que faltava das vezes e a mesma data final.
    const resta = serie.vezes === null ? null : serie.vezes - vezDaData(serie, c.repeticao_data!);
    const nova: RepeticaoGuardada = { id: novoId(), frequencia: serie.frequencia, intervalo: serie.intervalo, inicio: q.data, gerada_ate: q.data, criado_por: eu,
      ate: serie.ate !== null ? (serie.ate > q.data ? serie.ate : q.data) : resta !== null && resta < 2 ? q.data : null, vezes: resta !== null && resta >= 2 ? resta : null };
    Object.assign(serie, { ate: somarDias(c.repeticao_data!, -1), vezes: null });
    bd.repeticoes!.push(nova);
    // Para a sala não se chocar com a própria série no meio do caminho, quem anda para a frente muda da última para a primeira.
    const ordem = lista.map((_, i) => i);
    if (q.data > c.data) ordem.reverse();
    for (const i of ordem) {
      const data = dataDaVez(nova, i);
      if ((nova.ate !== null && data > nova.ate) || (nova.vezes !== null && i + 1 > nova.vezes)) mudar(lista[i], { arquivado_em: agora(), arquivado_por: eu });
      else {
        mudar(lista[i], { data, hora, hora_fim, repeticao_id: nova.id, repeticao_data: data });
        if (data > nova.gerada_ate) nova.gerada_ate = data;
      }
    }
    gerarRepeticoesNoFalso(nova);
    gravar(); return espera(lista.length);
  },
  // Como public.compromisso_gerar_demandas (#307, parte B).
  async compromissoGerarDemandas(id, dias) {
    const c = bd.compromissos!.find(x => x.id === id);
    if (!c || !alteroCompromisso(c)) return erro(SEM_PERMISSAO);
    const serie = serieDoFalso(c.repeticao_id);
    if (!serie) throw new Error('Só o compromisso que se repete gera demanda.');
    if (!alteroAsDatasEmAberto(serie.id, null, hojeNaAgenda())) throw new Error(DEMANDA_NA_SERIE_DE_OUTROS);
    if (dias !== null && !(Number.isInteger(dias) && dias >= 1 && dias <= DEMANDA_DO_COMPROMISSO.diasMaximos)) throw new Error(FORMATO_INVALIDO);
    serie.demanda_dias_antes = dias;
    const criadas = dias === null ? [] : gerarDemandasNoFalso(serie.id, hojeNaAgenda(), eu);
    gravar(); return espera(criadas);
  },
  async compromissoArquivarSeguintes(id) {
    const c = bd.compromissos!.find(x => x.id === id);
    if (!c || !alteroCompromisso(c)) return erro(SEM_PERMISSAO);
    const serie = serieDoFalso(c.repeticao_id);
    if (!serie) throw new Error('Este compromisso não se repete.');
    if (!alteroAsDatasEmAberto(serie.id, c.repeticao_data!, null)) throw new Error(SEGUINTES_DE_OUTROS);
    const lista = estaEAsSeguintes(c);
    Object.assign(serie, { ate: somarDias(c.repeticao_data!, -1), vezes: null });
    lista.forEach(x => {
      historicoCompromisso(x, { arquivado_em: agora() });
      Object.assign(x, { arquivado_em: agora(), arquivado_por: eu, atualizado_em: agora() });
    });
    gravar(); return espera(lista.length);
  },
  async compromissoDesligar(id, modulo, itemId) {
    const c = bd.compromissos!.find(x => x.id === id);
    const ligacao = c && alteroCompromisso(c) ? ligacoesDoCompromisso(id).find(l => l.modulo === modulo && l.item_id === itemId) : undefined;
    if (!ligacao) return erro(SEM_PERMISSAO);
    bd.compromissoLigacoes = bd.compromissoLigacoes!.filter(l => l !== ligacao);
    historicoDaLigacao(id, nomeDoItemDoCompromisso(modulo, itemId, ligacao.item_nome), false); gravar();
  },
  prazosDoPeriodo(de, ate, f = {}) {
    const concluida = (etapa: string | null) => bd.colunas.find(c => c.id === etapa)?.marco === 'concluido';
    const noPeriodo = (x: { prazo: string | null; etapa_id: string | null }) => !!x.prazo && x.prazo >= de && x.prazo <= ate && !concluida(x.etapa_id);
    const naAgenda = (origem: PrazoNaAgenda['origem']) => (x: { id: string; codigo: string; titulo: string; prazo: string | null; prazo_hora?: string | null; responsavel_id: string }): PrazoNaAgenda =>
      ({ origem, id: x.id, codigo: x.codigo, titulo: x.titulo, prazo: x.prazo!, responsavel_id: x.responsavel_id, hora: fmtHora(x.prazo_hora) || null });
    // Como no banco: os concluídos saem antes do corte em ITENS_DA_AGENDA, em cada módulo, pela ordem do prazo.
    const primeiros = <T extends { prazo: string | null; etapa_id: string | null }>(itens: T[]) =>
      itens.filter(noPeriodo).sort((a, b) => a.prazo!.localeCompare(b.prazo!)).slice(0, ITENS_DA_AGENDA);
    return espera([...primeiros(filtrarDemandas(f)).map(naAgenda('demandas')), ...primeiros(filtrarTarefas(f)).map(naAgenda('tarefas'))]);
  },
  processosParaLigar: (texto = '') => espera(bd.processos!.filter(p => !p.arquivado_em && (!termo(texto) || buscaProcesso(p).includes(termo(texto)))).sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, PROCESSOS_PARA_LIGAR)
    .map(p => ({ id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, cliente_nome: nomesDosClientes(p.clientes) }))),

  // ---------- anotações (como supabase/migrations/20261117143714_anotacoes.sql) ----------
  anotacoesListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const r = filtrarAnotacoes(f).sort(ORDENS_ANOTACAO[f.ordem ?? 'recentes']);
    return espera({ linhas: r.slice(de, de + por).map(anotacaoLista), total: r.length });
  },
  anotacaoObter: id => { const a = bd.anotacoes!.find(x => x.id === id && vejoAnotacao(x)); return espera(a ?? null); },
  async anotacaoCriar(dados, ligarA, etiquetas = []) {
    const pronto = prepararAnotacao({ texto: '', participantes: [], ...dados });
    const a = { texto: '', participantes: [], pasta_id: null, ...pronto, id: novoId(), codigo: codigo(), ligada_a: [], arquivado_em: null, arquivado_por: null,
      criado_por: eu, criado_em: agora(), atualizado_por: eu, atualizado_em: agora() } as Anotacao;
    bd.anotacoes!.push(a);
    try {
      // Na ordem em que foram escolhidos; o repetido não faz nada (como em supabase.ts).
      for (const i of [ligarA ?? []].flat()) ligarNaAnotacaoFalsa(a, i.modulo, i.id);
      // As etiquetas com que ela nasce: só as do escritório (a chave estrangeira do banco).
      if (etiquetas.some(e => !bd.etiquetas!.some(x => x.id === e))) throw new Error(NAO_DEU);
      etiquetas.forEach(e => ligarEtiqueta('anotacoes', a.id, e));
    } catch (e) {
      // Se uma ligação ou uma etiqueta falha, nada fica gravado (como em supabase.ts).
      bd.anotacoes = bd.anotacoes!.filter(x => x.id !== a.id);
      bd.anotacaoLigacoes = bd.anotacaoLigacoes!.filter(l => l.anotacao_id !== a.id);
      bd.etiquetasAplicadas = bd.etiquetasAplicadas!.filter(x => !(x.modulo === 'anotacoes' && x.cartao_id === a.id));
      throw e;
    }
    avisarInclusao('anotacoes', a.id, null);
    auditar('anotacoes', 'inclusao', { id: a.id, codigo: a.codigo }); gravar();
    return espera({ id: a.id, codigo: a.codigo });
  },
  async anotacaoDuplicar(id, dados) {
    // Como em supabase.ts: só os itens que quem duplica vê, na ordem da original; se uma ligação falha, a cópia sai inteira.
    if (!bd.anotacoes!.some(x => x.id === id && vejoAnotacao(x))) return erro(SEM_PERMISSAO);
    const [{ visiveis }, etiquetas] = await Promise.all([SD.anotacaoItens(id), SD.etiquetasDoCartao('anotacoes', id)]);
    return SD.anotacaoCriar(dados, visiveis.map(i => ({ modulo: i.modulo, id: i.id })), etiquetas);
  },
  async anotacaoAtualizar(id, dados) {
    // Como a regra de alterar do banco: quem não altera (ou nem vê) não muda nada.
    const a = bd.anotacoes!.find(x => x.id === id);
    if (!a || !alteroAnotacao(a)) throw new Error(SEM_PERMISSAO);
    const novos = prepararAnotacao(dados, a);
    // Como no banco, a leitura confere também a linha nova: quem deixaria de ver a anotação não grava (sai por SD.cartaoSair).
    if (!vejoAnotacao({ ...a, ...novos })) throw new Error(SEM_PERMISSAO);
    const antes = equipeDoItemNoFalso('anotacoes', id);
    historicoAnotacao(a, novos);
    Object.assign(a, novos, { atualizado_em: agora(), atualizado_por: eu });
    avisarInclusao('anotacoes', id, antes);
    auditar('anotacoes', 'alteracao', { id: a.id, codigo: a.codigo }); gravar();
    return espera({ id, codigo: a.codigo });
  },
  async anotacaoGravarTexto(id, texto, esperado) {
    // Como no banco: quem não vê não acha a linha; mudada depois da leitura, nada muda (null); quem só lê não grava.
    const a = bd.anotacoes!.find(x => x.id === id);
    if (!a || !vejoAnotacao(a)) throw new Error(SEM_PERMISSAO);
    if (a.atualizado_em !== esperado) return espera(null);
    if (!alteroAnotacao(a)) throw new Error(SEM_PERMISSAO);
    const novos = prepararAnotacao({ texto }, a);
    historicoAnotacao(a, novos);
    Object.assign(a, novos, { atualizado_em: agora(), atualizado_por: eu });
    auditar('anotacoes', 'alteracao', { id: a.id, codigo: a.codigo }); gravar();
    return espera(a.atualizado_em);
  },
  async anotacoesArquivar(ids, arquivar = true) {
    let mudaram = 0;
    ids.forEach(id => {
      const a = bd.anotacoes!.find(x => x.id === id && vejoAnotacao(x));
      if (!a || !alteroAnotacao(a)) return;
      historicoAnotacao(a, { arquivado_em: arquivar ? agora() : null });
      Object.assign(a, { arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? eu : null, atualizado_em: agora(), atualizado_por: eu });
      auditar('anotacoes', 'alteracao', { id: a.id, codigo: a.codigo }); mudaram++;
    });
    if (ids.length && !mudaram) return erro(SEM_PERMISSAO);
    gravar(); return espera(mudaram);
  },
  async anotacoesExcluir(ids) {
    let excluidas = 0;
    ids.forEach(id => {
      const a = bd.anotacoes!.find(x => x.id === id && vejoAnotacao(x));
      if (!a || !excluiAAnotacao(a, membroLogado())) return;
      apagarAnotacao(a); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só anotações arquivadas podem ser excluídas, por quem as criou ou por um administrador.' : '' });
  },
  anotacaoHistorico: id => espera(bd.anotacoes!.some(a => a.id === id && vejoAnotacao(a))
    ? bd.historicoAnotacoes!.filter(h => h.anotacao_id === id).slice(0, HISTORICO_DA_ANOTACAO).map(({ anotacao_id: _a, ...h }) => h) : []),
  async anotacaoLigar(id, modulo, itemId) {
    const a = bd.anotacoes!.find(x => x.id === id);
    if (!a) return erro(SEM_PERMISSAO);
    const nova = ligarNaAnotacaoFalsa(a, modulo, itemId); gravar();
    return nova;
  },
  async anotacaoDesligar(id, modulo, itemId) {
    const a = bd.anotacoes!.find(x => x.id === id);
    const ligacao = a && ligaNaAnotacao(a, membroLogado(), chavesDaEquipe(), meusGruposNoFalso()) ? ligacoesDaAnotacao(id).find(l => l.modulo === modulo && l.item_id === itemId) : undefined;
    if (!ligacao) return erro(SEM_PERMISSAO);
    bd.anotacaoLigacoes = bd.anotacaoLigacoes!.filter(l => l !== ligacao);
    refazerLigadaA(id); gravar();
  },
  anotacaoItens(id) {
    const a = bd.anotacoes!.find(x => x.id === id && vejoAnotacao(x));
    const ligacoes = a ? ligacoesDaAnotacao(id) : [];
    const visiveis = ligacoes.flatMap(l => vejoOItem(l.modulo, l.item_id) ? [ITEM_NO_FALSO[l.modulo](l.item_id)!.item] : []);
    return espera({ visiveis, ocultos: ligacoes.length - visiveis.length });
  },
  anotacoesDoItem: (modulo, itemId) => espera(anotacoesLigadasAoItem(modulo, itemId).map(anotacaoLigada)),
  anotacoesDoItemComTexto: (modulo, itemId) => espera(anotacoesLigadasAoItem(modulo, itemId).map(anotacaoLigadaComTexto)),
  // A listagem de cada módulo, no banco fictício, ainda mostra tudo: aqui ficam só os itens que as regras do módulo deixam ver.
  itensParaLigar: async (modulo, termo) => (await PARA_LIGAR[modulo](termo)).filter(i => vejoOItem(i.modulo, i.id)).slice(0, ITENS_PARA_LIGAR),
  // Como em supabase.ts: as ativas que quem lê altera (privado.altero_a_anotacao), fora as já ligadas a este item, pela busca.
  anotacoesParaLigar: (modulo, itemId, texto) => espera(filtrarAnotacoes({ termo: texto, situacao: 'ativas' })
    .filter(a => alteroAnotacaoDoId(a.id) && !ligacoesDaAnotacao(a.id).some(l => l.modulo === modulo && l.item_id === itemId))
    .sort((a, b) => ORDENS_ANOTACAO.recentes(a, b) || a.id.localeCompare(b.id)).slice(0, ITENS_PARA_LIGAR)
    .map(a => ({ id: a.id, codigo: a.codigo, titulo: a.titulo, atualizado_em: a.atualizado_em, itens: ligacoesDaAnotacao(a.id).length }))),

  // ---------- ligar a um cartão um item que já existe (#341, etapa 2; como em supabase.ts) ----------
  demandasParaLigar: f => espera(paraLigarNoFalso(bd.demandas!, f, { altero: d => alteroNoFalso(estaNaDemanda(d, membroLogado(), meusGruposNoFalso())), busca: buscaDemanda,
    pessoas: d => d.clientes, sem: { contratos: d => d.contrato_id } })
    .map(d => ({ id: d.id, codigo: d.codigo, titulo: d.titulo, cliente_nome: nomesDosClientes(d.clientes), contrato_id: d.contrato_id, contrato_codigo: d.contrato_codigo, prazo: d.prazo, clientes: d.clientes }))),
  tarefasParaLigar: f => espera(paraLigarNoFalso(bd.tarefas!.filter(t => !f.doProcesso || !t.processo_id || t.processo_id === f.doProcesso), f, {
    altero: t => alteroNoFalso(estaNaTarefa(t, membroLogado(), null, meusGruposNoFalso())), busca: buscaTarefa, pessoas: t => t.pessoas,
    // "Sem demanda" (#313): sem nenhuma, ou só na contínua (a tarefa avulsa).
    sem: { demandas: t => demandasDaTarefa(t).find(id => !bd.demandas!.find(d => d.id === id)?.continua) ?? null, contratos: t => t.contrato_id, processos: t => t.processo_id }
  }).map(t => {
    // O contrato da demanda vem pela regra de leitura das demandas, como a junção do banco.
    const d = demandaDaTarefaNoFalso(t);
    return { id: t.id, codigo: t.codigo, titulo: t.titulo, pessoa_nome: nomesDosClientes(t.pessoas), prazo: t.prazo, demanda_id: t.demanda_id, demanda_codigo: t.demanda_codigo,
      contrato_id: t.contrato_id, processo_id: t.processo_id, pessoas: t.pessoas, contrato_da_demanda: d && vejoDemanda(d) ? d.contrato_id : null };
  })),
  compromissosParaLigar: f => espera(paraLigarNoFalso(bd.compromissos!, f, {
    altero: c => alteroNoFalso(souAdmin() || c.criado_por === eu || c.responsavel_id === eu || c.participantes.includes(eu)), busca: buscaCompromisso,
    pessoas: c => c.pessoas, sem: { processos: c => c.processo_id }
  }).map(c => ({ id: c.id, codigo: c.codigo, tipo: c.tipo, titulo: c.titulo, data: c.data, hora: c.hora, pessoa_nome: nomesDosClientes(c.pessoas), processo_id: c.processo_id, processo_numero: processoDoCompromisso(c)?.numero ?? c.processo_numero, pessoas: c.pessoas }))),
  processosParaPorCliente: f => espera(paraLigarNoFalso(bd.processos!, f, { altero: p => alteroNoFalso(alteraOProcesso(p, membroLogado(), meusGruposNoFalso())), busca: buscaProcesso, pessoas: p => p.clientes })
    .map(p => ({ id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, cliente_nome: nomesDosClientes(p.clientes), clientes: p.clientes }))),
  contratosParaLigar: f => espera(paraLigarNoFalso(bd.contratos!, f, { altero: k => alcancoContrato(k) && (alteroContrato(k) || !!bd.equipeEditaTudo), busca: buscaContrato })
    .map(k => ({ id: k.id, codigo: k.codigo, servico: k.servico, cliente_nome: nomeDoCliente(k) }))),

  // ---------- pastas dos documentos (como supabase/migrations/20261118120000_pastas_e_etiquetas_das_anotacoes.sql) ----------
  // Todo o escritório vê, cria, renomeia, move e apaga a vazia; as regras de nome e de ciclo são as de regras/pastas.ts.
  pastasListar: () => espera([...bd.pastas!].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))),
  async pastaCriar(nome, pastaMaeId) {
    const problema = erroDoNomeDaPasta(nome, bd.pastas!, pastaMaeId);
    if (problema) return erro(problema);
    if (pastaMaeId && !bd.pastas!.some(p => p.id === pastaMaeId)) return erro(PASTA_SUMIU);
    const p: Pasta = { id: novoId(), nome: nomeDaPasta(nome), pasta_mae_id: pastaMaeId, criada_por: eu, criada_em: agora() };
    bd.pastas!.push(p);
    auditar('anotacao_pastas', 'inclusao', { id: p.id, nome: p.nome }); gravar();
    return espera(p);
  },
  async pastaRenomear(id, nome) {
    const p = bd.pastas!.find(x => x.id === id);
    if (!p) return erro(PASTA_APAGADA);   // como no banco: nenhuma linha muda, um colega já a apagou
    const problema = erroDoNomeDaPasta(nome, bd.pastas!, p.pasta_mae_id, id);
    if (problema) return erro(problema);
    p.nome = nomeDaPasta(nome);
    auditar('anotacao_pastas', 'alteracao', { id: p.id, nome: p.nome }); gravar();
  },
  async pastaMover(id, pastaMaeId) {
    const p = bd.pastas!.find(x => x.id === id);
    if (!p) return erro(PASTA_APAGADA);   // como no banco: nenhuma linha muda, um colega já a apagou
    if (pastaMaeId && pastaMaeId !== id && !bd.pastas!.some(x => x.id === pastaMaeId)) return erro(PASTA_SUMIU);
    const problema = erroAoMoverPasta(bd.pastas!, id, pastaMaeId);
    if (problema) return erro(problema);
    p.pasta_mae_id = pastaMaeId;
    auditar('anotacao_pastas', 'alteracao', { id: p.id, nome: p.nome }); gravar();
  },
  async pastaExcluir(id) {
    const p = bd.pastas!.find(x => x.id === id);
    if (!p) return erro(PASTA_APAGADA);   // como no banco: nenhuma linha muda, um colega já a apagou
    // Como as chaves estrangeiras: as subpastas e todas as anotações contam, mesmo as que quem apaga não vê.
    if (bd.pastas!.some(x => x.pasta_mae_id === id) || bd.anotacoes!.some(a => a.pasta_id === id)) return erro(PASTA_COM_CONTEUDO);
    bd.pastas = bd.pastas!.filter(x => x.id !== id);
    auditar('anotacao_pastas', 'exclusao', { id: p.id, nome: p.nome }); gravar();
  },

  // ---------- andamentos e prazos do processo (como supabase/migrations/20261102125539_andamentos_e_prazos.sql) ----------
  processoAndamentos: processoId => espera(bd.andamentos!.filter(a => a.processo_id === processoId && !a.excluido_em).toSorted(porDataDoAndamento)
    .slice(0, ANDAMENTOS_DO_PROCESSO).map(comTarefa)),
  async processoAndamentoCriar(processoId, dados) {
    if (!processoAtivo(processoId)) return erro(SEM_PERMISSAO);
    const a: AndamentoGuardado = { tratada_em: null, tarefa_id: null, excluido_em: null, categoria: null, ...dados, id: novoId(), processo_id: processoId, criado_por: eu, criado_em: agora(), atualizado_em: agora() };
    conferirAndamento(a);
    bd.andamentos!.push(a);
    historicoDoAcompanhamento(processoId, 'andamento', null, linhaDoAndamento(a));
    auditar('processo_andamentos', 'inclusao', a); gravar();
    return espera(comTarefa(a));
  },
  async processoAndamentoAtualizar(id, dados) {
    const a = bd.andamentos!.find(x => x.id === id);
    if (!a || !processoAtivo(a.processo_id)) return erro(SEM_MUDANCA);
    // Como o gatilho acertar_categoria: quem muda só o tipo de sempre perde o tipo da lista que não combina mais.
    const novo = { ...comCategoriaAcertada(a, dados), atualizado_em: agora() };
    if (a.tarefa_id && novo.tarefa_id && novo.tarefa_id !== a.tarefa_id) return erro(TAREFA_JA_LIGADA);
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
  prazosDaTarefa: tarefaId => espera(bd.prazos!.filter(p => p.tarefa_id === tarefaId && !p.excluido_em && processoAtivo(p.processo_id) && vejoNoModulo('processos', p.processo_id))
    .map(comTarefa)),
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
    if (p.tarefa_id && novo.tarefa_id && novo.tarefa_id !== p.tarefa_id) return erro(TAREFA_JA_LIGADA);
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

  // ---------- processo e demanda (como supabase/migrations/20261102144922_processo_demandas.sql) ----------
  async processoDemandaLigar(processoId, demandaId, papel = 'originou') {
    const d = bd.demandas!.find(x => x.id === demandaId);
    if (!processoAtivo(processoId) || !d || soLeNoFalso(estaNaDemanda(d, membroLogado(), meusGruposNoFalso()))) return erro(SEM_PERMISSAO);
    const nova = !bd.processoDemandas!.some(l => l.processo_id === processoId && l.demanda_id === demandaId);
    if (nova) bd.processoDemandas!.push({ processo_id: processoId, demanda_id: demandaId, papel });
    gravar();
    return espera(nova);
  },
  // (como supabase/migrations/20261111095627_ligar_processo_existente.sql): desligar é de quem está na demanda.
  async processoDemandaDesligar(processoId, demandaId) {
    const d = bd.demandas!.find(x => x.id === demandaId);
    const ligada = bd.processoDemandas!.some(l => l.processo_id === processoId && l.demanda_id === demandaId);
    if (!ligada || !d || soLeNoFalso(estaNaDemanda(d, membroLogado(), meusGruposNoFalso()))) return erro(SEM_PERMISSAO);
    bd.processoDemandas = bd.processoDemandas!.filter(l => !(l.processo_id === processoId && l.demanda_id === demandaId));
    gravar();
    return espera(undefined);
  },
  // ---------- processo e contrato (como supabase/migrations/20261111095627_ligar_processo_existente.sql) ----------
  async contratoProcessoLigar(contratoId, processoId) {
    if (!processoAtivo(processoId) || !alteroContratoDoId(contratoId)) return erro(SEM_PERMISSAO);
    const nova = !bd.contratoProcessos!.some(l => l.contrato_id === contratoId && l.processo_id === processoId);
    if (nova) bd.contratoProcessos!.push({ contrato_id: contratoId, processo_id: processoId });
    gravar();
    return espera(nova);
  },
  async contratoProcessoDesligar(contratoId, processoId) {
    const ligado = bd.contratoProcessos!.some(l => l.contrato_id === contratoId && l.processo_id === processoId);
    if (!ligado || !alteroContratoDoId(contratoId)) return erro(SEM_PERMISSAO);
    bd.contratoProcessos = bd.contratoProcessos!.filter(l => !(l.contrato_id === contratoId && l.processo_id === processoId));
    gravar();
    return espera(undefined);
  },
  processosDoContrato: contratoId => espera({ ocultos: 0, visiveis: bd.contratoProcessos!.filter(l => l.contrato_id === contratoId).flatMap(l => {
    const p = bd.processos!.find(x => x.id === l.processo_id);
    return p ? [processoNoCartao(p)] : [];
  }) }),
  contratosDoProcesso(processoId) {
    const ligados = bd.contratoProcessos!.filter(l => l.processo_id === processoId).flatMap(l => bd.contratos!.filter(k => k.id === l.contrato_id));
    const visiveis = ligados.filter(alcancoContrato)
      .map(k => ({ id: k.id, codigo: k.codigo, servico: k.servico, cliente_nome: nomeDoCliente(k), etapa_id: k.etapa_id, arquivado_em: k.arquivado_em }));
    return espera({ visiveis, ocultos: ligados.length - visiveis.length });
  },
  demandasDoProcesso: processoId => espera(bd.processoDemandas!.filter(l => l.processo_id === processoId).flatMap(l => {
    const d = bd.demandas!.find(x => x.id === l.demanda_id);
    return d ? [{ id: d.id, codigo: d.codigo, titulo: d.titulo, objeto: d.objeto, prazo: d.prazo, prazo_hora: d.prazo_hora ?? null, etapa_id: d.etapa_id, arquivado_em: d.arquivado_em, criado_em: d.criado_em, contrato_id: d.contrato_id,
      criado_por: d.criado_por, responsavel_id: d.responsavel_id, colaboradores: d.colaboradores, papeis: [] }] : [];
  })),
  processosDaDemanda: demandaId => espera({ ocultos: 0, visiveis: bd.processoDemandas!.filter(l => l.demanda_id === demandaId).flatMap(l => {
    const p = bd.processos!.find(x => x.id === l.processo_id);
    return p ? [processoNoCartao(p)] : [];
  }) }),

  // ---------- caixa (como supabase/migrations/20261102175057_financeiro_caixa.sql) ----------
  financeiroContas: () => espera([...bd.contasFinanceiras!]),
  async financeiroContaCriar(dados) {
    const nome = dados.nome.trim();
    conferirConta(dados);
    if (bd.contasFinanceiras!.some(c => normal(c.nome) === normal(nome))) return erro('Já existe uma conta com esse nome.');
    const c: ContaFinanceira = { ...dados, nome, id: novoId(), arquivada_em: null };
    bd.contasFinanceiras!.push(c); auditar('financeiro_contas', 'inclusao', c); gravar();
    return espera({ ...c });
  },
  async financeiroContaAtualizar(id, dados) {
    const c = bd.contasFinanceiras!.find(x => x.id === id);
    if (!c) return erro(SEM_ACESSO_AO_CAIXA);
    const novo = { ...c, ...dados };
    conferirConta(novo);
    if (bd.contasFinanceiras!.some(x => x.id !== id && normal(x.nome) === normal(novo.nome))) return erro('Já existe uma conta com esse nome.');
    if (novo.saldo_inicial_em !== c.saldo_inicial_em && bd.lancamentos!.some(l => l.conta_id === id && !l.excluido_em && l.data < novo.saldo_inicial_em)) return erro('Há lançamentos antes dessa data. Escolha um dia igual ou anterior ao primeiro lançamento.');
    const ajustes: Historico['alteracoes'] = {};
    if (novo.saldo_inicial !== c.saldo_inicial) ajustes['Saldo inicial de ' + novo.nome] = { de: c.saldo_inicial, para: novo.saldo_inicial };
    if (novo.saldo_inicial_em !== c.saldo_inicial_em) ajustes['Início de ' + novo.nome] = { de: c.saldo_inicial_em, para: novo.saldo_inicial_em };
    if (Object.keys(ajustes).length) registrarAjuste(ajustes);
    Object.assign(c, dados, { nome: novo.nome.trim() }); auditar('financeiro_contas', 'alteracao', c); gravar();
    return espera(undefined);
  },
  // Como o gatilho conferir_exclusao (migração 20261120231028_excluir_conta.sql): o lançamento excluído também conta.
  async financeiroContaExcluir(id) {
    const c = bd.contasFinanceiras!.find(x => x.id === id);
    if (!c) return erro(SEM_ACESSO_AO_CAIXA);
    const motivo = motivoParaNaoExcluirConta({
      arquivada: !!c.arquivada_em,
      temLancamentos: [...bd.lancamentos!, ...bd.recebimentos!, ...bd.retiradas!].some(l => l.conta_id === id),
      temRepasses: bd.repasses!.some(r => r.conta_sugerida === id || r.conta_paga === id)
    });
    if (motivo) return erro(motivo);
    // Como o gatilho: o contrato fica sem conta de destino, e o histórico dele guarda o nome da conta, antes de ela sair.
    bd.contratos!.filter(k => k.conta_destino_id === id).forEach(k => { historicoContrato(k, { conta_destino_id: null }); k.conta_destino_id = null; });
    bd.contasFinanceiras!.splice(bd.contasFinanceiras!.indexOf(c), 1);
    auditar('financeiro_contas', 'exclusao', c); gravar();
    return espera(undefined);
  },
  financeiroArquivadasComLancamentos: () => espera(bd.contasFinanceiras!.filter(c => c.arquivada_em && bd.lancamentos!.some(l => l.conta_id === c.id)).map(c => c.id)),
  financeiroLancamentos: (contaId, de, ate) => espera(bd.lancamentos!.filter(l => l.conta_id === contaId && !l.excluido_em && l.data >= de && l.data <= ate)
    .toSorted((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em)).map(semOExcluido)),
  financeiroAjustesDeSaldo: () => espera(bd.lancamentos!.filter(l => !l.excluido_em && ehAjuste(l.categoria))
    .toSorted((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em)).map(semOExcluido)),
  financeiroSaldoAntes(contaId, data) {
    const conta = bd.contasFinanceiras!.find(c => c.id === contaId);
    if (!conta) return espera(0);
    return espera(bd.lancamentos!.filter(l => l.conta_id === contaId && !l.excluido_em && l.data < data).reduce((s, l) => s + (l.tipo === 'entrada' ? l.valor : -l.valor), conta.saldo_inicial));
  },
  async financeiroLancamentoCriar(dados) {
    const l = novoLancamento(dados);
    bd.lancamentos!.push(l); auditar('financeiro_lancamentos', 'inclusao', l); gravar();
    return espera(semOExcluido(l));
  },
  async financeiroLancamentoAtualizar(id, dados) {
    const l = bd.lancamentos!.find(x => x.id === id);
    if (!l) return erro(SEM_ACESSO_AO_CAIXA);
    if (l.origem) return erro(LANCAMENTO_DE_ORIGEM);
    if (l.excluido_em) return erro('Este lançamento foi excluído.');
    const novo = { ...l, ...dados };
    if (l.par_id && (novo.valor !== l.valor || novo.data !== l.data || novo.conta_id !== l.conta_id || novo.tipo !== l.tipo || novo.categoria !== l.categoria)) return erro('A transferência não muda depois de criada: exclua e lance de novo.');
    if (novo.conta_id !== l.conta_id || novo.data !== l.data) conferirContaEData(novo); else conferirLancamento(novo);
    historicoDoLancamento(l, novo);
    Object.assign(l, novo, { atualizado_em: agora() }); auditar('financeiro_lancamentos', 'alteracao', l); gravar();
    return espera(undefined);
  },
  async financeiroLancamentoExcluir(id) {
    const l = bd.lancamentos!.find(x => x.id === id);
    if (!l) return erro(SEM_ACESSO_AO_CAIXA);
    if (l.origem) return erro(LANCAMENTO_DE_ORIGEM);
    for (const x of bd.lancamentos!.filter(y => y.id === id || y.id === l.par_id)) {
      if (x.excluido_em) continue;
      const quando = agora();
      historicoDoLancamento(x, { excluido_em: quando });
      x.excluido_em = quando;
    }
    gravar();
    return espera(undefined);
  },
  async financeiroLancamentoRestaurar(id) {
    const l = bd.lancamentos!.find(x => x.id === id);
    if (!l) return erro(SEM_ACESSO_AO_CAIXA);
    if (l.origem) return erro(LANCAMENTO_DE_ORIGEM);
    const pontas = bd.lancamentos!.filter(y => y.id === id || y.id === l.par_id);
    pontas.forEach(conferirContaEData);
    for (const x of pontas) {
      if (!x.excluido_em) continue;
      bd.historicoLancamentos!.unshift({ id: Date.now() + Math.random(), lancamento_id: x.id, alteracoes: { excluido_em: { de: x.excluido_em, para: null } }, feito_por: eu, em: agora() });
      x.excluido_em = null;
    }
    gravar();
    return espera(undefined);
  },
  async financeiroTransferir({ de, para, data, valor, descricao }) {
    if (de === para) return erro('Escolha duas contas diferentes.');
    const saida = novoLancamento({ conta_id: de, data, tipo: 'saida', categoria: 'transferencia', valor, descricao });
    const entrada = novoLancamento({ conta_id: para, data, tipo: 'entrada', categoria: 'transferencia', valor, descricao, par_id: saida.id });
    saida.par_id = entrada.id;
    bd.lancamentos!.push(saida, entrada); gravar();
    return espera(saida.id);
  },
  financeiroHistorico: lancamentoId => espera(bd.historicoLancamentos!.filter(h => h.lancamento_id === lancamentoId).map(({ lancamento_id: _l, ...h }) => h).slice(0, HISTORICO_DO_PROCESSO)),
  financeiroDas: () => espera(bd.dasDoEscritorio!.toSorted((a, b) => a.mes.localeCompare(b.mes))),
  async financeiroDasSalvar(mes, aliquota) {
    if (erroDoDas({ mes, aliquota })) return erro(FORMATO_INVALIDO);
    const ja = bd.dasDoEscritorio!.find(a => a.mes === mes);
    if (!ja || ja.aliquota !== aliquota) registrarAjuste({ ['DAS de ' + mes]: { de: ja?.aliquota ?? null, para: aliquota } });
    if (ja) ja.aliquota = aliquota; else bd.dasDoEscritorio!.push({ mes, aliquota });
    gravar();
    return espera(undefined);
  },
  financeiroAjustes: () => espera(bd.ajustesFinanceiros!.slice(0, HISTORICO_DO_PROCESSO)),

  // ---------- parcelas, recebimentos e repasses (como supabase/migrations/20261102192042_financeiro_parcelas.sql) ----------
  parcelasDoContrato: contratoId => espera(bd.parcelas!.filter(p => p.contrato_id === contratoId && cuidoDoContrato(contratoId) && !p.excluido_em).toSorted((a, b) => a.numero - b.numero).map(semExcluida)),
  parcelasHistorico: contratoId => espera(bd.historicoParcelas!.filter(h => h.contrato_id === contratoId && cuidoDoContrato(contratoId)).map(({ contrato_id: _c, ...h }) => h).slice(0, HISTORICO_DO_PROCESSO)),
  parcelasDaPessoa(pessoaId) {
    const dela = new Set(bd.contratos!.filter(k => k.clientes.includes(pessoaId) && cuidoDoContrato(k.id)).map(k => k.id));
    return espera(bd.parcelas!.filter(p => dela.has(p.contrato_id) && !p.excluido_em && naLista(p)).toSorted((a, b) => b.vencimento.localeCompare(a.vencimento) || b.numero - a.numero).slice(0, PARCELAS_DA_PESSOA).map(parcelaDoEscritorio));
  },
  parcelasDoPeriodo: (de, ate, hoje) => espera(bd.parcelas!.filter(p => !p.excluido_em && cuidoDoContrato(p.contrato_id) && naLista(p) && ((p.vencimento >= de && p.vencimento <= ate) || (!p.recebida_em && p.vencimento < (hoje < de ? hoje : de))))
    .toSorted((a, b) => a.vencimento.localeCompare(b.vencimento)).map(parcelaDoEscritorio)),
  async parcelaCriar(contratoId, dados) {
    acharContrato(contratoId);
    if (dados.valor <= 0) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    const p = novaParcela(contratoId, dados);
    historicoDaParcela(contratoId, { ['Parcela ' + p.numero]: { de: null, para: `${fmtCentavos(p.valor)}, vence em ${fmtData(p.vencimento)}` } });
    auditar('contrato_parcelas', 'inclusao', p); gravar();
    return espera(semExcluida(p));
  },
  async parcelaAtualizar(id, dados) {
    const p = acharParcela(id);
    if (p.recebimento_id) return erro('Esta parcela já foi recebida. Estorne o recebimento antes de mudar.');
    if (p.excluido_em) return erro('Esta parcela foi excluída.');
    if (dados.valor <= 0) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    const alteracoes: Historico['alteracoes'] = {};
    if (dados.valor !== p.valor) alteracoes[`Parcela ${p.numero}: valor`] = { de: fmtCentavos(p.valor), para: fmtCentavos(dados.valor) };
    if (dados.vencimento !== p.vencimento) alteracoes[`Parcela ${p.numero}: vencimento`] = { de: fmtData(p.vencimento), para: fmtData(dados.vencimento) };
    if (Object.keys(alteracoes).length) historicoDaParcela(p.contrato_id, alteracoes);
    Object.assign(p, dados); auditar('contrato_parcelas', 'alteracao', p); gravar();
    return espera(undefined);
  },
  async parcelaCorrigirImportada(id, dados) {
    const p = acharParcela(id);
    if (!parcelaAntiga(p)) return erro('Só a parcela importada como paga é corrigida assim.');
    if (p.excluido_em) return erro('Esta parcela foi excluída.');
    if (dados.recebida_em > hojeNoFalso()) return erro('A data do recebimento não pode estar no futuro.');
    if (dados.recebido <= 0) return erro('Confira o valor recebido.');
    if (dados.valor <= 0) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    const alteracoes: Historico['alteracoes'] = {};
    if (dados.valor !== p.valor) alteracoes[`Parcela ${p.numero}: valor`] = { de: fmtCentavos(p.valor), para: fmtCentavos(dados.valor) };
    if (dados.vencimento !== p.vencimento) alteracoes[`Parcela ${p.numero}: vencimento`] = { de: fmtData(p.vencimento), para: fmtData(dados.vencimento) };
    if (dados.recebida_em !== p.recebida_em) alteracoes[`Parcela ${p.numero}: data recebida`] = { de: fmtData(p.recebida_em!), para: fmtData(dados.recebida_em) };
    if (dados.recebido !== p.recebido) alteracoes[`Parcela ${p.numero}: valor recebido`] = { de: fmtCentavos(p.recebido!), para: fmtCentavos(dados.recebido) };
    if (Object.keys(alteracoes).length) historicoDaParcela(p.contrato_id, alteracoes);
    Object.assign(p, dados); auditar('contrato_parcelas', 'alteracao', p); gravar();
    return espera(undefined);
  },
  async parcelaExcluir(id) {
    const p = acharParcela(id);
    if (p.recebimento_id) return erro('Esta parcela já foi recebida. Estorne o recebimento antes de mudar.');
    if (!p.excluido_em) historicoDaParcela(p.contrato_id, { ['Parcela ' + p.numero]: { de: null, para: 'Excluída' } });
    p.excluido_em ??= agora(); gravar();
    return espera(undefined);
  },
  async parcelaRestaurar(id) {
    const p = acharParcela(id);
    if (p.excluido_em) historicoDaParcela(p.contrato_id, { ['Parcela ' + p.numero]: { de: null, para: 'Devolvida' } });
    p.excluido_em = null; gravar();
    return espera(undefined);
  },
  async parcelasGerar(contratoId) {
    const k = acharContrato(contratoId);
    const colunas = bd.colunas.filter(c => c.modulo === 'contratos').map(c => ({ ...c, modulo: undefined }));
    if (!chegouAoAssinado(colunas, k.etapa_id, k.assinado_em) && !bd.contratosComDemandas!.includes(contratoId)) return erro('Este contrato ainda não foi assinado. As parcelas nascem na coluna de assinado.');
    if (bd.parcelas!.some(p => p.contrato_id === contratoId && !p.excluido_em)) return erro('Este contrato já tem parcelas.');
    if (!bd.contratosComParcelas!.includes(contratoId)) bd.contratosComParcelas!.push(contratoId);
    const quantas = gerarParcelas(k); gravar();
    return espera(quantas ?? 0);
  },
  async financeiroParaReceber(parcelaId, data) {
    const k = acharContrato(acharParcela(parcelaId).contrato_id);
    if (k.percentual_escritorio === null) return erro(SEM_PARTE_NA_CONTA);
    const das = dasDoMes(bd.dasDoEscritorio!, data.slice(0, 7));
    const ultimo = das ? bd.dasDoEscritorio!.filter(a => a.mes <= data.slice(0, 7)).toSorted((a, b) => b.mes.localeCompare(a.mes))[0] : null;
    return espera({
      parte_na_conta: k.percentual_escritorio as ParaReceber['parte_na_conta'],
      contas: bd.contasFinanceiras!.filter(c => !c.arquivada_em).map(c => ({ id: c.id, nome: c.nome, tem_das: c.tem_das })),
      das: ultimo ? [ultimo] : [],
      ...partesDe(k, data)
    });
  },
  async financeiroReceber({ parcela, data, valor, conta, taxa, categoria, forma, bancoRecebido, bancoEnvio, parte: parteAjustada, percentuais }) {
    const p = acharParcela(parcela);
    if (p.excluido_em) return erro('Esta parcela foi excluída.');
    if (p.recebida_em) return erro('Esta parcela já foi recebida.');
    const k = acharContrato(p.contrato_id);
    // Como public.financeiro_receber_completo: a parte e os percentuais ajustados só neste recebimento; 0 tira a pessoa.
    const parte = (parteAjustada ?? k.percentual_escritorio) as ParaReceber['parte_na_conta'] | null;
    if (parte === null) return erro('O contrato não diz quanto vai para a conta da empresa. Escolha aqui ou preencha em "Atualizar contrato".');
    if (percentuais?.some(x => x.percentual < 0 || x.percentual > 100)) return erro('Cada percentual precisa ficar entre 0 e 100.');
    const c = bd.contasFinanceiras!.find(x => x.id === conta);
    if (!c) return erro('Conta não encontrada neste escritório.');
    const das = dasDoMes(bd.dasDoEscritorio!, data.slice(0, 7));
    if (c.tem_das && !das) return erro('Nenhum DAS lançado até este mês. Peça a um administrador para lançar.');
    const aliquota = c.tem_das ? das!.aliquota : 0, doContrato = partesDe(k, data);
    const partes = { ...doContrato, terceiros: doContrato.terceiros.map(t => ({ ...t, percentual: percentuais?.find(x => x.id === t.id)?.percentual ?? t.percentual })).filter(t => t.percentual > 0) };
    const d = dividirRecebimento({ valor, parteNaConta: parte, contaComDas: c.tem_das, aliquotaDas: aliquota, taxaMaquina: taxa,
      terceiros: partes.terceiros.map(t => ({ id: t.id, percentual: t.percentual })), socioIndicador: partes.socio_indicador?.id ?? null, responsavelSocio: partes.responsavel_socio });
    const texto = `${nomesDosClientes(k.clientes)} (${k.codigo}, parcela ${p.numero})`.slice(0, 280);
    const entrada = novoLancamento({ conta_id: conta, data, tipo: 'entrada', categoria: 'recebimento', valor: d.naConta, descricao: 'Recebimento: ' + texto, origem: 'recebimento' });
    bd.lancamentos!.push(entrada);
    // Abaixo da parte integral, a taxa é do advogado e não passa pela conta.
    const saidaTaxa = parte === PARTE_INTEGRAL && d.taxaMaquina > 0 ? novoLancamento({ conta_id: conta, data, tipo: 'saida', categoria: 'despesa', valor: d.taxaMaquina, descricao: 'Taxa da máquina: ' + texto, origem: 'recebimento' }) : null;
    if (saidaTaxa) bd.lancamentos!.push(saidaTaxa);
    const r: RecebimentoGuardado = {
      id: novoId(), responsavel_id: k.responsavel_id, parcela_id: p.id, contrato_id: k.id, conta_id: conta, data, valor, taxa_maquina: d.taxaMaquina, aliquota_das: aliquota, parte_na_conta: parte, responsavel_socio: partes.responsavel_socio,
      na_conta: d.naConta, ficou_com_advogado: d.ficouComOAdvogado, das: d.das, liquido: d.liquido, escritorio: d.escritorio, responsavel_recebe: d.responsavelRecebe, responsavel_fica: d.responsavelFica,
      escritorio_final: d.escritorioFinal, contribuicao_socio: d.contribuicaoDoSocio, terceiros: partes.terceiros.map(t => ({ ...t, valor: d.terceiros.find(x => x.id === t.id)!.valor })),
      socio_indicador: partes.socio_indicador && d.socioIndicador ? { ...partes.socio_indicador, valor: d.socioIndicador.valor } : null,
      estornado_em: null, lancamento_id: entrada.id, lancamento_taxa_id: saidaTaxa?.id ?? null, ...socioDoRecebimento(k, partes.responsavel_socio),
      categoria: categoria ?? k.categoria, forma_pagamento: forma ?? null, banco_recebido: bancoRecebido || null, banco_envio: bancoEnvio || null
    };
    bd.recebimentos!.push(r);
    const repasse = (tipo: Repasse['tipo'], nome: string, valorDele: number, perfilId: string | null, pessoaId: string | null) => bd.repasses!.push({ id: novoId(), recebimento_id: r.id, tipo, nome, descricao: texto, valor: valorDele, conta_sugerida: conta, conta_paga: null, pago_em: null, criado_em: agora(), cancelado_em: null, lancamento_id: null, perfil_id: perfilId, pessoa_id: pessoaId });
    if (d.responsavelRecebe > 0) repasse('responsavel', EQUIPE.find(m => m.id === k.responsavel_id)?.nome ?? 'Usuário removido', d.responsavelRecebe, k.responsavel_id, null);
    if (partes.socio_indicador && d.socioIndicador) repasse('socio_indicador', partes.socio_indicador.nome, d.socioIndicador.valor, null, partes.socio_indicador.id);
    Object.assign(p, { recebimento_id: r.id, recebida_em: data, recebido: valor });
    if (!k.primeiro_pagamento) k.primeiro_pagamento = data;
    historicoDaParcela(k.id, { ['Parcela ' + p.numero]: { de: null, para: `Recebida em ${fmtData(data)}: ${fmtCentavos(valor)}` } });
    auditar('financeiro_recebimentos', 'inclusao', r); gravar();
    return espera(r.id);
  },
  financeiroContratosDaCarteira: () => espera(bd.contratos!.filter(k => vejoContrato(k) && !k.arquivado_em)
    .map(({ id, codigo, categoria, responsavel_id, assinado_em, valor, descontos, objetos }) => ({ id, codigo, categoria, responsavel_id, assinado_em, valor, descontos, objetos }))),
  financeiroRecebimentosDoPeriodo: (de, ate) => espera(bd.recebimentos!.filter(r => !r.estornado_em && r.data >= de && r.data <= ate && cuidoDoContrato(r.contrato_id))
    .map(({ estornado_em: _e, lancamento_id: _l, lancamento_taxa_id: _t, socio_pessoa_id: _s, socio_nome: _n, ...r }) => r)),
  financeiroRecebimentoTemPagamento(recebimentoId) {
    const r = bd.recebimentos!.find(x => x.id === recebimentoId);
    if (!r || !cuidoDoContrato(r.contrato_id)) return erro('Recebimento não encontrado.');
    return espera(recebimentoTemPagamento(r.id));
  },
  async financeiroCorrigirRecebimento(recebimentoId, dados) {
    // Como public.financeiro_corrigir_recebimento: só sem nada pago; estorna e registra de novo, com o motivo no registro.
    if (!dados.motivo.trim()) return erro('Diga o motivo da correção.');
    const r = bd.recebimentos!.find(x => x.id === recebimentoId);
    if (!r || !cuidoDoContrato(r.contrato_id)) return erro('Só o responsável pelo contrato ou um administrador corrige o recebimento.');
    if (r.estornado_em) return erro('Este recebimento já foi estornado.');
    if (recebimentoTemPagamento(r.id)) return erro('Já há pagamento feito deste recebimento: ele fica como está. Lance um registro de correção.');
    await SD.financeiroEstornar(r.id);
    const novo = await SD.financeiroReceber({ ...dados, parcela: r.parcela_id });
    auditar('financeiro_recebimentos', 'alteracao', { id: novo, nome: 'Correção: ' + dados.motivo.trim() }); gravar();
    return novo;
  },
  financeiroLancarCorrecao({ recebimento, data, valor, conta, motivo }) {
    if (!souAdmin()) return erro('Só um administrador lança a correção no caixa.');
    if (!motivo.trim()) return erro('Diga o motivo da correção.');
    const r = bd.recebimentos!.find(x => x.id === recebimento);
    if (!r) return erro('Recebimento não encontrado.');
    if (r.estornado_em) return erro('Este recebimento foi estornado: não há o que corrigir.');
    if (!(valor > 0)) return erro('Informe o valor da correção.');
    if (!bd.contasFinanceiras!.some(c => c.id === conta && !c.arquivada_em)) return erro('Conta não encontrada neste escritório.');
    const k = acharContrato(r.contrato_id);
    const l = { ...novoLancamento({ conta_id: conta, data, tipo: 'saida', categoria: 'correcao_recebimento', valor, descricao: `Correção do recebimento de ${nomesDosClientes(k.clientes)} (${k.codigo}): ${motivo.trim()}`.slice(0, 300) }), corrige_recebimento: r.id };
    bd.lancamentos!.push(l); auditar('financeiro_lancamentos', 'inclusao', l); gravar();
    return espera(l.id);
  },
  financeiroRecebimentoDoLancamento(lancamentoId) {
    const r = bd.recebimentos!.find(x => (x.lancamento_id === lancamentoId || x.lancamento_taxa_id === lancamentoId) && !x.estornado_em);
    if (!r) return espera(null);
    const { responsavel_id: _r, estornado_em: _e, lancamento_id: _l, lancamento_taxa_id: _t, socio_pessoa_id: _s, socio_nome: _n, ...gravado } = r;
    return espera(gravado);
  },
  financeiroRecebimento(id) {
    const r = bd.recebimentos!.find(x => x.id === id);
    if (!r) return espera(null);
    const { responsavel_id: _r, estornado_em: _e, lancamento_id: _l, lancamento_taxa_id: _t, socio_pessoa_id: _s, socio_nome: _n, ...gravado } = r;
    return espera(gravado);
  },
  async financeiroEstornar(id) {
    const r = bd.recebimentos!.find(x => x.id === id);
    if (!r) return erro('Só o responsável pelo contrato ou um administrador estorna o recebimento.');
    if (r.estornado_em) return erro('Este recebimento já foi estornado.');
    const dele = bd.repasses!.filter(x => x.recebimento_id === id);
    if (dele.some(x => x.pago_em)) return erro('Há repasse já pago deste recebimento. Peça a um administrador para desfazer o pagamento antes.');
    if (bd.terceirosPagos!.some(m => m.recebimento_id === id)) return erro('Há valor já marcado como pago a participante ou indicador deste recebimento. É preciso desfazer a marcação antes. Peça a quem recebeu o dinheiro ou a um administrador.');
    const quando = agora();
    r.estornado_em = quando;
    dele.forEach(x => { x.cancelado_em = quando; });
    bd.lancamentos!.filter(l => l.id === r.lancamento_id || l.id === r.lancamento_taxa_id).forEach(l => { l.excluido_em = quando; });
    const p = acharParcela(r.parcela_id);
    Object.assign(p, { recebimento_id: null, recebida_em: null, recebido: null });
    historicoDaParcela(r.contrato_id, { ['Parcela ' + p.numero]: { de: null, para: 'Recebimento estornado' } });
    gravar();
    return espera(undefined);
  },
  async financeiroRestaurarRecebimento(id) {
    const r = bd.recebimentos!.find(x => x.id === id);
    if (!r) return erro('Só o responsável pelo contrato ou um administrador desfaz o estorno.');
    if (!r.estornado_em) return espera(undefined);
    const p = acharParcela(r.parcela_id);
    if (p.excluido_em) return erro('Esta parcela foi excluída.');
    if (p.recebimento_id) return erro('Esta parcela já foi recebida de novo.');
    const pontas = bd.lancamentos!.filter(l => l.id === r.lancamento_id || l.id === r.lancamento_taxa_id);
    pontas.forEach(conferirContaEData);
    r.estornado_em = null;
    bd.repasses!.filter(x => x.recebimento_id === id).forEach(x => { x.cancelado_em = null; });
    pontas.forEach(l => { l.excluido_em = null; });
    Object.assign(p, { recebimento_id: r.id, recebida_em: r.data, recebido: r.valor });
    historicoDaParcela(r.contrato_id, { ['Parcela ' + p.numero]: { de: null, para: `Recebida em ${fmtData(r.data)}: ${fmtCentavos(r.valor)}` } });
    gravar();
    return espera(undefined);
  },
  financeiroRepasses: (de, ate) => espera(bd.repasses!.filter(x => !x.cancelado_em && (!x.pago_em || (x.pago_em >= de && x.pago_em <= ate)))
    .toSorted((a, b) => a.criado_em.localeCompare(b.criado_em)).map(({ cancelado_em: _c, lancamento_id: _l, perfil_id: _f, pessoa_id: _p, ...x }) => x)),
  async financeiroPagarRepasse(id, conta, data) {
    const x = bd.repasses!.find(y => y.id === id);
    if (!x) return erro('Repasse não encontrado neste escritório.');
    if (x.cancelado_em) return erro('O recebimento deste repasse foi estornado.');
    if (x.pago_em) return erro('Este repasse já foi pago.');
    if (!bd.contasFinanceiras!.some(c => c.id === conta)) return erro('Conta não encontrada neste escritório.');
    const saida = novoLancamento({ conta_id: conta, data, tipo: 'saida', categoria: CATEGORIA_DO_REPASSE[x.tipo], valor: x.valor, descricao: `Repasse a ${x.nome}: ${x.descricao}`.slice(0, 300), origem: 'repasse' });
    bd.lancamentos!.push(saida);
    Object.assign(x, { pago_em: data, conta_paga: conta, lancamento_id: saida.id }); gravar();
    return espera(undefined);
  },
  async financeiroDesfazerPagamento(id) {
    const x = bd.repasses!.find(y => y.id === id);
    if (!x) return erro('Repasse não encontrado neste escritório.');
    if (!x.pago_em) return espera(undefined);
    bd.lancamentos!.filter(l => l.id === x.lancamento_id).forEach(l => { l.excluido_em = agora(); });
    Object.assign(x, { pago_em: null, conta_paga: null, lancamento_id: null }); gravar();
    return espera(undefined);
  },
  conferenciaListar: (ano, responsavel) => espera(bd.conferencia!.filter(l => l.ano === ano && (!responsavel || l.responsavel_id === responsavel))
    .map(l => {
      const p = l.parcela_id ? bd.parcelas!.find(x => x.id === l.parcela_id) : null;
      return { ...l, data_pago: p?.recebida_em ?? l.data_pago, valor_pago: p?.recebido ?? l.valor_pago };
    })
    .toSorted((a, b) => (b.data_pago ?? b.data_caixa ?? '').localeCompare(a.data_pago ?? a.data_caixa ?? '') || a.cliente.localeCompare(b.cliente))),
  conferenciaResumo: () => espera(resumoDaConferencia(bd.conferencia!)),
  async conferenciaMarcar(id, situacao, observacao) {
    const l = bd.conferencia!.find(x => x.id === id);
    if (!l) return erro('Só o responsável pela linha ou um administrador confere.');
    const texto = observacao?.trim() || null;
    if (texto && texto.length > TAMANHO_CONFERENCIA.observacao) return erro('A observação está longa demais.');
    const alteracoes: Historico['alteracoes'] = {};
    if (situacao !== l.situacao) alteracoes['Situação'] = { de: l.situacao, para: situacao };
    if (texto !== l.observacao) alteracoes['Observação'] = { de: l.observacao, para: texto };
    if (Object.keys(alteracoes).length) bd.historicoConferencia!.unshift({ id: novoId(), conferencia_id: id, alteracoes, feito_por: eu, em: agora() });
    const marcou = !!situacao || !!texto;
    Object.assign(l, { situacao, observacao: texto, marcado_por: marcou ? eu : null, marcado_em: marcou ? agora() : null });
    gravar();
    return espera(undefined);
  },
  async conferenciaCorrigir(id, data, valor) {
    const l = bd.conferencia!.find(x => x.id === id);
    if (!l) return erro('Só o responsável pela linha ou um administrador corrige.');
    if (data > hojeNoFalso()) return erro('A data do pagamento não pode estar no futuro.');
    if (valor <= 0) return erro('Confira o valor pago.');
    const p = l.parcela_id ? bd.parcelas!.find(x => x.id === l.parcela_id) : null;
    if (p?.recebimento_id) return erro('Esta parcela foi recebida pelo caixa. Corrija por lá.');
    const alteracoes: Historico['alteracoes'] = {};
    if (data !== l.data_pago) alteracoes['Pago em'] = { de: l.data_pago ? fmtData(l.data_pago) : null, para: fmtData(data) };
    if (valor !== l.valor_pago) alteracoes['Valor pago'] = { de: l.valor_pago === null ? null : fmtCentavos(l.valor_pago), para: fmtCentavos(valor) };
    if (Object.keys(alteracoes).length) bd.historicoConferencia!.unshift({ id: novoId(), conferencia_id: id, alteracoes, feito_por: eu, em: agora() });
    Object.assign(l, { data_pago: data, valor_pago: valor });
    if (p?.recebida_em && !p.excluido_em) Object.assign(p, { recebida_em: data, recebido: valor });
    gravar();
    return espera(undefined);
  },
  conferenciaHistorico: id => espera(bd.historicoConferencia!.filter(h => h.conferencia_id === id).map(({ conferencia_id: _c, ...h }) => h).slice(0, HISTORICO_DO_PROCESSO)),
  financeiroMeusValores(de, ate) {
    const minhaPessoa = EQUIPE.find(m => m.id === eu)?.pessoa_id;
    const linhas = bd.recebimentos!.filter(r => !r.estornado_em && r.data <= ate).flatMap(r => {
      const k = bd.contratos!.find(x => x.id === r.contrato_id);
      const base = { recebimento_id: r.id, contrato_codigo: k?.codigo ?? '', cliente_nome: k ? nomesDosClientes(k.clientes) : '', parcela_numero: bd.parcelas!.find(p => p.id === r.parcela_id)?.numero ?? 0, recebido_em: r.data };
      const linha = (papel: MeuValor['papel'], valor: number, pagoEm: string | null, deQuem: string): MeuValor =>
        ({ ...base, papel, valor, situacao: pagoEm ? 'recebido' : 'a_receber', pago_em: pagoEm, de_quem: deQuem });
      const repasses = bd.repasses!.filter(x => x.recebimento_id === r.id && !x.cancelado_em);
      const pagoAMim = bd.terceirosPagos!.find(m => m.recebimento_id === r.id && m.pessoa_id === minhaPessoa)?.pago_em ?? null;
      // Se o responsável está na lista de terceiros, ele não passa nada a si mesmo: esse valor volta para a linha dele.
      const parteDoResponsavel = r.responsavel_fica + r.terceiros.filter(t => t.id === pessoaDoResponsavel(r)).reduce((soma, t) => soma + t.valor, 0);
      return [
        ...repasses.filter(x => x.tipo === 'responsavel' && x.perfil_id === eu && parteDoResponsavel > 0).map(x => linha('responsavel', parteDoResponsavel, x.pago_em, 'escritório')),
        ...(r.responsavel_id === eu && r.ficou_com_advogado > 0 && parteDoResponsavel > 0 ? [linha('responsavel', parteDoResponsavel, r.data, 'cliente')] : []),
        ...repasses.filter(x => x.tipo === 'socio_indicador' && x.pessoa_id === minhaPessoa).map(x => linha('indicador', x.valor, x.pago_em, 'escritório')),
        ...r.terceiros.filter(t => t.id === minhaPessoa && t.valor > 0 && t.id !== pessoaDoResponsavel(r)).map(t =>
          linha(t.papel ?? (k?.indicador_id === minhaPessoa ? 'indicador' : 'participante'), t.valor, pagoAMim, nomeDoResponsavel(r)))
      ];
    }).filter(l => l.recebido_em >= de || !l.pago_em);
    return espera(linhas.toSorted((a, b) => a.recebido_em.localeCompare(b.recebido_em) || a.contrato_codigo.localeCompare(b.contrato_codigo) || a.parcela_numero - b.parcela_numero || a.papel.localeCompare(b.papel)));
  },
  financeiroAPassar(de, ate) {
    const linhas = bd.recebimentos!.filter(r => !r.estornado_em && marcoOQueRecebi(r)).flatMap(r => {
      const k = bd.contratos!.find(x => x.id === r.contrato_id);
      return r.terceiros.filter(t => t.valor > 0 && t.id !== pessoaDoResponsavel(r)).map((t): ValorAPassar => ({
        recebimento_id: r.id, pessoa_id: t.id, nome: t.nome, valor: t.valor, contrato_codigo: k?.codigo ?? '', cliente_nome: k ? nomesDosClientes(k.clientes) : '',
        parcela_numero: bd.parcelas!.find(p => p.id === r.parcela_id)?.numero ?? 0, recebido_em: r.data,
        pago_em: bd.terceirosPagos!.find(m => m.recebimento_id === r.id && m.pessoa_id === t.id)?.pago_em ?? null, quem_paga: nomeDoResponsavel(r)
      }));
    }).filter(v => (v.recebido_em >= de && v.recebido_em <= ate) || (!v.pago_em && v.recebido_em < de));
    return espera(linhas.toSorted((a, b) => a.recebido_em.localeCompare(b.recebido_em) || a.contrato_codigo.localeCompare(b.contrato_codigo) || a.parcela_numero - b.parcela_numero || a.nome.localeCompare(b.nome)));
  },
  async financeiroTerceiroMarcarPago(recebimento, pessoa, data) {
    const r = recebimentoDoTerceiro(recebimento, pessoa);
    if (!dataExiste(data) || !anoAceito(data)) return erro('Informe uma data válida.');
    if (bd.terceirosPagos!.some(m => m.recebimento_id === r.id && m.pessoa_id === pessoa)) return erro('Este valor já foi marcado como pago.');
    bd.terceirosPagos!.push({ recebimento_id: r.id, pessoa_id: pessoa, pago_em: data, marcado_por: eu, marcado_em: agora() });
    auditarMarcacao('inclusao', r, pessoa, data);
    gravar();
    return espera(undefined);
  },
  async financeiroTerceiroDesfazerPago(recebimento, pessoa) {
    const r = recebimentoDoTerceiro(recebimento, pessoa);
    const marcada = bd.terceirosPagos!.find(m => m.recebimento_id === r.id && m.pessoa_id === pessoa);
    bd.terceirosPagos = bd.terceirosPagos!.filter(m => m !== marcada);
    if (marcada) auditarMarcacao('exclusao', r, pessoa, marcada.pago_em);
    gravar();
    return espera(undefined);
  },
  financeiroLucro() {
    const dataDoRecebimento = (id: string) => bd.recebimentos!.find(r => r.id === id)?.data ?? '';
    return espera({
      recebimentos: bd.recebimentos!.filter(r => !r.estornado_em && r.parte_na_conta === PARTE_INTEGRAL && r.socio_pessoa_id)
        .map(r => ({ data: r.data, pessoa_id: r.socio_pessoa_id!, nome: r.socio_nome!, liquido: r.liquido, terceiros: r.terceiros.map(t => ({ valor: t.valor })) })),
      indicacoes: bd.repasses!.filter(x => x.tipo === 'socio_indicador' && !x.cancelado_em && x.pessoa_id)
        .map(x => ({ data: dataDoRecebimento(x.recebimento_id), pessoa_id: x.pessoa_id!, nome: x.nome, valor: x.valor, pago_em: x.pago_em })),
      retiradas: bd.retiradas!.filter(r => !r.excluido_em).map(({ lancamento_id: _l, excluido_em: _e, ...r }) => r)
    });
  },
  async financeiroPagarLucro({ pessoa, conta, data, valor, descricao }) {
    const nome = bd.pessoas.find(p => p.id === pessoa)?.nome;
    if (!nome) return erro('Pessoa não encontrada neste escritório.');
    if (!bd.socios!.some(s => s.pessoa_id === pessoa && !s.excluido_em) && !bd.recebimentos!.some(r => r.socio_pessoa_id === pessoa && !r.estornado_em)) return erro('Esta pessoa não é sócia. Só sócios recebem lucro.');
    if (!bd.contasFinanceiras!.some(c => c.id === conta)) return erro('Conta não encontrada neste escritório.');
    const texto = (descricao.trim() || `Divisão de lucro a ${nome}`).slice(0, 300);
    const saida = novoLancamento({ conta_id: conta, data, tipo: 'saida', categoria: 'divisao_lucro', valor, descricao: texto, origem: 'lucro' });
    bd.lancamentos!.push(saida);
    const r: RetiradaGuardada = { id: novoId(), pessoa_id: pessoa, nome, conta_id: conta, data, valor, descricao: texto, lancamento_id: saida.id, excluido_em: null };
    bd.retiradas!.push(r); auditar('financeiro_retiradas', 'inclusao', r); gravar();
    return espera(r.id);
  },
  async financeiroDesfazerLucro(id) {
    const r = bd.retiradas!.find(x => x.id === id);
    if (!r) return erro('Retirada não encontrada neste escritório.');
    if (r.excluido_em) return espera(undefined);
    const quando = agora();
    bd.lancamentos!.filter(l => l.id === r.lancamento_id).forEach(l => { l.excluido_em = quando; });
    r.excluido_em = quando; gravar();
    return espera(undefined);
  },
  async financeiroRestaurarLucro(id) {
    const r = bd.retiradas!.find(x => x.id === id);
    if (!r) return erro('Retirada não encontrada neste escritório.');
    if (!r.excluido_em) return espera(undefined);
    const saidas = bd.lancamentos!.filter(l => l.id === r.lancamento_id);
    saidas.forEach(conferirContaEData);
    saidas.forEach(l => { l.excluido_em = null; });
    r.excluido_em = null; gravar();
    return espera(undefined);
  },
  financeiroSocios: () => espera(bd.socios!.filter(s => !s.excluido_em).toSorted((a, b) => b.desde.localeCompare(a.desde)).map(socioLido)),
  async financeiroSocioCriar(dados) {
    if (!bd.pessoas.some(p => p.id === dados.pessoa_id)) return erro('Pessoa não encontrada neste escritório.');
    if (dados.ate && dados.ate < dados.desde) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    if (cruzaOutroPeriodo(bd.socios!.filter(s => !s.excluido_em), dados)) return erro(SOCIO_NO_PERIODO);
    const s: SocioGuardado = { id: novoId(), ...dados, excluido_em: null };
    bd.socios!.push(s);
    ajusteDoSocio(s, null, periodoDoSocio(s)); auditar('financeiro_socios', 'inclusao', s); gravar();
    return espera(socioLido(s));
  },
  async financeiroSocioAtualizar(id, dados) {
    const s = bd.socios!.find(x => x.id === id);
    if (!s) return erro(SEM_ACESSO_AO_CAIXA);
    if (dados.ate && dados.ate < dados.desde) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    if (cruzaOutroPeriodo(bd.socios!.filter(x => !x.excluido_em), { id, pessoa_id: s.pessoa_id, ...dados })) return erro(SOCIO_NO_PERIODO);
    const antes = periodoDoSocio(s);
    Object.assign(s, dados);
    if (antes !== periodoDoSocio(s)) ajusteDoSocio(s, antes, periodoDoSocio(s));
    auditar('financeiro_socios', 'alteracao', s); gravar();
    return espera(undefined);
  },
  async financeiroSocioExcluir(id) {
    const s = bd.socios!.find(x => x.id === id);
    if (!s) return erro(SEM_ACESSO_AO_CAIXA);
    if (!s.excluido_em) ajusteDoSocio(s, periodoDoSocio(s), null);
    s.excluido_em ??= agora(); gravar();
    return espera(undefined);
  },
  async financeiroSocioRestaurar(id) {
    const s = bd.socios!.find(x => x.id === id);
    if (!s) return erro(SEM_ACESSO_AO_CAIXA);
    if (cruzaOutroPeriodo(bd.socios!.filter(x => !x.excluido_em), s)) return erro(SOCIO_NO_PERIODO);
    if (s.excluido_em) ajusteDoSocio(s, null, periodoDoSocio(s));
    s.excluido_em = null; gravar();
    return espera(undefined);
  },

  // ---------- painel de processos (como public.painel_de_processos) ----------
  async processosPainel({ hoje, meus }) {
    const { ate_prazos, ate_marcados } = datasDoPainel(hoje);
    const base = new Map(bd.processos!.filter(p => !p.arquivado_em && (!meus || p.responsavel_id === eu || p.colaboradores.includes(eu))).map(p => [p.id, p]));
    const noPainel = (p: ProcessoGuardado): ProcessoNoPainel => ({ id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, cliente_nome: nomesDosClientes(p.clientes),
      responsavel_id: p.responsavel_id, colaboradores: p.colaboradores, clientes: p.clientes });
    const andamentos = bd.andamentos!.filter(a => !a.excluido_em && base.has(a.processo_id)).map(({ processo_id, excluido_em: _e, ...a }) => ({ ...a, processo: noPainel(base.get(processo_id)!) }));
    const prazos = bd.prazos!.filter(z => !z.excluido_em && !z.concluido_em && base.has(z.processo_id) && z.final <= ate_prazos)
      .toSorted((a, b) => a.final.localeCompare(b.final)).map(z => ({ id: z.id, descricao: z.descricao, final: z.final, tarefa_id: z.tarefa_id, processo: noPainel(base.get(z.processo_id)!) }));
    const vencidos = prazos.filter(z => z.final < hoje), aVencer = prazos.filter(z => z.final >= hoje);
    const marcados = andamentos.filter(a => (a.tipo === 'audiencia' || a.tipo === 'pericia') && a.data >= hoje && a.data <= ate_marcados)
      .toSorted((a, b) => a.data.localeCompare(b.data) || (a.hora ?? '99').localeCompare(b.hora ?? '99'));
    const intimacoes = andamentos.filter(a => a.tipo === 'intimacao' && !a.tratada_em && !a.tarefa_id)
      .toSorted((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em));
    const parados = [...base.values()].flatMap(p => {
      if (bd.colunas.find(c => c.id === p.etapa_id)?.marco === 'concluido') return [];
      const datas = bd.andamentos!.filter(a => a.processo_id === p.id && !a.excluido_em && a.data <= hoje).map(a => a.data).toSorted();
      const ultimo = datas.at(-1) ?? p.distribuicao ?? new Date(p.criado_em).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const dias = Math.round((Date.parse(hoje) - Date.parse(ultimo)) / DIA);
      return dias > bd.diasParado! ? [{ processo: noPainel(p), ultimo, dias }] : [];
    }).toSorted((a, b) => b.dias - a.dias);
    const fases = new Map<string, FaseNoPainel>();
    for (const p of base.values()) {
      const chave = p.tipo + '/' + p.etapa_id;
      fases.set(chave, { tipo: p.tipo, etapa_id: p.etapa_id, n: (fases.get(chave)?.n ?? 0) + 1 });
    }
    return espera({
      prazos: [...vencidos.slice(0, ITENS_POR_LISTA), ...aVencer.slice(0, ITENS_POR_LISTA)], total_vencidos: vencidos.length, total_a_vencer: aVencer.length,
      marcados: marcados.slice(0, ITENS_POR_LISTA), total_marcados: marcados.length,
      intimacoes: intimacoes.slice(0, ITENS_POR_LISTA), total_intimacoes: intimacoes.length,
      ultimos: andamentos.filter(a => a.data <= hoje).toSorted(porDataDoAndamento).slice(0, ULTIMOS_ANDAMENTOS),
      parados: parados.slice(0, ITENS_POR_LISTA), total_parados: parados.length,
      dias_parado: bd.diasParado!,
      fases: [...fases.values()]
    });
  },
  // Como processosGraficos do supabase.ts: o que quem está logado vê (com "pessoa", só os processos dela), em qualquer situação.
  async processosGraficos({ hoje, pessoa }) {
    const { desde, ate_prazos } = periodoDosGraficos(hoje);
    const meus = bd.processos!.filter(p => vejoNoModulo('processos', p.id) && (!pessoa || daPessoa(p, pessoa)));
    const todos = new Set(meus.map(p => p.id)), ativos = new Set(meus.filter(p => !p.arquivado_em).map(p => p.id));
    return espera({
      processos: meus.map(p => ({ id: p.id, tipo: p.tipo, etapa_id: p.etapa_id, distribuicao: p.distribuicao, criado_em: p.criado_em, arquivado_em: p.arquivado_em })),
      prazos: bd.prazos!.filter(z => !z.excluido_em && !z.concluido_em && z.final <= ate_prazos && ativos.has(z.processo_id)).map(z => ({ processo_id: z.processo_id, final: z.final })),
      andamentos: bd.andamentos!.filter(a => !a.excluido_em && a.data >= desde && a.data <= hoje && todos.has(a.processo_id)).map(a => ({ processo_id: a.processo_id, data: a.data })),
      mudancas: bd.historicoProcessos!.filter(h => h.em >= desde && 'etapa' in h.alteracoes && todos.has(h.processo_id))
        .map(h => ({ processo_id: h.processo_id, em: h.em, de: (h.alteracoes.etapa.de as string | null) ?? null, para: (h.alteracoes.etapa.para as string | null) ?? null }))
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
  processoObter: id => { const p = bd.processos!.find(x => x.id === id && vejoNoModulo('processos', x.id)); return espera(p ? processoCompleto(p) : null); },
  async processoCriar({ tipo: pedido, ...dados }) {
    // O tipo que saiu (#406) vira administrativo, na coluna equivalente e com o número que não repete, como o gatilho aa_tipo_que_saiu.
    const tipo = tipoQueFica(pedido);
    if (tipo === TIPO_QUE_FICA && dados.etapa_id) dados = { ...dados, etapa_id: colunaDoAdministrativo(dados.etapa_id) };
    if (ehTipoQueSaiu(pedido) && dados.numero) dados = { ...dados, numero: numeroQueNaoRepete(dados.numero, pedido, repeteEntreOsAdministrativos()) };
    if (!ehTipoDeProcesso(tipo)) return erro(FORMATO_INVALIDO);
    conferirOrigemDoProcesso(dados);
    const pronto = prepararProcesso({ colaboradores: [], clientes: [], ...dados }, tipo);
    pronto.campos = prepararCampos(pronto.campos ?? {}, tipo);
    const p = { titulo: null, colaboradores: [], orgao: null, sistema: null, polo: null, area: null, meio: null, natureza: null, gratuidade: null, comarca: null, vara: null, classe: null, assunto: null,
      juiz: null, distribuicao: null, valor_causa: null, instancia: null, segredo: false, advogado_contrario: null, observacoes: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null,
      origem_id: null, ligacao: null, ...PI_VAZIA,
      ...pronto, id: novoId(), codigo: codigo(), tipo, criado_por: eu, criado_em: agora(), atualizado_por: eu, atualizado_em: agora() } as ProcessoGuardado;
    bd.processos!.push(p); avisarInclusao('processos', p.id, null); auditar('processos', 'inclusao', p); gravar();
    return espera({ id: p.id, codigo: p.codigo });
  },
  async processoAtualizar(id, dados) {
    // A origem e a ligação ficam de fora do que se altera, como no banco (#316).
    if ('origem_id' in dados || 'ligacao' in dados) return erro('Você não tem permissão para fazer isso.');
    const p = acharProcesso(id), antes = equipeDoItemNoFalso('processos', id);
    if (p.tipo === TIPO_QUE_FICA && dados.etapa_id !== undefined) dados = { ...dados, etapa_id: colunaDoAdministrativo(dados.etapa_id) };
    const novos = prepararProcesso(dados, p.tipo, p);
    if (novos.campos !== undefined) novos.campos = prepararCampos(novos.campos, p.tipo, p.campos);
    historicoProcesso(p, novos);
    Object.assign(p, novos, { atualizado_em: agora(), atualizado_por: eu });
    avisarInclusao('processos', id, antes);
    auditar('processos', 'alteracao', p); gravar();
    return espera({ id, codigo: p.codigo });
  },
  async processosArquivar(ids, arquivar = true) {
    ids = ids.filter(id => { const p = bd.processos!.find(x => x.id === id); return !p || !soLeNoFalso(alteraOProcesso(p, membroLogado(), meusGruposNoFalso())); });
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
      compromissosDoProcessoExcluido(id);
      bd.processos = bd.processos!.filter(x => x.id !== id);
      bd.historicoProcessos = bd.historicoProcessos!.filter(h => h.processo_id !== id);
      bd.processoDemandas = bd.processoDemandas!.filter(l => l.processo_id !== id);
      bd.contratoProcessos = bd.contratoProcessos!.filter(l => l.processo_id !== id);
      soltarDasAnotacoes('processos', id);
      bd.andamentos = bd.andamentos!.filter(a => a.processo_id !== id);
      bd.comentarios = bd.comentarios!.filter(c => !(c.modulo === 'processos' && c.cartao_id === id));
      bd.prazos = bd.prazos!.filter(z => z.processo_id !== id);
      // As pessoas com papel saem junto; os recursos e incidentais dele continuam, só sem a origem (#316).
      bd.processoPartes = bd.processoPartes!.filter(x => x.processo_id !== id);
      // Como a chave origem_id (on delete set null) no banco: a mudança passa pelo histórico e pelo carimbo do recurso.
      bd.processos!.filter(x => x.origem_id === id).forEach(x => {
        historicoProcesso(x, { origem_id: null });
        Object.assign(x, { origem_id: null, atualizado_em: agora(), atualizado_por: eu });
      });
      bd.tarefas!.forEach(t => { if (t.processo_id === id) t.processo_id = null; });
      bd.etiquetasAplicadas = bd.etiquetasAplicadas!.filter(a => !(a.modulo === 'processos' && a.cartao_id === id));
      auditar('processos', 'exclusao', p); excluidas++;
    });
    gravar();
    return espera({ excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só processos arquivados podem ser excluídos, por quem os criou ou por um administrador.' : '' });
  },
  async cartaoSair(modulo, id) {
    if (!SAIR_DO_CARTAO[modulo](id)) {
      // Como public.cartao_sair: quem está só por um grupo do cartão recebe o motivo (o primeiro grupo, pelo nome).
      const doItem = GRUPOS_DO_ITEM[modulo](id) ?? [], meus = meusGruposNoFalso();
      const pelo = bd.gruposDaEquipe!.filter(g => doItem.includes(g.id) && meus.includes(g.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))[0];
      return erro(pelo ? recusaDeSairPeloGrupo(pelo.nome) : 'Você não está entre as pessoas deste cartão.');
    }
    gravar();
  },
  async processoMeIncluir(id, como) {
    if (!bd.equipeVeTudo || membroLogado().funcao !== 'advogado') return erro('Só advogados podem entrar no processo nesta fase.');
    const p = acharProcesso(id);
    if (p.arquivado_em) return erro('Processo não encontrado neste escritório.');
    const novos = ENTRAR_NO_PROCESSO[como](p);
    historicoProcesso(p, novos);
    Object.assign(p, novos, { atualizado_em: agora() }); gravar();
  },
  async processoMover(id, etapaId, ordem) {
    const p = acharProcesso(id);
    if (p.tipo === TIPO_QUE_FICA) etapaId = colunaDoAdministrativo(etapaId);
    if (soLeNoFalso(alteraOProcesso(p, membroLogado(), meusGruposNoFalso()))) return erro('Você não tem permissão para fazer isso.');
    conferirQuadroDoProcesso(p.tipo, etapaId);
    historicoProcesso(p, { etapa_id: etapaId });
    Object.assign(p, { etapa_id: etapaId, etapa_ordem: ordem, atualizado_em: agora() }); gravar();
  },
  processoHistorico: id => espera(bd.historicoProcessos!.filter(h => h.processo_id === id).slice(0, HISTORICO_DO_PROCESSO)),
  processosDaPessoa: (pessoaId, perfilId = null) => {
    const vistos = bd.processos!.filter(p => vejoNoModulo('processos', p.id)).map(p => ({ ...p, cliente_nome: nomesDosClientes(p.clientes) }));
    const daEquipe = vistos.filter(p => papeisNoProcesso(p, pessoaId, perfilId).length);
    const partes = bd.processoPartes!.filter(x => x.pessoa_id === pessoaId).flatMap(x => vistos.filter(p => p.id === x.processo_id).map(processo => ({ papel: x.papel, processo })));
    return espera(processosComPartes(daEquipe, partes, pessoaId, perfilId).map((p): ProcessoLigado => ({
      id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, cliente_nome: p.cliente_nome, etapa_id: p.etapa_id, arquivado_em: p.arquivado_em,
      criado_em: p.criado_em, papeis: p.papeis, partes: p.partes
    })));
  },
  // ---------- pessoas com papel e processos ligados (#316, como a migração processo_partes_recursos_e_tipos) ----------
  processoPartes: processoId => espera(bd.processoPartes!.filter(x => x.processo_id === processoId && vejoNoModulo('processos', processoId)).map(parteNoCartao)),
  async processoParteIncluir(processoId, pessoaId, papel) {
    const p = bd.processos!.find(x => x.id === processoId && vejoNoModulo('processos', x.id));
    if (!p || p.arquivado_em || soLeNoFalso(alteraOProcesso(p, membroLogado(), meusGruposNoFalso()))) return erro('Você não tem permissão para fazer isso.');
    if (!(papel in PAPEIS_DA_PARTE)) return erro(FORMATO_INVALIDO);
    if (!bd.pessoas.some(x => x.id === pessoaId)) return erro('Pessoa não encontrada neste escritório.');
    if (bd.processoPartes!.some(x => x.processo_id === processoId && x.pessoa_id === pessoaId && x.papel === papel)) return erro(PAPEL_REPETIDO);
    if (bd.processoPartes!.filter(x => x.processo_id === processoId).length >= PARTES_MAXIMAS) return erro(`Um processo pode ter até ${PARTES_MAXIMAS} pessoas com papel.`);
    const x = { id: novoId(), processo_id: processoId, pessoa_id: pessoaId, papel, criado_em: agora() };
    bd.processoPartes!.push(x);
    historicoDaParte(x, 'para');
    auditar('processo_partes', 'inclusao', x); gravar();
    return espera(parteNoCartao(x));
  },
  async processoParteRetirar(id) {
    const x = bd.processoPartes!.find(y => y.id === id), p = x && bd.processos!.find(y => y.id === x.processo_id);
    if (!x || !p || p.arquivado_em || !vejoNoModulo('processos', p.id) || soLeNoFalso(alteraOProcesso(p, membroLogado(), meusGruposNoFalso()))) return erro('Você não tem permissão para fazer isso.');
    bd.processoPartes = bd.processoPartes!.filter(y => y.id !== id);
    historicoDaParte(x, 'de');
    auditar('processo_partes', 'exclusao', x); gravar();
  },
  processosRelacionados: processoId => {
    const aberto = bd.processos!.find(x => x.id === processoId && vejoNoModulo('processos', x.id));
    if (!aberto) return espera([]);
    return espera(relacionadosDoProcesso(bd.processos!.filter(x => vejoNoModulo('processos', x.id)).map(x => ({
      id: x.id, codigo: x.codigo, tipo: x.tipo, numero: x.numero, titulo: x.titulo, cliente_nome: nomesDosClientes(x.clientes), etapa_id: x.etapa_id, arquivado_em: x.arquivado_em,
      criado_em: x.criado_em, origem_id: x.origem_id, ligacao: x.ligacao
    })), aberto));
  },
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
    c.aparece_em = tipoQueFica(c.aparece_em);
    if ((c.tipo === 'lista') !== (c.opcoes.length > 0)) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    bd.camposDeProcesso!.push(c); gravar();
    return espera(c);
  },
  async processoCampoAtualizar(id, dados) {
    const c = bd.camposDeProcesso!.find(x => x.id === id);
    if (!c) return erro('Campo não encontrado neste escritório.');
    const d = prepararCampoDeProcesso(dados, id);
    if (d.opcoes !== undefined && (c.tipo === 'lista') !== (d.opcoes.length > 0)) return erro('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    if (d.aparece_em !== undefined) d.aparece_em = tipoQueFica(d.aparece_em);
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
  etiquetasDoCartao: (modulo, id) => espera(bd.etiquetasAplicadas!.filter(a => a.modulo === modulo && a.cartao_id === id && (modulo !== 'contratos' || alcancoContratoDoId(id))
    && (modulo !== 'anotacoes' || vejoAnotacaoDoId(id))).map(a => a.etiqueta_id)),
  async etiquetaAplicar(modulo, id, etiquetaId) {
    if (!bd.etiquetas!.some(e => e.id === etiquetaId)) return erro('Não foi possível concluir agora. Tente de novo.');
    if (modulo === 'contratos' && !vejoContratoDoId(id)) return erro('Você não tem permissão para fazer isso.');
    if (modulo === 'anotacoes' && !alteroAnotacaoDoId(id)) return erro(SEM_PERMISSAO);
    aplicarEtiqueta(modulo, id, etiquetaId); gravar();
  },
  // Como a regra "apagar" das ligações: o que quem tira não pode mudar fica como está, sem erro.
  async etiquetaTirar(modulo, id, etiquetaId) { if (podeTirarEtiqueta(modulo, id)) tirarEtiqueta(modulo, id, etiquetaId); gravar(); },
  async etiquetaAplicarEmLote(modulo, ids, etiquetaId) {
    if (!bd.etiquetas!.some(e => e.id === etiquetaId)) return erro('Não foi possível concluir agora. Tente de novo.');
    if (modulo === 'anotacoes' && !ids.every(alteroAnotacaoDoId)) return erro(SEM_PERMISSAO);
    ids.forEach(id => aplicarEtiqueta(modulo, id, etiquetaId)); gravar();
  },
  async etiquetaTirarEmLote(modulo, ids, etiquetaId) { ids.filter(id => podeTirarEtiqueta(modulo, id)).forEach(id => tirarEtiqueta(modulo, id, etiquetaId)); gravar(); },

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

  // ---------- modelos de lista (como supabase/migrations/20261027000019_modelos_de_lista.sql e a 20261119142702, da árvore) ----------
  modelosListar: () => espera([...bd.modelos!].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(modeloLido)),
  async modeloCriar(nome, arvore) {
    const m = { id: novoId(), ...prepararModelo({ nome, arvore }), criado_por: eu, atualizado_em: agora() } as ModeloGuardado;
    bd.modelos!.push(m); gravar(); return espera(modeloLido(m));
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
    const col = bd.colunas.find(c => c.id === id);
    if (col?.marco) return erro('Só administradores excluem colunas, e a coluna-marco não pode ser excluída.');
    if (col?.de_aprovacao) return erro('A coluna de aprovação das tarefas não pode ser excluída.');
    for (const c of bd.compromissos!) if (c.etapa_id === id) { historicoCompromisso(c, { etapa_id: null }); c.etapa_id = null; }
    for (const p of bd.processos!) if (p.etapa_id === id) { historicoProcesso(p, { etapa_id: null }); p.etapa_id = null; }
    for (const d of bd.demandas!) if (d.etapa_id === id) { historicoDemanda(d, { etapa_id: null }); d.etapa_id = null; }
    for (const t of bd.tarefas!) if (t.etapa_id === id) { historicoTarefa(t, { etapa_id: null }); t.etapa_id = null; }
    bd.colunas = bd.colunas.filter(c => c.id !== id);
    for (const item of [...bd.pessoas, ...bd.contratos!]) if (item.etapa_id === id) item.etapa_id = null;
    gravar();
  },

  // ---------- comentários (como o gatilho e as regras de supabase/migrations/20261027000016_comentarios.sql) ----------
  comentariosListar: (modulo, cartaoId) => espera(bd.comentarios!.filter(c => c.modulo === modulo && c.cartao_id === cartaoId && CARTAO_ALCANCADO[modulo](cartaoId))
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, COMENTARIOS_DO_CARTAO).map(comentarioLido)),
  async comentarioCriar(modulo, cartaoId, texto) {
    textoDoComentario(texto);   // como o gatilho "before" do banco, que roda antes das regras de acesso
    if (!CARTAO_ALCANCADO[modulo](cartaoId)) return erro(SEM_PERMISSAO);
    const c = { id: novoId(), modulo, cartao_id: cartaoId, autor_id: eu, ...prepararComentario(modulo, texto, cartaoId), criado_em: agora(), editado_em: null };
    bd.comentarios!.push(c); mensagensDoComentario(c); gravar();
    return espera(comentarioLido(c));
  },
  async comentarioEditar(id, texto) {
    const c = bd.comentarios!.find(x => x.id === id);
    if (!c || c.autor_id !== eu || !CARTAO_ALCANCADO[c.modulo](c.cartao_id)) return erro('Só quem escreveu o comentário pode editá-lo.');
    Object.assign(c, prepararComentario(c.modulo, texto, c.cartao_id, c.mencoes_pelo_grupo), { editado_em: agora() }); mensagensDoComentario(c); gravar();
    return espera(comentarioLido(c));
  },
  async comentarioExcluir(id) {
    const c = bd.comentarios!.find(x => x.id === id);
    // Quem está logado no banco fictício é o master: apaga os de qualquer autor.
    if (!c) return erro('Só quem escreveu o comentário ou um administrador pode apagá-lo.');
    bd.comentarios = bd.comentarios!.filter(x => x !== c); auditar('comentarios', 'exclusao', { id }); gravar();
  },
  // Como em supabase.ts: os itens com o código, só os que quem lê vê (as mesmas regras das ligações da anotação), arquivados também.
  itensMencionados(codigos) {
    const procurados = new Set(codigos.map(c => c.toUpperCase()));
    return espera(MODULOS_MENCIONAVEIS.flatMap(modulo => ITENS_MENCIONAVEIS[modulo]()
      .filter(x => procurados.has(x.codigo) && vejoOItem(modulo, x.id)).map(x => ITEM_NO_FALSO[modulo](x.id)!.item)));
  },

  // ---------- caixa de mensagens (como as regras de supabase/migrations/20261108165559_mensagens.sql) ----------
  mensagensListar: () => espera(juntarAsCaixas([
    minhasMensagensDeCompromisso().sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, MENSAGENS_DA_CAIXA).map(mensagemDeCompromissoLida),
    minhasMensagensDeGrupo().sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, MENSAGENS_DA_CAIXA).map(mensagemDeGrupoLida),
    minhasMensagensDeInclusao().sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, MENSAGENS_DA_CAIXA).map(mensagemDeInclusaoLida),
    minhasMensagensDePedido().sort((a, b) => b.criado_em.localeCompare(a.criado_em)).map(mensagemDePedidoLida),
    minhasMensagens().sort((a, b) => b.criado_em.localeCompare(a.criado_em) || (a.prazo_data ?? '').localeCompare(b.prazo_data ?? '')).slice(0, MENSAGENS_DA_CAIXA).map(mensagemLida)
  ], MENSAGENS_DA_CAIXA)),
  mensagensNaoLidas: () => espera([...minhasMensagens(), ...minhasMensagensDePedido(), ...minhasMensagensDeInclusao(), ...minhasMensagensDeGrupo(), ...minhasMensagensDeCompromisso()].filter(m => !m.lido_em).length),
  async mensagemMarcarLida(id) {
    const m = [...minhasMensagens(), ...minhasMensagensDePedido(), ...minhasMensagensDeInclusao(), ...minhasMensagensDeGrupo(), ...minhasMensagensDeCompromisso()].find(x => x.id === id && !x.lido_em);
    if (m) { m.lido_em = agora(); gravar(); }
  },
  async mensagensMarcarTodasLidas() {
    for (const m of [...minhasMensagens(), ...minhasMensagensDePedido(), ...minhasMensagensDeInclusao(), ...minhasMensagensDeGrupo(), ...minhasMensagensDeCompromisso()]) m.lido_em ??= agora();
    gravar();
  },

  // ---------- pedir para participar (como supabase/migrations/20261118220000_pedidos_de_participacao.sql, #363) ----------
  itensParaPedir(termo) {
    const codigo = termo.trim().toUpperCase();
    // Com algum algarismo, o termo pode ser o número inteiro do processo: comparado só pelas letras e algarismos, em maiúsculas.
    const numero = /\d/.test(termo) ? numeroParaComparar(termo) : '';
    if (!codigo) return espera([]);
    const achados: ItemParaPedir[] = MODULOS_DO_PEDIDO.flatMap(modulo => ITENS_DO_PEDIDO[modulo]()
      .filter(i => !i.arquivado && (i.codigo === codigo || (!!numero && i.numero === numero)) && !i.vejo() && i.achavel())
      .map(i => ({ modulo, grupo: i.grupo, id: i.id, codigo: i.codigo, numero: i.codigo === codigo ? null : numero, pedido_id: pedidoPendente(i.id, eu)?.id ?? null })));
    return espera(achados);
  },
  async participacaoPedir(modulo, itemId) {
    const i = itemDoPedido(modulo, itemId);
    if (!i || i.arquivado) return erro(RECUSA_DO_PEDIDO.itemNaoEncontrado);
    if (aprovoNoItem(i) || i.equipe.includes(eu)) return erro(RECUSA_DO_PEDIDO.jaFazParte);
    if (modulo === 'contratos' && !membroLogado().pessoa_id) return erro(RECUSA_DO_PEDIDO.semPessoa);
    if (i.souIndicador()) return erro(RECUSA_DO_PEDIDO.indicador);
    if (pedidoPendente(itemId, eu)) return erro(RECUSA_DO_PEDIDO.jaPediu);
    const p: PedidoGuardado = { id: novoId(), modulo, item_id: itemId, item_codigo: i.codigo, pedido_por: eu, situacao: 'pendente', respondido_por: null, criado_em: agora(), respondido_em: null };
    bd.pedidos!.push(p);
    for (const perfil of aprovadoresDoPedido(i).filter(x => x !== eu)) {
      bd.mensagensDePedido!.push({ id: novoId(), perfil_id: perfil, pedido_id: p.id, tipo: 'pedido', criado_em: agora(), lido_em: null });
    }
    gravar();
    return espera(p.id);
  },
  async participacaoCancelar(pedidoId) {
    const p = bd.pedidos!.find(x => x.id === pedidoId && x.pedido_por === eu);
    if (!p) return erro(RECUSA_DO_PEDIDO.pedidoNaoEncontrado);
    if (p.situacao !== 'pendente') return erro(RECUSA_DO_PEDIDO.jaRespondido);
    Object.assign(p, { situacao: 'cancelado', respondido_em: agora() });
    bd.mensagensDePedido = bd.mensagensDePedido!.filter(m => !(m.pedido_id === p.id && m.tipo === 'pedido'));
    gravar();
  },
  async participacaoResponder(pedidoId, aprovar) {
    const p = bd.pedidos!.find(x => x.id === pedidoId), i = p && itemDoPedido(p.modulo, p.item_id);
    if (!p || !i) return erro(RECUSA_DO_PEDIDO.pedidoNaoEncontrado);
    if (p.pedido_por === eu || !aprovoNoItem(i)) return erro(RECUSA_DO_PEDIDO.naoAprova);
    if (p.situacao === 'cancelado') return erro(RECUSA_DO_PEDIDO.cancelado);
    if (p.situacao !== 'pendente') return erro(RECUSA_DO_PEDIDO.jaRespondido);
    // O item pode ter sido arquivado depois do pedido: não recebe ninguém, mas o pedido pode ser recusado.
    if (aprovar && i.arquivado) return erro(RECUSA_DO_PEDIDO.arquivado);
    try { if (aprovar) porQuemPediu(i, p.modulo, p.pedido_por); } catch (e) { return erro((e as Error).message); }
    const situacao = aprovar ? 'aprovado' : 'recusado';
    Object.assign(p, { situacao, respondido_por: eu, respondido_em: agora() });
    i.registrar({ ['pedido_' + situacao]: { de: null, para: EQUIPE.find(m => m.id === p.pedido_por)?.nome ?? null } });
    bd.mensagensDePedido = bd.mensagensDePedido!.filter(m => !(m.pedido_id === p.id && m.tipo === 'pedido'));
    bd.mensagensDePedido.push({ id: novoId(), perfil_id: p.pedido_por, pedido_id: p.id, tipo: 'resposta', criado_em: agora(), lido_em: null });
    gravar();
  },

  equipeListar: () => espera(EQUIPE.filter(m => !m.excluido).map(({ cpf: _cpf, excluido: _excluido, ...m }) => ({ ...m, email: m.id === eu ? meuEmail() : m.email, criado_em: agora(), ultimo_acesso: m.ativo ? agora() : null, confirmado: m.id !== 'u-bruno' }))),
  async conviteCriar(pid, email, papel: Papel) {
    const p = achar(pid);
    // Como public.convite_criar: quem já tem perfil (inclusive quem foi excluído da equipe) não recebe outro.
    if (EQUIPE.some(m => m.pessoa_id === pid)) return erro('Esta pessoa já é usuária do sistema');
    // Como o índice convites_email_pendente do banco: um só convite pendente por e-mail.
    if (bd.convites.some(c => c.email.toLowerCase() === email.toLowerCase())) return erro('Este e-mail já tem um convite pendente.');
    const c: Convite = { id: novoId(), email, nome: p.nome, papel, pessoa_id: pid, criado_em: agora() }; bd.convites.unshift(c); gravar();
    return espera({ ...c, codigo: codigoConvite() });
  },
  conviteNovoLink: () => espera(codigoConvite()),
  async equipeDefinirPapel(id, papel) {
    const m = EQUIPE.find(x => x.id === id);
    if (m?.excluido) return erro('Este usuário foi excluído e não volta à equipe.');   // o gatilho excluido_nao_volta
    if (m) m.papel = papel;
  },
  async equipeDefinirAtivo(id, ativo) {
    const m = EQUIPE.find(x => x.id === id);
    if (m?.excluido && ativo) return erro('Este usuário foi excluído e não volta à equipe.');   // o gatilho excluido_nao_volta
    if (m) m.ativo = ativo;
  },
  // Na mesma ordem da função do banco (public.equipe_excluir). A foto sai junto; o nome fica, marcado, para os registros antigos.
  async equipeExcluir(id) {
    const quem = membroLogado(), m = EQUIPE.find(x => x.id === id && !x.excluido);
    if (!souAdmin()) return erro('Apenas administradores');
    if (id === quem.id) return erro('Você não pode excluir a própria conta');
    if (!m) return erro('Usuário não encontrado');
    if (m.papel === 'master') return erro('O usuário master não pode ser excluído');
    if (m.papel === 'admin' && quem.papel !== 'master') return erro('Só o master gerencia administradores');
    if (m.ativo) return erro('Desative o usuário antes de excluir');
    Object.assign(m, { excluido: true, email: `excluida-${id}@excluida.invalid` });
    if (bd.fotos) delete bd.fotos[id];
    bd.perfisProfissionais = (bd.perfisProfissionais ?? []).filter(p => p.perfil_id !== id);
    bd.convites = bd.convites.filter(c => c.pessoa_id !== m.pessoa_id);
    bd.acessos = bd.acessos.filter(a => a.perfil_id !== id);
    bd.mensagens = bd.mensagens?.filter(x => x.perfil_id !== id);
    bd.mensagensDeInclusao = bd.mensagensDeInclusao!.filter(x => x.perfil_id !== id);
    // Como privado.grupos_de_quem_saiu (#378).
    bd.gruposDaEquipe!.forEach(g => { g.integrantes = g.integrantes.filter(p => p !== id); });
    bd.mensagensDeGrupo = bd.mensagensDeGrupo!.filter(x => x.perfil_id !== id);
    bd.mensagensDeCompromisso = bd.mensagensDeCompromisso!.filter(x => x.perfil_id !== id);
    auditar('perfis', 'exclusao', { id, nome: m.nome });
    gravar();
  },
  async equipeDefinirNome(id, nome) {
    // Na mesma ordem da função do banco (public.equipe_definir_nome): administrador, tamanho, usuário, quem pode.
    if (!souAdmin()) return erro('Apenas administradores mudam o nome de alguém da equipe');
    const problema = erroDoNomeDaEquipe(nome); if (problema) return erro(problema);
    const m = EQUIPE.find(x => x.id === id); if (!m) return erro('Usuário não encontrado');
    const limpo = nome.trim();
    const quem = EQUIPE.find(x => x.id === eu);
    if (id !== quem?.id && m.papel === 'master') return erro('Só o próprio master muda o nome dele.');
    if (id !== quem?.id && m.papel === 'admin' && quem?.papel !== 'master') return erro('Só o master muda o nome de um administrador.');
    m.nome = limpo; auditar('perfis', 'alteracao', { id, nome: limpo }); gravar();
  },
  async equipeDefinirFuncao(id, funcao) {
    const m = EQUIPE.find(x => x.id === id); if (!m) return erro('Usuário não encontrado');
    m.funcao = funcao; auditar('perfis', 'alteracao', { id, nome: m.nome }); gravar();
  },
  // Como public.equipe_email_preparar. Quem está logado no banco fictício é o master: pode trocar o de administradores.
  async equipeTrocarEmail(id, novo) {
    const m = EQUIPE.find(x => x.id === id), email = normalizarEmail(novo);
    if (!m || m.id === eu || m.papel === 'master' || m.excluido) return erro(RECUSA_DA_TROCA['sem-permissao']);
    if (erroDoNovoEmail(email, '')) return erro(RECUSA_DA_TROCA['email-invalido']);
    if (meuEmail() === email || EQUIPE.some(x => x.email === email)) return erro(RECUSA_DA_TROCA['email-em-uso']);
    if (bd.convites.some(c => c.email.toLowerCase() === email)) return erro(RECUSA_DA_TROCA['convite-pendente']);
    const umaHoraAtras = Date.now() - HORA;
    // Como no banco: o master conta à parte dos administradores. Aqui a sessão é sempre a do master (eu).
    const doMaster = (r: RegistroAuditoria) => EQUIPE.find(x => x.id === r.feito_por)?.papel === 'master';
    if (trocasDeEmail().filter(r => Date.parse(r.em) > umaHoraAtras && doMaster(r)).length >= TROCAS_DE_EMAIL_POR_HORA) return erro(RECUSA_DA_TROCA.limite);
    bd.auditoria.unshift({ id: Date.now() + Math.random(), tabela: 'perfis', registro_id: id, acao: 'troca_email', resumo: { nome: m.nome, email_antigo: m.email, email_novo: email, aviso_falhas: [] }, feito_por: eu, em: agora() });
    m.email = email;
    gravar();
  },
  // Como public.equipe_reserva_preparar e equipe_reserva_concluir. Quem está logado no banco fictício é o master.
  async equipeReservarConta(pessoaId) {
    const p = achar(pessoaId);
    if (EQUIPE.some(m => m.pessoa_id === pessoaId)) return erro(RECUSA_DA_RESERVA['ja-na-equipe']);
    if (bd.convites.some(c => c.pessoa_id === pessoaId)) return erro(RECUSA_DA_RESERVA['convite-pendente']);
    const id = novoId();
    EQUIPE.push({ id, funcao: 'advogado', nome: p.nome, usuario: id, papel: 'usuario', ativo: false, reservada: true, cor: null, pessoa_id: pessoaId, email: `conta-${id}@reservada.invalid`, cpf: p.documento ?? '' });
    bd.auditoria.unshift({ id: Date.now() + Math.random(), tabela: 'perfis', registro_id: id, acao: 'reserva_conta', resumo: { nome: p.nome }, feito_por: eu, em: agora() });
    gravar();
  },
  convitesListar: () => espera(bd.convites),
  async conviteCancelar(id) { bd.convites = bd.convites.filter(c => c.id !== id); gravar(); },
  trocasDeEmailListar: (n = TROCAS_DE_EMAIL_MOSTRADAS) => espera(trocasDeEmail().slice(0, n)),
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
    // Autorização nova: o problema de autorização some (como o gatilho privado.ligacao_renovada).
    if (bd.contatosGoogle?.problema === 'autorizacao') bd.contatosGoogle = { ...bd.contatosGoogle, problema: null, problema_em: null };
    auditar('ligacoes', 'inclusao', { id: 'google', nome: 'contato@exemplo.com' });
    gravar(); return espera('ligado' as const);
  },
  async ligacaoGoogleDesligar() {
    if (bd.ligacaoGoogle) auditar('ligacoes', 'exclusao', { id: 'google', nome: bd.ligacaoGoogle.conta_email });
    bd.ligacaoGoogle = null;
    // Como ligacao_google_desligar_servidor: a ligação (com a chave, o problema, a primeira sincronização e as dúvidas abertas)
    // sai, e a fila do escritório é esvaziada. As ligações pessoa ↔ contato e as dúvidas decididas ficam (são da conta:
    // religar a mesma reaproveita, e o que já foi decidido não volta).
    const antes = bd.contatosGoogle;
    bd.contatosGoogle = antes && { ativos: false, fila: [], com_falha: 0, problema: null, problema_em: null, sincronizado_em: null,
      ligados: antes.ligados, conferir: antes.conferir?.filter(k => k.decisao), noGoogle: antes.noGoogle, googleFora: antes.googleFora };
    gravar(); return espera(undefined);
  },
  // ---------- sincronização dos contatos (sem Google: "Sincronizar agora" sempre dá certo) ----------
  sincronizacaoGoogle() {
    if (!bd.ligacaoGoogle || !souAdmin()) return espera(null);
    const c = bd.contatosGoogle;
    return espera({ ativa: c?.ativos ?? false, pendentes: c?.fila.length ?? 0, com_falha: c?.com_falha ?? 0, problema: c?.problema ?? null,
      problema_em: c?.problema_em ?? null, sincronizado_em: c?.sincronizado_em ?? null, primeira_em: c?.primeira_em ?? null, para_conferir: duvidasAbertas().length });
  },
  async sincronizacaoGoogleLigar(ligar) {
    if (!souAdmin()) return erro('Apenas administradores ligam e desligam a sincronização dos contatos');
    if (!bd.ligacaoGoogle) return erro('Ligue a conta Google do escritório antes de sincronizar os contatos');
    const c = bd.contatosGoogle ??= { ativos: false, fila: [], com_falha: 0, problema: null, problema_em: null, sincronizado_em: null };
    // Ligar (de novo, inclusive) pede uma primeira sincronização nova.
    if (ligar && !c.ativos) c.primeira_em = null;
    c.ativos = ligar;
    // Desligar esvazia a fila: some o que vinha dela (as falhas); o problema de autorização é da ligação e fica.
    if (!ligar) Object.assign(c, { fila: [], com_falha: 0, ...(c.problema === 'autorizacao' ? {} : { problema: null, problema_em: null }) });
    auditar('ligacoes', 'alteracao', { id: 'google', nome: bd.ligacaoGoogle.conta_email });
    gravar(); return espera(undefined);
  },
  async sincronizarGoogleAgora() {
    const c = bd.contatosGoogle;
    if (!souAdmin() || !bd.ligacaoGoogle || !c?.ativos) return espera({ resultado: 'desligada' as const, sincronizados: 0, falhas: 0 });
    // Como a função do servidor: a primeira sincronização antes da fila; quem está em dúvida espera a decisão. Sem resposta
    // do Google, ela fica por fazer e a fila não anda.
    if (!c.primeira_em && c.googleFora) return espera({ resultado: 'ok' as const, sincronizados: 0, falhas: 0, primeira_por_fazer: true });
    const primeira = c.primeira_em ? undefined : primeiraSincronizacaoFalsa(c);
    const ligados = c.ligados ??= {};
    const vao = c.fila.filter(id => !emDuvidaNoGoogle(id));
    vao.forEach(id => { ligados[id] ??= 'people/falso' + id.replace(/[^A-Za-z0-9]/g, ''); });
    Object.assign(c, { fila: c.fila.filter(emDuvidaNoGoogle), com_falha: 0, problema: null, problema_em: null, sincronizado_em: vao.length ? agora() : c.sincronizado_em });
    gravar(); return espera({ resultado: 'ok' as const, sincronizados: vao.length, falhas: 0, ...(primeira ? { primeira } : {}) });
  },
  contatosParaConferir() {
    if (!bd.ligacaoGoogle || !souAdmin()) return espera([]);
    return espera(duvidasAbertas().map(duvidaParaATela));
  },
  async contatoParaConferirDecidir(id, decisao) {
    if (!souAdmin()) return erro('Apenas administradores decidem os contatos para conferir');
    const c = bd.contatosGoogle;
    const k = c?.conferir?.find(x => x.id === id && !x.decisao);
    if (!c || !k) return erro('Este contato já foi conferido');
    if (!bd.ligacaoGoogle) return erro('A conta Google deste contato não está mais ligada');
    const ligados = c.ligados ??= {};
    if (decisao.acao === 'ligar') {
      if (!bd.pessoas.some(p => p.id === decisao.pessoa_id)) return erro('Escolha uma pessoa do escritório');
      if (ligados[decisao.pessoa_id]) return erro('Esta pessoa já está ligada a outro contato do Google');
      if (Object.values(ligados).includes(k.recurso)) return erro('Este contato do Google já está ligado a outra pessoa');
      ligados[decisao.pessoa_id] = k.recurso;
    }
    k.decisao = ({ ligar: 'ligada', outra: 'outra', ignorar: 'ignorada' } as const)[decisao.acao];
    // Ligar ou "é outra pessoa": quem era possível e ficou sem contato (e sem outra dúvida) vai para a fila e ganha um contato novo.
    if (decisao.acao !== 'ignorar' && c.ativos) {
      k.candidatos.map(cid => bd.pessoas.find(p => p.id === cid)).filter((p): p is Pessoa => !!p && !p.arquivado_em && !ligados[p.id] && !emDuvidaNoGoogle(p.id) && !c.fila.includes(p.id)).forEach(p => c.fila.push(p.id));
    }
    auditar('contatos_google_conferir', 'alteracao', { id: k.id, nome: k.decisao });
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

/** A coluna do quadro administrativo para uma coluna de um dos quadros que saíram (#406); as outras ficam como vieram. */
function colunaDoAdministrativo(etapaId: string | null | undefined): string | null {
  return colunaEquivalente(etapaId ?? null, bd.colunas, bd.gruposDeColunas!);
}
/** Se um número repetiria o de outro administrativo (o de fora fica de fora), como a regra processos_numero_unico compara. */
function repeteEntreOsAdministrativos(fora?: string) {
  return (numero: string) => bd.processos!.some(x => x.id !== fora && x.tipo === TIPO_QUE_FICA && numeroParaComparar(x.numero) === numeroParaComparar(numero));
}
/**
 * Os processos e os campos próprios dos tipos que saíram (#406), guardados numa sessão aberta antes, viram administrativos, como
 * privado.converter_tipos_que_sairam: cada processo vai para a coluna equivalente, e o número que repetiria entre os administrativos
 * ganha o nome do tipo de antes (as duas mudanças ficam no histórico).
 */
function converterTiposQueSairam() {
  const antigos = bd.processos!.filter(p => ehTipoQueSaiu(p.tipo));
  for (const p of antigos) {
    const tipo = p.tipo as string;
    if (!ehTipoQueSaiu(tipo)) continue;
    const numero = numeroQueNaoRepete(p.numero, tipo, repeteEntreOsAdministrativos(p.id));
    const novos = { etapa_id: colunaDoAdministrativo(p.etapa_id), ...(numero !== p.numero ? { numero } : {}) };
    historicoProcesso(p, novos);
    // A data e o autor da última alteração ficam os de antes, como no banco (a conversão não é uma alteração de alguém).
    Object.assign(p, novos, { tipo: TIPO_QUE_FICA });
  }
  bd.camposDeProcesso!.forEach(c => { c.aparece_em = tipoQueFica(c.aparece_em); });
  if (antigos.length) gravar();
}
converterTiposQueSairam();
