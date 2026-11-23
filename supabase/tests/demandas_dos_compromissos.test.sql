-- Demanda que nasce do compromisso que se repete (#307, parte B). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
-- As datas das séries partem de hoje (privado.hoje_da_agenda), porque as datas viram compromissos de hoje até 12 meses adiante.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master), Bia e Caio (usuários comuns), e o Davi em outro escritório; o primeiro com o módulo Demandas.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-demandas-dos-compromissos', '{"pessoas": true, "demandas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-demandas-dos-compromissos-2', '{"pessoas": true}');
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
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now());
-- A pessoa P1 e o contrato K1 (da Bia), gravados direto.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000002');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, categoria, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AN26', 2026, 'AN26-0001-2026', '10000000-0000-0000-0000-000000000001', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000002', 'Registro de marca', 'pro_labore', 'a0000000-0000-0000-0000-000000000002');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.coluna(p_modulo text, p_nome text) returns uuid language sql as $$
  select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = p_modulo and nome = p_nome
$$;
grant execute on function pg_temp.coluna(text, text) to authenticated;
create function pg_temp.hoje() returns date language sql as $$ select privado.hoje_da_agenda() $$;
grant execute on function pg_temp.hoje() to authenticated;
-- As datas da série e o que elas geraram, lidos sem as regras, para conferir o que o banco gravou.
create function pg_temp.vez(p_n int) returns public.compromissos language sql security definer as $$
  select c.* from public.compromissos c where c.repeticao_id = (select repeticao_id from public.compromissos where id = '7c000000-0000-0000-0000-000000000001')
  order by c.repeticao_data offset p_n limit 1
$$;
create function pg_temp.demanda(p_id uuid) returns public.demandas language sql security definer as $$ select * from public.demandas where id = p_id $$;
create function pg_temp.avisos(p_aviso text) returns bigint language sql security definer as $$
  select count(*) from public.mensagens_de_compromisso where aviso = p_aviso
$$;
grant execute on function pg_temp.vez(int) to authenticated;
grant execute on function pg_temp.demanda(uuid) to authenticated;
grant execute on function pg_temp.avisos(text) to authenticated;

-- ---------- o dia em que a demanda nasce (os mesmos casos de app/src/regras/demandaDoCompromisso.test.ts) ----------
-- Dado um compromisso numa sexta-feira (15/03/2030), quando a demanda é de 3 dias antes, então nasce na terça (12/03), um dia útil
select is(privado.dia_da_demanda('e0000000-0000-0000-0000-000000000001', '2030-03-15', 3), '2030-03-12'::date, 'Dias corridos: 3 dias antes');
-- Dado um compromisso numa segunda (18/03/2030), quando a demanda é de 2 dias antes (sábado), então recua para a sexta
select is(privado.dia_da_demanda('e0000000-0000-0000-0000-000000000001', '2030-03-18', 2), '2030-03-15'::date, 'Fim de semana recua para a sexta');
-- Dado o feriado nacional de 15/11/2030 (sexta), quando a demanda cairia nele, então nasce na quinta
select is(privado.dia_da_demanda('e0000000-0000-0000-0000-000000000001', '2030-11-16', 1), '2030-11-14'::date, 'Feriado nacional recua para o dia útil anterior');
-- Dado um feriado que o escritório lançou no Calendário para todos os órgãos (12/03/2030), então ele também recua
insert into public.dias_sem_expediente (escritorio_id, data, motivo, tipo, criado_por) values
  ('e0000000-0000-0000-0000-000000000001', '2030-03-12', 'Feriado municipal', 'feriado', 'a0000000-0000-0000-0000-000000000001');
select is(privado.dia_da_demanda('e0000000-0000-0000-0000-000000000001', '2030-03-15', 3), '2030-03-11'::date, 'Feriado do escritório recua');
-- E o feriado de outro escritório não muda nada
select is(privado.dia_da_demanda('e0000000-0000-0000-0000-000000000002', '2030-03-15', 3), '2030-03-12'::date, 'O feriado de um escritório não vale no outro');
-- E a suspensão só de prazos (com expediente) não recua
insert into public.dias_sem_expediente (escritorio_id, data, motivo, tipo, criado_por) values
  ('e0000000-0000-0000-0000-000000000001', '2030-03-13', 'Suspensão de prazos', 'suspensao_com_expediente', 'a0000000-0000-0000-0000-000000000001');
