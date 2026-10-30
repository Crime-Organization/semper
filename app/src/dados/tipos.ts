// Formato dos dados trocados entre as telas e a camada de dados (dados/supabase.ts e dados/falso.ts).

export type Papel = 'master' | 'admin' | 'usuario';
/** O que a pessoa faz no escritório. Diferente do papel: administrador é quem gere o sistema; administrativo é uma função. */
export type Funcao = 'advogado' | 'administrativo' | 'estagiario';
export type TipoPessoa = 'pf' | 'pj' | 'contato';
export type Modulo = 'pessoas' | 'contratos' | 'demandas' | 'tarefas' | 'processos' | 'compromissos' | 'anotacoes' | 'financeiro';

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
  cor?: string | null;
  pessoa_id?: string | null;
}

/** Dados da instituição: cada escritório tem os seus, editados pelo administrador em Configurações. */
export interface DadosEscritorio {
  nome: string;
  logo: string | null;          // imagem em data:image/...;base64 (até ~300 KB)
  cnpj: string | null;          // só números
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
  resp: { perfil_id: string }[];
}

/** Campos que a tela de cadastro grava (o resto é do banco). */
export type DadosPessoa = Partial<Omit<Pessoa, 'id' | 'codigo' | 'resp' | 'criado_por' | 'criado_em' | 'atualizado_por' | 'atualizado_em'>>;

/** Linha das listagens (tabela, kanban, início). */
export type PessoaLista = Pick<Pessoa, 'id' | 'codigo' | 'tipo' | 'nome' | 'nome_fantasia' | 'documento' | 'telefones' | 'emails'
  | 'municipio' | 'uf' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em' | 'resp'>;

/** Ordem das listas de qualquer módulo: "manual" é a do quadro (arrastando os cartões); as outras valem para quadro e tabela. */
export type Ordem = 'manual' | 'nome' | 'nome_desc' | 'novos' | 'antigos' | 'recentes';

export interface PessoaResumida { id: string; codigo: string; nome: string; tipo: TipoPessoa; arquivado_em?: string | null }

export interface FiltroPessoas {
  termo?: string;
  tipo?: string;
  responsavel?: string;
  situacao?: 'ativas' | 'arquivadas';
  ordem?: Ordem;
  pagina?: number;
  porPagina?: number;
}

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
export type MarcoColuna = 'assinado' | 'inicio' | 'concluido';
export interface Coluna { id: string; nome: string; ordem: number; criado_por: string | null; oculta: boolean; marco?: MarcoColuna | null }

/** Categoria de honorário do contrato. */
export type CategoriaHonorario = 'pro_labore' | 'quota_litis' | 'sucumbencia' | 'adiantamento_despesas' | 'pro_bono';

/**
 * Contrato: liga um cliente (pessoa) ao advogado responsável (perfil). O número (codigo, ex.: HE62-0163-2026) é dado
 * pelo banco na criação e nunca muda: sigla do responsável na criação (2 letras do nome e 2 dígitos do CPF), número
 * sequencial do escritório e ano de criação. Valores em reais; percentuais de 0 a 100.
 */
export interface Contrato {
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
  assinado_em: string | null;
  primeiro_pagamento: string | null;
  percentual_escritorio: number | null;   // 20, 30 ou 100: quanto do que o cliente paga vai para a conta PJ
  indicador_id: string | null;
  indicador_percentual: number | null;
  documento_url: string | null;   // link do documento assinado (Google Drive)
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
  /** Participantes, na ordem do cadastro, cada um com o seu % (sobre o total). */
  participantes: Participacao[];
  indicador: PessoaResumida | null;
}

/** Papel de uma pessoa num contrato (o responsável é um usuário da equipe, pela pessoa ligada a ele). */
export type PapelNoContrato = 'cliente' | 'responsavel' | 'participante' | 'indicador';
/** Contrato como aparece no cartão de uma pessoa: o que ele é e o que a pessoa é nele. */
export interface ContratoDaPessoa extends Pick<Contrato, 'id' | 'codigo' | 'servico' | 'etapa_id' | 'arquivado_em' | 'criado_em'> {
  papeis: PapelNoContrato[];
}

