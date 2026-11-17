-- Quem está num contrato vê as demandas e as tarefas dele, só para ler (#326). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia (participante do contrato K1), Caio (responsável pelo contrato K2) e Eli (só
-- mencionado no K1), e o Davi, administrador de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-contrato-demandas', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-contrato-demandas-2', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eli@exemplo.test', 'Eli', 'usuario', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'eli@exemplo.test', '{"convite":"c5"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 5) as n;

-- E os cartões: K1 (Ana responsável, Bia participante), K2 (Caio responsável), K3 (só da Ana); no outro escritório, o K9 com a pessoa
-- da Bia entre os participantes (não pode valer lá). D1 é do K1, D2 do K3, D3 sem contrato, D4 do K2, D9 do K9. T1 é do K1, T2 da D1,
-- T3 do K3, T4 sem nada, T5 do K2, T9 do K9. Tudo foi criado pela Ana (pelo Davi, no outro escritório).
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'pf', 'BIA', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'contato', 'OUTRO CLIENTE', 'a0000000-0000-0000-0000-000000000004');
update public.perfis set pessoa_id = '10000000-0000-0000-0000-000000000002' where id = 'a0000000-0000-0000-0000-000000000002';
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30,
   '[{"pessoa_id": "10000000-0000-0000-0000-000000000002", "percentual": 20}]', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'AA11', 2030, 'AA11-0002-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000003', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30,
   '[]', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 3, 'AA11', 2030, 'AA11-0003-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30,
   '[]', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000009', 'OUTRO CLIENTE',
   'a0000000-0000-0000-0000-000000000004', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30,
   '[{"pessoa_id": "10000000-0000-0000-0000-000000000002", "percentual": 20}]', 'a0000000-0000-0000-0000-000000000004');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, contrato_id, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda do K1', 'a0000000-0000-0000-0000-000000000001', '{}', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Demanda do K3', 'a0000000-0000-0000-0000-000000000001', '{}', 'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'D3', 'Demanda sem contrato', 'a0000000-0000-0000-0000-000000000001', '{}', null, 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'D4', 'Demanda do K2', 'a0000000-0000-0000-0000-000000000001', '{}', 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'D9', 'Demanda do K9', 'a0000000-0000-0000-0000-000000000004', '{}', 'c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000004');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, demanda_id, contrato_id, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Tarefa do K1', 'a0000000-0000-0000-0000-000000000001', '{}', null, 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'T2', 'Tarefa da D1', 'a0000000-0000-0000-0000-000000000001', '{}', '71000000-0000-0000-0000-000000000001', null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'T3', 'Tarefa do K3', 'a0000000-0000-0000-0000-000000000001', '{}', null, 'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'T4', 'Tarefa sem nada', 'a0000000-0000-0000-0000-000000000001', '{}', null, null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'T5', 'Tarefa do K2', 'a0000000-0000-0000-0000-000000000001', '{}', null, 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'T9', 'Tarefa do K9', 'a0000000-0000-0000-0000-000000000004', '{}', '71000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000004');
-- E o que fica dentro dos cartões, feito pela Ana: um comentário, uma lista com um item, histórico, tempo e uma anotação ligada.
-- E o comentário da Ana no K1 que menciona o Eli.
insert into public.comentarios (id, escritorio_id, demanda_id, autor_id, texto) values
  ('cc000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Na demanda');
insert into public.comentarios (id, escritorio_id, contrato_id, autor_id, texto, mencoes) values
  ('cc000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '@eli veja',
   '{a0000000-0000-0000-0000-000000000005}');
insert into public.demanda_listas (id, escritorio_id, demanda_id, nome, criado_por) values
  ('dd000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Lista', 'a0000000-0000-0000-0000-000000000001');
insert into public.demanda_lista_itens (id, escritorio_id, lista_id, texto) values
  ('de000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000001', 'Item');