select is(privado.dia_da_demanda('e0000000-0000-0000-0000-000000000001', '2030-03-16', 3), '2030-03-13'::date, 'Suspensão com expediente é dia útil');
-- E o título leva a data
select is(privado.titulo_da_demanda_do_compromisso('Reunião mensal', '2030-03-15'), 'Reunião mensal (15/03/2030)', 'O título com a data');
select is(length(privado.titulo_da_demanda_do_compromisso(repeat('a', 300), '2030-03-15')), 300, 'O título cabe na demanda');

-- ---------- gerar ----------
-- Dada uma reunião da Bia daqui a 5 dias, com o Caio, a P1 e ligada ao contrato K1, que se repete toda semana
select pg_temp.entrar(2); set local role authenticated;
insert into public.compromissos (id, tipo, titulo, data, hora, responsavel_id, participantes, pessoas, criado_por, etapa_id, etapa_ordem)
values ('7c000000-0000-0000-0000-000000000001', 'reuniao', 'Reunião semanal', pg_temp.hoje() + 5, '10:00', auth.uid(), '{a0000000-0000-0000-0000-000000000003}',
        '{10000000-0000-0000-0000-000000000001}', auth.uid(), pg_temp.coluna('compromissos', 'Agendado'), 1);
insert into public.compromisso_ligacoes (compromisso_id, contrato_id, criado_por) values ('7c000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', auth.uid());
select lives_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000001', 'semana', 1) $$, 'A reunião se repete toda semana');

-- Quando o Davi, de outro escritório, tenta marcá-la para gerar demanda, então não consegue
select pg_temp.entrar(4);
select throws_ok($$ select public.compromisso_gerar_demandas('7c000000-0000-0000-0000-000000000001', 7) $$, '42501', null, 'Outro escritório não marca');
-- E o compromisso que não se repete não gera demanda
select pg_temp.entrar(2);
insert into public.compromissos (id, tipo, titulo, data, hora, responsavel_id, criado_por)
values ('7c000000-0000-0000-0000-000000000009', 'reuniao', 'Avulsa', pg_temp.hoje() + 1, '09:00', auth.uid(), auth.uid());
select throws_ok($$ select public.compromisso_gerar_demandas('7c000000-0000-0000-0000-000000000009', 7) $$, 'P0001', 'Só o compromisso que se repete gera demanda.',
                 'Só a repetição gera demanda');
-- E mais de 365 dias antes é recusado
select throws_ok($$ select public.compromisso_gerar_demandas('7c000000-0000-0000-0000-000000000001', 366) $$, '23514', null, 'Até 365 dias antes');

-- Quando a Bia a marca para gerar demanda 7 dias antes
select is(cardinality(public.compromisso_gerar_demandas('7c000000-0000-0000-0000-000000000001', 7)), 1, 'Nasce a demanda da data que já está no prazo');
-- Então nasce a demanda da primeira data (faltam 5 dias), e não a da segunda (faltam 12)
select isnt((pg_temp.vez(0)).demanda_gerada_id, null, 'A primeira data gerou a demanda');
select is((pg_temp.vez(1)).demanda_gerada_id, null, 'A segunda ainda não');
-- E a demanda leva o título com a data, o prazo, o responsável, o Caio, a P1 e o contrato, na coluna de início
select is((pg_temp.demanda((pg_temp.vez(0)).demanda_gerada_id)).titulo, 'Reunião semanal (' || to_char(pg_temp.hoje() + 5, 'DD/MM/YYYY') || ')', 'O título com a data');
select is((pg_temp.demanda((pg_temp.vez(0)).demanda_gerada_id)).prazo, pg_temp.hoje() + 5, 'O prazo é a data do compromisso');
select is((pg_temp.demanda((pg_temp.vez(0)).demanda_gerada_id)).prazo_hora, '10:00'::time, 'E a hora');
select is((pg_temp.demanda((pg_temp.vez(0)).demanda_gerada_id)).responsavel_id, 'a0000000-0000-0000-0000-000000000002'::uuid, 'O responsável é o do compromisso');
select is((pg_temp.demanda((pg_temp.vez(0)).demanda_gerada_id)).colaboradores, '{a0000000-0000-0000-0000-000000000003}'::uuid[], 'Os participantes viram colaboradores');
select is((pg_temp.demanda((pg_temp.vez(0)).demanda_gerada_id)).clientes, '{10000000-0000-0000-0000-000000000001}'::uuid[], 'As pessoas viram clientes');
select is((pg_temp.demanda((pg_temp.vez(0)).demanda_gerada_id)).contrato_id, 'c0000000-0000-0000-0000-000000000001'::uuid, 'Ligada ao mesmo contrato');
select is((pg_temp.demanda((pg_temp.vez(0)).demanda_gerada_id)).etapa_id, pg_temp.coluna('demandas', 'Para fazer'), 'Na coluna de início');
-- E fica ligada ao compromisso
select is((select count(*) from public.compromisso_ligacoes where compromisso_id = (pg_temp.vez(0)).id and demanda_id = (pg_temp.vez(0)).demanda_gerada_id),
          1::bigint, 'A demanda fica ligada ao compromisso');
