-- Hora e lembrete nos prazos de tarefas e demandas (#286).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
-- Brasília é UTC-3 o ano todo: 9h de Brasília = 12h UTC. A rotina recebe o "agora" fixo, para o teste não depender do relógio.
begin;
create extension if not exists pgtap with schema extensions;
select plan(91);

-- Dado um escritório com Ana (administradora), Bia e Caio (desativado), e um outro escritório, de Davi, com as demandas desligadas.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-lembretes', '{"pessoas": true, "demandas": true, "tarefas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-lembretes-2', '{"pessoas": true, "demandas": false, "tarefas": true}');
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

-- 15/01/2030. Os cartões entram sem passar pelos gatilhos, com os dados exatos. Bia é a responsável; Ana e Caio participam de T1.
set local session_replication_role = replica;
-- O escritório de teste nasce com o quadro de tarefas pronto (#295); aqui ele tem só a coluna do fim.
delete from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'tarefas';
insert into public.quadro_colunas (id, escritorio_id, modulo, nome, ordem, marco) values
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'tarefas', 'Fim', 1, 'concluido');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, prazo, prazo_hora, lembrete, etapa_id, arquivado_em, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Uma hora antes', 'a0000000-0000-0000-0000-000000000002',
    '{a0000000-0000-0000-0000-000000000001,a0000000-0000-0000-0000-000000000003}', '2030-01-15', '14:00', 60, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'T2', 'Na hora, sem hora', 'a0000000-0000-0000-0000-000000000002', '{}', '2030-01-15', null, 0, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'T3', 'Um dia antes, sem hora', 'a0000000-0000-0000-0000-000000000002', '{}', '2030-01-16', null, 1440, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'T4', 'Meia hora antes', 'a0000000-0000-0000-0000-000000000002', '{}', '2030-01-15', '13:00', 30, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'T5', 'Rodada perdida', 'a0000000-0000-0000-0000-000000000002', '{}', '2030-01-15', '10:00', 0, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'T6', 'Concluida', 'a0000000-0000-0000-0000-000000000002', '{}', '2030-01-15', '14:00', 60, 'b0000000-0000-0000-0000-000000000001', null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'T7', 'Sem lembrete', 'a0000000-0000-0000-0000-000000000002', '{}', '2030-01-25', null, null, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000002', 'T8', 'Do outro escritorio', 'a0000000-0000-0000-0000-000000000004', '{}', '2030-01-15', '14:00', 60, null, null, 'a0000000-0000-0000-0000-000000000004'),
  ('70000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', 'T9', 'Sem prazo', 'a0000000-0000-0000-0000-000000000002', '{}', null, null, 60, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000001', 'TA', 'Prazo que passou', 'a0000000-0000-0000-0000-000000000002', '{}', '2030-01-15', '09:30', 0, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-000000000001', 'TB', 'Prazo antigo', 'a0000000-0000-0000-0000-000000000002', '{}', '2020-01-15', '14:00', 60, null, null, 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-00000000000c', 'e0000000-0000-0000-0000-000000000001', 'TC', 'Arquivada', 'a0000000-0000-0000-0000-000000000002', '{}', '2030-01-15', '14:00', 60, null, now(), 'a0000000-0000-0000-0000-000000000002');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, prazo, prazo_hora, lembrete, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda', 'a0000000-0000-0000-0000-000000000002', '{a0000000-0000-0000-0000-000000000001}', '2030-01-15', '14:00', 60, 'a0000000-0000-0000-0000-000000000002'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'D2', 'Modulo desligado', 'a0000000-0000-0000-0000-000000000004', '{}', '2030-01-15', '14:00', 60, 'a0000000-0000-0000-0000-000000000004'),
  ('71000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'D3', 'Sem lembrete', 'a0000000-0000-0000-0000-000000000002', '{}', '2030-01-25', null, null, 'a0000000-0000-0000-0000-000000000002');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.perfil(p_quem int) returns uuid language sql as $$ select ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid $$;
-- Só o que é dos cartões deste teste: o banco local pode ter outros dados.
create function pg_temp.lembretes(p_item uuid) returns bigint language sql as $$
  select count(*) from public.mensagens where prazo_aviso = 'lembrete' and coalesce(demanda_id, tarefa_id) = p_item
$$;
create function pg_temp.lembretes_de(p_quem int) returns bigint language sql as $$
  select count(*) from public.mensagens where prazo_aviso = 'lembrete' and perfil_id = pg_temp.perfil(p_quem)
$$;
create function pg_temp.lembrete_em(p_item uuid, p_quem int) returns timestamptz language sql as $$
  select lembrete_em from public.mensagens where prazo_aviso = 'lembrete' and coalesce(demanda_id, tarefa_id) = p_item and perfil_id = pg_temp.perfil(p_quem)
  order by prazo_data desc limit 1
$$;
create function pg_temp.email_da(p_para text) returns jsonb language sql as $$
  select e from jsonb_array_elements(public.prazos_lembretes_a_enviar(1000000)) e where e ->> 'para' = p_para
$$;
create function pg_temp.zerar_envio(p_quem int) returns void language sql as $$
  update public.mensagens set email_tentativas = 0, email_tentado_em = null, email_enviado_em = null where prazo_aviso = 'lembrete' and perfil_id = pg_temp.perfil(p_quem)
$$;

-- Quando a rotina roda um minuto antes das 9h de Brasília, então nada chega
select privado.gerar_lembretes('2030-01-15 11:59Z');
select is((select count(*) from public.mensagens where prazo_aviso = 'lembrete' and escritorio_id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')),
  0::bigint, 'Antes da hora marcada, nenhum lembrete chega');

-- Quando dá 9h de Brasília, então chegam os lembretes dos prazos sem hora
select privado.gerar_lembretes('2030-01-15 12:00Z');
select is(pg_temp.lembrete_em('70000000-0000-0000-0000-000000000002', 2), '2030-01-15 12:00Z'::timestamptz, 'Prazo sem hora, "na hora do prazo": chega às 9h do dia');
select is(pg_temp.lembrete_em('70000000-0000-0000-0000-000000000003', 2), '2030-01-15 12:00Z'::timestamptz, 'Prazo sem hora, "1 dia antes": chega às 9h do dia anterior');
select is(pg_temp.lembretes('70000000-0000-0000-0000-000000000001'), 0::bigint, 'O lembrete de 1 hora antes do prazo das 14h ainda não chegou');

-- Quando uma rodada se perde e a seguinte vem 14 minutos depois do prazo, então o lembrete ainda chega; o prazo que já passou, não
select privado.gerar_lembretes('2030-01-15 13:14Z');
select is(pg_temp.lembretes('70000000-0000-0000-0000-000000000005'), 1::bigint, 'Até 15 minutos depois do prazo, o lembrete ainda chega');
select is(pg_temp.lembretes('70000000-0000-0000-0000-00000000000a'), 0::bigint, 'O prazo que já passou não lembra');

-- Quando dá 12h30 e depois 13h de Brasília, então chegam os de 30 minutos e de 1 hora antes
select privado.gerar_lembretes('2030-01-15 15:30Z');
select is(pg_temp.lembrete_em('70000000-0000-0000-0000-000000000004', 2), '2030-01-15 15:30Z'::timestamptz, '"30 minutos antes" chega meia hora antes');
select privado.gerar_lembretes('2030-01-15 16:00Z');
select privado.gerar_lembretes('2030-01-15 16:00Z');
select is(pg_temp.lembrete_em('70000000-0000-0000-0000-000000000001', 2), '2030-01-15 16:00Z'::timestamptz, '"1 hora antes" chega uma hora antes');

-- Então recebem o responsável e quem participa, ativos e do mesmo escritório
select is(pg_temp.lembretes('70000000-0000-0000-0000-000000000001'), 2::bigint, 'Na tarefa, recebem o responsável e o participante');
select is(pg_temp.lembretes_de(3), 0::bigint, 'Quem está desativado não recebe');
select is(pg_temp.lembretes('71000000-0000-0000-0000-000000000001'), 2::bigint, 'Na demanda, recebem o responsável e o colaborador');
select is((select perfil_id::text || ' ' || escritorio_id from public.mensagens where prazo_aviso = 'lembrete' and tarefa_id = '70000000-0000-0000-0000-000000000008'),
  'a0000000-0000-0000-0000-000000000004 e0000000-0000-0000-0000-000000000002', 'O outro escritório recebe os lembretes dele, e só ele');
select is(pg_temp.lembretes('71000000-0000-0000-0000-000000000002'), 0::bigint, 'O módulo desligado no escritório não lembra');

-- E não lembra o que não deve
select is(pg_temp.lembretes('70000000-0000-0000-0000-000000000006'), 0::bigint, 'O que foi concluído não lembra');
select is(pg_temp.lembretes('70000000-0000-0000-0000-00000000000c'), 0::bigint, 'O que foi arquivado não lembra');
select is(pg_temp.lembretes('70000000-0000-0000-0000-000000000007'), 0::bigint, 'Sem lembrete marcado, nada chega');
select is(pg_temp.lembretes('70000000-0000-0000-0000-000000000009'), 0::bigint, 'Lembrete sem prazo (gravado pelo site antigo) não chega');
select is(pg_temp.lembretes_de(2), 6::bigint, 'Rodar a rotina duas vezes não repete os lembretes');

-- Então a hora do prazo vale também para os avisos de antes, e o prazo sem hora conta às 9h
select is(privado.hora_padrao_do_lembrete(), '09:00'::time, 'O prazo sem hora conta às 9h (HORA_PADRAO_DO_LEMBRETE no app)');
select is((select hora from privado.prazos_da_equipe where item_id = '70000000-0000-0000-0000-000000000001'), '14:00', 'Os avisos e o resumo levam a hora da tarefa');
select is((select hora from privado.prazos_da_equipe where item_id = '71000000-0000-0000-0000-000000000001'), '14:00', 'Os avisos e o resumo levam a hora da demanda');

-- Quando a fila de e-mails dos lembretes é lida, então vem um e-mail por pessoa, com os lembretes dela, menos o de um prazo que já passou
select privado.gerar_lembretes('2020-01-15 16:00Z');
select is(pg_temp.lembretes('70000000-0000-0000-0000-00000000000b'), 1::bigint, 'O lembrete do prazo antigo chegou na hora dele');
create temporary table leva on commit drop as select e from jsonb_array_elements(public.prazos_lembretes_a_enviar(1000000)) e;
create temporary table itens_da_bia on commit drop as select i from leva, jsonb_array_elements(e -> 'itens') i where e ->> 'para' = 'bia@exemplo.test';
select is((select count(*) from itens_da_bia), 6::bigint, 'O e-mail da Bia traz os 6 lembretes dela, num só');
select is((select count(*) from itens_da_bia where i ->> 'cartao_id' = '70000000-0000-0000-0000-00000000000b'), 0::bigint, 'O lembrete de um prazo que já passou não vai por e-mail');
select is((select i ->> 'hora' || ' ' || (i ->> 'aviso') || ' ' || (i ->> 'antecedencia') || ' ' || (i ->> 'modulo') || ' ' || (i ->> 'data') from itens_da_bia
           where i ->> 'cartao_id' = '70000000-0000-0000-0000-000000000001'), '14:00 lembrete 60 tarefas 2030-01-15', 'Cada item diz o prazo, a hora e a antecedência');
select is((select jsonb_array_length(e -> 'itens') from leva where e ->> 'para' = 'ana@exemplo.test'), 2, 'O e-mail da Ana traz a tarefa e a demanda de que ela participa');
select is(pg_temp.email_da('bia@exemplo.test'), null, 'Logo depois, a tentativa já marcada segura o reenvio');
update public.mensagens set email_tentado_em = now() - interval '3 minutes' where prazo_aviso = 'lembrete' and perfil_id = pg_temp.perfil(2);
select isnt(pg_temp.email_da('bia@exemplo.test'), null, 'Passados 2 minutos, tenta de novo');
update public.mensagens set email_tentado_em = now() - interval '3 minutes', email_tentativas = 2 where prazo_aviso = 'lembrete' and perfil_id = pg_temp.perfil(2);
select is(pg_temp.email_da('bia@exemplo.test'), null, 'A espera cresce a cada tentativa');
update public.mensagens set email_tentado_em = now() - interval '6 minutes', email_tentativas = 2 where prazo_aviso = 'lembrete' and perfil_id = pg_temp.perfil(2);
select isnt(pg_temp.email_da('bia@exemplo.test'), null, 'Passada a espera maior, tenta de novo');
update public.mensagens set email_tentado_em = now() - interval '1 hour', email_tentativas = 3 where prazo_aviso = 'lembrete' and perfil_id = pg_temp.perfil(2);
select is(pg_temp.email_da('bia@exemplo.test'), null, 'Depois de 3 tentativas, desiste');

-- Quando o e-mail saiu, então não sai de novo
select pg_temp.zerar_envio(2);
select public.prazos_emails_enviados(array(select id from public.mensagens where prazo_aviso = 'lembrete' and perfil_id = pg_temp.perfil(2)));
select is(pg_temp.email_da('bia@exemplo.test'), null, 'O lembrete que já foi por e-mail não sai de novo');

-- Quando a Ana desliga o e-mail das 7h, então o dos lembretes continua; quando desliga o dos lembretes, o lembrete fica só na caixa
select pg_temp.zerar_envio(1);
update public.perfis set preferencias = '{"email_prazos_diario": false}' where id = pg_temp.perfil(1);
select isnt(pg_temp.email_da('ana@exemplo.test'), null, 'Desligar o e-mail das 7h não desliga o dos lembretes');
select pg_temp.zerar_envio(1);
update public.perfis set preferencias = '{"email_lembretes": false}' where id = pg_temp.perfil(1);
select is(pg_temp.email_da('ana@exemplo.test'), null, 'Quem desligou o e-mail dos lembretes não o recebe');
select is(pg_temp.lembretes_de(1), 2::bigint, 'Quem desligou continua com os lembretes na caixa');
update public.perfis set preferencias = '{}' where id = pg_temp.perfil(1);

-- Quando os avisos de 3 dias e do dia rodam, então não apagam nem mandam os lembretes
select privado.gerar_avisos_de_prazo('2030-01-15');
select privado.gerar_avisos_de_prazo('2030-01-16');
select is(pg_temp.lembretes_de(1), 2::bigint, 'Os avisos do dia não apagam o lembrete de quem participa (eles só vão ao responsável)');
select is(pg_temp.lembretes_de(2), 6::bigint, 'Os avisos do dia não apagam os lembretes do responsável');
select is(pg_temp.lembretes('70000000-0000-0000-0000-00000000000b'), 0::bigint, 'O lembrete de um prazo de mais de 30 dias sai da caixa, como os avisos');
update public.mensagens set email_tentativas = 0, email_tentado_em = null where perfil_id = pg_temp.perfil(2);
create temporary table diario on commit drop as select i from jsonb_array_elements(public.prazos_emails_a_enviar(1000000)) e, jsonb_array_elements(e -> 'itens') i
  where e ->> 'para' = 'bia@exemplo.test';
select isnt((select count(*) from diario), 0::bigint, 'A Bia tem o e-mail das 7h');
select is((select count(*) from diario where i ->> 'aviso' = 'lembrete'), 0::bigint, 'O e-mail das 7h não leva lembrete');

-- Quando a hora muda depois de o lembrete ser lido, então ele chega de novo, como não lido, no horário novo
update public.mensagens set lido_em = now() where prazo_aviso = 'lembrete' and tarefa_id = '70000000-0000-0000-0000-000000000001' and perfil_id = pg_temp.perfil(2);
update public.tarefas set prazo_hora = '15:00' where id = '70000000-0000-0000-0000-000000000001';
select privado.gerar_lembretes('2030-01-15 16:30Z');
select ok((select lido_em is not null from public.mensagens where prazo_aviso = 'lembrete' and tarefa_id = '70000000-0000-0000-0000-000000000001' and perfil_id = pg_temp.perfil(2)),
  'Antes do horário novo, o lembrete lido fica como estava');
select is(pg_temp.lembrete_em('70000000-0000-0000-0000-000000000001', 1), null, 'O lembrete não lido que não vale mais sai da caixa');
select privado.gerar_lembretes('2030-01-15 17:00Z');
select ok((select lembrete_em = '2030-01-15 17:00Z' and lembrete_antes = 60 and lido_em is null and email_enviado_em is null and email_tentativas = 0
           from public.mensagens where prazo_aviso = 'lembrete' and tarefa_id = '70000000-0000-0000-0000-000000000001' and perfil_id = pg_temp.perfil(2)),
  'Mudar a hora faz o lembrete lido chegar de novo, como não lido e com um e-mail novo');
select is(pg_temp.lembrete_em('70000000-0000-0000-0000-000000000001', 1), '2030-01-15 17:00Z'::timestamptz, 'O não lido volta no horário novo');

-- Quando o lembrete muda antes de ser lido, então o novo toma o lugar do antigo
update public.tarefas set lembrete = 60 where id = '70000000-0000-0000-0000-000000000004';
select privado.gerar_lembretes('2030-01-15 15:45Z');
select ok(pg_temp.lembretes('70000000-0000-0000-0000-000000000004') = 1 and pg_temp.lembrete_em('70000000-0000-0000-0000-000000000004', 2) = '2030-01-15 15:00Z'
          and (select lembrete_antes from public.mensagens where prazo_aviso = 'lembrete' and tarefa_id = '70000000-0000-0000-0000-000000000004') = 60,
  'Mudar o lembrete troca o não lido pelo do horário novo, com a antecedência nova');

-- Quando a data muda depois de o lembrete ser lido, então chega um lembrete da data nova, e o lido fica no histórico
update public.mensagens set lido_em = now() where prazo_aviso = 'lembrete' and tarefa_id = '70000000-0000-0000-0000-000000000003';
update public.tarefas set prazo = '2030-01-17' where id = '70000000-0000-0000-0000-000000000003';
select privado.gerar_lembretes('2030-01-16 12:00Z');
select is((select string_agg(prazo_data || ':' || (lido_em is null), ',' order by prazo_data) from public.mensagens
           where prazo_aviso = 'lembrete' and tarefa_id = '70000000-0000-0000-0000-000000000003'), '2030-01-16:false,2030-01-17:true', 'Mudar a data faz o lembrete chegar de novo');

-- Quando a tarefa é concluída, a demanda é arquivada ou a pessoa sai do cartão, então o lembrete não lido sai; o lido fica
update public.tarefas set etapa_id = 'b0000000-0000-0000-0000-000000000001' where id = '70000000-0000-0000-0000-000000000002';
update public.mensagens set lido_em = now() where prazo_aviso = 'lembrete' and demanda_id = '71000000-0000-0000-0000-000000000001' and perfil_id = pg_temp.perfil(1);
update public.demandas set arquivado_em = now() where id = '71000000-0000-0000-0000-000000000001';
select pg_temp.entrar(1); set local role authenticated;
select public.cartao_sair('tarefas', '70000000-0000-0000-0000-000000000001');
reset role;
select privado.gerar_lembretes('2030-01-16 12:01Z');
select is(pg_temp.lembretes('70000000-0000-0000-0000-000000000002'), 0::bigint, 'Concluir tira o lembrete não lido');
select is((select string_agg(perfil_id::text, ',') from public.mensagens where prazo_aviso = 'lembrete' and demanda_id = '71000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001', 'Arquivar tira o lembrete não lido; o lido fica');
select is(pg_temp.lembrete_em('70000000-0000-0000-0000-000000000001', 1), null, 'Quem sai do cartão perde o lembrete não lido');
select is(pg_temp.lembretes('70000000-0000-0000-0000-000000000001'), 1::bigint, 'Quem fica no cartão continua com o lembrete');

-- Então a caixa só aceita o lembrete com o instante e a antecedência dele, e só nele
select throws_ok($$ insert into public.mensagens (escritorio_id, perfil_id, tipo, tarefa_id, prazo_data, prazo_aviso, lembrete_antes)
  values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'prazo', '70000000-0000-0000-0000-000000000007', '2030-01-25', 'lembrete', 60) $$,
  '23514', null, 'O lembrete precisa do instante em que dispara');
select throws_ok($$ insert into public.mensagens (escritorio_id, perfil_id, tipo, tarefa_id, prazo_data, prazo_aviso, lembrete_em)
  values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'prazo', '70000000-0000-0000-0000-000000000007', '2030-01-25', 'lembrete', now()) $$,
  '23514', null, 'O lembrete precisa da antecedência com que foi marcado');
select throws_ok($$ insert into public.mensagens (escritorio_id, perfil_id, tipo, tarefa_id, prazo_data, prazo_aviso, lembrete_em, lembrete_antes)
  values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'prazo', '70000000-0000-0000-0000-000000000007', '2030-01-25', 'lembrete', now(), 45) $$,
  '23514', null, 'O lembrete só guarda as antecedências combinadas');
select throws_ok($$ insert into public.mensagens (escritorio_id, perfil_id, tipo, tarefa_id, prazo_data, prazo_aviso, lembrete_em)
  values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'prazo', '70000000-0000-0000-0000-000000000007', '2030-01-25', 'hoje', now()) $$,
  '23514', null, 'Só o lembrete tem o instante');
select throws_ok($$ insert into public.mensagens (escritorio_id, perfil_id, tipo, tarefa_id, prazo_data, prazo_aviso, lembrete_antes)
  values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'prazo', '70000000-0000-0000-0000-000000000007', '2030-01-25', 'hoje', 60) $$,
  '23514', null, 'Só o lembrete tem a antecedência');

