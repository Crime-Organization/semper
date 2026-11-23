// A tabela de assuntos do mapa do sistema (#407): o que é de cada assunto. O mapa (docs/MAPA.md) é gerado a partir daqui por
// "npm run mapa --prefix app"; o resumo e as armadilhas são escritos à mão aqui e nunca se perdem na geração.
// Assunto novo = uma entrada nova em ASSUNTOS. Arquivo, tabela ou rota nova que caiu em "Sem assunto" no mapa: ponha aqui.
//
// Cada entrada de "arquivos" é:
//   - um texto: a chave do arquivo, o nome sem a pasta e sem as extensões ("Pessoas" casa com paginas/Pessoas.tsx, Pessoas.css e
//     Pessoas.test.tsx; "vinculos", com regras/vinculos.ts, e2e/vinculos.spec.ts e a migração 20261025000003_vinculos.sql; nas
//     funções do servidor, o nome da pasta). Maiúsculas contam.
//   - ou uma expressão, sobre o caminho a partir da raiz do projeto (para uma pasta inteira ou um arquivo de nome repetido).
// As migrações que criam ou mudam uma das "tabelas" do assunto entram sozinhas; as outras, pelo nome.

/** Uma chave de arquivo (texto) ou uma expressão sobre o caminho. */
export type Padrao = string | RegExp;

export interface Assunto {
  /** A âncora no mapa (#pessoas). */
  id: string;
  titulo: string;
  /** O que é o assunto, em uma ou duas linhas. A primeira linha vai também ao índice. */
  resumo: string;
  arquivos: Padrao[];
  /** As tabelas do banco (as do esquema privado com o prefixo "privado."). */
  tabelas?: string[];
  /** As partes do contrato Dados (app/src/dados/tipos.ts). */
  dados?: string[];
  /** As rotas, como estão em app/src/App.tsx ("pessoas", "pessoas/nova", "/"). */
  rotas?: string[];
  /** O que costuma dar errado ou precisa mudar junto. */
  armadilhas?: string[];
}

/** Todos os arquivos de uma pasta (a partir da raiz do projeto). */
const pasta = (caminho: string) => new RegExp(`^${caminho.replace(/[.]/g, '\\.')}/`);
/** Um arquivo pelo caminho exato, sem a extensão (para nomes que se repetem em outras pastas). */
const arquivo = (caminho: string) => new RegExp(`^${caminho.replace(/[.]/g, '\\.')}\\.`);

export const COMUM: Assunto = {
  id: 'comum',
  titulo: 'Comum a todos',
  resumo: 'As peças que todos os módulos usam: a casca do app, as rotas, a camada de dados, as peças de ui/base, os estilos, os tempos e os limites.\n'
    + 'Mexer aqui muda todos os módulos de uma vez.',
  arquivos: [
    'App', 'main', 'marca', 'globais.d', 'estilo',
    'index', 'tipos', 'supabase', 'falso', arquivo('app/src/dados/contrato'), 'erros', 'limites', pasta('app/src/testes'),
    pasta('app/src/ui/base'), pasta('app/src/ui/painel'), arquivo('app/src/ui/Graficos'),
    'Avatar', 'AvisoAoSair', 'Botoes', 'Casca', 'CampoComSugestoes', 'ErroDaTela', 'Icone', 'Menu', 'MaisDoMenu', 'PaginaModulo',
    'Paginacao', 'PainelCartao', 'Recolhivel', 'SecaoArquivados', 'SubmenuLateral', 'abrirItem', 'arrastar', 'avisos', 'barraDeRolagem',
    'janela', 'loja', 'ordem', 'preferencias', 'rolagem', 'sessao', 'tema', 'tempos', 'useCartaoNaUrl', 'useParametroLido', 'useQuantos',
    'useSelecao', 'util',
    'texto', 'csv', 'formatacao', 'tituloDaAba', 'enderecosAntigos', 'qualBanco', 'campoData', 'escalaDosGraficos', 'filtroDoPainel',
    'ajudantes', 'sair-do-cadastro', 'nova-aba', 'menu-lateral',
    'banco-local', pasta('app/ferramentas/mapa'),
    'avisoNoServidor', 'envioDeEmail', 'modeloDeEmail', 'servidor',
    'base', 'desempenho'
  ],
  rotas: ['*'],
  armadilhas: [
    'Função de dados nova: no contrato (`dados/tipos.ts`), em `supabase.ts` **e** em `falso.ts`, que precisa se comportar igual; o `dados/contrato.test.ts` confere os dois.',
    'Os testes de tela e o `npm run teste` usam o banco fictício (`falso.ts`): o que só existe em `supabase.ts` não aparece neles.',
    'Tamanho de campo em `dados/limites.ts` marcado como exigido pelo banco: muda junto com uma migração nova.',
    'Tabela nova: `escritorio_id` e regras RLS, como em `20261024000001_base.sql`; a migração só acrescenta (nada de apagar ou renomear no mesmo passo).',
    '`PaginaModulo`, `ui/base`, `PainelCartao`, `estilo.css` e `ui/quadro` afetam todos os módulos: depois de mexer, rode a bateria completa de telas.',
    'Endereço que muda de lugar: uma entrada em `regras/enderecosAntigos.ts`, para os links antigos continuarem valendo. Cadastro novo em janela: a tabela `CADASTROS` de `App.tsx`.',
    'Mudança que o usuário percebe: uma novidade em `app/novidades/proxima/<tarefa>-<palavras>.json` no mesmo commit.',
    'Datas no horário de Brasília: os testes fixam o fuso (`vite.config.ts`, `playwright.config.ts`); não use `new Date()` solto nas regras.'
  ]
};

