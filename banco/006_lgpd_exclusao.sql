-- =====================================================================
-- 006 · Excluir uma pessoa sem deixar o nome dela para trás (LGPD)
--   Ao excluir definitivamente um cadastro:
--   - o registro de ações sobre ela fica só com o código (sai nome e e-mail);
--   - no histórico das outras pessoas, os vínculos com ela ("Cônjuge FULANO")
--     passam a dizer "pessoa excluída".
--   O histórico e as informações sigilosas da própria pessoa já eram apagados
--   junto com o cadastro.
-- =====================================================================

create or replace function privado.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end); r jsonb;
begin
  r := jsonb_strip_nulls(jsonb_build_object('codigo', j ->> 'codigo', 'nome', j ->> 'nome', 'perfil', j ->> 'perfil_id',
                                            'papel', j ->> 'papel', 'email', j ->> 'email'));
  -- Pessoa excluída: o registro da exclusão guarda só o código.
  if tg_op = 'DELETE' and tg_table_name = 'pessoas' then r := r - 'nome' - 'email'; end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values ((j ->> 'escritorio_id')::uuid, tg_table_name, coalesce(j ->> 'id', j ->> 'pessoa_id'),
          case tg_op when 'INSERT' then 'inclusao' when 'UPDATE' then 'alteracao' else 'exclusao' end, r, auth.uid());
  return null;
end $$;

create function privado.esquecer_pessoa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_padrao text := '(^| )' || regexp_replace(old.nome, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '($| \()';
begin
  -- Ações registradas sobre a pessoa: ficam o código, a ação, quem fez e quando.
  update public.auditoria set resumo = resumo - 'nome' - 'email'
  where escritorio_id = old.escritorio_id and tabela = 'pessoas' and registro_id = old.id::text;
  -- Vínculos com ela no histórico das outras pessoas.
  update public.pessoa_historico h
  set alteracoes = jsonb_build_object('vinculo', jsonb_build_object(
        'de',   regexp_replace(h.alteracoes -> 'vinculo' ->> 'de',   v_padrao, '\1pessoa excluída\2'),
        'para', regexp_replace(h.alteracoes -> 'vinculo' ->> 'para', v_padrao, '\1pessoa excluída\2')))
  where h.escritorio_id = old.escritorio_id and h.pessoa_id <> old.id and h.alteracoes ? 'vinculo'
    and (coalesce(h.alteracoes -> 'vinculo' ->> 'de', '') ~ v_padrao or coalesce(h.alteracoes -> 'vinculo' ->> 'para', '') ~ v_padrao);
  return null;
end $$;
create trigger esquecer after delete on public.pessoas for each row execute function privado.esquecer_pessoa();
