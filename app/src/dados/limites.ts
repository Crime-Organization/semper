// Limites da camada de dados: quantos itens vêm por vez e o tamanho máximo dos campos.
// Os de tamanho marcados com o script do banco são exigidos por ele (regra "check"): mudar aqui sem mudar lá
// faz o banco recusar o que o formulário deixou digitar. Os outros valem só nos formulários.

/** Pessoas por página na tabela. */
export const POR_PAGINA = 50;
/** Cartões carregados por vez em cada coluna do quadro (o resto vem em "Carregar mais"). */
export const POR_COLUNA = 30;
/** Pessoas mostradas na busca enquanto se digita (BuscaPessoa). */
export const ACHADOS_DA_BUSCA = 8;
/** Últimas ações mostradas no registro de ações (Equipe). */
export const REGISTRO_DE_ACOES = 60;

/** Cadastro de pessoas: a tabela não limita o tamanho; valem só no formulário. */
export const TAMANHO_PESSOA = {
  nome: 200, nomeFantasia: 200, filiacao: 200, representantes: 400, nacionalidade: 60, profissao: 120, rg: 60,
  logradouro: 200, numero: 20, complemento: 120, bairro: 120, municipio: 120
};
/** Dados do escritório: os mesmos do banco (supabase/migrations/…_identidade_escritorio.sql), menos o nome, que só o formulário limita. */
export const TAMANHO_ESCRITORIO = {
  nome: 120, oab_registro: 60, logradouro: 200, numero: 20, complemento: 100, bairro: 100, municipio: 100, email: 200, site: 200
};
/** Vínculos: nome, inverso e descrição como no banco (supabase/migrations/…_vinculos.sql); a função do representante só no formulário. */
export const TAMANHO_VINCULO = { nome: 60, inverso: 60, descricao: 300, funcao: 120 };
/** Contratos: os mesmos do banco (banco/009_contratos.sql e 010_contrato_objetos.sql). */
export const TAMANHO_CONTRATO = { objeto: 300, codigo_antigo: 40, documento_url: 500, observacoes: 4000 };
/** Quantos clientes um contrato pode ter (o banco recusa mais que isso: banco/013_contrato_clientes.sql). */
export const CLIENTES_MAXIMOS = 10;
/** Quantos participantes um contrato pode ter (o banco recusa mais que isso: banco/012_contrato_participantes.sql). */
export const PARTICIPANTES_MAXIMOS = 10;
/** Quantos objetos um contrato pode ter (o banco recusa mais que isso). */
export const OBJETOS_MAXIMOS = 20;
/** Quantos objetos da lista do escritório o cadastro de contrato carrega como sugestão. */
export const OBJETOS_SUGERIDOS = 1000;
/** Quantos contratos o cartão de uma pessoa mostra (os mais novos primeiro). */
export const CONTRATOS_DA_PESSOA = 200;
/** Demandas: os mesmos do banco (banco/017_demandas.sql). */
export const TAMANHO_DEMANDA = { titulo: 300, descricao: 4000 };
/** Quantos colaboradores uma demanda pode ter (o banco recusa mais que isso). */
export const COLABORADORES_MAXIMOS = 20;
/** Quantas demandas o cartão de uma pessoa ou de um contrato mostra (as mais novas primeiro). */
export const DEMANDAS_LIGADAS = 200;
/** Tarefas: os mesmos do banco (banco/020_tarefas.sql). Os participantes seguem COLABORADORES_MAXIMOS; as pessoas, CLIENTES_MAXIMOS. */
export const TAMANHO_TAREFA = { titulo: 300, descricao: 4000 };
/** Quantas tarefas o cartão de uma pessoa, de uma demanda ou de um contrato mostra. */
export const TAREFAS_LIGADAS = 200;
/** Quantas demandas (as ativas mais recentes) o cadastro de tarefa oferece para ligar. */
export const DEMANDAS_PARA_LIGAR = 500;
/** Tempo nas tarefas, em segundos (exigidos pelo banco: supabase/migrations/20261030120000_tempo_nas_tarefas.sql). */
/** Um período contado pelo cronômetro tem até 12 horas; passou disso, começa outro. */
export const PERIODO_MAXIMO = 12 * 60 * 60;
/** Um ajuste à mão vai de -24 a +24 horas. */
export const AJUSTE_MAXIMO = 24 * 60 * 60;
/** Tamanho do motivo do ajuste. */
export const TAMANHO_MOTIVO = 300;
/** Listas das demandas: nome da lista e texto do item, os mesmos do banco (banco/018_listas_das_demandas.sql). */
export const TAMANHO_LISTA = 120;
export const TAMANHO_ITEM = 500;
/** Quantos itens um modelo de lista pode ter (o banco recusa mais que isso: banco/019_modelos_de_lista.sql). */
export const ITENS_DO_MODELO = 100;
/** Quantos contratos (os ativos mais recentes) os cadastros de demanda e de tarefa oferecem para ligar. */
export const CONTRATOS_PARA_LIGAR = 500;
/** Tamanho de um comentário (o banco recusa mais que isso: banco/016_comentarios.sql). */
export const TAMANHO_COMENTARIO = 5000;
/** Quantos comentários um cartão mostra (os mais novos primeiro). */
export const COMENTARIOS_DO_CARTAO = 200;
/** Sugestões mostradas enquanto se digita (objetos do contrato, nome da coluna...). */
export const ACHADAS_DA_SUGESTAO = 8;
/** Colegas mostrados na lista do @ enquanto se digita um comentário. */
export const ACHADOS_DA_MENCAO = 8;
/** Número máximo de parcelas de um contrato (o banco aceita de 1 a 360). */
export const PARCELAS_MAXIMAS = 360;

