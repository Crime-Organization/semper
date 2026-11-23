-- Compromissos que se repetem: só muda a série quem muda as datas dela; as datas e a demanda geradas não avisam de inclusão; o quadro
-- (#307, correções da revisão). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master), Bia e Caio (usuários comuns), com o módulo Demandas.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-repeticao-de-quem-muda', '{"pessoas": true, "demandas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now());

-- Uma tarefa da Bia (para ligar ao compromisso), gravada direto.
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
-- Lidos sem as regras, para conferir o que o banco gravou.
create function pg_temp.serie_de(p_id uuid) returns uuid language sql security definer as $$ select repeticao_id from public.compromissos where id = p_id $$;
create function pg_temp.vez(p_id uuid, p_n int) returns uuid language sql security definer as $$
  select id from public.compromissos where repeticao_id = pg_temp.serie_de(p_id) order by repeticao_data offset p_n limit 1
$$;
create function pg_temp.datas(p_id uuid) returns bigint language sql security definer as $$
  select count(*) from public.compromissos where repeticao_id = pg_temp.serie_de(p_id)
$$;
create function pg_temp.inclusoes(p_quem int, p_modulo text) returns bigint language sql security definer as $$
  select count(*) from public.mensagens_de_inclusao where perfil_id = ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid and modulo = p_modulo
$$;
grant execute on function pg_temp.serie_de(uuid) to authenticated;
grant execute on function pg_temp.vez(uuid, int) to authenticated;
create function pg_temp.ativas(p_id uuid) returns bigint language sql security definer as $$
  select count(*) from public.compromissos where repeticao_id = pg_temp.serie_de(p_id) and arquivado_em is null
$$;
grant execute on function pg_temp.datas(uuid) to authenticated;
grant execute on function pg_temp.ativas(uuid) to authenticated;
grant execute on function pg_temp.inclusoes(int, text) to authenticated;

-- ---------- o aviso de inclusão ----------
-- Dada uma reunião da Bia amanhã, com o Caio
select pg_temp.entrar(2); set local role authenticated;
insert into public.compromissos (id, tipo, titulo, data, hora, responsavel_id, participantes, criado_por, etapa_id, etapa_ordem)
values ('7c000000-0000-0000-0000-000000000001', 'reuniao', 'Reunião com o Caio', pg_temp.hoje() + 1, '10:00', auth.uid(),
        '{a0000000-0000-0000-0000-000000000003}', auth.uid(), pg_temp.coluna('Agendado'), 1);
select is(pg_temp.inclusoes(3, 'compromissos'), 1::bigint, 'O Caio recebe o aviso da reunião em que foi incluído');
insert into public.compromisso_ligacoes (compromisso_id, tarefa_id, criado_por) values ('7c000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', auth.uid());
-- Quando a Bia a faz se repetir toda semana, sem fim, e a marca para gerar demanda 7 dias antes
select lives_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000001', 'semana', 1) $$, 'A Bia faz a reunião se repetir');
select ok(pg_temp.datas('7c000000-0000-0000-0000-000000000001') > 50, 'Nascem as datas de 12 meses');
select ok(cardinality(public.compromisso_gerar_demandas('7c000000-0000-0000-0000-000000000001', 7)) >= 1, 'Nasce a demanda da primeira data');
-- Então o Caio continua com um aviso só (as datas que o banco cria não são inclusões novas), e ninguém recebe aviso de inclusão na demanda
select is(pg_temp.inclusoes(3, 'compromissos'), 1::bigint, 'As datas da série não avisam o Caio de novo');
select is(pg_temp.inclusoes(2, 'compromissos'), 0::bigint, 'Nem a Bia');
select is(pg_temp.inclusoes(2, 'demandas') + pg_temp.inclusoes(3, 'demandas'), 0::bigint, 'A demanda gerada não manda aviso de inclusão');
-- E quando a rotina diária roda sem ninguém logado (como o pg_cron), então também não avisa
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.compromissos where id = pg_temp.vez('7c000000-0000-0000-0000-000000000001', (pg_temp.datas('7c000000-0000-0000-0000-000000000001') - 1)::int);
update public.compromisso_repeticoes set gerada_ate = (select max(repeticao_data) from public.compromissos where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001'))
where id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001');
select ok(privado.estender_repeticoes() >= 1, 'A rotina refaz a data que faltava');
select is(pg_temp.inclusoes(2, 'compromissos') + pg_temp.inclusoes(3, 'compromissos'), 1::bigint, 'A rotina não avisa ninguém de inclusão');
-- E a data refeita é de quem criou a série, com a ligação à tarefa
select is((select criado_por from public.compromissos where id = pg_temp.vez('7c000000-0000-0000-0000-000000000001', (pg_temp.datas('7c000000-0000-0000-0000-000000000001') - 1)::int)),
          'a0000000-0000-0000-0000-000000000002'::uuid, 'A data da rotina é de quem criou a série');
select is((select count(*) from public.compromisso_ligacoes where tarefa_id = '70000000-0000-0000-0000-000000000001'
           and compromisso_id = pg_temp.vez('7c000000-0000-0000-0000-000000000001', (pg_temp.datas('7c000000-0000-0000-0000-000000000001') - 1)::int)), 1::bigint,
          'A data da rotina fica ligada à tarefa');

-- ---------- só muda a série quem muda as datas dela ----------
-- Dada uma reunião semanal da Bia, sem participantes, e o Caio posto só na terceira data
select pg_temp.entrar(2); set local role authenticated;
insert into public.compromissos (id, tipo, titulo, data, hora, responsavel_id, criado_por, etapa_id, etapa_ordem)
values ('7c000000-0000-0000-0000-000000000002', 'reuniao', 'Reunião da Bia', pg_temp.hoje() + 1, '09:00', auth.uid(), auth.uid(), pg_temp.coluna('Agendado'), 1);
select lives_ok($$ select public.compromisso_repetir('7c000000-0000-0000-0000-000000000002', 'semana', 1) $$, 'A Bia faz a reunião se repetir');
update public.compromissos set participantes = '{a0000000-0000-0000-0000-000000000003}' where id = pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2);
create temp table antes as select pg_temp.ativas('7c000000-0000-0000-0000-000000000002') as datas;
grant select on antes to authenticated;

-- Quando o Caio tenta arquivar, mudar o horário ou a data "desta e das seguintes", ou marcar a demanda, então é recusado
select pg_temp.entrar(3);
select throws_ok(format('select public.compromisso_arquivar_seguintes(%L)', pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2)), 'P0001',
                 'Há datas seguintes desta repetição que você não pode mudar. Mude só esta data ou peça a quem cuida da repetição.',
                 'Quem está numa data só não arquiva as seguintes');
