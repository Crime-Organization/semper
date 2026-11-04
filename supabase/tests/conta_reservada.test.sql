-- Conta reservada: consta na equipe, sem acesso ao sistema (#215). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Dado um escritório com o master e um usuário comum, outro escritório com o seu master, e a pessoa a reservar.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-reserva'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-reserva-outro');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'comum@exemplo.test', 'Comum', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'estranho@exemplo.test', 'Estranho', 'master', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mestre@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'comum@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'estranho@exemplo.test', '{"convite":"c3"}', now(), now());
insert into public.pessoas (id, escritorio_id, tipo, nome, documento) values
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Bia Reservada', '52998224725'),
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Cliente', '11144477735'),
  ('b0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'pf', 'Com convite', '39053344705');
insert into public.convites (escritorio_id, email, nome, papel, pessoa_id, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'real@exemplo.test', 'Com convite', 'usuario', 'b0000000-0000-0000-0000-000000000003', privado.resumo_codigo('c4'), now());

create function pg_temp.preparar(p_usuario uuid, p_pessoa uuid) returns text language sql as $$
  select resultado from public.equipe_reserva_preparar(p_usuario, 'aal1', p_pessoa)
$$;

-- Quem não pode reservar: nada acontece.
select is(pg_temp.preparar('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'), 'sem-permissao', 'Dado um usuário comum, quando tenta reservar, então é recusado');
select is(pg_temp.preparar('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'), 'sem-permissao', 'Dado alguém de outro escritório, quando tenta reservar, então é recusado');
select is(pg_temp.preparar('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003'), 'convite-pendente', 'Dado uma pessoa com convite pendente, quando tenta reservar, então é recusado');
select is((select count(*)::int from public.convites where email like '%@reservada.invalid'), 0, 'As recusas não criam convite');
select is((select has_function_privilege('authenticated', 'public.equipe_reserva_preparar(uuid, text, uuid)', 'execute')), false, 'Pelo site, ninguém chama a função direto');

-- Quando o administrador reserva e o login cria a conta, então o perfil nasce sem acesso.
create temp table reserva as select * from public.equipe_reserva_preparar('a0000000-0000-0000-0000-000000000001', 'aal1', 'b0000000-0000-0000-0000-000000000001');
select is((select resultado from reserva), 'pronto', 'O administrador pode reservar');
select matches((select email from reserva), '^conta-[0-9a-f-]+@reservada\.invalid$', 'O e-mail é só uma marca');
insert into auth.users (id, aud, role, email, raw_user_meta_data, banned_until, created_at, updated_at)
  select 'a0000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', email, jsonb_build_object('convite', codigo), 'infinity', now(), now() from reserva;
select public.equipe_reserva_concluir('a0000000-0000-0000-0000-000000000001', (select email from reserva));
select is((select reservada and not ativo from public.perfis where id = 'a0000000-0000-0000-0000-000000000009'), true, 'O perfil fica reservado e desativado');
select is((select pessoa_id from public.perfis where id = 'a0000000-0000-0000-0000-000000000009'), 'b0000000-0000-0000-0000-000000000001'::uuid, 'O perfil fica ligado à pessoa escolhida');
select is((select resumo ->> 'nome' from public.auditoria where acao = 'reserva_conta'), 'Bia Reservada', 'A reserva fica no registro de ações');
select is(pg_temp.preparar('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'), 'ja-na-equipe', 'Dado quem já é da equipe, quando tenta reservar, então é recusado');

-- Então ela pode ser responsável por contrato e participante.
insert into public.contratos (escritorio_id, cliente_id, responsavel_id, participantes, servico, categoria)
values ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000009', '[]', 'Como responsável', 'pro_labore');
select is((select left(codigo, 4) from public.contratos where servico = 'Como responsável'), 'BI25', 'A conta reservada pode ser responsável por contrato');
select lives_ok($$ update public.contratos set participantes = '[{"pessoa_id":"b0000000-0000-0000-0000-000000000001"}]', responsavel_id = (select id from public.perfis where usuario like 'mestre%' and escritorio_id = 'e0000000-0000-0000-0000-000000000001' limit 1) where servico = 'Como responsável' $$,
  'A conta reservada pode ser participante');

-- Então reativar não é caminho para o acesso.
select throws_ok($$ update public.perfis set ativo = true where id = 'a0000000-0000-0000-0000-000000000009' $$, null, 'Esta conta está reservada: a pessoa não tem acesso ao sistema.', 'Dado uma conta reservada, quando alguém tenta reativar, então é recusado');

-- Então, mesmo com um token válido, ela não vê os dados do escritório.
insert into auth.sessions (id, user_id, created_at, updated_at) values ('50000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000009', now(), now());
select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000009', 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-00000000000a')::text, true);
set local role authenticated;
select is((select count(*)::int from public.contratos), 0, 'A conta reservada não vê nenhum contrato');
reset role;

-- Quando o login recusa, então o convite que sobrou some.
create temp table desistencia as select * from public.equipe_reserva_preparar('a0000000-0000-0000-0000-000000000001', 'aal1', 'b0000000-0000-0000-0000-000000000002');
select public.equipe_reserva_desistir('a0000000-0000-0000-0000-000000000001', (select email from desistencia));
select is((select count(*)::int from public.convites where email = (select email from desistencia)), 0, 'Dado que o login recusou, quando desiste, então o convite é apagado');

select * from finish();
rollback;
