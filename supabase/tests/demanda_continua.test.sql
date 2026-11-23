-- Demanda contínua por grupo da equipe (#313, parte C). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master), Bia, Caio e Eva (usuários comuns), e o Davi, master de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-continua', '{"pessoas": true, "tarefas": true, "demandas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-continua-2', '{"pessoas": true, "tarefas": true, "demandas": true}');
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
-- O que o banco guarda, sem as regras de leitura (para conferir o que quem não vê não enxerga).
create function pg_temp.demandas_da(p_tarefa text) returns uuid[] language sql security definer as $$
  select demanda_ids from public.tarefas where id = p_tarefa::uuid
$$;
create function pg_temp.continua(p_grupo text) returns uuid language sql security definer as $$
  select d.id from public.demandas d left join public.grupos_da_equipe g on g.id = d.continua_grupo_id
  where d.escritorio_id = 'e0000000-0000-0000-0000-000000000001' and d.continua and g.nome is not distinct from p_grupo
$$;
create function pg_temp.coluna_concluida() returns uuid language sql security definer as $$
  select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'demandas' and marco = 'concluido'
$$;
grant execute on function pg_temp.id(int), pg_temp.demandas_da(text), pg_temp.continua(text), pg_temp.coluna_concluida() to authenticated;
create temp table grupos_do_teste (letra text primary key, id uuid);
grant select, insert on grupos_do_teste to authenticated;
create function pg_temp.g(p text) returns uuid language sql as $$ select id from grupos_do_teste where letra = p $$;
grant execute on function pg_temp.g(text) to authenticated;

-- E os grupos: o Núcleo A, com a Bia e o Caio; o Núcleo B, com o Caio. A Eva não está em grupo nenhum.
select pg_temp.entrar(1); set local role authenticated;
insert into grupos_do_teste values ('A', public.grupo_criar('Núcleo A')), ('B', public.grupo_criar('Núcleo B'));
select public.grupo_incluir_integrante(pg_temp.g('A'), pg_temp.id(2)), public.grupo_incluir_integrante(pg_temp.g('A'), pg_temp.id(3)),
       public.grupo_incluir_integrante(pg_temp.g('B'), pg_temp.id(3));

-- ---------- a tarefa sem demanda entra na contínua ----------
-- Quando a Bia (só no Núcleo A) cria uma tarefa sem demanda, então ela entra na contínua do Núcleo A, que nasce com ela
select pg_temp.entrar(2);
insert into public.tarefas (id, titulo, responsavel_id, criado_por) values ('70000000-0000-0000-0000-000000000001', 'Ligar para o cartório', auth.uid(), auth.uid());
select is(pg_temp.demandas_da('70000000-0000-0000-0000-000000000001'), array[pg_temp.continua('Núcleo A')], 'A tarefa avulsa entra na contínua do grupo de quem a cria');
select is((select demanda_id from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), pg_temp.continua('Núcleo A'), 'A contínua é a demanda principal (a versão anterior a vê)');
select results_eq($$ select titulo, continua, responsavel_id, criado_por, arquivado_em from public.demandas where id = pg_temp.continua('Núcleo A') $$,
  $$ values ('Contínua: Núcleo A', true, pg_temp.id(1), pg_temp.id(1), null::timestamptz) $$, 'A contínua tem o nome do grupo e a administradora como responsável e criadora');
-- Quando a Bia escolhe uma demanda de verdade, então a tarefa não entra na contínua
insert into public.demandas (id, titulo, responsavel_id, criado_por) values ('d0000000-0000-0000-0000-000000000001', 'Inventário', auth.uid(), auth.uid());
insert into public.tarefas (id, titulo, responsavel_id, demanda_ids, criado_por) values
  ('70000000-0000-0000-0000-000000000002', 'Juntar certidões', auth.uid(), '{d0000000-0000-0000-0000-000000000001}', auth.uid());
select is(pg_temp.demandas_da('70000000-0000-0000-0000-000000000002'), '{d0000000-0000-0000-0000-000000000001}'::uuid[], 'A tarefa com demanda não vai para a contínua');
-- Quando uma tarefa avulsa ganha uma demanda de verdade, então sai da contínua
insert into public.tarefas (id, titulo, responsavel_id, criado_por) values ('70000000-0000-0000-0000-000000000008', 'Avulsa que ganha demanda', auth.uid(), auth.uid());
update public.tarefas set demanda_ids = demanda_ids || 'd0000000-0000-0000-0000-000000000001'::uuid where id = '70000000-0000-0000-0000-000000000008';
select is(pg_temp.demandas_da('70000000-0000-0000-0000-000000000008'), '{d0000000-0000-0000-0000-000000000001}'::uuid[], 'A tarefa que ganha uma demanda de verdade sai da contínua');
-- E o Desfazer, que a devolve à contínua, é aceito
update public.tarefas set demanda_ids = array[pg_temp.continua('Núcleo A')] where id = '70000000-0000-0000-0000-000000000008';
select is(pg_temp.demandas_da('70000000-0000-0000-0000-000000000008'), array[pg_temp.continua('Núcleo A')], 'A tarefa volta à contínua do grupo');

-- ---------- quem vê continua o mesmo ----------
-- Dado o Caio, também do Núcleo A, então ele vê a contínua do grupo, mas não a tarefa da Bia (a contínua só agrupa)
select pg_temp.entrar(3);
select is((select count(*) from public.demandas where id = pg_temp.continua('Núcleo A')), 1::bigint, 'Quem está no grupo vê a contínua dele');
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 0::bigint, 'Estar na contínua não abre a tarefa avulsa de outra pessoa');
update public.tarefas set titulo = 'Mudada' where id = '70000000-0000-0000-0000-000000000001';
select is((select titulo from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), null, 'Nem a altera');
-- E ele não muda a contínua (não está nela)
update public.demandas set titulo = 'Outra' where id = pg_temp.continua('Núcleo A');
select is((select titulo from public.demandas where id = pg_temp.continua('Núcleo A')), 'Contínua: Núcleo A', 'Quem está no grupo não muda a contínua');
-- Dado a Eva, sem grupo, então ela não vê a contínua do Núcleo A
select pg_temp.entrar(5);
select is((select count(*) from public.demandas where id = pg_temp.continua('Núcleo A')), 0::bigint, 'Quem não está no grupo não vê a contínua dele');
-- Mas a lista "sem demanda" de ligar tarefas sabe que ela é contínua (a tarefa avulsa dela em que a Eva está não some da lista)
select ok(pg_temp.continua('Núcleo A') = any(public.demandas_continuas()), 'As contínuas do escritório vêm todas, mesmo as de um grupo em que não está');
-- Quando a Eva cria uma tarefa sem demanda, então ela entra na Geral, que toda a equipe vê
insert into public.tarefas (id, titulo, responsavel_id, criado_por) values ('70000000-0000-0000-0000-000000000003', 'Pagar a guia', auth.uid(), auth.uid());
select is(pg_temp.demandas_da('70000000-0000-0000-0000-000000000003'), array[pg_temp.continua(null)], 'Quem não está em grupo nenhum vai para a Geral');
select is((select titulo from public.demandas where id = pg_temp.continua(null)), 'Contínua: Geral', 'A Geral tem esse nome');
select pg_temp.entrar(2);
select is((select count(*) from public.demandas where id = pg_temp.continua(null)), 1::bigint, 'Toda a equipe vê a Geral');
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000003'), 0::bigint, 'Mas não a tarefa avulsa da Eva');

