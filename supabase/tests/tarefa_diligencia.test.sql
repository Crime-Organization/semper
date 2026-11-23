-- Tarefa de diligência, com o motivo obrigatório (#313, parte A). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com a Bia (usuária comum).
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-diligencia', '{"pessoas": true, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now());
select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000002', 'role', 'authenticated', 'aal', 'aal1',
  'session_id', '50000000-0000-0000-0000-000000000002')::text, true);
set local role authenticated;

-- Quando a Bia cadastra uma tarefa comum (como a versão anterior do site), então ela não é diligência e não tem motivo
insert into public.tarefas (id, titulo, responsavel_id, criado_por)
values ('70000000-0000-0000-0000-000000000001', 'Comum', auth.uid(), auth.uid());
select is((select diligencia::text || coalesce(diligencia_motivo, '-') from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 'false-',
  'A tarefa nasce comum, sem motivo');

-- Quando marca a diligência sem motivo (ou só com espaços), então o banco recusa com a mensagem em português
select throws_ok($$ insert into public.tarefas (titulo, responsavel_id, criado_por, diligencia) values ('Sem motivo', auth.uid(), auth.uid(), true) $$,
  'P0001', 'Diga o motivo da diligência.', 'A diligência sem motivo é recusada');
select throws_ok($$ update public.tarefas set diligencia = true, diligencia_motivo = '   ' where id = '70000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Diga o motivo da diligência.', 'O motivo só com espaços também é recusado');
select throws_ok($$ update public.tarefas set diligencia = true, diligencia_motivo = repeat('a', 1001) where id = '70000000-0000-0000-0000-000000000001' $$,
  'P0001', 'O motivo da diligência pode ter até 1000 caracteres.', 'O motivo comprido demais é recusado');

-- Quando marca a diligência com o motivo, então grava o motivo limpo e o histórico registra a troca
update public.tarefas set diligencia = true, diligencia_motivo = '  Protocolar no cartório  ' where id = '70000000-0000-0000-0000-000000000001';
select is((select diligencia_motivo from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 'Protocolar no cartório', 'O motivo fica sem espaços nas pontas');
select is((select alteracoes -> 'diligencia' ->> 'para' from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001' order by em desc limit 1),
  'true', 'O histórico registra a marcação da diligência');

-- Quando a tarefa deixa de ser diligência, então o motivo sai junto
update public.tarefas set diligencia = false where id = '70000000-0000-0000-0000-000000000001';
select is((select diligencia_motivo from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), null, 'Sem diligência, sem motivo');

-- Dada uma gravação com os gatilhos desligados (uma importação), quando vem diligência sem motivo, então a regra da tabela recusa
reset role;
set local session_replication_role = replica;
select throws_ok($$ insert into public.tarefas (escritorio_id, codigo, titulo, responsavel_id, diligencia) values
  ('e0000000-0000-0000-0000-000000000001', 'T9', 'Importada', 'a0000000-0000-0000-0000-000000000002', true) $$,
  '23514', null, 'A regra da tabela exige o motivo mesmo sem os gatilhos');
set local session_replication_role = origin;

select * from finish();
rollback;
