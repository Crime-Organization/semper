-- =====================================================================
-- Arquivar e excluir o contrato em cascata (#284) com a demanda contínua (#313): junção do lote 9
--   As duas tarefas foram feitas em paralelo. A #284 (20261122232543_contrato_arquiva_em_cascata.sql) precisava saber se uma
--   demanda é a contínua antes de a #313 criar a coluna, e por isso lia o campo por to_jsonb em privado.demanda_continua(demandas),
--   que dava "não é contínua" se a coluna faltasse. A #313 (20261123003418_demanda_continua.sql) criou a coluna de verdade,
--   public.demandas.continua (boolean, não nula). Aqui a função passa a ler a coluna direto: se um dia ela mudar de nome ou de forma,
--   o banco recusa, em vez de a cascata passar a arquivar ou excluir a contínua sem erro nenhum.
--
--   Quem usa esta função, e continua igual:
--   - o gatilho privado.contrato_arquiva_em_cascata: a contínua nunca é arquivada junto, nem conta como "outra ligação ativa" da tarefa;
--   - privado.demandas_que_saem e privado.tarefas_que_saem (public.contratos_excluir e a prévia): a contínua nunca é excluída junto,
--     nem segura a tarefa do contrato excluído.
--   A cascata roda como o sistema: decide pelas ligações da tarefa, não pelo que quem arquiva ou exclui vê. É o que combina com as
--   regras de leitura da #313: estar na contínua não abre as tarefas dela, e ela só agrupa (por isso não conta como ligação).
--
-- Só acrescenta: troca o corpo de uma função, com a mesma assinatura e o mesmo resultado nas demandas de hoje. A versão anterior do
-- site continua funcionando: ela não chama esta função (só os gatilhos e as funções do banco a usam).
-- =====================================================================

create or replace function privado.demanda_continua(d public.demandas) returns boolean
language sql immutable set search_path = '' as $$
  select d.continua
$$;
revoke execute on function privado.demanda_continua(public.demandas) from public, anon, authenticated;