-- ---------- o grupo escolhido no cadastro ----------
-- Quando o Caio (nos dois núcleos) cria sem escolher, então a tarefa vai para a Geral
select pg_temp.entrar(3);
insert into public.tarefas (id, titulo, responsavel_id, criado_por) values ('70000000-0000-0000-0000-000000000004', 'Revisar', auth.uid(), auth.uid());
select is(pg_temp.demandas_da('70000000-0000-0000-0000-000000000004'), array[pg_temp.continua(null)], 'Quem está em mais de um grupo e não escolhe vai para a Geral');
-- Quando ele pede a contínua do Núcleo B (o cadastro faz isso), então ela nasce, e pedir de novo devolve a mesma
select is(public.demanda_continua(pg_temp.g('B')), public.demanda_continua(pg_temp.g('B')), 'A contínua do grupo é uma só');
select is(public.demanda_continua(pg_temp.g('B')), pg_temp.continua('Núcleo B'), 'O cadastro acha a contínua do grupo escolhido');
insert into public.tarefas (id, titulo, responsavel_id, demanda_ids, criado_por) values
  ('70000000-0000-0000-0000-000000000005', 'Organizar a pasta', auth.uid(), array[public.demanda_continua(pg_temp.g('B'))], auth.uid());
select is(pg_temp.demandas_da('70000000-0000-0000-0000-000000000005'), array[pg_temp.continua('Núcleo B')], 'Quem está no grupo liga a tarefa à contínua dele');
select is(public.demanda_continua(null), pg_temp.continua(null), 'Qualquer um da equipe usa a Geral');
-- Dado a Eva, fora do Núcleo A, então ela não usa a contínua dele, nem a liga à mão
select pg_temp.entrar(5);
select throws_ok(format('select public.demanda_continua(%L)', pg_temp.g('A')), '42501', null, 'Quem não está no grupo não pede a contínua dele');
select throws_ok(format($$ insert into public.tarefas (titulo, responsavel_id, demanda_ids, criado_por) values ('X', auth.uid(), array[%L]::uuid[], auth.uid()) $$,
  pg_temp.continua('Núcleo A')), 'P0001', 'Demanda não encontrada neste escritório.', 'Nem liga a tarefa à contínua de um grupo em que não está');
