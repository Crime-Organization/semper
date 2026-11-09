-- Toda a equipe vê tarefas, demandas, processos e contratos, sem os valores de contrato para quem não é parte (#271).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia (advogada, participante do contrato) e Caio (advogado sem vínculo), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-ve-tudo', '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "processos": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-ve-tudo-2', '{"pessoas": true, "equipe_ve_tudo": true, "demandas": true}');
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

set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'pf', 'BIA', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
update public.perfis set usuario = 'ana', funcao = 'advogado' where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis set usuario = 'bia', funcao = 'advogado', pessoa_id = '10000000-0000-0000-0000-000000000002' where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis set usuario = 'caio', funcao = 'advogado' where id = 'a0000000-0000-0000-0000-000000000003';
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, indicador_id, indicador_percentual, documento_url, observacoes, participantes, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '10000000-0000-0000-0000-000000000005', 10,
   'https://exemplo.test/contrato', 'Combinado de pagamento', '[{"pessoa_id": "10000000-0000-0000-0000-000000000002", "percentual": 20}]', 'a0000000-0000-0000-0000-000000000001');
insert into public.contrato_clientes (contrato_id, pessoa_id, escritorio_id, ordem) values
  ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 0);
insert into public.contrato_participantes (contrato_id, pessoa_id, escritorio_id, percentual, ordem) values
  ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 20, 0);
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda da Ana', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Tarefa da Ana', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001');
insert into public.demanda_listas (id, escritorio_id, demanda_id, nome) values
  ('75000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Lista');
insert into public.demanda_lista_itens (id, escritorio_id, lista_id, texto) values
  ('76000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Item');
insert into public.etiquetas (id, escritorio_id, cor) values
  ('77000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'verde');
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.vistos(p_tabela text) returns bigint language plpgsql as $$
declare n bigint; begin execute format('select count(*) from public.%I', p_tabela) into n; return n; end $$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function pg_temp.visao() returns public.contratos_da_equipe language sql as $$ select * from public.contratos_da_equipe where id = 'c0000000-0000-0000-0000-000000000001' $$;

-- Com a chave desligada, vale a regra de sempre
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vistos('demandas'), 0::bigint, 'Chave desligada: quem não participa não vê a demanda');
select is(pg_temp.vistos('tarefas'), 0::bigint, 'Chave desligada: quem não participa não vê a tarefa');
select is(pg_temp.vistos('processos'), 0::bigint, 'Chave desligada: quem não participa não vê o processo');
select is(pg_temp.vistos('contratos_da_equipe'), 0::bigint, 'Chave desligada: quem não é parte não alcança o contrato');
select throws_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Oi') $$, '42501', null, 'Chave desligada: quem não é parte não comenta no contrato');
reset role;

-- Quando a chave é ligada
update public.escritorios set modulos = modulos || '{"equipe_ve_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';

-- Então quem não tem vínculo vê os cartões e comenta
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vistos('demandas'), 1::bigint, 'Quem não participa vê a demanda');
select is(pg_temp.vistos('tarefas'), 1::bigint, 'Quem não participa vê a tarefa');
select is(pg_temp.vistos('processos'), 1::bigint, 'Quem não participa vê o processo');
select is(pg_temp.vistos('demanda_listas'), 1::bigint, 'Quem não participa vê a lista');
select is(pg_temp.vistos('demanda_lista_itens'), 1::bigint, 'Quem não participa vê o item da lista');
select lives_ok($$ insert into public.comentarios (demanda_id, texto) values ('71000000-0000-0000-0000-000000000001', 'Oi, @bia') $$, 'Quem não participa comenta na demanda e menciona qualquer colega');
select lives_ok($$ insert into public.comentarios (tarefa_id, texto) values ('70000000-0000-0000-0000-000000000001', 'Oi') $$, 'Quem não participa comenta na tarefa');
select lives_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Oi') $$, 'Quem não é parte comenta no contrato');
select is((select count(*) from public.comentarios where contrato_id = 'c0000000-0000-0000-0000-000000000001'), 1::bigint, 'Quem não é parte lê os comentários do contrato');

