// Formato dos dados trocados entre as telas e a camada de dados (dados/supabase.ts e dados/falso.ts).
import type { CorDaEtiqueta } from '../regras/etiquetas';
import type { Contagem, TipoSemExpediente } from '../regras/prazos';

export type Papel = 'master' | 'admin' | 'usuario';
/** O que a pessoa faz no escritório. Diferente do papel: administrador é quem gere o sistema; administrativo é uma função. */
export type Funcao = 'advogado' | 'administrativo' | 'estagiario';
export type ComoEntrarNoProcesso = 'colaborador' | 'responsavel';
export type ModuloComSaida = 'tarefas' | 'demandas' | 'processos' | 'compromissos' | 'anotacoes';
export type TipoPessoa = 'pf' | 'pj' | 'contato';
export type Modulo = 'pessoas' | 'contratos' | 'demandas' | 'tarefas' | 'processos' | 'compromissos' | 'anotacoes' | 'financeiro' | 'processos_judiciais' | 'processos_administrativos'
  /** Os quadros dos tipos que saíram (#406): ficam no banco até a migração que os apaga, e só a conversão os lê. */
  | 'processos_extrajudiciais' | 'processos_investigacoes';

export interface Perfil {
  id: string;
  escritorio_id: string;
  pessoa_id: string | null;
  nome: string;
  usuario: string;
  papel: Papel;
  funcao: Funcao;
  ativo: boolean;
  cor: string | null;
  oab: string | null;
  preferencias: Record<string, unknown> | null;
}

/** Integrante da equipe como aparece em listas, avatares e filtros. */
export interface Membro {
  id: string;
  nome: string;
  usuario?: string;
  papel?: Papel;
  funcao?: Funcao;
  ativo?: boolean;
  /** Conta reservada: consta na equipe e nos contratos, sem acesso ao sistema. */
  reservada?: boolean;
  /** Excluído da equipe: sem acesso nem dados pessoais. O nome, com "(excluído)", fica para os registros antigos. */
  excluido?: boolean;
  cor?: string | null;
  pessoa_id?: string | null;
  /** Link da foto pequena (150×150, redonda), para as bolinhas; sem foto, as bolinhas mostram as iniciais. */
  foto?: string | null;
}

/**
 * Grupo da equipe (#378): pessoas da equipe que o administrador junta (um núcleo, por exemplo) para pôr todas de uma vez num item.
 * O grupo fica ligado ao item: quem entra no grupo depois participa; quem sai deixa de participar, se não estiver no item por conta
 * própria. Na tela, "grupo da equipe", para não confundir com os grupos de colunas do quadro e os dos checklists.
 */
export interface GrupoDaEquipe {
  id: string;
  nome: string;
  /** Os perfis de quem está no grupo (também os desativados, que continuam nele sem acesso). */
  integrantes: string[];
}
/** Em quantos itens de cada módulo o grupo está, contando os arquivados (para o aviso antes de excluir). */
export interface ItensDoGrupo { modulo: ModuloDoPedido; quantos: number }

/** Dados da instituição: cada escritório tem os seus, editados pelo administrador em Configurações. */
export interface DadosEscritorio {
  nome: string;
  logo: string | null;          // imagem em data:image/...;base64 (até ~300 KB)
  cnpj: string | null;          // letras e números, em maiúsculas, sem pontuação (o CNPJ pode ter letras)
  oab_registro: string | null;  // registro da sociedade na OAB
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;           // só números
  telefone: string | null;      // só números
  email: string | null;
  site: string | null;
}
export interface Escritorio extends DadosEscritorio {
  id: string;
  slug: string;
  modulos: Record<string, boolean>;
}

export interface Contexto {
  usuario: { id: string; email?: string };
  perfil: Perfil | null;
  escritorio?: Escritorio | null;
  equipe: Membro[];
  /** Os grupos da equipe do escritório, em ordem de nome (#378). Ausente: nenhum. */
  grupos?: GrupoDaEquipe[];
  ehAdmin: boolean;
  ehMaster: boolean;
}

/** Contexto de quem está logado com perfil ativo (o único que as telas internas recebem). */
export type ContextoAtivo = Contexto & { perfil: Perfil };

export interface Pessoa {
  id: string;
  codigo: string;
  tipo: TipoPessoa;
  nome: string;
  genero: 'm' | 'f' | null;
  nacionalidade: string | null;
  profissao: string | null;
  estado_civil: string | null;
  rg: string | null;
  rg_expedicao: string | null;
  nome_mae: string | null;
  nome_pai: string | null;
  nascimento: string | null;
  nascimento_municipio: string | null;
  nascimento_uf: string | null;
  natureza: string | null;
  tipo_entidade: string | null;
  nome_fantasia: string | null;
  porte: string | null;
  abertura: string | null;
  representantes: string | null;
  documento: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  telefones: string[];
  emails: string[];
  lgpd_base: string | null;
  lgpd_consentimento: string | null;
  etapa_id: string | null;
  etapa_ordem: number | null;
  arquivado_em: string | null;
  arquivado_por: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_por: string | null;
  atualizado_em: string;
  /** Importação que criou o cadastro (Pessoas > Importar pessoas); null = cadastrado no SEMPER. Só o banco grava. */
  importacao_id: string | null;
  /** Código de origem do cadastro importado ("site-12"): importar o mesmo arquivo de novo não duplica. Só o banco grava. */
  referencia: string | null;
  observacoes: string | null;
  /** O que falta resolver no cadastro; lista vazia = nada pendente. */
  pendencias: Pendencia[];
  resp: { perfil_id: string }[];
}

/** O que falta resolver num cadastro (importado). Os mesmos valores da regra "check" de pessoas.pendencias no banco. */
export type Pendencia = 'documento_invalido' | 'conferir';

/** Campos que a tela de cadastro grava (o resto é do banco). */
export type DadosPessoa = Partial<Omit<Pessoa, 'id' | 'codigo' | 'resp' | 'criado_por' | 'criado_em' | 'atualizado_por' | 'atualizado_em'
  | 'importacao_id' | 'referencia'>>;

/** Linha das listagens (tabela, kanban, início). */
export type PessoaLista = Pick<Pessoa, 'id' | 'codigo' | 'tipo' | 'nome' | 'nome_fantasia' | 'documento' | 'telefones' | 'emails'
  | 'municipio' | 'uf' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em' | 'resp'
  | 'pendencias' | 'importacao_id'> & ComEtiquetas;

/** Ordem das listas de qualquer módulo: "manual" é a do quadro (arrastando os cartões); as outras valem para quadro e tabela. */
export type Ordem = 'manual' | 'nome' | 'nome_desc' | 'novos' | 'antigos' | 'recentes';
/** As ordens de tarefas e demandas: as de sempre, pelo prazo (#291) e pela data de início (#357). */
export type OrdemComPrazo = Ordem | 'prazo' | 'prazo_desc' | 'inicio' | 'inicio_desc';

export interface PessoaResumida { id: string; codigo: string; nome: string; tipo: TipoPessoa; arquivado_em?: string | null }

export interface FiltroPessoas {
  termo?: string;
  etiqueta?: string;
  tipo?: string;
  responsavel?: string;
  situacao?: 'ativas' | 'arquivadas';
  /** Só as importadas, só as com pendência ou só as com o consentimento sem data (#409). */
  marca?: MarcaPessoas;
  ordem?: Ordem;
  pagina?: number;
  porPagina?: number;
}
/** Marcas do filtro de Pessoas: criadas por uma importação, com alguma pendência, ou com a base legal "consentimento" e sem a data dele (#409). */
export type MarcaPessoas = 'importadas' | 'pendentes' | 'consentimento_sem_data';

export interface Pagina<T> { linhas: T[]; total: number }

export interface Alteracao { de: unknown; para: unknown }
export interface Historico { id: string | number; alteracoes: Record<string, Alteracao>; feito_por: string | null; em: string }

export interface ResumoPessoas { total: number; minhas: number; mes: number; arquivadas: number; recentes: PessoaLista[] }

export interface Sigilo { id: string; texto: string; criado_por: string | null; autor: string | null; criado_em: string; atualizado_em: string; pode_editar: boolean }
export interface AcessoSigilo { perfil_id: string; nome: string; concedido_em: string; pode_conceder: boolean }

/** Tipo de vínculo entre pessoas: "nome" aparece em quem faz o vínculo, "inverso" na outra pessoa. */
export interface VinculoTipo { id: string; escritorio_id: string | null; nome: string; inverso: string; ordem: number }
/** Vínculo entre duas pessoas, com as duas pontas (de, para) e o tipo. */
export interface Vinculo {
  id: string; pessoa_de: string; pessoa_para: string; tipo_id: string; descricao: string | null; criado_por: string | null; criado_em: string;
  de: PessoaResumida; para: PessoaResumida; tipo: Pick<VinculoTipo, 'id' | 'nome' | 'inverso'>;
}

/** Quem representa uma pessoa jurídica (vínculo "Representante legal de"), com o cadastro completo e a função escrita no vínculo. */
export interface RepresentanteVinculado { pj_id: string; pessoa: Pessoa; funcao: string | null }

/** Código fixo das colunas que marcam um ponto do fluxo (regras/quadro.ts). */
export type MarcoColuna = 'assinado' | 'inicio' | 'concluido' | 'contrato_fechado' | 'aguardando_assinatura';
export interface Coluna {
  id: string; nome: string; ordem: number; criado_por: string | null; oculta: boolean; marco?: MarcoColuna | null; grupo_id?: string | null;
  /** A coluna em que a tarefa espera a aprovação (#313): uma só, no quadro de tarefas; renomeia-se, mas não se exclui. */
  de_aprovacao?: boolean;
}
/** Grupo de colunas de um quadro, que abre e fecha. Do escritório: só os administradores mudam. comeca_fechado: aparece fechado até a pessoa abrir. */
export interface GrupoDeColunas { id: string; nome: string; ordem: number; comeca_fechado: boolean }

/** Categoria de honorário do contrato. */
export type CategoriaHonorario = 'pro_labore' | 'quota_litis' | 'sucumbencia' | 'adiantamento_despesas' | 'pro_bono';

/**
 * Contrato: liga um cliente (pessoa) ao advogado responsável (perfil). O número (codigo, ex.: HE62-0163-2026) é dado
 * pelo banco na criação e nunca muda: sigla do responsável na criação (2 letras do nome e 2 dígitos do CPF), número
 * sequencial do escritório e ano de criação. Valores em reais; percentuais de 0 a 100.
 */
export interface Contrato {
  /** false: quem lê não é parte do contrato, e o que é financeiro vem vazio (contratos_da_equipe). Sem o campo: leu a tabela, e é parte. */
  ve_financeiro?: boolean;
  id: string;
  codigo: string;
  numero: number;
  sigla: string;
  ano: number;
  codigo_antigo: string | null;   // código das planilhas, nos contratos que vieram de lá (ex.: HE62-DE74-001/24)
  /** O primeiro cliente (a versão anterior do site só conhece um). */
  cliente_id: string;
  /** Os nomes de todos os clientes, juntos ("A; B"): é o que a tabela, o quadro, a busca e a ordem por nome usam. */
  cliente_nome: string;
  responsavel_id: string;
  /** Objetos do contrato, na ordem em que foram escritos (cada um vira uma demanda quando o contrato é assinado). */
  objetos: string[];
  /** Os objetos juntos ("a; b"), como mostram a tabela e o quadro. O banco mantém igual aos objetos. */
  servico: string;
  categoria: CategoriaHonorario;
  valor: number | null;
  entrada: number | null;
  parcelas: number | null;
  descontos: number | null;
  /** Quando a negociação começou (aaaa-mm-dd, #311): com a assinatura, o cartão mostra quantos dias ela levou. */
  negociacao_inicio: string | null;
  assinado_em: string | null;
  primeiro_pagamento: string | null;
  percentual_escritorio: number | null;   // 20, 30 ou 100: quanto do que o cliente paga vai para a conta PJ
  indicador_id: string | null;
  indicador_percentual: number | null;
  documento_url: string | null;   // link do documento assinado (Google Drive)
  /** A conta do escritório (PF ou PJ) para onde vai o dinheiro deste contrato: a sugerida ao lançar a entrada. */
  conta_destino_id: string | null;
  observacoes: string | null;
  etapa_id: string | null;
  etapa_ordem: number | null;
  arquivado_em: string | null;
  arquivado_por: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_por: string | null;
  atualizado_em: string;
  /** Os clientes que assinam o contrato, na ordem do cadastro. */
  clientes: PessoaResumida[];
  /** Participantes, na ordem do cadastro, cada um com o seu % (sobre o líquido). */
  participantes: Participacao[];
  indicador: PessoaResumida | null;
  /** Os grupos da equipe do contrato (#378): quem está só por um deles participa sem os valores. Mudam só por contratoDefinirGrupos. */
  grupos?: string[];
}

/** Papel de uma pessoa num contrato (o responsável é um usuário da equipe, pela pessoa ligada a ele). */
export type PapelNoContrato = 'cliente' | 'responsavel' | 'participante' | 'indicador';
/** Contrato como aparece no cartão de uma pessoa: o que ele é e o que a pessoa é nele. */
/** O contrato como aparece no cartão do processo ligado a ele. */
export type ContratoDoProcesso = Pick<Contrato, 'id' | 'codigo' | 'servico' | 'cliente_nome' | 'etapa_id' | 'arquivado_em'>;
export interface ContratoDaPessoa extends Pick<Contrato, 'id' | 'codigo' | 'servico' | 'etapa_id' | 'arquivado_em' | 'criado_em'> {
  papeis: PapelNoContrato[];
}

/** Participante de um contrato, como aparece no cartão. */
export interface Participacao { pessoa: PessoaResumida; percentual: number | null }
/** Participante como o cadastro grava (a lista "participantes" do contrato no banco). */
export interface ParticipanteGravado { pessoa_id: string; percentual: number | null }

/** Campos que o cadastro de contrato grava (número, sigla, ano e carimbos são do banco). */
export type DadosContrato = Partial<{ clientes: string[]; participantes: ParticipanteGravado[] } & Pick<Contrato, 'codigo_antigo' | 'cliente_id' | 'responsavel_id' | 'objetos' | 'servico' | 'categoria' | 'valor'
  | 'entrada' | 'parcelas' | 'descontos' | 'negociacao_inicio' | 'assinado_em' | 'primeiro_pagamento' | 'percentual_escritorio'
  | 'indicador_id' | 'indicador_percentual' | 'documento_url' | 'conta_destino_id' | 'observacoes' | 'etapa_id' | 'etapa_ordem'
  | 'arquivado_em' | 'arquivado_por'>>;

/** O que quem não é parte pode alterar no contrato, na fase de adaptação. Responsável e participantes ficam de fora: são eles que decidem quem vê os valores. */
export interface DadosSemValores { clientes?: string[]; objetos?: string[]; servico?: string; codigo_antigo?: string | null; etapa_id?: string | null; etapa_ordem?: number | null }

/** O contrato da pessoa em "Contrato fechado": novo é false quando ele já tinha nascido antes. */
export interface ContratoDoClienteFechado { id: string; codigo: string; novo: boolean }
/** Uma conta do escritório, só com o nome (para escolher a do contrato). */
export interface ContaParaEscolher { id: string; nome: string }

/** Linha das listagens de contratos (tabela e quadro). */
export type ContratoLista = Pick<Contrato, 'id' | 'codigo' | 'codigo_antigo' | 'servico' | 'categoria' | 'valor' | 'responsavel_id'
  | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em' | 'cliente_nome' | 've_financeiro' | 'grupos' | 'negociacao_inicio'> & ComEtiquetas;

export interface FiltroContratos {
  /** Só os contratos a que a pessoa pode ligar uma demanda ou tarefa: aqueles de que é parte. */
  paraLigar?: boolean;
  termo?: string;
  etiqueta?: string;
  responsavel?: string;
  categoria?: string;
  situacao?: 'ativos' | 'arquivados';
  ordem?: Ordem;
  pagina?: number;
  porPagina?: number;
}

/**
 * Lembrete de um prazo de tarefa ou de demanda (#286): quantos minutos antes ele chega (0: na hora do prazo). Os mesmos
 * valores da regra das colunas "lembrete" no banco (migração lembretes_dos_prazos); os nomes ficam em regras/lembrete.ts.
 */
export type Lembrete = 0 | 30 | 60 | 1440;

/**
 * Demanda: uma etapa de um trabalho, na maioria das vezes um objeto do contrato. O código (curto e aleatório) é dado
 * pelo banco. Quem não é administrador vê só as demandas que criou, de que é responsável ou colaborador.
 */
export interface Demanda {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;            // aaaa-mm-dd
  /** A hora do prazo, no relógio de Brasília (hh:mm:ss, como o banco guarda), ou null: o prazo vale o dia. */
  prazo_hora: string | null;
  /** Quantos minutos antes do prazo chega o lembrete (null: sem lembrete). */
  lembrete: Lembrete | null;
  /** Quando o trabalho começa (aaaa-mm-dd): nasce no dia da criação, no horário de Brasília, e quem altera o cartão a muda (#357). */
  data_inicio: string;
  responsavel_id: string;          // perfil
  colaboradores: string[];         // perfis da equipe, sem o responsável
  /** Os grupos da equipe postos no item (#378): quem está num deles participa, como quem é posto um a um. Ausente: nenhum. */
  grupos?: string[];
  /**
   * A demanda contínua (#313): reúne as tarefas avulsas (sem demanda) de um grupo da equipe, ou de todos na "Geral". O banco a cria;
   * ela nunca é arquivada, concluída nem excluída, e estar nela não abre as tarefas dela. Ausente: demanda comum.
   */
  continua?: boolean;
  /** O grupo da contínua (null na Geral e nas demandas comuns). */
  continua_grupo_id?: string | null;
  /** Os nomes dos clientes juntos ("A; B"), como a tabela, o quadro, a busca e a ordem por nome usam. */
  cliente_nome: string;
  contrato_id: string | null;
  /** O número do contrato, que aparece mesmo para quem não pode abrir o contrato. */
  contrato_codigo: string | null;
  /** O objeto do contrato de que a demanda nasceu (nas automáticas). */
  objeto: string | null;
  etapa_id: string | null;
  etapa_ordem: number | null;
  arquivado_em: string | null;
  arquivado_por: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_por: string | null;
  atualizado_em: string;
  clientes: PessoaResumida[];
  /** O contrato, se quem vê a demanda também pode abri-lo; senão null (e fica só o número). */
  contrato: ContratoDoCartao | null;
}
/**
 * Quem está no contrato (#326): quem o criou, o responsável (usuários) e os participantes (as pessoas do cadastro, como o banco grava
 * em contratos.participantes). Quem está no contrato vê, só para ler, as demandas e as tarefas dele, e pode ser mencionado nelas.
 */
export interface EquipeDoContrato { id: string; criado_por: string | null; responsavel_id: string; participantes: string[] }
/** O contrato como o cartão da demanda ou da tarefa o mostra, com quem está nele (para saber quem pode ser mencionado). */
export type ContratoDoCartao = EquipeDoContrato & { codigo: string; servico: string };
/** Papel de uma pessoa numa demanda (responsável e colaboradores são da equipe, pela pessoa ligada ao usuário). */
export type PapelNaDemanda = 'cliente' | 'responsavel' | 'colaborador';
/** Demanda como aparece em outro cartão (da pessoa ou do contrato), com o papel da pessoa nela. */
export interface DemandaLigada extends Pick<Demanda, 'id' | 'codigo' | 'titulo' | 'objeto' | 'prazo' | 'prazo_hora' | 'etapa_id' | 'arquivado_em' | 'criado_em'> {
  papeis: PapelNaDemanda[];
}
/**
 * Uma demanda relacionada a outra (#310), vista do cartão de uma delas: o id e o número sempre; o conteúdo (demanda), só para quem
 * pode ver a relacionada (null: quem lê não a vê, e sabe só que ela existe e o número dela).
 */
export interface DemandaRelacionada {
  id: string; codigo: string;
  demanda: Pick<Demanda, 'titulo' | 'prazo' | 'prazo_hora' | 'etapa_id' | 'arquivado_em'> | null;
}
/** Campos que o cadastro de demanda grava. */
export type DadosDemanda = Partial<{ clientes: string[] } & Pick<Demanda, 'titulo' | 'descricao' | 'prazo' | 'prazo_hora' | 'lembrete' | 'data_inicio' | 'responsavel_id'
  | 'colaboradores' | 'grupos' | 'contrato_id' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'arquivado_por'>>;
/** Linha das listagens de demandas (tabela e quadro). */
export type DemandaLista = Pick<Demanda, 'id' | 'codigo' | 'titulo' | 'prazo' | 'prazo_hora' | 'data_inicio' | 'responsavel_id' | 'colaboradores' | 'grupos' | 'continua' | 'cliente_nome'
  | 'contrato_codigo' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em'> & ComEtiquetas;
export interface FiltroDemandas {
  /** Só as demandas a que a pessoa pode ligar uma tarefa: aquelas em que está. */
  paraLigar?: boolean;
  termo?: string;
  etiqueta?: string;
  /** Um usuário da equipe: as demandas em que ele é o responsável ou um colaborador. */
  pessoa?: string;
  /**
   * Um grupo da equipe (#378): o id dele, ou 'meus' (os grupos de quem está logado). As colunas do quadro são as mesmas; só os
   * cartões mudam.
   */
  grupo?: string;
  /** 'sem': só as demandas sem contrato (#311). */
  contrato?: '' | 'sem';
  situacao?: 'ativas' | 'arquivadas';
  ordem?: OrdemComPrazo;
  /** Só as que começam a partir deste dia e até este dia (aaaa-mm-dd), pela data de início (#357; regras/dataDeInicio.ts). */
  inicioDesde?: string;
  inicioAte?: string;
  pagina?: number;
  porPagina?: number;
}

/**
 * Tarefa: a parte menor de um trabalho (ex.: "Emitir a GRU", numa demanda de registro de marca). O código (curto e
 * aleatório) é dado pelo banco. Pode ser ligada a pessoas, a uma demanda e a um contrato, ou ser avulsa. Quem não é
 * administrador vê só as tarefas que criou, de que é responsável ou participante, e as das demandas que vê.
 */