-- E a Bia, que marcou, não recebe aviso do que fez a si mesma
select is(pg_temp.avisos('demanda_nova'), 0::bigint, 'Quem marcou não é avisado da própria demanda');

-- Quando a rotina diária roda de novo (sem ninguém logado, como o pg_cron), então não nasce outra demanda para a mesma data
reset role;
select set_config('request.jwt.claims', '', true);
select is(privado.gerar_demandas_dos_compromissos(), 0, 'A rotina não gera em dobro');
-- E, a demanda excluída, a data não volta a gerar
create temp table primeira as select (pg_temp.vez(0)).demanda_gerada_id as id;
delete from public.demandas where id = (select id from primeira);
select is(privado.gerar_demandas_dos_compromissos(), 0, 'A demanda excluída não volta');

-- Quando chega o dia de nascer a da segunda data (simulado com hoje 7 dias à frente), então a rotina a cria e o responsável é avisado
select is(cardinality(privado.gerar_demandas_das_series(null, pg_temp.hoje() + 7)), 1, 'A rotina gera a da segunda data');
select isnt((pg_temp.vez(1)).demanda_gerada_id, null, 'A segunda data gerou a demanda');
select is(pg_temp.avisos('demanda_nova'), 1::bigint, 'A Bia recebe o aviso da demanda nova');
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.mensagens_de_compromisso where aviso = 'demanda_nova'), 1::bigint, 'A Bia lê o aviso');
select pg_temp.entrar(3);
select is((select count(*) from public.mensagens_de_compromisso), 0::bigint, 'O Caio não lê o aviso da Bia');
select pg_temp.entrar(4);
select is((select count(*) from public.mensagens_de_compromisso), 0::bigint, 'Outro escritório não lê');
select throws_ok($$ insert into public.mensagens_de_compromisso (escritorio_id, perfil_id, aviso, demanda_id)
                    values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'cancelado', gen_random_uuid()) $$,
                 '42501', null, 'Ninguém grava aviso direto');
-- E a data nova da série não copia a ligação com a demanda de outra data
reset role;
select is((select count(*) from public.compromisso_ligacoes l join public.compromissos c on c.id = l.compromisso_id
           where c.repeticao_id = (pg_temp.vez(0)).repeticao_id and l.demanda_id is not null and l.demanda_id <> c.demanda_gerada_id), 0::bigint,
          'Cada data só fica ligada à sua demanda');

