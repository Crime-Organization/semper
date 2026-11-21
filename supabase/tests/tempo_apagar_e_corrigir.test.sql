-- Apagar e corrigir os registros de tempo das tarefas (#400): cada um mexe nos próprios; o administrador, nos de qualquer um do
-- escritório; ninguém, nos de outro escritório. Corrigir pede o motivo, e tudo vai ao histórico da tarefa, sem a duração.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Dado um escritório com Ana (administradora), Bia e Caio (não administradores), e o Davi, administrador de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-tempo-corrigir', '{"tarefas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-tempo-corrigir-2', '{"tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now());

-- E uma tarefa em que Bia e Caio estão, com um período contado e um ajuste de cada um (de três dias atrás).
set local session_replication_role = replica;
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Tarefa', 'a0000000-0000-0000-0000-000000000002',
   '{a0000000-0000-0000-0000-000000000003}', 'a0000000-0000-0000-0000-000000000001');
insert into public.tarefa_tempos (id, escritorio_id, tarefa_id, perfil_id, inicio, segundos, ajuste, motivo, criado_em)
  overriding system value values
  (1, 'e0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   timestamptz '2026-11-18 14:00-03', 3600, false, null, timestamptz '2026-11-18 14:00-03'),
  (2, 'e0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   timestamptz '2026-11-18 15:00-03', 600, true, 'Esqueci de iniciar', timestamptz '2026-11-18 15:00-03'),
  (3, 'e0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
   timestamptz '2026-11-18 16:00-03', 1800, false, null, timestamptz '2026-11-18 16:00-03'),
  (4, 'e0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
   timestamptz '2026-11-18 17:00-03', 1200, false, null, timestamptz '2026-11-18 17:00-03');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function pg_temp.segundos(p_id bigint) returns integer language sql as $$ select segundos from public.tarefa_tempos where id = p_id $$;
create function pg_temp.historico(p_texto text) returns bigint language sql as $$
  select count(*) from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001' and alteracoes -> 'tempo' ->> 'para' like p_texto
$$;

-- Quando Bia corrige o próprio período (a duração e o dia), com o motivo, então ele muda e a correção fica no histórico, sem a duração.
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudou($$update public.tarefa_tempos set segundos = 2400, inicio = timestamptz '2026-11-17 14:00-03',
  motivo_da_correcao = 'Contei o almoço', corrigido_em = now() where id = 1$$), 1, 'Bia corrige o próprio período');
reset role;
select is(pg_temp.segundos(1), 2400, 'O período da Bia ficou com a duração corrigida');
select ok((select corrigido_por = 'a0000000-0000-0000-0000-000000000002' and motivo_da_correcao = 'Contei o almoço' from public.tarefa_tempos where id = 1),
  'A correção guarda quem corrigiu e o motivo');
select is(pg_temp.historico('Corrigido o tempo contado de Bia, de 18/11/2026, que passou para 17/11/2026. Motivo: Contei o almoço'), 1::bigint,
  'A correção vai ao histórico da tarefa, com o dia e o motivo');
select is(pg_temp.historico('%2400%'), 0::bigint, 'O histórico não mostra a duração');

-- Quando Bia corrige o próprio ajuste para menos, então ele muda (o ajuste também se corrige).
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudou($$update public.tarefa_tempos set segundos = 300, motivo_da_correcao = 'Eram 5 minutos', corrigido_em = now() where id = 2$$), 1,
  'Bia corrige o próprio ajuste');
-- Quando Bia tenta corrigir sem dizer o motivo, então o banco recusa.
select throws_ok($$update public.tarefa_tempos set segundos = 100, motivo_da_correcao = ' ', corrigido_em = now() + interval '1 second' where id = 2$$,
  null, null, 'Corrigir sem motivo é recusado');
-- Quando Bia tenta mudar o dia sem corrigir, então o banco recusa.
select throws_ok($$update public.tarefa_tempos set inicio = now() - interval '5 days' where id = 1$$,
  'Para mudar o dia do registro, corrija-o com o motivo.', 'Mudar o dia sem corrigir é recusado');
