// Formato dos dados trocados entre as telas e a camada de dados (dados/supabase.ts e dados/falso.ts).
import type { CorDaEtiqueta } from '../regras/etiquetas';
import type { Contagem, TipoSemExpediente } from '../regras/prazos';

export type Papel = 'master' | 'admin' | 'usuario';
/** O que a pessoa faz no escritório. Diferente do papel: administrador é quem gere o sistema; administrativo é uma função. */
export type Funcao = 'advogado' | 'administrativo' | 'estagiario';
export type TipoPessoa = 'pf' | 'pj' | 'contato';
export type Modulo = 'pessoas' | 'contratos' | 'demandas' | 'tarefas' | 'processos' | 'compromissos' | 'anotacoes' | 'financeiro' | 'processos_judiciais' | 'processos_administrativos';

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
  /** Link da foto pequena (150×150, redonda), para as bolinhas; sem foto, as bolinhas mostram as iniciais. */
  foto?: string | null;
}

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

export interface PessoaResumida { id: string; codigo: string; nome: string; tipo: TipoPessoa; arquivado_em?: string | null }

export interface FiltroPessoas {
  termo?: string;
  etiqueta?: string;
  tipo?: string;
  responsavel?: string;
  situacao?: 'ativas' | 'arquivadas';
  /** Só as importadas ou só as com pendência. */
  marca?: MarcaPessoas;
  ordem?: Ordem;
  pagina?: number;
  porPagina?: number;
}
/** Marcas do filtro de Pessoas: criadas por uma importação, ou com alguma pendência. */
export type MarcaPessoas = 'importadas' | 'pendentes';

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
export interface Coluna { id: string; nome: string; ordem: number; criado_por: string | null; oculta: boolean; marco?: MarcoColuna | null; grupo_id?: string | null }
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
  /** Participantes, na ordem do cadastro, cada um com o seu % (sobre o líquido). */
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
  | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em' | 'cliente_nome'> & ComEtiquetas;

