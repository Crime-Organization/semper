-- A pessoa sempre pode sair de um cartão, e a saída fica registrada (#276).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (responsável) e Bia (participante comum), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-sair', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-sair-2', '{"pessoas": true}');
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
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Tarefa', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, colaboradores, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, participantes, criado_por) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'C1', 'reuniao', 'Reuniao', '2030-01-15', '14:30', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001');
-- Cartões com um colega que saiu da equipe: o perfil dele não existe mais, e a lista ainda guarda o id.
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'T2', 'Com colega removido', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-00000000dead}', 'a0000000-0000-0000-0000-000000000001');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Com colega removido', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-00000000dead}', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

-- Quando quem é de fora tenta sair, então nada muda
select pg_temp.entrar(4); set local role authenticated;
select throws_ok($$ select public.cartao_sair('tarefas', '70000000-0000-0000-0000-000000000001') $$, 'P0001', 'Você não está entre as pessoas deste cartão.', 'Outro escritório não mexe no cartão');
reset role;

-- Quando a participante sai de cada cartão
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ select public.cartao_sair('tarefas', '70000000-0000-0000-0000-000000000001') $$, 'Sai da tarefa');
select lives_ok($$ select public.cartao_sair('demandas', '71000000-0000-0000-0000-000000000001') $$, 'Sai da demanda');
select lives_ok($$ select public.cartao_sair('processos', '73000000-0000-0000-0000-000000000001') $$, 'Sai do processo');
select lives_ok($$ select public.cartao_sair('compromissos', '72000000-0000-0000-0000-000000000001') $$, 'Sai do compromisso');
select lives_ok($$ select public.cartao_sair('tarefas', '70000000-0000-0000-0000-000000000002') $$, 'Colega que saiu da equipe não trava a saída da tarefa');
select lives_ok($$ select public.cartao_sair('demandas', '71000000-0000-0000-0000-000000000002') $$, 'Colega que saiu da equipe não trava a saída da demanda');
-- Então perde o acesso, sem erro
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 0::bigint, 'Depois de sair, não vê mais a tarefa');
select throws_ok($$ select public.cartao_sair('tarefas', '70000000-0000-0000-0000-000000000001') $$, 'P0001', 'Você não está entre as pessoas deste cartão.', 'Quem não está no cartão não sai de novo');
select throws_ok($$ select public.cartao_sair('contratos', 'c0000000-0000-0000-0000-000000000001') $$, 'P0001', 'Você não tem permissão para fazer isso.', 'Contrato fica de fora');
select throws_ok($$ select public.cartao_sair('perfis; drop table x', '70000000-0000-0000-0000-000000000001') $$, 'P0001', 'Você não tem permissão para fazer isso.', 'Só os módulos previstos');
reset role;

-- Então a saída foi feita e ficou no histórico, com quem saiu
select is((select participantes from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), '{}'::uuid[], 'A tarefa ficou sem ela');
select is((select colaboradores from public.demandas where id = '71000000-0000-0000-0000-000000000001'), '{}'::uuid[], 'A demanda ficou sem ela');
select is((select colaboradores from public.processos where id = '73000000-0000-0000-0000-000000000001'), '{}'::uuid[], 'O processo ficou sem ela');
select is((select participantes from public.compromissos where id = '72000000-0000-0000-0000-000000000001'), '{}'::uuid[], 'O compromisso ficou sem ela');
select is((select count(*) from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001' and feito_por = 'a0000000-0000-0000-0000-000000000002'), 1::bigint, 'A saída da tarefa fica no histórico, com quem saiu');
select is((select count(*) from public.demanda_historico where demanda_id = '71000000-0000-0000-0000-000000000001' and feito_por = 'a0000000-0000-0000-0000-000000000002'), 1::bigint, 'A saída da demanda fica no histórico');
select is((select count(*) from public.processo_historico where processo_id = '73000000-0000-0000-0000-000000000001' and feito_por = 'a0000000-0000-0000-0000-000000000002') > 0, true, 'A saída do processo fica no histórico');
select is((select count(*) from public.compromisso_historico where compromisso_id = '72000000-0000-0000-0000-000000000001' and feito_por = 'a0000000-0000-0000-0000-000000000002') > 0, true, 'A saída do compromisso fica no histórico');

-- Quando a responsável tenta sair, então precisa passar o cartão antes
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$ select public.cartao_sair('tarefas', '70000000-0000-0000-0000-000000000001') $$, 'P0001', 'Você não está entre as pessoas deste cartão.', 'O responsável não sai por aqui');
-- E quem entra agora continua sendo conferido
select throws_ok($$ update public.tarefas set participantes = participantes || 'a0000000-0000-0000-0000-000000000004'::uuid where id = '70000000-0000-0000-0000-000000000001' $$, 'P0001', 'O participante precisa ser alguém da equipe do escritório.', 'Na tarefa, quem é de outro escritório não entra');
select throws_ok($$ update public.demandas set colaboradores = colaboradores || 'a0000000-0000-0000-0000-000000000004'::uuid where id = '71000000-0000-0000-0000-000000000001' $$, 'P0001', 'O colaborador precisa ser alguém da equipe do escritório.', 'Na demanda, quem é de outro escritório não entra');
reset role;

set local role anon;
select throws_ok($$ select public.cartao_sair('tarefas', '70000000-0000-0000-0000-000000000001') $$, '42501', null, 'Quem não entrou não chama a função');
reset role;

select * from finish();
rollback;
