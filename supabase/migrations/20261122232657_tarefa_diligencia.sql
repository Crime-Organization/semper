-- =====================================================================
-- Tarefa de diligência, com o motivo obrigatório (#313, parte A)
--   A tarefa pode ser marcada como diligência (ir a um cartório, a um fórum, a um órgão...). Marcada, o motivo passa a ser
--   obrigatório: um texto livre de até 1000 caracteres (TAMANHO_TAREFA.motivoDaDiligencia em app/src/dados/limites.ts).
--   - Ao gravar, o banco limpa os espaços do motivo e o apaga quando a tarefa deixa de ser diligência; marcada sem motivo, recusa
--     com uma mensagem em português. A regra da tabela confere o mesmo, mesmo com os gatilhos desligados (numa importação).
--   - O histórico mostra a troca como os outros campos (o gatilho do histórico já registra qualquer coluna nova).
--
--   Só acrescenta: duas colunas com valor padrão (não é diligência, sem motivo), uma regra, uma função e um gatilho novos. A versão
--   anterior do site continua funcionando: ela não conhece a diligência e não grava as colunas novas; a tarefa dela nasce comum.
-- =====================================================================

alter table public.tarefas add column diligencia boolean not null default false;
alter table public.tarefas add column diligencia_motivo text;
alter table public.tarefas add constraint tarefas_diligencia_com_motivo check (
  (not diligencia and diligencia_motivo is null)
  or (diligencia and length(btrim(coalesce(diligencia_motivo, ''))) between 1 and 1000)   -- TAMANHO_TAREFA.motivoDaDiligencia em limites.ts
);
grant update (diligencia, diligencia_motivo) on public.tarefas to authenticated;

-- Antes de gravar: o motivo sem espaços nas pontas; sem diligência, sem motivo; com diligência, o motivo é obrigatório.
create function privado.preparar_diligencia() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.diligencia_motivo := nullif(btrim(new.diligencia_motivo), '');
  if not new.diligencia then
    new.diligencia_motivo := null;
  elsif new.diligencia_motivo is null then
    raise exception 'Diga o motivo da diligência.';
  elsif length(new.diligencia_motivo) > 1000 then
    raise exception 'O motivo da diligência pode ter até 1000 caracteres.';
  end if;
  return new;
end $$;
revoke execute on function privado.preparar_diligencia() from public, anon, authenticated;
create trigger preparar_diligencia before insert or update of diligencia, diligencia_motivo on public.tarefas
  for each row execute function privado.preparar_diligencia();
