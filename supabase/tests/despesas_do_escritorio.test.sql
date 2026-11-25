-- Despesas do escritório a pagar, com vencimento e repetição (#439). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum), e o Davi (master) em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-despesas', '{"financeiro": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-despesas-2', '{"financeiro": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now());

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
-- O vencimento a N dias de hoje (no relógio de Brasília, como a rotina).
create function pg_temp.dia(p_n int) returns date language sql as $$ select privado.hoje_da_agenda() + p_n $$;
grant execute on function pg_temp.dia(int) to authenticated;
create temp table ids (nome text, id uuid);
grant all on ids to authenticated;

-- ---------- cadastrar ----------
-- Quando a Ana cadastra uma despesa sem repetição, então ela fica no escritório dela, com a descrição limpa
select pg_temp.entrar(1); set local role authenticated;
insert into ids select 'avulsa', (public.financeiro_despesa_criar('  Conta de luz ', 25000, pg_temp.dia(3)) ->> 'id')::uuid;
select is((select descricao from public.financeiro_despesas where id = (select id from ids where nome = 'avulsa')), 'Conta de luz', 'A descrição fica sem espaços nas pontas');
select is((select escritorio_id from public.financeiro_despesas where id = (select id from ids where nome = 'avulsa')), 'e0000000-0000-0000-0000-000000000001'::uuid, 'A despesa é do escritório de quem cadastra');
select is((select repeticao_id from public.financeiro_despesas where id = (select id from ids where nome = 'avulsa')), null, 'Sem repetição, não há série');

-- Quando cadastra uma despesa de todo mês, três vezes, então nascem as três datas, com a mesma descrição e o mesmo valor
insert into ids select 'salario', (public.financeiro_despesa_criar('Salário', 300000, pg_temp.dia(5), 'mes', 1, null, 3) ->> 'id')::uuid;
select results_eq($$ select vencimento, descricao, valor from public.financeiro_despesas
                     where repeticao_id = (select repeticao_id from public.financeiro_despesas where id = (select id from ids where nome = 'salario')) order by vencimento $$,
  $$ values (pg_temp.dia(5), 'Salário', 300000::bigint), ((pg_temp.dia(5) + interval '1 month')::date, 'Salário', 300000::bigint),
            ((pg_temp.dia(5) + interval '2 months')::date, 'Salário', 300000::bigint) $$,
  'As próximas datas nascem sozinhas, até o número de vezes');
select results_eq($$ select acao from public.auditoria where tabela = 'financeiro_despesas' and registro_id = (select id from ids where nome = 'salario')::text $$,
  $$ values ('inclusao') $$, 'No registro de ações, a despesa com repetição entra só como inclusão, como no banco fictício');

-- Quando cadastra uma de todo mês, sem fim, então nascem as datas dos próximos 12 meses
insert into ids select 'das', (public.financeiro_despesa_criar('DAS', 90000, pg_temp.dia(5), 'mes') ->> 'id')::uuid;
select is((select count(*)::int from public.financeiro_despesas where descricao = 'DAS'), 12, 'Sem fim: nascem as datas até 12 meses adiante');

-- Quando a rotina diária roda de novo, então nada se repete
reset role;
select is(privado.estender_despesas(), 0, 'A rotina não cria de novo o que já nasceu');
-- E a série que já gerou todas as vezes não é percorrida de novo; a sem fim, sim
select ok(not exists (select 1 from privado.repeticoes_de_despesa_a_estender(privado.hoje_da_agenda()) as r(id)
                      where id = (select repeticao_id from public.financeiro_despesas where id = (select id from ids where nome = 'salario'))),
  'A série que já gerou todas as vezes fica fora da rotina');
select ok(exists (select 1 from privado.repeticoes_de_despesa_a_estender(privado.hoje_da_agenda()) as r(id)
                  where id = (select repeticao_id from public.financeiro_despesas where id = (select id from ids where nome = 'das'))),
  'A série sem fim continua na rotina');
select pg_temp.entrar(1); set local role authenticated;

-- Quando o valor está zerado ou a data final vem antes do vencimento, então é recusado
select throws_ok($$ select public.financeiro_despesa_criar('Água', 0, pg_temp.dia(3)) $$, '23514', null, 'Valor zerado é recusado');
select throws_ok($$ select public.financeiro_despesa_criar('Água', 100, pg_temp.dia(3), 'mes', 1, pg_temp.dia(2)) $$, 'P0001',
  'A data final precisa ser depois do vencimento.', 'A data final vem depois do vencimento');
-- Quando tenta gravar direto na tabela, então é recusado
select throws_ok($$ insert into public.financeiro_despesas (descricao, valor, vencimento) values ('Direto', 100, pg_temp.dia(1)) $$, '42501', null,
  'Ninguém grava direto nas despesas');

-- ---------- pagar ----------
-- Quando muda a despesa sem mudar nada, então o registro de ações não ganha uma alteração
select is(public.financeiro_despesa_mudar((select id from ids where nome = 'avulsa'), 'Conta de luz', 25000, pg_temp.dia(3)), 1, 'Mudar sem mudar nada');
select is((select count(*)::int from public.auditoria where tabela = 'financeiro_despesas' and registro_id = (select id from ids where nome = 'avulsa')::text and acao = 'alteracao'), 0,
  'Mudar sem mudar nada não entra no registro de ações');
-- Quando paga sem o dia do pagamento, então é recusado e a despesa continua a pagar
select throws_ok($$ select public.financeiro_despesa_pagar((select id from ids where nome = 'salario'), null) $$, '23514', null, 'Pagar sem o dia é recusado');
select is((select paga_em from public.financeiro_despesas where id = (select id from ids where nome = 'salario')), null, 'Sem o dia, continua a pagar');
-- Quando a Ana marca a primeira do salário como paga, então ela fica paga e a próxima continua a pagar
select lives_ok($$ select public.financeiro_despesa_pagar((select id from ids where nome = 'salario'), pg_temp.dia(4)) $$, 'A administradora marca como paga');
select is((select paga_em from public.financeiro_despesas where id = (select id from ids where nome = 'salario')), pg_temp.dia(4), 'A despesa fica paga no dia informado');
select is((select paga_em from public.financeiro_despesas where descricao = 'Salário' and vencimento = (pg_temp.dia(5) + interval '1 month')::date), null,
  'A próxima da repetição continua a pagar');
select throws_ok($$ select public.financeiro_despesa_pagar((select id from ids where nome = 'salario'), pg_temp.dia(4)) $$, 'P0001', 'Esta despesa já foi paga.',
  'Não se paga duas vezes');
select ok((select alteracoes ? 'paga_em' from public.financeiro_despesas_historico where despesa_id = (select id from ids where nome = 'salario') order by em desc, id desc limit 1),
  'O pagamento fica no histórico da despesa');
select ok(exists (select 1 from public.auditoria where tabela = 'financeiro_despesas' and registro_id = (select id from ids where nome = 'salario')::text and acao = 'alteracao'),
  'O pagamento fica no registro de ações');

-- ---------- mudar ----------
-- Quando muda o valor da primeira "e das seguintes", então a paga fica como estava e só as seguintes a pagar mudam
select lives_ok($$ select public.financeiro_despesa_desfazer_pagamento((select id from ids where nome = 'salario')) $$, 'Desfazer o pagamento');
select is((select paga_em from public.financeiro_despesas where id = (select id from ids where nome = 'salario')), null, 'Desfeito, volta a pagar');
select public.financeiro_despesa_pagar((select id from ids where nome = 'salario'), pg_temp.dia(4));
select is(public.financeiro_despesa_mudar((select id from ids where nome = 'salario'), 'Salário', 320000, pg_temp.dia(5), true), 3, 'Muda esta e as duas seguintes');
select results_eq($$ select valor from public.financeiro_despesas where descricao = 'Salário' order by vencimento $$,
  $$ values (320000::bigint), (320000::bigint), (320000::bigint) $$, 'O valor novo vale nesta e nas seguintes');
select ok((select alteracoes -> 'valor' = '{"de": 300000, "para": 320000}'::jsonb from public.financeiro_despesas_historico
           where despesa_id = (select id from ids where nome = 'salario') and alteracoes ? 'valor'), 'O histórico guarda o valor de antes e o de depois');
-- Quando muda só uma das seguintes, então as outras ficam como estavam
select is(public.financeiro_despesa_mudar((select id from public.financeiro_despesas where descricao = 'Salário' order by vencimento offset 1 limit 1), 'Salário e férias', 450000,
  (pg_temp.dia(5) + interval '1 month')::date), 1, 'Muda só esta');
select results_eq($$ select descricao from public.financeiro_despesas where descricao like 'Salário%' order by vencimento $$,
  $$ values ('Salário'), ('Salário e férias'), ('Salário') $$, 'Só a data escolhida mudou');

-- ---------- excluir e restaurar ----------
-- Quando exclui a segunda do DAS "e as seguintes", então só a primeira fica, e a repetição para
insert into ids select 'das-2', (select id from public.financeiro_despesas where descricao = 'DAS' order by vencimento offset 1 limit 1);
insert into ids select 'saiu', unnest(public.financeiro_despesa_excluir((select id from ids where nome = 'das-2'), true));
select is((select count(*)::int from public.financeiro_despesas where descricao = 'DAS' and excluida_em is null), 1, 'Fica só a primeira do DAS');
select isnt((select parada_em from public.financeiro_despesa_repeticoes where id = (select repeticao_id from public.financeiro_despesas where id = (select id from ids where nome = 'das'))),
  null, 'A repetição parou');
reset role;
select is(privado.estender_despesas(), 0, 'A repetição parada não cresce');
select pg_temp.entrar(1); set local role authenticated;
-- Quando desfaz a exclusão, então as datas voltam e a repetição volta a andar
select lives_ok($$ select public.financeiro_despesa_restaurar(array(select id from ids where nome in ('saiu'))) $$, 'Desfazer a exclusão');
select is((select count(*)::int from public.financeiro_despesas where descricao = 'DAS' and excluida_em is null), 12, 'As datas do DAS voltaram');
select is((select parada_em from public.financeiro_despesa_repeticoes where id = (select repeticao_id from public.financeiro_despesas where id = (select id from ids where nome = 'das'))),
  null, 'A repetição volta a andar');
-- Quando exclui só uma, então as outras ficam
select is(cardinality(public.financeiro_despesa_excluir((select id from ids where nome = 'avulsa'))), 1, 'Exclui só esta');
select throws_ok($$ select public.financeiro_despesa_pagar((select id from ids where nome = 'avulsa'), pg_temp.dia(1)) $$, 'P0001', 'Despesa não encontrada neste escritório.',
  'A excluída não se paga');

-- ---------- o período ----------
-- Quando lê o mês do segundo salário, então vêm as dele e as a pagar que venceram antes (nenhuma aqui, pois a primeira foi paga)
select results_eq($$ select descricao from public.financeiro_despesas_do_periodo(date_trunc('month', pg_temp.dia(5) + interval '1 month')::date,
                     (date_trunc('month', pg_temp.dia(5) + interval '1 month') + interval '1 month - 1 day')::date) where descricao like 'Salário%' $$,
  $$ values ('Salário e férias') $$, 'O período traz as despesas que vencem nele');
select is((select frequencia from public.financeiro_despesas_do_periodo(pg_temp.dia(0), pg_temp.dia(400)) where id = (select id from ids where nome = 'das')), 'mes',
  'A despesa vem com a repetição');
-- Quando lê um período adiante, então a primeira do DAS, a pagar e já vencida para ele, aparece também
select ok(exists (select 1 from public.financeiro_despesas_do_periodo(pg_temp.dia(380), pg_temp.dia(400)) where id = (select id from ids where nome = 'das')),
  'A pagar de antes do período aparece');
select ok(not exists (select 1 from public.financeiro_despesas_do_periodo(pg_temp.dia(380), pg_temp.dia(400)) where id = (select id from ids where nome = 'salario')),
  'A paga de antes do período não aparece');

-- ---------- quem pode ----------
-- Quando a Bia (não é administradora) abre, então não vê as despesas, nem cadastra, nem paga
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*)::int from public.financeiro_despesas), 0, 'Quem não é administrador não vê as despesas');
select is((select count(*)::int from public.financeiro_despesas_do_periodo(pg_temp.dia(-400), pg_temp.dia(400))), 0, 'Nem pelo período');
select is((select count(*)::int from public.financeiro_despesas_historico), 0, 'Nem o histórico');
select throws_ok($$ select public.financeiro_despesa_criar('Aluguel', 100, pg_temp.dia(1)) $$, '42501', 'Só um administrador mexe nas despesas do escritório.',
  'Quem não é administrador não cadastra');
