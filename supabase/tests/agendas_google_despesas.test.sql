-- Agendas do escritório no Google Agenda (#166): as despesas do escritório a pagar (#439) na agenda Administrativo. Os
-- gatilhos que põem a despesa na fila, as despesas a pagar ao ligar e ao nascer a Administrativo, os dias sem expediente
-- que mudam o dia útil anterior e a despesa como o servidor a lê (só do próprio escritório).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Beto (usuário), com a agenda autorizada e as agendas ainda desligadas, e outro
-- escritório com Fabio (master), também com as agendas autorizadas.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-despesas-google', '{"financeiro": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-despesas-google-2', '{"financeiro": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'fabio@exemplo.test', 'Fabio', 'master', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e, jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana@exemplo.test'), (2, 'beto@exemplo.test'), (3, 'fabio@exemplo.test')) as x(n, e);
insert into auth.sessions (id, user_id, created_at, updated_at)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now() from generate_series(1, 3) n;
insert into privado.ligacoes (escritorio_id, provedor, conta_email, escopos, segredo_id)
select ('e0000000-0000-0000-0000-00000000000' || n)::uuid, 'google', 'conta' || n || '@exemplo.test',
       '{https://www.googleapis.com/auth/contacts,https://www.googleapis.com/auth/calendar.app.created,https://www.googleapis.com/auth/calendar.acls}',
       vault.create_secret('token-' || n, 'teste-despesas-google-' || n)
from generate_series(1, 2) n;

grant usage on schema extensions to authenticated;
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
grant execute on function pg_temp.entrar(int) to authenticated;
create function pg_temp.hoje() returns date language sql as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
-- A versão do pedido da despesa na fila (null: não está na fila).
create function pg_temp.na_fila(p_item uuid) returns integer language sql as $$
  select versao from public.agendas_google_fila where assunto = 'despesa' and item_id = p_item
$$;
-- As despesas na fila, em ordem.
create function pg_temp.despesas_na_fila() returns uuid[] language sql as $$
  select coalesce(array_agg(item_id order by item_id), '{}') from public.agendas_google_fila where assunto = 'despesa'
$$;

-- E as despesas, gravadas direto (sem os gatilhos): uma a vencer daqui a 10 dias; uma vencida e não paga; uma paga e uma
-- excluída, a vencer; uma que vence na segunda 07/01/2030 (a sexta antes é 04/01) e uma na quarta 09/01/2030; e uma do
-- outro escritório. E um órgão, para um dia lançado só para ele.
set local session_replication_role = replica;
insert into public.financeiro_despesas (id, escritorio_id, descricao, valor, vencimento, paga_em, excluida_em) values
  ('e9000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Conta de luz', 25000, pg_temp.hoje() + 10, null, null),
  ('e9000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Internet', 15000, pg_temp.hoje() - 10, null, null),
  ('e9000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Aluguel', 300000, pg_temp.hoje() + 20, pg_temp.hoje(), null),
  ('e9000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'Água', 8000, pg_temp.hoje() + 20, null, now()),
  ('e9000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'DAS', 120000, date '2030-01-07', null, null),
  ('e9000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'Contador', 50000, date '2030-01-09', null, null),
  ('e9000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'Despesa do outro', 1000, pg_temp.hoje() + 10, null, null);
insert into public.orgaos (id, escritorio_id, sigla) values ('0a000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'TJ');
set local session_replication_role = origin;

-- ---------------------------------------------------------------------
-- Desligadas, nada entra na fila
-- ---------------------------------------------------------------------
update public.financeiro_despesas set valor = 26000 where id = 'e9000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('e9000000-0000-0000-0000-000000000001'), null, 'dadas as agendas desligadas, quando uma despesa muda, então nada entra na fila');

-- ---------------------------------------------------------------------
-- Ligar: as despesas a pagar de hoje em diante
-- ---------------------------------------------------------------------
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$select public.agendas_google_ligar(true)$$, 'quando Ana liga as agendas, então o banco aceita');
reset role;
select is(pg_temp.despesas_na_fila(),
  array['e9000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000005', 'e9000000-0000-0000-0000-000000000006']::uuid[],
  'e entram na fila as despesas a pagar de hoje em diante: não a vencida, a paga, a excluída nem a do outro escritório');

-- ---------------------------------------------------------------------
-- A Administrativo que nasce recebe as despesas; as outras agendas, não
-- ---------------------------------------------------------------------
delete from public.agendas_google_fila;
select public.agendas_google_agenda_criada('e0000000-0000-0000-0000-000000000001', 'conta1@exemplo.test', 'geral', null, null, 'geral@google', 'Geral');
select is(pg_temp.despesas_na_fila(), '{}'::uuid[], 'quando a Geral nasce, então nenhuma despesa entra na fila');
select public.agendas_google_agenda_criada('e0000000-0000-0000-0000-000000000001', 'conta1@exemplo.test', 'administrativo', null, null, 'adm@google', 'Administrativo');
select is(pg_temp.despesas_na_fila(),
  array['e9000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000005', 'e9000000-0000-0000-0000-000000000006']::uuid[],
  'quando a Administrativo nasce, então entram as despesas a pagar de hoje em diante');

-- ---------------------------------------------------------------------
-- Os gatilhos da despesa
-- ---------------------------------------------------------------------
delete from public.agendas_google_fila;
select pg_temp.entrar(1);
select public.financeiro_despesa_mudar('e9000000-0000-0000-0000-000000000001', 'Conta de luz', 27000, pg_temp.hoje() + 10);
select is(pg_temp.na_fila('e9000000-0000-0000-0000-000000000001'), 1, 'quando o valor da despesa muda, então ela entra na fila');
select public.financeiro_despesa_mudar('e9000000-0000-0000-0000-000000000001', 'Conta de luz', 27000, pg_temp.hoje() + 10);
select is(pg_temp.na_fila('e9000000-0000-0000-0000-000000000001'), 1, 'quando nada muda de verdade, então o pedido fica como estava');
select public.financeiro_despesa_pagar('e9000000-0000-0000-0000-000000000001', pg_temp.hoje());
select is(pg_temp.na_fila('e9000000-0000-0000-0000-000000000001'), 2, 'quando a despesa é paga, então ela vai de novo (para sair da Administrativo)');
select public.financeiro_despesa_desfazer_pagamento('e9000000-0000-0000-0000-000000000001');
select is(pg_temp.na_fila('e9000000-0000-0000-0000-000000000001'), 3, 'quando o pagamento é desfeito, então ela vai de novo (volta à Administrativo)');
select public.financeiro_despesa_excluir('e9000000-0000-0000-0000-000000000001');
select is(pg_temp.na_fila('e9000000-0000-0000-0000-000000000001'), 4, 'quando a despesa é excluída, então ela vai de novo (para sair)');
select public.financeiro_despesa_restaurar(array['e9000000-0000-0000-0000-000000000001'::uuid]);
select is(pg_temp.na_fila('e9000000-0000-0000-0000-000000000001'), 5, 'quando a despesa é restaurada, então ela vai de novo');
create temp table criada (id uuid);
insert into criada select (public.financeiro_despesa_criar('Faxina', 40000, pg_temp.hoje() + 5, 'mes', 1, null, 3) -> 'ids' ->> 0)::uuid;
select is(pg_temp.na_fila((select id from criada)), 1, 'quando uma despesa que se repete é criada, então as datas que nascem sozinhas também entram na fila');

-- ---------------------------------------------------------------------
-- Os dias sem expediente que mudam o dia útil anterior
-- ---------------------------------------------------------------------
delete from public.agendas_google_fila;
insert into public.dias_sem_expediente (id, escritorio_id, data, motivo, tipo, orgao_id) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', date '2030-01-04', 'Feriado só do TJ', 'feriado', '0a000000-0000-0000-0000-000000000001');
select is(pg_temp.despesas_na_fila(), '{}'::uuid[], 'quando um feriado é lançado só para um órgão, então nenhuma despesa vai de novo (o dia continua útil)');
insert into public.dias_sem_expediente (id, escritorio_id, data, motivo, tipo) values
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', date '2030-01-04', 'Suspensão de prazos', 'suspensao_com_expediente');
select is(pg_temp.despesas_na_fila(), '{}'::uuid[], 'quando uma suspensão com expediente é lançada, então nenhuma despesa vai de novo');
delete from public.dias_sem_expediente where id = 'f0000000-0000-0000-0000-000000000002';
insert into public.dias_sem_expediente (id, escritorio_id, data, motivo, tipo) values
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', date '2030-01-04', 'Feriado municipal', 'feriado');
select is(pg_temp.despesas_na_fila(), array['e9000000-0000-0000-0000-000000000005']::uuid[],
  'quando a sexta é lançada como feriado para todos os órgãos, então vai de novo a despesa da segunda seguinte (não a da quarta)');
select is((public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'despesa', 'e9000000-0000-0000-0000-000000000005') -> 'item' -> 'dias_sem_expediente'),
  '[{"data": "2030-01-04", "tipo": "feriado", "orgao_id": null}, {"data": "2030-01-04", "tipo": "feriado", "orgao_id": "0a000000-0000-0000-0000-000000000001"}]'::jsonb,
  'e a despesa vem com os dias lançados antes do vencimento, para o servidor achar o dia útil anterior');
delete from public.agendas_google_fila;
update public.dias_sem_expediente set data = date '2030-01-08' where id = 'f0000000-0000-0000-0000-000000000003';
select is(pg_temp.despesas_na_fila(), array['e9000000-0000-0000-0000-000000000005', 'e9000000-0000-0000-0000-000000000006']::uuid[],
  'quando o feriado muda de dia, então vão as despesas perto do dia antigo e as perto do novo');
delete from public.agendas_google_fila;
delete from public.dias_sem_expediente where id = 'f0000000-0000-0000-0000-000000000003';
select is(pg_temp.despesas_na_fila(), array['e9000000-0000-0000-0000-000000000006']::uuid[], 'quando o feriado é apagado, então vai de novo a despesa perto dele');

-- ---------------------------------------------------------------------
-- A despesa como o servidor a lê
-- ---------------------------------------------------------------------
select is((public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'despesa', 'e9000000-0000-0000-0000-000000000006') -> 'item') - 'dias_sem_expediente',
  '{"id": "e9000000-0000-0000-0000-000000000006", "descricao": "Contador", "valor": 50000, "vencimento": "2030-01-09", "paga": false, "excluida": false}'::jsonb,
  'dada a despesa, então vem com a descrição, o valor, o vencimento e a situação');
select is((public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'despesa', 'e9000000-0000-0000-0000-000000000009') -> 'item'), 'null'::jsonb,
  'dada a despesa de outro escritório, então o servidor não a lê pelo escritório errado');
select is((select array_agg(a ->> 'tipo' order by a ->> 'tipo')
           from jsonb_array_elements(public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'despesa', 'e9000000-0000-0000-0000-000000000001') -> 'agendas') a),
  array['administrativo', 'geral'], 'e vem com as agendas da conta ligada');

-- A cópia gravada na Administrativo é lembrada, e ligar de novo a põe na fila mesmo paga.
select public.agendas_google_evento_gravado((select id from public.agendas_google where tipo = 'administrativo'), 'despesa',
  'e9000000-0000-0000-0000-000000000003', 'ee9000000000000000000000000000003', 'x');
select is((select count(*)::int from public.agenda_google_eventos where assunto = 'despesa'), 1, 'quando a cópia da despesa é gravada, então ela é lembrada');
select public.agendas_google_ligar(false) from (select pg_temp.entrar(1)) x;
select public.agendas_google_ligar(true) from (select pg_temp.entrar(1)) x;
select ok(pg_temp.na_fila('e9000000-0000-0000-0000-000000000003') is not null,
  'quando as agendas são ligadas de novo, então a despesa paga que tem cópia no Google vai à fila (para sair de lá)');

-- Um feriado lançado no passado: a despesa vencida que nunca foi ao Google fica de fora (o passado não vai); a que já
-- tem cópia na Administrativo vai de novo (para o Google ficar em dia).
delete from public.agendas_google_fila;
insert into public.dias_sem_expediente (id, escritorio_id, data, motivo, tipo) values
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', pg_temp.hoje() - 11, 'Feriado passado', 'feriado');
select is(pg_temp.despesas_na_fila(), '{}'::uuid[],
  'dada a despesa vencida e sem cópia no Google, quando um feriado é lançado no dia antes dela, então ela não vai à fila');
select public.agendas_google_evento_gravado((select id from public.agendas_google where tipo = 'administrativo'), 'despesa',
  'e9000000-0000-0000-0000-000000000002', 'ee9000000000000000000000000000002', 'x');
delete from public.dias_sem_expediente where id = 'f0000000-0000-0000-0000-000000000004';
select is(pg_temp.despesas_na_fila(), array['e9000000-0000-0000-0000-000000000002']::uuid[],
  'dada a despesa vencida com cópia na Administrativo, quando o feriado antes dela é apagado, então ela vai de novo');

-- ---------------------------------------------------------------------
-- Escritório isolado e quem chama
-- ---------------------------------------------------------------------
delete from public.agendas_google_fila;
select pg_temp.entrar(3); set local role authenticated;
select lives_ok($$select public.agendas_google_ligar(true)$$, 'quando Fabio liga as agendas do escritório dele, então o banco aceita');
reset role;
select is((select array_agg(distinct escritorio_id) from public.agendas_google_fila where assunto = 'despesa'), array['e0000000-0000-0000-0000-000000000002']::uuid[],
  'e só as despesas do escritório dele entram na fila');
select pg_temp.entrar(1); set local role authenticated;
select throws_ok($$select public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'despesa', 'e9000000-0000-0000-0000-000000000005')$$, '42501', null,
  'quando alguém logado tenta ler a despesa como o servidor, então o banco recusa');
select throws_ok($$select privado.agenda_da_despesa('e0000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000005')$$, '42501', null,
  'e também recusa a função de dentro');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*)::int from public.agenda_google_eventos), 0, 'dado Beto (não administrador), então ele não vê as cópias das despesas');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is((select count(*)::int from public.agenda_google_eventos), 0, 'dado Fabio, do outro escritório, então ele não vê as cópias deste');
reset role;

select * from finish();
rollback;