export interface FiltroContratos {
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
  | 'contrato_codigo' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em'> & ComEtiquetas;
export interface FiltroDemandas {
  termo?: string;
  etiqueta?: string;
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
  /** A ligação nasce com a tarefa (de uma intimação ou de um prazo) e não muda depois. */
  processo_id: string | null;
  /** O processo, se quem vê a tarefa também pode abri-lo; senão null. */
  processo: { id: string; codigo: string; tipo: TipoProcesso; numero: string } | null;
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
  | 'participantes' | 'demanda_id' | 'contrato_id' | 'processo_id' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'arquivado_por'>>;
/** Linha das listagens de tarefas (tabela e quadro). */
export type TarefaLista = Pick<Tarefa, 'id' | 'codigo' | 'titulo' | 'prazo' | 'responsavel_id' | 'participantes' | 'pessoa_nome'
  | 'demanda_codigo' | 'contrato_codigo' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em'> & ComEtiquetas;
export interface FiltroTarefas {
  termo?: string;
  etiqueta?: string;
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
/** A quem o aviso da troca de e-mail pelo administrador vai (função equipe-trocar-email). */
export type DestinoDoAvisoDaTroca = 'antigo' | 'gestao';
export interface RegistroAuditoria {
  id: string | number; tabela: string; registro_id: string | null; acao: string;
  resumo: { nome?: string; email?: string; codigo?: string; descricao?: string; quantidade?: number; completadas?: number; incompletas?: number; email_antigo?: string; email_novo?: string; situacao?: 'falhou'; aviso_falhas?: DestinoDoAvisoDaTroca[]; parcela?: number; recebimento?: string; pago_em?: string; valor?: number } | null;
  feito_por: string | null; em: string;
}

export interface Exclusao { excluidas: number; naoExcluidas: number; motivo: string }

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
  /** Recusa quem pode ver, mas não alterar, o contrato (quem só foi mencionado). */
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
  /** A ligação com o processo nasce com a tarefa e não muda. */
  tarefaAtualizar(id: string, dados: Omit<DadosTarefa, 'processo_id'>): Promise<{ id: string; codigo: string }>;
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
  /** Grava os segundos do período (só cresce). */
  tempoGravar(id: number, segundos: number): Promise<void>;
  /** Ajuste à mão, para mais ou para menos, sempre com motivo (fica registrado como ajuste). */
  tempoAjustar(tarefaId: string, segundos: number, motivo: string): Promise<void>;
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

/** Item de uma lista: feito_em e feito_por são dados pelo banco ao marcar. */
export interface ItemDaLista { id: string; texto: string; prazo: string | null; feito_em: string | null; feito_por: string | null; ordem: number }
/** Cartões que têm listas. */
export type CartaoComListas = Extract<Modulo, 'demandas' | 'tarefas'>;
/** Lista de uma demanda ou de uma tarefa (como as do Trello), com os itens na ordem. */
export interface ListaDoCartao { id: string; nome: string; ordem: number; itens: ItemDaLista[] }

/** Listas das demandas e das tarefas (supabase/migrations/20261027000018_listas_das_demandas.sql e supabase/migrations/20261030130000_listas_nas_tarefas.sql):
 * quem vê a demanda ou a tarefa vê e mexe nas listas dela. */
export interface DadosListas {
  /** As listas da demanda ou da tarefa, na ordem, cada uma com os itens na ordem. */
  listasDoCartao(modulo: CartaoComListas, id: string): Promise<ListaDoCartao[]>;
  /** Cria a lista no fim das listas do cartão, já com os itens (na ordem dada), se vierem. */
  listaCriar(modulo: CartaoComListas, id: string, nome: string, itens?: string[]): Promise<ListaDoCartao>;
  listaAtualizar(id: string, campos: Partial<Pick<ListaDoCartao, 'nome' | 'ordem'>>): Promise<void>;
  listaExcluir(id: string): Promise<void>;
  /** Cria o item no fim da lista. */
  itemCriar(listaId: string, texto: string): Promise<ItemDaLista>;
  /** feito: marca (o banco anota quando e quem) ou desmarca. */
  itemAtualizar(id: string, campos: Partial<Pick<ItemDaLista, 'texto' | 'prazo' | 'ordem'>> & { feito?: boolean }): Promise<ItemDaLista>;
  itemExcluir(id: string): Promise<void>;
}

/** Modelo de lista do escritório: o nome e os itens, na ordem. Usar um modelo copia os dois para a demanda ou a tarefa. */
export interface ModeloDeLista { id: string; nome: string; itens: string[]; criado_por: string | null; atualizado_em: string }

/** Modelos de lista (supabase/migrations/20261027000019_modelos_de_lista.sql): comuns à equipe; quem criou ou um administrador exclui. */
export interface DadosModelos {
  /** Os modelos do escritório, por nome. */
  modelosListar(): Promise<ModeloDeLista[]>;
  modeloCriar(nome: string, itens: string[]): Promise<ModeloDeLista>;
  modeloAtualizar(id: string, campos: Partial<Pick<ModeloDeLista, 'nome' | 'itens'>>): Promise<void>;
  modeloExcluir(id: string): Promise<void>;
}

/** Processo: judicial ou administrativo (não muda depois), com número e pelo menos um cliente. O código (curto e aleatório) é dado pelo banco.
 *  Quem não é administrador vê só os que criou, de que é responsável ou colaborador. */
export type TipoProcesso = 'judicial' | 'administrativo';
export type PoloProcesso = 'autor' | 'reu' | 'terceiro';
export type MeioProcesso = 'fisico' | 'eletronico';
export type GratuidadeProcesso = 'pedida' | 'concedida' | 'negada' | 'nao_pedida';
/** As listas que o administrador pode ampliar. */
export type CampoDeOpcao = 'sistema' | 'natureza' | 'area';
export interface Processo {
  id: string; codigo: string; tipo: TipoProcesso; numero: string;
  /** O nome do cartão; sem ele, aparecem os clientes. */
  titulo: string | null;
  responsavel_id: string; colaboradores: string[]; cliente_nome: string;
  orgao: string | null; sistema: string | null; polo: PoloProcesso | null; area: string | null; meio: MeioProcesso | null;
  natureza: string | null; gratuidade: GratuidadeProcesso | null; comarca: string | null; vara: string | null; classe: string | null; assunto: string | null;
  juiz: string | null; distribuicao: string | null; valor_causa: number | null; instancia: string | null; segredo: boolean; advogado_contrario: string | null; observacoes: string | null;
  etapa_id: string | null; etapa_ordem: number | null; arquivado_em: string | null; arquivado_por: string | null;
  criado_por: string | null; criado_em: string; atualizado_por: string | null; atualizado_em: string;
  clientes: PessoaResumida[];
  /** Os valores dos campos que o escritório criou, por id do campo. */
  campos: Record<string, string>;
}
/** O que aparece de uma tarefa ligada; null quando quem está logado não pode vê-la. */
export type TarefaDoAcompanhamento = { id: string; codigo: string } | null;
export type TipoDeAndamento = 'andamento' | 'intimacao' | 'audiencia' | 'pericia';
/** O que aconteceu ou vai acontecer no processo, lançado à mão. */
export interface AndamentoDeProcesso {
  id: string; processo_id: string; tipo: TipoDeAndamento;
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
export type DadosAndamento = Pick<AndamentoDeProcesso, 'tipo' | 'data' | 'hora' | 'local' | 'texto'>;
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
export type ProcessoLista = Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'responsavel_id' | 'colaboradores' | 'cliente_nome' | 'orgao' | 'comarca' | 'vara'
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
export interface ProcessoLigado extends Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome' | 'etapa_id' | 'arquivado_em' | 'criado_em'> { papeis: PapelNoProcesso[] }
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
  processoHistorico(id: string): Promise<Historico[]>;
  /** Processos em que a pessoa é cliente; com perfilId (a pessoa é da equipe), também os em que é responsável ou colaboradora. */
  processosDaPessoa(pessoaId: string, perfilId?: string | null): Promise<ProcessoLigado[]>;
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
export type ModuloComEtiquetas = Extract<Modulo, 'pessoas' | 'contratos' | 'demandas' | 'tarefas' | 'processos' | 'compromissos'>;
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
export type ResultadoDaLigacao = 'ligado' | 'recusado' | 'sem-permissao' | 'expirado' | 'erro';

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
  /** Desliga a conta Google do escritório (apaga a ligação e a autorização guardada). */
  ligacaoGoogleDesligar(): Promise<void>;
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
  equipeDefinirAtivo(perfilId: string, ativo: boolean): Promise<void>;
  /**
   * Troca na hora o e-mail de acesso de quem perdeu o e-mail antigo, sem link de confirmação. Vale para quem o administrador
   * pode gerir (nunca um master, a própria conta ou o dono da plataforma; quem alcança informações sigilosas, só o master).
   * Encerra as sessões abertas da pessoa, tira a senha antiga de uso e fica no registro de ações.
   */
  equipeTrocarEmail(perfilId: string, email: string): Promise<void>;
  /** As últimas trocas de e-mail pelo administrador, separadas do resto do registro de ações (só administradores). */
  trocasDeEmailListar(limite?: number): Promise<RegistroAuditoria[]>;
  convitesListar(): Promise<Convite[]>;
  conviteCancelar(id: string): Promise<void>;
  auditoriaListar(limite?: number): Promise<RegistroAuditoria[]>;
  /** Registra uma exportação no registro de ações (LGPD). Vem antes de entregar o arquivo; só administradores. */
  exportacaoRegistrar(tabela: 'pessoas', descricao: string, quantidade: number): Promise<void>;