-- Então não altera nada
select is(pg_temp.mudou($$ update public.demandas set titulo = 'x' $$), 0, 'Não altera a demanda');
select is(pg_temp.mudou($$ update public.tarefas set titulo = 'x' $$), 0, 'Não altera a tarefa');
select is(pg_temp.mudou($$ update public.processos set titulo = 'x' $$), 0, 'Não altera o processo');
select is(pg_temp.mudou($$ update public.demandas set arquivado_em = now() $$), 0, 'Não arquiva a demanda');
select is(pg_temp.mudou($$ update public.contratos set observacoes = 'x' $$), 0, 'Não altera o contrato');
select is(pg_temp.mudou($$ delete from public.demanda_listas $$), 0, 'Não apaga a lista');
select is(pg_temp.mudou($$ update public.demanda_lista_itens set feito_em = now() $$), 0, 'Não marca o item da lista');
select throws_ok($$ insert into public.demanda_listas (demanda_id, nome) values ('71000000-0000-0000-0000-000000000001', 'Nova') $$, '42501', null, 'Não cria lista');
select throws_ok($$ insert into public.demanda_lista_itens (lista_id, texto) values ('75000000-0000-0000-0000-000000000001', 'Novo') $$, '42501', null, 'Não cria item');
select throws_ok($$ insert into public.demanda_etiquetas (demanda_id, etiqueta_id) values ('71000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001') $$, '42501', null, 'Não põe etiqueta na demanda');
select throws_ok($$ insert into public.tarefa_etiquetas (tarefa_id, etiqueta_id) values ('70000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001') $$, '42501', null, 'Não põe etiqueta na tarefa');
select throws_ok($$ insert into public.processo_etiquetas (processo_id, etiqueta_id) values ('73000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001') $$, '42501', null, 'Não põe etiqueta no processo');
select throws_ok($$ insert into public.processo_andamentos (processo_id, tipo, data, texto) values ('73000000-0000-0000-0000-000000000001', 'outro', current_date, 'x') $$, '42501', null, 'Não lança andamento');
select throws_ok($$ insert into public.processo_prazos (processo_id, descricao, final) values ('73000000-0000-0000-0000-000000000001', 'x', current_date) $$, '42501', null, 'Não lança prazo');
select throws_ok($$ insert into public.tarefa_tempos (tarefa_id, perfil_id, segundos) values ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 60) $$, '42501', null, 'Não lança tempo');
select throws_ok($$ insert into public.processo_demandas (processo_id, demanda_id, criado_por) values ('73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003') $$, '42501', null, 'Não liga demanda ao processo');

-- Então, no contrato, quem não é parte não alcança nada financeiro
select is(pg_temp.vistos('contratos'), 0::bigint, 'A tabela de contratos continua fechada');
select is(pg_temp.vistos('contrato_historico'), 0::bigint, 'O histórico continua fechado');
select is(pg_temp.vistos('contrato_parcelas'), 0::bigint, 'As parcelas continuam fechadas');
select is(pg_temp.vistos('contrato_participantes'), 0::bigint, 'Os percentuais dos participantes continuam fechados');
select is(pg_temp.vistos('contrato_clientes'), 1::bigint, 'Os clientes do contrato aparecem');
select is((pg_temp.visao()).ve_financeiro, false, 'A view diz que quem lê não é parte');
select is((pg_temp.visao()).codigo, 'AA11-0001-2030', 'O número aparece');
select is((pg_temp.visao()).valor, null, 'O valor não aparece');
select is((pg_temp.visao()).entrada, null, 'A entrada não aparece');
select is((pg_temp.visao()).parcelas, null, 'As parcelas não aparecem');
select is((pg_temp.visao()).categoria, null, 'A categoria não aparece');
select is((pg_temp.visao()).percentual_escritorio, null, 'O percentual não aparece');
select is((pg_temp.visao()).indicador_id, null, 'O indicador não aparece');
select is((pg_temp.visao()).indicador_percentual, null, 'O percentual do indicador não aparece');
select is((pg_temp.visao()).documento_url, null, 'O documento não aparece');
select is((pg_temp.visao()).observacoes, null, 'As observações não aparecem');
select is(((pg_temp.visao()).participantes -> 0) ? 'percentual', false, 'Nos participantes, o percentual não aparece');
select is((pg_temp.visao()).participacoes -> 0 ->> 'percentual', null, 'Na lista dos participantes, o percentual não aparece');
select is((pg_temp.visao()).clientela -> 0 -> 'pessoa' ->> 'nome', 'CLIENTE', 'O nome do cliente aparece');
select throws_ok($$ update public.contratos_da_equipe set valor = 1 $$, '55000', null, 'A view não grava');

-- Quando quem não é parte menciona um colega, então a menção não dá acesso aos valores
select lives_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Veja, @caio e @ana') $$, 'Quem não é parte pode mencionar');
reset role;

-- Então quem é parte vê tudo, como antes
select pg_temp.entrar(1); set local role authenticated;
select is((pg_temp.visao()).ve_financeiro, true, 'A administradora é parte');
select is((pg_temp.visao()).valor, 9000::numeric, 'A administradora vê o valor');
select is((pg_temp.visao()).observacoes, 'Combinado de pagamento', 'A administradora vê as observações');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((pg_temp.visao()).ve_financeiro, true, 'A participante é parte');
select is(((pg_temp.visao()).participantes -> 0 ->> 'percentual')::numeric, 20::numeric, 'A participante vê o percentual');
select is(pg_temp.vistos('contratos'), 1::bigint, 'A participante lê a tabela');
reset role;