/** Participante de um contrato, como aparece no cartão. */
export interface Participacao { pessoa: PessoaResumida; percentual: number | null }
/** Participante como o cadastro grava (a lista "participantes" do contrato no banco). */
export interface ParticipanteGravado { pessoa_id: string; percentual: number | null }

/** Campos que o cadastro de contrato grava (número, sigla, ano e carimbos são do banco). */
export type DadosContrato = Partial<{ clientes: string[]; participantes: ParticipanteGravado[] } & Pick<Contrato, 'codigo_antigo' | 'cliente_id' | 'responsavel_id' | 'objetos' | 'servico' | 'categoria' | 'valor'
  | 'entrada' | 'parcelas' | 'descontos' | 'assinado_em' | 'primeiro_pagamento' | 'percentual_escritorio'
  | 'indicador_id' | 'indicador_percentual' | 'documento_url' | 'observacoes' | 'etapa_id' | 'etapa_ordem'
  | 'arquivado_em' | 'arquivado_por'>>;

/** Linha das listagens de contratos (tabela e quadro). */
export type ContratoLista = Pick<Contrato, 'id' | 'codigo' | 'codigo_antigo' | 'servico' | 'categoria' | 'valor' | 'responsavel_id'
  | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em' | 'cliente_nome'>;

export interface FiltroContratos {
  termo?: string;
  responsavel?: string;
  categoria?: string;
  situacao?: 'ativos' | 'arquivados';
  ordem?: Ordem;
  pagina?: number;
  porPagina?: number;
}

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
  responsavel_id: string;          // perfil
  colaboradores: string[];         // perfis da equipe, sem o responsável
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
  contrato: { id: string; codigo: string; servico: string } | null;
}
/** Papel de uma pessoa numa demanda (responsável e colaboradores são da equipe, pela pessoa ligada ao usuário). */
export type PapelNaDemanda = 'cliente' | 'responsavel' | 'colaborador';
/** Demanda como aparece em outro cartão (da pessoa ou do contrato), com o papel da pessoa nela. */
export interface DemandaLigada extends Pick<Demanda, 'id' | 'codigo' | 'titulo' | 'prazo' | 'etapa_id' | 'arquivado_em' | 'criado_em'> {
  papeis: PapelNaDemanda[];
}
/** Campos que o cadastro de demanda grava. */
export type DadosDemanda = Partial<{ clientes: string[] } & Pick<Demanda, 'titulo' | 'descricao' | 'prazo' | 'responsavel_id'
  | 'colaboradores' | 'contrato_id' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'arquivado_por'>>;
/** Linha das listagens de demandas (tabela e quadro). */
export type DemandaLista = Pick<Demanda, 'id' | 'codigo' | 'titulo' | 'prazo' | 'responsavel_id' | 'colaboradores' | 'cliente_nome'
  | 'contrato_codigo' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em'>;
export interface FiltroDemandas {
  termo?: string;
  /** Um usuário da equipe: as demandas em que ele é o responsável ou um colaborador. */
  pessoa?: string;
  situacao?: 'ativas' | 'arquivadas';
  ordem?: Ordem;
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
  responsavel_id: string;          // perfil
  participantes: string[];         // perfis da equipe, sem o responsável
  /** Os nomes das pessoas ligadas juntos ("A; B"), como a tabela, o quadro e a busca usam. */
  pessoa_nome: string;
  demanda_id: string | null;
  /** O código da demanda, que aparece mesmo para quem não pode abrir a demanda. */
  demanda_codigo: string | null;
  contrato_id: string | null;
  /** O número do contrato, que aparece mesmo para quem não pode abrir o contrato. */
  contrato_codigo: string | null;
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
  contrato: { id: string; codigo: string; servico: string } | null;
}
/** O que a tarefa traz da demanda ligada: para mostrá-la e saber quem a vê (quem vê a demanda vê a tarefa). */
export type DemandaDaTarefa = Pick<Demanda, 'id' | 'codigo' | 'titulo' | 'etapa_id' | 'criado_por' | 'responsavel_id' | 'colaboradores'>;
/** Papel de uma pessoa numa tarefa (responsável e participantes são da equipe, pela pessoa ligada ao usuário). */
export type PapelNaTarefa = 'pessoa' | 'responsavel' | 'participante';
/** Tarefa como aparece em outro cartão (da pessoa, da demanda ou do contrato), com o papel da pessoa nela. */
export interface TarefaLigada extends Pick<Tarefa, 'id' | 'codigo' | 'titulo' | 'prazo' | 'etapa_id' | 'arquivado_em' | 'criado_em'> {
  papeis: PapelNaTarefa[];
}
/** Campos que o cadastro de tarefa grava. */
export type DadosTarefa = Partial<{ pessoas: string[] } & Pick<Tarefa, 'titulo' | 'descricao' | 'prazo' | 'responsavel_id'
  | 'participantes' | 'demanda_id' | 'contrato_id' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'arquivado_por'>>;
