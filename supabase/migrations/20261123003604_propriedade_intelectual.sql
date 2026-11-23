-- =====================================================================
-- Propriedade intelectual: tipo de proteção, campos de cada tipo e papéis de titular, inventor e autor (#317)
--   1. O processo cuja área do direito é "Propriedade intelectual" ganha o tipo de proteção (marca, patente de invenção,
--      modelo de utilidade, desenho industrial ou programa de computador) e os campos de cada tipo: as datas de depósito,
--      concessão, publicação e criação, a apresentação e a natureza da marca, as classes de Nice, a especificação, o número de
--      variações do desenho e a linguagem do programa. São as datas de que a regra dos prazos do INPI parte
--      (app/src/regras/propriedadeIntelectual.ts, que calcula a validade, as anuidades e as prorrogações: nada disso é gravado).
--      Os tamanhos e listas são os de app/src/dados/limites.ts e app/src/regras/propriedadeIntelectual.ts: mudou aqui, muda lá.
--   2. Os papéis titular, inventor e autor da criação entram na lista das pessoas com papel (processo_partes). A tela só os
--      oferece nos processos de propriedade intelectual.
--   O número do processo continua sendo o do pedido no INPI (o campo "número" de sempre).
--   As colunas novas são do processo, que já tem escritorio_id e as regras RLS: quem vê o processo vê os campos; quem o altera,
--   muda. O histórico do processo registra as colunas novas sozinho (o gatilho historico_processo compara todas as colunas).
--   Só acrescenta (colunas opcionais e uma regra check mais larga). A versão anterior do site continua funcionando: ela não
--   lê nem grava as colunas novas, que nascem vazias, e os papéis de antes continuam valendo.
-- =====================================================================

-- ---------- 1. Tipo de proteção e campos de cada tipo ----------
alter table public.processos
  add column protecao text check (protecao in ('marca', 'patente_invencao', 'modelo_utilidade', 'desenho_industrial', 'programa_computador')),
  add column deposito date,
  add column concessao date,
  add column publicacao date,
  add column criacao date,
  add column apresentacao_marca text check (apresentacao_marca in ('nominativa', 'mista', 'figurativa', 'tridimensional', 'posicao')),
  add column natureza_marca text check (natureza_marca in ('produto', 'servico', 'coletiva', 'certificacao')),
  -- As classes da Classificação de Nice vão de 1 a 45 (CLASSE_NICE_MAIOR); cada uma uma vez só (a tela não repete).
  add column classes_nice smallint[] not null default '{}'
    check (cardinality(classes_nice) <= 45 and 1 <= all(classes_nice) and 45 >= all(classes_nice)),
  add column especificacao text check (char_length(especificacao) <= 2000),
  -- O pedido de desenho industrial pode ter até 20 variações (VARIACOES_DO_DESENHO).
  add column variacoes smallint check (variacoes between 1 and 20),
  add column linguagem text check (char_length(linguagem) <= 120);
-- A concessão não vem antes do depósito.
alter table public.processos add constraint processos_concessao_depois_do_deposito
  check (concessao is null or deposito is null or concessao >= deposito);

-- Quem altera o processo muda os campos novos (a lista do que se altera é por coluna, desde 20261101155218_processos.sql).
grant update (protecao, deposito, concessao, publicacao, criacao, apresentacao_marca, natureza_marca, classes_nice, especificacao, variacoes, linguagem)
  on public.processos to authenticated;

-- ---------- 2. Titular, inventor e autor da criação ----------
-- O nome da regra é o que o Postgres deu à regra da coluna em 20261122130109_processo_partes_recursos_e_tipos.sql. Se tiver
-- outro nome, a migração para no "drop" e nada muda.
alter table public.processo_partes drop constraint processo_partes_papel_check;
alter table public.processo_partes add constraint processo_partes_papel_check
  check (papel in ('autor', 'reu', 'terceiro', 'testemunha', 'perito', 'assistente_tecnico', 'vitima', 'investigado', 'advogado_contrario', 'outro',
                   'titular', 'inventor', 'autor_da_criacao'));
