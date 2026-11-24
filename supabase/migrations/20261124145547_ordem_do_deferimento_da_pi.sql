-- =====================================================================
-- Propriedade intelectual: a ordem da publicação do deferimento da marca (#418)
--   A data da publicação do deferimento na RPI (a coluna deferimento, de 20261124135238_papeis_e_deferimento_da_pi.sql) não vem antes
--   do depósito, e a concessão não vem antes dela, como a concessão já não vem antes do depósito (processos_concessao_depois_do_deposito,
--   de 20261123003604_propriedade_intelectual.sql). Sem isso, o prazo de 60 dias úteis do cartão sairia de uma data impossível.
--   As frases são DEFERIMENTO_ANTES_DO_DEPOSITO e CONCESSAO_ANTES_DO_DEFERIMENTO, em app/src/regras/propriedadeIntelectual.ts (as mesmas
--   do cadastro e do banco fictício; dados/erros.ts traduz o erro de cada regra): mudou aqui, muda lá.
--   Regras check comuns: a coluna deferimento nasceu vazia em todas as linhas e só a versão nova do site a preenche, então nenhuma linha
--   que já existe fica fora da regra (a regra é conferida inteira ao ser criada; se houvesse uma, a migração pararia, sem mudar nada).
--   Só acrescenta (duas regras novas). A versão anterior do site continua funcionando: ela não lê nem grava o deferimento, e com ele
--   vazio as duas regras sempre passam.
-- =====================================================================

alter table public.processos add constraint processos_deferimento_depois_do_deposito
  check (deferimento is null or deposito is null or deferimento >= deposito);
alter table public.processos add constraint processos_concessao_depois_do_deferimento
  check (concessao is null or deferimento is null or concessao >= deferimento);
