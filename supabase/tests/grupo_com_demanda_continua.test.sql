-- O filtro "Grupo da equipe" traz as tarefas da demanda contínua do grupo (#416). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master), Bia, Caio e Eva (usuários comuns), e o Davi, master de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-filtro-continua', '{"pessoas": true, "tarefas": true, "demandas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-filtro-continua-2', '{"pessoas": true, "tarefas": true, "demandas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eva@exemplo.test', 'Eva', 'usuario', privado.resumo_codigo('c5'), now());
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
create function pg_temp.id(p_quem int) returns uuid language sql as $$ select ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid $$;
grant execute on function pg_temp.id(int) to authenticated;
create temp table grupos_do_teste (letra text primary key, id uuid);
grant select, insert on grupos_do_teste to authenticated;
create function pg_temp.g(p text) returns uuid language sql as $$ select id from grupos_do_teste where letra = p $$;
grant execute on function pg_temp.g(text) to authenticated;
-- Os títulos das tarefas que o filtro traz para quem está logado, em ordem.
create function pg_temp.filtro(p_grupos uuid[], p_geral boolean) returns text[] language sql as $$
  select coalesce(array_agg(titulo order by titulo), '{}') from public.tarefas_do_filtro_de_grupo(p_grupos, p_geral)
$$;
grant execute on function pg_temp.filtro(uuid[], boolean) to authenticated;

-- E os grupos: o Núcleo A, com a Bia e o Caio; o Núcleo B, com o Caio. A Eva não está em grupo nenhum.
select pg_temp.entrar(1); set local role authenticated;
insert into grupos_do_teste values ('A', public.grupo_criar('Núcleo A')), ('B', public.grupo_criar('Núcleo B'));
select public.grupo_incluir_integrante(pg_temp.g('A'), pg_temp.id(2)), public.grupo_incluir_integrante(pg_temp.g('A'), pg_temp.id(3)),
       public.grupo_incluir_integrante(pg_temp.g('B'), pg_temp.id(3));

-- E as tarefas avulsas: a Bia (só no Núcleo A) cria duas, que entram na contínua do Núcleo A; numa delas a Eva é a responsável.
select pg_temp.entrar(2);
insert into public.tarefas (titulo, responsavel_id, criado_por) values ('A1 da Bia', auth.uid(), auth.uid()), ('A2 da Eva', pg_temp.id(5), auth.uid());
-- A Eva cria uma, que vai para a Geral; o Caio (nos dois núcleos) cria uma sem escolher (Geral) e uma na contínua do Núcleo B.
select pg_temp.entrar(5);
insert into public.tarefas (titulo, responsavel_id, criado_por) values ('G1 da Eva', auth.uid(), auth.uid());
select pg_temp.entrar(3);
insert into public.tarefas (titulo, responsavel_id, criado_por) values ('G2 do Caio', auth.uid(), auth.uid());
insert into public.tarefas (titulo, responsavel_id, demanda_ids, criado_por) values
  ('B1 do Caio', auth.uid(), array[public.demanda_continua(pg_temp.g('B'))], auth.uid());
-- E uma tarefa com o grupo Núcleo A marcado nela, numa demanda de verdade (o filtro de antes já a trazia).
select pg_temp.entrar(1);
insert into public.demandas (id, titulo, responsavel_id, criado_por) values ('d0000000-0000-0000-0000-000000000001', 'Inventário', auth.uid(), auth.uid());
insert into public.tarefas (titulo, responsavel_id, grupos, demanda_ids, criado_por) values
  ('Com o grupo A', auth.uid(), array[pg_temp.g('A')], '{d0000000-0000-0000-0000-000000000001}', auth.uid());

-- ---------- o grupo traz as tarefas da contínua dele ----------
-- Quando a Bia filtra pelo Núcleo A, então vê as tarefas da contínua do grupo (as que já via) e a que tem o grupo
select pg_temp.entrar(2);
select is(pg_temp.filtro(array[pg_temp.g('A')], false), array['A1 da Bia', 'A2 da Eva', 'Com o grupo A'], 'O grupo traz as tarefas da contínua dele');
-- E a função da versão anterior do site traz o mesmo
select is((select array_agg(titulo order by titulo) from public.tarefas_dos_grupos(array[pg_temp.g('A')])), array['A1 da Bia', 'A2 da Eva', 'Com o grupo A'],
  'A função da versão anterior também traz as da contínua');
-- Quando a administradora filtra pelo Núcleo B, então vê só a da contínua do Núcleo B
select pg_temp.entrar(1);
select is(pg_temp.filtro(array[pg_temp.g('B')], false), array['B1 do Caio'], 'O Núcleo B traz só a da contínua dele');
-- Quando o Caio filtra pelos grupos dele ("Dos meus grupos"), então vê as das contínuas dos dois que ele já vê
select pg_temp.entrar(3);
select is(pg_temp.filtro(array[pg_temp.g('A'), pg_temp.g('B')], false), array['B1 do Caio', 'Com o grupo A'], '"Dos meus grupos" traz as das contínuas dos meus grupos');

-- ---------- a Geral ----------
-- Quando a administradora escolhe a Geral, então vê as tarefas da contínua Geral, e não as dos grupos
select pg_temp.entrar(1);
select is(pg_temp.filtro('{}', true), array['G1 da Eva', 'G2 do Caio'], 'A Geral traz as tarefas da contínua Geral');
-- Quando a Eva escolhe a Geral, então vê só a dela (a do Caio ela não vê)
select pg_temp.entrar(5);
select is(pg_temp.filtro('{}', true), array['G1 da Eva'], 'Na Geral, cada pessoa vê só as tarefas que já via');

-- ---------- quem vê o quê continua igual ----------
-- Dado o Caio, no Núcleo A, quando filtra pelo Núcleo A, então não vê as tarefas da Bia (estar na contínua não abre a tarefa)
select pg_temp.entrar(3);
select is(pg_temp.filtro(array[pg_temp.g('A')], false), array['Com o grupo A'], 'Quem não pode ver uma tarefa não a vê pelo filtro');
-- Dada a Eva, fora do Núcleo A e responsável por uma tarefa da contínua dele, quando filtra pelo Núcleo A, então vê essa tarefa
select pg_temp.entrar(5);
select is(pg_temp.filtro(array[pg_temp.g('A')], false), array['A2 da Eva'], 'Quem está fora do grupo vê, pelo filtro, a tarefa da contínua em que está');
-- Mas a contínua do Núcleo A continua escondida dela
select is((select count(*) from public.demandas where continua and continua_grupo_id = pg_temp.g('A')), 0::bigint, 'O filtro não abre a contínua do grupo');

-- Dada uma demanda comum do Núcleo A e, nela, uma tarefa de que a Eva (fora do grupo e fora da demanda) é a responsável
select pg_temp.entrar(1);
insert into public.demandas (id, titulo, responsavel_id, grupos, criado_por) values
  ('d0000000-0000-0000-0000-000000000002', 'Partilha do Núcleo A', auth.uid(), array[pg_temp.g('A')], auth.uid());
insert into public.tarefas (titulo, responsavel_id, demanda_ids, criado_por) values
  ('Da Eva na demanda do A', pg_temp.id(5), '{d0000000-0000-0000-0000-000000000002}', auth.uid());
-- Quando a Eva filtra pelo Núcleo A, então vê também essa tarefa, como as da contínua (o filtro só escolhe entre as que ela já vê)
select pg_temp.entrar(5);
select is(pg_temp.filtro(array[pg_temp.g('A')], false), array['A2 da Eva', 'Da Eva na demanda do A'],
  'Quem está fora do grupo vê, pelo filtro, a tarefa da demanda do grupo em que está');
select is((select array_agg(titulo order by titulo) from public.tarefas_dos_grupos(array[pg_temp.g('A')])), array['A2 da Eva', 'Da Eva na demanda do A'],
  'A função da versão anterior também traz a tarefa da demanda do grupo');
-- Mas a demanda do Núcleo A continua escondida dela
select is((select count(*) from public.demandas where id = 'd0000000-0000-0000-0000-000000000002'), 0::bigint, 'O filtro não abre a demanda do grupo');
-- E o Davi, de outro escritório, não a alcança pelo filtro
select pg_temp.entrar(4);
select is(privado.demandas_do_filtro(array[pg_temp.g('A')], false), '{}'::uuid[], 'Outro escritório não recebe os ids das demandas do grupo deste');

-- ---------- escritório isolado ----------
-- Dado o Davi, de outro escritório, com uma tarefa avulsa na Geral dele
select pg_temp.entrar(4);
insert into public.tarefas (titulo, responsavel_id, criado_por) values ('Do outro escritório', auth.uid(), auth.uid());
-- Quando ele pede os grupos e a Geral deste escritório, então não recebe as contínuas nem as tarefas deste
select is(privado.continuas_do_filtro(array[pg_temp.g('A'), pg_temp.g('B')], false), '{}'::uuid[], 'Outro escritório não recebe os ids das contínuas deste');
select is(pg_temp.filtro(array[pg_temp.g('A'), pg_temp.g('B')], true), array['Do outro escritório'], 'Outro escritório vê pela Geral só a dele');
select is(array_length(privado.continuas_do_filtro('{}', true), 1), 1, 'A Geral de cada escritório é uma só');

select * from finish();
rollback;