/** Linha das listagens de tarefas (tabela e quadro). */
export type TarefaLista = Pick<Tarefa, 'id' | 'codigo' | 'titulo' | 'prazo' | 'responsavel_id' | 'participantes' | 'pessoa_nome'
  | 'demanda_codigo' | 'contrato_codigo' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em'>;
export interface FiltroTarefas {
  termo?: string;
  /** Um usuário da equipe: as tarefas em que ele é o responsável ou um participante. */
  pessoa?: string;
  situacao?: 'ativas' | 'arquivadas';
  ordem?: Ordem;
  pagina?: number;
  porPagina?: number;
}

export interface Usuario {
  id: string; nome: string; usuario: string; papel: Papel; funcao: Funcao; ativo: boolean; pessoa_id: string | null; email: string;
  criado_em: string; ultimo_acesso: string | null; confirmado: boolean; cor?: string | null;
}
export interface Convite { id: string; email: string; nome: string; papel: Papel; pessoa_id: string | null; criado_em: string }
/** Convite recém-criado: traz o código do link (o banco guarda só o resumo, então ele só aparece agora). */
export type ConviteCriado = Convite & { codigo?: string };
export interface RegistroAuditoria {
  id: string | number; tabela: string; registro_id: string | null; acao: string;
  resumo: { nome?: string; email?: string; codigo?: string; descricao?: string; quantidade?: number } | null; feito_por: string | null; em: string;
}

export interface Exclusao { excluidas: number; naoExcluidas: number; motivo: string }

/** Verificação em duas etapas (aplicativo autenticador no celular). */
export interface FatorDuasEtapas { id: string; ativo: boolean; criado_em: string }
/** Início da ativação: o QR code (imagem) e a chave para digitar no aplicativo. */
export interface CadastroDuasEtapas { id: string; qr: string; segredo: string }

/** Tipos de link enviados por e-mail (parâmetro "type" do link). */
export type TipoLink = 'email' | 'recovery' | 'email_change';

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
  /** Link dos e-mails (confirmação, nova senha, troca de e-mail): troca o código de uso único pela sessão. */
  confirmarLink(codigo: string, tipo: TipoLink): Promise<void>;
  novaSenha(senha: string): Promise<void>;
  sair(): Promise<void>;
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
  contratoCriar(dados: DadosContrato): Promise<{ id: string; codigo: string }>;
  contratoAtualizar(id: string, dados: DadosContrato): Promise<{ id: string; codigo: string }>;
  contratosArquivar(ids: string[], arquivar?: boolean): Promise<number>;
  /** Só contratos arquivados são excluídos (por quem criou ou um administrador). */
  contratosExcluir(ids: string[]): Promise<Exclusao>;
  contratoMover(id: string, etapaId: string | null, ordem: number | null): Promise<void>;
  contratoHistorico(id: string): Promise<Historico[]>;
  /** Objetos já usados em contratos do escritório, em ordem alfabética, para sugerir no cadastro. */
  objetosSugeridos(): Promise<string[]>;
  /** Contratos em que a pessoa é cliente, participante ou indicadora; com perfilId (a pessoa é da equipe), também os em que é a responsável. */
  contratosDaPessoa(pessoaId: string, perfilId?: string | null): Promise<ContratoDaPessoa[]>;
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
}