-- Dado o Davi, de outro escritório, então ele não pede nem vê a contínua deste
select pg_temp.entrar(4);
select throws_ok(format('select public.demanda_continua(%L)', pg_temp.g('A')), 'P0001', 'Grupo não encontrado neste escritório.', 'Outro escritório não pede a contínua deste');
select is((select count(*) from public.demandas where escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 0::bigint, 'Outro escritório não vê as contínuas deste');
select ok(not pg_temp.continua('Núcleo A') = any(public.demandas_continuas()) and not pg_temp.continua(null) = any(public.demandas_continuas()),
  'Nem recebe os ids delas pela lista das contínuas');
-- E a tarefa sem demanda dele vai para a Geral do escritório dele
insert into public.tarefas (id, titulo, responsavel_id, criado_por) values ('70000000-0000-0000-0000-000000000006', 'Do outro', auth.uid(), auth.uid());
select is((select escritorio_id from public.demandas where id = (pg_temp.demandas_da('70000000-0000-0000-0000-000000000006'))[1]),
  'e0000000-0000-0000-0000-000000000002'::uuid, 'Cada escritório tem a sua Geral');

-- ---------- a contínua nunca é arquivada, concluída nem excluída ----------
select pg_temp.entrar(1);
select throws_ok(format('update public.demandas set arquivado_em = now() where id = %L', pg_temp.continua('Núcleo A')), 'P0001',
  'A demanda contínua não pode ser arquivada.', 'Nem a administradora arquiva a contínua');
select throws_ok(format('update public.demandas set etapa_id = %L where id = %L', pg_temp.coluna_concluida(), pg_temp.continua('Núcleo A')), 'P0001',
  'A demanda contínua não é concluída: ela reúne as tarefas avulsas.', 'A contínua não vai para a coluna das concluídas');
delete from public.demandas where id = pg_temp.continua('Núcleo A');
select isnt(pg_temp.continua('Núcleo A'), null, 'Nem a administradora exclui a contínua (só a arquivada sai, e ela nunca é arquivada)');
select throws_ok(format('update public.demandas set colaboradores = array[%L]::uuid[] where id = %L', pg_temp.id(5), pg_temp.continua('Núcleo A')), 'P0001',
  'A demanda contínua só reúne as tarefas avulsas: ela não tem colaboradores, grupos, clientes nem contrato.', 'A contínua não recebe colaboradores (abriria as tarefas)');
select throws_ok(format('update public.demandas set grupos = array[%L]::uuid[] where id = %L', pg_temp.g('B'), pg_temp.continua('Núcleo A')), 'P0001',
  'A demanda contínua só reúne as tarefas avulsas: ela não tem colaboradores, grupos, clientes nem contrato.', 'Nem grupos');
select lives_ok(format($$ update public.demandas set descricao = 'Tarefas soltas do núcleo' where id = %L $$, pg_temp.continua('Núcleo A')),
  'A administradora muda a descrição da contínua');
-- Quando alguém tenta criar uma contínua pela tela, então o banco recusa
select pg_temp.entrar(2);
select throws_ok($$ insert into public.demandas (titulo, responsavel_id, criado_por, continua) values ('Falsa', auth.uid(), auth.uid(), true) $$, 'P0001',
  'A demanda contínua é criada pelo sistema.', 'A contínua não nasce pela tela');
select throws_ok($$ update public.demandas set continua = true where id = 'd0000000-0000-0000-0000-000000000001' $$, '42501', null,
  'Uma demanda comum não vira contínua pela tela');

-- ---------- o grupo renomeado e o grupo excluído ----------
select pg_temp.entrar(1);
select public.grupo_renomear(pg_temp.g('A'), 'Núcleo Cível');
select is((select titulo from public.demandas where id = pg_temp.continua('Núcleo Cível')), 'Contínua: Núcleo Cível', 'O grupo renomeado renomeia a contínua');
-- Quando a Ana exclui o grupo, então as tarefas da contínua dele vão para a Geral e a contínua some
select public.grupo_excluir(pg_temp.g('A'));
select is(pg_temp.demandas_da('70000000-0000-0000-0000-000000000001'), array[pg_temp.continua(null)], 'A tarefa do grupo excluído vai para a Geral');
select is((select count(*) from public.demandas where continua and escritorio_id = 'e0000000-0000-0000-0000-000000000001'), 2::bigint,
  'A contínua do grupo excluído some (ficam a Geral e a do Núcleo B)');
select pg_temp.entrar(2);
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 1::bigint, 'Quem criou continua vendo a tarefa');