-- Quando Bia tenta corrigir e apagar o registro do Caio, então nada muda.
select is(pg_temp.mudou($$update public.tarefa_tempos set segundos = 60, motivo_da_correcao = 'Não é meu', corrigido_em = now() where id = 3$$), 0,
  'Bia não corrige o registro do Caio');
select is(pg_temp.mudou($$delete from public.tarefa_tempos where id = 3$$), 0, 'Bia não apaga o registro do Caio');
-- Quando Bia apaga o próprio ajuste, então ele sai, e o apagar fica no histórico.
select is(pg_temp.mudou($$delete from public.tarefa_tempos where id = 2$$), 1, 'Bia apaga o próprio ajuste');
reset role;
select is(pg_temp.historico('Apagado o ajuste de tempo de Bia, de 18/11/2026'), 1::bigint, 'Apagar vai ao histórico da tarefa');
select is(pg_temp.segundos(3), 1800, 'O registro do Caio continua como estava');

-- Quando Bia devolve o ajuste que apagou (o Desfazer), então ele volta, com o histórico; o do Caio ela não devolve em nome dele.
select pg_temp.entrar(2); set local role authenticated;
select ok(public.tempo_devolver('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', timestamptz '2026-11-18 15:00-03',
  300, true, 'Eram 5 minutos') > 0, 'Bia devolve o próprio registro apagado');
select throws_ok($$select public.tempo_devolver('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', now(), 60, false, null)$$,
  'Só quem registrou o tempo, ou um administrador, devolve o registro.', 'Bia não devolve um registro em nome do Caio');
reset role;
select is(pg_temp.historico('Devolvido o ajuste de tempo de Bia, de 18/11/2026'), 1::bigint, 'Devolver vai ao histórico da tarefa');

-- Quando o Caio, sem corrigir, tenta gravar o cronômetro no período da Bia, então o banco recusa (só o dono grava o próprio período).
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.mudou($$update public.tarefa_tempos set segundos = 9999 where id = 1$$), 0, 'Caio não grava o cronômetro no período da Bia');
reset role;

-- Quando Ana, administradora, corrige e apaga os registros do Caio, então pode.
select pg_temp.entrar(1); set local role authenticated;
select is(pg_temp.mudou($$update public.tarefa_tempos set segundos = 900, motivo_da_correcao = 'Revisão do mês', corrigido_em = now() where id = 3$$), 1,
  'A administradora corrige o registro do Caio');
select is(pg_temp.mudou($$delete from public.tarefa_tempos where id = 4$$), 1, 'A administradora apaga o registro do Caio');
-- Mas, sem corrigir, ela não grava o cronômetro de outra pessoa.
select throws_ok($$update public.tarefa_tempos set segundos = 1000 where id = 3$$, null, null, 'A administradora não grava o cronômetro de outra pessoa');
-- E devolve o registro do Caio que apagou.
select ok(public.tempo_devolver('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', timestamptz '2026-11-18 17:00-03',
  1200, false, null) > 0, 'A administradora devolve o registro do Caio');
reset role;
select is(pg_temp.segundos(3), 900, 'O registro do Caio ficou com a duração corrigida pela administradora');

-- Quando Davi, administrador de outro escritório, tenta corrigir, apagar ou devolver, então nada acontece.
select pg_temp.entrar(4); set local role authenticated;
select is(pg_temp.mudou($$update public.tarefa_tempos set segundos = 60, motivo_da_correcao = 'De fora', corrigido_em = now() where id = 3$$)
  + pg_temp.mudou($$delete from public.tarefa_tempos where id in (1, 3)$$), 0, 'Outro escritório não corrige nem apaga');
select throws_ok($$select public.tempo_devolver('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', now(), 60, false, null)$$,
  'Tarefa não encontrada.', 'Outro escritório não devolve registro na tarefa');
reset role;

select * from finish();
rollback;