  /** Salva os dados da instituição (só administradores). logo ausente mantém a atual; null a remove. */
  escritorioSalvar(dados: Omit<DadosEscritorio, 'logo'> & { logo?: string | null }): Promise<void>;
}

/** Módulos cujos cartões têm comentários (cada um com a sua coluna na tabela comentarios). */
export type ModuloComentado = 'pessoas' | 'contratos' | 'demandas' | 'tarefas' | 'compromissos';
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
}

// ---------- compromissos (agenda) ----------
export type TipoCompromisso = 'audiencia' | 'pericia' | 'reuniao' | 'outro';
export type ModalidadeCompromisso = 'presencial' | 'virtual';
/** O que o compromisso traz do processo ligado: para mostrá-lo e saber quem o vê (quem vê o processo vê o compromisso). */
export type ProcessoDoCompromisso = Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome' | 'criado_por' | 'responsavel_id' | 'colaboradores'>;
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
  /** Os nomes das pessoas juntos ("A; B"), como a tabela, o quadro, a busca e a ordem por nome usam. */
  pessoa_nome: string;
  processo_id: string | null;
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
}
/** Campos que o cadastro de compromisso grava. */
export type DadosCompromisso = Partial<{ pessoas: string[] } & Pick<Compromisso, 'titulo' | 'data' | 'hora' | 'hora_fim' | 'modalidade' | 'local' | 'resultado' | 'observacoes' | 'geral'
  | 'responsavel_id' | 'participantes' | 'processo_id' | 'etapa_id' | 'etapa_ordem' | 'tipo' | 'arquivado_em' | 'arquivado_por'>>;
/** Linha das listagens de compromissos (tabela, quadro e agenda). */
export type CompromissoLista = Pick<Compromisso, 'id' | 'codigo' | 'tipo' | 'titulo' | 'data' | 'hora' | 'hora_fim' | 'modalidade' | 'local' | 'geral' | 'responsavel_id' | 'participantes'
  | 'pessoa_nome' | 'processo_id' | 'processo_codigo' | 'processo_numero' | 'etapa_id' | 'etapa_ordem' | 'arquivado_em' | 'criado_por' | 'criado_em' | 'atualizado_em'> & ComEtiquetas;
/** A ordem da tabela de compromissos: as de sempre e a data do compromisso. No quadro, cada coluna tem a sua (Ordem). */
export type OrdemCompromisso = Ordem | 'data' | 'data_desc';
export interface FiltroCompromissos {
  termo?: string;
  /** Um usuário da equipe: os compromissos em que ele é o responsável ou um participante. */
  pessoa?: string;
  tipo?: TipoCompromisso | '';
  etiqueta?: string;
  situacao?: 'ativos' | 'arquivados';
  ordem?: OrdemCompromisso;
  pagina?: number;
  porPagina?: number;
}
/** Papel de uma pessoa num compromisso (responsável e participantes são da equipe, pela pessoa ligada ao usuário). */
export type PapelNoCompromisso = 'pessoa' | 'responsavel' | 'participante';
/** Compromisso como aparece em outro cartão (da pessoa ou do processo), com o papel da pessoa nele. */
export interface CompromissoLigado extends Pick<Compromisso, 'id' | 'codigo' | 'tipo' | 'titulo' | 'data' | 'hora' | 'hora_fim' | 'pessoa_nome' | 'processo_numero' | 'etapa_id' | 'arquivado_em'> { papeis: PapelNoCompromisso[] }
/** O prazo de uma demanda ou de uma tarefa, como aparece na agenda (só para consultar; abre o cartão de origem). */
export interface PrazoNaAgenda { origem: 'demandas' | 'tarefas'; id: string; codigo: string; titulo: string; prazo: string; responsavel_id: string }
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
  /** Os prazos de demandas e tarefas ativas e não concluídas num período (o primeiro e o último dia entram). */
  prazosDoPeriodo(de: string, ate: string, f?: Pick<FiltroCompromissos, 'termo' | 'pessoa'>): Promise<PrazoNaAgenda[]>;
  /** Os ativos mais recentes que combinam com o texto (número, nome, cliente, código): a busca é no banco, para achar também os antigos. */
  processosParaLigar(termo?: string): Promise<ProcessoParaLigar[]>;
}
/** A demanda no cartão do processo, com quem a vê: para saber se a tarefa pode herdá-la. */
export type DemandaDoProcesso = DemandaLigada & Pick<Demanda, 'contrato_id' | 'criado_por' | 'responsavel_id' | 'colaboradores'>;
/** O processo como aparece no painel. Os clientes vêm só pelo id. */
export type ProcessoNoPainel = Pick<Processo, 'id' | 'codigo' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome' | 'responsavel_id' | 'colaboradores'> & { clientes: string[] };
export type PrazoNoPainel = Pick<PrazoDeProcesso, 'id' | 'descricao' | 'final' | 'tarefa_id'> & { processo: ProcessoNoPainel };
export type AndamentoNoPainel = Pick<AndamentoDeProcesso, 'id' | 'tipo' | 'data' | 'hora' | 'local' | 'texto' | 'tratada_em' | 'tarefa_id' | 'criado_em'> & { processo: ProcessoNoPainel };
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
  /** Tarefas ligadas ao processo que quem está logado pode ver. */
  tarefasDoProcesso(processoId: string): Promise<TarefaLigada[]>;
  /** Liga o processo à demanda de que ele nasceu. Ligar de novo não muda nada. */
  processoDemandaLigar(processoId: string, demandaId: string): Promise<void>;
  /** As demandas ligadas ao processo que quem está logado pode ver. */
  demandasDoProcesso(processoId: string): Promise<DemandaDoProcesso[]>;
  /** Os processos ligados à demanda que quem está logado pode ver, e quantos há que ele não pode abrir. */
  processosDaDemanda(demandaId: string): Promise<{ visiveis: ProcessoLigado[]; ocultos: number }>;
  /** O painel de Processos. meus: só os processos em que a pessoa é responsável ou colaboradora. */
  processosPainel(f: { hoje: string; meus: boolean }): Promise<PainelDeProcessos>;
  /** Só administradores. */
  processosDiasParadoSalvar(dias: number): Promise<void>;
}

