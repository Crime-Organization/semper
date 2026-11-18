-- A data de início de tarefas e demandas (#357): nasce no dia da criação (Brasília), quem altera o cartão a muda, a mudança fica no
-- histórico e outro escritório continua sem ver nada.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum, participante), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-inicio', '{"pessoas": true, "tarefas": true, "demandas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-inicio-2', '{"pessoas": true, "tarefas": true, "demandas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now());

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.hoje() returns date language sql as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- O que já existia no banco quando a migração rodou começa no dia da criação (no banco local de teste, a lista costuma estar vazia).
select is((select count(*) from public.tarefas where data_inicio <> (criado_em at time zone 'America/Sao_Paulo')::date and criado_em < now() - interval '1 minute'),
  0::bigint, 'As tarefas que já existiam começam no dia em que foram criadas');
select is((select count(*) from public.demandas where data_inicio <> (criado_em at time zone 'America/Sao_Paulo')::date and criado_em < now() - interval '1 minute'),
  0::bigint, 'As demandas que já existiam começam no dia em que foram criadas');
select col_not_null('public', 'tarefas', 'data_inicio', 'A tarefa sempre tem data de início');
select col_not_null('public', 'demandas', 'data_inicio', 'A demanda sempre tem data de início');

-- Quando a Ana cadastra como o site antigo, sem a data de início
select pg_temp.entrar(1); set local role authenticated;
insert into public.tarefas (id, escritorio_id, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Tarefa antiga', 'a0000000-0000-0000-0000-000000000001',
   '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001');
insert into public.demandas (id, escritorio_id, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Demanda antiga', 'a0000000-0000-0000-0000-000000000001',
   '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001');
-- E como o site novo, que pode mandar outro início
insert into public.tarefas (id, escritorio_id, titulo, responsavel_id, criado_por, data_inicio) values
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Tarefa que começa depois', 'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', '2030-01-15');
reset role;
-- Então a data de início é hoje, em Brasília, o mesmo dia do criado_em
select is((select data_inicio from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), pg_temp.hoje(), 'Tarefa gravada sem a coluna começa hoje');
select is((select data_inicio from public.demandas where id = '71000000-0000-0000-0000-000000000001'), pg_temp.hoje(), 'Demanda gravada sem a coluna começa hoje');
select is((select data_inicio = (criado_em at time zone 'America/Sao_Paulo')::date from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), true,
  'O início padrão é o dia da criação');
select is((select data_inicio from public.tarefas where id = '70000000-0000-0000-0000-000000000002'), '2030-01-15'::date, 'O início mandado no cadastro vale');

-- A conta que a migração usa no preenchimento (passo 2) e no padrão da coluna: o dia de Brasília de um instante. Este caso confere só
-- a conta, num instante fixo (23h30 de Brasília, já o dia seguinte em UTC); o preenchimento das linhas que já existiam é conferido
-- pelas contagens do começo, que só provam algo num banco com linhas de antes da migração (o ensaio com a cópia do banco).
select is(('2026-03-10 02:30:00+00'::timestamptz at time zone 'America/Sao_Paulo')::date, '2026-03-09'::date,
  'O dia de Brasília de um instante às 23h30 de lá é o próprio dia, e não o seguinte de UTC');

-- Quando a Bia, participante comum, muda a data de início
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ update public.tarefas set data_inicio = '2026-11-25' where id = '70000000-0000-0000-0000-000000000001' $$, 'A participante muda o início da tarefa');
select lives_ok($$ update public.demandas set data_inicio = '2026-12-01' where id = '71000000-0000-0000-0000-000000000001' $$, 'A colaboradora muda o início da demanda');
select throws_ok($$ update public.tarefas set data_inicio = null where id = '70000000-0000-0000-0000-000000000001' $$, '23502', null, 'O início não fica vazio');
-- E o site antigo muda outro campo
select lives_ok($$ update public.tarefas set titulo = 'Tarefa antiga, mudada' where id = '70000000-0000-0000-0000-000000000001' $$, 'O site antigo continua gravando');
reset role;
-- Então a mudança fica no histórico, com a data de antes e a nova, e por quem
select is((select data_inicio from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), '2026-11-25'::date, 'Mudar outro campo não mexe no início');
select is((select alteracoes -> 'data_inicio' from public.tarefa_historico
  where tarefa_id = '70000000-0000-0000-0000-000000000001' and alteracoes ? 'data_inicio' and feito_por = 'a0000000-0000-0000-0000-000000000002'),
  jsonb_build_object('de', pg_temp.hoje(), 'para', '2026-11-25'), 'O histórico da tarefa guarda o início de antes e o novo');
select is((select alteracoes -> 'data_inicio' -> 'para' from public.demanda_historico
  where demanda_id = '71000000-0000-0000-0000-000000000001' and alteracoes ? 'data_inicio'), to_jsonb('2026-12-01'::text), 'O histórico da demanda guarda o início novo');
select is((select count(*) from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001' and alteracoes ? 'titulo' and alteracoes ? 'data_inicio'),
  0::bigint, 'A mudança de outro campo não aparece como mudança do início');

-- Quando alguém de outro escritório tenta ler e mudar
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.tarefas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 0::bigint, 'Outro escritório não vê as tarefas');
select is((select count(*) from public.demandas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 0::bigint, 'Outro escritório não vê as demandas');
update public.tarefas set data_inicio = '2020-01-01' where id = '70000000-0000-0000-0000-000000000001';
update public.demandas set data_inicio = '2020-01-01' where id = '71000000-0000-0000-0000-000000000001';
reset role;
-- Então nada muda
select is((select data_inicio from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), '2026-11-25'::date, 'Outro escritório não muda o início da tarefa');
select is((select data_inicio from public.demandas where id = '71000000-0000-0000-0000-000000000001'), '2026-12-01'::date, 'Outro escritório não muda o início da demanda');

set local role anon;
select throws_ok($$ update public.tarefas set data_inicio = '2020-01-01' $$, '42501', null, 'Quem não entrou não muda nada');
reset role;

select * from finish();
rollback;
