-- Propriedade intelectual: tipo de proteção, campos de cada tipo e papéis de titular, inventor e autor (#317). Roda num banco local:
-- supabase db start && supabase test db. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo é desfeito no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug) values
  ('e3170000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-317'),
  ('e3170000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-317-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e3170000-0000-0000-0000-000000000001', 'ana-317@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c3171'), now()),
  ('e3170000-0000-0000-0000-000000000001', 'bia-317@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c3172'), now()),
  ('e3170000-0000-0000-0000-000000000002', 'davi-317@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c3174'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a3170000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana-317@exemplo.test', '{"convite":"c3171"}', now(), now()),
  ('a3170000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia-317@exemplo.test', '{"convite":"c3172"}', now(), now()),
  ('a3170000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi-317@exemplo.test', '{"convite":"c3174"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('53170000-0000-0000-0000-000000000001', 'a3170000-0000-0000-0000-000000000001', now(), now()),
  ('53170000-0000-0000-0000-000000000002', 'a3170000-0000-0000-0000-000000000002', now(), now()),
  ('53170000-0000-0000-0000-000000000004', 'a3170000-0000-0000-0000-000000000004', now(), now());

-- As pessoas e os processos, gravados direto (sem os gatilhos de cadastro):
--   P1: processo administrativo de PI da Ana, com a Bia; P2: processo só da Ana.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('13170000-0000-0000-0000-000000000001', 'e3170000-0000-0000-0000-000000000001', 'C1', 'contato', 'TITULAR TESTE', 'a3170000-0000-0000-0000-000000000001'),
  ('13170000-0000-0000-0000-000000000002', 'e3170000-0000-0000-0000-000000000001', 'I1', 'contato', 'INVENTOR TESTE', 'a3170000-0000-0000-0000-000000000001');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, area, responsavel_id, colaboradores, clientes, criado_por) values
  ('73170000-0000-0000-0000-000000000001', 'e3170000-0000-0000-0000-000000000001', 'PI1', 'administrativo', '900000001', 'Propriedade intelectual',
   'a3170000-0000-0000-0000-000000000001', '{a3170000-0000-0000-0000-000000000002}', '{13170000-0000-0000-0000-000000000001}', 'a3170000-0000-0000-0000-000000000001'),
  ('73170000-0000-0000-0000-000000000002', 'e3170000-0000-0000-0000-000000000001', 'PI2', 'administrativo', '900000002', 'Propriedade intelectual',
   'a3170000-0000-0000-0000-000000000001', '{}', '{13170000-0000-0000-0000-000000000001}', 'a3170000-0000-0000-0000-000000000001');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a3170000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '53170000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Quantas linhas um update mudou (o update não cabe numa subconsulta). Roda com a permissão de quem chama.
create function pg_temp.mudados(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $f$;
grant execute on function pg_temp.mudados(text) to authenticated;

-- Dados os processos de antes, então os campos novos nascem vazios (a versão anterior do site não os conhece).
select is((select protecao from public.processos where id = '73170000-0000-0000-0000-000000000002'), null, 'Então o tipo de proteção nasce vazio');
select is((select classes_nice from public.processos where id = '73170000-0000-0000-0000-000000000002'), '{}'::smallint[], 'Então as classes de Nice nascem vazias');

-- ---------- tipo de proteção e campos de cada tipo ----------
select pg_temp.entrar(2); set local role authenticated;
-- Quando a Bia (colaboradora) diz que o P1 é uma marca, com as datas, as classes e a especificação, então é gravado.
select is(pg_temp.mudados($$ update public.processos set protecao = 'marca', deposito = '2020-03-10', concessao = '2022-05-17',
  apresentacao_marca = 'mista', natureza_marca = 'servico', classes_nice = '{35,45}', especificacao = 'Serviços jurídicos'
  where id = '73170000-0000-0000-0000-000000000001' $$), 1::bigint, 'Quando quem altera o processo preenche a marca, então é gravado');
select is((select classes_nice from public.processos where id = '73170000-0000-0000-0000-000000000001'), '{35,45}'::smallint[], 'Então as classes ficam gravadas');
-- Então o histórico do processo registra o tipo de proteção.
select is((select alteracoes -> 'protecao' ->> 'para' from public.processo_historico where processo_id = '73170000-0000-0000-0000-000000000001'
           and alteracoes ? 'protecao' order by em desc limit 1), 'marca', 'Então o histórico mostra o tipo de proteção');
-- Quando o tipo, a apresentação ou a natureza não são da lista, então é recusado.
select throws_ok($$ update public.processos set protecao = 'segredo_industrial' where id = '73170000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando o tipo de proteção não é da lista, então é recusado');
select throws_ok($$ update public.processos set apresentacao_marca = 'sonora' where id = '73170000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando a apresentação não é da lista, então é recusado');
select throws_ok($$ update public.processos set natureza_marca = 'outra' where id = '73170000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando a natureza não é da lista, então é recusado');
-- Quando uma classe passa de 45 ou é zero, então é recusado.
select throws_ok($$ update public.processos set classes_nice = '{9,46}' where id = '73170000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando uma classe passa de 45, então é recusado');
select throws_ok($$ update public.processos set classes_nice = '{0}' where id = '73170000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando uma classe é zero, então é recusado');
-- Quando a concessão vem antes do depósito, então é recusado.
select throws_ok($$ update public.processos set concessao = '2019-01-01' where id = '73170000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando a concessão vem antes do depósito, então é recusado');
-- Quando o desenho tem mais de 20 variações, então é recusado; com 20, é gravado.
select throws_ok($$ update public.processos set protecao = 'desenho_industrial', variacoes = 21 where id = '73170000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando o desenho tem mais de 20 variações, então é recusado');
select is(pg_temp.mudados($$ update public.processos set protecao = 'desenho_industrial', variacoes = 20 where id = '73170000-0000-0000-0000-000000000001' $$),
  1::bigint, 'Quando o desenho tem 20 variações, então é gravado');
-- Quando a especificação ou a linguagem passam do tamanho, então é recusado.
select throws_ok($$ update public.processos set especificacao = repeat('a', 2001) where id = '73170000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando a especificação passa do tamanho, então é recusado');
select throws_ok($$ update public.processos set linguagem = repeat('a', 121) where id = '73170000-0000-0000-0000-000000000001' $$, '23514', null,
  'Quando a linguagem passa do tamanho, então é recusado');
-- Quando a Bia tenta mudar o P2, de que não participa, então nada muda.
select is(pg_temp.mudados($$ update public.processos set protecao = 'marca' where id = '73170000-0000-0000-0000-000000000002' $$), 0::bigint,
  'Quando quem não está no processo muda o tipo de proteção, então nada muda');
reset role;
select is((select protecao from public.processos where id = '73170000-0000-0000-0000-000000000002'), null, 'Então o P2 continua sem tipo de proteção');

-- Quando o Davi, do outro escritório, tenta ler ou mudar o P1, então não vê nem muda nada.
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.processos where id = '73170000-0000-0000-0000-000000000001'), 0::bigint, 'Quando o outro escritório lê, então não vê o processo');
select is(pg_temp.mudados($$ update public.processos set protecao = 'programa_computador' where id = '73170000-0000-0000-0000-000000000001' $$), 0::bigint,
  'Quando o outro escritório muda o tipo de proteção, então nada muda');
