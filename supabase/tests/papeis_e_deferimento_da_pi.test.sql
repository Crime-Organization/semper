-- Propriedade intelectual: titular, inventor e autor da criação só nos processos da área, e a publicação do deferimento da marca (#418).
-- Roda num banco local: supabase db start && supabase test db. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
-- Tudo é desfeito no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug) values
  ('e4180000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-418'),
  ('e4180000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-418-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e4180000-0000-0000-0000-000000000001', 'ana-418@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c4181'), now()),
  ('e4180000-0000-0000-0000-000000000002', 'davi-418@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4184'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a4180000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana-418@exemplo.test', '{"convite":"c4181"}', now(), now()),
  ('a4180000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi-418@exemplo.test', '{"convite":"c4184"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('54180000-0000-0000-0000-000000000001', 'a4180000-0000-0000-0000-000000000001', now(), now()),
  ('54180000-0000-0000-0000-000000000004', 'a4180000-0000-0000-0000-000000000004', now(), now());

-- As pessoas e os processos, gravados direto (sem os gatilhos de cadastro):
--   PI: administrativo de propriedade intelectual (a área escrita sem acento e em minúsculas); PJ: judicial da mesma área;
--   PR: administrativo previdenciário; SA: sem área; e, no outro escritório, DV: um processo de PI do Davi.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('14180000-0000-0000-0000-000000000001', 'e4180000-0000-0000-0000-000000000001', 'C1', 'contato', 'TITULAR TESTE', 'a4180000-0000-0000-0000-000000000001'),
  ('14180000-0000-0000-0000-000000000004', 'e4180000-0000-0000-0000-000000000002', 'C1', 'contato', 'OUTRA PESSOA', 'a4180000-0000-0000-0000-000000000004');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, area, responsavel_id, colaboradores, clientes, criado_por) values
  ('74180000-0000-0000-0000-000000000001', 'e4180000-0000-0000-0000-000000000001', 'PI', 'administrativo', '941800001', ' propriedade INTELECTUAL ',
   'a4180000-0000-0000-0000-000000000001', '{}', '{14180000-0000-0000-0000-000000000001}', 'a4180000-0000-0000-0000-000000000001'),
  ('74180000-0000-0000-0000-000000000002', 'e4180000-0000-0000-0000-000000000001', 'PJ', 'judicial', '941800002', 'Propriedade intelectual',
   'a4180000-0000-0000-0000-000000000001', '{}', '{14180000-0000-0000-0000-000000000001}', 'a4180000-0000-0000-0000-000000000001'),
  ('74180000-0000-0000-0000-000000000003', 'e4180000-0000-0000-0000-000000000001', 'PR', 'administrativo', '941800003', 'Previdenciário',
   'a4180000-0000-0000-0000-000000000001', '{}', '{14180000-0000-0000-0000-000000000001}', 'a4180000-0000-0000-0000-000000000001'),
  ('74180000-0000-0000-0000-000000000004', 'e4180000-0000-0000-0000-000000000001', 'SA', 'administrativo', '941800004', null,
   'a4180000-0000-0000-0000-000000000001', '{}', '{14180000-0000-0000-0000-000000000001}', 'a4180000-0000-0000-0000-000000000001'),
  ('74180000-0000-0000-0000-000000000005', 'e4180000-0000-0000-0000-000000000002', 'DV', 'administrativo', '941800005', 'Propriedade intelectual',
   'a4180000-0000-0000-0000-000000000004', '{}', '{14180000-0000-0000-0000-000000000004}', 'a4180000-0000-0000-0000-000000000004');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a4180000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '54180000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

-- ---------- 1. Titular, inventor e autor da criação só na propriedade intelectual ----------
select pg_temp.entrar(1); set local role authenticated;
-- Dado um processo que não é de propriedade intelectual, quando alguém tenta pôr titular, inventor ou autor da criação, então o banco recusa.
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('74180000-0000-0000-0000-000000000003', '14180000-0000-0000-0000-000000000001', 'titular') $$, 'P0001',
  'Titular, inventor e autor da criação só existem nos processos de propriedade intelectual.', 'Quando põe titular num processo previdenciário, então é recusado');
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('74180000-0000-0000-0000-000000000003', '14180000-0000-0000-0000-000000000001', 'inventor') $$, 'P0001', null,
  'Quando põe inventor num processo previdenciário, então é recusado');
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('74180000-0000-0000-0000-000000000004', '14180000-0000-0000-0000-000000000001', 'autor_da_criacao') $$, 'P0001', null,
  'Quando põe autor da criação num processo sem área, então é recusado');