/** Tarefas. Na ordem "nome", a lista vai pelo título. */
export interface DadosTarefas {
  tarefasListar(f?: FiltroTarefas): Promise<Pagina<TarefaLista>>;
  tarefasDaEtapa(etapaId: string | null, f?: FiltroTarefas, deslocamento?: number, limite?: number): Promise<Pagina<TarefaLista>>;
  tarefaObter(id: string): Promise<Tarefa | null>;
  tarefaCriar(dados: DadosTarefa): Promise<{ id: string; codigo: string }>;
  tarefaAtualizar(id: string, dados: DadosTarefa): Promise<{ id: string; codigo: string }>;
  tarefasArquivar(ids: string[], arquivar?: boolean): Promise<number>;
  /** Só tarefas arquivadas são excluídas (por quem criou ou um administrador). */
  tarefasExcluir(ids: string[]): Promise<Exclusao>;
  tarefaMover(id: string, etapaId: string | null, ordem: number | null): Promise<void>;
  tarefaHistorico(id: string): Promise<Historico[]>;
  /** Tarefas em que a pessoa está ligada; com perfilId (a pessoa é da equipe), também as em que é responsável ou participante. */
  tarefasDaPessoa(pessoaId: string, perfilId?: string | null): Promise<TarefaLigada[]>;
  /** Tarefas da demanda, na ordem do quadro (quem vê a demanda vê todas elas). */
  tarefasDaDemanda(demandaId: string): Promise<TarefaLigada[]>;
  /** Tarefas ligadas ao contrato que quem está logado pode ver. */
  tarefasDoContrato(contratoId: string): Promise<TarefaLigada[]>;
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
/** Tempo nas tarefas (supabase/migrations/20261030120000_tempo_nas_tarefas.sql): o cronômetro e os ajustes. */
export interface DadosTempo {
  /** Começa um período contado, já com os segundos que tem; devolve o id dele, para ir gravando. */
  tempoIniciar(tarefaId: string, inicio: string, segundos: number): Promise<number>;
  /** Grava os segundos do período (só cresce). */
  tempoGravar(id: number, segundos: number): Promise<void>;
  /** Ajuste à mão, para mais ou para menos, sempre com motivo (fica registrado como ajuste). */
  tempoAjustar(tarefaId: string, segundos: number, motivo: string): Promise<void>;
  tempoDaTarefa(tarefaId: string): Promise<TempoDaTarefa>;
  /** A soma do tempo das tarefas da demanda (o esforço aproximado dela), para quem vê a demanda. */
  tempoDaDemanda(demandaId: string): Promise<number>;
}

/** Item de uma lista da demanda: feito_em e feito_por são dados pelo banco ao marcar. */
export interface ItemDaLista { id: string; texto: string; prazo: string | null; feito_em: string | null; feito_por: string | null; ordem: number }
/** Lista da demanda (como as do Trello), com os itens na ordem. */
export interface ListaDaDemanda { id: string; nome: string; ordem: number; itens: ItemDaLista[] }

/** Listas das demandas (banco/018_listas_das_demandas.sql): quem vê a demanda vê e mexe nas listas dela. */
export interface DadosListas {
  /** As listas da demanda, na ordem, cada uma com os itens na ordem. */
  listasDaDemanda(demandaId: string): Promise<ListaDaDemanda[]>;
  /** Cria a lista no fim da demanda, já com os itens (na ordem dada), se vierem. */
  listaCriar(demandaId: string, nome: string, itens?: string[]): Promise<ListaDaDemanda>;
  listaAtualizar(id: string, campos: Partial<Pick<ListaDaDemanda, 'nome' | 'ordem'>>): Promise<void>;
  listaExcluir(id: string): Promise<void>;
  /** Cria o item no fim da lista. */
  itemCriar(listaId: string, texto: string): Promise<ItemDaLista>;
  /** feito: marca (o banco anota quando e quem) ou desmarca. */
  itemAtualizar(id: string, campos: Partial<Pick<ItemDaLista, 'texto' | 'prazo' | 'ordem'>> & { feito?: boolean }): Promise<ItemDaLista>;
  itemExcluir(id: string): Promise<void>;
}

/** Modelo de lista do escritório: o nome e os itens, na ordem. Usar um modelo copia os dois para a demanda. */
export interface ModeloDeLista { id: string; nome: string; itens: string[]; criado_por: string | null; atualizado_em: string }

/** Modelos de lista (banco/019_modelos_de_lista.sql): comuns à equipe; quem criou ou um administrador exclui. */
export interface DadosModelos {
  /** Os modelos do escritório, por nome. */
  modelosListar(): Promise<ModeloDeLista[]>;
  modeloCriar(nome: string, itens: string[]): Promise<ModeloDeLista>;
  modeloAtualizar(id: string, campos: Partial<Pick<ModeloDeLista, 'nome' | 'itens'>>): Promise<void>;
  modeloExcluir(id: string): Promise<void>;
}

/** Colunas dos quadros (kanban). */
export interface DadosQuadros {
  colunasListar(modulo: Modulo): Promise<Coluna[]>;
  sugestoesListar(modulo: Modulo): Promise<string[]>;
  colunaCriar(modulo: Modulo, nome: string, ordem: number): Promise<Coluna>;
  colunaOcultar(id: string, ocultar: boolean): Promise<void>;
  colunaRenomear(id: string, nome: string): Promise<void>;
  colunaOrdenar(id: string, ordem: number): Promise<void>;
  colunaExcluir(id: string): Promise<void>;
}

/** Equipe, convites, registro de ações e dados do escritório (administração). */
export interface DadosEquipe {
  equipeListar(): Promise<Usuario[]>;
  conviteCriar(pessoaId: string, email: string, papel: Papel): Promise<ConviteCriado>;
  /** Link novo para um convite pendente (o anterior deixa de valer). Devolve o código. */
  conviteNovoLink(id: string): Promise<string>;
  equipeDefinirPapel(perfilId: string, papel: Papel): Promise<void>;
  /** Só administradores; fica no registro de ações. */
  equipeDefinirFuncao(perfilId: string, funcao: Funcao): Promise<void>;
  equipeDefinirAtivo(perfilId: string, ativo: boolean): Promise<void>;
  convitesListar(): Promise<Convite[]>;
  conviteCancelar(id: string): Promise<void>;
  auditoriaListar(limite?: number): Promise<RegistroAuditoria[]>;
  /** Registra uma exportação no registro de ações (LGPD). Vem antes de entregar o arquivo; só administradores. */
  exportacaoRegistrar(tabela: 'pessoas', descricao: string, quantidade: number): Promise<void>;

