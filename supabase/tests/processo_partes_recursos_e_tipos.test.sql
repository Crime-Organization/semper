-- Processo: pessoas com papel, recursos e incidentais, e os tipos extrajudicial e investigação (#316). Roda num banco local:
-- supabase db start && supabase test db. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo é desfeito no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug) values
  ('e3160000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-316'),
  ('e3160000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-316-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e3160000-0000-0000-0000-000000000001', 'ana-316@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c3161'), now()),
  ('e3160000-0000-0000-0000-000000000001', 'bia-316@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c3162'), now()),
  ('e3160000-0000-0000-0000-000000000002', 'davi-316@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c3164'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a3160000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana-316@exemplo.test', '{"convite":"c3161"}', now(), now()),
  ('a3160000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia-316@exemplo.test', '{"convite":"c3162"}', now(), now()),
  ('a3160000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi-316@exemplo.test', '{"convite":"c3164"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('53160000-0000-0000-0000-000000000001', 'a3160000-0000-0000-0000-000000000001', now(), now()),
  ('53160000-0000-0000-0000-000000000002', 'a3160000-0000-0000-0000-000000000002', now(), now()),
  ('53160000-0000-0000-0000-000000000004', 'a3160000-0000-0000-0000-000000000004', now(), now());

-- As pessoas e os processos, gravados direto (sem os gatilhos de cadastro):
--   P1: processo da Ana, com a Bia; P2: processo só da Ana; P3: arquivado, com a Bia; P9: do outro escritório.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('13160000-0000-0000-0000-000000000001', 'e3160000-0000-0000-0000-000000000001', 'C1', 'contato', 'CLIENTE TESTE', 'a3160000-0000-0000-0000-000000000001'),
  ('13160000-0000-0000-0000-000000000002', 'e3160000-0000-0000-0000-000000000001', 'T1', 'contato', 'TESTEMUNHA TESTE', 'a3160000-0000-0000-0000-000000000001'),
  ('13160000-0000-0000-0000-000000000009', 'e3160000-0000-0000-0000-000000000002', 'F1', 'contato', 'PESSOA DE FORA', 'a3160000-0000-0000-0000-000000000004');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, colaboradores, clientes, criado_por, arquivado_em, advogado_contrario) values
  ('73160000-0000-0000-0000-000000000001', 'e3160000-0000-0000-0000-000000000001', 'PR1', 'judicial', '1', 'a3160000-0000-0000-0000-000000000001', '{a3160000-0000-0000-0000-000000000002}', '{13160000-0000-0000-0000-000000000001}', 'a3160000-0000-0000-0000-000000000001', null, 'Advogado contrário de exemplo'),
  ('73160000-0000-0000-0000-000000000002', 'e3160000-0000-0000-0000-000000000001', 'PR2', 'judicial', '2', 'a3160000-0000-0000-0000-000000000001', '{}', '{13160000-0000-0000-0000-000000000001}', 'a3160000-0000-0000-0000-000000000001', null, null),
  ('73160000-0000-0000-0000-000000000003', 'e3160000-0000-0000-0000-000000000001', 'PR3', 'judicial', '3', 'a3160000-0000-0000-0000-000000000001', '{a3160000-0000-0000-0000-000000000002}', '{13160000-0000-0000-0000-000000000001}', 'a3160000-0000-0000-0000-000000000001', now(), null),
  ('73160000-0000-0000-0000-000000000009', 'e3160000-0000-0000-0000-000000000002', 'PR9', 'judicial', '9', 'a3160000-0000-0000-0000-000000000004', '{}', '{13160000-0000-0000-0000-000000000009}', 'a3160000-0000-0000-0000-000000000004', null, null);
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a3160000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '53160000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Quantas linhas um delete apagou (o delete não cabe numa subconsulta). Roda com a permissão de quem chama.
create function pg_temp.apagados(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $f$;
grant execute on function pg_temp.apagados(text) to authenticated;
create function pg_temp.coluna(p_modulo text, p_marco text) returns uuid language sql as $$
  select id from public.quadro_colunas where escritorio_id = 'e3160000-0000-0000-0000-000000000001' and modulo = p_modulo and marco = p_marco
$$;
grant execute on function pg_temp.coluna(text, text) to authenticated;

-- ---------- tipos novos ----------
-- Dado um escritório novo, então ele nasce com os quadros extrajudicial e de investigações, com a coluna do início e a das concluídas.
select is(pg_temp.coluna('processos_extrajudiciais', 'inicio'), (select id from public.quadro_colunas where escritorio_id = 'e3160000-0000-0000-0000-000000000001'
  and modulo = 'processos_extrajudiciais' and nome = 'Aberto'), 'Então o quadro extrajudicial começa em "Aberto"');
select is((select nome from public.quadro_colunas where id = pg_temp.coluna('processos_investigacoes', 'concluido')), 'Arquivado',
  'Então o quadro das investigações termina em "Arquivado"');
select ok((select min(g.ordem) from public.quadro_grupos g where g.escritorio_id = 'e3160000-0000-0000-0000-000000000001' and g.modulo = 'processos_investigacoes')
           > (select max(c.ordem) from public.quadro_colunas c where c.escritorio_id = 'e3160000-0000-0000-0000-000000000001' and c.modulo = 'processos_investigacoes'),
  'Então os grupos ficam depois das colunas, como em todo quadro (#296)');
select is((select count(*) from public.quadro_colunas where escritorio_id = 'e3160000-0000-0000-0000-000000000001' and modulo = 'processos_judiciais' and nome = 'Distribuído'),
  1::bigint, 'Então o quadro judicial continua com uma coluna "Distribuído" só');

select pg_temp.entrar(1); set local role authenticated;
-- Quando a Ana cadastra um processo extrajudicial na coluna do quadro dele, então ele é gravado.
select lives_ok($$ insert into public.processos (id, tipo, numero, responsavel_id, clientes, criado_por, etapa_id) values
  ('73160000-0000-0000-0000-000000000011', 'extrajudicial', 'NOT-1', auth.uid(), '{13160000-0000-0000-0000-000000000001}', auth.uid(),
   pg_temp.coluna('processos_extrajudiciais', 'inicio')) $$, 'Quando cadastra um extrajudicial, então ele é gravado');
select lives_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por) values
  ('investigacao', 'IP 1/2026', auth.uid(), '{13160000-0000-0000-0000-000000000001}', auth.uid()) $$, 'Quando cadastra uma investigação, então ela é gravada');