export interface Tarefa {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;            // aaaa-mm-dd
  /** A hora do prazo, no relógio de Brasília (hh:mm:ss, como o banco guarda), ou null: o prazo vale o dia. */
  prazo_hora: string | null;
  /** Quantos minutos antes do prazo chega o lembrete (null: sem lembrete). */
  lembrete: Lembrete | null;
  /** Quando o trabalho começa (aaaa-mm-dd): nasce no dia da criação, no horário de Brasília, e quem altera o cartão a muda (#357). */
  data_inicio: string;
  responsavel_id: string;          // perfil
  participantes: string[];         // perfis da equipe, sem o responsável
  /** Os grupos da equipe postos no item (#378): quem está num deles participa, como quem é posto um a um. Ausente: nenhum. */
  grupos?: string[];
  /** É uma diligência (#313): ir a um cartório, a um fórum, a um órgão... Marcada, o motivo é obrigatório. */
  diligencia: boolean;
  /** Por que a diligência é feita (só na diligência; null nas outras). */
  diligencia_motivo: string | null;
  /** Quem pediu a tarefa (#313): alguém da equipe, que a vê (lê e comenta) sem trocar o responsável. null: não informado. */
  solicitante_id: string | null;
  /**
   * A função de cada participante (#313): o id do participante → o id da função (FuncaoNaTarefa). Quem entra sem escolher fica sem
   * função (#421), e quem sai sai das funções. A função é só um rótulo: não muda quem vê nem quem altera.
   */
  funcoes: Record<string, string>;
  /**
   * Precisa de aprovação (#313): concluída por quem não aprova (o solicitante ou um administrador), a tarefa espera na coluna de
   * aprovação até ser aprovada ou devolvida.
   */
  precisa_aprovacao: boolean;
  /** Os nomes das pessoas ligadas juntos ("A; B"), como a tabela, o quadro e a busca usam. */
  pessoa_nome: string;
  /** A demanda principal: a primeira de demanda_ids (a versão anterior do site só conhece esta). */
  demanda_id: string | null;
  /** O código da demanda, que aparece mesmo para quem não pode abrir a demanda. */
  demanda_codigo: string | null;
  /** O contrato principal: o primeiro de contrato_ids. */
  contrato_id: string | null;
  /** O número do contrato, que aparece mesmo para quem não pode abrir o contrato. */
  contrato_codigo: string | null;
  /** Todas as demandas ligadas, na ordem em que foram ligadas (#283). Vazia na tarefa gravada sem a lista: aí conta demanda_id. */
  demanda_ids: string[];
  /** Todos os contratos ligados, na ordem (#283). Vazia na tarefa gravada sem a lista: aí conta contrato_id. */
  contrato_ids: string[];
  etapa_id: string | null;
  etapa_ordem: number | null;
  arquivado_em: string | null;
  arquivado_por: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_por: string | null;
  atualizado_em: string;
  /** Quando a tarefa chegou à coluna das concluídas (null: não está concluída). */
  concluida_em: string | null;
  pessoas: PessoaResumida[];
  /** A demanda, se quem vê a tarefa também pode abri-la; senão null (e fica só o código). */
  demanda: DemandaDaTarefa | null;
  /** O contrato, se quem vê a tarefa também pode abri-lo; senão null (e fica só o número). */
  contrato: ContratoDoCartao | null;
  /** Cada demanda ligada (#283), na ordem: o código sempre, a demanda só para quem pode abri-la. */
  demandas_ligadas: LigadoNaTarefa<DemandaDaTarefa>[];
  /** Cada contrato ligado (#283), na ordem: o número sempre, o contrato só para quem pode abri-lo. */
  contratos_ligados: LigadoNaTarefa<ContratoDoCartao>[];
  /** O processo da tarefa: nasce com ela (de uma intimação ou de um prazo) ou é ligado depois, no cadastro ou no cartão. */
  processo_id: string | null;
  /** O processo, se quem vê a tarefa também pode abri-lo; senão null. */
  processo: Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome'> | null;
}
/**
 * O que a tarefa traz da demanda ligada: para mostrá-la e saber quem a vê (quem vê a demanda vê a tarefa). O contrato da demanda vem
 * com quem está nele, se quem vê a tarefa também pode abri-lo (quem está nele pode ser mencionado na tarefa, #326).
 */
export type DemandaDaTarefa = Pick<Demanda, 'id' | 'codigo' | 'titulo' | 'etapa_id' | 'criado_por' | 'responsavel_id' | 'colaboradores' | 'grupos' | 'continua' | 'contrato_id'>
  & { contrato: EquipeDoContrato | null };
/** Uma demanda ou um contrato ligado à tarefa (#283): o id e o código sempre; o item, se quem lê pode abri-lo (senão null). */
export interface LigadoNaTarefa<T> { id: string; codigo: string; item: T | null }
/** Papel de uma pessoa numa tarefa (responsável e participantes são da equipe, pela pessoa ligada ao usuário). */
export type PapelNaTarefa = 'pessoa' | 'responsavel' | 'participante';
/** Tarefa como aparece em outro cartão (da pessoa, da demanda ou do contrato), com o papel da pessoa nela. */
export interface TarefaLigada extends Pick<Tarefa, 'id' | 'codigo' | 'titulo' | 'prazo' | 'prazo_hora' | 'etapa_id' | 'arquivado_em' | 'criado_em' | 'contrato_id'> {
  papeis: PapelNaTarefa[];
}
/** Campos que o cadastro de tarefa grava. */
export type DadosTarefa = Partial<{ pessoas: string[] } & Pick<Tarefa, 'titulo' | 'descricao' | 'prazo' | 'prazo_hora' | 'lembrete' | 'data_inicio' | 'responsavel_id'
  | 'participantes' | 'grupos' | 'demanda_id' | 'contrato_id' | 'demanda_ids' | 'contrato_ids' | 'processo_id' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'arquivado_por'
  | 'diligencia' | 'diligencia_motivo' | 'solicitante_id' | 'funcoes' | 'precisa_aprovacao'>>;
/** Linha das listagens de tarefas (tabela e quadro). */
export type TarefaLista = Pick<Tarefa, 'id' | 'codigo' | 'titulo' | 'prazo' | 'prazo_hora' | 'data_inicio' | 'responsavel_id' | 'participantes' | 'grupos' | 'pessoa_nome' | 'diligencia'
  | 'demanda_codigo' | 'contrato_codigo' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em'> & ComEtiquetas & {
  /**
   * Quem está na demanda ligada, se quem lê pode vê-la (senão null). Assim a lista sabe se a pessoa altera a tarefa: quem vê a
   * demanda só pelo contrato dela lê as tarefas dela, mas não as altera (#326).
   */
  equipe_da_demanda: Pick<Demanda, 'criado_por' | 'responsavel_id' | 'colaboradores' | 'grupos' | 'continua'> | null;
  /**
   * Quem está em cada uma das outras demandas ligadas (#283), além da principal, das que quem lê pode ver: quem está em qualquer uma
   * delas também altera a tarefa, como no banco e no cartão.
   */
  equipes_das_outras_demandas?: Pick<Demanda, 'criado_por' | 'responsavel_id' | 'colaboradores' | 'grupos' | 'continua'>[];
};
export interface FiltroTarefas {
  termo?: string;
  etiqueta?: string;
  /** Um usuário da equipe: as tarefas em que ele é o responsável ou um participante. */
  pessoa?: string;
  /**
   * Um grupo da equipe (#378): o id dele, ou 'meus' (os grupos de quem está logado). Vêm também as tarefas das demandas do grupo. As colunas do quadro são as mesmas; só os
   * cartões mudam.
   */
  grupo?: string;
  situacao?: 'ativas' | 'arquivadas';
  ordem?: OrdemComPrazo;
  /** Um usuário da equipe: as tarefas que ele pediu (#313). */
  solicitante?: string;
  /** As tarefas em que o usuário `de` é participante com uma das funções `ids` (#313: "Delegadas a mim"). ids vazio: nenhuma. */
  funcao?: { de: string; ids: string[] };
  /** Só as que começam a partir deste dia e até este dia (aaaa-mm-dd), pela data de início (#357; regras/dataDeInicio.ts). */
  inicioDesde?: string;
  inicioAte?: string;
  pagina?: number;
  porPagina?: number;
}

export interface Usuario {
  id: string; nome: string; usuario: string; papel: Papel; funcao: Funcao; ativo: boolean; reservada?: boolean; pessoa_id: string | null; email: string;
  criado_em: string; ultimo_acesso: string | null; confirmado: boolean; cor?: string | null;
}
/** O e-mail do Google de alguém da equipe: o informado (null: usa o de entrada) e o de entrada (null na conta reservada). */
export interface EmailDoGoogle { email: string | null; padrao: string | null }
export interface Convite { id: string; email: string; nome: string; papel: Papel; pessoa_id: string | null; criado_em: string }
/** Convite recém-criado: traz o código do link (o banco guarda só o resumo, então ele só aparece agora). */
export type ConviteCriado = Convite & { codigo?: string };
/** A quem o aviso da troca de e-mail pelo administrador vai (função equipe-trocar-email). */
export type DestinoDoAvisoDaTroca = 'antigo' | 'gestao';
export interface RegistroAuditoria {
  id: string | number; tabela: string; registro_id: string | null; acao: string;
  resumo: { nome?: string; email?: string; codigo?: string; descricao?: string; quantidade?: number; completadas?: number; incompletas?: number; email_antigo?: string; email_novo?: string; situacao?: 'falhou'; aviso_falhas?: DestinoDoAvisoDaTroca[]; parcela?: number; recebimento?: string; pago_em?: string; valor?: number;
    /** A exclusão do contrato em cascata (#284): o que saiu junto e os valores. */
    cascata?: ResumoDaCascata } | null;
  feito_por: string | null; em: string;
}

export interface Exclusao { excluidas: number; naoExcluidas: number; motivo: string }

/** O que saiu junto com um contrato excluído e os valores (centavos), como a auditoria guarda (#284). */
export interface ResumoDaCascata {
  demandas: number; tarefas: number; segundos: number; parcelas: number; recebimentos: number; estornados: number;
  recebido: number; taxas: number; repasses: number; correcoes: number; importadas: number; importado: number;
}

/**
 * A prévia da exclusão de contratos (#284), para a janela que pergunta antes: quantos contratos saem (e quantos não, por não estarem
 * arquivados ou por quem pede não poder), o que sai junto, se há dinheiro recebido (só administrador exclui) e os pagamentos já feitos
 * (ninguém exclui). Valores em centavos; "valores" é null e "pagos" vem vazio para quem não vê o dinheiro destes contratos.
 */
export interface PreviaExclusaoContrato {
  contratos: number; nao_excluiveis: number;
  demandas: number; tarefas: number; segundos: number; parcelas: number;
  recebimentos: number; estornados: number; importadas: number;
  com_dinheiro: boolean; sou_admin: boolean; tem_pagamento: boolean;
  valores: { recebido: number; taxas: number; repasses: number; correcoes: number; importado: number } | null;
  pagos: { codigo: string; parcela: number; nome: string; valor: number }[];
}

/** Verificação em duas etapas (aplicativo autenticador no celular). */
export interface FatorDuasEtapas { id: string; ativo: boolean; criado_em: string }
/** Início da ativação: o QR code (imagem) e a chave para digitar no aplicativo. */
export interface CadastroDuasEtapas { id: string; qr: string; segredo: string }

/** Tipos de link enviados por e-mail (parâmetro "type" do link). */
export type TipoLink = 'email' | 'recovery' | 'email_change';

/** O e-mail de acesso da conta e, enquanto a troca espera a confirmação, o e-mail novo. */
export interface EmailDaConta { atual: string; pendente: string | null }

// Contrato da camada de dados: as telas só conversam com o banco por aqui. É dividido por área, para cada tela
// ou peça poder depender só da parte que usa (ex.: Pick<DadosPessoas, 'pessoasListar'>). supabase.ts e falso.ts
// implementam o contrato inteiro (Dados), e contrato.test.ts confere que se comportam igual.

/** Sessão, conta e preferências de quem entrou. */
export interface DadosSessao {
  sessao(): Promise<{ user: { id: string; email?: string } } | null>;
  entrar(email: string, senha: string): Promise<void>;
  /** Cria a conta pelo convite: além do e-mail, vai o código do link que o convidado recebeu. */
  primeiroAcesso(email: string, senha: string, voltarPara: string, codigo: string): Promise<{ entrou: boolean }>;
  recuperarSenha(email: string, voltarPara: string): Promise<void>;
  /**
   * Link dos e-mails (confirmação, nova senha, troca de e-mail): troca o código de uso único pela sessão. Sem sessão na
   * resposta, o link valeu, mas falta outro: na troca de e-mail, o atual e o novo podem receber um link cada.
   */
  confirmarLink(codigo: string, tipo: TipoLink): Promise<{ comSessao: boolean }>;
  /** Lê da conta, e não da sessão guardada no navegador: a troca pode ter sido confirmada em outro aparelho. */
  contaEmail(): Promise<EmailDaConta>;
  /** Pede a troca do e-mail de acesso. A troca espera confirmação por link; a configuração do login decide se são um ou dois links. */
  trocarEmail(novo: string): Promise<EmailDaConta>;
  novaSenha(senha: string): Promise<void>;
  sair(): Promise<void>;
  /** O login confirma que a sessão não existe mais (troca de e-mail pelo administrador, "Sair" em outro aparelho). Sem resposta certa, false. */
  sessaoEncerrada(): Promise<boolean>;
  aoMudarSessao(cb: (evento: string) => void): () => void;
  contexto(forcar?: boolean): Promise<Contexto | null>;
  salvarPerfil(campos: Partial<Pick<Perfil, 'nome' | 'usuario' | 'cor'>>): Promise<void>;
  salvarPreferencia(chave: string, valor: unknown): Promise<void>;
}

/** Verificação em duas etapas. */
export interface DadosDuasEtapas {
  duasEtapasFatores(): Promise<FatorDuasEtapas[]>;
  duasEtapasIniciar(): Promise<CadastroDuasEtapas>;
  duasEtapasConfirmar(id: string, codigo: string): Promise<void>;
  duasEtapasDesativar(id: string): Promise<void>;
  /** A pessoa entrou só com a senha e tem a verificação ativa: falta o código do aplicativo. */
  duasEtapasPendente(): Promise<boolean>;
  duasEtapasEntrar(codigo: string): Promise<void>;
}

/** Cadastro de pessoas. */
export interface DadosPessoas {
  pessoasListar(f?: FiltroPessoas): Promise<Pagina<PessoaLista>>;
  /** Todas as pessoas do filtro (sem paginar), com o cadastro completo, em ordem de nome: para exportar. */
  pessoasExportar(f?: FiltroPessoas): Promise<Pessoa[]>;
  pessoasDaEtapa(etapaId: string | null, f?: FiltroPessoas, deslocamento?: number, limite?: number): Promise<Pagina<PessoaLista>>;
  pessoaObter(id: string): Promise<Pessoa | null>;
  pessoaPorDocumento(documento: string, excetoId?: string): Promise<PessoaResumida | null>;
  pessoasPorTelefones(telefones: string[], excetoId?: string): Promise<PessoaResumida[]>;
  pessoaCriar(dados: DadosPessoa, responsaveis?: string[]): Promise<{ id: string; codigo: string }>;
  pessoaAtualizar(id: string, dados: DadosPessoa, responsaveis?: string[]): Promise<{ id: string; codigo: string }>;
  pessoasArquivar(ids: string[], arquivar?: boolean): Promise<number>;
  pessoasExcluir(ids: string[]): Promise<Exclusao>;
  pessoaMover(id: string, etapaId: string | null, ordem: number | null): Promise<void>;
  pessoaHistorico(id: string): Promise<Historico[]>;
  responsavelIncluir(pessoaId: string, perfilId: string): Promise<void>;
  responsavelRemover(pessoaId: string, perfilId: string): Promise<void>;
  pessoasResumo(): Promise<ResumoPessoas>;
  /** Quantas pessoas do escritório (ativas e arquivadas) têm a base legal "consentimento" e a data dele vazia (#409). */
  pessoasSemDataDoConsentimento(): Promise<number>;
}

/** Informações sigilosas de uma pessoa. */
export interface DadosSigilo {
  sigilosListar(pessoaId: string): Promise<Sigilo[]>;
  sigiloSalvar(pessoaId: string, texto: string, id?: string | null): Promise<string>;
  sigiloApagar(id: string): Promise<void>;
  sigiloAcessos(pessoaId: string): Promise<AcessoSigilo[]>;
  sigiloConceder(pessoaId: string, perfilId: string, conceder?: boolean): Promise<void>;
}

/** Vínculos entre pessoas. */
export interface DadosVinculos {
  vinculoTiposListar(): Promise<VinculoTipo[]>;
  vinculoTipoCriar(nome: string, inverso: string): Promise<VinculoTipo>;
  vinculosListar(pessoaId: string): Promise<Vinculo[]>;
  vinculoCriar(de: string, para: string, tipoId: string, descricao?: string | null): Promise<string>;
  vinculoApagar(id: string): Promise<void>;
  /** Representantes vinculados das pessoas jurídicas indicadas (para a qualificação delas). */
  representantesVinculados(pjIds: string[]): Promise<RepresentanteVinculado[]>;
}

/** Contratos. Na ordem "nome", a lista vai pelo nome do cliente. */
export interface DadosContratos {
  contratosListar(f?: FiltroContratos): Promise<Pagina<ContratoLista>>;
  contratosDaEtapa(etapaId: string | null, f?: FiltroContratos, deslocamento?: number, limite?: number): Promise<Pagina<ContratoLista>>;
  contratoObter(id: string): Promise<Contrato | null>;
  /** O contrato como o cartão mostra: inteiro para quem é parte; para o resto da equipe, sem os valores, se a chave do escritório estiver ligada. */
  contratoVer(id: string): Promise<Contrato | null>;
  contratoAlterarSemValores(id: string, dados: DadosSemValores): Promise<void>;
  contratoCriar(dados: DadosContrato): Promise<{ id: string; codigo: string }>;
  /**
   * A pessoa que chegou à coluna "Contrato fechado" ganha um contrato em "Aguardando assinatura", com ela como cliente e
   * o objeto "A definir"; o responsável é quem moveu (se é advogado) ou o primeiro advogado responsável pela pessoa.
   * Uma vez só por pessoa: de novo, devolve o mesmo. Com o módulo Contratos desligado, devolve null.
   */
  pessoaFecharContrato(pessoaId: string): Promise<ContratoDoClienteFechado | null>;
  /** O nome das contas do escritório, para escolher a conta de destino do contrato (qualquer um da equipe). */
  contasParaEscolher(): Promise<ContaParaEscolher[]>;
  contratoAtualizar(id: string, dados: DadosContrato): Promise<{ id: string; codigo: string }>;
  /**
   * Arquivar leva junto as demandas do contrato e as tarefas dele e delas que não têm outra ligação ativa (#284, regras/arquivarContrato.ts);
   * desarquivar traz de volta só o que foi arquivado junto. Mover para Encerrado não arquiva nada.
   */
  contratosArquivar(ids: string[], arquivar?: boolean): Promise<number>;
  /** O que a exclusão destes contratos leva junto, para a janela que pergunta antes (#284, regras/exclusaoDoContrato.ts). */
  contratoExclusaoPrevia(ids: string[]): Promise<PreviaExclusaoContrato>;
  /**
   * Só contratos arquivados são excluídos (por quem criou ou um administrador), com as demandas, as tarefas que só pertencem a eles,
   * as parcelas e o dinheiro no Financeiro (#284). Com pagamento já feito, recusa; com dinheiro recebido, só um administrador exclui.
   * O dinheiro recusa a lista inteira, sem excluir pela metade.
   */
  contratosExcluir(ids: string[]): Promise<Exclusao>;
  /** Recusa quem pode ver, mas não alterar, o contrato (quem só foi mencionado). */
  contratoMover(id: string, etapaId: string | null, ordem: number | null): Promise<void>;
  contratoHistorico(id: string): Promise<Historico[]>;
  /** Objetos já usados em contratos do escritório, em ordem alfabética, para sugerir no cadastro. */
  objetosSugeridos(): Promise<string[]>;
  /**
   * A lista de objetos do escritório (#281), em ordem alfabética, com quantos contratos (ativos e arquivados) e quantas demandas
   * usam cada um. Só administradores. O objeto que está num contrato e ficou fora da lista entra nela agora.
   */
  objetosDoEscritorio(): Promise<ObjetoDoEscritorio[]>;
  /**
   * Corrige o nome de um objeto (só administradores): na lista, em todos os contratos que o usam (arquivados também), nas demandas
   * nascidas dele (e no título delas que ainda é igual ao nome antigo) e no modelo de lista de mesmo nome. Recusa o nome de outro
   * objeto da lista (para isso, juntar).
   */
  objetoRenomear(id: string, nome: string): Promise<TrocaDeObjetos>;
  /**
   * Junta objetos repetidos (só administradores): os de `ids` viram o objeto `fica` em todo lugar e saem da lista; o contrato que
   * tinha os dois fica com um só. As demandas dos dois ficam, ligadas ao que ficou. Não tem desfazer.
   */
  objetosJuntar(ids: string[], fica: string): Promise<TrocaDeObjetos>;
  /** Tira da lista o objeto que nenhum contrato usa (só administradores). O que está em uso é recusado, com quantos contratos o usam. */
  objetoApagar(id: string): Promise<void>;
  /** As demandas ligadas ao objeto (#410), para perguntar a qual objeto novo cada uma fica ligada ao separar. Só administradores. */
  demandasDoObjeto(id: string): Promise<DemandaDoObjeto[]>;
  /**
   * Separa um objeto em dois ou mais (#410; só administradores): os nomes novos entram no lugar dele na lista e em cada contrato que
   * o usava (arquivados também); cada demanda dele passa ao objeto novo escolhido em `demandas` (recusa se faltar alguma) e o título
   * igual ao nome antigo acompanha. Não cria nem apaga demanda. Não tem desfazer.
   */
  objetoSeparar(id: string, nomes: string[], demandas: LigacaoDaDemanda[]): Promise<TrocaDeObjetos>;
  /** Contratos em que a pessoa é cliente, participante ou indicadora; com perfilId (a pessoa é da equipe), também os em que é a responsável. */
  contratosDaPessoa(pessoaId: string, perfilId?: string | null): Promise<ContratoDaPessoa[]>;
}

