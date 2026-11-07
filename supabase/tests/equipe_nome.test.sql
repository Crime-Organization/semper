-- O nome de quem é da equipe, mudado em "Equipe e acessos" (equipe_definir_nome). Roda num banco local:
-- supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Dado um escritório com um master, uma administradora e um usuário comum.
insert into public.escritorios (id, nome, slug) values ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-equipe-nome');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre', 'master', privado.resumo_codigo('c0'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'adm@exemplo.test', 'Adm', 'admin', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'comum@exemplo.test', 'Comum', 'usuario', privado.resumo_codigo('c2'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mestre@exemplo.test', '{"convite":"c0"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'adm@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'comum@exemplo.test', '{"convite":"c2"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', now(), now()),
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now());
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.nome(p_quem int) returns text language sql security definer as $$
  select nome from public.perfis where id = ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid
$$;

-- Quando a administradora muda o nome do usuário comum, então muda, sem espaços nas pontas, e fica no registro.
select pg_temp.entrar(1);
set local role authenticated;
select lives_ok($$ select public.equipe_definir_nome('a0000000-0000-0000-0000-000000000002', '  Comum da Silva  ') $$, 'A administradora muda o nome de um usuário');
reset role;
select is(pg_temp.nome(2), 'Comum da Silva', 'O nome fica salvo, sem os espaços das pontas');
select is((select resumo ->> 'antes' from public.auditoria where tabela = 'perfis' and registro_id = 'a0000000-0000-0000-0000-000000000002' and resumo ? 'antes'), 'Comum', 'A troca fica no registro de ações, com o nome de antes');

-- Quando a administradora tenta mudar o do master, ou um nome curto demais, então é recusado.
select pg_temp.entrar(1);
set local role authenticated;
select throws_ok($$ select public.equipe_definir_nome('a0000000-0000-0000-0000-000000000000', 'Outro') $$, null, 'Só o próprio master muda o nome dele.', 'Ninguém muda o nome do master');
select throws_ok($$ select public.equipe_definir_nome('a0000000-0000-0000-0000-000000000002', 'X') $$, null, 'Informe um nome de 2 a 200 letras.', 'Nome de uma letra é recusado');

-- Quando o usuário comum tenta, então é recusado.
select pg_temp.entrar(2);
select throws_ok($$ select public.equipe_definir_nome('a0000000-0000-0000-0000-000000000001', 'Outra') $$, null, 'Apenas administradores mudam o nome de alguém da equipe', 'Usuário comum não muda nomes');

-- Quando o master muda o nome da administradora e o dele, então muda.
select pg_temp.entrar(0);
select lives_ok($$ select public.equipe_definir_nome('a0000000-0000-0000-0000-000000000001', 'Adm Nova') $$, 'O master muda o nome de uma administradora');
reset role;
select is(pg_temp.nome(1), 'Adm Nova', 'O nome da administradora mudou');

select * from finish();
rollback;