-- Então quem usa o sistema não roda as rotinas nem lê as listas, mas grava a hora e o lembrete do prazo
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.mensagens where prazo_aviso = 'lembrete' and perfil_id <> 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'Cada um vê só os próprios lembretes');
select throws_ok($$ select privado.gerar_lembretes() $$, '42501', null, 'Quem usa o sistema não gera lembretes');
select throws_ok($$ select privado.rodar_lembretes() $$, '42501', null, 'Quem usa o sistema não roda a rotina dos lembretes');
select throws_ok($$ select public.prazos_lembretes_a_enviar(1) $$, '42501', null, 'Quem usa o sistema não pega a lista de e-mails dos lembretes');
select throws_ok($$ select * from privado.lembretes_da_equipe $$, '42501', null, 'Quem usa o sistema não lê os lembretes da equipe');
select throws_ok($$ select * from privado.lembretes_devidos $$, '42501', null, 'Quem usa o sistema não lê os lembretes por enviar');
select lives_ok($$ update public.tarefas set prazo_hora = '14:00', lembrete = 60 where id = '70000000-0000-0000-0000-000000000007' $$, 'A tela grava a hora e o lembrete da tarefa');
select lives_ok($$ update public.demandas set prazo_hora = '10:30', lembrete = 1440 where id = '71000000-0000-0000-0000-000000000003' $$, 'A tela grava a hora e o lembrete da demanda');
select throws_ok($$ update public.tarefas set lembrete = 45 where id = '70000000-0000-0000-0000-000000000007' $$, '23514', null, 'Só as antecedências combinadas');
reset role;
select is((select prazo_hora || ' ' || lembrete from public.tarefas where id = '70000000-0000-0000-0000-000000000007'), '14:00:00 60', 'A tarefa guardou a hora e o lembrete');
select is((select prazo_hora || ' ' || lembrete from public.demandas where id = '71000000-0000-0000-0000-000000000003'), '10:30:00 1440', 'A demanda guardou a hora e o lembrete');
select ok((select alteracoes ? 'prazo_hora' and alteracoes ? 'lembrete' from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000007' order by em desc, id desc limit 1),
  'O histórico da tarefa registra a hora e o lembrete');
select ok((select alteracoes ? 'prazo_hora' and alteracoes ? 'lembrete' from public.demanda_historico where demanda_id = '71000000-0000-0000-0000-000000000003' order by em desc, id desc limit 1),
  'O histórico da demanda registra a hora e o lembrete');

-- Então nem quem entra sem login (anon) nem quem usa o sistema (authenticated) executa as funções novas ou lê as visões novas; só a
-- função de e-mail (service_role) pega a lista dos lembretes por enviar
select is((select array_agg(r || ' ' || f order by r, f)
           from unnest(array['anon', 'authenticated']) r,
                unnest(array['privado.hora_padrao_do_lembrete()', 'privado.tolerancia_do_lembrete()', 'privado.tentativas_do_lembrete()',
                             'privado.espera_do_lembrete(integer)', 'privado.gerar_lembretes(timestamptz)', 'privado.rodar_lembretes()',
                             'public.prazos_lembretes_a_enviar(integer)']) f
           where has_function_privilege(r, f, 'execute')), null, 'anon e authenticated não executam nenhuma das funções novas');
select is((select array_agg(r || ' ' || v order by r, v)
           from unnest(array['anon', 'authenticated']) r, unnest(array['privado.lembretes_da_equipe', 'privado.lembretes_devidos']) v
           where has_table_privilege(r, v, 'select, insert, update, delete')), null, 'anon e authenticated não leem nem mudam as visões novas');
select ok(has_function_privilege('service_role', 'public.prazos_lembretes_a_enviar(integer)', 'execute'), 'A função de e-mail pega a lista dos lembretes');

-- Dado um outro dia de cartões, 10/03/2031, longe dos de antes. TL5 e DL1 têm o Davi, de outro escritório, na equipe (gravado sem os
-- gatilhos, que não deixariam); TL6, do outro escritório, tem a Ana.
set local session_replication_role = replica;
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, prazo, prazo_hora, lembrete, criado_por) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'TL1', 'Lida e enviada', 'a0000000-0000-0000-0000-000000000002', '{}', '2031-03-10', '14:00', 60, 'a0000000-0000-0000-0000-000000000002'),
  ('72000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'TL2', 'Enviada sem ler', 'a0000000-0000-0000-0000-000000000002', '{}', '2031-03-10', '14:00', 60, 'a0000000-0000-0000-0000-000000000002'),
  ('72000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'TL3', 'Mesmo instante', 'a0000000-0000-0000-0000-000000000002', '{}', '2031-03-10', '14:00', 60, 'a0000000-0000-0000-0000-000000000002'),
  ('72000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'TL4', 'Tolerancia', 'a0000000-0000-0000-0000-000000000002', '{}', '2031-03-10', '11:00', 0, 'a0000000-0000-0000-0000-000000000002'),
  ('72000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'TL5', 'Com gente de fora', 'a0000000-0000-0000-0000-000000000002',
    '{a0000000-0000-0000-0000-000000000004}', '2031-03-10', '14:00', 60, 'a0000000-0000-0000-0000-000000000002'),
  ('72000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000002', 'TL6', 'Do outro, com gente daqui', 'a0000000-0000-0000-0000-000000000004',
    '{a0000000-0000-0000-0000-000000000001}', '2031-03-10', '14:00', 60, 'a0000000-0000-0000-0000-000000000004');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, prazo, prazo_hora, lembrete, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'DL1', 'Com gente de fora', 'a0000000-0000-0000-0000-000000000002',
    '{a0000000-0000-0000-0000-000000000004}', '2031-03-10', '14:00', 60, 'a0000000-0000-0000-0000-000000000002');
set local session_replication_role = origin;

-- Quando a rodada vem 16 minutos depois do prazo, então o lembrete não chega mais; a 15 minutos, ainda chega
select privado.gerar_lembretes('2031-03-10 14:16Z');
select is(pg_temp.lembretes('72000000-0000-0000-0000-000000000004'), 0::bigint, '16 minutos depois do prazo, o lembrete não chega mais');
select privado.gerar_lembretes('2031-03-10 14:15Z');
select is(pg_temp.lembretes('72000000-0000-0000-0000-000000000004'), 1::bigint, 'Exatamente 15 minutos depois do prazo, o lembrete ainda chega');

-- Quando dá a hora dos lembretes do dia, então quem é de outro escritório não recebe, mesmo estando na equipe do cartão
select privado.gerar_lembretes('2031-03-10 16:00Z');
select is((select count(*) from public.mensagens where prazo_aviso = 'lembrete' and perfil_id = pg_temp.perfil(4)
             and coalesce(demanda_id, tarefa_id) in ('72000000-0000-0000-0000-000000000005', '73000000-0000-0000-0000-000000000001')),
  0::bigint, 'Participante ou colaborador de outro escritório não recebe o lembrete');
select is(pg_temp.lembretes('72000000-0000-0000-0000-000000000005') + pg_temp.lembretes('73000000-0000-0000-0000-000000000001'), 2::bigint,
  'A responsável, do escritório do cartão, recebe');
select is((select string_agg(perfil_id::text, ',') from public.mensagens where prazo_aviso = 'lembrete' and tarefa_id = '72000000-0000-0000-0000-000000000006'),
  'a0000000-0000-0000-0000-000000000004', 'No cartão do outro escritório, quem é daqui não recebe');

-- Dado o lembrete de TL1 lido e enviado por e-mail, e o de TL2 enviado sem ser lido
select public.prazos_emails_enviados(array(select id from public.mensagens where prazo_aviso = 'lembrete'
  and tarefa_id in ('72000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002')));
update public.mensagens set lido_em = now() - interval '1 minute' where prazo_aviso = 'lembrete' and tarefa_id = '72000000-0000-0000-0000-000000000001';
create temporary table antes_da_rodada on commit drop as
  select tarefa_id, lido_em, email_enviado_em, email_tentado_em, email_tentativas, lembrete_em, lembrete_antes from public.mensagens
  where prazo_aviso = 'lembrete' and tarefa_id in ('72000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002');
-- Quando a rotina roda de novo, com os cartões iguais
select privado.gerar_lembretes('2031-03-10 16:01Z');
select privado.gerar_lembretes('2031-03-10 16:30Z');
-- Então nada muda neles: o lido continua lido, e o controle do e-mail não é zerado
select is((select count(*) from public.mensagens m join antes_da_rodada a using (tarefa_id)
           where m.prazo_aviso = 'lembrete' and m.lido_em is not distinct from a.lido_em and m.email_enviado_em is not distinct from a.email_enviado_em
             and m.email_tentado_em is not distinct from a.email_tentado_em and m.email_tentativas = a.email_tentativas
             and m.lembrete_em = a.lembrete_em and m.lembrete_antes = a.lembrete_antes), 2::bigint,
  'Outra rodada com o mesmo cartão não mexe no lembrete: o lido fica lido e o controle do e-mail fica como estava');
select ok((select lido_em is not null from public.mensagens where prazo_aviso = 'lembrete' and tarefa_id = '72000000-0000-0000-0000-000000000001'),
  'O lembrete lido continua lido');
select is((select count(*) from jsonb_array_elements(public.prazos_lembretes_a_enviar(1000000)) e, jsonb_array_elements(e -> 'itens') i
           where i ->> 'cartao_id' in ('72000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002')),
  0::bigint, 'O que já foi por e-mail não sai de novo depois de outra rodada');

-- Dado o lembrete de TL3 lido e enviado, de ontem na caixa
update public.mensagens set lido_em = now(), criado_em = now() - interval '1 day', email_enviado_em = now(), email_tentativas = 1, email_tentado_em = now()
where prazo_aviso = 'lembrete' and tarefa_id = '72000000-0000-0000-0000-000000000003';
-- Quando a hora e o lembrete mudam juntos sem mudar o instante (14h e 1 hora antes para 13h30 e 30 minutos antes)
update public.tarefas set prazo_hora = '13:30', lembrete = 30 where id = '72000000-0000-0000-0000-000000000003';
select privado.gerar_lembretes('2031-03-10 16:02Z');
-- Então o lembrete chega de novo, com a antecedência nova
select ok((select lembrete_em = '2031-03-10 16:00Z' and lembrete_antes = 30 and lido_em is null and criado_em = now()
                  and email_enviado_em is null and email_tentado_em is null and email_tentativas = 0
           from public.mensagens where prazo_aviso = 'lembrete' and tarefa_id = '72000000-0000-0000-0000-000000000003'),
  'Mudar a hora e o lembrete com o mesmo instante faz o lembrete chegar de novo, no topo da caixa, como não lido e com um e-mail novo');
select is(pg_temp.lembretes('72000000-0000-0000-0000-000000000003'), 1::bigint, 'Chegar de novo não duplica o lembrete');
select is((select i ->> 'antecedencia' from jsonb_array_elements(public.prazos_lembretes_a_enviar(1000000)) e, jsonb_array_elements(e -> 'itens') i
           where i ->> 'cartao_id' = '72000000-0000-0000-0000-000000000003'), '30', 'O e-mail leva a antecedência guardada no lembrete');

-- Então as rotinas estão marcadas, e a de cada minuto roda mesmo sem o Vault configurado (banco local)
select lives_ok($$ select privado.rodar_lembretes() $$, 'A rotina dos lembretes roda sem o endereço da função');
select is((select schedule from cron.job where jobname = 'gerar-lembretes-de-prazo'), '* * * * *', 'Os lembretes são gerados a cada minuto');
select is((select count(*) from cron.job where jobname = 'limpar-registro-das-rotinas'), 1::bigint, 'O registro das rotinas é limpo por uma rotina só');
select is((select schedule from cron.job where jobname = 'limpar-registro-das-rotinas'), '15 6 * * *', 'O registro das rotinas é limpo uma vez por dia, às 3h15 de Brasília');

-- Dado um registro de rotina de 8 dias e outro de 6 dias, quando a limpeza roda, então só o mais antigo sai
-- (com runid negativo, escolhido aqui: a sequência do pg_cron não é de quem roda os testes, e nenhuma rodada de verdade tem runid negativo)
insert into cron.job_run_details (jobid, runid, command, status, start_time, end_time) values
  (0, -2861, 'teste-286 antigo', 'succeeded', now() - interval '8 days', now() - interval '8 days'),
  (0, -2862, 'teste-286 recente', 'succeeded', now() - interval '6 days', now() - interval '6 days');
select lives_ok((select command from cron.job where jobname = 'limpar-registro-das-rotinas'), 'A limpeza do registro das rotinas roda');
select is((select string_agg(command, ',' order by command) from cron.job_run_details where command like 'teste-286 %'), 'teste-286 recente',
  'A limpeza apaga o registro de mais de 7 dias e deixa o recente');

-- Dado o Vault com o endereço e a senha da rotina (falsos, desfeitos no fim) e nenhum lembrete por enviar
create function pg_temp.pedidos() returns bigint language sql as $$ select count(*) from net.http_request_queue $$;
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'semper_url_do_projeto') then
    perform vault.create_secret('http://exemplo.test', 'semper_url_do_projeto');
  end if;
  if not exists (select 1 from vault.secrets where name = 'semper_senha_da_rotina') then
    perform vault.create_secret('senha-de-teste', 'semper_senha_da_rotina');
  end if;
end $$;
update public.mensagens set email_enviado_em = now() where prazo_aviso = 'lembrete' and email_enviado_em is null;
create temporary table fila on commit drop as select pg_temp.pedidos() as n;
-- Quando a rotina de cada minuto roda, então não chama a função de e-mail
select privado.rodar_lembretes();
select is(pg_temp.pedidos(), (select n from fila), 'Sem lembrete por enviar, a rotina não chama a função de e-mail');
-- Quando há um lembrete por enviar, então chama, uma vez, pedindo os e-mails dos lembretes
update public.mensagens set email_enviado_em = null, email_tentativas = 0, email_tentado_em = null
where prazo_aviso = 'lembrete' and tarefa_id = '72000000-0000-0000-0000-000000000005';
select privado.rodar_lembretes();
select is(pg_temp.pedidos(), (select n + 1 from fila), 'Com lembrete por enviar, a rotina chama a função de e-mail uma vez');
select is((select convert_from(body, 'utf8')::jsonb ->> 'tipo' from net.http_request_queue order by id desc limit 1), 'lembrete',
  'A rotina pede os e-mails dos lembretes');

select * from finish();
rollback;
