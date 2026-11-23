-- Arquivar e excluir o contrato em cascata (#284) com a demanda contínua de verdade (#313): junção do lote 9.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
-- Aqui a contínua nasce pelo caminho real da #313 (a tarefa gravada sem demanda entra nela), e não gravada direto na coluna.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com a Ana (master) e a Bia (usuária comum, que cadastrou os contratos), nenhuma das duas em grupo da equipe.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-juncao-continua',
   '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 2) as n;

-- E dois contratos da Bia, sem dinheiro: o K1 e o K2 (ativos).
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria,
                              percentual_escritorio, participantes, criado_por)
select ('c0000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', n, 'AA11', 2030, 'AA11-000' || n || '-2030',
       '10000000-0000-0000-0000-000000000001', 'CLIENTE', 'a0000000-0000-0000-0000-000000000002', 'Registro de marca', '{Registro de marca}', 'pro_labore',
       100, '[]', 'a0000000-0000-0000-0000-000000000002'
  from generate_series(1, 2) as n;
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- O que o banco guarda, sem as regras de leitura.
create function pg_temp.geral() returns uuid language sql security definer as $$
  select id from public.demandas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and continua and continua_grupo_id is null
$$;
create function pg_temp.tarefa(p_id text) returns public.tarefas language sql security definer as $$
  select * from public.tarefas where id = p_id::uuid
$$;
grant execute on function pg_temp.geral(), pg_temp.tarefa(text) to authenticated;

-- Dadas três tarefas que a Ana grava sem demanda, com ela como responsável: a TA ligada ao K1, a TB ligada ao K1 e ao K2, e a TC sem
-- contrato nenhum.
select pg_temp.entrar(1); set local role authenticated;
insert into public.tarefas (id, titulo, responsavel_id, contrato_ids, criado_por) values
  ('70000000-0000-0000-0000-00000000000a', 'Conferir a procuração', auth.uid(), '{c0000000-0000-0000-0000-000000000001}', auth.uid()),
  ('70000000-0000-0000-0000-00000000000b', 'Juntar as guias', auth.uid(), '{c0000000-0000-0000-0000-000000000001,c0000000-0000-0000-0000-000000000002}', auth.uid()),
  ('70000000-0000-0000-0000-00000000000c', 'Pagar a guia', auth.uid(), '{}', auth.uid());
reset role;
-- Então as duas entram na contínua Geral, que nasce com elas
select isnt(pg_temp.geral(), null, 'A contínua Geral nasce com a tarefa sem demanda');
select is((pg_temp.tarefa('70000000-0000-0000-0000-00000000000a')).demanda_ids, array[pg_temp.geral()], 'A TA está na contínua');
select is((pg_temp.tarefa('70000000-0000-0000-0000-00000000000b')).demanda_ids, array[pg_temp.geral()], 'A TB está na contínua');
select is((pg_temp.tarefa('70000000-0000-0000-0000-00000000000c')).demanda_ids, array[pg_temp.geral()], 'A TC está na contínua');
-- E a cascata reconhece a contínua pela coluna real
select is((select privado.demanda_continua(d) from public.demandas d where d.id = pg_temp.geral()), true, 'A cascata reconhece a contínua da #313');

-- E a Bia vê a contínua Geral e as tarefas dos contratos dela (TA e TB), mas não a TC da Ana: a contínua só agrupa
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.demandas where id = pg_temp.geral()), 1::bigint, 'A Bia vê a contínua Geral');
select is((select count(*) from public.tarefas where id in ('70000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-00000000000b')), 2::bigint,
  'A Bia vê as tarefas ligadas aos contratos dela');
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-00000000000c'), 0::bigint, 'A Bia não vê a tarefa da Ana na contínua');

-- ===== Arquivar =====
-- Quando a Bia arquiva o K1
select lives_ok($$ update public.contratos set arquivado_em = now(), arquivado_por = auth.uid() where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'A Bia arquiva o K1');
reset role;
-- Então a contínua continua ativa; a TA (só do K1 e da contínua) é arquivada junto; a TB (também do K2, ativo) fica
select is((select arquivado_em from public.demandas where id = pg_temp.geral()), null, 'A contínua nunca é arquivada com o contrato');
select isnt((pg_temp.tarefa('70000000-0000-0000-0000-00000000000a')).arquivado_em, null, 'A tarefa só do contrato e da contínua sai com ele');
select is((pg_temp.tarefa('70000000-0000-0000-0000-00000000000b')).arquivado_em, null, 'A tarefa com outro contrato ativo fica');
select is((pg_temp.tarefa('70000000-0000-0000-0000-00000000000c')).arquivado_em, null, 'A outra tarefa da contínua, sem o contrato, não é tocada');

-- Quando a Bia desarquiva o K1, então a TA volta
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ update public.contratos set arquivado_em = null, arquivado_por = null where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'A Bia desarquiva o K1');
reset role;
select is((pg_temp.tarefa('70000000-0000-0000-0000-00000000000a')).arquivado_em, null, 'A tarefa volta com o contrato');

-- ===== Excluir =====
-- Dado o K1 arquivado de novo
select pg_temp.entrar(2); set local role authenticated;
update public.contratos set arquivado_em = now(), arquivado_por = auth.uid() where id = 'c0000000-0000-0000-0000-000000000001';
-- Quando a Bia pede a prévia, então ela conta a TA (que sai junto) e nenhuma demanda (a contínua não sai)
select is(public.contrato_exclusao_previa('{c0000000-0000-0000-0000-000000000001}') ->> 'tarefas', '1', 'A prévia conta a tarefa que sai junto');
select is(public.contrato_exclusao_previa('{c0000000-0000-0000-0000-000000000001}') ->> 'demandas', '0', 'A prévia não conta a contínua');
-- Quando a Bia exclui o K1
select is(public.contratos_excluir('{c0000000-0000-0000-0000-000000000001}'), 1, 'A Bia exclui o K1');
reset role;
-- Então a contínua continua lá; a TA saiu; a TB continua, ligada só ao K2; a TC, sem o contrato, não é tocada
select is((select count(*) from public.demandas where id = pg_temp.geral()), 1::bigint, 'A contínua nunca é excluída com o contrato');
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-00000000000a'), 0::bigint, 'A tarefa só do contrato e da contínua sai');
select results_eq($$ select demanda_ids, contrato_ids from public.tarefas where id = '70000000-0000-0000-0000-00000000000b' $$,
  $$ values (array[pg_temp.geral()], '{c0000000-0000-0000-0000-000000000002}'::uuid[]) $$,
  'A tarefa com outro contrato fica, na contínua e ligada só ao outro contrato');
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-00000000000c' and demanda_ids = array[pg_temp.geral()]), 1::bigint,
  'A outra tarefa da contínua continua nela');

select * from finish();
rollback;