// ---------- objetos de contrato (#281) ----------
/** Um objeto da lista do escritório, com quantos contratos e demandas o usam (supabase/migrations/20261122232558_editar_objetos_de_contrato.sql). */
export interface ObjetoDoEscritorio {
  id: string;
  descricao: string;
  contratos_ativos: number;
  contratos_arquivados: number;
  demandas: number;
}
/** O que mudou ao corrigir ou juntar objetos: contratos, demandas e modelos de lista trocados, e os contratos com duas demandas do mesmo objeto. */
export interface TrocaDeObjetos {
  contratos: number;
  demandas: number;
  modelos: number;
  /** Os modelos de lista que ficaram com um nome que saiu (já havia um com o nome novo, ou cada objeto juntado tinha o seu). */
  modelos_sem_objeto: number;
  contratos_com_duas_demandas: number;
}
/** Uma demanda ligada a um objeto, ao separá-lo (#410; supabase/migrations/20261124034839_separar_objeto.sql). */
export interface DemandaDoObjeto {
  id: string;
  codigo: string;
  titulo: string;
  contrato_codigo: string | null;
}
/** A qual objeto novo a demanda fica ligada, ao separar (o nome, como escrito). */
export interface LigacaoDaDemanda {
  demanda: string;
  objeto: string;
}

/** Demandas. Na ordem "nome", a lista vai pelo título. */
export interface DadosDemandas {
  demandasListar(f?: FiltroDemandas): Promise<Pagina<DemandaLista>>;
  demandasDaEtapa(etapaId: string | null, f?: FiltroDemandas, deslocamento?: number, limite?: number): Promise<Pagina<DemandaLista>>;
  demandaObter(id: string): Promise<Demanda | null>;
  demandaCriar(dados: DadosDemanda): Promise<{ id: string; codigo: string }>;
  demandaAtualizar(id: string, dados: DadosDemanda): Promise<{ id: string; codigo: string }>;
  demandasArquivar(ids: string[], arquivar?: boolean): Promise<number>;
  /** Só demandas arquivadas são excluídas (por quem criou ou um administrador). */
  demandasExcluir(ids: string[]): Promise<Exclusao>;
  demandaMover(id: string, etapaId: string | null, ordem: number | null): Promise<void>;
  demandaHistorico(id: string): Promise<Historico[]>;
  /** Demandas em que a pessoa é cliente; com perfilId (a pessoa é da equipe), também as em que é responsável ou colaboradora. */
  demandasDaPessoa(pessoaId: string, perfilId?: string | null): Promise<DemandaLigada[]>;
  /** Demandas ligadas ao contrato (as automáticas e as ligadas à mão), que quem está logado pode ver. */
  demandasDoContrato(contratoId: string): Promise<DemandaLigada[]>;
  /**
   * A demanda de um objeto do contrato, na hora (#349), como as que nascem na assinatura: em "Para fazer", com os clientes e o
   * responsável do contrato e as tarefas do modelo. Quem altera o contrato, com ele ativo. O objeto que já tem demanda não ganha outra,
   * e a demanda criada assim não se repete quando o contrato for assinado.
   */
  contratoCriarDemanda(contratoId: string, objeto: string): Promise<{ id: string; codigo: string }>;
  /**
   * A demanda contínua do grupo (#313; null: a "Geral"), criada na primeira vez: o cadastro liga a ela a tarefa sem demanda. Só quem
   * está no grupo (e o administrador); a Geral, toda a equipe. Devolve o id da demanda.
   */
  demandaContinua(grupoId: string | null): Promise<string>;
  /**
   * As demandas relacionadas a esta (#310), nos dois sentidos, na ordem em que foram ligadas, até DEMANDAS_RELACIONADAS. Quem vê
   * esta demanda vê todas, com o número; o conteúdo, só das que ele também pode ver.
   */
  demandasRelacionadas(demandaId: string): Promise<DemandaRelacionada[]>;
  /**
   * Liga uma demanda à outra (supabase/migrations/20261122125913_demandas_relacionadas.sql): quem está nas duas (quem altera cada
   * uma), com as duas ativas. Ligar de novo, em qualquer sentido, não muda nada. Devolve se a ligação é nova (false: já existia).
   */
  demandaRelacionar(demandaId: string, outraId: string): Promise<boolean>;
  /** Desfaz a ligação, que some das duas: quem está numa delas (mesmo arquivada, ou sem ver a outra). */
  demandaDesrelacionar(demandaId: string, outraId: string): Promise<void>;
}

/** Tarefas. Na ordem "nome", a lista vai pelo título. */
export interface DadosTarefas {
  tarefasListar(f?: FiltroTarefas): Promise<Pagina<TarefaLista>>;
  tarefasDaEtapa(etapaId: string | null, f?: FiltroTarefas, deslocamento?: number, limite?: number): Promise<Pagina<TarefaLista>>;
  tarefaObter(id: string): Promise<Tarefa | null>;
  tarefaCriar(dados: DadosTarefa): Promise<{ id: string; codigo: string }>;
  /** Trocar o processo só aceita um processo ativo em que a pessoa está; null tira o processo. */
  tarefaAtualizar(id: string, dados: DadosTarefa): Promise<{ id: string; codigo: string }>;
  tarefasArquivar(ids: string[], arquivar?: boolean): Promise<number>;
  /** Só tarefas arquivadas são excluídas (por quem criou ou um administrador). */
  tarefasExcluir(ids: string[]): Promise<Exclusao>;
  /** Devolve a coluna em que a tarefa ficou (a de aprovação, se ela precisa de aprovação e quem conclui não aprova, #313). */
  tarefaMover(id: string, etapaId: string | null, ordem: number | null): Promise<string | null>;
  /** Aprova a tarefa que espera na coluna de aprovação (só o solicitante ou um administrador): ela vai para as concluídas. Devolve a coluna. */
  tarefaAprovar(id: string): Promise<string>;
  /** Devolve a tarefa que espera aprovação, com o comentário (obrigatório) no cartão: ela volta para "Fazendo". Devolve a coluna. */
  tarefaDevolver(id: string, comentario: string): Promise<string>;
  tarefaHistorico(id: string): Promise<Historico[]>;
  /** Tarefas em que a pessoa está ligada; com perfilId (a pessoa é da equipe), também as em que é responsável ou participante. */
  tarefasDaPessoa(pessoaId: string, perfilId?: string | null): Promise<TarefaLigada[]>;
  /** Tarefas da demanda, na ordem do quadro (quem vê a demanda vê todas elas). */
  tarefasDaDemanda(demandaId: string): Promise<TarefaLigada[]>;
  /** Tarefas ligadas ao contrato que quem está logado pode ver. */
  tarefasDoContrato(contratoId: string): Promise<TarefaLigada[]>;
  /**
   * Os números dos gráficos do painel do Início (#402), do dia "desde" (aaaa-mm-dd) até hoje. pessoa: só as tarefas em que ela é a
   * responsável ou uma participante, e só o tempo que ela registrou; null: tudo o que quem está logado vê.
   */
  tarefasGraficos(f: { desde: string; pessoa: string | null }): Promise<GraficosDeTarefas>;
}

/** A tarefa nos gráficos do Início (#402): só o que os números e os gráficos contam. */
export type TarefaNosGraficos = Pick<Tarefa, 'id' | 'etapa_id' | 'concluida_em' | 'arquivado_em'>;
/** O que os gráficos do painel do Início contam (#402). */
export interface GraficosDeTarefas {
  /** As tarefas não arquivadas e as concluídas desde o começo do período (mesmo as arquivadas depois). */
  tarefas: TarefaNosGraficos[];
  /** Os registros de tempo do período: quando cada um começou (o ajuste, quando foi feito) e os segundos (o ajuste pode ser negativo). */
  tempos: { inicio: string; segundos: number }[];
}

/** Um registro de tempo de alguém numa tarefa: contado pelo cronômetro, ou ajustado à mão (com motivo). */
export interface RegistroDeTempo {
  id: number;
  perfil_id: string | null;   // null: o usuário foi removido do sistema
  /** Quando o período começou a ser contado (no ajuste, quando foi feito). */
  inicio: string;
  segundos: number;           // no ajuste, pode ser negativo
  ajuste: boolean;
  motivo: string | null;
  /** A última correção (#400): quando e por quê (null: nunca foi corrigido). */
  corrigido_em: string | null;
  motivo_da_correcao: string | null;
}
/** O tempo de uma tarefa, como quem pergunta pode ver. */
export interface TempoDaTarefa {
  /** Os registros que a pessoa pode ver: os dela; os de todos, para administradores. */
  registros: RegistroDeTempo[];
  /** A parte de cada um no total da equipe, em %, de quem tem tempo na tarefa (sem as durações). */
  equipe: { perfil_id: string | null; percentual: number }[];
  /** O total da equipe, em segundos. */
  total: number;
}
/** O tempo de uma pessoa numa tarefa, num período ("Meu tempo trabalhado"). */
export interface TempoNaTarefaDoPeriodo {
  tarefa_id: string; codigo: string; titulo: string; demanda_codigo: string | null; arquivada: boolean;
  /** A soma dos períodos contados e dos ajustes, nunca negativa. */
  segundos: number;
}

/** Tempo nas tarefas (supabase/migrations/20261030120000_tempo_nas_tarefas.sql): o cronômetro e os ajustes. */
export interface DadosTempo {
  /** Começa um período contado, já com os segundos que tem; devolve o id dele, para ir gravando. */
  tempoIniciar(tarefaId: string, inicio: string, segundos: number): Promise<number>;
  /**
   * Grava os segundos do período (só cresce). Devolve false quando o registro não aceita mais o cronômetro: foi apagado ou corrigido
   * (em outra aba, aparelho ou por um administrador, #400); aí quem conta abre um período novo com o que contou depois.
   */
  tempoGravar(id: number, segundos: number): Promise<boolean>;
  /** Ajuste à mão, para mais ou para menos, sempre com motivo (fica registrado como ajuste). */
  tempoAjustar(tarefaId: string, segundos: number, motivo: string): Promise<void>;
  /**
   * Corrige um registro (#400): a duração e/ou o dia (inicio), com o motivo, que vai ao histórico da tarefa. O dono corrige o próprio;
   * o administrador, o de qualquer um do escritório (supabase/migrations/20261121164027_tempo_apagar_e_corrigir.sql).
   */
  tempoCorrigir(id: number, correcao: { segundos: number; inicio: string; motivo: string }): Promise<void>;
  /** Apaga um registro (#400), com a mesma regra de quem corrige; vai ao histórico da tarefa. */
  tempoApagar(id: number): Promise<void>;
  /** Devolve um registro apagado (o Desfazer), com o dono, o dia, a duração e o motivo de antes; devolve o id novo. */
  tempoDevolver(tarefaId: string, registro: RegistroDeTempo): Promise<number>;
  tempoDaTarefa(tarefaId: string): Promise<TempoDaTarefa>;
  /** A soma do tempo das tarefas da demanda (o esforço aproximado dela), para quem vê a demanda. */
  tempoDaDemanda(demandaId: string): Promise<number>;
  /**
   * O tempo de uma pessoa em cada tarefa, entre duas datas (AAAA-MM-DD; "ate" não entra), da maior para a menor.
   * Cada período conta no dia em que começou; o ajuste, no dia em que foi feito. O próprio tempo, ou o de qualquer um
   * para administradores (para os outros, vem vazio). Só as tarefas que quem pede vê.
   */
  tempoPorTarefa(perfilId: string, de: string, ate: string): Promise<TempoNaTarefaDoPeriodo[]>;
}

/** Item de uma lista: feito_em e feito_por são dados pelo banco ao marcar. grupo_id: o grupo em que está (null: no primeiro nível). */
export interface ItemDaLista {
  id: string; texto: string; prazo: string | null; feito_em: string | null; feito_por: string | null; ordem: number; grupo_id: string | null; criado_em: string;
}
/** Cartões que têm checklists (#309: também o contrato). */
export type CartaoComListas = Extract<Modulo, 'demandas' | 'tarefas' | 'contratos'>;
/** Grupo de um checklist (#309): junta itens e subgrupos. O número (1., 1.1) é calculado (regras/gruposDaLista.ts), não guardado. */
export interface GrupoDaLista { id: string; nome: string; pai_id: string | null; ordem: number; criado_em: string }
/** Lista de uma demanda, de uma tarefa ou de um contrato (como as do Trello), com os itens na ordem e os grupos. */
export interface ListaDoCartao { id: string; nome: string; ordem: number; itens: ItemDaLista[]; grupos: GrupoDaLista[] }
/** Onde um grupo ou um item fica: dentro de qual grupo (null: no primeiro nível) e a posição na ordem de leitura do checklist. */
export interface PosicaoNaLista { id: string; tipo: 'grupo' | 'item'; pai_id: string | null; ordem: number }
/** Um nó do modelo: item ({ texto }) ou grupo ({ texto, filhos }). */
export interface NoDoModelo { texto: string; filhos?: NoDoModelo[] }
/** Onde entram os nós novos de um checklist (ondeEntraAArvore em regras/gruposDaLista.ts): a "ordem" de cada um, na ordem de
 *  leitura, e as posições a gravar antes, quando não há vão para eles. */
export interface OndeDosNovos { ordens: number[]; renumerar: PosicaoNaLista[] }

/** Listas das demandas, das tarefas e dos contratos (supabase/migrations/20261027000018_listas_das_demandas.sql, 20261030130000_listas_nas_tarefas.sql e
 * 20261119142702_checklists_com_grupos.sql): quem vê a demanda ou a tarefa vê e mexe nas listas dela; no contrato, lê quem lê e mexe quem altera. */
export interface DadosListas {
  /** As listas do cartão, na ordem, cada uma com os itens na ordem e os grupos. */
  listasDoCartao(modulo: CartaoComListas, id: string): Promise<ListaDoCartao[]>;
  /** Cria a lista no fim das listas do cartão, já com os grupos e os itens (de um modelo), numa vez só. */
  listaCriar(modulo: CartaoComListas, id: string, nome: string, arvore?: NoDoModelo[]): Promise<ListaDoCartao>;
  listaAtualizar(id: string, campos: Partial<Pick<ListaDoCartao, 'nome' | 'ordem'>>): Promise<void>;
  listaExcluir(id: string): Promise<void>;
  /** Cria o grupo onde a posição diz (pai_id e ordem; ver ondeEntraONovo em regras/gruposDaLista.ts). */
  grupoDoChecklistCriar(listaId: string, nome: string, onde: Omit<PosicaoNaLista, 'id' | 'tipo'>): Promise<GrupoDaLista>;
  grupoDoChecklistAtualizar(id: string, campos: Pick<GrupoDaLista, 'nome'>): Promise<void>;
  /** Exclui o grupo, os subgrupos e os itens de dentro. */
  grupoDoChecklistExcluir(id: string): Promise<void>;
  /** Cria o item: sem "onde", no fim do checklist (depois do maior "ordem" de grupos e itens), no primeiro nível. */
  itemCriar(listaId: string, texto: string, onde?: Omit<PosicaoNaLista, 'id' | 'tipo'>): Promise<ItemDaLista>;
  /** feito: marca (o banco anota quando e quem) ou desmarca. */
  itemAtualizar(id: string, campos: Partial<Pick<ItemDaLista, 'texto' | 'prazo' | 'ordem'>> & { feito?: boolean }): Promise<ItemDaLista>;
  itemExcluir(id: string): Promise<void>;
  /** Grava as posições novas de uma vez (subir, descer, mover para grupo). Id que não é do checklist: recusa e nada muda. */
  listaReordenar(listaId: string, posicoes: PosicaoNaLista[]): Promise<void>;
  /**
   * Acrescenta a árvore (um item, várias linhas, um grupo novo, a lista colada com os números como grupos) no fim do grupo (null:
   * no fim do checklist), de uma vez: ou entra tudo, ou nada (#375). Confere os níveis como erroAoAcrescentar (regras/gruposDaLista.ts).
   * Devolve os ids dos grupos criados, na ordem de leitura.
   */
  listaAcrescentar(listaId: string, grupoId: string | null, arvore: NoDoModelo[], onde: OndeDosNovos): Promise<string[]>;
}

/** Modelo de lista do escritório. "itens": as folhas, na ordem (o banco as mantém); "arvore": os grupos e os itens, já reconciliada
 *  com "itens" (o modelo de antes vem sem grupos). Usar um modelo copia o nome e a árvore para o cartão. */
export interface ModeloDeLista { id: string; nome: string; itens: string[]; arvore: NoDoModelo[]; criado_por: string | null; atualizado_em: string }

/** Modelos de lista (supabase/migrations/20261027000019_modelos_de_lista.sql e 20261119142702_checklists_com_grupos.sql): comuns à equipe;
 *  quem criou ou um administrador exclui. */
export interface DadosModelos {
  /** Os modelos do escritório, por nome. */
  modelosListar(): Promise<ModeloDeLista[]>;
  /** Grava o modelo com a árvore (o modelo sem grupos é arvoreDosItens(itens)); o banco põe as folhas em "itens". */
  modeloCriar(nome: string, arvore: NoDoModelo[]): Promise<ModeloDeLista>;
  modeloAtualizar(id: string, campos: Partial<Pick<ModeloDeLista, 'nome' | 'arvore'>>): Promise<void>;
  modeloExcluir(id: string): Promise<void>;
}

/** Processo: judicial ou administrativo (não muda depois; extrajudicial e investigação saíram na #406), com número e pelo menos um cliente. O código
 *  (curto e aleatório) é dado pelo banco. Quem não é administrador vê só os que criou, de que é responsável ou colaborador. */
export type TipoProcesso = 'judicial' | 'administrativo';
/**
 * Como o processo se liga ao de origem: recurso ou incidental (#316), que nascem dele; ou o judicial que nasceu de um administrativo
 * (#425), ligado ao nascer ou depois.
 */
export type LigacaoDeProcesso = 'recurso' | 'incidental' | 'judicial';
/**
 * O papel de uma pessoa no processo (#316) e o de cada cliente (#426). A lista do banco é a mesma (processo_partes e
 * processos.papeis_clientes). O apenado veio do antigo "Polo do cliente" (#426).
 */
export type PapelDaParte = 'autor' | 'reu' | 'terceiro' | 'testemunha' | 'perito' | 'assistente_tecnico' | 'vitima' | 'investigado' | 'apenado' | 'advogado_contrario' | 'outro'
  /** Só nos processos de propriedade intelectual (#317). */
  | 'titular' | 'inventor' | 'autor_da_criacao';
/** O tipo de proteção do processo de propriedade intelectual (#317). A lista do banco é a mesma (migração propriedade_intelectual). */
export type TipoProtecao = 'marca' | 'patente_invencao' | 'modelo_utilidade' | 'desenho_industrial' | 'programa_computador';
/** Como a marca se apresenta e a natureza dela (#317, as listas do Manual de Marcas do INPI). */
export type ApresentacaoMarca = 'nominativa' | 'mista' | 'figurativa' | 'tridimensional' | 'posicao';
export type NaturezaMarca = 'produto' | 'servico' | 'coletiva' | 'certificacao';
/** O antigo "Polo do cliente", um só para o processo: a tela não o grava mais; o papel de cada cliente (#426) ficou no lugar dele. */
export type PoloProcesso = 'autor' | 'reu' | 'terceiro' | 'vitima' | 'investigado' | 'apenado';
/** O papel de cada cliente no processo (#426), pelo id da pessoa. O cliente sem papel (processo antigo, sem polo) fica de fora. */
export type PapeisDosClientes = Partial<Record<string, PapelDaParte>>;
export type MeioProcesso = 'fisico' | 'eletronico';
export type GratuidadeProcesso = 'pedida' | 'concedida' | 'negada' | 'nao_pedida';
/** As listas que o administrador pode ampliar. */
export type CampoDeOpcao = 'sistema' | 'natureza' | 'area';
export interface Processo {
  id: string; codigo: string; tipo: TipoProcesso; numero: string;
  /** O nome do cartão; sem ele, aparecem os clientes. */
  titulo: string | null;
  responsavel_id: string; colaboradores: string[]; cliente_nome: string;
  /** Os grupos da equipe postos no item (#378): quem está num deles participa, como quem é posto um a um. Ausente: nenhum. */
  grupos?: string[];
  orgao: string | null; sistema: string | null; polo: PoloProcesso | null; area: string | null; meio: MeioProcesso | null;
  natureza: string | null; gratuidade: GratuidadeProcesso | null; comarca: string | null; vara: string | null; classe: string | null; assunto: string | null;
  juiz: string | null; distribuicao: string | null; valor_causa: number | null; instancia: string | null; segredo: boolean; advogado_contrario: string | null; observacoes: string | null;
  etapa_id: string | null; etapa_ordem: number | null; arquivado_em: string | null; arquivado_por: string | null;
  criado_por: string | null; criado_em: string; atualizado_por: string | null; atualizado_em: string;
  clientes: PessoaResumida[];
  /** O papel de cada cliente (#426). O banco só guarda o dos clientes do processo. */
  papeis_clientes: PapeisDosClientes;
  /** Os valores dos campos que o escritório criou, por id do campo. */
  campos: Record<string, string>;
  /**
   * O processo de que este nasceu, como recurso ou incidental (#316), ou o administrativo de que o judicial nasceu (#425). O recurso e o
   * incidental são gravados só ao criar; a ligação "judicial" também se faz e se desfaz depois. Excluída a origem, origem_id fica vazio.
   */
  origem_id: string | null;
  ligacao: LigacaoDeProcesso | null;
  /**
   * Propriedade intelectual (#317): só nos processos administrativos (#425) da área "Propriedade intelectual"; vazios nos outros. As datas (aaaa-mm-dd) são
   * as de que os prazos do INPI partem (regras/propriedadeIntelectual.ts). Os processos de antes da migração vêm com tudo vazio.
   */
  protecao?: TipoProtecao | null; deposito?: string | null; concessao?: string | null; publicacao?: string | null; criacao?: string | null;
  /** A publicação do deferimento da marca na RPI (#418): dela conta o prazo após o deferimento, até a concessão. */
  deferimento?: string | null;
  apresentacao_marca?: ApresentacaoMarca | null; natureza_marca?: NaturezaMarca | null; classes_nice?: number[];
  especificacao?: string | null; variacoes?: number | null; linguagem?: string | null;
}
/** Uma pessoa com papel no processo (#316). A mesma pessoa pode ter mais de um papel. */
export interface ParteDoProcesso { id: string; processo_id: string; papel: PapelDaParte; pessoa: PessoaResumida }
/**
 * Como um processo ligado se relaciona com o aberto: é a origem dele (o administrativo, quando o aberto é o judicial que nasceu dele,
 * #425), nasceu dele como recurso, incidental ou judicial, ou foi ligado a ele depois, de qualquer tipo ("relacionado", #440).
 */