-- Quando põe a investigação numa coluna do quadro judicial, então é recusado.
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por, etapa_id) values
  ('investigacao', 'IP 2/2026', auth.uid(), '{13160000-0000-0000-0000-000000000001}', auth.uid(), pg_temp.coluna('processos_judiciais', 'inicio')) $$,
  '42501', null, 'Quando põe a investigação no quadro judicial, então é recusado');
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por) values
  ('outro', 'X', auth.uid(), '{13160000-0000-0000-0000-000000000001}', auth.uid()) $$, '23514', null, 'Quando o tipo não é da lista, então é recusado');
-- Então um campo do escritório pode valer só para as investigações.
select lives_ok($$ insert into public.processo_campos (nome, tipo, aparece_em) values ('Delegacia', 'texto', 'investigacao') $$,
  'Então um campo pode aparecer só nas investigações');
reset role;
select is(privado.grupo_do_tipo_de_processo('extrajudicial'), 'extrajudiciais', 'Então a busca pelo código põe o extrajudicial no grupo dele');
select is(privado.grupo_do_tipo_de_processo('investigacao'), 'investigacoes', 'Então a busca pelo código põe a investigação no grupo dela');

-- ---------- recursos e incidentais ----------
select pg_temp.entrar(2); set local role authenticated;
-- Quando a Bia cria um recurso do processo em que está, então ele nasce ligado à origem, com o próprio número.
select lives_ok($$ insert into public.processos (id, tipo, numero, responsavel_id, clientes, criado_por, origem_id, ligacao) values
  ('73160000-0000-0000-0000-000000000021', 'judicial', '1-REC', auth.uid(), '{13160000-0000-0000-0000-000000000001}', auth.uid(),
   '73160000-0000-0000-0000-000000000001', 'recurso') $$, 'Quando cria um recurso, então ele é gravado');
select is((select origem_id from public.processos where id = '73160000-0000-0000-0000-000000000021'), '73160000-0000-0000-0000-000000000001'::uuid,
  'Então o recurso fica ligado ao processo de origem');