-- ---------- a importação, sem ninguém logado ----------
-- Quando uma tarefa é gravada sem ninguém logado (a importação do histórico), então ela fica sem demanda, como antes
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.tarefas (id, escritorio_id, titulo, responsavel_id) values
  ('70000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'Antiga', 'a0000000-0000-0000-0000-000000000002');
select is(pg_temp.demandas_da('70000000-0000-0000-0000-000000000007'), '{}'::uuid[], 'A importação não põe a tarefa na contínua');

-- As funções novas ou trocadas rodam com search_path vazio; a guarda roda como quem grava (para saber se veio da tela).
select is(array_agg(p.oid::regprocedure::text order by 1) filter (where not coalesce(p.proconfig @> array['search_path=""'], false)), null,
  'Toda função nova ou trocada tem search_path vazio')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'privado') and p.proname in ('uso_a_continua', 'demanda_continua', 'demandas_continuas', 'titulo_da_continua', 'tarefa_na_continua', 'guardar_continua',
  'continua_do_grupo_excluido', 'continua_do_grupo_renomeado', 'estou_na_tarefa', 'estou_na_tarefa_ligada', 'ligacoes_da_tarefa', 'conferir_mencoes');
select ok(not (select prosecdef from pg_proc where proname = 'guardar_continua'), 'A guarda da contínua roda como quem grava');

select * from finish();
rollback;