export type RelacaoEntreProcessos = 'origem' | 'administrativo' | LigacaoDeProcesso | 'relacionado';
/** Processo ligado a outro (#316), como aparece no cartão. */
export interface ProcessoRelacionado extends Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome' | 'etapa_id' | 'arquivado_em' | 'criado_em'> {
  relacao: RelacaoEntreProcessos;
}
/** O que aparece de uma tarefa ligada; null quando quem está logado não pode vê-la. */
export type TarefaDoAcompanhamento = { id: string; codigo: string } | null;
export type TipoDeAndamento = 'andamento' | 'intimacao' | 'audiencia' | 'pericia';
/**
 * O tipo do andamento na lista pronta (#362), igual para todos os escritórios: o nome de cada um e com que tipo de sempre ele
 * combina ficam em CATEGORIAS_DE_ANDAMENTO (regras/andamentos.ts). Vazio: os andamentos de antes, a perícia e o andamento sem tipo.
 */
export type CategoriaDeAndamento = 'despacho' | 'decisao' | 'sentenca' | 'intimacao' | 'peticao' | 'audiencia';
/** O que aconteceu ou vai acontecer no processo, lançado à mão. */
export interface AndamentoDeProcesso {
  id: string; processo_id: string; tipo: TipoDeAndamento;
  /** O tipo da lista pronta (#362); null nos andamentos de antes, na perícia e no andamento sem tipo. */
  categoria: CategoriaDeAndamento | null;
  /** aaaa-mm-dd */
  data: string;
  /** hh:mm, só de audiência e perícia. */
  hora: string | null;
  local: string | null;
  texto: string;
  /** Intimação: quando foi tratada (virou tarefa ou não precisou). Sem isso, fica "a tratar". */
  tratada_em: string | null;
  tarefa_id: string | null; tarefa: TarefaDoAcompanhamento;
  criado_por: string | null; criado_em: string; atualizado_em: string;
}
/** O andamento novo. Sem o tipo da lista pronta (categoria ausente), ele fica sem ele, como no banco (#362). */
export type DadosAndamento = Pick<AndamentoDeProcesso, 'tipo' | 'data' | 'hora' | 'local' | 'texto'> & Partial<Pick<AndamentoDeProcesso, 'categoria'>>;
export type MudancaNoAndamento = Partial<DadosAndamento & Pick<AndamentoDeProcesso, 'tratada_em' | 'tarefa_id'>>;
/** Prazo do processo. O último dia (final) é o que vale; o resto diz como ele foi contado (vazio: digitado à mão). */
export interface PrazoDeProcesso {
  id: string; processo_id: string; descricao: string;
  /** aaaa-mm-dd */
  final: string;
  intimacao: string | null; dias: number | null; contagem: Contagem | null; disponibilizacao: boolean; sem_recesso: boolean;
  /** A intimação de que ele nasceu. */
  andamento_id: string | null;
  tarefa_id: string | null; tarefa: TarefaDoAcompanhamento;
  concluido_em: string | null;
  criado_por: string | null; criado_em: string; atualizado_em: string;
}
export type DadosPrazo = Pick<PrazoDeProcesso, 'descricao' | 'final' | 'intimacao' | 'dias' | 'contagem' | 'disponibilizacao' | 'sem_recesso' | 'andamento_id'>;
export type MudancaNoPrazo = Partial<DadosPrazo & Pick<PrazoDeProcesso, 'concluido_em' | 'tarefa_id'>>;
/** Campos que o cadastro de processo grava. */
export type DadosProcesso = Partial<{ clientes: string[] } & Omit<Processo, 'id' | 'codigo' | 'cliente_nome' | 'criado_por' | 'criado_em' | 'atualizado_por' | 'atualizado_em' | 'clientes'>>;
/** Linha das listagens de processos (tabela e quadro). */
export type ProcessoLista = Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'responsavel_id' | 'colaboradores' | 'grupos' | 'cliente_nome' | 'orgao' | 'sistema' | 'papeis_clientes' | 'comarca' | 'vara'
  | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em'> & ComEtiquetas;
export interface FiltroProcessos {
  /** O quadro de cada tipo é separado: o tipo vem sempre. */
  tipo: TipoProcesso;
  termo?: string;
  etiqueta?: string;
  /** Um usuário da equipe: os processos em que ele é o responsável ou um colaborador. */
  pessoa?: string;
  /** A sigla do órgão. */
  orgao?: string;
  /** Uma coluna do quadro (ou SEM_FASE: os de fora do quadro). */
  etapa?: string;
  situacao?: 'ativos' | 'arquivados';
  ordem?: Ordem;
  pagina?: number;
  porPagina?: number;
}
export type PapelNoProcesso = 'cliente' | 'responsavel' | 'colaborador';
/** Processo como aparece no cartão da pessoa, com o papel dela nele. */
export interface ProcessoLigado extends Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome' | 'etapa_id' | 'arquivado_em' | 'criado_em'> {
  papeis: PapelNoProcesso[];
  /** No cartão da pessoa: os papéis dela no processo, além de cliente e equipe (#316). */
  partes?: PapelDaParte[];
}
/** Opção acrescentada pelo administrador a uma das listas. */
export interface OpcaoDeProcesso { id: string; campo: CampoDeOpcao; valor: string }
/** Campo que o escritório cria nos processos. Apagado, some do cadastro e do cartão, e o que foi preenchido fica guardado. */
export type TipoDeCampo = 'texto' | 'data' | 'numero' | 'lista';
export type ApareceEm = TipoProcesso | 'ambos';
export interface CampoDeProcesso { id: string; nome: string; tipo: TipoDeCampo; aparece_em: ApareceEm; opcoes: string[]; apagado_em: string | null }
export type DadosCampoDeProcesso = Pick<CampoDeProcesso, 'nome' | 'tipo' | 'aparece_em' | 'opcoes'>;
/** O que já foi digitado nos processos do escritório, para sugerir. */
export interface SugestoesDeProcesso { orgaos: string[]; comarcas: string[]; varas: string[] }

/** Processos (supabase/migrations/20261101155218_processos.sql). */
export interface DadosProcessos {
  processosListar(f: FiltroProcessos): Promise<Pagina<ProcessoLista>>;
  processosDaEtapa(etapaId: string | null, f: FiltroProcessos, deslocamento?: number, limite?: number): Promise<Pagina<ProcessoLista>>;
  processoObter(id: string): Promise<Processo | null>;
  processoCriar(dados: DadosProcesso & { tipo: TipoProcesso }): Promise<{ id: string; codigo: string }>;
  processoAtualizar(id: string, dados: DadosProcesso): Promise<{ id: string; codigo: string }>;
  processosArquivar(ids: string[], arquivar?: boolean): Promise<number>;
  /** Só processos arquivados são excluídos (por quem criou ou um administrador). */
  processosExcluir(ids: string[]): Promise<Exclusao>;
  processoMover(id: string, etapaId: string | null, ordem: number | null): Promise<void>;
  /** Quem está na tarefa, demanda, processo ou compromisso sai dele, mesmo que perca o acesso. A saída fica no histórico do cartão. */
  cartaoSair(modulo: ModuloComSaida, id: string): Promise<void>;
  /** Na fase de adaptação, o advogado entra no processo. Ao assumir, quem era responsável continua como colaborador. */
  processoMeIncluir(id: string, como: ComoEntrarNoProcesso): Promise<void>;
  /** Só administradores. Ligada, toda a equipe vê e edita tudo, menos o financeiro. Desligada, volta a regra normal. */
  faseDeAdaptacaoDefinir(ligada: boolean): Promise<void>;
  processoHistorico(id: string): Promise<Historico[]>;
  /** Processos em que a pessoa é cliente; com perfilId (a pessoa é da equipe), também os em que é responsável ou colaboradora. */
  processosDaPessoa(pessoaId: string, perfilId?: string | null): Promise<ProcessoLigado[]>;
  /** As pessoas com papel no processo (#316), na ordem em que entraram. */
  processoPartes(processoId: string): Promise<ParteDoProcesso[]>;
  /** Põe a pessoa no processo com o papel (#316): quem altera o processo, com ele ativo. O mesmo papel de novo é recusado. */
  processoParteIncluir(processoId: string, pessoaId: string, papel: PapelDaParte): Promise<ParteDoProcesso>;
  processoParteRetirar(id: string): Promise<void>;
  /**
   * Os processos ligados a este (#316): a origem dele e os recursos e incidentais que nasceram dele, que quem está logado vê; e, desde
   * a #425, o administrativo de que o judicial nasceu e os judiciais que nasceram do administrativo; e, desde a #440, os ligados
   * depois, de qualquer tipo ("relacionado"). O processo que tem as duas ligações com o aberto aparece uma vez só, pela origem.
   */
  processosRelacionados(processoId: string): Promise<ProcessoRelacionado[]>;
  /**
   * Liga ao administrativo um judicial que já existe (#425): quem liga altera os dois, ativos, e o judicial ainda não tem origem
   * (o recurso e o incidental continuam ligados ao processo de que nasceram).
   */
  processoJudicialLigar(administrativoId: string, judicialId: string): Promise<void>;
  /** Desfaz a ligação do judicial ao administrativo (#425; o recurso e o incidental não se desligam): quem altera um dos dois. */
  processoJudicialDesligar(judicialId: string): Promise<void>;
  /**
   * Liga um processo a outro que já existe, de qualquer tipo (#440; supabase/migrations/20261125104145_processos_relacionados.sql):
   * quem altera os dois, ativos. O mesmo par, em qualquer sentido, é a mesma ligação: ligar de novo devolve false e nada muda.
   */
  processoRelacionar(processoId: string, outroId: string): Promise<boolean>;
  /** Desfaz a ligação entre os dois (#440), nos dois cartões: quem altera um deles, mesmo arquivado. */
  processoDesrelacionar(processoId: string, outroId: string): Promise<void>;
  processoOpcoes(): Promise<OpcaoDeProcesso[]>;
  /** Só administradores. */
  processoOpcaoCriar(campo: CampoDeOpcao, valor: string): Promise<OpcaoDeProcesso>;
  /** Só administradores. Os processos que já usam a opção continuam com o valor. */
  processoOpcaoExcluir(id: string): Promise<void>;
  processoSugestoes(tipo: TipoProcesso): Promise<SugestoesDeProcesso>;
  /** Os campos do escritório, inclusive os apagados (o histórico precisa do nome deles). */
  processoCampos(): Promise<CampoDeProcesso[]>;
  /** Só administradores. */
  processoCampoCriar(dados: DadosCampoDeProcesso): Promise<CampoDeProcesso>;
  /** Só administradores. O tipo não muda. Com apagado_em, apaga ou reativa. */
  processoCampoAtualizar(id: string, dados: Partial<Omit<CampoDeProcesso, 'id' | 'tipo'>>): Promise<CampoDeProcesso>;
  /** Só administradores, e só o campo que nenhum processo usa. Devolve se excluiu. */
  processoCampoExcluir(id: string): Promise<boolean>;
}

/** Etiqueta do escritório: uma cor da paleta e, se quiser, um texto (sem texto, é uma faixa colorida). */
export interface Etiqueta {
  id: string; cor: CorDaEtiqueta; texto: string | null; criado_por: string | null;
  /** Etiqueta que o sistema aplica em Pessoas (não pode ser excluída): "Importada" e "Incompleta", que anda junto com as pendências. */
  sistema?: 'importada' | 'incompleta' | null;
}
/** Os módulos cujos cartões levam etiquetas. */
export type ModuloComEtiquetas = Extract<Modulo, 'pessoas' | 'contratos' | 'demandas' | 'tarefas' | 'processos' | 'compromissos' | 'anotacoes'>;
/** Item de lista com as etiquetas dele (etq: as ligações, como vêm do banco). */
export interface ComEtiquetas { etq?: { etiqueta_id: string }[] }

/** Etiquetas (supabase/migrations/20261101131705_etiquetas.sql): lista única do escritório; qualquer pessoa cria e aplica nos
 *  cartões que vê; muda ou exclui quem criou ou um administrador. */
export interface DadosEtiquetas {
  etiquetasListar(): Promise<Etiqueta[]>;
  etiquetaCriar(cor: CorDaEtiqueta, texto: string | null): Promise<Etiqueta>;
  etiquetaAtualizar(id: string, campos: Pick<Etiqueta, 'cor' | 'texto'>): Promise<void>;
  /** Exclui a etiqueta e a tira de todos os cartões. */
  etiquetaExcluir(id: string): Promise<void>;
  /** Os ids das etiquetas do cartão. */
  etiquetasDoCartao(modulo: ModuloComEtiquetas, id: string): Promise<string[]>;
  etiquetaAplicar(modulo: ModuloComEtiquetas, id: string, etiquetaId: string): Promise<void>;
  etiquetaTirar(modulo: ModuloComEtiquetas, id: string, etiquetaId: string): Promise<void>;
  /** O mesmo, nos cartões selecionados. */
  etiquetaAplicarEmLote(modulo: ModuloComEtiquetas, ids: string[], etiquetaId: string): Promise<void>;
  etiquetaTirarEmLote(modulo: ModuloComEtiquetas, ids: string[], etiquetaId: string): Promise<void>;
}

/** Órgão em que o escritório atua (TJMG, TRF6, INPI…): como os prazos dele contam quando ninguém escolhe e que dias
 *  prontos ele segue além dos feriados nacionais (regras/calendario.ts). */
export interface Orgao {
  id: string; sigla: string; nome: string | null; contagem_padrao: Contagem;
  /** Segue o recesso forense (20/12 a 20/01). */
  recesso: boolean;
  /** Não tem expediente no Carnaval, na Sexta-feira Santa e no Corpus Christi. */
  praxe: boolean;
  /** Segue os feriados da Justiça Federal (Lei 5.010/1966, art. 62). */
  justica_federal: boolean;
}
export type DadosOrgao = Omit<Orgao, 'id'>;
/** Dia sem expediente lançado pelo escritório. Sem órgão: vale para todos. */
export interface DiaLancado { id: string; data: string; motivo: string; tipo: TipoSemExpediente; orgao_id: string | null }
/** Um lançamento: os mesmos motivo e tipo, em cada dia e para cada órgão (null: todos os órgãos). */
export interface LinhaDeLancamento { data: string; motivo: string; tipo: TipoSemExpediente; orgao_id: string | null }

/** Calendário de feriados e suspensões (supabase/migrations/20261101112711_calendario_de_prazos.sql): todos do
 *  escritório consultam; só os administradores mudam. Os feriados nacionais e os prontos não ficam no banco. */
export interface DadosCalendario {
  /** Os órgãos do escritório, por sigla. */
  orgaosListar(): Promise<Orgao[]>;
  orgaoCriar(o: DadosOrgao): Promise<Orgao>;
  orgaoAtualizar(id: string, campos: Partial<DadosOrgao>): Promise<void>;
  /** Exclui o órgão e os dias lançados só para ele. */
  orgaoExcluir(id: string): Promise<void>;
  /** Os dias lançados de `de` a `ate` (inclusive, "aaaa-mm-dd"), por data. */
  diasListar(de: string, ate: string): Promise<DiaLancado[]>;
  /** Grava as linhas; a que repete dia e órgão de outra substitui o motivo e o tipo. Devolve quantas gravou. */
  diasLancar(linhas: LinhaDeLancamento[]): Promise<number>;
  /** Exclui os dias lançados (ex.: todos os de um período). */
  diasExcluir(ids: string[]): Promise<void>;
}

/** Inscrição na OAB: o número e a seccional (UF). */
export interface InscricaoOab { numero: string; uf: string }
/** Uma formação: curso, instituição e ano (ou período). */
export interface Formacao { curso: string; instituicao: string; ano: string }
/** Uma experiência: cargo, onde e o período. */
export interface Experiencia { cargo: string; lugar: string; periodo: string }
/** Uma publicação: título, onde saiu, ano e o link (opcional). */
export interface Publicacao { titulo: string; onde: string; ano: string; link: string }
/** Uma rede social além do LinkedIn (ex.: Instagram) e o link. */
export interface RedeSocial { nome: string; link: string }
/**
 * Perfil profissional de alguém da equipe: a base das páginas da equipe no site do escritório (o CMS), do currículo
 * e da importação do Lattes. Textos vazios são "". "Aparecer no site" e a ordem, só administradores mudam.
 */
export interface PerfilProfissional {
  perfil_id: string;
  nome_exibicao: string; cargo: string;
  oab: InscricaoOab[]; areas: string[];
  bio_curta: string; biografia: string;
  formacao: Formacao[]; idiomas: string[];
  experiencia: Experiencia[]; associacoes: string[];
  publicacoes: Publicacao[]; lattes: string;
  email_publico: string; telefone_publico: string; linkedin: string; redes: RedeSocial[];
  no_site: boolean; ordem_no_site: number | null;
  /** Quando foi salvo pela última vez (null: ainda não foi preenchido). */
  atualizado_em: string | null;
}
/** O que se grava do perfil: tudo, menos de quem é e a data. */
export type CamposDoPerfil = Omit<PerfilProfissional, 'perfil_id' | 'atualizado_em'>;

/** Perfis profissionais (supabase/migrations/20261030140000_perfil_profissional.sql): a equipe vê os do escritório. */
export interface DadosPerfilProfissional {
  /** O perfil de alguém da equipe; vazio (perfilVazio em regras/perfilProfissional.ts) se ainda não foi preenchido. */
  perfilProfissional(perfilId: string): Promise<PerfilProfissional>;
  /** Grava o próprio perfil ou, para administradores, o de alguém da equipe. "Aparecer no site" e a ordem, só administradores. */
  perfilProfissionalSalvar(perfilId: string, campos: CamposDoPerfil): Promise<void>;
}

/** A foto do perfil: os links dos dois AVIF redondos (valem por pouco tempo) e quando ela foi trocada. */
export interface FotoDoPerfil { grande: string; pequena: string; em: string }

/** Foto do perfil (supabase/migrations/20261030150000_foto_do_perfil.sql): pasta privada, só a equipe do escritório vê. */
export interface DadosFotos {
  /** A foto de alguém da equipe, ou null se ainda não tem. */
  fotoDoPerfil(perfilId: string): Promise<FotoDoPerfil | null>;
  /** Grava a própria foto ou, para administradores, a de alguém da equipe: os dois AVIF já redondos (1000 e 150). */
  fotoSalvar(perfilId: string, grande: Blob, pequena: Blob): Promise<void>;
  /** Tira a foto: apaga os dois arquivos, e as bolinhas voltam às iniciais. */
  fotoRemover(perfilId: string): Promise<void>;
}

/** A conta Google ligada ao escritório (supabase/migrations/20261031120000_ligacao_google.sql). Nunca traz a autorização. */
export interface LigacaoGoogle { conta_email: string; escopos: string[]; ligado_em: string; ligado_por: string | null }
/** Como terminou a tentativa de ligar a conta Google (a página de Configurações mostra um aviso para cada um). */
/**
 * Como terminou a tentativa de ligar a conta Google, ou de somar a ela a permissão da agenda (#166): 'agenda-ligada',
 * 'sem-permissao-agenda' (faltou marcar a agenda no Google) e 'outra-conta' (entrou-se no Google com outra conta).
 */
export type ResultadoDaLigacao = 'ligado' | 'recusado' | 'sem-permissao' | 'expirado' | 'erro' | 'agenda-ligada' | 'sem-permissao-agenda' | 'outra-conta'
  | 'meet-ligado' | 'sem-permissao-meet';

/**
 * O que impede a sincronização dos contatos (public.sincronizacao_google e public.primeira_sincronizacao_google): autorização
 * vencida, Google fora, dados recusados, ou a primeira sincronização que não consegue terminar (o Google recusou a leitura
 * da conta ou o próprio SEMPER falhou: não passa sozinho).
 */
export type ProblemaDaSincronizacao = 'autorizacao' | 'google-fora' | 'recusado' | 'primeira-recusada';
/** Como está a sincronização das pessoas com o Google Contatos do escritório (supabase/migrations/20261120205439_contatos_google.sql). */
export interface SincronizacaoGoogle {
  /** O administrador ligou a sincronização (começa desligada). */
  ativa: boolean;
  /** Pessoas esperando para ir ao Google; com_falha: as que já falharam 3 vezes ou mais. */
  pendentes: number;
  com_falha: number;
  problema: ProblemaDaSincronizacao | null;
  problema_em: string | null;
  /** A última vez que um contato foi criado ou atualizado no Google. */
  sincronizado_em: string | null;
  /**
   * Quando terminou a primeira sincronização (ler os contatos que já estão na conta e ligar os que são de pessoas do
   * escritório); null enquanto ela não terminou, e então nada é criado no Google.
   */
  primeira_em: string | null;
  /** Contatos do Google que podem ser de alguém do escritório, esperando o administrador decidir (a lista Para conferir). */
  para_conferir: number;
}
/** Como terminou o "Sincronizar agora". 'desligada': a sincronização está desligada (ou quem pediu não é administrador). */
export interface ResultadoDaSincronizacao {
  resultado: 'ok' | 'desligada' | 'erro'; sincronizados: number; falhas: number;
  /** Só quando a primeira sincronização terminou agora: contatos ligados, contatos para conferir e pessoas que vão ganhar um contato novo. */
  primeira?: { ligados: number; para_conferir: number; novos: number };
  /** A primeira sincronização não terminou agora (falhou ou outra execução a está fazendo): nada foi criado no Google. */
  primeira_por_fazer?: boolean;
}

/**
 * Por que um contato do Google ficou para conferir (supabase/functions/_compartilhado/correspondenciaDeContatos.ts): mais de uma
 * pessoa possível, só o nome bate, o telefone ou o aniversário não combina, ou a pessoa já tem outro contato (repetido no Google).
 */
