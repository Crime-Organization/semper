-- Google Meet no compromisso (#437): as permissões do Meet pedidas aos poucos, a opção que põe o compromisso na fila, os
-- convidados e a reunião como o servidor os lê, a reunião guardada, quem a vê e o escritório isolado.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master), Beto (usuário, com outro e-mail do Google) e Caio (usuário, conta reservada), e outro
-- com Fabio (master); o primeiro com a agenda autorizada, sem o Meet, e as agendas ligadas; o segundo só com os contatos.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-reunioes-google'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-reunioes-google-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'fabio@exemplo.test', 'Fabio', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e, jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana@exemplo.test'), (2, 'beto@exemplo.test'), (3, 'caio@exemplo.test'), (4, 'fabio@exemplo.test')) as x(n, e);
insert into auth.sessions (id, user_id, created_at, updated_at)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now() from generate_series(1, 4) n;
update public.perfis set reservada = true where id = 'a0000000-0000-0000-0000-000000000003';
insert into public.emails_do_google (perfil_id, escritorio_id, email) values
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'beto.pessoal@exemplo.test');
insert into privado.ligacoes (escritorio_id, provedor, conta_email, escopos, segredo_id, agendas_ativas)
values ('e0000000-0000-0000-0000-000000000001', 'google', 'contato@exemplo.test',
        '{https://www.googleapis.com/auth/contacts,https://www.googleapis.com/auth/calendar.app.created,https://www.googleapis.com/auth/calendar.acls}',
        vault.create_secret('token-1', 'teste-reunioes-1'), true),
       ('e0000000-0000-0000-0000-000000000002', 'google', 'outro@exemplo.test', '{https://www.googleapis.com/auth/contacts}', vault.create_secret('token-2', 'teste-reunioes-2'), false);

grant usage on schema extensions to authenticated;
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
grant execute on function pg_temp.entrar(int) to authenticated;
create function pg_temp.hoje() returns date language sql as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
create function pg_temp.na_fila(p_item uuid) returns integer language sql as $$
  select versao from public.agendas_google_fila where assunto = 'compromisso' and item_id = p_item
$$;
create function pg_temp.item(p_item uuid) returns jsonb language sql as $$
  select public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'compromisso', p_item)
$$;

-- E os compromissos: um de amanhã da Ana com o Beto e o Caio e uma pessoa com dois e-mails (o primeiro vale); um sem a opção;
-- e, no outro escritório, um compromisso do Fabio.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, emails, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE', '{" Cliente@Exemplo.test ",segundo@exemplo.test}',
   'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'contato', 'SEM EMAIL', '{}', 'a0000000-0000-0000-0000-000000000001');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, participantes, pessoas, pessoa_nome, criado_por) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'C1', 'reuniao', 'Reunião com o cliente', pg_temp.hoje() + 1, '14:00',
   'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002,a0000000-0000-0000-0000-000000000003}',
   '{10000000-0000-0000-0000-000000000001,10000000-0000-0000-0000-000000000002}', 'CLIENTE; SEM EMAIL', 'a0000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'C2', 'reuniao', 'Sem Meet', pg_temp.hoje() + 2, '10:00',
   'a0000000-0000-0000-0000-000000000001', '{}', '{}', '', 'a0000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'C9', 'reuniao', 'Do outro escritório', pg_temp.hoje() + 1, '10:00',
   'a0000000-0000-0000-0000-000000000004', '{}', '{}', '', 'a0000000-0000-0000-0000-000000000004');
set local session_replication_role = origin;

-- ---------------------------------------------------------------------
-- A opção começa desmarcada e o Meet, sem autorizar
-- ---------------------------------------------------------------------
select is((select reuniao_google from public.compromissos where id = '72000000-0000-0000-0000-000000000002'), false,
  'dado um compromisso gravado sem dizer nada (como a versão anterior do site), então ele fica sem reunião');
select pg_temp.entrar(2); set local role authenticated;
select results_eq($$select autorizado, disponivel from public.reunioes_google_situacao()$$, $$values (false, false)$$,
  'dada a conta só com a agenda, então qualquer um da equipe lê que o Meet não está autorizado nem disponível');
select throws_ok($$select public.ligacao_google_iniciar_meet('http://localhost:8091/configuracoes/')$$, 'P0001',
  'Apenas administradores autorizam o Google Meet na conta Google do escritório', 'quando Beto (usuário) pede para autorizar o Meet, então é recusado');
reset role;
delete from privado.ligacoes where escritorio_id = 'e0000000-0000-0000-0000-000000000002';
select pg_temp.entrar(4); set local role authenticated;
select throws_ok($$select public.ligacao_google_iniciar_meet('http://localhost:8091/configuracoes/')$$, 'P0001',
  'Ligue a conta Google do escritório antes de autorizar o Google Meet',
  'dado o outro escritório sem conta ligada, quando Fabio pede o Meet, então é recusado (a ligação do primeiro escritório não conta)');