-- Quando a origem é um processo que ela não vê, ou de outro escritório, então é recusado.
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por, origem_id, ligacao) values
  ('judicial', '2-INC', auth.uid(), '{13160000-0000-0000-0000-000000000001}', auth.uid(), '73160000-0000-0000-0000-000000000002', 'incidental') $$,
  'P0001', 'O processo de origem não foi encontrado neste escritório.', 'Quando a origem é um processo que não vê, então é recusado');
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por, origem_id, ligacao) values
  ('judicial', '9-INC', auth.uid(), '{13160000-0000-0000-0000-000000000001}', auth.uid(), '73160000-0000-0000-0000-000000000009', 'incidental') $$,
  'P0001', 'O processo de origem não foi encontrado neste escritório.', 'Quando a origem é de outro escritório, então é recusado');
-- Quando falta dizer se é recurso ou incidental, então é recusado.
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por, origem_id) values
  ('judicial', '1-SEM', auth.uid(), '{13160000-0000-0000-0000-000000000001}', auth.uid(), '73160000-0000-0000-0000-000000000001') $$,
  '23514', null, 'Quando falta a ligação, então é recusado');
-- Quando tenta mudar a origem depois de criado, então é recusado (a origem não muda).
select throws_ok($$ update public.processos set origem_id = null where id = '73160000-0000-0000-0000-000000000021' $$, '42501', null,
  'Quando tenta mudar a origem, então é recusado');
-- Então cada um tem os próprios andamentos: o do recurso não aparece no de origem.
select lives_ok($$ insert into public.processo_andamentos (processo_id, tipo, data, texto, criado_por) values
  ('73160000-0000-0000-0000-000000000021', 'andamento', '2026-11-20', 'Recurso distribuído', auth.uid()) $$, 'Quando lança um andamento no recurso, então ele é gravado');
select is((select count(*) from public.processo_andamentos where processo_id = '73160000-0000-0000-0000-000000000001'), 0::bigint,
  'Então o processo de origem continua sem esse andamento');
reset role;

-- ---------- pessoas com papel ----------
select pg_temp.entrar(2); set local role authenticated;
-- Quando a Bia põe a testemunha no processo em que está, então ela fica com o papel.
select lives_ok($$ insert into public.processo_partes (id, processo_id, pessoa_id, papel) values
  ('83160000-0000-0000-0000-000000000001', '73160000-0000-0000-0000-000000000001', '13160000-0000-0000-0000-000000000002', 'testemunha') $$,
  'Quando põe uma pessoa com papel, então ela é gravada');
select is((select papel from public.processo_partes where id = '83160000-0000-0000-0000-000000000001'), 'testemunha', 'Então a pessoa fica com o papel');
-- Então a entrada fica no histórico do processo, com o nome e o papel.
select is((select alteracoes -> 'partes' -> 'para' ->> 'nome' from public.processo_historico where processo_id = '73160000-0000-0000-0000-000000000001'
           and alteracoes ? 'partes' order by em desc limit 1), 'TESTEMUNHA TESTE', 'Então o histórico mostra quem entrou');
-- Quando a mesma pessoa ganha outro papel, então é gravado; o mesmo papel de novo, não.
select lives_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('73160000-0000-0000-0000-000000000001', '13160000-0000-0000-0000-000000000002', 'perito') $$, 'Quando a pessoa ganha outro papel, então é gravado');
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('73160000-0000-0000-0000-000000000001', '13160000-0000-0000-0000-000000000002', 'testemunha') $$, '23505', null, 'Quando repete o papel, então é recusado');
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('73160000-0000-0000-0000-000000000001', '13160000-0000-0000-0000-000000000002', 'juiz') $$, '23514', null, 'Quando o papel não é da lista, então é recusado');
-- Quando a pessoa é de outro escritório, então é recusado.
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('73160000-0000-0000-0000-000000000001', '13160000-0000-0000-0000-000000000009', 'autor') $$, 'P0001', 'Pessoa não encontrada neste escritório.',
  'Quando a pessoa é de outro escritório, então é recusado');
-- Quando o processo está arquivado, ou ela não está nele, então é recusado.
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('73160000-0000-0000-0000-000000000003', '13160000-0000-0000-0000-000000000002', 'autor') $$, '42501', null, 'Quando o processo está arquivado, então é recusado');
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('73160000-0000-0000-0000-000000000002', '13160000-0000-0000-0000-000000000002', 'autor') $$, '42501', null, 'Quando não está no processo, então é recusado');
reset role;