-- Quando um colega sem vínculo menciona outro, então o mencionado continua sem os valores
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'edu@exemplo.test', 'Edu', 'usuario', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'edu@exemplo.test', '{"convite":"c5"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', now(), now());
update public.perfis set usuario = 'edu', funcao = 'advogado' where id = 'a0000000-0000-0000-0000-000000000005';
select pg_temp.entrar(3); set local role authenticated;
select lives_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Veja, @edu') $$, 'Caio menciona Edu');
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is((pg_temp.visao()).ve_financeiro, false, 'A menção de quem não é parte não dá acesso aos valores');
select is(pg_temp.vistos('contratos'), 0::bigint, 'Nem à tabela');
reset role;

-- Quando quem é parte menciona, então o mencionado passa a ver, como já era
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Veja, @edu') $$, 'Ana menciona Edu');
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is((pg_temp.visao()).ve_financeiro, true, 'A menção de quem é parte dá acesso aos valores');
reset role;

-- Quando o contrato não tem quem o criou, então quem não é parte continua marcado como quem não é parte
update public.contratos set criado_por = null where id = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(3); set local role authenticated;
select is((pg_temp.visao()).ve_financeiro, false, 'Sem quem criou: quem não é parte continua sem os valores, e a tela sabe disso');
reset role;
update public.contratos set criado_por = 'a0000000-0000-0000-0000-000000000001' where id = 'c0000000-0000-0000-0000-000000000001';

-- Dado outro colega, mencionado só por quem não é parte, para ver o que acontece ao desligar a chave
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'fabi@exemplo.test', 'Fabi', 'usuario', privado.resumo_codigo('c6'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'fabi@exemplo.test', '{"convite":"c6"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', now(), now());
update public.perfis set usuario = 'fabi', funcao = 'advogado' where id = 'a0000000-0000-0000-0000-000000000006';
select pg_temp.entrar(3); set local role authenticated;
select lives_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Veja, @fabi') $$, 'Caio menciona Fabi');
reset role;
select is((select autor_sem_vinculo from public.comentarios where contrato_id = 'c0000000-0000-0000-0000-000000000001' and texto = 'Veja, @fabi'), true, 'O comentário guarda que o autor não era parte');
select pg_temp.entrar(3); set local role authenticated;
select throws_ok($$ update public.comentarios set autor_sem_vinculo = false $$, '42501', null, 'A marca não muda pela tela');
reset role;

-- Então outro escritório não vê nada, mesmo com a chave dele ligada
select pg_temp.entrar(4); set local role authenticated;
select is(pg_temp.vistos('demandas'), 0::bigint, 'Outro escritório não vê a demanda');
select is(pg_temp.vistos('tarefas'), 0::bigint, 'Outro escritório não vê a tarefa');
select is(pg_temp.vistos('processos'), 0::bigint, 'Outro escritório não vê o processo');
select is(pg_temp.vistos('contratos_da_equipe'), 0::bigint, 'Outro escritório não vê o contrato');
select is((select count(*) from public.comentarios where contrato_id = 'c0000000-0000-0000-0000-000000000001'), 0::bigint, 'Outro escritório não lê os comentários');
reset role;

-- E quem não entrou não lê a view
set local role anon;
select throws_ok($$ select * from public.contratos_da_equipe $$, '42501', null, 'Quem não entrou não lê a view');
reset role;

-- Quando a chave é desligada, então volta a regra de sempre
update public.escritorios set modulos = modulos - 'equipe_ve_tudo' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(3); set local role authenticated;
select is(pg_temp.vistos('demandas'), 0::bigint, 'Chave desligada de novo: a demanda some');
select is(pg_temp.vistos('contratos_da_equipe'), 0::bigint, 'Chave desligada de novo: o contrato some');
reset role;
select pg_temp.entrar(6); set local role authenticated;
select is(pg_temp.vistos('contratos'), 0::bigint, 'A menção feita sem vínculo não vale nem depois de desligar a chave');
reset role;

-- Com a chave desligada, a menção continua valendo como sempre: quem foi mencionado por uma parte também dá acesso a quem menciona
select pg_temp.entrar(5); set local role authenticated;
select lives_ok($$ insert into public.comentarios (contrato_id, texto) values ('c0000000-0000-0000-0000-000000000001', 'Veja também, @fabi') $$, 'Edu, mencionado por uma parte, menciona Fabi');
reset role;
select pg_temp.entrar(6); set local role authenticated;
select is(pg_temp.vistos('contratos'), 1::bigint, 'Chave desligada: a menção vale como sempre');
reset role;

select * from finish();
rollback;