reset role;
select is((select protecao from public.processos where id = '73170000-0000-0000-0000-000000000001'), 'desenho_industrial', 'Então o P1 continua desenho industrial');

-- ---------- titular, inventor e autor da criação ----------
select pg_temp.entrar(2); set local role authenticated;
-- Quando a Bia põe o titular, o inventor e o autor da criação no P1, então cada um fica com o papel.
select lives_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('73170000-0000-0000-0000-000000000001', '13170000-0000-0000-0000-000000000001', 'titular'),
  ('73170000-0000-0000-0000-000000000001', '13170000-0000-0000-0000-000000000002', 'inventor'),
  ('73170000-0000-0000-0000-000000000001', '13170000-0000-0000-0000-000000000002', 'autor_da_criacao') $$,
  'Quando põe titular, inventor e autor da criação, então são gravados');
select is((select array_agg(papel order by papel) from public.processo_partes where processo_id = '73170000-0000-0000-0000-000000000001'),
  array['autor_da_criacao', 'inventor', 'titular'], 'Então os três papéis ficam no processo');
-- Então os papéis de antes continuam valendo, e o que não é da lista continua recusado.
select lives_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('73170000-0000-0000-0000-000000000001', '13170000-0000-0000-0000-000000000002', 'testemunha') $$, 'Então os papéis de antes continuam valendo');
select throws_ok($$ insert into public.processo_partes (processo_id, pessoa_id, papel) values
  ('73170000-0000-0000-0000-000000000001', '13170000-0000-0000-0000-000000000002', 'cessionario') $$, '23514', null,
  'Quando o papel não é da lista, então é recusado');
reset role;

select * from finish();
rollback;