select throws_ok(format('select public.compromisso_mudar_seguintes(%L, %L, %L)', pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2),
                        pg_temp.hoje() + 15, '15:00'), 'P0001', null, 'Nem muda o horário das seguintes');
select throws_ok(format('select public.compromisso_mudar_seguintes(%L, %L, %L)', pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2),
                        pg_temp.hoje() + 16, '15:00'), 'P0001', null, 'Nem muda a data das seguintes');
select throws_ok(format('select public.compromisso_gerar_demandas(%L, 7)', pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2)), 'P0001',
                 'Há datas desta repetição que você não pode mudar. Peça a quem cuida da repetição para marcar a demanda.',
                 'Nem marca a demanda da série');
-- Então a série continua inteira, sem fim, e sem demanda
select is(pg_temp.ativas('7c000000-0000-0000-0000-000000000002'), (select datas from antes), 'Nenhuma data foi arquivada');
select is((select ate from public.compromisso_repeticoes where id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000002')), null, 'A série continua sem fim');
select is((select demanda_dias_antes from public.compromisso_repeticoes where id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000002')), null,
          'A série continua sem demanda');
-- E ele muda só a data dele, como sempre
update public.compromissos set hora = '16:00' where id = pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2);
select is((select hora from public.compromissos where id = pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2)), '16:00'::time, 'Só esta muda');

-- Quando a última data em aberto é dele (as outras seguintes já foram realizadas), então ele muda as seguintes
-- (a data realizada não conta: ela não muda com "esta e as seguintes")
select pg_temp.entrar(2);
update public.compromissos set etapa_id = pg_temp.coluna('Realizado')
where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000002') and repeticao_data > (select repeticao_data from public.compromissos where id = pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2));
select pg_temp.entrar(3);
select lives_ok(format('select public.compromisso_mudar_seguintes(%L, %L, %L)', pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2),
                       (select data from public.compromissos where id = pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2)), '17:00'),
                'Sem datas seguintes em aberto de outros, ele muda as seguintes');
select pg_temp.entrar(2);
update public.compromissos set etapa_id = pg_temp.coluna('Agendado') where repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000002');

-- Quando a Bia (que muda todas) arquiva a partir da terceira, então a série termina na véspera
select ok(public.compromisso_arquivar_seguintes(pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2)) > 1, 'A Bia arquiva as seguintes');
select is((select ate from public.compromisso_repeticoes where id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000002')),
          (select repeticao_data - 1 from public.compromissos where id = pg_temp.vez('7c000000-0000-0000-0000-000000000002', 2)), 'A série termina na véspera');
-- E a Ana, administradora, marca a demanda de uma série de outra pessoa
select pg_temp.entrar(1);
select lives_ok($$ select public.compromisso_gerar_demandas('7c000000-0000-0000-0000-000000000002', 7) $$, 'A administradora marca a demanda');

-- ---------- o quadro ----------
-- Dada a série da reunião com o Caio, quando a primeira é cancelada e a segunda realizada, então nenhuma das duas está no quadro e a
-- terceira está; a arquivada aparece sempre (entre as arquivadas)
select pg_temp.entrar(2);
update public.compromissos set etapa_id = pg_temp.coluna('Cancelado') where id = '7c000000-0000-0000-0000-000000000001';
update public.compromissos set etapa_id = pg_temp.coluna('Realizado') where id = pg_temp.vez('7c000000-0000-0000-0000-000000000001', 1);
select is((select array_agg(c.id) from public.compromissos c where c.repeticao_id = pg_temp.serie_de('7c000000-0000-0000-0000-000000000001') and public.no_quadro(c)),
          array[pg_temp.vez('7c000000-0000-0000-0000-000000000001', 2)], 'Cancelada e realizada saem; a próxima em aberto entra');
update public.compromissos set arquivado_em = now() where id = pg_temp.vez('7c000000-0000-0000-0000-000000000001', 4);
select ok((select public.no_quadro(c) from public.compromissos c where c.id = pg_temp.vez('7c000000-0000-0000-0000-000000000001', 4)), 'A arquivada aparece');

select * from finish();
rollback;
