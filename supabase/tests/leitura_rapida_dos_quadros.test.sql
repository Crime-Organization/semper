-- As regras de leitura mais rápidas dos quadros mostram o mesmo que antes (#278). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia (ligada a alguns cartões) e Caio (sem vínculo), e o Davi, administrador de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-leitura', '{"demandas": true, "tarefas": true, "processos": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-leitura-2', '{"demandas": true, "tarefas": true, "processos": true, "equipe_ve_tudo": true, "equipe_edita_tudo": true}');
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
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 4) as n;

-- E cartões de cada jeito de estar ligado: criou, é responsável, está na lista, ou nada. A tarefa T5 está ligada a uma demanda da Bia, sem a Bia na tarefa. T7, D5 e P5 são só da Bia: a administradora os vê por ser administradora.
set local session_replication_role = replica;
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda', 'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Demanda', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'D3', 'Demanda', 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'D4', 'Demanda', 'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000002'),
  ('71000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'D5', 'Demanda', 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000002'),
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'D9', 'Demanda', 'a0000000-0000-0000-0000-000000000004', '{}', 'a0000000-0000-0000-0000-000000000004');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, demanda_id, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Tarefa', 'a0000000-0000-0000-0000-000000000001', '{}', null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'T2', 'Tarefa', 'a0000000-0000-0000-0000-000000000002', '{}', null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'T3', 'Tarefa', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', null, 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'T4', 'Tarefa', 'a0000000-0000-0000-0000-000000000001', '{}', null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'T5', 'Tarefa', 'a0000000-0000-0000-0000-000000000001', '{}', '71000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'T6', 'Tarefa', 'a0000000-0000-0000-0000-000000000001', '{}', '71000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'T7', 'Tarefa', 'a0000000-0000-0000-0000-000000000002', '{}', null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'T9', 'Tarefa', 'a0000000-0000-0000-0000-000000000004', '{}', null, 'a0000000-0000-0000-0000-000000000004');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, colaboradores, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001', '{}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001'),
  ('73000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'judicial', '2', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001'),
  ('73000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'P3', 'judicial', '3', 'a0000000-0000-0000-0000-000000000002', '{}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001'),
  ('73000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'P4', 'judicial', '4', 'a0000000-0000-0000-0000-000000000001', '{}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000002'),
  ('73000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'judicial', '5', 'a0000000-0000-0000-0000-000000000002', '{}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000002'),
  ('73000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'P9', 'judicial', '9', 'a0000000-0000-0000-0000-000000000004', '{}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000004');
set local session_replication_role = origin;

create function pg_temp.entra(p_numero integer) returns void language plpgsql as $$
begin
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
-- As chaves da fase de adaptação do primeiro escritório.
create function pg_temp.chaves(p_ve boolean, p_edita boolean) returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  update public.escritorios set modulos = modulos || jsonb_build_object('equipe_ve_tudo', p_ve, 'equipe_edita_tudo', p_edita) where id = 'e0000000-0000-0000-0000-000000000001';
end $$;
-- Confere as três listas da pessoa de uma vez.
create function pg_temp.confere(p_numero integer, p_tarefas text, p_demandas text, p_processos text, p_caso text) returns setof text language plpgsql as $$
begin
  perform pg_temp.entra(p_numero);
  return next extensions.is(pg_temp.vejo('tarefas'), p_tarefas, p_caso || ': tarefas');
  return next extensions.is(pg_temp.vejo('demandas'), p_demandas, p_caso || ': demandas');
  return next extensions.is(pg_temp.vejo('processos'), p_processos, p_caso || ': processos');
end $$;
grant execute on function pg_temp.entra(integer), pg_temp.vejo(text), pg_temp.chaves(boolean, boolean), pg_temp.confere(integer, text, text, text, text) to authenticated;
grant usage on schema extensions to authenticated;

-- Quando a fase de adaptação está desligada:
select pg_temp.chaves(false, false);
select pg_temp.confere(1, 'T1 T2 T3 T4 T5 T6 T7', 'D1 D2 D3 D4 D5', 'P1 P2 P3 P4 P5', 'chaves desligadas, então a administradora vê todo o escritório');
select pg_temp.confere(2, 'T2 T3 T4 T5 T7', 'D2 D3 D4 D5', 'P2 P3 P4 P5', 'chaves desligadas, então a Bia vê só o que criou, assumiu, participa ou pela demanda ligada');
select pg_temp.confere(3, '', '', '', 'chaves desligadas, então quem não tem vínculo não vê nada');
select pg_temp.confere(4, 'T9', 'D9', 'P9', 'chaves desligadas, então o outro escritório vê só o dele');

-- Quando só a chave de ver tudo está ligada:
select pg_temp.chaves(true, false);
select pg_temp.confere(3, 'T1 T2 T3 T4 T5 T6 T7', 'D1 D2 D3 D4 D5', 'P1 P2 P3 P4 P5', 'equipe vê tudo, então quem não tem vínculo vê todo o escritório');
select pg_temp.confere(4, 'T9', 'D9', 'P9', 'equipe vê tudo, então o outro escritório continua vendo só o dele');

-- Quando a fase de adaptação está ligada:
select pg_temp.chaves(true, true);
select pg_temp.confere(3, 'T1 T2 T3 T4 T5 T6 T7', 'D1 D2 D3 D4 D5', 'P1 P2 P3 P4 P5', 'fase ligada, então quem não tem vínculo vê todo o escritório');
select pg_temp.confere(4, 'T9', 'D9', 'P9', 'fase ligada, então o outro escritório continua vendo só o dele');

-- Quando só a chave de editar tudo está ligada, ela também dá a leitura, como nas funções:
select pg_temp.chaves(false, true);
select pg_temp.confere(3, 'T1 T2 T3 T4 T5 T6 T7', 'D1 D2 D3 D4 D5', 'P1 P2 P3 P4 P5', 'equipe edita tudo, então quem não tem vínculo vê todo o escritório');

-- Dada a fase ligada, quando a sessão foi encerrada ou a pessoa foi desativada, então não vê nada.
select pg_temp.chaves(true, true);
delete from auth.sessions where id = '50000000-0000-0000-0000-000000000002';
update public.perfis set ativo = false where id = 'a0000000-0000-0000-0000-000000000003';
select pg_temp.confere(2, '', '', '', 'sessão encerrada, então não vê nada');
select pg_temp.confere(3, '', '', '', 'pessoa desativada, então não vê nada');

-- Dada a regra de leitura, então a busca não confere mais a pessoa cartão a cartão.
select set_config('role', 'none', true);
select ok(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'demandas' and policyname = 'leitura' and qual ~ 'vejo_demanda'), 'a leitura de demandas não chama a função a cada cartão');
select ok(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'processos' and policyname = 'leitura' and qual ~ 'vejo_processo'), 'a leitura de processos não chama a função a cada cartão');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tarefas' and policyname = 'leitura' and qual ~ 'demanda_id IS NOT NULL.*vejo_tarefa'), 'a leitura de tarefas só chama a função para o caso da demanda ligada');

select * from finish();
rollback;
