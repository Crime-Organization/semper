-- Reativar tira a senha antiga de uso (#243). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Dado um escritório com o master, a colega e um terceiro, conectados, a colega com senha, link de recuperação e troca de e-mail pendentes.
insert into public.escritorios (id, nome, slug) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-reativar');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'colega@exemplo.test', 'Colega', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'terceiro@exemplo.test', 'Terceiro', 'usuario', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data, recovery_token, recovery_sent_at, email_change, email_change_token_new, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mestre@exemplo.test', extensions.crypt('senha-do-mestre', extensions.gen_salt('bf')), '{"convite":"c1"}', '', null, '', '', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'colega@exemplo.test', extensions.crypt('senha-da-colega', extensions.gen_salt('bf')), '{"convite":"c2"}', 'link-de-recuperacao', now(), 'invasor@exemplo.test', 'link-da-troca', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'terceiro@exemplo.test', extensions.crypt('senha-do-terceiro', extensions.gen_salt('bf')), '{"convite":"c3"}', '', null, '', '', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000003', now(), now());
insert into auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to) values
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'recovery_token', 'link-de-recuperacao', 'colega@exemplo.test');

create function pg_temp.token(p_usuario uuid, p_sessao uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_usuario, 'role', 'authenticated', 'aal', 'aal1', 'session_id', p_sessao)::text, true);
end $$;
-- A senha ainda entra? É a mesma conta que o login faz.
create function pg_temp.senha_vale(p_usuario uuid, p_senha text) returns boolean language sql security definer as $$
  select encrypted_password = extensions.crypt(p_senha, encrypted_password) from auth.users where id = p_usuario
$$;
create function pg_temp.conta(p_usuario uuid) returns auth.users language sql security definer as $$
  select * from auth.users where id = p_usuario
$$;
create function pg_temp.links(p_usuario uuid) returns bigint language sql security definer as $$
  select count(*) from auth.one_time_tokens where user_id = p_usuario
$$;
grant execute on function pg_temp.token(uuid, uuid), pg_temp.senha_vale(uuid, text), pg_temp.conta(uuid), pg_temp.links(uuid) to authenticated;
grant usage on schema extensions to authenticated;

set local role authenticated;

-- Quem não pode reativar não mexe na senha.
select pg_temp.token('a0000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.equipe_definir_ativo('a0000000-0000-0000-0000-000000000002', true) $$, null, 'Apenas administradores', 'dado quem não é administrador, quando tenta reativar, então o banco recusa');
select ok(pg_temp.senha_vale('a0000000-0000-0000-0000-000000000002', 'senha-da-colega'), 'dada a tentativa recusada, então a senha continua valendo');

-- Desativar não mexe na senha: a pessoa pode nem voltar.
select pg_temp.token('a0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.equipe_definir_ativo('a0000000-0000-0000-0000-000000000002', false) $$, 'quando o master desativa a colega, então o banco aceita');
select ok(pg_temp.senha_vale('a0000000-0000-0000-0000-000000000002', 'senha-da-colega'), 'dada a desativação, então a senha ainda não mudou');

-- Quando o master reativa a colega.
select lives_ok($$ select public.equipe_definir_ativo('a0000000-0000-0000-0000-000000000002', true) $$, 'quando o master reativa a colega, então o banco aceita');
select ok(not pg_temp.senha_vale('a0000000-0000-0000-0000-000000000002', 'senha-da-colega'), 'dada a reativação, então a senha antiga não entra mais');
select is((pg_temp.conta('a0000000-0000-0000-0000-000000000002')).recovery_token, '', 'dada a reativação, então o link de recuperação antigo acaba');
select is(pg_temp.links('a0000000-0000-0000-0000-000000000002'), 0::bigint, 'dada a reativação, então os códigos de uso único antigos acabam');
select is((pg_temp.conta('a0000000-0000-0000-0000-000000000002')).email_change, '', 'dada a reativação, então a troca de e-mail pendente é cancelada');
select is((pg_temp.conta('a0000000-0000-0000-0000-000000000002')).email, 'colega@exemplo.test', 'dada a reativação, então o e-mail de acesso continua o mesmo');
select ok(pg_temp.senha_vale('a0000000-0000-0000-0000-000000000003', 'senha-do-terceiro'), 'dada a reativação da colega, então a senha do terceiro não muda');

reset role;
select * from finish();
rollback;