export type MotivoParaConferir = 'varios' | 'so-nome' | 'conflito' | 'repetido';
/** Uma pessoa do escritório que pode ser o contato. */
export interface PessoaPossivel {
  id: string; codigo: string; tipo: TipoPessoa; nome: string; telefones: string[]; emails: string[];
  nascimento: string | null; abertura: string | null; arquivada: boolean;
  /** Já tem um contato nesta conta Google: não pode ser ligada a mais um (o contato para conferir é repetido dela). */
  ligada: boolean;
}
/** Um contato da conta Google que pode ser de alguém do escritório (com os dados como estão no Google). */
export interface ContatoParaConferir {
  id: string;
  nome: string | null;
  telefones: string[];
  emails: string[];
  /** "aaaa-mm-dd", ou "mm-dd" quando o Google não tem o ano. */
  aniversario: string | null;
  motivo: MotivoParaConferir;
  criado_em: string;
  /** As pessoas possíveis, a mais provável primeiro. */
  candidatos: PessoaPossivel[];
}
/** O que o administrador decide: o contato é desta pessoa; é de outra pessoa (o SEMPER cria um contato novo); ou deixa como está. */
export type DecisaoDoContato = { acao: 'ligar'; pessoa_id: string } | { acao: 'outra' } | { acao: 'ignorar' };

/** O que impede as agendas no Google (public.agendas_google_situacao): autorização vencida, Google fora ou dados recusados. */
export type ProblemaDasAgendas = 'autorizacao' | 'google-fora' | 'recusado';
/** Como estão as agendas do escritório no Google Agenda (#166; supabase/migrations/20261125105000_agendas_google.sql). */
export interface AgendasGoogle {
  /** O administrador ligou as agendas (começam desligadas). */
  ativa: boolean;
  /** A conta Google do escritório deu a permissão da agenda (pedida à parte, depois dos contatos). */
  autorizada: boolean;
  /** Pedidos esperando para ir ao Google; com_falha: os que já falharam 3 vezes ou mais. */
  pendentes: number;
  com_falha: number;
  problema: ProblemaDasAgendas | null;
  problema_em: string | null;
  /** A última vez que as agendas foram arrumadas no Google. */
  sincronizado_em: string | null;
  /** Quantas agendas o SEMPER já criou na conta e quantos compartilhamentos fez. */
  agendas: number;
  compartilhamentos: number;
}
/** O que o "Sincronizar agora" das agendas fez no Google (supabase/functions/_compartilhado/agendasGoogle.ts). */
export interface ResultadoDasAgendas {
  resultado: 'ok' | 'desligada' | 'erro';
  /** As ações nas agendas e, nos eventos (#166, parte 2), as cópias gravadas (novas ou mudadas) e as tiradas. */
  feitas: { criar: number; renomear: number; compartilhar: number; retirar: number; gravar_evento: number; apagar_evento: number; reuniao: number };
  falhas: number;
  /** Faltou tempo: o resto vai sozinho na próxima vez. */
  restam: boolean;
}

/**
 * O Google Meet no escritório (#437; public.reunioes_google_situacao): a conta Google do escritório deu as permissões do Meet
 * (autorizado) e, além disso, as agendas no Google estão ligadas (disponivel: a reunião vai pela fila delas).
 */
export interface SituacaoDasReunioes { autorizado: boolean; disponivel: boolean }
/** Um compartilhamento que o Google recusou (public.agendas_google_recusas): o e-mail, a agenda, o que o Google respondeu e quando. */
export interface RecusaDasAgendas { email: string; agenda: string; detalhe: string | null; recusada_em: string }

/** Ligações com contas de fora (hoje, a conta Google do escritório). Ligar e desligar: só administradores. */
export interface DadosLigacoes {
  /** A conta Google ligada ao escritório, ou null. */
  ligacaoGoogle(): Promise<LigacaoGoogle | null>;
  /** Começa a ligação: devolve o endereço para onde o navegador vai (o servidor do SEMPER, que leva ao Google). */
  ligacaoGoogleIniciar(voltarPara: string): Promise<string>;
  /**
   * Conclui a ligação na volta do Google, com o estado e o código que vieram no endereço. Só conclui para quem pediu a
   * ligação, ainda administrador do escritório, e uma vez só; senão o resultado é "expirado".
   */
  ligacaoGoogleConcluir(estado: string, codigo: string): Promise<ResultadoDaLigacao>;
  /** Desliga a conta Google do escritório (apaga a ligação e a autorização guardada, que é revogada no Google). */
  ligacaoGoogleDesligar(): Promise<void>;
  /** Como está a sincronização dos contatos, ou null sem conta ligada (ou para quem não é administrador). */
  sincronizacaoGoogle(): Promise<SincronizacaoGoogle | null>;
  /** Liga ou desliga a sincronização dos contatos (só administradores, com a conta ligada). Desligar esvazia a fila. */
  sincronizacaoGoogleLigar(ligar: boolean): Promise<void>;
  /** Leva agora ao Google quem está na fila do escritório, sem esperar a rotina (só administradores). */
  sincronizarGoogleAgora(): Promise<ResultadoDaSincronizacao>;
  /** Os contatos do Google para conferir, os mais antigos primeiro (só administradores; os outros recebem a lista vazia). */
  contatosParaConferir(): Promise<ContatoParaConferir[]>;
  /** Decide um contato para conferir; ele sai da lista e não volta (só administradores). */
  contatoParaConferirDecidir(id: string, decisao: DecisaoDoContato): Promise<void>;
  /** Começa o pedido da permissão da agenda (#166) na conta já ligada: devolve o endereço para onde o navegador vai. Só administradores. */
  ligacaoGoogleAutorizarAgendas(voltarPara: string): Promise<string>;
  /** Como estão as agendas no Google, ou null sem conta ligada (ou para quem não é administrador). */
  agendasGoogle(): Promise<AgendasGoogle | null>;
  /** Liga ou desliga as agendas no Google (só administradores; ligar pede a agenda autorizada). Desligar esvazia a fila e não apaga nada no Google. */
  agendasGoogleLigar(ligar: boolean): Promise<void>;
  /** Arruma agora as agendas do escritório no Google, sem esperar a rotina (só administradores). */
  sincronizarAgendasAgora(): Promise<ResultadoDasAgendas>;
  /**
   * Os compartilhamentos que o Google recusou (o Workspace que não deixa compartilhar com contas de fora, por exemplo): o
   * resto continua indo, e o "Sincronizar agora" tenta cada um de novo. Só administradores; os outros recebem a lista vazia.
   */
  agendasGoogleRecusas(): Promise<RecusaDasAgendas[]>;
  /** Começa o pedido das permissões do Google Meet (#437) na conta já ligada: devolve o endereço para onde o navegador vai. Só administradores. */
  ligacaoGoogleAutorizarMeet(voltarPara: string): Promise<string>;
  /** O Google Meet no escritório, para qualquer um da equipe (o cadastro do compromisso mostra a opção), ou null sem conta ligada. */
  reunioesGoogle(): Promise<SituacaoDasReunioes | null>;
}

/** Uma linha do arquivo pronta para gravar (montada por planejar(), em regras/importacao.ts). */
export interface ItemImportacao {
  /** Número da linha no arquivo (para as mensagens de erro). */
  linha: number;
  referencia: string | null;
  /** Cadastro que já existe e vai ser completado; null = pessoa nova. */
  existente_id: string | null;
  /** Pessoa nova: o cadastro todo. Existente: só o que completa (completarVazios). */
  dados: DadosPessoa;
  /** Data antiga de cadastro (ISO); null = agora. Só vale para pessoa nova; no futuro ou antes de 1900, o banco usa agora. */
  criado_em: string | null;
  /** Ids de perfil dos responsáveis a acrescentar (nenhum é tirado). */
  responsaveis: string[];
  /** Pessoa nova: a observação toda. Existente: o texto a ACRESCENTAR ao que já está lá (null = nada novo). */
  observacoes: string | null;
  /** Pessoa nova: as pendências. Existente: as que se juntam às que já estão lá. */
  pendencias: Pendencia[];
}
/** O que um lote gravou: quantas pessoas novas, quantas completadas e o cadastro de cada linha. */
export interface ResultadoLote { criadas: number; completadas: number; ids: { linha: number; id: string }[] }
/** Uma importação (tabela importacoes): quem fez, quando e quantas pessoas. Criadas e incompletas o banco conta ao concluir. */
export interface Importacao {
  id: string; descricao: string; arquivo: string | null; criadas: number; completadas: number; incompletas: number;
  feito_por: string | null; iniciada_em: string; concluida_em: string | null;
}

/** Importação de pessoas de um arquivo CSV (supabase/migrations/20261031200000_importar_pessoas.sql). Só administradores. */
export interface DadosImportacao {
  /** Cadastros completos (com os responsáveis), inclusive arquivados, achados pelos CPF/CNPJ ou pelas referências do arquivo. */
  pessoasParaImportar(chaves: { documentos: string[]; referencias: string[] }): Promise<Pessoa[]>;
  /** Abre a importação; devolve o id dela. A descrição fica só na importação (não vai ao registro de ações): só contagens, sem dados pessoais. */
  importacaoIniciar(descricao: string, arquivo: string | null): Promise<string>;
  /**
   * Grava um lote (até LOTE_MAXIMO_DA_IMPORTACAO linhas): tudo ou nada. Se uma linha falha, nada do lote entra, e o
   * erro diz só o número da linha e o motivo ("Linha 12: já existe um cadastro com este CPF/CNPJ ou esta referência.").
   */
  pessoasImportar(importacaoId: string, lote: ItemImportacao[]): Promise<ResultadoLote>;
  /**
   * Fecha a importação (uma vez só) e grava a linha-resumo no registro de ações, só com números. Criadas e incompletas
   * o banco conta; completadas é o que o site informa (a soma dos lotes).
   */
  importacaoConcluir(importacaoId: string, completadas: number): Promise<Importacao>;
}

/** Colunas dos quadros (kanban). */
export interface DadosQuadros {
  colunasListar(modulo: Modulo): Promise<Coluna[]>;
  sugestoesListar(modulo: Modulo): Promise<string[]>;
  colunaCriar(modulo: Modulo, nome: string, ordem: number, grupoId?: string | null): Promise<Coluna>;
  /** Põe a coluna num grupo do mesmo quadro (null: sem grupo), na ordem dada. */
  colunaAgrupar(id: string, grupoId: string | null, ordem: number): Promise<void>;
  /** Os grupos do quadro, na ordem. */
  gruposListar(modulo: Modulo): Promise<GrupoDeColunas[]>;
  grupoCriar(modulo: Modulo, nome: string, ordem: number): Promise<GrupoDeColunas>;
  grupoAtualizar(id: string, campos: Partial<Omit<GrupoDeColunas, 'id'>>): Promise<void>;
  /** Exclui o grupo; as colunas dele ficam sem grupo. */
  grupoExcluir(id: string): Promise<void>;
  colunaOcultar(id: string, ocultar: boolean): Promise<void>;
  colunaRenomear(id: string, nome: string): Promise<void>;
  colunaOrdenar(id: string, ordem: number): Promise<void>;
  colunaExcluir(id: string): Promise<void>;
}

/** Por que a troca de e-mail pelo administrador não aconteceu. */
/** Por que a conta reservada não foi criada (cada resposta da função equipe-reservar-conta). */
export type RecusaDaReserva = 'sem-permissao' | 'ja-na-equipe' | 'convite-pendente' | 'erro';
export type RecusaDaTrocaDeEmail = 'sem-permissao' | 'so-o-master' | 'email-invalido' | 'email-em-uso' | 'convite-pendente' | 'limite' | 'erro';

/** Equipe, convites, registro de ações e dados do escritório (administração). */
export interface DadosEquipe {
  equipeListar(): Promise<Usuario[]>;
  conviteCriar(pessoaId: string, email: string, papel: Papel): Promise<ConviteCriado>;
  /** Link novo para um convite pendente (o anterior deixa de valer). Devolve o código. */
  conviteNovoLink(id: string): Promise<string>;
  equipeDefinirPapel(perfilId: string, papel: Papel): Promise<void>;
  /** Só administradores; fica no registro de ações. */
  equipeDefinirFuncao(perfilId: string, funcao: Funcao): Promise<void>;
  /** Muda o nome de alguém da equipe (administrador; o de um administrador, só o master; o de um master, só ele). */
  equipeDefinirNome(perfilId: string, nome: string): Promise<void>;
  equipeDefinirAtivo(perfilId: string, ativo: boolean): Promise<void>;
  /**
   * Troca na hora o e-mail de acesso de quem perdeu o e-mail antigo, sem link de confirmação. Vale para quem o administrador
   * pode gerir (nunca um master, a própria conta ou o dono da plataforma; quem alcança informações sigilosas, só o master).
   * Encerra as sessões abertas da pessoa, tira a senha antiga de uso e fica no registro de ações.
   */
  equipeTrocarEmail(perfilId: string, email: string): Promise<void>;
  /** Cadastra na equipe alguém que não entra no sistema, para constar como responsável ou participante de contratos. Só administradores; fica no registro de ações. */
  equipeReservarConta(pessoaId: string): Promise<void>;
  /**
   * Exclui da equipe quem já está desativado (ou tem conta reservada): apaga o acesso, a foto, o perfil profissional, a ligação
   * com o Google e os avisos. O nome fica nos registros antigos, e o que estava sob a responsabilidade da pessoa continua no
   * nome dela. Mesma regra de quem desativa; não tem desfazer. Fica no registro de ações. Some de equipeListar.
   */
  equipeExcluir(perfilId: string): Promise<void>;
  /** As últimas trocas de e-mail pelo administrador, separadas do resto do registro de ações (só administradores). */
  trocasDeEmailListar(limite?: number): Promise<RegistroAuditoria[]>;
  convitesListar(): Promise<Convite[]>;
  conviteCancelar(id: string): Promise<void>;
  auditoriaListar(limite?: number): Promise<RegistroAuditoria[]>;
  /**
   * O e-mail do Google de alguém da equipe (#166), o que recebe as agendas do escritório: o informado (null: usa o de entrada)
   * e o de entrada. Só a própria pessoa e os administradores; para os outros, null.
   */
  emailDoGoogle(perfilId: string): Promise<EmailDoGoogle | null>;
  /**
   * Muda o e-mail do Google: a própria pessoa, ou um administrador (o de um administrador, só o master; o de um master, só ele).
   * Vazio (ou o de entrada) volta ao de entrada. Fica no registro de ações.
   */
  emailDoGoogleSalvar(perfilId: string, email: string): Promise<void>;
  /** Registra uma exportação no registro de ações (LGPD). Vem antes de entregar o arquivo; só administradores. */
  exportacaoRegistrar(tabela: 'pessoas', descricao: string, quantidade: number): Promise<void>;

  /** Salva os dados da instituição (só administradores). logo ausente mantém a atual; null a remove. */
  escritorioSalvar(dados: Omit<DadosEscritorio, 'logo'> & { logo?: string | null }): Promise<void>;
}

/** Módulos cujos cartões têm comentários (cada um com a sua coluna na tabela comentarios). */
export type ModuloComentado = 'pessoas' | 'contratos' | 'demandas' | 'tarefas' | 'compromissos' | 'anotacoes' | 'processos';
export interface Comentario {
  id: string;
  autor_id: string | null;   // null: o usuário foi removido do sistema
  texto: string;
  mencoes: string[];         // perfis marcados com @ (o banco acha no texto)
  criado_em: string;
  editado_em: string | null;
}

/** Comentários dos cartões, com @ (supabase/migrations/20261027000016_comentarios.sql). */
export interface DadosComentarios {
  /** Os comentários do cartão, do mais novo para o mais antigo. */
  comentariosListar(modulo: ModuloComentado, cartaoId: string): Promise<Comentario[]>;
  comentarioCriar(modulo: ModuloComentado, cartaoId: string, texto: string): Promise<Comentario>;
  /** Só quem escreveu. */
  comentarioEditar(id: string, texto: string): Promise<Comentario>;
  /** Quem escreveu ou um administrador. */
  comentarioExcluir(id: string): Promise<void>;
  /**
   * Os itens chamados com !código nos comentários (#297), dos módulos mencionáveis: só os que quem lê vê (as regras de leitura de
   * cada módulo), arquivados também. O código que não volta é de um item que a pessoa não vê ou que não existe mais.
   */
  itensMencionados(codigos: string[]): Promise<ItemDaAnotacao[]>;
}
/** Os módulos cujos itens se chamam pelo código, com !, nos comentários (#297). */
export type ModuloMencionavel = Extract<ModuloDaAnotacao, 'tarefas' | 'demandas' | 'contratos' | 'processos' | 'pessoas'>;

/** O comentário de onde veio a menção, com o cartão em que ele está. */
export interface ComentarioDaMensagem {
  id: string;
  autor_id: string | null;
  texto: string;
  modulo: ModuloComentado;
  cartao_id: string;
  cartao_codigo: string;
  cartao_nome: string | null;
  /** Só no comentário de um processo (#362): a página do cartão depende do tipo dele. Nos outros módulos, null. */
  tipo_do_processo: TipoProcesso | null;
}
/**
 * A menção, o aviso de prazo, do pedido para participar (#363) o pedido (para quem aprova) e a resposta (para quem pediu), e o aviso
 * de quem entrou num item (#377).
 */
export type TipoMensagem = 'mencao' | 'prazo' | 'pedido' | 'resposta' | 'inclusao' | 'grupo' | 'demandaDoCompromisso' | 'tarefa';
export type ModuloDoPrazo = 'processos' | 'demandas' | 'tarefas' | 'compromissos';
export type PrazoParado = 'cancelado' | 'excluido' | 'arquivado';
/** Qual aviso é (prazo_aviso no banco): até 3 dias antes, no dia, ou o lembrete marcado na tarefa ou na demanda (#286). */
export type AvisoDePrazo = 'proximo' | 'hoje' | 'lembrete';
/** O prazo de que o aviso fala. `pagina` é o caminho da lista onde o cartão abre. */
export interface PrazoDaMensagem {
  modulo: ModuloDoPrazo;
  pagina: string;
  cartao_id: string;
  cartao_codigo: string;
  titulo: string;
  /** A data atual do cartão; sem ela, a data de que o aviso falou. */
  data: string;
  hora: string | null;
  concluido: boolean;
  /** O prazo deixou de valer: o aviso antigo não continua dizendo que ele vence. */
  parado: PrazoParado | null;
  aviso: AvisoDePrazo;
  /** No lembrete: a antecedência do lembrete que chegou (mensagens.lembrete_antes), não a marcada agora no cartão. null: não é lembrete. */
  antecedencia: Lembrete | null;
}
/** Mensagem da caixa de cada pessoa: a menção com @ (20261108165559_mensagens.sql), o aviso de prazo (20261109085738_avisos_de_prazo.sql) e o lembrete (lembretes_dos_prazos, #286). */
export interface Mensagem {
  id: string;
  tipo: TipoMensagem;
  criado_em: string;
  lido_em: string | null;
  /** Na menção. null: a pessoa não vê mais o cartão em que foi marcada. */
  comentario: ComentarioDaMensagem | null;
  /** No aviso de prazo. null: a pessoa não vê mais o cartão do prazo. */
  prazo: PrazoDaMensagem | null;
  /** No pedido para participar e na resposta a ele (#363). */
  pedido: PedidoDaMensagem | null;
  /** No aviso de quem entrou num item (#377). */
  inclusao: InclusaoDaMensagem | null;
  /** Na mensagem de quem entrou num grupo da equipe (#378). Ausente nas outras. */
  grupo?: GrupoDaMensagem | null;
  /** No aviso da demanda que nasceu de um compromisso que se repete (#307). Ausente nas outras. */
  demandaDoCompromisso?: DemandaDoCompromissoDaMensagem | null;
  /** No aviso da tarefa ao solicitante e a quem executa (#415). Ausente nas outras. */
  avisoDaTarefa?: AvisoDaTarefaDaMensagem | null;
}
/**
 * Qual aviso da tarefa (#415; mensagens_da_tarefa.aviso no banco): a pessoa foi posta como solicitante; a tarefa que ela pediu chegou
 * à coluna de aprovação; a tarefa que ela executa foi devolvida, com um comentário.
 */
export type AvisoDaTarefa = 'solicitante' | 'aprovacao' | 'devolvida';
/**
 * O aviso da tarefa (#415, tabela mensagens_da_tarefa). `tarefa`: null quando a pessoa não a vê mais (a caixa só diz isso).
 * `comentario`: na devolvida, o comentário da devolução (null se foi apagado ou nas outras).
 */
export interface AvisoDaTarefaDaMensagem {
  aviso: AvisoDaTarefa;
  /** Quem pôs, quem enviou para a aprovação, quem devolveu; null se não existe mais. */
  feito_por: string | null;
  tarefa: { id: string; codigo: string; titulo: string } | null;
  comentario: { id: string; texto: string } | null;
}
/** Qual aviso da demanda que nasce do compromisso (#307; mensagens_de_compromisso.aviso no banco): nasceu, a data mudou, foi cancelado. */
export type AvisoDaDemandaDoCompromisso = 'demanda_nova' | 'data_mudou' | 'cancelado';
/**
 * O aviso ao responsável da demanda que nasceu de uma data do compromisso que se repete (#307, tabela mensagens_de_compromisso).
 * `demanda`: null quando a pessoa não a vê mais (a caixa só diz isso). As datas: a de antes (no data_mudou) e a do compromisso.
 */
export interface DemandaDoCompromissoDaMensagem {
  aviso: AvisoDaDemandaDoCompromisso;
  demanda: { id: string; codigo: string; titulo: string } | null;
  compromisso_id: string | null;
  data_antes: string | null;
  data_nova: string | null;
}
/**
 * A mensagem de quem foi posto num grupo da equipe (#378, tabela mensagens_de_grupo): uma só, a do grupo, e não uma por item (a
 * pessoa passa a participar de todos os itens dele). Entrar de novo renova a mensagem.
 */
export interface GrupoDaMensagem {
  grupo_id: string;
  nome: string;
  /** Quem pôs a pessoa no grupo; null se não existe mais. */
  incluido_por: string | null;
}

/** A caixa de mensagens: cada pessoa só lê e marca as suas. */
export interface DadosMensagens {
  /** As mensagens de quem está logado, da mais nova para a mais antiga. */
  mensagensListar(): Promise<Mensagem[]>;
  mensagensNaoLidas(): Promise<number>;
  mensagemMarcarLida(id: string): Promise<void>;
  mensagensMarcarTodasLidas(): Promise<void>;
}

