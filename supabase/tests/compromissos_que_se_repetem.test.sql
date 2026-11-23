-- Compromissos que se repetem (#307, parte A). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
-- As datas das séries partem de hoje (privado.hoje_da_agenda), porque as datas viram compromissos de hoje até 12 meses adiante.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------- a conta das datas (os mesmos casos de app/src/regras/repeticao.test.ts) ----------
-- Dada uma repetição mensal no dia 31, quando se contam as datas, então cada uma cai no dia 31 ou no último dia do mês mais curto
select is(privado.data_da_vez('2026-01-31', 'mes', 1, 1), '2026-02-28'::date, 'Dia 31 + 1 mês cai em 28/02');
select is(privado.data_da_vez('2026-01-31', 'mes', 1, 2), '2026-03-31'::date, 'A conta parte da primeira data: em março volta ao dia 31');
select is(privado.data_da_vez('2026-01-31', 'mes', 1, 3), '2026-04-30'::date, 'Em abril cai no dia 30');
select is(privado.data_da_vez('2024-01-31', 'mes', 1, 1), '2024-02-29'::date, 'No ano bissexto, cai em 29/02');
-- Dada uma repetição anual em 29/02, então cai em 28/02 nos anos que não são bissextos e volta a 29/02 no bissexto
select is(privado.data_da_vez('2024-02-29', 'ano', 1, 1), '2025-02-28'::date, '29/02 + 1 ano cai em 28/02');
select is(privado.data_da_vez('2024-02-29', 'ano', 1, 4), '2028-02-29'::date, '29/02 + 4 anos volta a 29/02');
-- Dadas as outras frequências, então a semana soma 7 dias e o "a cada 10 anos" soma 10 anos
select is(privado.data_da_vez('2026-11-22', 'semana', 2, 1), '2026-12-06'::date, 'A cada 2 semanas soma 14 dias');
select is(privado.data_da_vez('2026-03-15', 'ano', 10, 1), '2036-03-15'::date, 'A cada 10 anos (renovação de marca)');

-- Dada uma série (frequencia, intervalo, inicio, ate, vezes, gerada_ate), quando se pedem as datas a gerar num dia, então vêm as do horizonte
create function pg_temp.serie(p_freq text, p_intervalo int, p_inicio date, p_ate date, p_vezes int, p_gerada date) returns public.compromisso_repeticoes
language sql as $$ select row(gen_random_uuid(), null, p_freq, p_intervalo, p_inicio, p_ate, p_vezes, p_gerada, null, now(), now())::public.compromisso_repeticoes $$;
select is((select count(*) from privado.vezes_para_gerar(pg_temp.serie('mes', 1, '2026-01-31', null, null, '2026-01-31'), '2026-01-31')), 12::bigint,
          'Todo mês, sem fim: as 12 datas seguintes, até 12 meses adiante');
select is((select array_agg(data order by n) from privado.vezes_para_gerar(pg_temp.serie('ano', 10, '2026-03-15', null, null, '2026-03-15'), '2026-03-15')),
          '{2036-03-15}'::date[], 'A cada 10 anos: sempre pelo menos a próxima, mesmo depois do horizonte');
select is((select count(*) from privado.vezes_para_gerar(pg_temp.serie('semana', 1, '2026-02-01', null, 3, '2026-02-01'), '2026-02-01')), 2::bigint,
          'Depois de 3 vezes: mais duas, contando a primeira');
select is((select array_agg(data order by n) from privado.vezes_para_gerar(pg_temp.serie('semana', 1, '2026-02-01', '2026-02-20', null, '2026-02-01'), '2026-02-01')),
          '{2026-02-08,2026-02-15}'::date[], 'Até uma data: nenhuma passa dela');
select is((select array_agg(data order by n) from privado.vezes_para_gerar(pg_temp.serie('ano', 1, '2024-05-10', null, null, '2024-05-10'), '2026-01-10')),
          '{2026-05-10}'::date[], 'As datas que já passaram não viram compromisso');

-- ---------- o escritório ----------
-- Dado um escritório com Ana (master), Bia e Caio (usuários comuns), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-repeticoes', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-repeticoes-2', '{"pessoas": true}');
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
-- A sala 1 e uma tarefa da Bia (para ligar ao compromisso), gravadas direto.
insert into public.salas (id, escritorio_id, nome, capacidade) values ('5a000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Sala 1', 6);
set local session_replication_role = replica;
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Tarefa 1', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002');
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.coluna(p_nome text) returns uuid language sql as $$
  select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'compromissos' and nome = p_nome
