-- Colunas de espera no quadro de Tarefas (#314). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

create function pg_temp.nomes(p_escritorio uuid) returns text language sql as $$
  select string_agg(nome, ' | ' order by ordem) from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'tarefas'
$$;
create function pg_temp.acrescentar(p_escritorio uuid) returns int language sql as $$
  select privado.acrescentar_colunas_padrao(p_escritorio, 'tarefas', privado.colunas_novas_das_tarefas(), 'Fazendo')
$$;
-- O quadro como estava antes da mudança: sem as duas colunas novas.
create function pg_temp.como_antes(p_escritorio uuid) returns void language sql as $$
  delete from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'tarefas'
    and nome in ('Aguardando: análise do solicitante', 'Aguardando: retorno do cliente')
$$;

-- Dado um escritório novo,
insert into public.escritorios (id, nome, slug) values ('e1000000-0000-0000-0000-000000000001', 'Escritório Novo', 'novo-314');
-- então o quadro de Tarefas já nasce com as duas colunas, depois de "Fazendo", e com os marcos de sempre.
select is(pg_temp.nomes('e1000000-0000-0000-0000-000000000001'),
  'Para fazer | Fazendo | Aguardando: análise do solicitante | Aguardando: retorno do cliente | Aguardando retorno | Concluída',
  'Dado um escritório novo, então o quadro de Tarefas nasce com as duas colunas depois de "Fazendo"');
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e1000000-0000-0000-0000-000000000001' and modulo = 'tarefas'
           and nome like 'Aguardando:%' and marco is null and grupo_id is null), 2::bigint,
  'Então as colunas novas são comuns (sem marco nem grupo)');
select is((select string_agg(nome, ' | ' order by ordem) from public.quadro_sugestoes where modulo = 'tarefas'),
  'Para fazer | Fazendo | Aguardando: análise do solicitante | Aguardando: retorno do cliente | Aguardando retorno | Concluída',
  'Então as sugestões do quadro de Tarefas têm as duas, na mesma ordem');

-- Dado um escritório que já existe, com o quadro de antes da mudança,
insert into public.escritorios (id, nome, slug) values ('e1000000-0000-0000-0000-000000000002', 'Escritório Antigo', 'antigo-314');
select pg_temp.como_antes('e1000000-0000-0000-0000-000000000002');
-- e com tarefas de Ana em duas colunas ("Fazendo" e "Aguardando retorno"),
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e1000000-0000-0000-0000-000000000002', 'ana-314@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c314'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana-314@exemplo.test', '{"convite":"c314"}', now(), now());
set local session_replication_role = replica;   -- as tarefas entram sem passar pelos gatilhos, na coluna e na ordem exatas
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, etapa_id, etapa_ordem) values
  ('71000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'T1', 'Fazendo agora', 'a1000000-0000-0000-0000-000000000001',
    (select id from public.quadro_colunas where escritorio_id = 'e1000000-0000-0000-0000-000000000002' and modulo = 'tarefas' and nome = 'Fazendo'), 1),
  ('71000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'T2', 'Esperando', 'a1000000-0000-0000-0000-000000000001',
    (select id from public.quadro_colunas where escritorio_id = 'e1000000-0000-0000-0000-000000000002' and modulo = 'tarefas' and nome = 'Aguardando retorno'), 2);
set local session_replication_role = origin;
create temporary table tarefas_antes as
  select id, etapa_id, etapa_ordem, atualizado_em from public.tarefas where escritorio_id = 'e1000000-0000-0000-0000-000000000002';
create temporary table antes as
  select id, nome, ordem, marco, grupo_id from public.quadro_colunas where escritorio_id = 'e1000000-0000-0000-0000-000000000002' and modulo = 'tarefas';
create temporary table do_novo as
  select id, nome, ordem from public.quadro_colunas where escritorio_id = 'e1000000-0000-0000-0000-000000000001';
-- quando a mudança entra,
select is(pg_temp.acrescentar('e1000000-0000-0000-0000-000000000002'), 2, 'Quando a mudança entra no escritório antigo, então entram as duas colunas');
-- então elas ficam entre "Fazendo" e a coluna seguinte, e as colunas que ele tinha não mudam.
select is(pg_temp.nomes('e1000000-0000-0000-0000-000000000002'),
  'Para fazer | Fazendo | Aguardando: análise do solicitante | Aguardando: retorno do cliente | Aguardando retorno | Concluída',
  'Então as duas ficam depois de "Fazendo"');
select is((select count(*) from antes a join public.quadro_colunas c using (id)
           where c.nome = a.nome and c.ordem = a.ordem and c.marco is not distinct from a.marco and c.grupo_id is not distinct from a.grupo_id),
  (select count(*) from antes), 'Então as colunas que ele já tinha continuam iguais (nome, ordem, marco e grupo)');
select is((select count(*) from do_novo d join public.quadro_colunas c using (id) where c.nome = d.nome and c.ordem = d.ordem),
  (select count(*) from public.quadro_colunas where escritorio_id = 'e1000000-0000-0000-0000-000000000001'),
  'Então o outro escritório não muda');
select is((select count(*) from public.tarefas where escritorio_id = 'e1000000-0000-0000-0000-000000000002'), 2::bigint,
  'Então as tarefas dele continuam as mesmas duas');
select is((select count(*) from tarefas_antes a join public.tarefas t using (id)
           where t.etapa_id = a.etapa_id and t.etapa_ordem = a.etapa_ordem and t.atualizado_em = a.atualizado_em), 2::bigint,
  'Então cada tarefa continua na mesma coluna e na mesma ordem, sem ser alterada');
