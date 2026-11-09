-- Avisos de prazo na caixa de mensagens e por e-mail, e resumo de sexta-feira (#113).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

-- Dado um escritório com Ana (administradora), Bia e Caio, e um outro escritório, de Davi, com as demandas desligadas.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-avisos', '{"pessoas": true, "processos": true, "demandas": true, "tarefas": true, "compromissos": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-avisos-2', '{"pessoas": true, "demandas": false, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now());
update public.perfis set ativo = false where id = 'a0000000-0000-0000-0000-000000000003';

-- 15/01/2030 é uma terça-feira; a sexta-feira da semana é 18/01. Os cartões entram sem passar pelos gatilhos, com as datas exatas.
set local session_replication_role = replica;
insert into public.quadro_colunas (id, escritorio_id, modulo, nome, ordem, marco) values
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'tarefas', 'Fim', 1, 'concluido');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, prazo, etapa_id, arquivado_em) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Vence hoje', 'a0000000-0000-0000-0000-000000000002', '2030-01-15', null, null),
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'T2', 'Em tres dias', 'a0000000-0000-0000-0000-000000000002', '2030-01-18', null, null),
  ('70000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'T3', 'Em quatro dias', 'a0000000-0000-0000-0000-000000000002', '2030-01-19', null, null),
  ('70000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'T4', 'Venceu ontem', 'a0000000-0000-0000-0000-000000000002', '2030-01-14', null, null),
  ('70000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'T5', 'Concluida', 'a0000000-0000-0000-0000-000000000002', '2030-01-15', 'b0000000-0000-0000-0000-000000000001', null),
  ('70000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'T6', 'Arquivada', 'a0000000-0000-0000-0000-000000000002', '2030-01-15', null, now()),
  ('70000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'T7', 'De quem saiu', 'a0000000-0000-0000-0000-000000000003', '2030-01-15', null, null),
  ('70000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000002', 'T8', 'Do outro escritorio', 'a0000000-0000-0000-0000-000000000004', '2030-01-15', null, null),
  ('70000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', 'T9', 'Prazo: Contestar', 'a0000000-0000-0000-0000-000000000001', '2030-01-17', null, null),
  ('70000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000001', 'TA', 'Prazo: Contestar, com outra pessoa', 'a0000000-0000-0000-0000-000000000002', '2030-01-17', null, null),
  ('70000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-000000000001', 'TB', 'Prazo de processo arquivado', 'a0000000-0000-0000-0000-000000000001', '2030-01-17', null, null);
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, prazo) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda amanha', 'a0000000-0000-0000-0000-000000000002', '2030-01-16'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'D2', 'Modulo desligado', 'a0000000-0000-0000-0000-000000000004', '2030-01-15');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, etapa_id) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'C1', 'reuniao', 'Reuniao hoje', '2030-01-15', '14:30', 'a0000000-0000-0000-0000-000000000002', null),
  ('72000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'C2', 'reuniao', 'Reuniao cancelada', '2030-01-15', '15:00', 'a0000000-0000-0000-0000-000000000002',
    (select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'compromissos' and nome = 'Cancelado'));
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, colaboradores, clientes) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '{10000000-0000-0000-0000-000000000001}');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, clientes, arquivado_em) values
  ('73000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'judicial', '2', 'a0000000-0000-0000-0000-000000000001', '{10000000-0000-0000-0000-000000000001}', now());
insert into public.processo_prazos (id, escritorio_id, processo_id, descricao, final, tarefa_id) values
  ('74000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', 'Arquivado', '2030-01-17', '70000000-0000-0000-0000-00000000000b'),
  ('74000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Contestar', '2030-01-17', '70000000-0000-0000-0000-000000000009'),
  ('74000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Replicar', '2030-01-17', '70000000-0000-0000-0000-00000000000a');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- Só o que é dos cartões deste teste: o banco local pode ter outros dados.
create function pg_temp.avisos(p_quem int) returns bigint language sql as $$
  select count(*) from public.mensagens where tipo = 'prazo' and perfil_id = ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid
$$;
create function pg_temp.aviso(p_item uuid) returns text language sql as $$
  select string_agg(prazo_aviso, ',' order by prazo_aviso) from public.mensagens
  where coalesce(processo_prazo_id, demanda_id, tarefa_id, compromisso_id) = p_item
$$;
create function pg_temp.email_da(p_para text) returns jsonb language sql as $$
  select e from jsonb_array_elements(public.prazos_emails_a_enviar(1000000)) e where e ->> 'para' = p_para
$$;
create function pg_temp.resumo_da(p_para text) returns jsonb language sql as $$
  select e from jsonb_array_elements(public.prazos_resumos_a_enviar(1000000, 20)) e where e ->> 'para' = p_para
$$;

-- Quando a rotina roda na terça-feira
select privado.gerar_avisos_de_prazo('2030-01-15');

-- Então avisa o que vence hoje e o que vence em até 3 dias, ao responsável
select is(pg_temp.aviso('70000000-0000-0000-0000-000000000001'), 'hoje', 'O prazo que vence hoje avisa "hoje"');
select is(pg_temp.aviso('70000000-0000-0000-0000-000000000002'), 'proximo', 'O prazo em 3 dias avisa "proximo"');
select is(pg_temp.aviso('71000000-0000-0000-0000-000000000001'), 'proximo', 'A demanda também avisa');
select is(pg_temp.aviso('72000000-0000-0000-0000-000000000001'), 'hoje', 'O compromisso também avisa');
select is(pg_temp.aviso('74000000-0000-0000-0000-000000000001'), 'proximo', 'O prazo de processo também avisa');
select is((select perfil_id from public.mensagens where processo_prazo_id = '74000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000001'::uuid, 'O prazo de processo vai ao responsável do processo');
select is(pg_temp.aviso('70000000-0000-0000-0000-000000000009'), null, 'A tarefa criada do prazo, com o mesmo responsável, não avisa de novo');
select is(pg_temp.aviso('70000000-0000-0000-0000-00000000000b'), 'proximo', 'A tarefa de um prazo cujo processo foi arquivado avisa: o prazo não avisa mais');
select is(pg_temp.aviso('70000000-0000-0000-0000-00000000000a'), 'proximo', 'A tarefa do prazo que é de outra pessoa avisa essa pessoa');
select is(pg_temp.avisos(2), 5::bigint, 'Bia recebe só os avisos dela: nem o colaborador recebe o do processo');

-- E não avisa o que não deve
select is(pg_temp.aviso('70000000-0000-0000-0000-000000000003'), null, 'O prazo em 4 dias ainda não avisa');
select is(pg_temp.aviso('70000000-0000-0000-0000-000000000004'), null, 'O prazo que já venceu não gera aviso novo');
select is(pg_temp.aviso('70000000-0000-0000-0000-000000000005'), null, 'O que foi concluído não avisa');
select is(pg_temp.aviso('70000000-0000-0000-0000-000000000006'), null, 'O que foi arquivado não avisa');
select is(pg_temp.aviso('70000000-0000-0000-0000-000000000007'), null, 'Quem está desativado não recebe');
select is(pg_temp.aviso('72000000-0000-0000-0000-000000000002'), null, 'O compromisso cancelado não avisa');
select is(pg_temp.aviso('71000000-0000-0000-0000-000000000002'), null, 'O módulo desligado no escritório não avisa');
select is(pg_temp.aviso('70000000-0000-0000-0000-000000000008'), 'hoje', 'O outro escritório recebe os avisos dele');

-- Quando a rotina roda de novo no mesmo dia, então nada se repete
select privado.gerar_avisos_de_prazo('2030-01-15');
select is(pg_temp.avisos(2), 5::bigint, 'Rodar a rotina duas vezes não repete os avisos');

-- Então só a própria pessoa vê o aviso, e só marca a leitura
select pg_temp.entrar(1); set local role authenticated;
select is((select count(*) from public.mensagens where demanda_id = '71000000-0000-0000-0000-000000000001'), 0::bigint, 'Nem a administradora vê o aviso de outra pessoa');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.mensagens where demanda_id = '71000000-0000-0000-0000-000000000001'), 1::bigint, 'A pessoa vê o próprio aviso');
select throws_ok($$ update public.mensagens set email_enviado_em = now() $$, '42501', null, 'A tela não mexe no controle de envio');
select throws_ok($$ select public.prazos_emails_a_enviar(1) $$, '42501', null, 'Quem usa o sistema não pega a lista de e-mails');
select throws_ok($$ select public.prazos_resumos_a_enviar(1, 1) $$, '42501', null, 'Quem usa o sistema não pega a lista de resumos');
select throws_ok($$ select public.prazos_emails_enviados('{}') $$, '42501', null, 'Quem usa o sistema não marca o e-mail como enviado');
reset role;

-- Quando a fila de e-mails é lida, então vem um e-mail por pessoa, com todos os prazos dela
select is(jsonb_array_length((select e -> 'itens' from (select pg_temp.email_da('bia@exemplo.test') e) x)), 5, 'O e-mail da Bia traz os 5 prazos, num só');
select is(pg_temp.email_da('bia@exemplo.test'), null, 'Logo depois, a tentativa já marcada segura o reenvio');
update public.mensagens set email_tentado_em = now() - interval '11 minutes' where perfil_id = 'a0000000-0000-0000-0000-000000000002';
select is(jsonb_array_length((select e -> 'itens' from (select pg_temp.email_da('bia@exemplo.test') e) x)), 5, 'Passados 10 minutos, tenta de novo');
update public.mensagens set email_tentado_em = now() - interval '11 minutes', email_tentativas = 2 where perfil_id = 'a0000000-0000-0000-0000-000000000002';
select is(pg_temp.email_da('bia@exemplo.test'), null, 'A espera cresce a cada tentativa');
update public.mensagens set email_tentado_em = now() - interval '46 minutes', email_tentativas = 2 where perfil_id = 'a0000000-0000-0000-0000-000000000002';
select isnt(pg_temp.email_da('bia@exemplo.test'), null, 'Passada a espera maior, tenta de novo');
update public.mensagens set email_tentado_em = now() - interval '3 hours', email_tentativas = 4 where perfil_id = 'a0000000-0000-0000-0000-000000000002';
select is(pg_temp.email_da('bia@exemplo.test'), null, 'Depois de 4 tentativas, desiste');

-- Quando o e-mail saiu, então não sai de novo
update public.mensagens set email_tentado_em = null, email_tentativas = 0 where perfil_id = 'a0000000-0000-0000-0000-000000000002';
select public.prazos_emails_enviados(array(select id from public.mensagens where perfil_id = 'a0000000-0000-0000-0000-000000000002'));
select is(pg_temp.email_da('bia@exemplo.test'), null, 'O que já foi enviado não sai de novo');

-- Quando a Ana desliga o e-mail diário, então o aviso continua na caixa, sem e-mail
update public.mensagens set email_tentado_em = null, email_tentativas = 0 where perfil_id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis set preferencias = '{"email_prazos_diario": false}' where id = 'a0000000-0000-0000-0000-000000000001';
select is(pg_temp.email_da('ana@exemplo.test'), null, 'Quem desligou não recebe o e-mail');
select is(pg_temp.avisos(1), 3::bigint, 'Quem desligou continua com os avisos na caixa');
update public.perfis set preferencias = '{}' where id = 'a0000000-0000-0000-0000-000000000001';
select isnt(pg_temp.email_da('ana@exemplo.test'), null, 'Quem não desligou recebe o e-mail');

-- Quando o prazo já passou e o e-mail não saiu, então ele não sai mais
update public.tarefas set prazo = '2020-01-15' where id = '70000000-0000-0000-0000-000000000008';
update public.mensagens set prazo_data = '2020-01-15', email_tentado_em = null, email_tentativas = 0 where tarefa_id = '70000000-0000-0000-0000-000000000008';
select is(pg_temp.email_da('davi@exemplo.test'), null, 'O aviso de um prazo que já passou não vai por e-mail');

-- Quando a preferência é gravada, então as outras continuam, e só a própria pessoa grava a dela
select pg_temp.entrar(2); set local role authenticated;
select public.preferencia_gravar('tarefas.visao', '"quadro"');
select public.preferencia_gravar('email_prazos_semanal', 'false');
reset role;
select is((select preferencias from public.perfis where id = 'a0000000-0000-0000-0000-000000000002'), '{"tarefas.visao": "quadro", "email_prazos_semanal": false}'::jsonb, 'Gravar uma preferência não apaga as outras');
update public.perfis set preferencias = '{}' where id = 'a0000000-0000-0000-0000-000000000002';
set local role anon;
select throws_ok($$ select public.preferencia_gravar('x', '1') $$, '42501', null, 'Quem não entrou não grava preferência');
reset role;

-- Quando a tarefa é concluída e o aviso não foi lido, então ele sai da caixa no dia seguinte; se foi lido, fica
update public.mensagens set lido_em = now() where demanda_id = '71000000-0000-0000-0000-000000000001';
update public.tarefas set etapa_id = 'b0000000-0000-0000-0000-000000000001' where id = '70000000-0000-0000-0000-000000000002';
update public.demandas set arquivado_em = now() where id = '71000000-0000-0000-0000-000000000001';
select privado.gerar_avisos_de_prazo('2030-01-16');
select is(pg_temp.aviso('70000000-0000-0000-0000-000000000002'), null, 'O aviso não lido do que foi concluído sai da caixa');
select is(pg_temp.aviso('71000000-0000-0000-0000-000000000001'), 'proximo', 'O aviso já lido fica no histórico');

-- Quando chega o dia do prazo, então o aviso do dia substitui o de antes, se ele não foi lido
select privado.gerar_avisos_de_prazo('2030-01-17');
select is(pg_temp.aviso('74000000-0000-0000-0000-000000000001'), 'hoje', 'O aviso do dia substitui o de antes');

-- Quando o prazo muda de data, então vem o aviso da nova data
update public.processo_prazos set final = '2030-01-18' where id = '74000000-0000-0000-0000-000000000001';
select privado.gerar_avisos_de_prazo('2030-01-17');
select is((select prazo_data from public.mensagens where processo_prazo_id = '74000000-0000-0000-0000-000000000001'), '2030-01-18'::date, 'O aviso acompanha a data nova');

-- Quando chega a sexta-feira, então cada um tem o resumo: o que passou, o que falta e a semana seguinte
update public.tarefas set etapa_id = null, prazo = '2030-01-22' where id = '70000000-0000-0000-0000-000000000003';
select privado.gerar_resumos_de_prazo('2030-01-18');
select privado.gerar_resumos_de_prazo('2030-01-18');
select is((select count(*) from public.resumos_de_prazos where perfil_id = 'a0000000-0000-0000-0000-000000000002'), 1::bigint, 'Um resumo por pessoa e por semana');
update public.perfis set preferencias = '{"email_prazos_semanal": false}' where id = 'a0000000-0000-0000-0000-000000000001';
create temporary table resumos_da_leva on commit drop as select e from jsonb_array_elements(public.prazos_resumos_a_enviar(1000000, 20)) e;
select is((select count(*) from resumos_da_leva where e ->> 'para' = 'ana@exemplo.test'), 0::bigint, 'Quem desligou o resumo não o recebe');
create temporary table resumo_bia on commit drop as select e as r from resumos_da_leva where e ->> 'para' = 'bia@exemplo.test';
select is(((select r from resumo_bia) -> 'atrasados' ->> 'total')::int, 4, 'O resumo conta os atrasados');
select is(((select r from resumo_bia) -> 'proxima_semana' ->> 'total')::int, 1, 'O resumo traz a semana seguinte');
select is(((select r from resumo_bia) ->> 'concluidos')::int, 2, 'O resumo conta o que foi concluído na semana');
select is(pg_temp.resumo_da('bia@exemplo.test'), null, 'Logo depois, a tentativa já marcada segura o reenvio do resumo');

-- Quando o prazo passou há mais de 30 dias, então o aviso sai da caixa
select privado.gerar_avisos_de_prazo('2030-03-01');
select is(pg_temp.aviso('71000000-0000-0000-0000-000000000001'), null, 'O aviso antigo sai da caixa');

select * from finish();
rollback;
