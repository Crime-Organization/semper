-- O lançamento que veio de uma planilha (ex.: o Caixa de 2026) guarda as colunas da linha de onde veio: cliente,
-- serviço, categoria, responsável, participante, indicador, referência da parcela, banco, juros, DAS, os percentuais e
-- os valores de cada parte. A importação antiga juntava parte disso só na descrição.
-- Lista de pares [nome da coluna, valor como estava na planilha], na ordem das colunas (o jsonb não guarda a ordem das
-- chaves de um objeto, por isso é uma lista). Só leitura para quem usa o sistema: é o registro do que veio da planilha;
-- quem grava é a importação. Só acrescenta: a versão anterior do site não lê a coluna e continua funcionando.
alter table public.financeiro_lancamentos add column planilha jsonb
  check (planilha is null or jsonb_typeof(planilha) = 'array');
comment on column public.financeiro_lancamentos.planilha is
  'Colunas da linha da planilha de onde o lançamento veio: lista de pares [coluna, valor]. Só a importação grava.';