$$;
grant execute on function pg_temp.coluna(text) to authenticated;
create function pg_temp.hoje() returns date language sql as $$ select privado.hoje_da_agenda() $$;
grant execute on function pg_temp.hoje() to authenticated;
-- A série do compromisso e as datas dela, em ordem (lidas sem as regras, para conferir o que o banco gravou).
create function pg_temp.serie_de(p_id uuid) returns uuid language sql security definer as $$ select repeticao_id from public.compromissos where id = p_id $$;
create function pg_temp.vez(p_serie uuid, p_n int) returns uuid language sql security definer as $$
  select id from public.compromissos where repeticao_id = p_serie order by repeticao_data offset p_n limit 1
$$;
grant execute on function pg_temp.serie_de(uuid) to authenticated;
grant execute on function pg_temp.vez(uuid, int) to authenticated;

-- ---------- repetir ----------
-- Dada uma reunião da Bia amanhã às 10h, com o Caio, na sala 1, ligada à tarefa T1
select pg_temp.entrar(2); set local role authenticated;
insert into public.compromissos (id, tipo, titulo, data, hora, hora_fim, responsavel_id, participantes, criado_por, sala_id, etapa_id, etapa_ordem)
values ('7c000000-0000-0000-0000-000000000001', 'reuniao', 'Reunião semanal', pg_temp.hoje() + 1, '10:00', '11:00', auth.uid(),
        '{a0000000-0000-0000-0000-000000000003}', auth.uid(), '5a000000-0000-0000-0000-000000000001', pg_temp.coluna('Agendado'), 1);
insert into public.compromisso_ligacoes (compromisso_id, tarefa_id, criado_por) values ('7c000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', auth.uid());
-- E outro compromisso da Bia na sala 1, no mesmo horário, daqui a 8 dias (a segunda data da repetição)
insert into public.compromissos (tipo, titulo, data, hora, responsavel_id, criado_por, sala_id)
values ('reuniao', 'Ocupa a sala', pg_temp.hoje() + 8, '10:30', auth.uid(), auth.uid(), '5a000000-0000-0000-0000-000000000001');

-- Quando o Davi, de outro escritório, tenta fazê-la se repetir, então não consegue
select pg_temp.entrar(4);
select throws_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000001', 'semana', 1) $$, '42501', null, 'Outro escritório não repete o compromisso');

