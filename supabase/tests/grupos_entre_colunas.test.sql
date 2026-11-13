-- Grupo do quadro entre colunas sem grupo (#296). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Dado um escritório com um quadro de tarefas como o de antes da #296: colunas sem grupo de ordem 1 a 4 e dois grupos
-- com a ordem contada só entre eles (1 e 2), e outro escritório com um grupo.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-grupos-1'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-grupos-2');
delete from public.quadro_grupos where escritorio_id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002');
delete from public.quadro_colunas where escritorio_id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002') and modulo = 'tarefas';
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, grupo_id) values
  ('e0000000-0000-0000-0000-000000000001', 'tarefas', 'Para fazer', 1, null),
  ('e0000000-0000-0000-0000-000000000001', 'tarefas', 'Fazendo', 2, null),
  ('e0000000-0000-0000-0000-000000000001', 'tarefas', 'Concluída', 4, null),
  ('e0000000-0000-0000-0000-000000000002', 'tarefas', 'Única', 7, null);
-- Os grupos entram como a versão anterior do site os gravava (o gatilho de grupo novo fica de fora nesta montagem).
set local session_replication_role = replica;
insert into public.quadro_grupos (id, escritorio_id, modulo, nome, ordem) values
  ('90000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'tarefas', 'Aguardado', 1),
  ('90000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'tarefas', 'Arquivo', 2),
  ('90000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'tarefas', 'Do outro', 1);
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, grupo_id) values
  ('e0000000-0000-0000-0000-000000000001', 'tarefas', 'Análise', 3, '90000000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

create function pg_temp.ordem(p_id uuid) returns double precision language sql as $$ select ordem from public.quadro_grupos where id = p_id $$;
create function pg_temp.topo_em_ordem(p_escritorio uuid, p_modulo text) returns boolean language sql as $$
  -- Toda coluna sem grupo vem antes de todo grupo do quadro (a aparência de antes da #296).
  select coalesce((select max(c.ordem) from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = p_modulo and c.grupo_id is null), 0)
         < coalesce((select min(g.ordem) from public.quadro_grupos g where g.escritorio_id = p_escritorio and g.modulo = p_modulo), 'infinity')
$$;

-- Quando os grupos do primeiro escritório vão para depois das colunas,
select privado.grupos_depois_das_colunas('e0000000-0000-0000-0000-000000000001', 'tarefas');

-- então cada grupo fica depois de todas as colunas do quadro, com a folga, na mesma sequência de antes,
select is(pg_temp.ordem('90000000-0000-0000-0000-000000000001'), 4 + privado.folga_dos_grupos() + 1, 'Então o primeiro grupo fica depois da última coluna, com a folga');
select is(pg_temp.ordem('90000000-0000-0000-0000-000000000002'), 4 + privado.folga_dos_grupos() + 2, 'Então o segundo grupo continua depois do primeiro');
select ok(pg_temp.topo_em_ordem('e0000000-0000-0000-0000-000000000001', 'tarefas'), 'Então o quadro aparece como antes: as colunas sem grupo antes dos grupos');
-- e o outro escritório não muda.
select is(pg_temp.ordem('90000000-0000-0000-0000-000000000003'), 1::double precision, 'Então o grupo do outro escritório não muda');

-- Quando a versão anterior do site cria duas colunas sem grupo (maior ordem de coluna + 1, sem olhar os grupos),
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem) values
  ('e0000000-0000-0000-0000-000000000001', 'tarefas', 'Nova antiga 1', 5),
  ('e0000000-0000-0000-0000-000000000001', 'tarefas', 'Nova antiga 2', 6);
-- então elas continuam antes dos grupos, onde aquela versão as mostra.
select ok(pg_temp.topo_em_ordem('e0000000-0000-0000-0000-000000000001', 'tarefas'), 'Quando o site anterior cria colunas, então elas ficam antes dos grupos');

-- Quando a versão anterior cria um grupo num quadro sem grupos (ordem 1), então ele vai para depois das colunas.
insert into public.quadro_grupos (id, escritorio_id, modulo, nome, ordem) values
  ('90000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'demandas', 'Grupo antigo', 1);
select ok(pg_temp.topo_em_ordem('e0000000-0000-0000-0000-000000000001', 'demandas'), 'Quando o site anterior cria um grupo com ordem 1, então ele fica depois das colunas');
-- E o grupo que o site novo cria no fim do quadro fica com a ordem que ele mandou.
insert into public.quadro_grupos (id, escritorio_id, modulo, nome, ordem) values
  ('90000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'demandas', 'Grupo novo', 5000000);
select is(pg_temp.ordem('90000000-0000-0000-0000-000000000005'), 5000000::double precision, 'Quando o site novo cria um grupo no fim, então a ordem dele fica como veio');

-- Quando a função roda para todos os quadros, então o outro escritório também fica com o grupo depois das colunas.
select privado.grupos_depois_das_colunas(null, null);
select is(pg_temp.ordem('90000000-0000-0000-0000-000000000003'), 7 + privado.folga_dos_grupos() + 1, 'Quando roda para todos, então cada quadro fica com os grupos depois das colunas');

-- Quando um escritório novo é criado, então os grupos de Processos nascem depois das colunas.
insert into public.escritorios (id, nome, slug) values ('e0000000-0000-0000-0000-000000000003', 'Escritório novo', 'teste-grupos-3');
select ok(pg_temp.topo_em_ordem('e0000000-0000-0000-0000-000000000003', 'processos_judiciais')
          and pg_temp.topo_em_ordem('e0000000-0000-0000-0000-000000000003', 'processos_administrativos'),
  'Quando o escritório é novo, então os grupos de Processos ficam depois de todas as colunas');
select ok((select bool_and(g.ordem > (select max(c.ordem) from public.quadro_colunas c where c.escritorio_id = g.escritorio_id and c.modulo = g.modulo))
           from public.quadro_grupos g where g.escritorio_id = 'e0000000-0000-0000-0000-000000000003'),
  'Então nenhum grupo do escritório novo tem a ordem no meio das colunas');

select * from finish();
rollback;