// ---------- compromissos (agenda) ----------
export type TipoCompromisso = 'audiencia' | 'pericia' | 'reuniao' | 'atendimento' | 'outro';
export type ModalidadeCompromisso = 'presencial' | 'virtual';
/** O que o compromisso traz do processo ligado: para mostrá-lo e saber quem o vê (quem vê o processo vê o compromisso). */
export type ProcessoDoCompromisso = Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome' | 'criado_por' | 'responsavel_id' | 'colaboradores' | 'grupos'>;
/**
 * Compromisso da agenda. A data e a hora são as do relógio de Brasília, sem conversão de fuso. O código (curto e aleatório)
 * é dado pelo banco. Quem não é administrador vê o que criou, em que foi colocado, o que é de um processo que vê e a Agenda geral.
 */
export interface Compromisso {
  id: string;
  codigo: string;
  tipo: TipoCompromisso;
  titulo: string | null;
  data: string;                    // aaaa-mm-dd
  hora: string | null;             // hh:mm:ss, como o banco devolve
  hora_fim: string | null;
  modalidade: ModalidadeCompromisso | null;
  local: string | null;
  resultado: string | null;
  observacoes: string | null;
  /** Agenda geral: todos do escritório veem; mudar, só quem já podia. */
  geral: boolean;
  responsavel_id: string;
  participantes: string[];         // perfis da equipe, sem o responsável
  /** Os grupos da equipe postos no item (#378): quem está num deles participa, como quem é posto um a um. Ausente: nenhum. */
  grupos?: string[];
  /** Os nomes das pessoas juntos ("A; B"), como a tabela, o quadro, a busca e a ordem por nome usam. */
  pessoa_nome: string;
  processo_id: string | null;
  /** A sala do escritório em que o compromisso acontece (#308). Ausente ou null: nenhuma. A sala desativada continua aqui, com o nome. */
  sala_id?: string | null;
  /** O código e o número do processo, que aparecem mesmo para quem não pode abri-lo. */
  processo_codigo: string | null;
  processo_numero: string | null;
  etapa_id: string | null;
  etapa_ordem: number | null;
  arquivado_em: string | null;
  arquivado_por: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_por: string | null;
  atualizado_em: string;
  pessoas: PessoaResumida[];
  /** O processo, se quem vê o compromisso também pode abri-lo; senão null (e fica só o código e o número). */
  processo: ProcessoDoCompromisso | null;
  /** A série do compromisso que se repete (#307): cada data é um compromisso, ligado a ela. Ausente ou null: não se repete. */
  repeticao_id?: string | null;
  /** A data que a regra da série deu a este compromisso (a data dele pode ter sido mudada depois, só nele). */
  repeticao_data?: string | null;
  /** A regra da série, para o cartão mostrar como se repete. */
  repeticao?: RepeticaoCompromisso | null;
  /** A demanda que nasceu desta data (#307, parte B); ausente ou null: nenhuma (ou foi excluída). */
  demanda_gerada_id?: string | null;
  /** Marcaram "Criar link do Google Meet" (#437): a conta Google do escritório cria a reunião e convida a equipe e as pessoas ligadas. Ausente: não. */
  reuniao_google?: boolean;
  /** A reunião já criada no Google (o link e a gravação), ou null: ainda não (ou sem a opção). */
  reuniao?: ReuniaoDoCompromisso | null;
}
/**
 * A reunião do Google Meet do compromisso (#437; public.agenda_google_reunioes): o link (null enquanto o Google o cria) e a
 * gravação e a transcrição automáticas: ligadas, recusadas pelo Google (quem grava é a conta do escritório) ou ainda não vistas.
 */
export interface ReuniaoDoCompromisso { link: string | null; gravacao: 'ligada' | 'recusada' | null }
/** Como o compromisso se repete (#307): por semana, mês ou ano. */
export type FrequenciaRepeticao = 'semana' | 'mes' | 'ano';
/**
 * O que a pessoa escolhe no cadastro: a cada `intervalo` semanas, meses ou anos; até uma data (`ate`), por um número de vezes
 * (`vezes`, contando a primeira) ou sem fim (os dois null).
 */
export interface RegraDeRepeticao { frequencia: FrequenciaRepeticao; intervalo: number; ate: string | null; vezes: number | null }
/** A série de um compromisso que se repete: a regra e a primeira data (`inicio`), de onde todas as datas são contadas. */
export interface RepeticaoCompromisso extends RegraDeRepeticao {
  id: string;
  inicio: string;
  /** Quantos dias corridos antes de cada data nasce uma demanda para o trabalho daquela vez (#307, parte B). Ausente ou null: não gera. */
  demanda_dias_antes?: number | null;
}
/** O resultado de repetir: os compromissos criados (as datas seguintes) e as datas em que a sala estava ocupada (elas ficaram sem sala). */
export interface RepeticaoCriada { ids: string[]; semSala: string[] }
/** Campos que o cadastro de compromisso grava. */
export type DadosCompromisso = Partial<{ pessoas: string[] } & Pick<Compromisso, 'titulo' | 'data' | 'hora' | 'hora_fim' | 'modalidade' | 'local' | 'resultado' | 'observacoes' | 'geral'
  | 'responsavel_id' | 'participantes' | 'grupos' | 'processo_id' | 'sala_id' | 'etapa_id' | 'etapa_ordem' | 'tipo' | 'arquivado_em' | 'arquivado_por' | 'reuniao_google'>>;
/**
 * Os campos que o lápis muda "nesta e nas seguintes" do compromisso que se repete (#417): o título, o local, a equipe e as pessoas.
 * Ausente: não muda. A lista fica em CAMPOS_DAS_SEGUINTES (regras/repeticao.ts), a mesma que o banco aceita.
 */
export type CamposDasSeguintes = Pick<DadosCompromisso, 'titulo' | 'local' | 'responsavel_id' | 'participantes' | 'pessoas'>;
/** Linha das listagens de compromissos (tabela, quadro e agenda). */
export type CompromissoLista = Pick<Compromisso, 'id' | 'codigo' | 'tipo' | 'titulo' | 'data' | 'hora' | 'hora_fim' | 'modalidade' | 'local' | 'geral' | 'responsavel_id' | 'participantes' | 'grupos'
  | 'pessoa_nome' | 'processo_id' | 'processo_codigo' | 'processo_numero' | 'sala_id' | 'repeticao_id' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em'> & ComEtiquetas;
/** A ordem da tabela de compromissos: as de sempre e a data do compromisso. No quadro, cada coluna tem a sua (Ordem). */
export type OrdemCompromisso = Ordem | 'data' | 'data_desc';
export interface FiltroCompromissos {
  termo?: string;
  /** Um usuário da equipe: os compromissos em que ele é o responsável ou um participante. */
  pessoa?: string;
  tipo?: TipoCompromisso | '';
  /** Só os compromissos desta sala (#308). */
  sala?: string;
  etiqueta?: string;
  situacao?: 'ativos' | 'arquivados';
  /** O quadro e a tabela (#307): de cada compromisso que se repete, só a próxima data em aberto (regras/repeticao.ts, vezNaLista). */
  soAProxima?: boolean;
  ordem?: OrdemCompromisso;
  pagina?: number;
  porPagina?: number;
}
/** Papel de uma pessoa num compromisso (responsável e participantes são da equipe, pela pessoa ligada ao usuário). */
export type PapelNoCompromisso = 'pessoa' | 'responsavel' | 'participante';
/** Compromisso como aparece em outro cartão (da pessoa ou do processo), com o papel da pessoa nele. */
export interface CompromissoLigado extends Pick<Compromisso, 'id' | 'codigo' | 'tipo' | 'titulo' | 'data' | 'hora' | 'hora_fim' | 'pessoa_nome' | 'processo_numero' | 'etapa_id' | 'arquivado_em' | 'atualizado_em'> { papeis: PapelNoCompromisso[] }
/** Os módulos a que um compromisso se liga, de muitos para muitos, além das pessoas e do processo (#306). */
export type ModuloDoCompromisso = Extract<Modulo, 'tarefas' | 'demandas' | 'contratos'>;
/** Um item ligado ao compromisso, como aparece no cartão dele (o mesmo formato dos itens da anotação). */
export type ItemDoCompromisso = Omit<ItemDaAnotacao, 'modulo' | 'tipo'> & { modulo: ModuloDoCompromisso };
/** O prazo de uma demanda ou de uma tarefa, como aparece na agenda (só para consultar; abre o cartão de origem). */
export interface PrazoNaAgenda {
  origem: 'demandas' | 'tarefas'; id: string; codigo: string; titulo: string; prazo: string; responsavel_id: string;
  /** A hora do prazo (hh:mm ou hh:mm:ss), ou null: vale o dia. */
  hora: string | null;
}
/** Processo como o cadastro de compromisso oferece para ligar. */
export type ProcessoParaLigar = Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome'>;
/** Compromissos (supabase/migrations/20261102141258_compromissos.sql). */
export interface DadosCompromissos {
  compromissosListar(f?: FiltroCompromissos): Promise<Pagina<CompromissoLista>>;
  compromissosDaEtapa(etapaId: string | null, f?: FiltroCompromissos, deslocamento?: number, limite?: number): Promise<Pagina<CompromissoLista>>;
  /** Os ativos de um período (o primeiro e o último dia entram), por data e hora. */
  compromissosDoPeriodo(de: string, ate: string, f?: FiltroCompromissos): Promise<CompromissoLista[]>;
  compromissoObter(id: string): Promise<Compromisso | null>;
  compromissoCriar(dados: DadosCompromisso & Pick<Compromisso, 'tipo' | 'data' | 'responsavel_id'>): Promise<{ id: string; codigo: string }>;
  compromissoAtualizar(id: string, dados: DadosCompromisso): Promise<{ id: string; codigo: string }>;
  compromissosArquivar(ids: string[], arquivar?: boolean): Promise<number>;
  /** Só compromissos arquivados são excluídos (por quem criou ou um administrador). */
  compromissosExcluir(ids: string[]): Promise<Exclusao>;
  compromissoMover(id: string, etapaId: string | null, ordem: number | null): Promise<void>;
  compromissoHistorico(id: string): Promise<Historico[]>;
  /** Compromissos em que a pessoa está ligada; com perfilId (a pessoa é da equipe), também os em que é responsável ou participante. */
  compromissosDaPessoa(pessoaId: string, perfilId?: string | null): Promise<CompromissoLigado[]>;
  compromissosDoProcesso(processoId: string): Promise<CompromissoLigado[]>;
  /** Os compromissos ligados a uma tarefa, a uma demanda ou a um contrato (#306), que quem lê vê. */
  compromissosDoItem(modulo: ModuloDoCompromisso, itemId: string): Promise<CompromissoLigado[]>;
  /** Os itens ligados ao compromisso: os que quem lê vê, e quantos ele não vê. */
  compromissoItens(id: string): Promise<{ visiveis: ItemDoCompromisso[]; ocultos: number }>;
  /** Liga o compromisso a um item (quem muda o compromisso ativo e vê o item); o item já ligado não muda nada e devolve false. */
  compromissoLigar(id: string, modulo: ModuloDoCompromisso, itemId: string): Promise<boolean>;
  compromissoDesligar(id: string, modulo: ModuloDoCompromisso, itemId: string): Promise<void>;
  /**
   * Faz o compromisso se repetir (#307; quem o muda, e não audiência nem perícia): cria a série e as datas seguintes até o horizonte
   * (REPETICAO.horizonteMeses, e sempre a próxima). Cada data copia o compromisso (pessoas, equipe, processo, sala, ligações e
   * etiquetas), na coluna de início do quadro; a sala ocupada numa das datas fica de fora só nela.
   */
  compromissoRepetir(id: string, regra: RegraDeRepeticao): Promise<RepeticaoCriada>;
  /**
   * Muda a data e o horário deste compromisso e dos seguintes da série ainda em aberto (os realizados, cancelados e arquivados não
   * mudam). Mudar a data recomeça a série dali: as seguintes passam a ser contadas da data nova. Devolve quantos mudaram.
   */
  compromissoMudarSeguintes(id: string, quando: Pick<Compromisso, 'data' | 'hora' | 'hora_fim'>): Promise<number>;
  /**
   * Passa os campos dados (o título, o local, a equipe e as pessoas, #417) às datas seguintes da série ainda em aberto, quando quem
   * chama muda todas elas; esta data não muda (a tela já a gravou). Devolve quantas datas seguintes mudaram.
   */
  compromissoMudarCamposSeguintes(id: string, campos: CamposDasSeguintes): Promise<number>;
  /** Arquiva este compromisso e os seguintes da série ainda em aberto, e a série para de se repetir. Devolve quantos foram arquivados. */
  compromissoArquivarSeguintes(id: string): Promise<number>;
  /**
   * Marca a repetição do compromisso para gerar uma demanda `dias` corridos antes de cada data (null: não gera mais; #307, parte B),
   * recuando ao dia útil anterior quando o dia cai num fim de semana ou num feriado do Calendário. Quem muda o compromisso, com o módulo
   * Demandas ligado. Devolve as demandas que já nasceram (as das datas que já estão no prazo); as outras nascem na rotina diária.
   */
  compromissoGerarDemandas(id: string, dias: number | null): Promise<string[]>;
  /** Os prazos de demandas e tarefas ativas e não concluídas num período (o primeiro e o último dia entram). */
  prazosDoPeriodo(de: string, ate: string, f?: Pick<FiltroCompromissos, 'termo' | 'pessoa'>): Promise<PrazoNaAgenda[]>;
  /** Os ativos mais recentes que combinam com o texto (número, nome, cliente, código): a busca é no banco, para achar também os antigos. */
  processosParaLigar(termo?: string): Promise<ProcessoParaLigar[]>;
}

// ---------- salas do escritório (#308) ----------
/**
 * Sala do escritório, para marcar compromissos nela. Só administradores cadastram, mudam e desativam; todos veem. Sala não se
 * exclui: desativada, ela some das opções novas, e os compromissos antigos continuam mostrando o nome dela.
 */
export interface Sala {
  id: string;
  nome: string;
  /** Quantas pessoas cabem. */
  capacidade: number;
  ativa: boolean;
  criado_em: string;
}
/** O que o cadastro de sala grava. */
export type DadosSala = Pick<Sala, 'nome' | 'capacidade'>;
/** Um compromisso que ocupa a sala num dia. Sem título (null): quem lê não vê esse compromisso, e fica só o código e o horário. */
export interface OcupacaoDaSala { id: string; codigo: string; tipo: TipoCompromisso; hora: string | null; hora_fim: string | null; titulo: string | null }
/** Uma função dos participantes da tarefa (#313): a lista é de cada escritório, nas Configurações. */
export interface FuncaoNaTarefa {
  id: string;
  nome: string;
  /** Quem tem esta função recebeu a tarefa para fazer ("Delegadas a mim"). */
  executa: boolean;
  /** A posição na lista (a da criação, dada pelo banco). */
  ordem: number;
}
/** O que o cadastro de função grava. */
export type DadosFuncaoNaTarefa = Pick<FuncaoNaTarefa, 'nome' | 'executa'>;
/** As funções dos participantes (supabase/migrations/20261122232702_tarefa_solicitante_e_funcoes.sql). Só administradores mudam a lista. */
export interface DadosFuncoesNaTarefa {
  /** As funções do escritório, na ordem da lista. */
  funcoesNaTarefaListar(): Promise<FuncaoNaTarefa[]>;
  funcaoNaTarefaCriar(dados: DadosFuncaoNaTarefa): Promise<FuncaoNaTarefa>;
  funcaoNaTarefaAtualizar(id: string, dados: Partial<DadosFuncaoNaTarefa>): Promise<void>;
  /** A função em uso numa tarefa é recusada: troca-se antes a função dessas pessoas. */
  funcaoNaTarefaExcluir(id: string): Promise<void>;
}
/** Salas (supabase/migrations/20261122132438_salas_do_escritorio.sql). */
export interface DadosSalas {
  /** Todas as salas do escritório, ativas e desativadas, por nome. */
  salasListar(): Promise<Sala[]>;
  salaCriar(dados: DadosSala): Promise<Sala>;
  /** Muda o nome e a capacidade, ou desativa e reativa (só administradores). */
  salaAtualizar(id: string, dados: Partial<DadosSala & Pick<Sala, 'ativa'>>): Promise<void>;
  /** Os compromissos ativos (não cancelados) que ocupam a sala no dia, fora um (o que está sendo mudado), pela hora. */
  salaOcupacao(salaId: string, data: string, fora?: string | null): Promise<OcupacaoDaSala[]>;
}

// ---------- anotações (módulo Documentos, #303) ----------
/** Os módulos a que uma anotação se liga (#303). */
export type ModuloDaAnotacao = Extract<Modulo, 'pessoas' | 'processos' | 'contratos' | 'demandas' | 'tarefas' | 'compromissos'>;
/**
 * Anotação em Markdown, ligada a quantos itens se queira (até ITENS_DA_ANOTACAO). Quem não é administrador vê a que criou,
 * de que é responsável ou participante e a ligada a um processo, contrato, demanda, tarefa ou compromisso que vê (a ligação
 * a uma pessoa não abre). O código (curto e aleatório) é dado pelo banco.
 */
export interface Anotacao {
  id: string;
  codigo: string;
  titulo: string;
  texto: string;
  responsavel_id: string;
  participantes: string[];         // perfis da equipe, sem o responsável
  /** Os grupos da equipe postos no item (#378): quem está num deles participa, como quem é posto um a um. Ausente: nenhum. */
  grupos?: string[];
  /** Os módulos dos itens ligados (o banco mantém). */
  ligada_a: ModuloDaAnotacao[];
  /** A pasta em que está (#342); null: fora de qualquer pasta. */
  pasta_id: string | null;
  arquivado_em: string | null;
  arquivado_por: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_por: string | null;
  atualizado_em: string;
}
/** Campos que o cadastro de anotação grava. */
export type DadosAnotacao = Partial<Pick<Anotacao, 'titulo' | 'texto' | 'responsavel_id' | 'participantes' | 'grupos' | 'pasta_id'>>;
/** Linha da tabela de anotações, com as etiquetas dela. */
export type AnotacaoLista = Pick<Anotacao, 'id' | 'codigo' | 'titulo' | 'responsavel_id' | 'participantes' | 'grupos' | 'ligada_a' | 'pasta_id' | 'criado_por' | 'criado_em' | 'atualizado_em' | 'arquivado_em'> & ComEtiquetas;
/** Anotação como aparece no cartão de um item ligado a ela (sem o texto: é a leitura do número, ao abrir o cartão). */
export type AnotacaoLigada = Pick<Anotacao, 'id' | 'codigo' | 'titulo' | 'criado_por' | 'criado_em' | 'atualizado_em' | 'arquivado_em'>;
/** A anotação ligada com o texto, de que a seção "Anotações" aberta, na coluna do cartão, mostra o começo (#360). */
export type AnotacaoLigadaComTexto = AnotacaoLigada & Pick<Anotacao, 'texto'>;
/** Um item ligado a uma anotação, como aparece no cartão dela. */
export interface ItemDaAnotacao {
  modulo: ModuloDaAnotacao; id: string; codigo: string; nome: string; arquivado_em: string | null;
  /** Só nos processos: o tipo, que decide a página do cartão (enderecoDoItem, em regras/anotacao.ts). */
  tipo?: TipoProcesso;
}
/** Um item a que a anotação se liga: o módulo dele e o id. */
export type ItemParaLigar = Pick<ItemDaAnotacao, 'modulo' | 'id'>;
/**
 * Anotação que se pode ligar a um item, no cartão dele (#341): com quantos itens ela já está ligada (a cheia, com
 * ITENS_DA_ANOTACAO, não aceita mais; veja motivoDeNaoLigarAAnotacao, em regras/anotacao.ts).
 */
export type AnotacaoParaLigar = Pick<Anotacao, 'id' | 'codigo' | 'titulo' | 'atualizado_em'> & { itens: number };
export interface FiltroAnotacoes {
  termo?: string;
  /** Só as ligadas a algum item deste módulo; 'nenhum': as que não estão ligadas a nada. */
  ligadaA?: ModuloDaAnotacao | 'nenhum';
  /** Quem criou. */
  autor?: string;
  /** Criadas a partir deste dia (AAAA-MM-DD). */
  desde?: string;
  /** Só as que estão nestas pastas: a escolhida e as subpastas dela (pastasDescendentes, em regras/pastas.ts). */
  pastas?: string[];
  /** Só as que têm esta etiqueta. */
  etiqueta?: string;
  situacao?: 'ativas' | 'arquivadas';
  ordem?: Ordem;
  pagina?: number;
  porPagina?: number;
}
/** Anotações (supabase/migrations/…_anotacoes.sql). */
export interface DadosAnotacoes {
  anotacoesListar(f?: FiltroAnotacoes): Promise<Pagina<AnotacaoLista>>;
  anotacaoObter(id: string): Promise<Anotacao | null>;
  /**
   * "ligarA": o item, ou os itens na ordem em que foram escolhidos, a que a anotação já nasce ligada: o do cartão em que ela
   * nasceu e os escolhidos antes de salvar (#339). Item repetido conta uma vez. "etiquetas": as etiquetas do escritório com que
   * ela já nasce (#342). Se uma ligação ou uma etiqueta falhar, nada fica gravado.
   */
  anotacaoCriar(dados: DadosAnotacao & Pick<Anotacao, 'titulo' | 'responsavel_id'>, ligarA?: ItemParaLigar | ItemParaLigar[], etiquetas?: string[]): Promise<{ id: string; codigo: string }>;
  /**
   * Duplica a anotação (#343): cria a cópia com estes dados (o que ela leva vem de dadosDaCopia, em regras/anotacao.ts) e liga a
   * ela os itens da original que quem duplica vê, na mesma ordem; os que não vê ficam de fora. Leva também as etiquetas da
   * original (#342; a pasta vem em dadosDaCopia). A cópia tem código e histórico próprios, e a original não muda. Se uma
   * ligação ou uma etiqueta falhar, a cópia é excluída e nada fica gravado.
   */
  anotacaoDuplicar(id: string, dados: DadosAnotacao & Pick<Anotacao, 'titulo' | 'responsavel_id'>): Promise<{ id: string; codigo: string }>;
  anotacaoAtualizar(id: string, dados: DadosAnotacao): Promise<{ id: string; codigo: string }>;
  /**
   * Grava o texto da anotação só se ela ainda está como foi lida (trava otimista do texto que salva sozinho): `esperado` é o
   * atualizado_em da leitura. Devolve o atualizado_em novo, ou null se a anotação mudou depois dessa leitura (nada é gravado:
   * quem chama lê de novo e decide). Quem não altera, ou não vê, a anotação recebe o erro de permissão.
   */
  anotacaoGravarTexto(id: string, texto: string, esperado: string): Promise<string | null>;
  anotacoesArquivar(ids: string[], arquivar?: boolean): Promise<number>;
  /** Só anotações arquivadas são excluídas (por quem criou ou um administrador). */
  anotacoesExcluir(ids: string[]): Promise<Exclusao>;
  anotacaoHistorico(id: string): Promise<Historico[]>;
  /**
   * Devolve true quando a ligação é nova. Ligar de novo o mesmo item não faz nada e devolve false (ex.: outra pessoa ligou
   * enquanto a busca estava aberta): a tela então não oferece Desfazer, que apagaria a ligação feita por outra pessoa.
   */
  anotacaoLigar(id: string, modulo: ModuloDaAnotacao, itemId: string): Promise<boolean>;
  anotacaoDesligar(id: string, modulo: ModuloDaAnotacao, itemId: string): Promise<void>;
  /** Os itens ligados que quem lê pode abrir, e quantos há que ele não pode. */
  anotacaoItens(id: string): Promise<{ visiveis: ItemDaAnotacao[]; ocultos: number }>;
  /** As anotações ligadas ao item que quem lê pode ver, as atualizadas mais recentemente primeiro. */
  anotacoesDoItem(modulo: ModuloDaAnotacao, itemId: string): Promise<AnotacaoLigada[]>;
  /**
   * As mesmas, na mesma ordem, com o texto, de que a seção "Anotações" aberta mostra o começo (#360). Só se lê com a seção aberta:
   * o texto pode ser longo, e a leitura de cima, a do número com a seção fechada, continua leve.
   */
  anotacoesDoItemComTexto(modulo: ModuloDaAnotacao, itemId: string): Promise<AnotacaoLigadaComTexto[]>;
  /** Itens do módulo para ligar, pela busca, entre os que quem lê pode ver (ativos). */
  itensParaLigar(modulo: ModuloDaAnotacao, termo: string): Promise<ItemDaAnotacao[]>;
  /**
   * O caminho inverso, no cartão do item (#341): as anotações que se podem ligar a ele, pela busca (o código, o título e o
   * texto, como em anotacoesListar). Só as ativas que quem lê pode alterar (as que ligaNaAnotacao, em regras/anotacao.ts,
   * aceita) e que ainda não estão ligadas a este item; as atualizadas mais recentemente primeiro, até ITENS_PARA_LIGAR.
   */
  anotacoesParaLigar(modulo: ModuloDaAnotacao, itemId: string, termo: string): Promise<AnotacaoParaLigar[]>;
}

