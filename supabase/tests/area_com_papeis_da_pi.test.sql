-- Propriedade intelectual: o processo com titular, inventor ou autor da criação não sai da área (#418).
-- Roda num banco local: supabase db start && supabase test db. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
-- Tudo é desfeito no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com a Ana (master) e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug) values
  ('e4182000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-418-area'),
  ('e4182000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-418-area-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e4182000-0000-0000-0000-000000000001', 'ana-418a@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c4181a'), now()),
  ('e4182000-0000-0000-0000-000000000002', 'davi-418a@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4184a'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a4182000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana-418a@exemplo.test', '{"convite":"c4181a"}', now(), now()),
  ('a4182000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi-418a@exemplo.test', '{"convite":"c4184a"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('54182000-0000-0000-0000-000000000001', 'a4182000-0000-0000-0000-000000000001', now(), now()),
  ('54182000-0000-0000-0000-000000000004', 'a4182000-0000-0000-0000-000000000004', now(), now());

-- Gravados direto (sem os gatilhos de cadastro):
--   PI: de propriedade intelectual, com um titular; SP: de propriedade intelectual, só com uma testemunha;
--   AN: um processo antigo, já fora da área, com um titular (de antes do gatilho papel_so_da_pi).
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('14182000-0000-0000-0000-000000000001', 'e4182000-0000-0000-0000-000000000001', 'C1', 'contato', 'TITULAR TESTE', 'a4182000-0000-0000-0000-000000000001');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, area, responsavel_id, colaboradores, clientes, criado_por) values
  ('74182000-0000-0000-0000-000000000001', 'e4182000-0000-0000-0000-000000000001', 'PI', 'administrativo', '941820001', 'Propriedade intelectual',
   'a4182000-0000-0000-0000-000000000001', '{}', '{14182000-0000-0000-0000-000000000001}', 'a4182000-0000-0000-0000-000000000001'),
  ('74182000-0000-0000-0000-000000000002', 'e4182000-0000-0000-0000-000000000001', 'SP', 'administrativo', '941820002', 'propriedade INTELECTUAL',
   'a4182000-0000-0000-0000-000000000001', '{}', '{14182000-0000-0000-0000-000000000001}', 'a4182000-0000-0000-0000-000000000001'),
  ('74182000-0000-0000-0000-000000000003', 'e4182000-0000-0000-0000-000000000001', 'AN', 'administrativo', '941820003', 'Cível',
   'a4182000-0000-0000-0000-000000000001', '{}', '{14182000-0000-0000-0000-000000000001}', 'a4182000-0000-0000-0000-000000000001');
insert into public.processo_partes (escritorio_id, processo_id, pessoa_id, papel) values
  ('e4182000-0000-0000-0000-000000000001', '74182000-0000-0000-0000-000000000001', '14182000-0000-0000-0000-000000000001', 'titular'),
  ('e4182000-0000-0000-0000-000000000001', '74182000-0000-0000-0000-000000000002', '14182000-0000-0000-0000-000000000001', 'testemunha'),
  ('e4182000-0000-0000-0000-000000000001', '74182000-0000-0000-0000-000000000003', '14182000-0000-0000-0000-000000000001', 'titular');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a4182000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '54182000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

select pg_temp.entrar(1); set local role authenticated;
-- Dado o processo de PI com titular, quando a Ana muda a área para outra, então o banco recusa.
select throws_ok($$ update public.processos set area = 'Cível' where id = '74182000-0000-0000-0000-000000000001' $$, 'P0001',
  'Este processo tem titular, inventor ou autor da criação: tire essas pessoas do processo antes de mudar a área.',
  'Quando o processo com titular sai da área de PI, então é recusado');
select throws_ok($$ update public.processos set area = null where id = '74182000-0000-0000-0000-000000000001' $$, 'P0001', null,
  'Quando a área do processo com titular é apagada, então é recusado');
-- Quando a área continua de PI (escrita de outro jeito), ou outro campo muda, então passa.
select lives_ok($$ update public.processos set area = ' propriedade intelectual ', titulo = 'Marca' where id = '74182000-0000-0000-0000-000000000001' $$,
  'Quando a área continua de PI, então passa');
-- Dado o processo de PI só com papéis de qualquer processo, quando sai da área, então passa.
select lives_ok($$ update public.processos set area = 'Cível' where id = '74182000-0000-0000-0000-000000000002' $$,
  'Quando o processo sem os papéis de PI sai da área, então passa');
-- Dado o processo antigo, já fora da área com um titular, quando muda para outra área, então passa (não trava o que já existia).
select lives_ok($$ update public.processos set area = 'Previdenciário' where id = '74182000-0000-0000-0000-000000000003' $$,
  'Quando o processo antigo fora da área muda de área, então passa');
-- E depois de tirar o titular, o processo de PI sai da área.
delete from public.processo_partes where processo_id = '74182000-0000-0000-0000-000000000001';
select lives_ok($$ update public.processos set area = 'Cível' where id = '74182000-0000-0000-0000-000000000001' $$,
  'Quando o titular sai antes, então o processo muda de área');
reset role;
select is((select area from public.processos where id = '74182000-0000-0000-0000-000000000001'), 'Cível', 'Então a área nova ficou gravada');

-- Dado o Davi, do outro escritório, quando tenta mudar a área, então nada muda (o escritório é isolado).
select pg_temp.entrar(4); set local role authenticated;
update public.processos set area = 'Trabalhista' where id = '74182000-0000-0000-0000-000000000002';
reset role;
select is((select area from public.processos where id = '74182000-0000-0000-0000-000000000002'), 'Cível', 'Então o outro escritório não muda a área');

select * from finish();
rollback;