-- Quando a mudança entra de novo, então nada se repete.
select is(pg_temp.acrescentar('e1000000-0000-0000-0000-000000000002'), 0, 'Quando roda de novo, então nenhuma coluna entra');
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e1000000-0000-0000-0000-000000000002' and modulo = 'tarefas'), 6::bigint,
  'Então o quadro continua com seis colunas');

-- Dado um escritório que criou à mão uma das colunas, com outra escrita (sem acento, sem dois-pontos, em maiúsculas),
insert into public.escritorios (id, nome, slug) values ('e1000000-0000-0000-0000-000000000003', 'Escritório Que Criou', 'criou-314');
select pg_temp.como_antes('e1000000-0000-0000-0000-000000000003');
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por) values
  ('e1000000-0000-0000-0000-000000000003', 'tarefas', 'AGUARDANDO  RETORNO DO CLIENTE', 3.5, null);
-- quando a mudança entra, então só a outra entra.
select is(pg_temp.acrescentar('e1000000-0000-0000-0000-000000000003'), 1, 'Dado a coluna criada à mão com outra escrita, então só a outra entra');
select is(pg_temp.nomes('e1000000-0000-0000-0000-000000000003'),
  'Para fazer | Fazendo | Aguardando: análise do solicitante | AGUARDANDO  RETORNO DO CLIENTE | Aguardando retorno | Concluída',
  'Então a coluna criada à mão fica onde estava, sem repetir');

-- Dado um escritório com nomes parecidos ("Aguardando análise do solicitante" e "Aguardando retorno do advogado solicitante"),
insert into public.escritorios (id, nome, slug) values ('e1000000-0000-0000-0000-000000000004', 'Escritório Parecido', 'parecido-314');
select pg_temp.como_antes('e1000000-0000-0000-0000-000000000004');
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por) values
  ('e1000000-0000-0000-0000-000000000004', 'tarefas', 'Aguardando retorno do advogado solicitante', 2.5, null),
  ('e1000000-0000-0000-0000-000000000004', 'tarefas', 'Aguardando cliente', 2.7, null);
select is(pg_temp.acrescentar('e1000000-0000-0000-0000-000000000004'), 0, 'Dado colunas de nomes parecidos, então nenhuma entra');
select is(privado.chave_da_coluna('Aguardando análise do solicitante'), privado.chave_da_coluna(' aguardando: ANALISE do  solicitante '),
  'Então a comparação ignora maiúsculas, acentos, espaços e sinais');

-- Dado um escritório que pôs "Fazendo" num grupo,
insert into public.escritorios (id, nome, slug) values ('e1000000-0000-0000-0000-000000000005', 'Escritório Com Grupo', 'grupo-314');
select pg_temp.como_antes('e1000000-0000-0000-0000-000000000005');
insert into public.quadro_grupos (id, escritorio_id, modulo, nome, ordem) values
  ('91000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', 'tarefas', 'Em curso', 1000010);
update public.quadro_colunas set grupo_id = '91000000-0000-0000-0000-000000000005'
  where escritorio_id = 'e1000000-0000-0000-0000-000000000005' and modulo = 'tarefas' and nome in ('Fazendo', 'Aguardando retorno');
-- quando a mudança entra, então as duas entram no grupo, entre "Fazendo" e a coluna seguinte do grupo.
select is(pg_temp.acrescentar('e1000000-0000-0000-0000-000000000005'), 2, 'Dado "Fazendo" num grupo, então as duas entram');
select is((select string_agg(nome, ' | ' order by ordem) from public.quadro_colunas where grupo_id = '91000000-0000-0000-0000-000000000005'),
  'Fazendo | Aguardando: análise do solicitante | Aguardando: retorno do cliente | Aguardando retorno',
  'Então elas ficam no grupo de "Fazendo", logo depois dela');

-- Dado um escritório que renomeou "Fazendo",
insert into public.escritorios (id, nome, slug) values ('e1000000-0000-0000-0000-000000000006', 'Escritório Renomeou', 'renomeou-314');
select pg_temp.como_antes('e1000000-0000-0000-0000-000000000006');
update public.quadro_colunas set nome = 'Em execução' where escritorio_id = 'e1000000-0000-0000-0000-000000000006' and modulo = 'tarefas' and nome = 'Fazendo';
-- quando a mudança entra, então as duas ficam antes da coluna das concluídas.
select is(pg_temp.acrescentar('e1000000-0000-0000-0000-000000000006'), 2, 'Dado o quadro sem "Fazendo", então as duas entram');
select is(pg_temp.nomes('e1000000-0000-0000-0000-000000000006'),
  'Para fazer | Em execução | Aguardando retorno | Aguardando: análise do solicitante | Aguardando: retorno do cliente | Concluída',
  'Então elas ficam logo antes da coluna das concluídas');

-- Dado um escritório sem nenhuma coluna de tarefas, quando a mudança entra, então o quadro continua vazio (o preparo é que o monta).
insert into public.escritorios (id, nome, slug) values ('e1000000-0000-0000-0000-000000000007', 'Escritório Vazio', 'vazio-314');
delete from public.quadro_colunas where escritorio_id = 'e1000000-0000-0000-0000-000000000007' and modulo = 'tarefas';
select is(pg_temp.acrescentar('e1000000-0000-0000-0000-000000000007'), 0, 'Dado um quadro vazio, então nenhuma coluna entra');

-- Então quem está logado não chama a função (ela é do banco, não do site).
select ok(not has_function_privilege('authenticated', 'privado.acrescentar_colunas_padrao(uuid, text, jsonb, text, text)', 'execute'),
  'Então o site não pode chamar a função que acrescenta colunas');

select * from finish();
rollback;
