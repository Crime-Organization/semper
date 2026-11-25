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
  /** O que costuma dar errado ou precisa mudar junto. Caminho citado entre crases ("`regras/quadro.ts`") precisa existir. */
  armadilhas?: string[];
  /**
   * Testes de outros assuntos que uma mudança neste costuma quebrar (mesmo jeito de "arquivos"): entram só nos comandos de
   * testes deste assunto, não nas listas.
   */
  testes?: Padrao[];
  /** Um texto que, achado numa migração, a põe no assunto, com o teste do banco de mesmo nome (ex.: as rotinas do pg_cron). */
  conteudo?: RegExp;
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
    'Paginacao', 'PainelCartao', 'Recolhivel', 'SubmenuLateral', 'abrirItem', 'arrastar', 'avisos', 'barraDeRolagem',
    'janela', 'loja', 'ordem', 'preferencias', 'rolagem', 'sessao', 'tema', 'tempos', 'useCartaoNaUrl', 'useParametroLido', 'useQuantos',
    'useSelecao', 'util',
    'texto', 'csv', 'formatacao', 'fuso', 'tituloDaAba', 'enderecosAntigos', 'qualBanco', 'campoData', 'escalaDosGraficos', 'filtroDoPainel',
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
    'Mudou como algo se grava? A versão anterior do site (e quem chama a API direto) continua gravando do jeito antigo: um gatilho converte ou recusa, e o teste do banco testa o caminho antigo (ex.: o gatilho `exclusao_direta` da migração `contrato_exclui_em_cascata`).',
    'Regra que está no banco (gatilho ou função da migração) e numa regra de `regras/` que o `falso.ts` usa: mude as duas, e cada caso do teste do banco ganha o caso igual em `dados/contrato.test.ts`.',
    'Restrição nova no banco (check, raise) ganha a frase em português em `dados/erros.ts`, reaproveitando a da regra.',
    '`PaginaModulo`, `ui/base`, `PainelCartao`, `SecaoArquivados`, `estilo.css` e `ui/quadro` afetam todos os módulos: depois de mexer, rode a bateria completa de telas.',
    'Campo novo num tipo de lista (`TarefaLista`, `CompromissoLista`…, em `dados/tipos.ts`) quebra os testes que montam a lista à mão (ex.: `paginas/Inicio.test.tsx`): procure o tipo nos *.test.tsx.',
    'Lista do escritório lida em todas as telas (etiquetas, funções da tarefa): carrega em `ui/sessao.tsx` (`iniciarEtiquetas`, `iniciarFuncoes`).',
    'Contas de datas aaaa-mm-dd (`somarDias`, `diasEntre`, `DIAS_NA_SEMANA`) ficam em `regras/prazos.ts`, que não depende de nenhum módulo: use dali, não recrie.',
    'O fuso do escritório (`FUSO_DO_ESCRITORIO`, `diaNoEscritorio`) fica em `regras/fuso.ts`, que não depende de nenhum módulo: importe dali, e não de `regras/compromisso.ts`.',
    'Endereço que sai ou muda: veja [Rotas e endereços](#rotas) (quem escreve o endereço, como `regras/painelInicial.ts` e `e2e/ajudantes.ts`, e os testes que vão direto a ele) e ponha o antigo em `regras/enderecosAntigos.ts`. Cadastro novo em janela: a tabela `CADASTROS` de `App.tsx`.',
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
      'BuscaPessoa', 'consultas', 'planilhaAntiga', 'consentimentoSemData', 'consentimento-sem-data',
      'pessoas', 'responsaveis-da-pessoa', 'nova-pessoa-no-cartao', 'planilha-provisoria', 'convidar-pelo-cartao', arquivo('app/e2e/quadro'), 'novo-padrao-das-secoes',
      'exportacoes', 'lgpd_exclusao', 'cnpj_com_letras'
    ],
    tabelas: ['pessoas', 'pessoa_historico', 'pessoa_responsaveis', 'pessoa_sigilos', 'pessoa_sigilo_acessos', 'pessoa_vinculos', 'vinculo_tipos'],
    dados: ['DadosPessoas', 'DadosSigilo', 'DadosVinculos'],
    rotas: ['pessoas', 'pessoas/nova'],
    armadilhas: [
      'A validação de cada etapa do cadastro é a tabela `VALIDACAO` de `regras/cadastro.ts` (e `AO_ENTRAR`); etapa nova = entrada nova, um componente em `paginas/novaPessoa/etapas.tsx`.',
      'Pessoa repetida se acha pelo CPF/CNPJ (`pessoaPorDocumento`) e, sem documento, pelos telefones (`pessoasPorTelefones`).',
      '`improvisos/planilhaAntiga.ts` (PROVISORIO-219) manda as pessoas novas também para a planilha antiga; sai com o `e2e/planilha-provisoria.spec.ts`.',
      'Excluir pessoa apaga o nome do registro de ações (LGPD, `lgpd_exclusao`; veja [Registro de ações e LGPD](#registro)): não guarde nome de pessoa em outro lugar sem pensar na exclusão.',
      'O consentimento sem data (#409): a marca `consentimento_sem_data` do filtro "Situação do cadastro" (tabela `MARCAS` em `supabase.ts`, `falso.ts` e `paginas/Pessoas.tsx`) e a contagem `pessoasSemDataDoConsentimento`, do aviso do Início; os textos e o link ficam em `regras/consentimentoSemData.ts`. A contagem na produção (só números) é o roteiro docs/plataforma/consentimento-sem-data.md.'
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
      arquivo('app/src/regras/contrato'), 'contratoAbreDemandas', 'arquivarContrato', 'exclusaoDoContrato',
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
      'Arquivar vários de uma vez é um update só no banco, e os gatilhos rodam com todos já arquivados: o `falso.ts` precisa gravar todos antes da cascata.',
      'Uma tarefa pode ter vários contratos e demandas (`tarefa_contratos` e `tarefa_demandas`, de [Tarefas](#tarefas)): conte cada tarefa uma vez só, com a lista inteira.',
      'A cascata não leva a demanda contínua, e a tarefa avulsa ligada ao contrato volta para ela (leia a coluna `demandas.continua` de verdade; veja [Demandas](#demandas)): testes `contrato_cascata_com_a_continua` (banco) e `e2e/contrato-arquiva-em-cascata.spec.ts`.',
      'A cópia escondida do que saiu (`financeiro_excluidos`) precisa guardar o que Lucros e Meus valores leem, como o sócio do recebimento (`privado.socio_do_recebimento`).',
      'O Excluir do ⋯ e a pergunta própria do contrato passam pelo cartão (`ui/TopoDoCartao.tsx`, `ui/AcoesDoCartao.tsx`, o texto do arquivado em `regras/topoDoCartao.ts`; veja [Cartão dos itens](#cartao)) e pela seção Arquivados (`perguntarAntesDeExcluir` em `ui/SecaoArquivados.tsx`; veja [Quadros](#quadros)).',
      'O resumo da exclusão no registro de ações: `detalheDaExclusaoDoContrato`, na tabela `DETALHES` de `paginas/Equipe.tsx` (veja [Registro de ações e LGPD](#registro)).',
      'Os valores do contrato só aparecem para quem é parte quando a chave do escritório está ligada (`contratoVer`, Equipe vê tudo).',
      'Parcelas e recebimentos do contrato estão em [Parcelas e recebimentos](#parcelas); objetos, em [Objetos de contrato](#objetos).'
    ],
    testes: ['SecaoArquivados', 'topo-do-cartao', 'arquivados', arquivo('app/e2e/equipe')]
  },
  {
    id: 'objetos',
    titulo: 'Objetos de contrato',
    resumo: 'Os objetos (o que o contrato cobre), a lista do escritório nas Configurações (corrigir, juntar parecidos, separar em dois ou mais) e a demanda que nasce de cada objeto.\n'
      + 'As funções de dados ficam em `DadosContratos` (veja Contratos).',
    arquivos: ['ObjetosDeContrato', 'objetos', 'objetos-de-contrato', 'objetos-sem-demanda', 'contrato_objetos', 'demandas_dos_objetos', 'objetos_sem_demanda',
      'editar_objetos_de_contrato', arquivo('supabase/migrations/20261027000017_demandas'), 'modelos_de_lista', 'cliente_ao_contrato', 'contrato_abre_demandas',
      'contratoAbreDemandas', 'contrato-abre-demandas', 'cliente-ao-contrato', 'ModelosDeLista', 'SepararObjeto', 'separar_objeto', 'separar-objeto'],
    tabelas: ['objeto_sugestoes', 'lista_modelos'],
    armadilhas: [
      'Juntar dois objetos muda todos os contratos que usam o de origem: confira o aviso de uso (`regras/objetos.ts`) e o teste do banco `editar_objetos_de_contrato`.',
      'Separar (#410) exige a escolha do objeto novo de cada demanda do objeto (o banco recusa se faltar) e não cria demanda: o objeto novo sem demanda num contrato assinado ganha a sua pelo cartão do contrato. Teste do banco: `separar_objeto`.',
      '"A definir" é um objeto fixo, criado pelo cliente fechado (migração `cliente_ao_contrato`): não aparece na lista, não se corrige, não se junta nem se apaga.',
      'Mudar o array `contratos.objetos` dispara o gatilho `privado.demandas_do_contrato` (migrações `demandas`, `demandas_dos_objetos`, `cliente_ao_contrato` e `objetos_sem_demanda`): corrigir um nome não pode fazer nascer demanda em contrato assinado.',
      'O modelo de checklist se liga ao objeto pelo nome (`lista_modelos.nome`; veja [Checklists e modelos](#listas)): juntar ou corrigir objetos deixa modelos com nome que nenhum objeto usa.'
    ]
  },
  {
    id: 'demandas',
    titulo: 'Demandas',
    resumo: 'As demandas (o trabalho de um caso, com prazo e fases): o cadastro, o cartão, demandas relacionadas e a demanda contínua, que junta as tarefas avulsas.',
    arquivos: [
      'Demandas', 'NovaDemanda', 'NovaDemandaPelaOrigem', 'CartaoDemanda', 'DemandasRelacionadas', 'concluirDemanda', 'CartoesLigados',
      'demanda', 'demandaContinua', 'demandasRelacionadas', 'demandaDoCompromisso', 'dataDeInicio', 'ordemPorPrazo', 'filtroDoInicio',
      'demandas', 'demandas-relacionadas', 'demanda-continua',
      'demanda_continua', 'demandas_continuas_do_escritorio', 'grupo_com_demanda_continua', 'filtro_de_grupo_pelas_demandas_do_escritorio', 'demandas_relacionadas', 'data_de_inicio'
    ],
    tabelas: ['demandas', 'demanda_clientes', 'demanda_historico', 'demandas_relacionadas'],
    dados: ['DadosDemandas'],
    rotas: ['demandas', 'demandas/nova'],
    armadilhas: [
      'A ordem pelo prazo (`regras/ordemPorPrazo.ts`) é a mesma no banco de verdade e no fictício: mude os dois.',
      'A demanda contínua é criada pelo banco (uma por grupo da equipe e uma geral); não a crie pela tela.',
      'A contínua é especial em todo lugar que lista, liga ou conclui demandas: `ehContinua` em `paginas/concluirDemanda.ts` (nunca se conclui), `regras/ligarExistente.ts` e `paginas/ligarNoCartao.ts` (desfazer a ligação devolve a tarefa a ela) e `demandasParaLigar` em `supabase.ts` (uma por grupo, todas contam). Veja [Ligações entre itens](#ligacoes).',
      'Arquivar ou excluir contrato em cascata não leva a contínua, e a tarefa avulsa ligada ao contrato volta para ela: teste do banco `contrato_cascata_com_a_continua` e `e2e/contrato-arquiva-em-cascata.spec.ts` (veja [Contratos](#contratos)).',
      'Checklists da demanda estão em [Checklists e modelos](#listas).',
      'O filtro "Grupo da equipe" (e a opção "Geral") traz a contínua do grupo e as tarefas dela, pela contínua e não pelos grupos (ela não tem grupos): `pedidoDoFiltroDeGrupo` e `entraNoPedido` em `regras/gruposDaEquipe.ts`, `porGrupo` e `deTarefas` em `supabase.ts` e `public.tarefas_do_filtro_de_grupo` (migrações `grupo_com_demanda_continua` e `filtro_de_grupo_pelas_demandas_do_escritorio`). Os ids das demandas pedidas (as do grupo e as contínuas) vêm de `privado.demandas_do_filtro`, que não passa pelas regras de leitura das demandas: quem vê a tarefa a vê pelo filtro mesmo sem ver a demanda, como `daTarefaNoGrupo` em `falso.ts`.'
    ],
    testes: ['ligar-existente', 'tarefa-em-varias-ligacoes', 'contrato-arquiva-em-cascata', 'contrato_cascata_com_a_continua', 'ligarExistente']
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
    armadilhas: [
      'As tabelas se chamam `demanda_listas…`, mas valem também para tarefas e contratos (coluna do cartão).',
      'O nome do modelo é o nome do objeto de contrato que ele acompanha (`lista_modelos.nome`; veja [Objetos de contrato](#objetos)).'
    ]
  },
  {
    id: 'tarefas',
    titulo: 'Tarefas',
    resumo: 'As tarefas: o cadastro, o cartão, as funções dos participantes (só "Executa" de fábrica; o participante pode ficar sem função), a aprovação interna, a diligência, copiar para outra demanda e o prazo do processo que a tarefa cumpre.',
    arquivos: [
      'Tarefas', 'NovaTarefa', 'CartaoTarefa', 'TarefasDaDemanda', 'AprovacaoDaTarefa', 'FuncoesDosParticipantes', 'copiarTarefa', 'prazoDaTarefa',
      'tarefa', 'aprovacaoDaTarefa', 'copiaDaTarefa', 'funcoesNaTarefa', 'dataDeInicio', 'ordemPorPrazo', 'filtroDoInicio', 'CartoesLigados',
      'tarefas', 'copiar-tarefa', 'tarefa-aprovacao', 'tarefa-em-varias-ligacoes', 'tarefa-pedido', 'prazo-da-tarefa', 'demanda-continua',
      /^supabase\/(migrations|tests)\/(\d{14}_)?tarefa_/, 'colunas_de_espera_das_tarefas', 'data_de_inicio', 'funcoes_so_executa_de_fabrica'
    ],
    tabelas: ['tarefas', 'tarefa_pessoas', 'tarefa_historico', 'tarefa_demandas', 'tarefa_contratos', 'funcoes_na_tarefa'],
    dados: ['DadosTarefas', 'DadosFuncoesNaTarefa'],
    rotas: ['tarefas', 'tarefas/nova'],
    armadilhas: [
      'Concluir a tarefa que cumpre um prazo pergunta se o prazo foi cumprido (`regras/prazoDaTarefa.ts`, `paginas/situacaoDoItem.tsx`): teste pelos caminhos do ✓ do cartão e do círculo da miniatura.',
      'Tarefa sem demanda vai para a demanda contínua (veja [Demandas](#demandas)). O cronômetro e os registros de tempo estão em [Tempo nas tarefas](#tempo).',
      'A função de cada participante aparece e se troca nas bolinhas do topo do cartão (`ui/TopoDoCartao.tsx`, de [Cartão](#cartao); as bolinhas são de [Equipe](#equipe): `ui/EquipeDoCartao.tsx`, `paginas/EquipeNoTopo.tsx`, `paginas/equipeNoCartao.ts`, `regras/equipeNoCartao.ts`) e no cadastro (`ui/EscolhaDaEquipe.tsx`, `ui/BuscaNaEquipe.tsx`). A lista de funções se edita nas Configurações (`FuncoesDosParticipantes`, em `paginas/Configuracoes.tsx`) e carrega em `ui/sessao.tsx` (`iniciarFuncoes`). Ninguém ganha função sozinho (#421): o banco (`preparar_pedido_da_tarefa`), `falso.ts` e `regras/funcoesNaTarefa.ts` (`funcoesAoGravar`) mudam juntos.',
      'O nome das bolinhas e os títulos das seções do cadastro e da edição da tarefa são lidos por testes de Equipe, Mensagens e Processos (já no comando abaixo).',
      'Estado novo da tarefa = coluna reconhecida pelo sistema: `regras/quadro.ts` (`COLUNA_DE_APROVACAO`, `explicacaoDaColuna`), `regras/colunasPadrao.ts`, `ui/quadro/Kanban.tsx` e `paginas/situacaoDoItem.tsx` (veja [Quadros](#quadros)); mexeu no Kanban, rode a bateria completa.',
      'A aprovação está no banco, em `falso.ts` e em `dados/contrato.test.ts`: mude os três juntos. Regra que vale para quem executa ou para quem pede: teste também o administrador (que pela RLS altera tudo) e quem só altera a tarefa (veja [Equipe](#equipe)).',
      'A devolução grava um comentário: a seção de comentários (`ui/Comentarios.tsx`, de [Comentários e menções](#comentarios)) relê a lista pela `versao`.',
      'Os avisos ao solicitante e a quem executa (#415) são de [Mensagens e avisos](#mensagens): trocar o solicitante, a chegada à coluna de aprovação e a devolução (`public.tarefa_devolver`) avisam pelo banco (`20261124033230_avisos_da_tarefa.sql`) e por `falso.ts` (`regras/avisosDaTarefa.ts`); mude os três juntos.'
    ],
    testes: ['equipe-no-cartao', 'aviso-ao-ser-incluido', 'avisos-da-tarefa', 'avisosDaTarefa', 'avisos_da_tarefa', 'ligar-processo', 'Inicio', 'colunas-padrao', 'colunasPadrao', arquivo('app/src/regras/quadro'), 'grupo_com_demanda_continua', 'grupos-da-equipe']
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
    resumo: 'Os processos de cada tipo (`TIPOS_PROCESSO`, em `regras/processo.ts`): o cadastro, o cartão, as partes e recursos, os andamentos e prazos, os campos do escritório e o painel de Processos.',
    arquivos: [
      'Processos', 'NovoProcesso', 'CartaoProcesso', 'CamposDoProcesso', 'PainelProcessos', 'PartesDoProcesso', 'ProcessosDaDemanda', 'ProcessosDaPessoa',
      'ProcessosDoCartao', 'ProcessosRelacionados', 'ContratosDoProcesso', 'prazoDaTarefa', pasta('app/src/paginas/processo'),
      'processo', 'andamentos', 'camposDeProcesso', 'graficosDeProcessos', 'painelProcessos', 'numeroCNJ', 'processoDaDemanda', 'processoPartesERecursos', 'prazoDaTarefa',
      'EscolhaDeProcessos', 'LigarProcesso',
      'processos', 'dados-do-processo-na-secao', 'andamentos-e-comentarios-do-processo', 'mais-no-titulo-das-secoes', 'processo-partes-e-recursos', 'ligar-processo',
      'criar-processo-e-tarefa-ligados', 'prazo-da-tarefa',
      'historico_processos_sem_nome_ordem', 'campos_de_processo', 'andamentos_e_prazos', 'painel_de_processos', 'painel_com_tipo_do_andamento', 'processo_demandas',
      'advogado_entra_no_processo', 'andamentos_tipo_e_comentarios_de_processos', 'colunas_de_acompanhamento_dos_processos', 'ligar_processo_existente',
      'polo_criminal', 'processo_partes_recursos_e_tipos', 'investigacaoNoAdministrativo', 'investigacao_no_processo_administrativo', 'papel_do_cliente',
      'processoJudicialDoAdministrativo', 'processo_judicial_do_administrativo', 'processo-judicial-do-administrativo'
    ],
    tabelas: ['processos', 'processo_andamentos', 'processo_campos', 'processo_clientes', 'processo_demandas', 'processo_etiquetas', 'processo_historico',
      'processo_opcoes', 'processo_partes', 'processo_prazos'],
    dados: ['DadosProcessos', 'DadosAcompanhamento'],
    rotas: ['processos', 'processos/judicial', 'processos/administrativo', 'processos/novo'],
    armadilhas: [
      'Cada tipo tem o seu quadro (rota própria, `key` em `App.tsx`): mudança no quadro vale para todos os tipos de `TIPOS_PROCESSO`.',
      'Tipo de processo novo ou que sai: `TIPOS_PROCESSO` (`regras/processo.ts`), as rotas em `App.tsx`, os links em `ui/Casca.tsx`, os grupos em `regras/buscaGeral.ts`, `ui/BuscaGeral.tsx` (`ICONE_DO_GRUPO`) e `ui/fontesDaBuscaGeral.ts`, `ONDE_APARECE` em `regras/camposDeProcesso.ts`, `regras/graficosDeProcessos.ts`, `regras/ajuda.ts` e `regras/enderecosAntigos.ts` (veja [Rotas e endereços](#rotas)).',
      'Colunas novas num quadro que já existe: o escritório pode ter renomeado colunas e grupos ou deixado um grupo vazio (ou o quadro não ter grupos); ache pelo código fixo (`regras/quadro.ts`) e siga `regras/colunasPadrao.ts` (o precedente é `COLUNAS_NOVAS_DOS_PROCESSOS`, #315; veja [Quadros](#quadros)).',
      'Conversão que está na migração e numa regra que o `falso.ts` usa (como o grupo da fase e a coluna equivalente): mude as duas, com o mesmo caso no teste do banco e no `dados/contrato.test.ts`.',
      'A contagem de prazos (dias úteis, feriados) está em [Calendário e prazos](#calendario); a propriedade intelectual, em [Propriedade intelectual](#propriedade-intelectual).'
    ],
    testes: ['buscaGeral', 'BuscaGeral', 'enderecosAntigos', 'busca-geral', 'menu-lateral', 'ajuda', 'colunas-padrao', 'propriedade-intelectual', 'colunasPadrao']
  },
  {
    id: 'propriedade-intelectual',
    titulo: 'Propriedade intelectual',
    resumo: 'O processo administrativo (no INPI) da área de propriedade intelectual (marca, patente, desenho, direito autoral): os campos da proteção,\n'
      + 'os papéis titular e inventor nas partes, a validade e os prazos do INPI na agenda.',
    arquivos: ['CamposDaProtecao', 'ValidadeDaProtecao', 'propriedadeIntelectual', 'propriedadeIntelectualNaAgenda',
      'propriedade-intelectual', 'propriedade-intelectual-na-agenda', 'propriedade_intelectual',
      'propriedadeIntelectualDiasUteis', 'propriedade-intelectual-deferimento', 'papeis_e_deferimento_da_pi', 'ordem_do_deferimento_da_pi', 'area_com_papeis_da_pi', 'useCalendarioDoInpi',
      'processo', 'CartaoProcesso', 'NovoProcesso', 'PartesDoProcesso'],
    armadilhas: [
      'É um processo com campos a mais: as tabelas, as funções de dados e as telas são as de [Processos](#processos) (área `AREA_DA_PI`; campos e validação em `regras/processo.ts`; papéis em `paginas/PartesDoProcesso.tsx`).',
      'Os campos de PI e a validade são só do administrativo (`temProtecao`, #425): no judicial, o banco (gatilho `judicial_sem_protecao`) e o `falso.ts` os deixam vazios; o judicial da área liga-se ao administrativo inteiro, em Processos relacionados.',
      'O "Acompanhar na agenda" preenche o cadastro do compromisso que se repete (`compromissoRepetir`, `paginas/NovoCompromisso.tsx`; veja [Agenda e compromissos](#agenda)).',
      'A ordem das datas (a concessão depois do depósito; a publicação do deferimento entre os dois, #418) é conferida no banco e no `falso.ts`; as frases (`ORDEM_DAS_DATAS`, em `regras/propriedadeIntelectual.ts`) traduzem os erros do banco em `dados/erros.ts`.',
      'Os prazos de PI em dias contam só os dias úteis do INPI (#418): o órgão INPI de Feriados e prazos, lido por `paginas/processo/useCalendarioDoInpi.ts` e passado às contas (`CalendarioDoInpi`); sem ele, os feriados nacionais. Os papéis de PI fora da área são recusados no banco (gatilho `papel_so_da_pi`) e no `falso.ts`, com a frase `PAPEL_SO_DA_PI`; e o processo com esses papéis não sai da área (gatilho `area_com_papeis_da_pi`, regra `areaPodeMudar`, frase `PAPEIS_DA_PI_NA_TROCA_DE_AREA`).',
      'Os compromissos dos prazos do INPI são achados pelo título (`compromissoDoAcompanhamento`): mudar o título muda o que o cartão reconhece; o "Atualizar as datas na agenda" usa `compromissoMudarSeguintes` na série e `compromissoAtualizar` no compromisso só, e só aparece se o histórico do processo tem o depósito, o deferimento ou a concessão mudados depois do `atualizado_em` do compromisso (`datasMudaramDepois`).'
    ],
    testes: ['processos', 'processo-partes-e-recursos', 'compromissos-que-se-repetem', 'repeticao']
  },
  {
    id: 'agenda',
    titulo: 'Agenda e compromissos',
    resumo: 'Os compromissos (reuniões, audiências, prazos na agenda): o cadastro, o cartão, a visão por data, os que se repetem (e a demanda que nasce de cada data) e as salas do escritório.',
    arquivos: [
      'Compromissos', 'NovoCompromisso', 'CartaoCompromisso', 'CompromissosDoItem', 'CompromissosLigados', 'ItensDoCompromisso', 'QuandoDoCompromisso',
      'SalasDoEscritorio', pasta('app/src/paginas/agenda'),
      'agenda', 'compromisso', 'repeticao', 'sala', 'demandaDoCompromisso',
      'compromissos', 'compromissos-ligados', 'compromissos-que-se-repetem', 'repeticao-no-cartao', 'demanda-do-compromisso', 'salas', 'menu-lateral',
      'compromissos_que_se_repetem', 'repeticao_so_quem_muda_as_datas', 'campos_das_seguintes', 'modelo_das_datas_novas', 'demandas_dos_compromissos', 'ligacoes_dos_compromissos', 'salas_do_escritorio'
    ],
    tabelas: ['compromissos', 'compromisso_etiquetas', 'compromisso_historico', 'compromisso_ligacoes', 'compromisso_pessoas', 'compromisso_repeticoes', 'salas'],
    dados: ['DadosCompromissos', 'DadosSalas'],
    rotas: ['agenda', 'agenda/novo'],
    armadilhas: [
      'O conflito de horário das salas é conferido no banco e em `regras/sala.ts` (o fictício): mude os dois.',
      'Cada data de um compromisso que se repete é um cartão; só quem pode mudar as datas mexe na repetição (teste do banco `repeticao_so_quem_muda_as_datas`).',
      'O `falso.ts` reescreve à mão as regras da série (repetir, mudar "esta e as seguintes" a data e o horário ou o título, o local, a equipe e as pessoas, arquivar as seguintes, só a próxima data no quadro): cada caso do teste do banco precisa do caso igual em `dados/contrato.test.ts`.',
      'A demanda que nasce de cada data avisa o responsável: o aviso aparece em `paginas/Mensagens.tsx` (`ItemDaDemandaDoCompromisso`; veja [Mensagens e avisos](#mensagens)).',
      'As datas seguintes e as demandas de cada data também nascem de rotinas do banco, sem ninguém logado (veja [Rotinas automáticas](#rotinas)). As contas de datas ficam em `regras/prazos.ts`.'
    ],
    testes: ['mensagens', 'Mensagens']
  },
  {
    id: 'calendario',
    titulo: 'Calendário e prazos',
    resumo: 'O calendário do escritório (feriados, suspensões, órgãos) e a contagem de prazos em dias corridos ou úteis.',
    arquivos: ['Calendario', pasta('app/src/paginas/calendario'), 'calendario', 'prazos', 'calendario_de_prazos'],
    tabelas: ['dias_sem_expediente', 'orgaos'],
    dados: ['DadosCalendario'],
    rotas: ['calendario'],
    armadilhas: [
      'Os feriados fixos e móveis já vêm prontos em `regras/prazos.ts`; o banco guarda só o que o escritório lançou.',
      '`regras/prazos.ts` não depende de nenhum módulo (Agenda e Propriedade intelectual importam dele `somarDias`, `diasEntre` e `DIAS_NA_SEMANA`): não importe um módulo dali, para não criar importação circular.'
    ],
    testes: ['agenda', 'repeticao', 'propriedadeIntelectualNaAgenda']
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
      'financeiro', 'financeiro_caixa', 'ajuste_de_saldo', 'lancamento_da_planilha', 'recebimentosExcluidos', 'recebimentos-excluidos', 'recebimentos_excluidos'],
    tabelas: ['financeiro_contas', 'financeiro_das', 'financeiro_lancamentos', 'financeiro_socios', 'financeiro_ajustes', 'financeiro_historico', 'financeiro_excluidos'],
    dados: ['DadosFinanceiro'],
    rotas: ['financeiro', 'financeiro/saidas', 'financeiro/contas'],
    armadilhas: [
      'Valores em centavos (número inteiro) e datas "aaaa-mm-dd" em todas as regras do financeiro.',
      'O Hub e as abas (`paginas/financeiro/Hub.tsx`, `paginas/financeiro/AbasDoFinanceiro.tsx` e `TELAS_DO_FINANCEIRO` de `e2e/ajudantes.ts`) abrem Parcelas, Lucros, Meus valores e Conferência: mexeu no Hub ou nos endereços, rode os testes dessas telas (já no comando abaixo) e veja [Rotas e endereços](#rotas).'
    ],
    testes: ['parcelas', 'lucros', 'meus-valores', 'conferencia', 'contrato-exclui-em-cascata', 'topo-do-cartao', 'mais-no-titulo-das-secoes']
  },
  {
    id: 'parcelas',
    titulo: 'Parcelas e recebimentos',
    resumo: 'As parcelas dos contratos (Direitos e Obrigações do Financeiro), o recebimento completo, a divisão entre escritório, responsável e indicação, e os repasses.',
    arquivos: [arquivo('app/src/paginas/financeiro/Parcelas'), arquivo('app/src/paginas/financeiro/Hub'), 'AbasDoFinanceiro', 'APassar', 'Repasses', 'CorrigirRecebimento', 'parcelas', 'recebimento', arquivo('app/src/regras/financeiro'),
      'financeiro_parcelas', 'financeiro_descontos', 'a_passar_quem_paga', 'quem_recebeu_marca_o_pagamento', 'quem_recebeu_marca', 'parcela_antiga_recebida',
      'corrigir_parcela_importada', 'rapidez_das_parcelas', 'recebimento_completo', 'correcao_de_recebimento'],
    tabelas: ['contrato_parcelas', 'contrato_parcelas_historico', 'financeiro_recebimentos', 'financeiro_repasses', 'financeiro_terceiros_pagos',
      'privado.contratos_com_parcelas', 'privado.socio_do_recebimento'],
    dados: ['DadosParcelas'],
    rotas: ['financeiro/direitos', 'financeiro/obrigacoes'],
    armadilhas: [
      'A divisão de cada recebimento (`regras/financeiro.ts`) foi confirmada pelo escritório com exemplos (`financeiro.test.ts`): mudar uma conta muda Meus valores e Lucros também.',
      'O endereço antigo `/parcelas/` leva a Direitos (`regras/enderecosAntigos.ts`). Direitos e Obrigações são abas do Hub do Financeiro (`paginas/financeiro/Hub.tsx`, `paginas/financeiro/AbasDoFinanceiro.tsx`).',
      'O excluir contrato em cascata vai a Obrigações e usa a tabela Repasses (`e2e/contrato-exclui-em-cascata.spec.ts`, já no comando abaixo).'
    ],
    testes: ['contrato-exclui-em-cascata', 'topo-do-cartao', 'mais-no-titulo-das-secoes', 'financeiro', 'lucros', 'meus-valores']
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
      + 'e a equipe de cada item (as bolinhas no topo do cartão). O registro de ações, também nesta tela, está em Registro de ações e LGPD.',
    arquivos: [
      'Equipe', 'UsuarioDaEquipe', 'GrupoDaEquipe', 'GruposDaEquipe', 'GruposNoTopo', 'EquipeNoTopo', 'equipeNoCartao', 'FaseDeAdaptacao',
      'equipe', 'equipeVeTudo', 'gruposDaEquipe', 'acessoPeloGrupo', 'menuDaBolinha', 'conviteDaPessoa', 'reservaDeConta', 'trocaDeEmail', 'avisoDaTroca',
      'BuscaNaEquipe', 'EscolhaDaEquipe', 'EquipeDoCartao', 'GruposDoItem', 'filtroDeGrupo',
      'equipe-reservar-conta', 'equipe-reenviar-avisos', 'equipe-trocar-email',
      'equipe-no-cartao', 'equipe-ve-tudo', 'grupos-da-equipe', 'convidar-pelo-cartao',
      'convite_seguro', 'funcao_na_equipe', 'trocar_email_pelo_administrador', 'aviso_da_troca_de_email', 'reforco_do_aviso_da_troca', 'correcoes_do_aviso_da_troca',
      'desativar_encerra_as_sessoes', 'desativar_encerra_sessoes', 'reativar_tira_a_senha_de_uso', 'reativar_tira_a_senha', 'conta_reservada', 'equipe_nome',
      'equipe_ve_tudo', 'fase_de_adaptacao', 'excluir_usuario', 'grupos_da_equipe', 'EmailDoGoogle', 'emailDoGoogle'
    ],
    tabelas: ['perfis', 'convites', 'grupos_da_equipe', 'grupo_integrantes', 'privado.mudancas_na_equipe'],
    dados: ['DadosEquipe', 'DadosGrupos'],
    rotas: ['equipe'],
    armadilhas: [
      'Função (advogado, administrativo, estagiário) é diferente de papel (administrador): quem não é administrador vê só o que criou ou em que foi posto.',
      'Quem vê e altera cada item é decidido pelas regras RLS do banco; o fictício imita em `falso.ts`. Mudou uma regra de acesso: rode os testes do banco (`npx supabase test db`).',
      'Regra que vale para quem executa ou para quem pede (como a aprovação da tarefa): decida e teste também o caso do administrador, que pela RLS altera tudo, e o de quem só altera o item.',
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
      'As partes das Configurações de outros assuntos estão nos assuntos deles: salas (Agenda), objetos (Objetos de contrato), funções dos participantes da tarefa (`FuncoesDosParticipantes`, Tarefas), conta Google (Conta Google e contatos) e fase de adaptação (Equipe). A função de cada pessoa da equipe (advogado, estagiário) é de Equipe.'
    ]
  },
  {
    id: 'registro',
    titulo: 'Registro de ações e LGPD',
    resumo: 'O registro de ações (auditoria: quem criou, mudou ou apagou o quê), na tela Equipe, e o que a LGPD pede: registrar quem exportou dados e, ao excluir uma pessoa, apagar o nome dela do registro.',
    arquivos: ['Equipe', arquivo('app/e2e/equipe'), 'lgpd_exclusao', 'exportacoes', 'esquecimentoNaCopia', 'esquecer_pessoa_nos_recebimentos_excluidos', 'consentimentoSemData', 'consentimento-sem-data'],
    tabelas: ['auditoria'],
    armadilhas: [
      'O gatilho `privado.auditar` (em `20261024000001_base.sql`) já grava uma linha por linha criada, mudada ou apagada: tabela nova ganha o gatilho na migração dela. Numa ação em cascata, o resumo vai nessa mesma linha (não grave outra).',
      'O texto de cada ação na tela: as tabelas `TABELAS` e `DETALHES` de `paginas/Equipe.tsx` (ex.: `detalheDaExclusaoDoContrato`, de `regras/exclusaoDoContrato.ts`).',
      'Excluir pessoa também tira o nome dela da cópia escondida dos recebimentos excluídos (`financeiro_excluidos`, #412): o gatilho `esquecer_nos_excluidos` e, no fictício, `regras/esquecimentoNaCopia.ts`. Texto novo com nome nessa cópia (descrição do Caixa, motivo, corte com `left`/`slice`): confira se os padrões (`nomeNoFinanceiro`, `nomeNoMotivo`, `pedacoDoNome`) ainda o acham, nos dois; os limites conhecidos estão no começo da migração.'
    ]
  },
  {
    id: 'mensagens',
    titulo: 'Mensagens e avisos',
    resumo: 'A caixa de mensagens de cada pessoa: avisos ao ser incluído num item, ao ser mencionado, os pedidos para participar de um item e os avisos da tarefa ao solicitante e a quem executa.',
    arquivos: ['Mensagens', 'mensagens', 'inclusao', 'pedidoDeParticipacao', 'aviso-ao-ser-incluido', 'pedir-para-participar',
      'aviso_ao_ser_incluido', 'pedidos_de_participacao', 'avisosDaTarefa', 'avisos-da-tarefa', 'avisos_da_tarefa'],
    tabelas: ['mensagens', 'mensagens_da_tarefa', 'privado.mudancas_do_solicitante', 'mensagens_de_compromisso', 'mensagens_de_grupo', 'mensagens_de_inclusao', 'mensagens_de_participacao', 'pedidos_de_participacao'],
    dados: ['DadosMensagens', 'DadosPedidos'],
    rotas: ['mensagens'],
    armadilhas: [
      'Quem recebe cada aviso é decidido no banco (gatilhos); as palavras de cada módulo ficam em `regras/inclusao.ts` e `regras/pedidoDeParticipacao.ts`.',
      'Tipo de aviso novo = tabela `mensagens_de_<x>` (migração), entrada em `regras/mensagens.ts` e um `ItemDe<x>` em `paginas/Mensagens.tsx` (como `ItemDaDemandaDoCompromisso`, da Agenda).',
      'O que uma rotina do banco cria sem ninguém logado não pode disparar o aviso ao ser incluído (veja [Rotinas automáticas](#rotinas)).'
    ]
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
    resumo: 'Ligar um item a outro que já existe, criar no cartão um item já ligado (o "+ Novo…" das seções), tirar pelo "x" o que está ligado e como as ligações aparecem no quadro.',
    arquivos: ['CartoesLigados', 'PessoasNosItens', 'ligarNoCartao', 'ItensLigados', 'LigadosNoCadastro', 'LigarDoModulo', 'LigarExistente', 'LigarItem', 'LigarProcesso',
      'ligacoesDoItem', 'ligarExistente', 'nascerLigado', 'origemDoCadastro', 'ligar-existente', 'nascer-ligado-demanda-contrato', 'criar-processo-e-tarefa-ligados',
      'ligar_processo_existente', 'novo-padrao-das-secoes', 'tarefa-em-varias-ligacoes', 'tirarDoCartao', 'tirar-do-cartao'],
    dados: ['DadosParaLigar'],
    armadilhas: [
      'A tela lê a lista gravada no item logo antes de gravar (para não apagar a ligação de outra pessoa): siga o mesmo jeito ao ligar um módulo novo.',
      'Ligar ou desligar uma tarefa de demanda mexe na demanda contínua (desfazer devolve a tarefa a ela): veja [Demandas](#demandas).',
      'Tudo o que se liga ou se põe num cartão sai pelo "x" (#424): a peça `BotaoTirar` de `ui/base` (ou o campo `tirar` de `ItemLigado`), que sempre pergunta antes. Ligação nova numa seção ganha o "x" junto; quem pode ficar sem o item está em `regras/tirarDoCartao.ts`, e as gravações, em `paginas/ligarNoCartao.ts`.'
    ]
  },
  {
    id: 'quadros',
    titulo: 'Quadros (kanban) e situação',
    resumo: 'O quadro kanban comum a todos os módulos: colunas, grupos de colunas, colunas-marco e padrão, arquivados, a Situação do cartão e o concluir pelo círculo.\n'
      + 'Peça comum: mexer aqui muda todos os módulos.',
    arquivos: [pasta('app/src/ui/quadro'), 'situacaoDoItem', 'quadro', 'colunasPadrao', 'conclusaoNoCartao', 'ligacoesDoItem', 'SecaoArquivados',
      'arquivados', 'colunas-fora-da-tela', 'colunas-padrao', 'grupos-colunas', 'grupos-entre-colunas', 'nome-da-coluna-inteiro', 'nomes-em-maiusculas',
      'concluir-na-miniatura', 'ligacoes-no-quadro',
      'colunas_marco', 'grupos_de_colunas', 'grupos_entre_colunas', 'leitura_rapida_dos_quadros'],
    tabelas: ['quadro_colunas', 'quadro_colunas_ocultas', 'quadro_grupos', 'quadro_sugestoes'],
    dados: ['DadosQuadros'],
    armadilhas: [
      'As colunas-marco têm código fixo (`regras/quadro.ts`): o sistema as acha pelo código, mesmo renomeadas. Coluna padrão nova chega por `regras/colunasPadrao.ts` e migração.',
      'Colunas novas num quadro que já existe: o escritório pode ter renomeado colunas e grupos, deixado um grupo vazio ou não ter grupos; ache pelo código fixo e siga `planoDasColunasNovas` (`regras/colunasPadrao.ts`), como `COLUNAS_NOVAS_DOS_PROCESSOS` (#315).',
      'Não crie marco novo para uma coluna reconhecida: a versão anterior do site não conhece o marco. Use uma bandeira, como `de_aprovacao` (a decisão está em `regras/quadro.ts`).',
      'A seção Arquivados (`ui/SecaoArquivados.tsx`, com a pergunta própria de cada módulo em `perguntarAntesDeExcluir`) é de todos os módulos: depois de mexer, rode a bateria completa de telas.',
      'Mudou `Kanban`, `useColunas` ou `PaginaModulo`: rode a bateria completa de telas, não só a deste assunto.'
    ]
  },
  {
    id: 'cartao',
    titulo: 'Cartão dos itens',
    resumo: 'O cartão (painel) de cada item: o topo, a cabeça, as seções que recolhem, o "Acrescentar ao cartão", as datas e a edição no lugar, o histórico e sair do cartão.\n'
      + 'Peça comum: mexer aqui muda os cartões de todos os módulos.',
    arquivos: ['AcoesDoCartao', 'AcrescentarAoCartao', 'CabecaDoCartao', 'EdicaoNoLugar', 'TopoDoCartao', 'registroDeAtalhos', 'sairDoCartao', 'useEdicaoUnica',
      'HistoricoDoCartao', 'atalhosDoCartao', 'datasNoCartao', 'janelaDasDatas', 'edicaoNoLugar', 'edicaoUnica', 'topoDoCartao', 'secoes',
      'arrumacao-do-cartao', 'atalhos-do-cartao', 'cartao', 'coluna-do-cartao', 'eixo-dos-botoes-do-cartao', 'situacao-e-expandir-tudo', 'topo-do-cartao',
      'datas-nos-cartoes', 'datas', 'novo-padrao-das-secoes', 'sair_do_cartao'],
    armadilhas: ['Toda seção de itens ligados mostra a contagem ao lado do título, mesmo recolhida (`regras/secoes.ts`, `ui/useQuantos.ts`).',
      'As datas de todos os cartões abrem na janela das datas (#422, `ui/base/JanelaDasDatas.tsx`), que flutua sobre o cartão e vai para fora dele na página: nos testes de tela, ache-a pela página (`page.getByRole("dialog", …)`), e não dentro do cartão.',
      'A descrição aberta no cartão (#433, `ui/base/TextoEditavel.tsx`) é o editor das anotações (`ui/base/EditorAoVivo.tsx`), e não uma caixa de texto comum: nos testes de tela, confira o texto com `toHaveText` (não `toHaveValue`); nos de componente, com `src/testes/editorAoVivo.ts`. A letra e o passo dela são os do texto lido (`estilo.css`, `.texto-editavel-edicao`): mudou um, mude o outro, para o texto não pular ao clicar.']
  },
  {
    id: 'busca-geral',
    titulo: 'Busca geral',
    resumo: 'A janela que busca em todos os módulos de uma vez (Ctrl+K ou o botão "Buscar" do menu).',
    arquivos: ['BuscaGeral', 'fontesDaBuscaGeral', 'buscaGeral', 'busca-geral'],
    armadilhas: ['Módulo novo, ou tipo novo de um módulo (como um tipo de processo), entra na busca por uma fonte em `ui/fontesDaBuscaGeral.ts`, um grupo em `regras/buscaGeral.ts` e o ícone do grupo (`ICONE_DO_GRUPO`, em `ui/BuscaGeral.tsx`); tipo que sai, tire dos três.']
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
    titulo: 'Conta Google, contatos e agendas',
    resumo: 'A ligação da conta Google do escritório (em Configurações), a sincronização das pessoas com o Google Contatos, com a lista "Para conferir",\n'
      + 'e as agendas do escritório no Google Agenda (#166: a permissão da agenda, as agendas de cada pessoa, Geral, salas e Administrativo, os compartilhamentos e os eventos: compromissos, prazos, dias sem expediente e parcelas). Veja docs/plataforma/agendas-google.md.',
    arquivos: ['LigacaoGoogle', 'SincronizacaoDosContatos', 'ContatosParaConferir', 'contatosGoogle', 'correspondenciaDeContatos', 'ligacaoGoogle',
      'sincronizacaoDeContatos', 'sincronizacaoGoogle', 'ligacao', /^supabase\/functions\/google-/, 'ligacao_google', 'contatos_google', 'contatos_google_primeira',
      'AgendasNoGoogle', 'EmailDoGoogle', 'emailDoGoogle', 'sincronizacaoDasAgendas', 'agendasGoogle', 'apiDaAgenda', 'eventosGoogle', 'agendas_google', 'agendas_google_eventos', 'agendas-google'],
    tabelas: ['contatos_google', 'contatos_google_conferir', 'contatos_google_fila', 'privado.ligacoes', 'privado.ligacao_pedidos',
      'agendas_google', 'agenda_google_compartilhamentos', 'agendas_google_fila', 'emails_do_google', 'agenda_google_eventos'],
    dados: ['DadosLigacoes'],
    armadilhas: [
      'As regras de quem é cada contato ficam no servidor (`supabase/functions/_compartilhado/correspondenciaDeContatos.ts`); os testes, em `app/src/regras/`.',
      'O que criar, compartilhar ou retirar nas agendas é decidido pelo plano puro de `supabase/functions/_compartilhado/agendasGoogle.ts` (testado em `app/src/regras/agendasGoogle.test.ts`), que o `falso.ts` também usa; os pedidos ao Google ficam só no adaptador `apiDaAgenda.ts`.',
      'As permissões da agenda estão em `ESCOPOS_DA_AGENDA` (`_compartilhado/ligacao.ts`) e em `privado.agenda_autorizada` no banco: mude os dois juntos. Somar a agenda é um pedido de ligação com a finalidade \'agendas\', que só vale para a conta já ligada.',
      'O e-mail do Google (`emails_do_google`) é editado em Equipe e em Minha conta com a regra do nome (`regras/emailDoGoogle.ts`, `email_do_google_salvar`). Mudar a equipe, as salas ou esses e-mails põe o escritório na fila das agendas (gatilhos `agendas_google`).',
      'O que vai para qual agenda, e como fica cada evento, é decidido pelas funções puras de `supabase/functions/_compartilhado/eventosGoogle.ts` (testadas em `app/src/regras/eventosGoogle.test.ts`); o banco só entrega o item (`privado.agenda_do_compromisso` e afins, na migração `agendas_google_eventos`). Campo novo de compromisso, tarefa, demanda, dia sem expediente ou parcela que deve ir ao Google: ponha no item dessas funções e na lista do gatilho `agendas_google_mudou` da tabela (só os campos da lista põem o item na fila).',
      'O banco fictício (`falso.ts`) simula as agendas e os compartilhamentos, mas não os eventos: as cópias dos itens só existem no servidor, e o "Sincronizar agora" do fictício conta zero eventos.'
    ]
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
    resumo: 'A ajuda de cada tela (o botão "?" ao lado do título, nas páginas de módulo e nas outras) e os atalhos de teclado ("/" busca, "N" novo, "?" ajuda).',
    arquivos: ['ajuda', 'atalhos', 'BotaoDeAjuda'],
    armadilhas: [
      'Módulo novo com página de módulo, ou tipo novo com quadro próprio (como um tipo de processo), ganha os textos de ajuda em `regras/ajuda.ts`; tipo que sai, tire de lá.',
      'Tela nova que não é de módulo ganha uma entrada em `AJUDA_DAS_TELAS` (`regras/ajuda.ts`) e o título com o "?" (`TituloComAjuda`, ou `useAjudaDaTela` com o `aoAbrirAjuda` do `CabecaDoPainel` nos painéis); aba nova do Financeiro, uma linha em `AJUDA_DA_ABA` (`paginas/financeiro/Hub.tsx`). Uma chamada só por tela: duas abririam duas janelas na mesma tecla.',
      'Os cadastros (`CADASTROS` de `App.tsx`: Nova pessoa, Novo contrato… e Importar pessoas) ainda não têm o "?": abrem numa janela por cima da página, onde a tecla "?" não vale, e cada etapa já se explica. Pôr a ajuda neles é tarefa própria, se o dono pedir.'
    ]
  },
  {
    id: 'rotinas',
    titulo: 'Rotinas automáticas',
    resumo: 'O que o banco faz sozinho, de tempos em tempos (pg_cron): avisos e lembretes de prazo, e-mails de prazo, datas e demandas dos compromissos que se repetem,\n'
      + 'contatos e agendas do Google e o reenvio do aviso da troca de e-mail. Toda migração com `cron.schedule` entra aqui sozinha.',
    arquivos: [],
    conteudo: /cron\.schedule/,
    armadilhas: [
      'A rotina roda sem ninguém logado (`auth.uid()` nulo): o teste do banco limpa o login antes de chamá-la, e o que ela cria não pode disparar os gatilhos de aviso ao ser incluído.',
      'A rotina chama uma função `privado.…` da mesma migração: mudou a regra, mude a função (numa migração nova) e o caso do teste do banco.'
    ]
  }
];
