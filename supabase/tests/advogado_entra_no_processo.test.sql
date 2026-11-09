-- Na fase de adaptação, o advogado entra nos processos e marca audiência em qualquer processo (#273).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (responsável do processo), Bia (advogada sem vínculo) e Caio (estagiário), e o Davi, advogado de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-entrar', '{"pessoas": true, "processos": true, "compromissos": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-entrar-2', '{"pessoas": true, "processos": true, "equipe_ve_tudo": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'usuario', privado.resumo_codigo('c4'), now());
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
update public.perfis set funcao = 'advogado' where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004');
update public.perfis set funcao = 'estagiario' where id = 'a0000000-0000-0000-0000-000000000003';
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001'),
  ('73000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'judicial', '2', 'a0000000-0000-0000-0000-000000000001', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.processo(p_final int) returns public.processos language sql as $$
  select * from public.processos where id = ('73000000-0000-0000-0000-00000000000' || p_final)::uuid
$$;
create function pg_temp.mudou(p_sql text) returns integer language plpgsql as $$
declare n integer; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function pg_temp.bia() returns uuid language sql as $$ select 'a0000000-0000-0000-0000-000000000002'::uuid $$;
create function pg_temp.ana() returns uuid language sql as $$ select 'a0000000-0000-0000-0000-000000000001'::uuid $$;

-- Com a chave desligada, ninguém entra
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ select public.processo_me_incluir('73000000-0000-0000-0000-000000000001', 'colaborador') $$, 'P0001', 'Só advogados podem entrar no processo nesta fase.', 'Chave desligada: o advogado não entra');
reset role;

-- Quando a chave é ligada
update public.escritorios set modulos = modulos || '{"equipe_ve_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';

-- Então o advogado entra como colaborador, e passa a alterar
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.mudou($$ update public.processos set titulo = 'x' where id = '73000000-0000-0000-0000-000000000001' $$), 0, 'Antes de entrar, não altera');
select lives_ok($$ select public.processo_me_incluir('73000000-0000-0000-0000-000000000001', 'colaborador') $$, 'O advogado entra como colaborador');
select ok(pg_temp.bia() = any((pg_temp.processo(1)).colaboradores), 'Ele aparece como colaborador');
select is((pg_temp.processo(1)).responsavel_id, pg_temp.ana(), 'O responsável continua o mesmo');
select is(pg_temp.mudou($$ update public.processos set titulo = 'Novo' where id = '73000000-0000-0000-0000-000000000001' $$), 1, 'Depois de entrar, altera');
select lives_ok($$ select public.processo_me_incluir('73000000-0000-0000-0000-000000000001', 'colaborador') $$, 'Pedir de novo não dá erro');
select is(cardinality((pg_temp.processo(1)).colaboradores), 1, 'Pedir de novo não repete');
select is((select count(*) from public.processo_historico where processo_id = '73000000-0000-0000-0000-000000000001') > 0, true, 'A entrada fica no histórico');

-- Quando o advogado assume como responsável, então quem era responsável continua como colaborador
select lives_ok($$ select public.processo_me_incluir('73000000-0000-0000-0000-000000000002', 'responsavel') $$, 'O advogado assume como responsável');
select is((pg_temp.processo(2)).responsavel_id, pg_temp.bia(), 'Ele vira o responsável');
select ok(pg_temp.ana() = any((pg_temp.processo(2)).colaboradores), 'Quem era responsável continua como colaborador');
select lives_ok($$ select public.processo_me_incluir('73000000-0000-0000-0000-000000000001', 'responsavel') $$, 'O colaborador também pode assumir');
select is((pg_temp.processo(1)).responsavel_id, pg_temp.bia(), 'O colaborador vira o responsável');
select ok(not pg_temp.bia() = any((pg_temp.processo(1)).colaboradores), 'E deixa de constar como colaborador');
select throws_ok($$ select public.processo_me_incluir('73000000-0000-0000-0000-000000000001', 'outro') $$, 'P0001', 'Escolha como entrar no processo.', 'Só as duas formas existem');

-- Então o advogado marca audiência em processo em que não está
reset role;
update public.processos set responsavel_id = pg_temp.ana(), colaboradores = '{}' where id = '73000000-0000-0000-0000-000000000002';
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.compromissos (tipo, data, hora, modalidade, processo_id, responsavel_id) values ('audiencia', '2030-01-15', '14:00', 'virtual', '73000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002') $$, 'O advogado marca audiência em processo em que não está');
reset role;

-- Então quem não é advogado não entra nem marca
select pg_temp.entrar(3); set local role authenticated;
select throws_ok($$ select public.processo_me_incluir('73000000-0000-0000-0000-000000000002', 'colaborador') $$, 'P0001', 'Só advogados podem entrar no processo nesta fase.', 'O estagiário não entra');
select throws_ok($$ insert into public.compromissos (tipo, data, hora, modalidade, processo_id, responsavel_id) values ('audiencia', '2030-01-15', '15:00', 'virtual', '73000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003') $$, 'P0001', 'Processo não encontrado neste escritório.', 'O estagiário não marca audiência em processo em que não está');
reset role;

-- Então o advogado de outro escritório não entra
select pg_temp.entrar(4); set local role authenticated;
select throws_ok($$ select public.processo_me_incluir('73000000-0000-0000-0000-000000000002', 'responsavel') $$, 'P0001', 'Processo não encontrado neste escritório.', 'Outro escritório não entra');
reset role;

-- E quem não entrou não chama a função
set local role anon;
select throws_ok($$ select public.processo_me_incluir('73000000-0000-0000-0000-000000000002', 'colaborador') $$, '42501', null, 'Quem não entrou no sistema não chama a função');
reset role;

-- Quando o processo está arquivado, então não dá para entrar
update public.processos set arquivado_em = now() where id = '73000000-0000-0000-0000-000000000002';
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ select public.processo_me_incluir('73000000-0000-0000-0000-000000000002', 'colaborador') $$, 'P0001', 'Processo não encontrado neste escritório.', 'Processo arquivado: não entra');
reset role;

select * from finish();
rollback;
