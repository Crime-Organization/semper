-- "Aguardando MP" e "Em acompanhamento" no quadro de Processos judiciais (#315). Roda num banco local:
-- supabase db start && supabase test db. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo é desfeito no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- O topo do quadro judicial na ordem da tela: "Grupo X" para cada grupo, o nome de cada coluna sem grupo.
create function pg_temp.topo(p_escritorio uuid) returns text language sql as $$
  select string_agg(nome, ' | ' order by ordem) from (
    select 'Grupo ' || nome as nome, ordem from public.quadro_grupos where escritorio_id = p_escritorio and modulo = 'processos_judiciais'
    union all
    select nome, ordem from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'processos_judiciais' and grupo_id is null) t
$$;
create function pg_temp.do_grupo(p_escritorio uuid, p_grupo text) returns text language sql as $$
  select string_agg(c.nome, ' | ' order by c.ordem) from public.quadro_colunas c join public.quadro_grupos g on g.id = c.grupo_id
  where c.escritorio_id = p_escritorio and c.modulo = 'processos_judiciais' and g.nome = p_grupo
$$;
create function pg_temp.acrescentar(p_escritorio uuid) returns int language sql as $$
  select privado.acrescentar_colunas_padrao(p_escritorio, 'processos_judiciais', privado.colunas_novas_dos_processos(), null,
    privado.grupo_novo_dos_processos())
$$;
-- O quadro como estava antes da mudança: sem o grupo novo e as duas colunas.
create function pg_temp.como_antes(p_escritorio uuid) returns void language sql as $$
  delete from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'processos_judiciais' and nome in ('Aguardando MP', 'Em acompanhamento');
  delete from public.quadro_grupos where escritorio_id = p_escritorio and modulo = 'processos_judiciais' and nome = 'Acompanhamento';
$$;
create function pg_temp.marco(p_escritorio uuid, p_marco text) returns text language sql as $$
  select nome from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'processos_judiciais' and marco = p_marco
$$;

-- Dado um escritório novo,
insert into public.escritorios (id, nome, slug) values ('e2000000-0000-0000-0000-000000000001', 'Escritório Novo', 'novo-315');
-- então o quadro judicial já nasce com o grupo "Acompanhamento" entre "Cumprimento" e "Encerrado", com as duas colunas.
select is(pg_temp.topo('e2000000-0000-0000-0000-000000000001'),
  'Grupo Início | Grupo Conhecimento | Grupo Decisão | Grupo Recursal | Grupo Cumprimento | Grupo Acompanhamento | Grupo Encerrado',
  'Dado um escritório novo, então o grupo "Acompanhamento" fica entre "Cumprimento" e "Encerrado"');
select is(pg_temp.do_grupo('e2000000-0000-0000-0000-000000000001', 'Acompanhamento'), 'Aguardando MP | Em acompanhamento',
  'Então o grupo tem "Aguardando MP" e "Em acompanhamento"');
select ok((select min(g.ordem) from public.quadro_grupos g where g.escritorio_id = 'e2000000-0000-0000-0000-000000000001' and g.modulo = 'processos_judiciais')
           > (select max(c.ordem) from public.quadro_colunas c where c.escritorio_id = 'e2000000-0000-0000-0000-000000000001' and c.modulo = 'processos_judiciais'),
  'Então os grupos ficam depois de todas as colunas, como em todo quadro (#296)');
select is(pg_temp.marco('e2000000-0000-0000-0000-000000000001', 'inicio'), 'Distribuído', 'Então a coluna do início continua a mesma');
select is(pg_temp.marco('e2000000-0000-0000-0000-000000000001', 'concluido'), 'Baixado/arquivado', 'Então a coluna das concluídas continua a mesma');
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e2000000-0000-0000-0000-000000000001' and modulo = 'processos_administrativos'
           and nome in ('Aguardando MP', 'Em acompanhamento')), 0::bigint, 'Então o quadro administrativo não muda');

-- Dado um escritório que já existe, com o quadro de antes da mudança,
insert into public.escritorios (id, nome, slug) values ('e2000000-0000-0000-0000-000000000002', 'Escritório Antigo', 'antigo-315');
select pg_temp.como_antes('e2000000-0000-0000-0000-000000000002');
create temporary table antes as
  select id, nome, ordem, marco, grupo_id from public.quadro_colunas where escritorio_id = 'e2000000-0000-0000-0000-000000000002';