insert into public.demanda_historico (escritorio_id, demanda_id, alteracoes, feito_por) values
  ('e0000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '{"titulo": {"de": "A", "para": "B"}}', 'a0000000-0000-0000-0000-000000000001');
insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por) values
  ('e0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '{"titulo": {"de": "A", "para": "B"}}', 'a0000000-0000-0000-0000-000000000001');
insert into public.tarefa_tempos (escritorio_id, tarefa_id, perfil_id, segundos) values
  ('e0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 600);
insert into public.anotacoes (id, escritorio_id, codigo, titulo, responsavel_id, criado_por) values
  ('ab000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'N1', 'Da tarefa', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.anotacao_ligacoes (escritorio_id, anotacao_id, tarefa_id) values
  ('e0000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001');
-- E uma anotação ligada à D1 e outra à T2 (os outros dois caminhos das anotações), o tempo também na T1 (o caminho do contrato da
-- tarefa no resumo do tempo), uma etiqueta e um processo de que a Bia é a responsável (para tentar ligar a D1 a ele).
insert into public.anotacoes (id, escritorio_id, codigo, titulo, responsavel_id, criado_por) values
  ('ab000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'N2', 'Da demanda', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('ab000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'N3', 'Da tarefa da demanda', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.anotacao_ligacoes (escritorio_id, anotacao_id, demanda_id) values
  ('e0000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001');
insert into public.anotacao_ligacoes (escritorio_id, anotacao_id, tarefa_id) values
  ('e0000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002');
insert into public.tarefa_tempos (escritorio_id, tarefa_id, perfil_id, segundos) values
  ('e0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 300);
insert into public.etiquetas (id, escritorio_id, cor) values ('ee000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'azul');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PR1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000002',
   '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000002');
set local session_replication_role = origin;

create function pg_temp.entra(p_numero integer) returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_numero, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_numero)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.vejo(p_tabela text) returns text language plpgsql as $$
declare r text;
begin
  execute format('select string_agg(codigo, '' '' order by codigo) from public.%I', p_tabela) into r;
  return coalesce(r, '');
end $$;
create function pg_temp.conta(p_sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || p_sql || ') x' into n; return n; end $$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
grant execute on function pg_temp.entra(integer), pg_temp.vejo(text), pg_temp.conta(text), pg_temp.mudou(text) to authenticated;
grant usage on schema extensions to authenticated;

-- Quando a Bia, participante do K1, abre Demandas e Tarefas
select pg_temp.entra(2);
-- Então vê a demanda do K1, a tarefa do K1 e a tarefa da demanda do K1; nada do K3, nada sem contrato, nada do outro escritório
select is(pg_temp.vejo('demandas'), 'D1', 'A participante do contrato vê a demanda dele, e só ela');
select is(pg_temp.vejo('tarefas'), 'T1 T2', 'A participante do contrato vê a tarefa do contrato e a da demanda dele, e só elas');
-- E o que fica dentro dos cartões
select is(pg_temp.conta($$ select 1 from public.comentarios where demanda_id = '71000000-0000-0000-0000-000000000001' $$), 1::bigint, 'Vê o comentário da demanda');
select is(pg_temp.conta($$ select 1 from public.demanda_listas where demanda_id = '71000000-0000-0000-0000-000000000001' $$), 1::bigint, 'Vê a lista da demanda');
select is(pg_temp.conta($$ select 1 from public.demanda_lista_itens where lista_id = 'dd000000-0000-0000-0000-000000000001' $$), 1::bigint, 'Vê o item da lista');
select is(pg_temp.conta($$ select 1 from public.demanda_historico where demanda_id = '71000000-0000-0000-0000-000000000001' $$), 1::bigint, 'Vê o histórico da demanda');
select is(pg_temp.conta($$ select 1 from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000002' $$), 1::bigint, 'Vê o histórico da tarefa da demanda');
select is(pg_temp.conta($$ select 1 from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000001' $$), 1::bigint, 'Vê a anotação ligada à tarefa do contrato');
select is(pg_temp.conta($$ select 1 from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000002' $$), 1::bigint, 'Vê a anotação ligada à demanda do contrato');
select is(pg_temp.conta($$ select 1 from public.anotacoes where id = 'ab000000-0000-0000-0000-000000000003' $$), 1::bigint, 'Vê a anotação ligada à tarefa da demanda do contrato');
select is((select total from public.resumo_do_tempo('70000000-0000-0000-0000-000000000002') limit 1), 600::bigint, 'Vê o resumo do tempo da tarefa');
select is((select total from public.resumo_do_tempo('70000000-0000-0000-0000-000000000001') limit 1), 300::bigint, 'Vê o resumo do tempo da tarefa do contrato');
select is(public.tempo_da_demanda('71000000-0000-0000-0000-000000000001'), 600::bigint, 'Vê o tempo da demanda');
-- E só lê: não altera, não arquiva, não mexe na lista nem lança tempo
select is(pg_temp.mudou($$ update public.demandas set titulo = 'x' where id = '71000000-0000-0000-0000-000000000001' $$), 0, 'Não altera a demanda');
select is(pg_temp.mudou($$ update public.demandas set arquivado_em = now() where id = '71000000-0000-0000-0000-000000000001' $$), 0, 'Não arquiva a demanda');
select is(pg_temp.mudou($$ update public.tarefas set titulo = 'x' where id in ('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002') $$), 0, 'Não altera as tarefas');
select is(pg_temp.mudou($$ update public.demanda_lista_itens set feito_em = now() where id = 'de000000-0000-0000-0000-000000000001' $$), 0, 'Não marca o item da lista');
select throws_ok($$ insert into public.demanda_listas (demanda_id, nome) values ('71000000-0000-0000-0000-000000000001', 'Outra') $$, '42501', null, 'Não cria lista');
select throws_ok($$ insert into public.tarefa_tempos (tarefa_id, segundos) values ('70000000-0000-0000-0000-000000000001', 60) $$, '42501', null, 'Não lança tempo');
select is(pg_temp.mudou($$ update public.anotacoes set titulo = 'x' where id = 'ab000000-0000-0000-0000-000000000001' $$), 0, 'Não altera a anotação ligada');
select throws_ok($$ insert into public.demanda_etiquetas (demanda_id, etiqueta_id) values ('71000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Não põe etiqueta na demanda');
select throws_ok($$ insert into public.tarefa_etiquetas (tarefa_id, etiqueta_id) values ('70000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Não põe etiqueta na tarefa do contrato');
select throws_ok($$ insert into public.tarefa_etiquetas (tarefa_id, etiqueta_id) values ('70000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Não põe etiqueta na tarefa da demanda');
select throws_ok($$ insert into public.processo_demandas (processo_id, demanda_id) values ('73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Não liga a demanda a um processo, nem a um de que é responsável');
-- E comenta, como quem lê com a chave equipe_ve_tudo
select lives_ok($$ insert into public.comentarios (demanda_id, texto) values ('71000000-0000-0000-0000-000000000001', 'Visto') $$, 'Comenta na demanda que vê pelo contrato');

-- Quando o Caio, responsável pelo K2, abre Demandas e Tarefas, então vê as do K2
select pg_temp.entra(3);
select is(pg_temp.vejo('demandas'), 'D4', 'O responsável pelo contrato vê a demanda dele');
select is(pg_temp.vejo('tarefas'), 'T5', 'O responsável pelo contrato vê a tarefa dele');

-- Quando o Eli, só mencionado no K1, abre Demandas e Tarefas, então lê o contrato mas não as demandas e tarefas dele
select pg_temp.entra(5);
select is(pg_temp.conta($$ select 1 from public.contratos where id = 'c0000000-0000-0000-0000-000000000001' $$), 1::bigint, 'Quem foi mencionado lê o contrato');
select is(pg_temp.vejo('demandas'), '', 'A menção no contrato não abre as demandas dele');
select is(pg_temp.vejo('tarefas'), '', 'A menção no contrato não abre as tarefas dele');
select is(pg_temp.conta($$ select 1 from public.anotacoes $$), 0::bigint, 'Nem a anotação ligada à tarefa do contrato');

-- Quando o Davi, do outro escritório, abre Demandas e Tarefas, então vê só as dele
select pg_temp.entra(4);
select is(pg_temp.vejo('demandas'), 'D9', 'O outro escritório vê só a demanda dele');
select is(pg_temp.vejo('tarefas'), 'T9', 'O outro escritório vê só a tarefa dele');

-- Quando a Ana comenta na demanda D1 mencionando quem está no contrato dela, ou quem não está
select pg_temp.entra(1);
select lives_ok(format($$ insert into public.comentarios (demanda_id, texto) values ('71000000-0000-0000-0000-000000000001', '@%s veja') $$,
  (select usuario from public.perfis where id = 'a0000000-0000-0000-0000-000000000002')), 'Menciona na demanda quem está no contrato dela');
select lives_ok(format($$ insert into public.comentarios (tarefa_id, texto) values ('70000000-0000-0000-0000-000000000002', '@%s veja') $$,
  (select usuario from public.perfis where id = 'a0000000-0000-0000-0000-000000000002')), 'Menciona na tarefa quem está no contrato da demanda dela');
select throws_ok(format($$ insert into public.comentarios (demanda_id, texto) values ('71000000-0000-0000-0000-000000000001', '@%s veja') $$,
  (select usuario from public.perfis where id = 'a0000000-0000-0000-0000-000000000005')), 'P0001', null, 'Não menciona na demanda quem só foi mencionado no contrato');
select throws_ok(format($$ insert into public.comentarios (tarefa_id, texto) values ('70000000-0000-0000-0000-000000000003', '@%s veja') $$,
  (select usuario from public.perfis where id = 'a0000000-0000-0000-0000-000000000002')), 'P0001', null, 'Não menciona na tarefa quem não está no contrato dela');

-- Quando a Bia sai do K1 (a Ana a tira dos participantes), então deixa de ver na hora
select set_config('role', 'none', true);
update public.contratos set participantes = '[]' where id = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.entra(2);
select is(pg_temp.vejo('demandas'), '', 'Fora do contrato, não vê mais a demanda dele');
select is(pg_temp.vejo('tarefas'), '', 'Fora do contrato, não vê mais as tarefas dele');
select is(pg_temp.conta($$ select 1 from public.comentarios where demanda_id = '71000000-0000-0000-0000-000000000001' $$), 0::bigint, 'Nem os comentários da demanda');
select is(pg_temp.conta($$ select 1 from public.anotacoes $$), 0::bigint, 'Nem a anotação ligada');
select is(public.tempo_da_demanda('71000000-0000-0000-0000-000000000001'), 0::bigint, 'Nem o tempo da demanda');

-- Dada a regra de leitura, então o caminho do contrato é calculado uma vez por consulta, e não cartão a cartão
select set_config('role', 'none', true);
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'demandas' and policyname = 'leitura' and qual ~ 'SELECT privado.contratos_em_que_estou\(\)'), 'A leitura de demandas consulta os contratos uma vez');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tarefas' and policyname = 'leitura' and qual ~ 'SELECT privado.demandas_dos_meus_contratos\(\)'), 'A leitura de tarefas consulta as demandas dos contratos uma vez');
-- E, dentro das funções, quem está logado entra como (select ...): uma vez por chamada, e não contrato a contrato (nem ligação a ligação)
select is((select string_agg(p.proname, ' ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'privado' and p.proname in ('contratos_em_que_estou', 'demandas_dos_meus_contratos', 'anotacoes_pelos_itens')
             and p.prosrc ~ '(?<!select )(privado\.(meu_escritorio|minha_pessoa|sou_admin|contratos_em_que_me_mencionaram)|auth\.uid)\(\)'),
          null::text, 'As funções do caminho do contrato calculam quem está logado uma vez só');

select * from finish();
rollback;