-- Então os papéis de qualquer processo continuam entrando fora da propriedade intelectual.
select lives_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('74180000-0000-0000-0000-000000000003', '14180000-0000-0000-0000-000000000001', 'testemunha') $$,
  'Então a testemunha continua entrando no processo previdenciário');
-- Dado um processo de propriedade intelectual (a área sem contar maiúsculas, acentos e espaços), então os três papéis entram.
select lives_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('74180000-0000-0000-0000-000000000001', '14180000-0000-0000-0000-000000000001', 'titular'),
  ('74180000-0000-0000-0000-000000000001', '14180000-0000-0000-0000-000000000001', 'inventor'),
  ('74180000-0000-0000-0000-000000000001', '14180000-0000-0000-0000-000000000001', 'autor_da_criacao') $$,
  'Quando põe titular, inventor e autor da criação no administrativo de PI, então entram');
-- E o judicial da área também aceita o titular (a área é a mesma; só os campos da proteção são do administrativo).
select lives_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('74180000-0000-0000-0000-000000000002', '14180000-0000-0000-0000-000000000001', 'titular') $$,
  'Quando põe titular no judicial de PI, então entra');
reset role;

-- Dado o processo de PI do outro escritório, quando a Ana tenta pôr uma pessoa dela nele, então é recusado (o escritório é isolado).
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('74180000-0000-0000-0000-000000000005', '14180000-0000-0000-0000-000000000001', 'titular') $$, null, null,
  'Quando alguém põe titular no processo de outro escritório, então é recusado');
reset role;
select is((select count(*) from public.processo_partes where processo_id = '74180000-0000-0000-0000-000000000005'), 0::bigint,
  'Então o processo do outro escritório continua sem ninguém com papel');
-- Dado o Davi, no processo de PI dele, então o titular entra (o gatilho olha o processo do escritório da linha).
select pg_temp.entrar(4); set local role authenticated;
select lives_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('74180000-0000-0000-0000-000000000005', '14180000-0000-0000-0000-000000000004', 'titular') $$,
  'Quando o Davi põe titular no processo de PI dele, então entra');
reset role;

-- ---------- 2. A publicação do deferimento da marca ----------
-- Dados os processos de antes, então a data do deferimento nasce vazia (a versão anterior do site não a conhece).
select is((select deferimento from public.processos where id = '74180000-0000-0000-0000-000000000001'), null, 'Então a data do deferimento nasce vazia');
select pg_temp.entrar(1); set local role authenticated;
-- Quando a Ana informa a publicação do deferimento da marca, então é gravada e vai para o histórico.
select lives_ok($$ update public.processos set protecao = 'marca', deposito = '2025-03-10', deferimento = '2026-10-06'
  where id = '74180000-0000-0000-0000-000000000001' $$, 'Quando informa a publicação do deferimento, então é gravada');
select is((select deferimento from public.processos where id = '74180000-0000-0000-0000-000000000001'), '2026-10-06'::date, 'Então a data fica no processo');
select is((select alteracoes -> 'deferimento' ->> 'para' from public.processo_historico where processo_id = '74180000-0000-0000-0000-000000000001'
           and alteracoes ? 'deferimento' order by em desc limit 1), '2026-10-06', 'Então o histórico mostra a publicação do deferimento');
-- Quando grava a data num judicial, então ela fica vazia, como os outros campos de PI (#425).
select lives_ok($$ update public.processos set deferimento = '2026-10-06' where id = '74180000-0000-0000-0000-000000000002' $$,
  'Quando grava o deferimento num judicial, então a alteração é aceita');
select is((select deferimento from public.processos where id = '74180000-0000-0000-0000-000000000002'), null, 'Então o judicial continua sem a data');
reset role;
-- Quando o Davi, do outro escritório, tenta ler ou mudar a data, então não vê nem muda nada.
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.processos where id = '74180000-0000-0000-0000-000000000001'), 0::bigint, 'Quando o outro escritório lê, então não vê o processo');
update public.processos set deferimento = '2020-01-01' where id = '74180000-0000-0000-0000-000000000001';
reset role;
select is((select deferimento from public.processos where id = '74180000-0000-0000-0000-000000000001'), '2026-10-06'::date,
  'Quando o outro escritório muda a data, então nada muda');

select * from finish();
rollback;