/** Conta do escritório. O saldo inicial é em centavos, e nada é lançado antes da data dele. */
export interface ContaFinanceira { id: string; nome: string; tem_das: boolean; saldo_inicial: number; saldo_inicial_em: string; arquivada_em: string | null }
export type DadosConta = Pick<ContaFinanceira, 'nome' | 'tem_das' | 'saldo_inicial' | 'saldo_inicial_em'>;
export type TipoDeLancamento = 'entrada' | 'saida';
export type CategoriaDeLancamento = 'recebimento' | 'outra_entrada' | 'despesa' | 'das' | 'repasse' | 'indicacao' | 'divisao_lucro' | 'ajuste_a_mais' | 'ajuste_a_menos' | 'transferencia';
/** Uma entrada ou uma saída numa conta, em centavos. par_id: a outra ponta de uma transferência. */
export interface Lancamento {
  id: string; conta_id: string; data: string; tipo: TipoDeLancamento; categoria: CategoriaDeLancamento; valor: number; descricao: string;
  par_id: string | null; criado_por: string | null; criado_em: string; atualizado_em: string;
  /** Nasceu de um recebimento, de um repasse ou de uma divisão de lucro: só muda por lá. */
  origem: 'recebimento' | 'repasse' | 'lucro' | null;
}
export type DadosLancamento = Pick<Lancamento, 'conta_id' | 'data' | 'tipo' | 'categoria' | 'valor' | 'descricao'>;
export interface AliquotaDoDas { mes: string; aliquota: number }
/** Uma parcela do contrato, em centavos. Quem vê: um administrador ou o responsável pelo contrato. */
export interface Parcela {
  id: string; contrato_id: string; numero: number; vencimento: string; valor: number;
  recebimento_id: string | null; recebida_em: string | null; recebido: number | null;
}
export interface ParcelaDoEscritorio extends Parcela { contrato_codigo: string; cliente_nome: string; responsavel_id: string | null }
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
/** O recebimento como ficou gravado: mudar o DAS ou a lista de sócios depois não muda nada aqui. */
export interface RecebimentoGravado {
  id: string; parcela_id: string; contrato_id: string; conta_id: string; data: string; valor: number; taxa_maquina: number; aliquota_das: number; parte_na_conta: number; responsavel_socio: boolean;
  na_conta: number; ficou_com_advogado: number; das: number; liquido: number; escritorio: number; responsavel_recebe: number; responsavel_fica: number; escritorio_final: number; contribuicao_socio: number;
  terceiros: (TerceiroDoRecebimento & { valor: number })[];
  socio_indicador: { id: string; nome: string; valor: number } | null;
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
}
/** O que a página de lucro precisa, sem o que foi estornado ou desfeito. Só administradores. */
export interface MovimentoDoLucro {
  /** Os recebimentos em que o responsável era sócio e tudo foi para a conta da empresa. */
  recebimentos: { data: string; pessoa_id: string; nome: string; liquido: number; terceiros: { valor: number }[] }[];
  /** O que o escritório deve ao sócio que indicou; data: a do recebimento. */
  indicacoes: { data: string; pessoa_id: string; nome: string; valor: number; pago_em: string | null }[];
  retiradas: { id: string; pessoa_id: string; nome: string; conta_id: string; data: string; valor: number; descricao: string }[];
}
/** O caixa (supabase/migrations/20261102175057_financeiro_caixa.sql). Só administradores. */
export interface DadosFinanceiro {
  financeiroContas(): Promise<ContaFinanceira[]>;
  financeiroContaCriar(dados: DadosConta): Promise<ContaFinanceira>;
  financeiroContaAtualizar(id: string, dados: Partial<DadosConta & Pick<ContaFinanceira, 'arquivada_em'>>): Promise<void>;
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
  /** Excluir só esconde; restaurar devolve como estava. */
  parcelaExcluir(id: string): Promise<void>;
  parcelaRestaurar(id: string): Promise<void>;
  /** Para o contrato assinado antes de ligar o módulo, ou que ficou sem parcelas. Devolve quantas gerou. */
  parcelasGerar(contratoId: string): Promise<number>;
  financeiroParaReceber(parcelaId: string, data: string): Promise<ParaReceber>;
  /** O banco refaz a divisão, cria a entrada no caixa e os repasses. Devolve o id do recebimento. */
  financeiroReceber(r: { parcela: string; data: string; valor: number; conta: string; taxa: number }): Promise<string>;
  financeiroRecebimento(id: string): Promise<RecebimentoGravado | null>;
  /** Só as linhas de quem está logado, dos recebimentos não estornados com data no período e os valores ainda a receber de antes dele (supabase/migrations/20261104000000_meus_valores.sql). */
  financeiroMeusValores(de: string, ate: string): Promise<MeuValor[]>;
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

export interface Dados extends DadosFinanceiro, DadosParcelas, DadosAcompanhamento, DadosSessao, DadosDuasEtapas, DadosPessoas, DadosSigilo, DadosVinculos, DadosContratos, DadosQuadros, DadosEquipe, DadosComentarios, DadosDemandas, DadosListas, DadosModelos, DadosTarefas, DadosTempo, DadosPerfilProfissional, DadosFotos, DadosLigacoes, DadosImportacao, DadosCalendario, DadosEtiquetas, DadosProcessos, DadosCompromissos {}