/** Nome de coluna do quadro e informação sigilosa (só no formulário). */
export const TAMANHO_COLUNA = 60;
export const TAMANHO_SIGILO = 5000;

/** Perfil profissional: tamanho de cada texto (exigidos pelo banco: supabase/migrations/20261030140000_perfil_profissional.sql). */
/** "item" vale para cada texto das listas (área, idioma, curso, cargo, título...); "link", para cada link. */
export const TAMANHO_PERFIL = { nome_exibicao: 120, cargo: 120, bio_curta: 300, biografia: 5000, item: 300, link: 500, email: 254, telefone: 30 } as const;
/** Quantas linhas cada lista do perfil aceita (inscrições, áreas, formação...). */
export const LINHAS_DO_PERFIL = 30;
/** Maior posição na página da equipe do site. */
export const ORDEM_NO_SITE_MAXIMA = 9999;

/** Foto do perfil (supabase/migrations/20261030150000_foto_do_perfil.sql): o lado, em pixels, de cada um dos dois arquivos AVIF redondos. */
/** A grande vai para a página do advogado no site; a pequena, para as bolinhas do sistema. */
export const FOTO_GRANDE = 1000;
export const FOTO_PEQUENA = 150;
/** Maior arquivo de foto que a pasta aceita (2 MB, como o banco). */
export const FOTO_MAXIMA = 2 * 1024 * 1024;

// ---------- Importar pessoas de um arquivo CSV (regras/importacao.ts) ----------
/** Linhas gravadas por chamada ao banco. */
export const LOTE_DA_IMPORTACAO = 200;
/** Maior lote que o banco aceita numa chamada (exigido pelo banco: a função pessoas_importar recusa mais que isso). */
export const LOTE_MAXIMO_DA_IMPORTACAO = 500;
/** Maior arquivo aceito na importação (10 MB): a tela confere o tamanho antes de ler. */
export const TAMANHO_MAXIMO_DO_ARQUIVO = 10 * 1024 * 1024;
/** Mais linhas que isso num arquivo de importação: o arquivo é recusado (divida em partes). */
export const LINHAS_MAXIMAS_DA_IMPORTACAO = 20000;
/** Observações do cadastro de pessoa (exigido pelo banco: coluna pessoas.observacoes). */
export const TAMANHO_OBSERVACOES = 4000;
/** Referência de origem de uma pessoa importada, como "site-12" (exigido pelo banco: coluna pessoas.referencia). */
export const TAMANHO_REFERENCIA = 100;
/** Quantos CPF/CNPJ e referências vão em cada busca dos cadastros que o arquivo já tem (pessoas_para_importar): cada
 *  um acha no máximo um cadastro, e o Supabase devolve no máximo 1.000 linhas por consulta. */
export const CHAVES_POR_CONSULTA = 500;
/** Descrição e nome do arquivo de uma importação (o banco corta no tamanho: função importacao_iniciar). */
export const TAMANHO_IMPORTACAO = { descricao: 200, arquivo: 200 };

// ---------- Calendário de feriados e suspensões (regras/calendario.ts) ----------
/** Sigla e nome do órgão (exigidos pelo banco: supabase/migrations/20261101112711_calendario_de_prazos.sql). */
export const TAMANHO_ORGAO = { sigla: 20, nome: 120 };
/** Motivo de um dia sem expediente lançado pelo escritório (exigido pelo banco, mesma migração). */
export const TAMANHO_DIA = { motivo: 120 };
/** Os anos que o calendário aceita (exigidos pelo banco, mesma migração: datas fora deles são recusadas). */
export const ANOS_DO_CALENDARIO = { de: 2000, ate: 2100 };
/** Quantos dias seguidos cabem num lançamento (um ano). */
export const DIAS_POR_LANCAMENTO = 366;
/** Quantos dias lançados se excluem por vez (os ids vão no endereço da consulta, que não pode ficar grande demais). */
export const IDS_POR_EXCLUSAO = 100;
/** Quantas linhas o Supabase devolve por consulta, no máximo (max_rows em supabase/config.toml): além disso, busca-se em partes. */
export const LINHAS_POR_CONSULTA = 1000;
/** Nome de grupo de colunas do quadro (exigido pelo banco: supabase/migrations/20261101121647_grupos_de_colunas.sql). */
export const TAMANHO_GRUPO = 60;