  /** Salva os dados da instituição (só administradores). logo ausente mantém a atual; null a remove. */
  escritorioSalvar(dados: Omit<DadosEscritorio, 'logo'> & { logo?: string | null }): Promise<void>;
}

/** Módulos cujos cartões têm comentários (cada um com a sua coluna na tabela comentarios). */
export type ModuloComentado = 'pessoas' | 'contratos' | 'demandas' | 'tarefas';
export interface Comentario {
  id: string;
  autor_id: string | null;   // null: o usuário foi removido do sistema
  texto: string;
  mencoes: string[];         // perfis marcados com @ (o banco acha no texto)
  criado_em: string;
  editado_em: string | null;
}

/** Comentários dos cartões, com @ (banco/016_comentarios.sql). */
export interface DadosComentarios {
  /** Os comentários do cartão, do mais novo para o mais antigo. */
  comentariosListar(modulo: ModuloComentado, cartaoId: string): Promise<Comentario[]>;
  comentarioCriar(modulo: ModuloComentado, cartaoId: string, texto: string): Promise<Comentario>;
  /** Só quem escreveu. */
  comentarioEditar(id: string, texto: string): Promise<Comentario>;
  /** Quem escreveu ou um administrador. */
  comentarioExcluir(id: string): Promise<void>;
}

export interface Dados extends DadosSessao, DadosDuasEtapas, DadosPessoas, DadosSigilo, DadosVinculos, DadosContratos, DadosQuadros, DadosEquipe, DadosComentarios, DadosDemandas, DadosListas, DadosModelos, DadosTarefas, DadosTempo {}