-- Quando a Bia a faz se repetir toda semana, sem fim
select pg_temp.entrar(2);
select lives_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000001', 'semana', 1) $$, 'A Bia faz a reunião se repetir toda semana');
-- Então as datas até 12 meses adiante viram compromissos, uma por semana, contadas da primeira
select ok((select count(*) from public.compromissos where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001')) between 52 and 54,
          'Uma data por semana, por 12 meses');
select is((select count(*) from public.compromissos c, public.compromisso_repeticoes r
           where c.repeticao_id = r.id and r.id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001')
             and c.data <> privado.data_da_vez(r.inicio, r.frequencia, r.intervalo, ((c.repeticao_data - r.inicio) / 7)::int)), 0::bigint,
          'Cada data é a da regra');
select ok((select max(data) from public.compromissos where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'))
          <= (pg_temp.hoje() + interval '12 months')::date, 'Nenhuma passa do horizonte');
-- E cada data copia o compromisso: o título, o horário, o Caio, a tarefa ligada, na coluna de início
select is((select count(*) from public.compromissos where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001')
           and titulo = 'Reunião semanal' and hora = '10:00' and participantes = '{a0000000-0000-0000-0000-000000000003}' and etapa_id = pg_temp.coluna('Agendado')),
          (select count(*) from public.compromissos where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001')), 'Cada data copia o compromisso');
select is((select count(*) from public.compromisso_ligacoes l join public.compromissos c on c.id = l.compromisso_id
           where c.repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001') and l.tarefa_id = '70000000-0000-0000-0000-000000000001'),
          (select count(*) from public.compromissos where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001')), 'Cada data fica ligada à tarefa');
-- E a data em que a sala estava ocupada fica sem sala; as outras ficam com ela
select is((select sala_id from public.compromissos where id = pg_temp.vez(pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), 1)), null, 'A data com a sala ocupada fica sem sala');
select is((select sala_id from public.compromissos where id = pg_temp.vez(pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), 2)),
          '5a000000-0000-0000-0000-000000000001'::uuid, 'As outras datas ficam com a sala');
-- E quem entra na série (o Caio) a vê; o Davi, de outro escritório, não
select pg_temp.entrar(3);
select is((select count(*) from public.compromisso_repeticoes), 1::bigint, 'O participante vê a série');
select pg_temp.entrar(4);
select is((select count(*) from public.compromisso_repeticoes), 0::bigint, 'Outro escritório não vê a série');
select is((select count(*) from public.compromissos where titulo = 'Reunião semanal'), 0::bigint, 'Outro escritório não vê as datas');

-- Quando a Bia tenta repetir de novo, ou gravar uma série direto, então não consegue
select pg_temp.entrar(2);
select throws_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000001', 'mes', 1) $$, 'P0001', 'Este compromisso já se repete.', 'Uma série por compromisso');
select throws_ok($$ insert into public.compromisso_repeticoes (frequencia, intervalo, inicio, gerada_ate) values ('mes', 1, current_date, current_date) $$,
                 '42501', null, 'Ninguém grava a série direto');
-- E quando a data final vem antes da data do compromisso, ou o intervalo passa do máximo, então é recusado
insert into public.compromissos (id, tipo, titulo, data, hora, responsavel_id, criado_por)
values ('7c000000-0000-0000-0000-000000000002', 'reuniao', 'Mensal', pg_temp.hoje() + 1, '09:00', auth.uid(), auth.uid());
select throws_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000002', 'mes', 1, pg_temp.hoje()) $$, 'P0001',
                 'A data final precisa ser depois da data do compromisso.', 'A data final vem depois da primeira');
select throws_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000002', 'mes', 100) $$, '23514', null, 'O intervalo vai até 99');
-- E repetir até uma data cria só as datas até ela
select lives_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000002', 'mes', 1, (pg_temp.hoje() + 1 + interval '3 months')::date) $$, 'Repete por 3 meses');
select is((select count(*) from public.compromissos where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000002')), 4::bigint, 'A primeira e mais três');

-- ---------- quadro e tabela ----------
-- Dada a série semanal, então o quadro e a tabela mostram só a próxima em aberto (a primeira)
select is((select array_agg(id) from public.compromissos c where c.repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001') and public.no_quadro(c)),
          array['7c000000-0000-0000-0000-000000000001'::uuid], 'Só a próxima aparece no quadro');
-- Quando a primeira é realizada, então a próxima passa a ser a segunda
update public.compromissos set etapa_id = pg_temp.coluna('Realizado') where id = '7c000000-0000-0000-0000-000000000001';
select is((select array_agg(id) from public.compromissos c where c.repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001') and public.no_quadro(c)),
          array[pg_temp.vez(pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), 1)], 'Realizada a primeira, aparece a segunda');
select ok((select public.no_quadro(c) from public.compromissos c where c.titulo = 'Ocupa a sala'), 'O compromisso que não se repete aparece sempre');

-- ---------- só esta, esta e as seguintes ----------
-- Quando a Bia muda o horário da terceira data em diante, então a terceira e as seguintes mudam; a segunda, não
select lives_ok(format('select public.compromisso_mudar_seguintes(%L, %L, %L, %L)', pg_temp.vez(pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), 2),
                       pg_temp.hoje() + 15, '15:00', '16:00'), 'Muda o horário desta e das seguintes');
select is((select hora from public.compromissos where id = pg_temp.vez(pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), 1)), '10:00'::time, 'A anterior não muda');
select is((select count(*) from public.compromissos where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001') and repeticao_data >= pg_temp.hoje() + 15 and hora <> '15:00'),
          0::bigint, 'Esta e as seguintes passam para as 15h');
-- Quando a Bia muda a data da quarta para um dia depois, "esta e as seguintes", então a série recomeça dali: a antiga termina na
-- véspera, e esta e as seguintes andam um dia, toda semana, sem repetir data
select lives_ok(format('select public.compromisso_mudar_seguintes(%L, %L, %L, %L)', pg_temp.vez(pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), 3),
                       pg_temp.hoje() + 23, '15:00', '16:00'), 'Muda a data desta e das seguintes');
select is((select count(*) from public.compromissos where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001')), 3::bigint, 'A série antiga fica com as três primeiras');
select is((select ate from public.compromisso_repeticoes where id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001')), pg_temp.hoje() + 21, 'A série antiga termina na véspera');
select is((select array_agg(data order by data) from (select data from public.compromissos c where c.titulo = 'Reunião semanal' and c.repeticao_id <> pg_temp.serie_de('7c000000-0000-0000-0000-000000000001')
           order by data limit 3) x), array[pg_temp.hoje() + 23, pg_temp.hoje() + 30, pg_temp.hoje() + 37], 'Esta e as seguintes andam um dia, toda semana');
select is((select count(distinct data) = count(*) from public.compromissos where titulo = 'Reunião semanal'), true, 'Nenhuma data se repete');
select is((select count(distinct repeticao_id) from public.compromissos where titulo = 'Reunião semanal'), 2::bigint, 'São duas séries');
-- Quando o Caio (participante) muda só esta, então é o compromisso de sempre: só ele muda
select pg_temp.entrar(3);
update public.compromissos set data = data + 2 where id = pg_temp.vez(pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), 2);
select is((select data from public.compromissos where id = pg_temp.vez(pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), 2)), pg_temp.hoje() + 17, 'Só esta muda');
-- E o Davi, de outro escritório, não muda as seguintes
select pg_temp.entrar(4);
select throws_ok(format('select public.compromisso_mudar_seguintes(%L, %L)', pg_temp.vez(pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'), 1), pg_temp.hoje() + 9),
                 '42501', null, 'Outro escritório não muda as seguintes');

-- ---------- arquivar esta e as seguintes ----------
-- Quando a Bia arquiva a quinta data da série nova em diante, então elas saem e a série para de se repetir
select pg_temp.entrar(2);
create temp table nova as select pg_temp.serie_de(id) as id from public.compromissos where titulo = 'Reunião semanal' and data = pg_temp.hoje() + 23;
grant select on nova to authenticated;
select ok(public.compromisso_arquivar_seguintes(pg_temp.vez((select id from nova), 4)) > 1, 'Arquiva esta e as seguintes');
select is((select count(*) from public.compromissos where repeticao_id = (select id from nova) and arquivado_em is null), 4::bigint, 'As quatro anteriores continuam');
reset role;
select is(privado.estender_repeticoes() >= 0, true, 'A rotina diária roda');
select is((select count(*) from public.compromissos where repeticao_id = (select id from nova) and arquivado_em is null), 4::bigint, 'A série arquivada não volta a crescer');

-- ---------- a rotina diária ----------
-- Dada a série mensal até 3 meses, quando a última data some e a série volta a dizer que gerou só até a anterior, então a rotina a refaz
create temp table mensal as select pg_temp.serie_de('7c000000-0000-0000-0000-000000000002') as id;
delete from public.compromissos where id = pg_temp.vez((select id from mensal), 3);
update public.compromisso_repeticoes set gerada_ate = (select max(repeticao_data) from public.compromissos where repeticao_id = (select id from mensal)) where id = (select id from mensal);
select ok(privado.estender_repeticoes() >= 1, 'A rotina acrescenta a data que faltava');
select is((select count(*) from public.compromissos where repeticao_id = (select id from mensal)), 4::bigint, 'A série volta a ter as quatro datas');
-- Quando o dia passa da última data de uma série sem fim, então a rotina acrescenta a próxima (simulado com o dia de amanhã de um ano)
select ok(jsonb_array_length(privado.gerar_repeticoes(pg_temp.serie_de('7c000000-0000-0000-0000-000000000002'), (pg_temp.hoje() + interval '1 year')::date) -> 'ids') = 0,
          'Com data final, nada passa dela');

select * from finish();
rollback;