-- ---------- a data muda ----------
-- Quando o Caio muda a data da segunda (que gerou demanda) um dia para a frente, "só esta"
select pg_temp.entrar(3); set local role authenticated;
create temp table segunda as select (pg_temp.vez(1)).id as id, (pg_temp.vez(1)).demanda_gerada_id as demanda, (pg_temp.vez(1)).data as data;
grant select on segunda to authenticated;
update public.compromissos set data = data + 1 where id = (select id from segunda);
-- Então o prazo e o título da demanda acompanham, e a Bia é avisada
select is((pg_temp.demanda((select demanda from segunda))).prazo, (select data from segunda) + 1, 'O prazo acompanha a data');
select is((pg_temp.demanda((select demanda from segunda))).titulo, 'Reunião semanal (' || to_char((select data from segunda) + 1, 'DD/MM/YYYY') || ')', 'O título acompanha');
select is(pg_temp.avisos('data_mudou'), 1::bigint, 'A Bia é avisada da data mudada');
-- Quando a Bia muda o prazo da demanda à mão e o Caio muda a data de novo, então o prazo mudado à mão fica
reset role;
update public.demandas set prazo = (select data from segunda) + 10 where id = (select demanda from segunda);
select pg_temp.entrar(3); set local role authenticated;
update public.compromissos set data = data + 1 where id = (select id from segunda);
select is((pg_temp.demanda((select demanda from segunda))).prazo, (select data from segunda) + 10, 'O prazo mudado à mão não muda');
select is(pg_temp.avisos('data_mudou'), 2::bigint, 'Mas a Bia é avisada');

-- ---------- cancelado ----------
-- Quando o Caio põe a segunda na coluna "Cancelado", então a demanda fica e a Bia é avisada
update public.compromissos set etapa_id = pg_temp.coluna('compromissos', 'Cancelado') where id = (select id from segunda);
select isnt(pg_temp.demanda((select demanda from segunda)), null, 'A demanda fica');
select is(pg_temp.avisos('cancelado'), 1::bigint, 'A Bia é avisada do cancelamento');
-- E a data cancelada não gera demanda (a terceira, cancelada antes de chegar o dia, fica sem)
update public.compromissos set etapa_id = pg_temp.coluna('compromissos', 'Cancelado') where id = (pg_temp.vez(2)).id;
reset role;
select is(cardinality(privado.gerar_demandas_das_series(null, pg_temp.hoje() + 14)), 0, 'A data cancelada não gera demanda');
-- E realizar a data não é cancelar: quem tem a demanda não é avisado
update public.compromissos set etapa_id = pg_temp.coluna('compromissos', 'Agendado') where id = (select id from segunda);
update public.compromissos set etapa_id = pg_temp.coluna('compromissos', 'Realizado') where id = (select id from segunda);
select is(pg_temp.avisos('cancelado'), 1::bigint, 'Realizado não avisa');
-- E arquivar a data ainda em aberto avisa como cancelada
update public.compromissos set etapa_id = pg_temp.coluna('compromissos', 'Agendado') where id = (select id from segunda);
update public.compromissos set arquivado_em = now() where id = (select id from segunda);
select is(pg_temp.avisos('cancelado'), 2::bigint, 'Arquivar sem realizar avisa');

-- ---------- o módulo e o responsável ----------
-- Dado o responsável que saiu da equipe, quando nasce a demanda, então quem criou a repetição fica com ela
update public.perfis set ativo = false where id = 'a0000000-0000-0000-0000-000000000002';
update public.compromisso_repeticoes set criado_por = 'a0000000-0000-0000-0000-000000000001' where id = (pg_temp.vez(0)).repeticao_id;
select is(cardinality(privado.gerar_demandas_das_series(null, pg_temp.hoje() + 21)), 1, 'A quarta data gera');
select is((pg_temp.demanda((pg_temp.vez(3)).demanda_gerada_id)).responsavel_id, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Quem criou a repetição fica com ela');
-- Dado o módulo Demandas desligado, então nada nasce
update public.escritorios set modulos = '{"pessoas": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select is(cardinality(privado.gerar_demandas_das_series(null, pg_temp.hoje() + 28)), 0, 'Sem o módulo Demandas, nada nasce');

-- ---------- a versão anterior do site ----------
-- Dado o site antigo, que grava compromissos sem as colunas novas, então continua gravando
select pg_temp.entrar(3); set local role authenticated;
select lives_ok($$ insert into public.compromissos (tipo, titulo, data, hora, responsavel_id, criado_por)
                   values ('reuniao', 'Do site antigo', current_date + 3, '08:00', auth.uid(), auth.uid()) $$, 'O site antigo grava como antes');

select * from finish();
rollback;