// ---------- ligar a um cartão um item que já existe (#341, etapa 2) ----------
/** Os módulos das ligações de um só: a tarefa tem uma demanda, um contrato e um processo; a demanda, um contrato; o compromisso, um processo. */
export type LigacaoDeUmSo = 'demandas' | 'contratos' | 'processos';
/**
 * O filtro das buscas para ligar, no cartão de um item, outro que já existe. Todas trazem só itens ativos que quem lê pode alterar
 * (o administrador e, na fase de adaptação, toda a equipe alteram todos; os outros, aqueles em que estão: quem criou, o
 * responsável e a equipe dele), os criados mais recentemente primeiro, até ITENS_PARA_LIGAR.
 */
export interface FiltroParaLigar<Sem extends LigacaoDeUmSo = never> {
  /** O texto digitado (código, título, nomes…), como na busca da lista do módulo. Vazio: os mais recentes. */
  termo?: string;
  /** Só os que ainda não estão ligados a um item deste módulo (ex.: a tarefa sem demanda, a demanda sem contrato). */
  sem?: Sem;
  /** Fora os que já têm esta pessoa na lista (os clientes da demanda e do processo, as pessoas da tarefa e do compromisso). */
  semAPessoa?: string;
  /** Fora estes: os que já estão ligados ao cartão, nas ligações de muitos para muitos. */
  fora?: string[];
}
/** Demanda achada na busca para ligar, com os clientes (no máximo CLIENTES_MAXIMOS) e o contrato que ela já tem. */
export type DemandaParaEscolher = Pick<Demanda, 'id' | 'codigo' | 'titulo' | 'cliente_nome' | 'contrato_id' | 'contrato_codigo' | 'prazo'> & { clientes: string[] };
/** Tarefa achada na busca para ligar, com o que ela já tem ligado. */
export type TarefaParaEscolher = Pick<Tarefa, 'id' | 'codigo' | 'titulo' | 'pessoa_nome' | 'prazo' | 'demanda_id' | 'demanda_codigo' | 'contrato_id' | 'processo_id'> & {
  pessoas: string[];
  /** O contrato da demanda da tarefa, se quem lê vê a demanda (null: sem demanda, a demanda sem contrato, ou que quem lê não vê). */
  contrato_da_demanda: string | null;
};
/** Compromisso achado na busca para ligar, com as pessoas e o processo que ele já tem. */
export type CompromissoParaEscolher = Pick<Compromisso, 'id' | 'codigo' | 'tipo' | 'titulo' | 'data' | 'hora' | 'pessoa_nome' | 'processo_id' | 'processo_numero'> & { pessoas: string[] };
/** Processo achado na busca para pôr uma pessoa como cliente, com os clientes que ele já tem. */
export type ProcessoParaEscolher = ProcessoParaLigar & { clientes: string[] };
/** Contrato achado na busca para ligar. */
export type ContratoParaEscolher = Pick<ContratoLista, 'id' | 'codigo' | 'servico' | 'cliente_nome'>;
export interface DadosParaLigar {
  /** As demandas que quem lê altera (como estaNaDemanda, em regras/demanda.ts); `sem: 'contratos'`: só as sem contrato. */
  demandasParaLigar(f: FiltroParaLigar<'contratos'>): Promise<DemandaParaEscolher[]>;
  /**
   * As tarefas que quem lê altera por estar nelas (quem criou, o responsável e os participantes; quem está só na demanda da tarefa
   * a liga pela demanda). `doProcesso`: só as tarefas deste processo ou sem processo (o prazo liga a tarefa que já o cumpre).
   */
  tarefasParaLigar(f: FiltroParaLigar<LigacaoDeUmSo> & { doProcesso?: string }): Promise<TarefaParaEscolher[]>;
  /** Os compromissos que quem lê muda por estar neles (quem criou, o responsável e os participantes). */
  compromissosParaLigar(f: FiltroParaLigar<'processos'>): Promise<CompromissoParaEscolher[]>;
  /**
   * Os processos que quem lê altera (como alteraOProcesso, em regras/processo.ts), para pôr uma pessoa como cliente. `judicialSemOrigem`:
   * só os judiciais que ainda não têm origem, para ligar ao administrativo (#425; veja judicialParaLigar).
   */
  processosParaPorCliente(f: FiltroParaLigar & { judicialSemOrigem?: boolean }): Promise<ProcessoParaEscolher[]>;
  /** Os contratos que quem lê altera (como alteraOContrato, em regras/contrato.ts; na fase de adaptação, todos). */
  contratosParaLigar(f: FiltroParaLigar): Promise<ContratoParaEscolher[]>;
}

// ---------- pastas dos documentos (#342) ----------
/**
 * Pasta dos documentos, como no Obsidian: pode ficar dentro de outra (pasta_mae_id) e guarda anotações. É do escritório todo:
 * todos veem, criam, renomeiam, movem e apagam (a vazia). Não há duas com o mesmo nome na mesma pasta (maiúsculas e acentos
 * não contam), nem pasta dentro dela mesma ou de uma subpasta dela.
 */
export interface Pasta {
  id: string;
  nome: string;
  /** A pasta em que esta fica; null: no primeiro nível. */
  pasta_mae_id: string | null;
  criada_por: string | null;
  criada_em: string;
}
/** Pastas (supabase/migrations/20261118120000_pastas_e_etiquetas_das_anotacoes.sql). */
export interface DadosPastas {
  /** Todas as pastas do escritório (são poucas: a árvore se monta na tela, com regras/pastas.ts). */
  pastasListar(): Promise<Pasta[]>;
  pastaCriar(nome: string, pastaMaeId: string | null): Promise<Pasta>;
  pastaRenomear(id: string, nome: string): Promise<void>;
  /** Leva a pasta, com o que há nela, para dentro de outra (null: o primeiro nível). Para dentro dela mesma ou de uma subpasta, é recusado. */
  pastaMover(id: string, pastaMaeId: string | null): Promise<void>;
  /** Só a pasta vazia (sem subpastas e sem anotações, mesmo as que quem apaga não vê) é apagada; com conteúdo, a mensagem pede para esvaziá-la. */
  pastaExcluir(id: string): Promise<void>;
}
/** Como a demanda se liga ao processo: deu origem a ele, ou trabalha nele (ligada depois). */
export type PapelDaDemandaNoProcesso = 'originou' | 'atua';
/** A demanda no cartão do processo, com quem a vê: para saber se a tarefa pode herdá-la. */
export type DemandaDoProcesso = DemandaLigada & Pick<Demanda, 'contrato_id' | 'criado_por' | 'responsavel_id' | 'colaboradores'>;
/** O processo como aparece no painel. Os clientes vêm só pelo id. */
export type ProcessoNoPainel = Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome' | 'responsavel_id' | 'colaboradores'> & { clientes: string[] };
export type PrazoNoPainel = Pick<PrazoDeProcesso, 'id' | 'descricao' | 'final' | 'tarefa_id'> & { processo: ProcessoNoPainel };
export type AndamentoNoPainel = Pick<AndamentoDeProcesso, 'id' | 'tipo' | 'categoria' | 'data' | 'hora' | 'local' | 'texto' | 'tratada_em' | 'tarefa_id' | 'criado_em'> & { processo: ProcessoNoPainel };
/** Quantos processos há numa coluna do quadro (etapa_id vazio: fora do quadro). */
export interface FaseNoPainel { tipo: TipoProcesso; etapa_id: string | null; n: number }
/** O painel de Processos. Só traz o que quem está logado pode ver, sem arquivados nem excluídos. Cada lista vem cortada em
 *  ITENS_POR_LISTA; total_* diz quantos há. */
export interface PainelDeProcessos {
  /** Vencidos e a vencer, cada parte cortada à parte, para muitos vencidos não esconderem os de hoje. */
  prazos: PrazoNoPainel[]; total_vencidos: number; total_a_vencer: number;
  marcados: AndamentoNoPainel[]; total_marcados: number;
  intimacoes: AndamentoNoPainel[]; total_intimacoes: number;
  ultimos: AndamentoNoPainel[];
  parados: { processo: ProcessoNoPainel; ultimo: string; dias: number }[]; total_parados: number;
  dias_parado: number;
  fases: FaseNoPainel[];
}
/** O processo nos gráficos do painel (#401): só o que os números e os gráficos contam. */
export type ProcessoNosGraficos = Pick<Processo, 'id' | 'tipo' | 'etapa_id' | 'distribuicao' | 'criado_em' | 'arquivado_em'>;
/**
 * O que os gráficos do painel de Processos contam (#401), dos processos que quem está logado vê (com "pessoa", só os de que ela é
 * a responsável ou uma colaboradora). As datas e os períodos vêm de periodoDosGraficos (regras/graficosDeProcessos.ts).
 */
export interface GraficosDeProcessos {
  /** Os processos, inclusive os arquivados (eles contam nos novos e nos encerrados do período). */
  processos: ProcessoNosGraficos[];
  /** Os prazos em aberto até o fim das próximas semanas (com todos os vencidos), só dos processos não arquivados. */
  prazos: { processo_id: string; final: string }[];
  /** Os andamentos lançados no período, até hoje, sem os excluídos. */
  andamentos: { processo_id: string; data: string }[];
  /** As trocas de coluna no período, pelo histórico do processo: o nome das colunas de onde saiu e para onde foi. */
  mudancas: { processo_id: string; em: string; de: string | null; para: string | null }[];
}
/** Andamentos, prazos e tarefas do cartão do processo (supabase/migrations/20261102125539_andamentos_e_prazos.sql).
 *  Quem vê o processo lê; com ele ativo, também lança, muda e apaga. */
export interface DadosAcompanhamento {
  /** Os mais novos primeiro. */
  processoAndamentos(processoId: string): Promise<AndamentoDeProcesso[]>;
  processoAndamentoCriar(processoId: string, dados: DadosAndamento): Promise<AndamentoDeProcesso>;
  processoAndamentoAtualizar(id: string, dados: MudancaNoAndamento): Promise<AndamentoDeProcesso>;
  /** Excluir só esconde; restaurar devolve como estava (mesmo id, autor, data e ligações). */
  processoAndamentoExcluir(id: string): Promise<void>;
  processoAndamentoRestaurar(id: string): Promise<void>;
  /** Os do último dia mais novo primeiro (a tela põe na ordem dela). */
  processoPrazos(processoId: string): Promise<PrazoDeProcesso[]>;
  processoPrazoCriar(processoId: string, dados: DadosPrazo): Promise<PrazoDeProcesso>;
  processoPrazoAtualizar(id: string, dados: MudancaNoPrazo): Promise<PrazoDeProcesso>;
  processoPrazoExcluir(id: string): Promise<void>;
  processoPrazoRestaurar(id: string): Promise<void>;
  /** Os prazos que a tarefa cumpre (nasceu deles ou foi ligada a eles), nos processos ativos que quem está logado vê, sem os excluídos
   *  (#355: concluir ou reabrir a tarefa pergunta se eles foram cumpridos ou voltam a ficar abertos). */
  prazosDaTarefa(tarefaId: string): Promise<PrazoDeProcesso[]>;
  /** Tarefas ligadas ao processo que quem está logado pode ver. */
  tarefasDoProcesso(processoId: string): Promise<TarefaLigada[]>;
  /** Liga o processo à demanda: "originou" quando ele nasceu dela; "atua" quando foi ligado depois, à mão. Ligar de novo não muda
   *  nada. Só um processo ativo em que a pessoa está, numa demanda em que ela está. Devolve se a ligação é nova (false: já existia,
   *  talvez posta por outra pessoa agora há pouco). */
  processoDemandaLigar(processoId: string, demandaId: string, papel?: PapelDaDemandaNoProcesso): Promise<boolean>;
  /** Quem está na demanda e vê o processo desliga os dois (mesmo com o processo arquivado). */
  processoDemandaDesligar(processoId: string, demandaId: string): Promise<void>;
  /** Liga o processo ao contrato (supabase/migrations/20261111095627_ligar_processo_existente.sql): quem altera o contrato, com um
   *  processo ativo em que está. Ligar de novo não muda nada. Devolve se a ligação é nova (false: já existia). */
  contratoProcessoLigar(contratoId: string, processoId: string): Promise<boolean>;
  /** Quem altera o contrato e vê o processo desliga os dois. */
  contratoProcessoDesligar(contratoId: string, processoId: string): Promise<void>;
  /** Os processos ligados ao contrato que quem está logado pode ver, e quantos há que ele não pode abrir. */
  processosDoContrato(contratoId: string): Promise<{ visiveis: ProcessoLigado[]; ocultos: number }>;
  /** Os contratos ligados ao processo que quem está logado pode ver (sem os valores), e quantos há que ele não pode abrir. */
  contratosDoProcesso(processoId: string): Promise<{ visiveis: ContratoDoProcesso[]; ocultos: number }>;
  /** As demandas ligadas ao processo que quem está logado pode ver. */
  demandasDoProcesso(processoId: string): Promise<DemandaDoProcesso[]>;
  /** Os processos ligados à demanda que quem está logado pode ver, e quantos há que ele não pode abrir. */
  processosDaDemanda(demandaId: string): Promise<{ visiveis: ProcessoLigado[]; ocultos: number }>;
  /** O painel de Processos. meus: só os processos em que a pessoa é responsável ou colaboradora. */
  processosPainel(f: { hoje: string; meus: boolean }): Promise<PainelDeProcessos>;
  /** Os números dos gráficos do painel de Processos (#401). pessoa: só os processos em que ela é responsável ou colaboradora;
   *  null: todos os que quem está logado vê. */
  processosGraficos(f: { hoje: string; pessoa: string | null }): Promise<GraficosDeProcessos>;
  /** Só administradores. */
  processosDiasParadoSalvar(dias: number): Promise<void>;
}

/** Conta do escritório. O saldo inicial é em centavos, e nada é lançado antes da data dele. */
export interface ContaFinanceira { id: string; nome: string; tem_das: boolean; saldo_inicial: number; saldo_inicial_em: string; arquivada_em: string | null }
export type DadosConta = Pick<ContaFinanceira, 'nome' | 'tem_das' | 'saldo_inicial' | 'saldo_inicial_em'>;
export type TipoDeLancamento = 'entrada' | 'saida';
export type CategoriaDeLancamento = 'recebimento' | 'outra_entrada' | 'despesa' | 'das' | 'repasse' | 'indicacao' | 'divisao_lucro' | 'ajuste_a_mais' | 'ajuste_a_menos' | 'correcao_recebimento' | 'transferencia';
/** Uma entrada ou uma saída numa conta, em centavos. par_id: a outra ponta de uma transferência. */
export interface Lancamento {
  id: string; conta_id: string; data: string; tipo: TipoDeLancamento; categoria: CategoriaDeLancamento; valor: number; descricao: string;
  par_id: string | null; criado_por: string | null; criado_em: string; atualizado_em: string;
  /** Nasceu de um recebimento, de um repasse ou de uma divisão de lucro: só muda por lá. */
  origem: 'recebimento' | 'repasse' | 'lucro' | null;
  /** O lançamento importado de uma planilha: as colunas da linha de onde veio, em pares [coluna, valor]. Só leitura. */
  planilha?: [string, string][] | null;
  /** O recebimento que este lançamento corrige (o registro de correção, depois de algum pagamento). */
  corrige_recebimento?: string | null;
}
export type DadosLancamento = Pick<Lancamento, 'conta_id' | 'data' | 'tipo' | 'categoria' | 'valor' | 'descricao'>;
export interface AliquotaDoDas { mes: string; aliquota: number }
/**
 * Um recebimento (também o estornado) ou uma parcela importada como paga que saiu com o contrato excluído, lido da cópia escondida
 * (financeiro_excluidos, #284). Só os administradores do escritório leem, e ninguém muda nem apaga (#413). Valor em centavos.
 * conta_nome: o nome da conta na hora da exclusão (a parcela importada como paga não passou por conta nenhuma).
 */