select is((select count(*)::int from public.reunioes_google_situacao()), 0, 'e a situação do Meet vem vazia para ele');
reset role;

-- ---------------------------------------------------------------------
-- Autorizar o Meet aos poucos
-- ---------------------------------------------------------------------
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$select public.ligacao_google_iniciar_meet('http://localhost:8091/configuracoes/')$$, 'quando Ana pede para autorizar o Meet, então o pedido é criado');
reset role;
select is((select finalidade from privado.ligacao_pedidos where pedido_por = 'a0000000-0000-0000-0000-000000000001'), 'meet', 'e o pedido tem a finalidade do Meet');
select is((select conta_email from public.ligacao_pedido_conferir_finalidade((select estado from privado.ligacao_pedidos where pedido_por = 'a0000000-0000-0000-0000-000000000001'))),
  'contato@exemplo.test', 'e a ida ao Google leva a conta ligada (o Google já abre nela)');
select is((select finalidade || ' ' || conta_email from public.ligacao_pedido_consumir((select estado from privado.ligacao_pedidos where pedido_por = 'a0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001', 'aal1')), 'meet contato@exemplo.test', 'e a conclusão devolve a finalidade e a conta ligada');

-- ---------------------------------------------------------------------
-- A opção põe o compromisso na fila
-- ---------------------------------------------------------------------
delete from public.agendas_google_fila;
select pg_temp.entrar(1); set local role authenticated;
update public.compromissos set reuniao_google = true where id = '72000000-0000-0000-0000-000000000001';
reset role;
select isnt(pg_temp.na_fila('72000000-0000-0000-0000-000000000001'), null, 'quando Ana marca "Criar link do Google Meet", então o compromisso entra na fila');
select pg_temp.entrar(1); set local role authenticated;
update public.compromissos set observacoes = 'nada que vá ao Google' where id = '72000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.na_fila('72000000-0000-0000-0000-000000000001'), 1, 'e mudar só as observações não o põe de novo');

-- ---------------------------------------------------------------------
-- Como o servidor lê o compromisso
-- ---------------------------------------------------------------------
select is(pg_temp.item('72000000-0000-0000-0000-000000000001') -> 'item' -> 'convidados',
  '["ana@exemplo.test", "beto.pessoal@exemplo.test", "cliente@exemplo.test"]'::jsonb,
  'então os convidados são a equipe pelo e-mail do Google (o informado do Beto; o Caio, de conta reservada, não) e o primeiro e-mail da pessoa ligada');
select is(pg_temp.item('72000000-0000-0000-0000-000000000001') -> 'item' ->> 'reuniao', 'true', 'e o item diz que a reunião é para criar');
select is(pg_temp.item('72000000-0000-0000-0000-000000000002') -> 'item' -> 'convidados', '[]'::jsonb, 'e o compromisso sem a opção não tem convidados');
select is(pg_temp.item('72000000-0000-0000-0000-000000000001') ->> 'meet', 'false', 'e, sem as permissões do Meet, o item diz que não há Meet');
select is(pg_temp.item('72000000-0000-0000-0000-000000000001') -> 'reuniao', 'null'::jsonb, 'e ainda não há reunião criada');

-- Ao autorizar o Meet, os compromissos com a opção marcada voltam à fila.
delete from public.agendas_google_fila;
update privado.ligacoes set escopos = escopos || '{https://www.googleapis.com/auth/calendar.events.owned,https://www.googleapis.com/auth/meetings.space.settings}'
where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select isnt(pg_temp.na_fila('72000000-0000-0000-0000-000000000001'), null, 'quando a conta ganha as permissões do Meet, então o compromisso com a opção volta à fila');
select is(pg_temp.na_fila('72000000-0000-0000-0000-000000000002'), null, 'e o sem a opção, não');
select is(pg_temp.item('72000000-0000-0000-0000-000000000001') ->> 'meet', 'true', 'e o item diz que há Meet');
select pg_temp.entrar(2); set local role authenticated;
select results_eq($$select autorizado, disponivel from public.reunioes_google_situacao()$$, $$values (true, true)$$,
  'e qualquer um da equipe lê que o Meet está autorizado e disponível (as agendas estão ligadas)');
reset role;

-- ---------------------------------------------------------------------
-- A reunião guardada pelo servidor
-- ---------------------------------------------------------------------
select lives_ok($$select public.agendas_google_reuniao_gravada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Contato@Exemplo.test',
  'r72000000000000000000000000000001', 'https://meet.google.com/abc-mnop-xyz', null, null, null, 'a1b2')$$, 'quando o servidor guarda a reunião criada, então o banco aceita');
