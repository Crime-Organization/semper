-- Desativar e reativar encerram as sessões da pessoa (#237). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Dado um escritório com o master, a colega e um terceiro, conectados, e o master de outro escritório.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-desativar'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-desativar-outro');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'colega@exemplo.test', 'Colega', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'terceiro@exemplo.test', 'Terceiro', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'estranho@exemplo.test', 'Estranho', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mestre@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'colega@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'terceiro@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'estranho@exemplo.test', '{"convite":"c4"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000004', now(), now());
insert into auth.refresh_tokens (token, user_id, session_id, revoked, created_at, updated_at) values
  ('renovacao-da-colega', 'a0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000b', false, now(), now());

-- O token que o login emitiria para cada sessão.
create function pg_temp.token(p_usuario uuid, p_sessao uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_usuario, 'role', 'authenticated', 'aal', 'aal1', 'session_id', p_sessao)::text, true);
end $$;
grant execute on function pg_temp.token(uuid, uuid) to authenticated;
grant usage on schema extensions to authenticated;
create function pg_temp.sessoes(p_usuario uuid) returns bigint language sql security definer as $$
  select count(*) from auth.sessions where user_id = p_usuario
$$;
create function pg_temp.renovacoes(p_usuario uuid) returns bigint language sql security definer as $$
  select count(*) from auth.refresh_tokens where user_id = p_usuario::text
$$;
grant execute on function pg_temp.sessoes(uuid), pg_temp.renovacoes(uuid) to authenticated;

set local role authenticated;

-- Quem não pode desativar não mexe em nada.
select pg_temp.token('a0000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.equipe_definir_ativo('a0000000-0000-0000-0000-000000000002', false) $$, null, 'Apenas administradores', 'dado quem não é administrador, quando tenta desativar, então o banco recusa');
select pg_temp.token('a0000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.equipe_definir_ativo('a0000000-0000-0000-0000-000000000002', false) $$, null, 'Usuário não encontrado', 'dado o master de outro escritório, quando tenta desativar, então o banco recusa');
select is(pg_temp.sessoes('a0000000-0000-0000-0000-000000000002'), 1::bigint, 'dadas as tentativas recusadas, então as sessões da colega continuam');

-- Quando o master desativa a colega.
select pg_temp.token('a0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.equipe_definir_ativo('a0000000-0000-0000-0000-000000000002', false) $$, 'quando o master desativa a colega, então o banco aceita');
select is(pg_temp.sessoes('a0000000-0000-0000-0000-000000000002'), 0::bigint, 'dada a desativação, então as sessões da colega acabam');
select is(pg_temp.renovacoes('a0000000-0000-0000-0000-000000000002'), 0::bigint, 'dada a desativação, então o token de renovação da colega acaba');
select is(pg_temp.sessoes('a0000000-0000-0000-0000-000000000001'), 1::bigint, 'dada a desativação, então a sessão do master continua');
select is(pg_temp.sessoes('a0000000-0000-0000-0000-000000000003'), 1::bigint, 'dada a desativação, então a sessão do terceiro continua');

-- Enquanto desativada, alguém entra com a senha da colega e abre uma sessão nova.
reset role;
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000002', now(), now());
set local role authenticated;

-- Quando o master reativa a colega, nenhum dos tokens antigos volta a valer.
select lives_ok($$ select public.equipe_definir_ativo('a0000000-0000-0000-0000-000000000002', true) $$, 'quando o master reativa a colega, então o banco aceita');
select is(pg_temp.sessoes('a0000000-0000-0000-0000-000000000002'), 0::bigint, 'dada a reativação, então a sessão aberta durante a desativação também acaba');
select pg_temp.token('a0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.pessoas), 0::bigint, 'dada a reativação, quando o token de antes da desativação lê, então não vê nada');
select throws_ok($$ insert into public.pessoas (tipo, nome) values ('contato', 'NOVA') $$, null, null, 'dada a reativação, quando o token de antes da desativação grava, então o banco recusa');
select pg_temp.token('a0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000e');
select is((select count(*) from public.pessoas), 0::bigint, 'dada a reativação, quando o token aberto durante a desativação lê, então não vê nada');

-- Quando a colega entra de novo, tudo volta ao normal.
reset role;
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000002', now(), now());
set local role authenticated;
select pg_temp.token('a0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000f');
select isnt((select count(*) from public.pessoas), 0::bigint, 'dada a pessoa reativada, quando entra de novo, então vê os dados');
select lives_ok($$ insert into public.pessoas (tipo, nome) values ('contato', 'NOVA') $$, 'dada a pessoa reativada, quando entra de novo, então grava');

reset role;
select * from finish();
rollback;