export interface RecebimentoExcluido {
  id: number; contrato_codigo: string; tipo: 'recebimento' | 'parcela_importada'; parcela_numero: number | null; data: string | null; valor: number;
  conta_nome: string | null; estornado: boolean; excluido_por: string | null; excluido_em: string;
}
/** Uma parcela do contrato, em centavos. Quem vê: um administrador ou o responsável pelo contrato. */
export interface Parcela {
  id: string; contrato_id: string; numero: number; vencimento: string; valor: number;
  recebimento_id: string | null; recebida_em: string | null; recebido: number | null;
}
/** O contrato nos gráficos do Financeiro: o valor contratado e por onde separar (categoria, responsável, ano de assinatura). */
export type ContratoDaCarteira = Pick<Contrato, 'id' | 'codigo' | 'categoria' | 'responsavel_id' | 'assinado_em' | 'valor' | 'descontos' | 'objetos'>;
/** total_parcelas: quantas parcelas o contrato tem (o "10" de "1/10"); null se o contrato não diz. */
export interface ParcelaDoEscritorio extends Parcela { contrato_codigo: string; cliente_nome: string; responsavel_id: string | null; total_parcelas: number | null }
/** papel: em que papel a pessoa entrou quando o cliente pagou. Os recebimentos gravados antes deste campo não o têm. */
export interface TerceiroDoRecebimento { id: string; nome: string; percentual: number; papel?: Exclude<PapelNoValor, 'responsavel'> }
/** O que a tela precisa para mostrar a divisão enquanto se digita. Quem não é administrador vê só o nome das contas. */
export interface ParaReceber {
  parte_na_conta: 20 | 30 | 100;
  contas: Pick<ContaFinanceira, 'id' | 'nome' | 'tem_das'>[];
  /** O DAS que vale na data: o do mês ou o último antes dele (nenhum, se não há). */
  das: AliquotaDoDas[];
  terceiros: TerceiroDoRecebimento[];
  socio_indicador: { id: string; nome: string } | null;
  responsavel_socio: boolean;
}
/** Como o cliente pagou. */
export type FormaDePagamento = 'dinheiro' | 'pix' | 'ted' | 'cartao' | 'doc' | 'boleto' | 'cheque' | 'outra';
/** O que a tela manda ao registrar um recebimento. parte e percentuais: os ajustados só neste recebimento (sem eles, os do contrato). */
export interface DadosDoRecebimento {
  parcela: string; data: string; valor: number; conta: string; taxa: number;
  categoria?: CategoriaHonorario; forma?: FormaDePagamento; bancoRecebido?: string; bancoEnvio?: string;
  parte?: 20 | 30 | 100; percentuais?: { id: string; percentual: number }[];
}
/** O recebimento de um período, para os indicadores: com quem era o responsável quando o cliente pagou. */
export type RecebimentoDoPeriodo = RecebimentoGravado & { responsavel_id: string | null };
/** O recebimento como ficou gravado: mudar o DAS ou a lista de sócios depois não muda nada aqui. */
export interface RecebimentoGravado {
  id: string; parcela_id: string; contrato_id: string; conta_id: string; data: string; valor: number; taxa_maquina: number; aliquota_das: number; parte_na_conta: number; responsavel_socio: boolean;
  na_conta: number; ficou_com_advogado: number; das: number; liquido: number; escritorio: number; responsavel_recebe: number; responsavel_fica: number; escritorio_final: number; contribuicao_socio: number;
  terceiros: (TerceiroDoRecebimento & { valor: number })[];
  socio_indicador: { id: string; nome: string; valor: number } | null;
  /** Do recebimento completo (#266); vazios nos recebimentos de antes. Bancos: o código do Banco Central (3 dígitos). */
  categoria?: CategoriaHonorario | null; forma_pagamento?: FormaDePagamento | null; banco_recebido?: string | null; banco_envio?: string | null;
}
export type TipoDeRepasse = 'responsavel' | 'socio_indicador';
/** O que o escritório deve ao responsável ou ao sócio que indicou. Quem recebe vê os seus; só um administrador paga. */
export interface Repasse {
  id: string; recebimento_id: string; tipo: TipoDeRepasse; nome: string; descricao: string; valor: number; conta_sugerida: string | null; conta_paga: string | null; pago_em: string | null; criado_em: string;
}
export interface Socio { id: string; pessoa_id: string; nome: string; desde: string; ate: string | null }
export type PapelNoValor = 'responsavel' | 'participante' | 'indicador';
export type SituacaoDoValor = 'a_receber' | 'recebido';
/** A parte de quem está logado em um recebimento: no responsável, sem o que ele só passa aos terceiros, que fica em "A passar". */
export interface MeuValor {
  recebimento_id: string; papel: PapelNoValor; contrato_codigo: string; cliente_nome: string; parcela_numero: number; valor: number; situacao: SituacaoDoValor;
  /** recebido_em: quando o cliente pagou. pago_em: quando o valor chegou à pessoa. */
  recebido_em: string; pago_em: string | null;
  /** "escritório", "cliente" (o que já ficou com o responsável) ou o nome do responsável. */
  de_quem: string;
}
/** O que o responsável passa a um participante ou ao indicador que não é sócio, sem passar pelo caixa. */
export interface ValorAPassar {
  recebimento_id: string; pessoa_id: string; nome: string; valor: number; contrato_codigo: string; cliente_nome: string; parcela_numero: number; recebido_em: string; pago_em: string | null;
  /** Quem está com o dinheiro: o nome do responsável gravado no recebimento, mesmo depois de uma troca no contrato, ou "Usuário removido". */
  quem_paga: string;
}
/** O que a página de lucro precisa, sem o que foi estornado ou desfeito. Só administradores. */
export interface MovimentoDoLucro {
  /** Os recebimentos em que o responsável era sócio e tudo foi para a conta da empresa. */
  recebimentos: { data: string; pessoa_id: string; nome: string; liquido: number; terceiros: { valor: number }[] }[];
  /** O que o escritório deve ao sócio que indicou; data: a do recebimento. */
  indicacoes: { data: string; pessoa_id: string; nome: string; valor: number; pago_em: string | null }[];
  retiradas: { id: string; pessoa_id: string; nome: string; conta_id: string; data: string; valor: number; descricao: string }[];
}
export type SituacaoDaConferencia = 'confere' | 'nao_confere';
/** Um lançamento para conferir com o caixa (supabase/migrations/20261104221303_conferencia_de_lancamentos.sql). */
export interface LinhaDaConferencia {
  id: string;
  ano: number;
  responsavel_id: string | null;
  cliente: string;
  servico: string | null;
  referencia: string | null;
  parcela_id: string | null;
  /** O que foi pago. Vazio quando o lançamento só existe no caixa. */
  data_pago: string | null;
  valor_pago: number | null;
  /** A parte do escritório, que deveria entrar no caixa. */
  valor_esperado: number | null;
  /** O que entrou no caixa. Vazio quando o lançamento não está na planilha geral. */
  data_caixa: string | null;
  valor_caixa: number | null;
  conta_caixa: string | null;
  /** O resultado do cruzamento. */
  sugestao: SituacaoDaConferencia;
  motivo: string | null;
  /** O que a pessoa marcou. Vazio é o que falta conferir. */
  situacao: SituacaoDaConferencia | null;
  observacao: string | null;
  marcado_por: string | null;
  marcado_em: string | null;
}
export interface ResumoDaConferencia {
  responsavel_id: string | null;
  ano: number;
  total: number;
  confere: number;
  nao_confere: number;
  falta: number;
  valor_confere: number;
  valor_nao_confere: number;
  valor_falta: number;
}
/** O caixa (supabase/migrations/20261102175057_financeiro_caixa.sql). Só administradores. */
export interface DadosFinanceiro {
  financeiroContas(): Promise<ContaFinanceira[]>;
  financeiroContaCriar(dados: DadosConta): Promise<ContaFinanceira>;
  financeiroContaAtualizar(id: string, dados: Partial<DadosConta & Pick<ContaFinanceira, 'arquivada_em'>>): Promise<void>;
  /** Só a arquivada que nunca teve lançamento (nem excluído) e a que nenhum repasse do caixa usa; senão recusa, explicando por quê (#347). */
  financeiroContaExcluir(id: string): Promise<void>;
  /** As contas arquivadas que têm lançamentos, mesmo excluídos: não podem ser excluídas, e a tela explica em vez de oferecer a lixeira. */
  financeiroArquivadasComLancamentos(): Promise<string[]>;
  /** De um mês, sem os excluídos. */
  financeiroLancamentos(contaId: string, de: string, ate: string): Promise<Lancamento[]>;
  /** Os ajustes de saldo de todas as contas, sem os excluídos, dos mais novos aos mais antigos: é o que se confere na auditoria. */
  financeiroAjustesDeSaldo(): Promise<Lancamento[]>;
  /** O saldo inicial da conta mais tudo o que entrou e saiu antes da data. */
  financeiroSaldoAntes(contaId: string, data: string): Promise<number>;
  financeiroLancamentoCriar(dados: DadosLancamento): Promise<Lancamento>;
  financeiroLancamentoAtualizar(id: string, dados: Partial<DadosLancamento>): Promise<void>;
  /** Excluir só esconde; restaurar devolve como estava. Numa transferência, as duas pontas juntas. */
  financeiroLancamentoExcluir(id: string): Promise<void>;
  financeiroLancamentoRestaurar(id: string): Promise<void>;
  /** Uma saída e uma entrada ligadas. Devolve o id da saída. */
  financeiroTransferir(t: { de: string; para: string; data: string; valor: number; descricao: string }): Promise<string>;
  financeiroHistorico(lancamentoId: string): Promise<Historico[]>;
  financeiroDas(): Promise<AliquotaDoDas[]>;
  /** Lançar de novo o mesmo mês troca o percentual. */
  financeiroDasSalvar(mes: string, aliquota: number): Promise<void>;
  /** As mudanças no saldo inicial, no início das contas, no DAS e nos sócios, das mais novas às mais antigas. */
  financeiroAjustes(): Promise<Historico[]>;
  /** Os recebimentos que saíram com os contratos excluídos, dos excluídos por último aos mais antigos. Quem não é administrador recebe a lista vazia. */
  financeiroExcluidos(): Promise<RecebimentoExcluido[]>;
}

/** Uma despesa do escritório a pagar (#439): uma data de vencimento, com a repetição de que faz parte (null: não se repete). */
export interface DespesaDoEscritorio {
  id: string;
  descricao: string;
  /** Em centavos. */
  valor: number;
  /** aaaa-mm-dd. */
  vencimento: string;
  /** O dia em que foi paga (aaaa-mm-dd); null: a pagar. */
  paga_em: string | null;
  /** A regra da repetição (a que parou termina na véspera do ponto em que parou); null: não se repete. */
  repeticao: RegraDeRepeticao | null;
}
/** O que o cadastro da despesa grava. */
export interface DadosDespesa { descricao: string; valor: number; vencimento: string }

/**
 * As despesas do escritório a pagar (supabase/migrations/20261125104500_despesas_do_escritorio.sql, #439): só os administradores veem
 * e mexem; quem não é administrador recebe a lista vazia e tem as mudanças recusadas.
 */
export interface DadosDespesas {
  /** As que vencem no período (pagas ou não) e as ainda a pagar que venceram antes dele, sem as excluídas, por vencimento. */
  financeiroDespesas(de: string, ate: string): Promise<DespesaDoEscritorio[]>;
  /** Cadastra a despesa e, com a repetição, as datas seguintes até 12 meses adiante (e sempre a próxima). Devolve o id e os das datas que nasceram. */
  financeiroDespesaCriar(dados: DadosDespesa, repeticao: RegraDeRepeticao | null): Promise<{ id: string; ids: string[] }>;
  /** Muda esta data; com `seguintes`, a descrição e o valor vão também às seguintes ainda a pagar. Devolve quantas mudaram. */
  financeiroDespesaMudar(id: string, dados: DadosDespesa, seguintes: boolean): Promise<number>;
  /** Só registra que foi paga, no dia informado (não cria lançamento no caixa). */
  financeiroDespesaPagar(id: string, data: string): Promise<void>;
  financeiroDespesaDesfazerPagamento(id: string): Promise<void>;
  /** Excluir só esconde; com `seguintes`, também as seguintes a pagar, e a repetição para. Devolve os ids excluídos, para restaurar. */
  financeiroDespesaExcluir(id: string, seguintes: boolean): Promise<string[]>;
  /** Devolve as excluídas; a repetição que parou nelas volta a andar. */
  financeiroDespesaRestaurar(ids: string[]): Promise<void>;
  financeiroDespesaHistorico(id: string): Promise<Historico[]>;
}

/** As parcelas, os recebimentos e os repasses (supabase/migrations/20261102192042_financeiro_parcelas.sql). */
export interface DadosParcelas {
  /** Sem as excluídas, na ordem do número. */
  parcelasDoContrato(contratoId: string): Promise<Parcela[]>;
  /** Só para quem cuida do contrato: o histórico do contrato é aberto também a quem o criou e aos participantes. */
  parcelasHistorico(contratoId: string): Promise<Historico[]>;
  /** As dos contratos em que a pessoa é cliente, até PARCELAS_DA_PESSOA, das mais novas às mais antigas. Só as que quem está logado pode ver. As a receber de contrato arquivado não aparecem. */
  parcelasDaPessoa(pessoaId: string): Promise<ParcelaDoEscritorio[]>;
  /** As que vencem no período e as atrasadas até hoje que vieram de antes dele, sem as excluídas. Só as que quem está logado pode ver. As a receber de contrato arquivado não aparecem. */
  parcelasDoPeriodo(de: string, ate: string, hoje: string): Promise<ParcelaDoEscritorio[]>;
  parcelaCriar(contratoId: string, dados: { vencimento: string; valor: number }): Promise<Parcela>;
  parcelaAtualizar(id: string, dados: { vencimento: string; valor: number }): Promise<void>;
  /** Só a parcela importada como paga, pelo responsável ou um administrador. Não passa pelo caixa. */
  parcelaCorrigirImportada(id: string, dados: { vencimento: string; valor: number; recebida_em: string; recebido: number }): Promise<void>;
  /** Excluir só esconde; restaurar devolve como estava. */
  parcelaExcluir(id: string): Promise<void>;
  parcelaRestaurar(id: string): Promise<void>;
  /** Para o contrato assinado antes de ligar o módulo, ou que ficou sem parcelas. Devolve quantas gerou. */
  parcelasGerar(contratoId: string): Promise<number>;
  financeiroParaReceber(parcelaId: string, data: string): Promise<ParaReceber>;
  /** O banco refaz a divisão, cria a entrada no caixa e os repasses. Devolve o id do recebimento. */
  /**
   * Registra o recebimento de uma parcela. Os campos opcionais são do recebimento completo (#266): o tipo deste
   * recebimento, a forma de pagamento, os bancos e os percentuais ajustados só aqui (sem mudar o contrato).
   */
  financeiroReceber(r: DadosDoRecebimento): Promise<string>;
  financeiroRecebimento(id: string): Promise<RecebimentoGravado | null>;
  /** O recebimento (não estornado) que gerou um lançamento do caixa, para mostrar o contrato, a parcela e a divisão. */
  financeiroRecebimentoDoLancamento(lancamentoId: string): Promise<RecebimentoGravado | null>;
  /** Algum valor deste recebimento já foi pago (repasse, participante ou indicador)? Decide se corrige ou lança a correção. */
  financeiroRecebimentoTemPagamento(recebimentoId: string): Promise<boolean>;
  /** Corrige um recebimento sem nada pago: estorna o original (fica no histórico) e registra o novo. Devolve o id do novo. */
  financeiroCorrigirRecebimento(recebimentoId: string, r: Omit<DadosDoRecebimento, 'parcela'> & { motivo: string }): Promise<string>;
  /** Depois de algum pagamento: o registro de correção, uma saída do caixa ligada ao recebimento (só administradores). */
  financeiroLancarCorrecao(c: { recebimento: string; data: string; valor: number; conta: string; motivo: string }): Promise<string>;
  /** Os contratos que o usuário vê (não arquivados), com o que importa para os gráficos: categoria, responsável, ano e valor. */
  financeiroContratosDaCarteira(): Promise<ContratoDaCarteira[]>;
  /** Os recebimentos (não estornados) com data no período, dos contratos que o usuário cuida (o administrador, todos). */
  financeiroRecebimentosDoPeriodo(de: string, ate: string): Promise<RecebimentoDoPeriodo[]>;
  /** Só as linhas de quem está logado, dos recebimentos não estornados com data no período e os valores ainda a receber de antes dele (supabase/migrations/20261104000000_meus_valores.sql). */
  financeiroMeusValores(de: string, ate: string): Promise<MeuValor[]>;
  /** As linhas de um ano. Quem não é administrador recebe só as dele, seja qual for o responsável pedido. */
  conferenciaListar(ano: number, responsavel: string | null): Promise<LinhaDaConferencia[]>;
  /** Por responsável e por ano. Só administradores. */
  conferenciaResumo(): Promise<ResumoDaConferencia[]>;
  conferenciaMarcar(id: string, situacao: SituacaoDaConferencia | null, observacao: string | null): Promise<void>;
  /** Muda também a parcela importada ligada à linha. Nunca muda o caixa. */
  conferenciaCorrigir(id: string, data: string, valor: number): Promise<void>;
  conferenciaHistorico(id: string): Promise<Historico[]>;
  /** Nos recebimentos em que a pessoa era a responsável (um administrador vê os do escritório): os do período e os ainda não pagos de antes dele. Quem é o próprio responsável do recebimento fica de fora. */
  financeiroAPassar(de: string, ate: string): Promise<ValorAPassar[]>;
  /** Só quem recebeu o dinheiro ou um administrador. Não cria lançamento no caixa: o responsável paga direto. */
  financeiroTerceiroMarcarPago(recebimento: string, pessoa: string, data: string): Promise<void>;
  financeiroTerceiroDesfazerPago(recebimento: string, pessoa: string): Promise<void>;
  /** Estornar esconde tudo o que o recebimento criou, e a parcela volta a ser a receber. Repasse pago ou valor marcado como pago precisa ser desfeito antes. */
  financeiroEstornar(id: string): Promise<void>;
  financeiroRestaurarRecebimento(id: string): Promise<void>;
  /** Os a pagar, de qualquer data, e os pagos no período. Quem não é administrador recebe só os seus. */
  financeiroRepasses(de: string, ate: string): Promise<Repasse[]>;
  /** Só administrador. Cria a saída no caixa. */
  financeiroPagarRepasse(id: string, conta: string, data: string): Promise<void>;
  financeiroDesfazerPagamento(id: string): Promise<void>;
  /** Só administrador. */
  financeiroLucro(): Promise<MovimentoDoLucro>;
  /** Só administrador. Cria a saída "Divisão de lucro" no caixa. Descrição em branco: fica o nome do sócio. Devolve o id da retirada. */
  financeiroPagarLucro(r: { pessoa: string; conta: string; data: string; valor: number; descricao: string }): Promise<string>;
  /** Desfazer esconde a retirada e a saída no caixa; restaurar devolve como estava. */
  financeiroDesfazerLucro(id: string): Promise<void>;
  financeiroRestaurarLucro(id: string): Promise<void>;
  /** Só administrador. Sem os excluídos, do mais novo ao mais antigo. */
  financeiroSocios(): Promise<Socio[]>;
  financeiroSocioCriar(dados: { pessoa_id: string; desde: string; ate: string | null }): Promise<Socio>;
  financeiroSocioAtualizar(id: string, dados: { desde: string; ate: string | null }): Promise<void>;
  financeiroSocioExcluir(id: string): Promise<void>;
  financeiroSocioRestaurar(id: string): Promise<void>;
}

// ---------- pedir para participar (#363) ----------
/** Os módulos em que se pede para participar de um item. */
export type ModuloDoPedido = 'tarefas' | 'demandas' | 'processos' | 'compromissos' | 'contratos' | 'anotacoes';
/** O grupo da busca geral em que o item aparece: os processos se dividem pelo tipo (judiciais e administrativos). */
export type GrupoDoPedido = 'tarefas' | 'demandas' | 'judiciais' | 'administrativos' | 'compromissos' | 'contratos' | 'anotacoes';
export type SituacaoDoPedido = 'pendente' | 'aprovado' | 'recusado' | 'cancelado';
/**
 * Um item de que a pessoa não faz parte, achado pelo código exato ou pelo número inteiro do processo: só o tipo e o código.
 * `numero` é o próprio número digitado, quando foi ele que achou o processo. `pedido_id`: o pedido pendente dela, se houver.
 */
export interface ItemParaPedir {
  modulo: ModuloDoPedido;
  grupo: GrupoDoPedido;
  id: string;
  codigo: string;
  numero: string | null;
  pedido_id: string | null;
}
/** O pedido de que a mensagem fala. */
export interface PedidoDaMensagem {
  id: string;
  modulo: ModuloDoPedido;
  item_id: string;
  item_codigo: string;
  /** Quem pediu. */
  pedido_por: string;
  situacao: SituacaoDoPedido;
  respondido_por: string | null;
  /** No processo, o tipo (a página do cartão depende dele); null quando a pessoa não vê o processo. */
  tipo_do_processo: TipoProcesso | null;
}
/** Como a pessoa entrou no item: como responsável ou na equipe (participante; colaborador na demanda e no processo). */
export type EntrouComo = 'responsavel' | 'participante';
/** O item do aviso, como a caixa o mostra: o nome é o título (no contrato, o serviço; no compromisso, o nome dele). */
export interface ItemDaInclusao {
  id: string;
  codigo: string;
  nome: string | null;
  /** No processo, o tipo (a página do cartão depende dele); nos outros módulos, null. */
  tipo_do_processo: TipoProcesso | null;
}
/** O aviso de que alguém pôs a pessoa num item (supabase/migrations/20261119193326_aviso_ao_ser_incluido.sql). */
export interface InclusaoDaMensagem {
  modulo: ModuloDoPedido;
  entrou_como: EntrouComo;
  /** Quem incluiu; null se não existe mais. */
  incluido_por: string | null;
  /**
   * O item, só enquanto a pessoa faz parte dele (é o responsável ou está na equipe). null: ela foi retirada (ou não o vê mais), e a
   * caixa não mostra o título, o código nem quem incluiu, mesmo que ela ainda veja o item por outro caminho (a chave "equipe vê
   * tudo", ser administrador, ter criado o item).
   */
  item: ItemDaInclusao | null;
  /**
   * O grupo da equipe pelo qual a pessoa entrou no item (#378): o nome dele, quando ela não estava no item por conta própria. null ou
   * ausente: entrou por conta própria (ou o grupo foi excluído).
   */
  grupo?: string | null;
}
/** Pedir para participar: as regras ficam no banco (supabase/migrations/20261118220000_pedidos_de_participacao.sql). */
export interface DadosPedidos {
  /** Os itens que a pessoa ainda não vê, pelo código exato ou pelo número inteiro do processo, do escritório dela. */
  itensParaPedir(termo: string): Promise<ItemParaPedir[]>;
  /** Pede para participar; devolve o id do pedido. Um pendente por pessoa e item. */
  participacaoPedir(modulo: ModuloDoPedido, itemId: string): Promise<string>;
  /** Só quem pediu, só o pendente. */
  participacaoCancelar(pedidoId: string): Promise<void>;
  /** Um administrador, o responsável ou quem criou o item; o primeiro que responde resolve. Aprovado, a pessoa entra no item. */
  participacaoResponder(pedidoId: string, aprovar: boolean): Promise<void>;
}

// ---------- grupos da equipe (#378) ----------
/**
 * Só administradores cuidam dos grupos (as regras ficam no banco: supabase/migrations/20261119233811_grupos_da_equipe.sql). Os grupos
 * vêm no contexto (Contexto.grupos); depois de mudar um, a tela relê o contexto. Grupo de outro escritório responde como o que não existe.
 */
export interface DadosGrupos {
  /** Cria o grupo (o nome sem os espaços das pontas, até TAMANHO_GRUPO_DA_EQUIPE letras, único no escritório) e devolve o id. */
  grupoDaEquipeCriar(nome: string): Promise<string>;
  grupoDaEquipeRenomear(id: string, nome: string): Promise<void>;
  /** Põe uma pessoa da equipe ativa no grupo; já estar nele não é erro. Ela recebe a mensagem do grupo (menos quem pôs a si mesmo). */
  grupoDaEquipeIncluir(id: string, perfilId: string): Promise<void>;
  /** Tira a pessoa do grupo; em menos de 1 minuto (AVISO_DESFEITO), a mensagem do grupo ainda não lida some (o desfazer). */
  grupoDaEquipeTirar(id: string, perfilId: string): Promise<void>;
  /** Em quantos itens de cada módulo o grupo está, contando os arquivados; só os módulos com algum. */
  grupoDaEquipeContarItens(id: string): Promise<ItensDoGrupo[]>;
  /** Tira o grupo de todos os itens (também dos arquivados) e o exclui. Não tem desfazer. */
  grupoDaEquipeExcluir(id: string): Promise<void>;
  /** Põe e tira os grupos do contrato: só quem é parte por conta própria (administrador, quem criou, o responsável, a divisão). */
  contratoDefinirGrupos(id: string, grupos: string[]): Promise<void>;
  /**
   * Grava os grupos de um item, nas bolinhas do topo do cartão (no contrato, por contratoDefinirGrupos), sem mexer nos outros campos.
   * Quem não altera o item é recusado; quem deixaria de vê-lo com os grupos novos (o grupo era o único caminho dele até o item)
   * também: as regras de leitura conferem a linha nova (a tela nem oferece isso: quem está só pelo grupo pede a um administrador).
   */
  itemDefinirGrupos(modulo: ModuloDoPedido, id: string, grupos: string[]): Promise<void>;
}

export interface Dados extends DadosGrupos, DadosMensagens, DadosPedidos, DadosFinanceiro, DadosDespesas, DadosParcelas, DadosAcompanhamento, DadosSessao, DadosDuasEtapas, DadosPessoas, DadosSigilo, DadosVinculos, DadosContratos, DadosQuadros, DadosEquipe, DadosComentarios, DadosDemandas, DadosListas, DadosModelos, DadosTarefas, DadosTempo, DadosPerfilProfissional, DadosFotos, DadosLigacoes, DadosImportacao, DadosCalendario, DadosEtiquetas, DadosProcessos, DadosCompromissos, DadosSalas, DadosFuncoesNaTarefa, DadosAnotacoes, DadosPastas, DadosParaLigar {}