select throws_ok($$ select public.financeiro_despesa_pagar((select id from ids where nome = 'das'), pg_temp.dia(1)) $$, '42501', null, 'Quem não é administrador não paga');

-- Quando o Davi, administrador de outro escritório, abre e cadastra, então vê só as dele e não mexe nas da Ana
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*)::int from public.financeiro_despesas), 0, 'Outro escritório não vê as despesas');
select lives_ok($$ select public.financeiro_despesa_criar('Aluguel', 150000, pg_temp.dia(2)) $$, 'O outro escritório cadastra as suas');
select results_eq($$ select descricao from public.financeiro_despesas $$, $$ values ('Aluguel') $$, 'E vê só as suas');
select throws_ok($$ select public.financeiro_despesa_pagar((select id from ids where nome = 'das'), pg_temp.dia(1)) $$, 'P0001', 'Despesa não encontrada neste escritório.',
  'Não paga a despesa de outro escritório');
select throws_ok($$ select public.financeiro_despesa_excluir((select id from ids where nome = 'das')) $$, 'P0001', 'Despesa não encontrada neste escritório.',
  'Não exclui a despesa de outro escritório');
select lives_ok($$ select public.financeiro_despesa_restaurar(array(select id from ids where nome = 'avulsa')) $$, 'Restaurar a de outro escritório não falha...');
reset role;
select isnt((select excluida_em from public.financeiro_despesas where id = (select id from ids where nome = 'avulsa')), null, '...mas não devolve nada');
select is((select escritorio_id from public.financeiro_despesas where descricao = 'Aluguel'), 'e0000000-0000-0000-0000-000000000002'::uuid, 'A despesa do Davi é do escritório dele');

select * from finish();
rollback;