-- Quando o Davi, do outro escritório, lê as pessoas com papel, então não vê nenhuma.
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.processo_partes), 0::bigint, 'Quando o outro escritório lê, então não vê as pessoas com papel');
select is(pg_temp.apagados($$ delete from public.processo_partes $$), 0::bigint, 'Quando o outro escritório tenta tirar, então nada sai');
reset role;

-- Quem está num processo com papel não pode ser excluída.
select throws_ok($$ delete from public.pessoas where id = '13160000-0000-0000-0000-000000000002' $$, '23503', null,
  'Quando exclui a pessoa que tem papel num processo, então é recusado');

-- Quando a Bia tira a pessoa, então ela sai, e a saída fica no histórico.
select pg_temp.entrar(2); set local role authenticated;
select is(pg_temp.apagados($$ delete from public.processo_partes where processo_id = '73160000-0000-0000-0000-000000000001' $$), 2::bigint,
  'Quando tira a pessoa dos dois papéis, então as duas linhas saem');
select is((select count(*) from public.processo_historico where processo_id = '73160000-0000-0000-0000-000000000001'
           and alteracoes -> 'partes' -> 'de' ->> 'nome' = 'TESTEMUNHA TESTE'), 2::bigint, 'Então as saídas ficam no histórico');
reset role;
-- Quando a pessoa é excluída depois, então o nome dela sai do histórico (LGPD).
select lives_ok($$ delete from public.pessoas where id = '13160000-0000-0000-0000-000000000002' $$, 'Quando a pessoa sem papel é excluída, então sai');
select is((select count(*) from public.processo_historico where alteracoes::text like '%TESTEMUNHA TESTE%'), 0::bigint, 'Então o nome dela sai do histórico');
select is((select count(*) from public.processo_historico where alteracoes::text like '%13160000-0000-0000-0000-000000000002%'), 0::bigint, 'Então o id dela também sai');

-- Quando o processo com pessoas de papel é excluído, então tudo sai junto.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('13160000-0000-0000-0000-000000000003', 'e3160000-0000-0000-0000-000000000001', 'T3', 'contato', 'PERITO TESTE', 'a3160000-0000-0000-0000-000000000001');
set local session_replication_role = origin;
insert into public.processo_partes (escritorio_id, processo_id, pessoa_id, papel, criado_por) values
  ('e3160000-0000-0000-0000-000000000001', '73160000-0000-0000-0000-000000000021', '13160000-0000-0000-0000-000000000003', 'perito', 'a3160000-0000-0000-0000-000000000001');
update public.processos set arquivado_em = now() where id = '73160000-0000-0000-0000-000000000021';
select lives_ok($$ delete from public.processos where id = '73160000-0000-0000-0000-000000000021' $$, 'Quando o recurso com pessoas de papel é excluído, então sai');
select is((select count(*) from public.processo_partes where processo_id = '73160000-0000-0000-0000-000000000021'), 0::bigint, 'Então as pessoas com papel dele saem junto');

-- Quando o processo de origem é excluído, então o recurso continua, só sem a ligação.
insert into public.processos (id, escritorio_id, tipo, numero, responsavel_id, clientes, criado_por, origem_id, ligacao) values
  ('73160000-0000-0000-0000-000000000022', 'e3160000-0000-0000-0000-000000000001', 'judicial', '2-INC', 'a3160000-0000-0000-0000-000000000001',
   '{13160000-0000-0000-0000-000000000001}', 'a3160000-0000-0000-0000-000000000001', '73160000-0000-0000-0000-000000000002', 'incidental');
update public.processos set arquivado_em = now() where id = '73160000-0000-0000-0000-000000000002';
delete from public.processos where id = '73160000-0000-0000-0000-000000000002';
select is((select origem_id from public.processos where id = '73160000-0000-0000-0000-000000000022'), null::uuid, 'Então o incidental fica sem a origem');
select is((select ligacao from public.processos where id = '73160000-0000-0000-0000-000000000022'), 'incidental', 'Então ele continua sendo um incidental');

-- ---------- a parte contrária de antes ----------
select is((select advogado_contrario from public.processos where id = '73160000-0000-0000-0000-000000000001'), 'Advogado contrário de exemplo',
  'Dados os processos de antes, então o texto da parte contrária continua lá');

select * from finish();
rollback;
