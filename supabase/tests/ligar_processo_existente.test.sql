-- Ligar demanda, tarefa e contrato a um processo que já existe (#294). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master, responsável pelo contrato) e Bia (usuária comum), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-ligar-processo', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-ligar-processo-2', '{"pessoas": true}');
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

-- Os cartões, gravados direto (sem os gatilhos de cadastro):
--   P1: processo da Ana, com a Bia; P2: processo só da Ana; P3: arquivado, com a Bia; P9: do outro escritório.
--   D1: demanda da Ana, com a Bia; D2: demanda só da Ana. T1: tarefa da Bia. K1: contrato da Ana (a Bia não é parte).
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'CLIENTE DE FORA', 'a0000000-0000-0000-0000-000000000004');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, colaboradores, clientes, criado_por, arquivado_em) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PR1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', null),
  ('73000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'PR2', 'judicial', '2', 'a0000000-0000-0000-0000-000000000001', '{}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', null),
  ('73000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'PR3', 'judicial', '3', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001', now()),
  ('73000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'PR9', 'judicial', '9', 'a0000000-0000-0000-0000-000000000004', '{}', '{10000000-0000-0000-0000-000000000009}', 'a0000000-0000-0000-0000-000000000004', null);
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Com a Bia', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Só da Ana', 'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Da Bia', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, categoria, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AN26', 2026, 'AN26-0001-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001', 'Registro de marca', 'pro_labore', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

-- Quantas linhas um delete apagou (o delete não cabe numa subconsulta). Roda com a permissão de quem chama.
create function pg_temp.apagados(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $f$;
grant execute on function pg_temp.apagados(text) to authenticated;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

-- ---------- demanda e processo ----------
-- Quando a Bia liga à demanda em que está um processo em que também está, então a ligação fica gravada como "atua"
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.processo_demandas (processo_id, demanda_id, papel, criado_por)
                   values ('73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'atua', auth.uid()) $$, 'Liga um processo existente à demanda');
-- Quando tenta ligar um processo arquivado, ou um em que não está, então é recusado
select throws_ok($$ insert into public.processo_demandas (processo_id, demanda_id, papel, criado_por)
                    values ('73000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000001', 'atua', auth.uid()) $$, '42501', null, 'Processo arquivado não se liga');
select throws_ok($$ insert into public.processo_demandas (processo_id, demanda_id, papel, criado_por)
                    values ('73000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 'atua', auth.uid()) $$, '42501', null, 'Processo em que a pessoa não está não se liga');
-- Quando desliga, então a ligação sai
select is(pg_temp.apagados('delete from public.processo_demandas where demanda_id = ''71000000-0000-0000-0000-000000000001'''), 1::bigint, 'Quem está na demanda desliga');
reset role;
select is((select count(*) from public.processo_demandas where demanda_id = '71000000-0000-0000-0000-000000000001'), 0::bigint, 'A ligação saiu do banco');

-- Dado uma ligação na demanda em que a Bia não está, quando ela tenta desligar, então nada sai
insert into public.processo_demandas (escritorio_id, processo_id, demanda_id, papel, criado_por)
  values ('e0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'atua', 'a0000000-0000-0000-0000-000000000001');
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.apagados('delete from public.processo_demandas where demanda_id = ''71000000-0000-0000-0000-000000000002'''), 0::bigint, 'Quem não está na demanda não desliga');
reset role;
select is((select count(*) from public.processo_demandas where demanda_id = '71000000-0000-0000-0000-000000000002'), 1::bigint, 'A ligação continua');

-- Quando alguém de outro escritório tenta ligar o processo dele a uma demanda daqui, ou desligar, então é recusado
select pg_temp.entrar(4); set local role authenticated;
select throws_ok($$ insert into public.processo_demandas (escritorio_id, processo_id, demanda_id, papel, criado_por)
                    values ('e0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000009', '71000000-0000-0000-0000-000000000001', 'atua', auth.uid()) $$, '42501', null, 'Outro escritório não liga');
select is(pg_temp.apagados('delete from public.processo_demandas'), 0::bigint, 'Outro escritório não desliga');
reset role;

-- ---------- contrato e processo ----------
-- Quando a Ana, responsável pelo contrato, liga um processo, então ele fica no contrato
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.contrato_processos (contrato_id, processo_id, criado_por)
                   values ('c0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', auth.uid()) $$, 'Quem é parte liga');
select throws_ok($$ insert into public.contrato_processos (contrato_id, processo_id, criado_por)
                    values ('c0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', auth.uid()) $$, '42501', null, 'Processo arquivado não se liga ao contrato');
reset role;

-- Quando a Bia, que não é parte do contrato, tenta ligar ou desligar, então é recusado; mas vê a ligação pelo processo em que está
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ insert into public.contrato_processos (contrato_id, processo_id, criado_por)
                    values ('c0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', auth.uid()) $$, '42501', null, 'Quem não é parte não liga');
select is(pg_temp.apagados('delete from public.contrato_processos'), 0::bigint, 'Quem não é parte não desliga');
select is((select count(*) from public.contrato_processos), 1::bigint, 'Quem está no processo vê que ele tem contrato');
select is((select count(*) from public.contratos where id = 'c0000000-0000-0000-0000-000000000001'), 0::bigint, 'E continua sem ver o contrato');
reset role;

-- Quando alguém de outro escritório olha, então não vê nada
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.contrato_processos), 0::bigint, 'Outro escritório não vê a ligação');
reset role;

-- Quando a Ana desliga, então sai
select pg_temp.entrar(1); set local role authenticated;
select is(pg_temp.apagados('delete from public.contrato_processos'), 1::bigint, 'Quem é parte desliga');
reset role;

-- ---------- tarefa e processo ----------
-- Quando a Bia liga à tarefa dela um processo em que está, então ele fica, e o histórico guarda o número
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ update public.tarefas set processo_id = '73000000-0000-0000-0000-000000000001' where id = '70000000-0000-0000-0000-000000000001' $$, 'Liga o processo depois de criada');
-- Quando troca por um em que não está, ou por um arquivado, então é recusado
select throws_ok($$ update public.tarefas set processo_id = '73000000-0000-0000-0000-000000000002' where id = '70000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Processo não encontrado neste escritório.', 'Processo em que a pessoa não está não entra');
select throws_ok($$ update public.tarefas set processo_id = '73000000-0000-0000-0000-000000000003' where id = '70000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Processo não encontrado neste escritório.', 'Processo arquivado não entra');
select throws_ok($$ update public.tarefas set processo_id = '73000000-0000-0000-0000-000000000009' where id = '70000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Processo não encontrado neste escritório.', 'Processo de outro escritório não entra');
-- Quando tira o processo, então a tarefa fica sem ele
select lives_ok($$ update public.tarefas set processo_id = null where id = '70000000-0000-0000-0000-000000000001' $$, 'Tira o processo');
reset role;
select is((select processo_id from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), null::uuid, 'A tarefa ficou sem processo');
select is((select array_agg(alteracoes -> 'processo' order by em, id) from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001' and alteracoes ? 'processo'),
  array['{"de": null, "para": "1"}'::jsonb, '{"de": "1", "para": null}'::jsonb], 'O histórico guarda a ligação e a retirada, pelo número');

-- Quando o processo é excluído, então a tarefa perde a ligação sem uma linha vazia no histórico (sem ninguém logado, como no banco)
select set_config('request.jwt.claims', '', true);
update public.tarefas set processo_id = '73000000-0000-0000-0000-000000000002' where id = '70000000-0000-0000-0000-000000000001';
delete from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001';
delete from public.processos where id = '73000000-0000-0000-0000-000000000002';
select is((select count(*) from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001'), 0::bigint, 'A exclusão do processo não deixa linha vazia');

select * from finish();
rollback;
