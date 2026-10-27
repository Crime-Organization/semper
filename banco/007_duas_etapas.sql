-- =====================================================================
-- 007 · Verificação em duas etapas valendo no banco
--   Quem ativou a verificação em duas etapas (aplicativo autenticador) só vê
--   e altera os dados do escritório depois de digitar o código: a sessão
--   precisa estar no nível "aal2". Assim, só a senha não basta, nem chamando
--   o banco direto, por fora da tela do SEMPER.
--   Quem ainda não ativou continua entrando só com a senha.
-- =====================================================================

create function privado.duas_etapas_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified')
$$;

create or replace function privado.meu_escritorio() returns uuid
language sql stable security definer set search_path = '' as $$
  select escritorio_id from public.perfis where id = auth.uid() and ativo and privado.duas_etapas_ok()
$$;
create or replace function privado.sou_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select papel in ('master', 'admin') from public.perfis where id = auth.uid() and ativo), false) and privado.duas_etapas_ok()
$$;
create or replace function privado.sou_master() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select papel = 'master' from public.perfis where id = auth.uid() and ativo), false) and privado.duas_etapas_ok()
$$;
create or replace function privado.sou_dono() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plataforma_donos where usuario_id = auth.uid()) and privado.duas_etapas_ok()
$$;

revoke execute on function privado.duas_etapas_ok() from public, anon;
grant execute on function privado.duas_etapas_ok() to authenticated;
