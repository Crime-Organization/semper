-- Funções dos participantes: só "Executa" de fábrica (#421). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado dois escritórios: no primeiro, Ana (administradora), Bia e Caio; no segundo, Davi (administrador) e Eva.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-so-executa', '{"pessoas": true, "tarefas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-so-executa-2', '{"pessoas": true, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'eva@exemplo.test', 'Eva', 'usuario', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'eva@exemplo.test', '{"convite":"c5"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 5) as n;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.funcao(p_escritorio text, p_nome text) returns uuid language sql security definer as $$
  select id from public.funcoes_na_tarefa where escritorio_id = p_escritorio::uuid and nome = p_nome
$$;
grant execute on function pg_temp.funcao(text, text) to authenticated;
-- As funções de um escritório, na ordem da lista.
create function pg_temp.lista(p_escritorio text) returns text language sql security definer as $$
  select string_agg(nome, ', ' order by ordem) from public.funcoes_na_tarefa where escritorio_id = p_escritorio::uuid
$$;
-- A função de um participante numa tarefa, pelo nome dela (null: sem função).
create function pg_temp.funcao_de(p_tarefa text, p_quem int) returns text language sql security definer as $$
  select f.nome from public.tarefas t join public.funcoes_na_tarefa f on f.id::text = t.funcoes ->> ('a0000000-0000-0000-0000-00000000000' || p_quem)
  where t.id = p_tarefa::uuid
$$;
grant execute on function pg_temp.funcao_de(text, int) to authenticated;

-- ---------- o escritório novo ----------
-- Quando um escritório é criado, então nasce só com "Executa", de execução
select is((select string_agg(nome || ':' || executa, ', ' order by ordem) from public.funcoes_na_tarefa where escritorio_id = 'e0000000-0000-0000-0000-000000000001'),
  'Executa:true', 'O escritório novo nasce só com Executa');
select is(pg_temp.lista('e0000000-0000-0000-0000-000000000002'), 'Executa', 'O outro escritório novo também');

-- ---------- a conversão dos escritórios que já existiam ----------
-- Dado o primeiro escritório com a "Acompanha" de fábrica (sem quem a criou), e o segundo com uma "Acompanha" que o Davi criou
insert into public.funcoes_na_tarefa (escritorio_id, nome, executa, criado_por) values ('e0000000-0000-0000-0000-000000000001', 'Acompanha', false, null);
insert into public.funcoes_na_tarefa (escritorio_id, nome, executa, criado_por)
  values ('e0000000-0000-0000-0000-000000000002', 'Acompanha', false, 'a0000000-0000-0000-0000-000000000004');
-- e uma tarefa em cada um: na primeira, a Bia executa e o Caio acompanha; na segunda, a Eva acompanha
select pg_temp.entrar(1); set local role authenticated;
insert into public.tarefas (id, titulo, responsavel_id, participantes, funcoes, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'Protocolar', auth.uid(), '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-000000000003}',
   jsonb_build_object('a0000000-0000-0000-0000-000000000002', pg_temp.funcao('e0000000-0000-0000-0000-000000000001', 'Executa'),
                      'a0000000-0000-0000-0000-000000000003', pg_temp.funcao('e0000000-0000-0000-0000-000000000001', 'Acompanha')), auth.uid());
select pg_temp.entrar(4);
insert into public.tarefas (id, titulo, responsavel_id, participantes, funcoes, criado_por) values
  ('70000000-0000-0000-0000-000000000002', 'Despachar', auth.uid(), '{a0000000-0000-0000-0000-000000000005}',
   jsonb_build_object('a0000000-0000-0000-0000-000000000005', pg_temp.funcao('e0000000-0000-0000-0000-000000000002', 'Acompanha')), auth.uid());
reset role;
select is(pg_temp.funcao_de('70000000-0000-0000-0000-000000000001', 3), 'Acompanha', 'Antes da conversão, o Caio acompanha');

-- Quando a conversão roda
select lives_ok($$ select privado.tirar_acompanha_de_fabrica() $$, 'A conversão roda');

-- Então, no primeiro escritório, a "Acompanha" de fábrica sai e o Caio fica sem função, mas continua na tarefa; a Bia continua executando
select is(pg_temp.lista('e0000000-0000-0000-0000-000000000001'), 'Executa', 'A Acompanha de fábrica sai');
select is((select funcoes ? 'a0000000-0000-0000-0000-000000000003' from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), false,
  'Quem acompanhava fica sem função');
select is((select participantes from public.tarefas where id = '70000000-0000-0000-0000-000000000001'),
  '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-000000000003}'::uuid[], 'Quem acompanhava continua na tarefa');
select is(pg_temp.funcao_de('70000000-0000-0000-0000-000000000001', 2), 'Executa', 'Quem executava continua executando');
select is((select participantes_com_funcao from public.tarefas where id = '70000000-0000-0000-0000-000000000001'),
  array['a0000000-0000-0000-0000-000000000002:' || pg_temp.funcao('e0000000-0000-0000-0000-000000000001', 'Executa')],
  'A lista dos filtros acompanha a conversão');
select is((select count(*) from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001'), 0::bigint,
  'A conversão não é uma alteração de alguém: não vai ao histórico');
-- e, no segundo, a "Acompanha" que o escritório criou fica, com a Eva
select is(pg_temp.lista('e0000000-0000-0000-0000-000000000002'), 'Executa, Acompanha', 'A Acompanha criada pelo escritório fica');
select is(pg_temp.funcao_de('70000000-0000-0000-0000-000000000002', 5), 'Acompanha', 'Quem está na Acompanha do escritório continua nela');

-- ---------- quem entra numa tarefa ----------
-- Dado o primeiro escritório com uma função que ele criou e que não é de execução
select pg_temp.entrar(1); set local role authenticated;
insert into public.funcoes_na_tarefa (nome, criado_por) values ('Revisa', auth.uid());
-- Quando a Ana cria uma tarefa com a Bia e o Caio, sem escolher a função de ninguém
insert into public.tarefas (id, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000003', 'Pedir documentos', auth.uid(), '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-000000000003}', auth.uid());
-- Então ninguém ganha função sozinho
select is((select funcoes from public.tarefas where id = '70000000-0000-0000-0000-000000000003'), '{}'::jsonb, 'Quem entra sem escolher fica sem função');
select is((select participantes_com_funcao from public.tarefas where id = '70000000-0000-0000-0000-000000000003'), '{}'::text[], 'E fora dos filtros de função');

-- Quando a Bia ganha a função "Executa" e depois fica sem função, então o histórico mostra as duas trocas
update public.tarefas set funcoes = jsonb_build_object('a0000000-0000-0000-0000-000000000002', pg_temp.funcao('e0000000-0000-0000-0000-000000000001', 'Executa'))
where id = '70000000-0000-0000-0000-000000000003';
select is((select alteracoes -> 'funcoes' from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000003' order by em desc limit 1),
  '{"de": "Bia: Sem função", "para": "Bia: Executa"}'::jsonb, 'Ganhar a função vai ao histórico');
update public.tarefas set funcoes = '{}' where id = '70000000-0000-0000-0000-000000000003';
select is((select funcoes from public.tarefas where id = '70000000-0000-0000-0000-000000000003'), '{}'::jsonb, 'A função é tirada');
select is((select alteracoes -> 'funcoes' from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000003'
           and alteracoes -> 'funcoes' ->> 'para' = 'Bia: Sem função'),
  '{"de": "Bia: Executa", "para": "Bia: Sem função"}'::jsonb, 'Ficar sem função vai ao histórico');

-- ---------- o escritório isolado ----------
-- Dado a Ana, do primeiro escritório, então ela não vê nem muda a "Acompanha" do segundo
select is((select count(*) from public.funcoes_na_tarefa where escritorio_id = 'e0000000-0000-0000-0000-000000000002'), 0::bigint, 'Outro escritório não vê as funções');
delete from public.funcoes_na_tarefa where escritorio_id = 'e0000000-0000-0000-0000-000000000002';
-- e ninguém pela tela chama a conversão, nem quem administra
select throws_ok($$ select privado.tirar_acompanha_de_fabrica() $$, '42501', null, 'A conversão é só do banco');
reset role;
select is(pg_temp.lista('e0000000-0000-0000-0000-000000000002'), 'Executa, Acompanha', 'As funções do outro escritório ficam');

select * from finish();
rollback;