select is(pg_temp.item('72000000-0000-0000-0000-000000000001') -> 'reuniao',
  '{"evento_id": "r72000000000000000000000000000001", "link": "https://meet.google.com/abc-mnop-xyz", "espaco": null, "gravacao": null, "gravacao_detalhe": null, "assinatura": "a1b2"}'::jsonb,
  'então o item traz a reunião guardada');
select is(pg_temp.item('72000000-0000-0000-0000-000000000001') -> 'item' ->> 'reuniao_link', 'https://meet.google.com/abc-mnop-xyz',
  'e o link, para as cópias das agendas o levarem');
select lives_ok($$select public.agendas_google_reuniao_gravada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'contato@exemplo.test',
  'r72000000000000000000000000000001', 'https://meet.google.com/abc-mnop-xyz', 'spaces/xyz', 'recusada', '403 PERMISSION_DENIED', 'a1b2')$$,
  'quando o servidor guarda que o Google recusou a gravação, então o banco aceita');
select is((select gravacao || ' ' || gravacao_detalhe from public.agenda_google_reunioes), 'recusada 403 PERMISSION_DENIED', 'e a recusa fica guardada, na mesma reunião');
select throws_ok($$select public.agendas_google_reuniao_gravada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000009', 'contato@exemplo.test',
  'r72000000000000000000000000000009', null, null, null, null, null)$$, 'P0001', 'Compromisso de outro escritório',
  'e guardar a reunião de um compromisso de outro escritório é recusado');
select throws_ok($$select public.agendas_google_reuniao_gravada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002', 'contato@exemplo.test',
  'R-errado', null, null, null, null, null)$$, '23514', null, 'e um id de evento que o Google não aceita é recusado');

-- Quem vê a reunião: quem vê o compromisso.
select pg_temp.entrar(2); set local role authenticated;
select is((select link from public.agenda_google_reunioes), 'https://meet.google.com/abc-mnop-xyz', 'dado Beto participante, então ele vê o link da reunião');
select throws_ok($$insert into public.agenda_google_reunioes (escritorio_id, compromisso_id, conta_email, evento_id)
  values ('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002', 'x@exemplo.test', 'aaaaa')$$, '42501', null,
  'e ninguém grava a reunião pelo navegador');
select throws_ok($$select public.agendas_google_reuniao_cancelada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001')$$, '42501', null,
  'nem a cancela pelo navegador');
select throws_ok($$select public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'compromisso', '72000000-0000-0000-0000-000000000001')$$, '42501', null,
  'nem lê o item como o servidor (com os e-mails dos convidados)');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*)::int from public.agenda_google_reunioes), 0, 'dado Fabio, de outro escritório, então ele não vê a reunião');
reset role;

-- Outra conta ligada: a reunião da conta antiga fica de fora (o servidor cria outra na conta nova).
update privado.ligacoes set conta_email = 'nova@exemplo.test' where escritorio_id = 'e0000000-0000-0000-0000-000000000001';
select is(pg_temp.item('72000000-0000-0000-0000-000000000001') -> 'reuniao', 'null'::jsonb, 'quando o escritório liga outra conta, então a reunião da conta antiga não vem no item');
select is(pg_temp.item('72000000-0000-0000-0000-000000000001') -> 'item' -> 'reuniao_link', 'null'::jsonb, 'nem o link dela');
update privado.ligacoes set conta_email = 'contato@exemplo.test' where escritorio_id = 'e0000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------
-- Excluir: a reunião é cancelada
-- ---------------------------------------------------------------------
delete from public.agendas_google_fila;
set local session_replication_role = replica;
update public.compromissos set arquivado_em = now() where id = '72000000-0000-0000-0000-000000000001';
set local session_replication_role = origin;
delete from public.compromissos where id = '72000000-0000-0000-0000-000000000001';
select isnt(pg_temp.na_fila('72000000-0000-0000-0000-000000000001'), null,
  'dado um compromisso com reunião no Google, quando ele é excluído, então entra na fila (para a reunião ser cancelada)');
select is(pg_temp.item('72000000-0000-0000-0000-000000000001') -> 'item', 'null'::jsonb, 'e o item vem vazio');
select isnt(pg_temp.item('72000000-0000-0000-0000-000000000001') -> 'reuniao', 'null'::jsonb, 'mas a reunião continua lembrada, até ser cancelada');
select lives_ok($$select public.agendas_google_reuniao_cancelada('e0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001')$$,
  'quando o servidor a cancela no Google, então o banco aceita');
select is((select count(*)::int from public.agenda_google_reunioes), 0, 'e a reunião é esquecida');

select * from finish();
rollback;