export const ASSUNTOS: Assunto[] = [
  {
    id: 'pessoas',
    titulo: 'Pessoas',
    resumo: 'O cadastro de pessoas (clientes, partes, contatos): o cadastro em etapas, o cartão, os vínculos entre pessoas, o sigilo e os responsáveis.\n'
      + 'É o módulo modelo: os outros copiam a página, o quadro, o cartão e o cadastro dele.',
    arquivos: [
      'Pessoas', 'NovaPessoa', 'CartaoPessoa', 'VinculosPessoa', 'ProcessosDaPessoa', 'EquipeDaPessoaNoTopo', 'PessoasNosItens', pasta('app/src/paginas/novaPessoa'),
      'pessoa', 'cadastro', 'vinculos', 'origemDaPessoa', 'responsaveisDaPessoa', 'conviteDaPessoa', 'clienteAoContrato',
      'BuscaPessoa', 'consultas', 'planilhaAntiga',
      'pessoas', 'responsaveis-da-pessoa', 'nova-pessoa-no-cartao', 'planilha-provisoria', 'convidar-pelo-cartao', arquivo('app/e2e/quadro'),
      'exportacoes', 'lgpd_exclusao', 'cnpj_com_letras'
    ],
    tabelas: ['pessoas', 'pessoa_historico', 'pessoa_responsaveis', 'pessoa_sigilos', 'pessoa_sigilo_acessos', 'pessoa_vinculos', 'vinculo_tipos'],
    dados: ['DadosPessoas', 'DadosSigilo', 'DadosVinculos'],
    rotas: ['pessoas', 'pessoas/nova'],
    armadilhas: [
      'A validação de cada etapa do cadastro é a tabela `VALIDACAO` de `regras/cadastro.ts` (e `AO_ENTRAR`); etapa nova = entrada nova, um componente em `paginas/novaPessoa/etapas.tsx`.',
      'Pessoa repetida se acha pelo CPF/CNPJ (`pessoaPorDocumento`) e, sem documento, pelos telefones (`pessoasPorTelefones`).',
      '`improvisos/planilhaAntiga.ts` (PROVISORIO-219) manda as pessoas novas também para a planilha antiga; sai com o `e2e/planilha-provisoria.spec.ts`.',
      'Excluir pessoa apaga o nome do registro de ações (LGPD, `lgpd_exclusao`): não guarde nome de pessoa em outro lugar sem pensar na exclusão.'
    ]
  },
  {
    id: 'contratos',
    titulo: 'Contratos',
    resumo: 'Os contratos de honorários: o cadastro, os clientes e participantes, a numeração por ano, quem vê os valores, e arquivar ou excluir em cascata.\n'
      + 'O contrato é o centro: demandas, tarefas e parcelas se ligam a ele.',
    arquivos: [
      'Contratos', 'NovoContrato', 'NovoContratoPelaOrigem', 'CartaoContrato', 'ContratosDoProcesso', 'ParticipantesDoContrato', 'ExclusaoDoContrato',
      'EquipeDoContratoNoTopo', 'equipeDoContrato', 'clienteAoContrato',
      'contrato', 'contratoAbreDemandas', 'arquivarContrato', 'exclusaoDoContrato',
      'contratos', 'cliente-ao-contrato', 'contrato-abre-demandas', 'contrato-arquiva-em-cascata', 'contrato-exclui-em-cascata', 'visibilidade-contratos',
      'inicio-das-negociacoes', 'nascer-ligado-demanda-contrato', 'novo-padrao-das-secoes',
      'numeracao_por_ano', 'ano_do_contrato_importado', 'visibilidade_dos_contratos', 'visibilidade_contratos', 'cliente_ao_contrato', 'contrato_abre_demandas',
      'contrato_arquiva_em_cascata', 'contrato_exclui_em_cascata', 'contrato_cascata_com_a_continua', 'inicio_das_negociacoes'
    ],
    tabelas: ['contratos', 'contrato_clientes', 'contrato_historico', 'contrato_participantes', 'contrato_processos', 'privado.contrato_numeracao',
      'privado.contratos_com_demandas', 'privado.contratos_do_cliente_fechado', 'privado.arquivados_com_contrato'],
    dados: ['DadosContratos'],
    rotas: ['contratos', 'contratos/novo'],
    armadilhas: [
      'Arquivar e excluir em cascata estão duas vezes: no banco (gatilhos das migrações `contrato_arquiva_em_cascata` e `contrato_exclui_em_cascata`) e em `regras/arquivarContrato.ts` e `regras/exclusaoDoContrato.ts` (o fictício usa as regras): mude os dois.',
      'Os valores do contrato só aparecem para quem é parte quando a chave do escritório está ligada (`contratoVer`, Equipe vê tudo).',
      'Parcelas e recebimentos do contrato estão em [Parcelas e recebimentos](#parcelas); objetos, em [Objetos de contrato](#objetos).'
    ]
  },
  {
    id: 'objetos',
    titulo: 'Objetos de contrato',
    resumo: 'Os objetos (o que o contrato cobre), a lista do escritório nas Configurações (corrigir, juntar parecidos) e a demanda que nasce de cada objeto.\n'
      + 'As funções de dados ficam em `DadosContratos` (veja Contratos).',
    arquivos: ['ObjetosDeContrato', 'objetos', 'objetos-de-contrato', 'objetos-sem-demanda', 'contrato_objetos', 'demandas_dos_objetos', 'objetos_sem_demanda',
      'editar_objetos_de_contrato'],
    tabelas: ['objeto_sugestoes'],
    armadilhas: ['Juntar dois objetos muda todos os contratos que usam o de origem: confira o aviso de uso (`regras/objetos.ts`) e o teste do banco `editar_objetos_de_contrato`.']
  },
  {
    id: 'demandas',
    titulo: 'Demandas',
    resumo: 'As demandas (o trabalho de um caso, com prazo e fases): o cadastro, o cartão, demandas relacionadas e a demanda contínua, que junta as tarefas avulsas.',
    arquivos: [
      'Demandas', 'NovaDemanda', 'NovaDemandaPelaOrigem', 'CartaoDemanda', 'DemandasRelacionadas', 'concluirDemanda', 'CartoesLigados',
      'demanda', 'demandaContinua', 'demandasRelacionadas', 'demandaDoCompromisso', 'dataDeInicio', 'ordemPorPrazo', 'filtroDoInicio',
      'demandas', 'demandas-relacionadas', 'demanda-continua',
      'demanda_continua', 'demandas_continuas_do_escritorio', 'demandas_relacionadas', 'data_de_inicio'
    ],
    tabelas: ['demandas', 'demanda_clientes', 'demanda_historico', 'demandas_relacionadas'],
    dados: ['DadosDemandas'],
    rotas: ['demandas', 'demandas/nova'],
    armadilhas: [
      'A ordem pelo prazo (`regras/ordemPorPrazo.ts`) é a mesma no banco de verdade e no fictício: mude os dois.',
      'A demanda contínua é criada pelo banco (uma por grupo da equipe e uma geral); não a crie pela tela.',
      'Checklists da demanda estão em [Checklists e modelos](#listas).'
    ]
  },
  {
    id: 'listas',
    titulo: 'Checklists e modelos',
    resumo: 'Os checklists (no código e no banco, "listas") da demanda, da tarefa e do contrato, com grupos numerados, e os modelos de checklist do escritório.',
    arquivos: ['ListasDoCartao', 'ModelosDeLista', pasta('app/src/paginas/listas'), 'listas', 'gruposDaLista', 'checklists-com-grupos',
      'listas_das_demandas', 'listas_nas_tarefas', 'modelos_de_lista', 'checklists_com_grupos', 'checklist_colar_de_uma_vez'],
    tabelas: ['demanda_listas', 'demanda_lista_itens', 'demanda_lista_grupos', 'lista_modelos'],
    dados: ['DadosListas', 'DadosModelos'],
    rotas: ['modelos-de-lista'],
    armadilhas: ['As tabelas se chamam `demanda_listas…`, mas valem também para tarefas e contratos (coluna do cartão).']
  },
  {
    id: 'tarefas',
    titulo: 'Tarefas',
    resumo: 'As tarefas: o cadastro, o cartão, as funções dos participantes (executa, acompanha), a aprovação interna, a diligência, copiar para outra demanda e o prazo do processo que a tarefa cumpre.',
    arquivos: [
      'Tarefas', 'NovaTarefa', 'CartaoTarefa', 'TarefasDaDemanda', 'AprovacaoDaTarefa', 'FuncoesDosParticipantes', 'copiarTarefa', 'prazoDaTarefa',
      'tarefa', 'aprovacaoDaTarefa', 'copiaDaTarefa', 'funcoesNaTarefa', 'dataDeInicio', 'ordemPorPrazo', 'filtroDoInicio', 'CartoesLigados',
      'tarefas', 'copiar-tarefa', 'tarefa-aprovacao', 'tarefa-em-varias-ligacoes', 'tarefa-pedido', 'prazo-da-tarefa', 'demanda-continua',
      /^supabase\/(migrations|tests)\/(\d{14}_)?tarefa_/, 'colunas_de_espera_das_tarefas', 'data_de_inicio'
    ],
    tabelas: ['tarefas', 'tarefa_pessoas', 'tarefa_historico', 'tarefa_demandas', 'tarefa_contratos', 'funcoes_na_tarefa'],
    dados: ['DadosTarefas', 'DadosFuncoesNaTarefa'],
    rotas: ['tarefas', 'tarefas/nova'],
    armadilhas: [
      'Concluir a tarefa que cumpre um prazo pergunta se o prazo foi cumprido (`regras/prazoDaTarefa.ts`, `paginas/situacaoDoItem.tsx`): teste pelos caminhos do ✓ do cartão e do círculo da miniatura.',
      'Tarefa sem demanda vai para a demanda contínua (veja [Demandas](#demandas)). O cronômetro e os registros de tempo estão em [Tempo nas tarefas](#tempo).'
    ]
  },
  {
    id: 'tempo',
    titulo: 'Tempo nas tarefas',
    resumo: 'O cronômetro das tarefas, os registros de tempo (corrigir e apagar) e a página "Meu tempo trabalhado".',
    arquivos: ['TempoNaTarefa', 'MeuTempo', 'useCronometro', 'cronometro', 'cronometros', 'meuTempo', 'registrosDeTempo',
      'meu-tempo', 'registros-de-tempo', 'tempo_nas_tarefas', 'meu_tempo', 'tempo_apagar_e_corrigir'],
    tabelas: ['tarefa_tempos'],
    dados: ['DadosTempo'],
    rotas: ['tarefas/meu-tempo'],
    armadilhas: ['O cronômetro conta em todas as abas do navegador (`ui/cronometros.ts`): teste com duas abas abertas.']
  },
  {
    id: 'processos',
    titulo: 'Processos',
    resumo: 'Os processos (judicial, administrativo, extrajudicial e investigação): o cadastro, o cartão, as partes e recursos, os andamentos e prazos, os campos do escritório e o painel de Processos.',
    arquivos: [
      'Processos', 'NovoProcesso', 'CartaoProcesso', 'CamposDoProcesso', 'PainelProcessos', 'PartesDoProcesso', 'ProcessosDaDemanda', 'ProcessosDaPessoa',
      'ProcessosDoCartao', 'ProcessosRelacionados', 'ContratosDoProcesso', 'prazoDaTarefa', pasta('app/src/paginas/processo'),
      'processo', 'andamentos', 'camposDeProcesso', 'graficosDeProcessos', 'painelProcessos', 'numeroCNJ', 'processoDaDemanda', 'processoPartesERecursos', 'prazoDaTarefa',
      'EscolhaDeProcessos', 'LigarProcesso',
      'processos', 'andamentos-e-comentarios-do-processo', 'mais-no-titulo-das-secoes', 'processo-partes-e-recursos', 'ligar-processo',
      'criar-processo-e-tarefa-ligados', 'prazo-da-tarefa',
      'historico_processos_sem_nome_ordem', 'campos_de_processo', 'andamentos_e_prazos', 'painel_de_processos', 'painel_com_tipo_do_andamento', 'processo_demandas',
      'advogado_entra_no_processo', 'andamentos_tipo_e_comentarios_de_processos', 'colunas_de_acompanhamento_dos_processos', 'ligar_processo_existente',
      'polo_criminal', 'processo_partes_recursos_e_tipos'
    ],
    tabelas: ['processos', 'processo_andamentos', 'processo_campos', 'processo_clientes', 'processo_demandas', 'processo_etiquetas', 'processo_historico',
      'processo_opcoes', 'processo_partes', 'processo_prazos'],
    dados: ['DadosProcessos', 'DadosAcompanhamento'],
    rotas: ['processos', 'processos/judicial', 'processos/administrativo', 'processos/extrajudicial', 'processos/investigacao', 'processos/novo'],
    armadilhas: [
      'Cada tipo tem o seu quadro (rota própria, `key` em `App.tsx`): mudança no quadro vale para os quatro.',
      'A contagem de prazos (dias úteis, feriados) está em [Calendário e prazos](#calendario); a propriedade intelectual, em [Propriedade intelectual](#propriedade-intelectual).'
    ]
  },
  {
    id: 'propriedade-intelectual',
    titulo: 'Propriedade intelectual',
    resumo: 'O processo da área de propriedade intelectual (marca, patente, desenho, direito autoral): os campos da proteção, a validade e os prazos do INPI na agenda.',
    arquivos: ['CamposDaProtecao', 'ValidadeDaProtecao', 'propriedadeIntelectual', 'propriedadeIntelectualNaAgenda',
      'propriedade-intelectual', 'propriedade-intelectual-na-agenda', 'propriedade_intelectual'],
    armadilhas: ['É um processo com campos a mais: as tabelas e as funções de dados são as de [Processos](#processos).']
  },
  {
    id: 'agenda',
    titulo: 'Agenda e compromissos',
    resumo: 'Os compromissos (reuniões, audiências, prazos na agenda): o cadastro, o cartão, a visão por data, os que se repetem (e a demanda que nasce de cada data) e as salas do escritório.',
    arquivos: [
      'Compromissos', 'NovoCompromisso', 'CartaoCompromisso', 'CompromissosDoItem', 'CompromissosLigados', 'ItensDoCompromisso', 'QuandoDoCompromisso',
      'SalasDoEscritorio', pasta('app/src/paginas/agenda'),
      'agenda', 'compromisso', 'repeticao', 'sala', 'demandaDoCompromisso',
      'compromissos', 'compromissos-ligados', 'compromissos-que-se-repetem', 'demanda-do-compromisso', 'salas', 'menu-lateral',
      'compromissos_que_se_repetem', 'repeticao_so_quem_muda_as_datas', 'demandas_dos_compromissos', 'ligacoes_dos_compromissos', 'salas_do_escritorio'
    ],
    tabelas: ['compromissos', 'compromisso_etiquetas', 'compromisso_historico', 'compromisso_ligacoes', 'compromisso_pessoas', 'compromisso_repeticoes', 'salas'],
    dados: ['DadosCompromissos', 'DadosSalas'],
    rotas: ['agenda', 'agenda/novo'],
    armadilhas: [
      'O conflito de horário das salas é conferido no banco e em `regras/sala.ts` (o fictício): mude os dois.',
      'Cada data de um compromisso que se repete é um cartão; só quem pode mudar as datas mexe na repetição (teste do banco `repeticao_so_quem_muda_as_datas`).'
    ]
  },
  {
    id: 'calendario',
    titulo: 'Calendário e prazos',
    resumo: 'O calendário do escritório (feriados, suspensões, órgãos) e a contagem de prazos em dias corridos ou úteis.',
    arquivos: ['Calendario', pasta('app/src/paginas/calendario'), 'calendario', 'prazos', 'calendario_de_prazos'],
    tabelas: ['dias_sem_expediente', 'orgaos'],
    dados: ['DadosCalendario'],
    rotas: ['calendario'],
    armadilhas: ['Os feriados fixos e móveis já vêm prontos em `regras/prazos.ts`; o banco guarda só o que o escritório lançou.']
  },
  {
    id: 'lembretes',
    titulo: 'Prazos, lembretes e e-mails de prazo',
    resumo: 'A hora e o lembrete do prazo de tarefas e demandas, os avisos de prazo na caixa de mensagens e o e-mail diário de prazos.',
    arquivos: ['CamposDoLembrete', 'EmailsDePrazo', 'BotaoDoLembrete', 'lembrete', 'emailsDePrazo', 'prazos-enviar-emails', 'lembretes',
      'avisos_de_prazo', 'lembretes_dos_prazos'],
    tabelas: ['resumos_de_prazos'],
    armadilhas: ['O e-mail sai de uma função do servidor (`prazos-enviar-emails`, Deno); o teste dela fica em `app/src/regras/emailsDePrazo.test.ts`, que importa de `supabase/functions/_compartilhado/`.']
  },
  {
    id: 'documentos',
    titulo: 'Documentos e anotações',
    resumo: 'O módulo Documentos: as anotações em Markdown (editor ao vivo, salva sozinho), as pastas, o explorador e as anotações no cartão de cada item.',
    arquivos: [
      'Documentos', 'CartaoAnotacao', 'AnotacoesDoCartao', 'NovoNaAnotacao', 'nascerNaAnotacao', 'RascunhoDaAnotacao',
      'anotacao', 'anotacaoEmMarkdown', 'aoVivo', 'explorador', 'pastas', 'salvamento', 'novoNaAnotacao',
      'Pastas', 'pastasDoEscritorio', 'LigarItem', 'EditorAoVivo', 'EditorAoVivoCodeMirror', 'EditorDeTexto', 'editorAoVivo',
      'documentos', 'novo-na-anotacao',
      'anotacoes', 'pastas_e_etiquetas_das_anotacoes', 'pastas_das_anotacoes', 'comentarios_das_anotacoes'
    ],
    tabelas: ['anotacoes', 'anotacao_etiquetas', 'anotacao_historico', 'anotacao_ligacoes', 'anotacao_pastas'],
    dados: ['DadosAnotacoes', 'DadosPastas'],
    rotas: ['documentos'],
    armadilhas: ['A anotação nova não é um cadastro: abre em Documentos, na janela da anotação (não entra em `CADASTROS` de `App.tsx`).']
  },
  {
    id: 'financeiro',
    titulo: 'Financeiro',
    resumo: 'O caixa do escritório: entradas e saídas, as contas, o DAS, os sócios, os ajustes de saldo, o painel com os números e gráficos.\n'
      + 'Só administradores. Direitos e obrigações (parcelas) estão em Parcelas e recebimentos.',
    arquivos: ['Financeiro', pasta('app/src/paginas/financeiro'), 'MenuFinanceiro', 'caixa', 'graficosFinanceiros', 'numerosDoFinanceiro', 'painelFinanceiro',
      'financeiro', 'financeiro_caixa', 'ajuste_de_saldo', 'lancamento_da_planilha'],
    tabelas: ['financeiro_contas', 'financeiro_das', 'financeiro_lancamentos', 'financeiro_socios', 'financeiro_ajustes', 'financeiro_historico', 'financeiro_excluidos'],
    dados: ['DadosFinanceiro'],
    rotas: ['financeiro', 'financeiro/saidas', 'financeiro/contas'],
    armadilhas: [
      'Valores em centavos (número inteiro) e datas "aaaa-mm-dd" em todas as regras do financeiro.'
    ]
  },
  {
    id: 'parcelas',
    titulo: 'Parcelas e recebimentos',
    resumo: 'As parcelas dos contratos (Direitos e Obrigações do Financeiro), o recebimento completo, a divisão entre escritório, responsável e indicação, e os repasses.',
    arquivos: [arquivo('app/src/paginas/financeiro/Parcelas'), 'APassar', 'Repasses', 'CorrigirRecebimento', 'parcelas', 'recebimento', arquivo('app/src/regras/financeiro'),
      'financeiro_parcelas', 'financeiro_descontos', 'a_passar_quem_paga', 'quem_recebeu_marca_o_pagamento', 'quem_recebeu_marca', 'parcela_antiga_recebida',
      'corrigir_parcela_importada', 'rapidez_das_parcelas', 'recebimento_completo', 'correcao_de_recebimento'],
    tabelas: ['contrato_parcelas', 'contrato_parcelas_historico', 'financeiro_recebimentos', 'financeiro_repasses', 'financeiro_terceiros_pagos',
      'privado.contratos_com_parcelas', 'privado.socio_do_recebimento'],
    dados: ['DadosParcelas'],
    rotas: ['financeiro/direitos', 'financeiro/obrigacoes'],
    armadilhas: [
      'A divisão de cada recebimento (`regras/financeiro.ts`) foi confirmada pelo escritório com exemplos (`financeiro.test.ts`): mudar uma conta muda Meus valores e Lucros também.',
      'O endereço antigo `/parcelas/` leva a Direitos (`regras/enderecosAntigos.ts`).'
    ]
  },
  {
    id: 'lucros',
    titulo: 'Lucro dos sócios',
    resumo: 'Quanto cada sócio acumulou, retirou e tem em aberto. As funções de dados ficam em `DadosFinanceiro` e `DadosParcelas`.',
    arquivos: ['Lucros', 'lucro', 'lucros', 'financeiro_lucro'],
    tabelas: ['financeiro_retiradas'],
    rotas: ['lucros'],
    armadilhas: ['Só a retirada conta como pagamento do lucro: o repasse entre contas (da PJ para a PF) é transferência (`regras/lucro.ts`).']
  },
  {
    id: 'meus-valores',
    titulo: 'Meus valores',
    resumo: 'A parte de cada pessoa em cada recebimento e os totais por papel (responsável, indicação). As funções de dados ficam em `DadosParcelas`.',
    arquivos: ['MeusValores', 'meusValores', 'meus-valores', 'meus_valores'],
    rotas: ['meus-valores']
  },
  {
    id: 'conferencia',
    titulo: 'Conferência dos lançamentos',
    resumo: 'A conferência dos lançamentos do caixa com a planilha antiga: situações, filtros, totais e a correção de cada linha. As funções de dados ficam em `DadosFinanceiro`.',
    arquivos: ['Conferencia', 'conferencia', 'conferencia_de_lancamentos'],
    tabelas: ['financeiro_conferencia', 'financeiro_conferencia_historico'],
    rotas: ['conferencia']
  },
  {
    id: 'equipe',
    titulo: 'Equipe, grupos e permissões',
    resumo: 'Os usuários do escritório: convites, papel (administrador), função (advogado, administrativo, estagiário), desativar, grupos da equipe, a fase de adaptação (equipe vê tudo)\n'
      + 'e a equipe de cada item (as bolinhas no topo do cartão).',
    arquivos: [
      'Equipe', 'UsuarioDaEquipe', 'GrupoDaEquipe', 'GruposDaEquipe', 'GruposNoTopo', 'EquipeNoTopo', 'equipeNoCartao', 'FaseDeAdaptacao',
      'equipe', 'equipeVeTudo', 'gruposDaEquipe', 'acessoPeloGrupo', 'menuDaBolinha', 'conviteDaPessoa', 'reservaDeConta', 'trocaDeEmail', 'avisoDaTroca',
      'BuscaNaEquipe', 'EscolhaDaEquipe', 'EquipeDoCartao', 'GruposDoItem', 'filtroDeGrupo',
      'equipe-reservar-conta', 'equipe-reenviar-avisos', 'equipe-trocar-email',
      'equipe-no-cartao', 'equipe-ve-tudo', 'grupos-da-equipe', 'convidar-pelo-cartao',
      'convite_seguro', 'funcao_na_equipe', 'trocar_email_pelo_administrador', 'aviso_da_troca_de_email', 'reforco_do_aviso_da_troca', 'correcoes_do_aviso_da_troca',
      'desativar_encerra_as_sessoes', 'desativar_encerra_sessoes', 'reativar_tira_a_senha_de_uso', 'reativar_tira_a_senha', 'conta_reservada', 'equipe_nome',
      'equipe_ve_tudo', 'fase_de_adaptacao', 'excluir_usuario', 'grupos_da_equipe'
    ],
    tabelas: ['perfis', 'convites', 'grupos_da_equipe', 'grupo_integrantes', 'auditoria', 'privado.mudancas_na_equipe'],
    dados: ['DadosEquipe', 'DadosGrupos'],
    rotas: ['equipe'],
    armadilhas: [
      'Função (advogado, administrativo, estagiário) é diferente de papel (administrador): quem não é administrador vê só o que criou ou em que foi posto.',
      'Quem vê e altera cada item é decidido pelas regras RLS do banco; o fictício imita em `falso.ts`. Mudou uma regra de acesso: rode os testes do banco (`supabase test db`).',
      'Trocar o e-mail de alguém e reservar conta passam por funções do servidor (`equipe-trocar-email`, `equipe-reservar-conta`), testadas em `app/src/regras/*.test.ts`.'
    ]
  },
  {
    id: 'perfil',
    titulo: 'Perfil profissional e foto',
    resumo: 'O perfil profissional de cada pessoa da equipe (a base das páginas da equipe no site do escritório) e a foto redonda do perfil.',
    arquivos: ['PerfilProfissional', 'PerfilDaEquipe', 'FotoDoPerfil', 'perfilProfissional', 'foto', 'perfil_profissional', 'foto_do_perfil'],
    tabelas: ['perfil_profissional'],
    dados: ['DadosPerfilProfissional', 'DadosFotos'],
    rotas: ['equipe/perfil'],
    armadilhas: ['O corte redondo e o que é gravado estão em `regras/foto.ts`; o conversor AVIF carrega o próprio .wasm (veja `optimizeDeps` em `vite.config.ts`).']
  },
  {
    id: 'configuracoes',
    titulo: 'Configurações e escritório',
    resumo: 'As Configurações do escritório: os dados e a marca (nome, logomarca, CNPJ), os módulos ligados, o escritório novo e os donos da plataforma.\n'
      + 'Os dados do escritório se gravam por `escritorioSalvar` (em `DadosEquipe`) e chegam às telas no contexto de quem entrou (`contexto`, em `DadosSessao`).',
    arquivos: ['Configuracoes', 'configuracoes', 'marca-do-escritorio', 'identidade_escritorio', 'dono_da_plataforma_ao_cadastrar', 'escritorio_novo'],
    tabelas: ['escritorios', 'plataforma_donos'],
    rotas: ['configuracoes'],
    armadilhas: [
      'O SEMPER é de vários escritórios: nada do primeiro escritório no código; nome e logomarca vêm das Configurações.',
      'As partes das Configurações de outros assuntos (salas, objetos, funções, Google, fase de adaptação) estão nos assuntos deles.'
    ]
  },
  {
    id: 'mensagens',
    titulo: 'Mensagens e avisos',
    resumo: 'A caixa de mensagens de cada pessoa: avisos ao ser incluído num item, ao ser mencionado e os pedidos para participar de um item.',
    arquivos: ['Mensagens', 'mensagens', 'inclusao', 'pedidoDeParticipacao', 'aviso-ao-ser-incluido', 'pedir-para-participar',
      'aviso_ao_ser_incluido', 'pedidos_de_participacao'],
    tabelas: ['mensagens', 'mensagens_de_compromisso', 'mensagens_de_grupo', 'mensagens_de_inclusao', 'mensagens_de_participacao', 'pedidos_de_participacao'],
    dados: ['DadosMensagens', 'DadosPedidos'],
    rotas: ['mensagens'],
    armadilhas: ['Quem recebe cada aviso é decidido no banco (gatilhos); as palavras de cada módulo ficam em `regras/inclusao.ts` e `regras/pedidoDeParticipacao.ts`.']
  },
  {
    id: 'comentarios',
    titulo: 'Comentários e menções',
    resumo: 'Os comentários dos cartões, com menções de pessoas (@) e de itens (!).',
    arquivos: ['Comentarios', 'ComoComentario', 'TextoComMencoes', 'mencoesDeItens', 'comentarios', 'mencoes-de-itens', 'mencoes_sem_revelar'],
    tabelas: ['comentarios'],
    dados: ['DadosComentarios'],
    armadilhas: ['Módulo novo com comentários: entra no tipo `ModuloComentado` (`dados/tipos.ts`) e numa migração que o acrescente à tabela `comentarios`; a menção de um item que a pessoa não vê não revela o nome dele.']
  },
  {
    id: 'etiquetas',
    titulo: 'Etiquetas',
    resumo: 'As etiquetas coloridas do escritório, as mesmas em todos os módulos, com o filtro das páginas de módulo.',
    arquivos: ['Etiquetas', 'etiquetasDoEscritorio', 'etiquetas', 'etiquetas_do_sistema'],
    tabelas: ['etiquetas'],
    dados: ['DadosEtiquetas'],
    armadilhas: ['Cada módulo tem a sua tabela de ligação (`pessoa_etiquetas`, `processo_etiquetas`…): módulo novo = uma linha nova numa migração nova.']
  },
  {
    id: 'ligacoes',
    titulo: 'Ligações entre itens',
    resumo: 'Ligar um item a outro que já existe, criar no cartão um item já ligado (o "+ Novo…" das seções) e como as ligações aparecem no quadro.',
    arquivos: ['CartoesLigados', 'PessoasNosItens', 'ligarNoCartao', 'ItensLigados', 'LigadosNoCadastro', 'LigarDoModulo', 'LigarExistente', 'LigarItem', 'LigarProcesso',
      'ligacoesDoItem', 'ligarExistente', 'nascerLigado', 'origemDoCadastro', 'ligar-existente', 'nascer-ligado-demanda-contrato', 'criar-processo-e-tarefa-ligados',
      'ligar_processo_existente'],
    dados: ['DadosParaLigar'],
    armadilhas: ['A tela lê a lista gravada no item logo antes de gravar (para não apagar a ligação de outra pessoa): siga o mesmo jeito ao ligar um módulo novo.']
  },
  {
    id: 'quadros',
    titulo: 'Quadros (kanban) e situação',
    resumo: 'O quadro kanban comum a todos os módulos: colunas, grupos de colunas, colunas-marco e padrão, arquivados, a Situação do cartão e o concluir pelo círculo.\n'
      + 'Peça comum: mexer aqui muda todos os módulos.',
    arquivos: [pasta('app/src/ui/quadro'), 'situacaoDoItem', 'quadro', 'colunasPadrao', 'conclusaoNoCartao', 'ligacoesDoItem',
      'arquivados', 'colunas-fora-da-tela', 'colunas-padrao', 'grupos-colunas', 'grupos-entre-colunas', 'nome-da-coluna-inteiro', 'nomes-em-maiusculas',
      'concluir-na-miniatura', 'ligacoes-no-quadro',
      'colunas_marco', 'grupos_de_colunas', 'grupos_entre_colunas', 'leitura_rapida_dos_quadros'],
    tabelas: ['quadro_colunas', 'quadro_colunas_ocultas', 'quadro_grupos', 'quadro_sugestoes'],
    dados: ['DadosQuadros'],
    armadilhas: [
      'As colunas-marco têm código fixo (`regras/quadro.ts`): o sistema as acha pelo código, mesmo renomeadas. Coluna padrão nova chega por `regras/colunasPadrao.ts` e migração.',
      'Mudou `Kanban`, `useColunas` ou `PaginaModulo`: rode a bateria completa de telas, não só a deste assunto.'
    ]
  },
  {
    id: 'cartao',
    titulo: 'Cartão dos itens',
    resumo: 'O cartão (painel) de cada item: o topo, a cabeça, as seções que recolhem, o "Acrescentar ao cartão", as datas e a edição no lugar, o histórico e sair do cartão.\n'
      + 'Peça comum: mexer aqui muda os cartões de todos os módulos.',
    arquivos: ['AcoesDoCartao', 'AcrescentarAoCartao', 'CabecaDoCartao', 'EdicaoNoLugar', 'TopoDoCartao', 'registroDeAtalhos', 'sairDoCartao', 'useEdicaoUnica',
      'HistoricoDoCartao', 'atalhosDoCartao', 'datasNoCartao', 'edicaoNoLugar', 'edicaoUnica', 'topoDoCartao', 'secoes',
      'arrumacao-do-cartao', 'atalhos-do-cartao', 'cartao', 'coluna-do-cartao', 'eixo-dos-botoes-do-cartao', 'situacao-e-expandir-tudo', 'topo-do-cartao',
      'datas-nos-cartoes', 'datas', 'novo-padrao-das-secoes', 'sair_do_cartao'],
    armadilhas: ['Toda seção de itens ligados mostra a contagem ao lado do título, mesmo recolhida (`regras/secoes.ts`, `ui/useQuantos.ts`).']
  },
  {
    id: 'busca-geral',
    titulo: 'Busca geral',
    resumo: 'A janela que busca em todos os módulos de uma vez (Ctrl+K ou o botão "Buscar" do menu).',
    arquivos: ['BuscaGeral', 'fontesDaBuscaGeral', 'buscaGeral', 'busca-geral'],
    armadilhas: ['Módulo novo entra na busca por uma fonte em `ui/fontesDaBuscaGeral.ts`.']
  },
  {
    id: 'painel-inicial',
    titulo: 'Painel inicial',
    resumo: 'O Início: os números do dia, os gráficos e as listas (prazos, agenda, tarefas, demandas, processos, anotações, parcelas, pessoas).',
    arquivos: ['Inicio', pasta('app/src/paginas/inicio'), 'painelInicial', 'graficosDoInicio', 'painel-inicial'],
    rotas: ['inicio'],
    armadilhas: ['O painel lê de quase todos os módulos: mudar o formato de uma lista de dados pode quebrar um bloco daqui (`paginas/inicio/fontes.ts`).']
  },
  {
    id: 'conta',
    titulo: 'Entrada e minha conta',
    resumo: 'A tela de entrada (login, primeiro acesso por convite, nova senha), a verificação em duas etapas, a troca do e-mail de acesso, sair e a sessão encerrada em outro lugar.',
    arquivos: ['Entrada', 'MinhaConta', 'conta', 'vigiaDaSessao', 'avisoDaTroca', 'trocaDeEmail', 'entrada', 'entrada-paineis', 'perfil',
      'duas_etapas', 'sessao_encerrada_corta_o_acesso', 'sessao_encerrada', 'excluir_conta'],
    dados: ['DadosSessao', 'DadosDuasEtapas'],
    rotas: ['entrar', 'minha-conta'],
    armadilhas: ['A tela de entrada é sempre clara, qualquer que seja o tema. Os e-mails de prazo de Minha conta estão em [Prazos, lembretes e e-mails de prazo](#lembretes).']
  },
  {
    id: 'portal',
    titulo: 'Página pública',
    resumo: 'A página pública do SEMPER (rota "/"): a apresentação a outros escritórios e o pedido de demonstração.',
    arquivos: ['Home', 'paginaPublica', 'pagina-publica'],
    rotas: ['/'],
    armadilhas: ['As imagens da página são telas reais do banco fictício: só dados inventados.']
  },
  {
    id: 'importacao',
    titulo: 'Importação',
    resumo: 'Importar pessoas de um arquivo CSV (Pessoas > ⋯ > Importar pessoas) e a ferramenta que converte a planilha antiga do site para o SEMPER.',
    arquivos: ['ImportarPessoas', pasta('app/src/paginas/importarPessoas'), 'importacao', 'gravacaoDaImportacao', pasta('app/ferramentas/planilha-do-site'),
      'importar_pessoas'],
    tabelas: ['importacoes'],
    dados: ['DadosImportacao'],
    rotas: ['pessoas/importar'],
    armadilhas: ['Nunca dado real de cliente no repositório: os testes da planilha usam só nomes fictícios (`planilha-do-site/ficticios.ts`).']
  },
  {
    id: 'google',
    titulo: 'Conta Google e contatos',
    resumo: 'A ligação da conta Google do escritório (em Configurações) e a sincronização das pessoas com o Google Contatos, com a lista "Para conferir".',
    arquivos: ['LigacaoGoogle', 'SincronizacaoDosContatos', 'ContatosParaConferir', 'contatosGoogle', 'correspondenciaDeContatos', 'ligacaoGoogle',
      'sincronizacaoDeContatos', 'sincronizacaoGoogle', 'ligacao', /^supabase\/functions\/google-/, 'ligacao_google', 'contatos_google', 'contatos_google_primeira'],
    tabelas: ['contatos_google', 'contatos_google_conferir', 'contatos_google_fila', 'privado.ligacoes', 'privado.ligacao_pedidos'],
    dados: ['DadosLigacoes'],
    armadilhas: ['As regras de quem é cada contato ficam no servidor (`supabase/functions/_compartilhado/correspondenciaDeContatos.ts`); os testes, em `app/src/regras/`.']
  },
  {
    id: 'novidades',
    titulo: 'Novidades e versão',
    resumo: 'As novidades de cada versão (o botão do menu lateral) e o aviso de versão nova para a aba aberta antes de uma publicação.',
    arquivos: ['Novidades', 'versaoNova', 'novidades', 'versao'],
    armadilhas: ['Cada novidade é um JSON em `app/novidades/proxima/` (titulo, texto, ondeAchar); o número e a data da versão entram sozinhos ao publicar.']
  },
  {
    id: 'ajuda',
    titulo: 'Ajuda e atalhos',
    resumo: 'A ajuda de cada tela de módulo (o botão "?") e os atalhos de teclado ("/" busca, "N" novo, "?" ajuda).',
    arquivos: ['ajuda', 'atalhos'],
    armadilhas: ['Módulo novo com página de módulo ganha os textos de ajuda em `regras/ajuda.ts`.']
  }
];
