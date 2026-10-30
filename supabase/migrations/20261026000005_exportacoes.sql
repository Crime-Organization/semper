-- =====================================================================
-- 005 · Registro das exportações (LGPD: quem tirou dados do sistema)
--   Toda exportação feita pelo SEMPER (ex.: Pessoas > Exportar para o Google
--   Contatos) fica no registro de ações: quem, quando, o quê e quantos.
--   Só administradores exportam.
-- =====================================================================

alter table public.auditoria drop constraint auditoria_acao_check;
alter table public.auditoria add constraint auditoria_acao_check
  check (acao in ('inclusao', 'alteracao', 'exclusao', 'leitura', 'exportacao'));

create function public.exportacao_registrar(p_tabela text, p_descricao text, p_quantidade int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores exportam dados'; end if;
  if p_tabela not in ('pessoas') then raise exception 'Exportação desconhecida'; end if;
  insert into public.auditoria (escritorio_id, tabela, acao, resumo, feito_por)
  values (privado.meu_escritorio(), p_tabela, 'exportacao',
          jsonb_build_object('descricao', left(coalesce(p_descricao, ''), 200), 'quantidade', greatest(coalesce(p_quantidade, 0), 0)),
          auth.uid());
end $$;
revoke execute on function public.exportacao_registrar(text, text, int) from public, anon;
grant execute on function public.exportacao_registrar(text, text, int) to authenticated;