create temporary table grupos_antes as
  select id, nome, ordem from public.quadro_grupos where escritorio_id = 'e2000000-0000-0000-0000-000000000002';
create temporary table do_novo as
  select id, nome, ordem, grupo_id from public.quadro_colunas where escritorio_id = 'e2000000-0000-0000-0000-000000000001';
-- quando a mudança entra,
select is(pg_temp.acrescentar('e2000000-0000-0000-0000-000000000002'), 2, 'Quando a mudança entra no escritório antigo, então entram as duas colunas');
-- então o grupo novo fica antes de "Encerrado", e o que ele tinha não muda.
select is(pg_temp.topo('e2000000-0000-0000-0000-000000000002'),
  'Grupo Início | Grupo Conhecimento | Grupo Decisão | Grupo Recursal | Grupo Cumprimento | Grupo Acompanhamento | Grupo Encerrado',
  'Então o grupo "Acompanhamento" fica entre "Cumprimento" e "Encerrado"');
select is((select count(*) from antes a join public.quadro_colunas c using (id)
           where c.nome = a.nome and c.ordem = a.ordem and c.marco is not distinct from a.marco and c.grupo_id is not distinct from a.grupo_id),
  (select count(*) from antes), 'Então as colunas que ele tinha continuam iguais (nome, ordem, marco e grupo)');
select is((select count(*) from grupos_antes a join public.quadro_grupos g using (id) where g.nome = a.nome and g.ordem = a.ordem),
  (select count(*) from grupos_antes), 'Então os grupos que ele tinha continuam iguais');
select is((select count(*) from do_novo d join public.quadro_colunas c using (id) where c.nome = d.nome and c.ordem = d.ordem
           and c.grupo_id is not distinct from d.grupo_id),
  (select count(*) from public.quadro_colunas where escritorio_id = 'e2000000-0000-0000-0000-000000000001'), 'Então o outro escritório não muda');
-- Quando roda de novo, então nada se repete.
select is(pg_temp.acrescentar('e2000000-0000-0000-0000-000000000002'), 0, 'Quando roda de novo, então nenhuma coluna entra');

-- Dado um escritório que criou à mão "Aguardando Ministério Público",
insert into public.escritorios (id, nome, slug) values ('e2000000-0000-0000-0000-000000000003', 'Escritório Que Criou', 'criou-315');
select pg_temp.como_antes('e2000000-0000-0000-0000-000000000003');
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por) values
  ('e2000000-0000-0000-0000-000000000003', 'processos_judiciais', 'aguardando ministerio publico', 99, null);
-- quando a mudança entra, então só "Em acompanhamento" entra, no grupo novo.
select is(pg_temp.acrescentar('e2000000-0000-0000-0000-000000000003'), 1, 'Dado a coluna parecida criada à mão, então só a outra entra');
select is(pg_temp.do_grupo('e2000000-0000-0000-0000-000000000003', 'Acompanhamento'), 'Em acompanhamento', 'Então o grupo novo tem só ela');

-- Dado um escritório que já tem um grupo "ACOMPANHAMENTO", com uma coluna,
insert into public.escritorios (id, nome, slug) values ('e2000000-0000-0000-0000-000000000004', 'Escritório Com Grupo', 'grupo-315');
select pg_temp.como_antes('e2000000-0000-0000-0000-000000000004');
insert into public.quadro_grupos (id, escritorio_id, modulo, nome, ordem) values
  ('92000000-0000-0000-0000-000000000004', 'e2000000-0000-0000-0000-000000000004', 'processos_judiciais', 'ACOMPANHAMENTO', 3000000);
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, grupo_id) values
  ('e2000000-0000-0000-0000-000000000004', 'processos_judiciais', 'Vigiar', 1, null, '92000000-0000-0000-0000-000000000004');
-- quando a mudança entra, então as duas entram no fim dele, sem grupo repetido.
select is(pg_temp.acrescentar('e2000000-0000-0000-0000-000000000004'), 2, 'Dado o grupo já criado à mão, então as duas entram');
select is(pg_temp.do_grupo('e2000000-0000-0000-0000-000000000004', 'ACOMPANHAMENTO'), 'Vigiar | Aguardando MP | Em acompanhamento',
  'Então elas ficam no fim do grupo que ele já tinha');

select * from finish();
rollback;
