-- Quem vê cada contrato (#107). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com o master, dois advogados comuns (Beto e Clara) e uma estagiária (Dora), mais o administrador de outro escritório.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-visibilidade'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-visibilidade-outro');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'mestre@exemplo.test', 'Mestre', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'clara@exemplo.test', 'Clara', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'dora@exemplo.test', 'Dora', 'usuario', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'outro@exemplo.test', 'Outro', 'master', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mestre@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'beto@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'clara@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'dora@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'outro@exemplo.test', '{"convite":"c5"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now(), now()),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), now()),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now(), now()),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', now(), now()),
  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', now(), now());

-- Cada um da equipe tem o cadastro em Pessoas, com o CPF que dá a sigla do contrato. Só esta ligação pula os gatilhos.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, documento, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'pf', 'MESTRE', '11111111111', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'pf', 'BETO', '22222222222', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'P3', 'pf', 'CLARA', '33333333333', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'P4', 'pf', 'DORA', '44444444444', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', null, 'a0000000-0000-0000-0000-000000000001');
update public.perfis set pessoa_id = ('10000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid, funcao = 'advogado'
  where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003');
update public.perfis set pessoa_id = '10000000-0000-0000-0000-000000000004', funcao = 'estagiario' where id = 'a0000000-0000-0000-0000-000000000004';
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

-- O token que o login emitiria para cada conta (a sessão tem o mesmo final do usuário).
create function pg_temp.entrar(p_final text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', 'a0000000-0000-0000-0000-00000000000' || p_final, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_final)::text, true);
end $$;
-- Quantos contratos de exemplo a conta lê e se ela lê um deles.
create function pg_temp.lidos() returns bigint language sql as $$ select count(*) from public.contratos where id::text like 'c0000000-%' $$;
create function pg_temp.le(p_contrato uuid) returns bigint language sql as $$ select count(*) from public.contratos where id = p_contrato $$;
-- Uma alteração sem filtro não passa pela regra de leitura: só a de alterar a segura.
create function pg_temp.alterou_sem_filtro() returns integer language plpgsql as $$
declare n integer;
begin
  update public.contratos set observacoes = 'alterado';
  get diagnostics n = row_count;
  return n;
end $$;
create function pg_temp.apagou(p_contrato uuid) returns bigint language sql as $$
  with m as (delete from public.contratos where id = p_contrato returning 1) select count(*) from m
$$;
grant execute on function pg_temp.entrar(text), pg_temp.lidos(), pg_temp.le(uuid), pg_temp.alterou_sem_filtro(), pg_temp.apagou(uuid) to authenticated;

set local role authenticated;

-- E quatro contratos gravados como no site, pelos gatilhos de verdade:
--   c1: do master, com Beto de responsável; c2: do master, com Clara de participante;
--   c3: só do master, com Clara de indicadora; c4: criado por Dora, com o master de responsável.
select pg_temp.entrar('1');
insert into public.contratos (id, cliente_id, responsavel_id, servico, categoria, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Do Beto', 'pro_labore', auth.uid());
insert into public.contratos (id, cliente_id, responsavel_id, servico, categoria, participantes, criado_por) values
  ('c0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', auth.uid(), 'Com a Clara', 'pro_labore',
   '[{"pessoa_id": "10000000-0000-0000-0000-000000000003", "percentual": 10}]', auth.uid());
insert into public.contratos (id, cliente_id, responsavel_id, servico, categoria, indicador_id, criado_por) values
  ('c0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', auth.uid(), 'Só do master', 'pro_labore', '10000000-0000-0000-0000-000000000003', auth.uid());
select pg_temp.entrar('4');
insert into public.contratos (id, cliente_id, responsavel_id, servico, categoria, criado_por) values
  ('c0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Da Dora', 'pro_labore', auth.uid());

-- E, no contrato só do master: uma alteração no histórico, um comentário, uma etiqueta e uma demanda de que Dora é responsável.
select pg_temp.entrar('1');
update public.contratos set observacoes = 'nota' where id = 'c0000000-0000-0000-0000-000000000003';
insert into public.comentarios (contrato_id, autor_id, texto) values ('c0000000-0000-0000-0000-000000000003', auth.uid(), 'Valor combinado');
insert into public.etiquetas (id, cor, texto, criado_por) values ('b0000000-0000-0000-0000-000000000001', 'verde', 'Sigilo', auth.uid());
insert into public.contrato_etiquetas (contrato_id, etiqueta_id) values ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001');
insert into public.demandas (id, titulo, responsavel_id, clientes, contrato_id, criado_por) values
  ('d0000000-0000-0000-0000-000000000001', 'Notificar', 'a0000000-0000-0000-0000-000000000004', '{10000000-0000-0000-0000-000000000005}', 'c0000000-0000-0000-0000-000000000003', auth.uid());

-- Administrador
select is(pg_temp.lidos(), 4::bigint, 'dado um administrador, quando lê os contratos, então vê todos os do escritório, mesmo os que não são dele');

-- Responsável
select pg_temp.entrar('2');
select is(pg_temp.lidos(), 1::bigint, 'dada uma conta comum responsável por um contrato, quando lê os contratos, então vê só esse');
select is(pg_temp.le('c0000000-0000-0000-0000-000000000001'), 1::bigint, 'dado o responsável, quando abre o contrato, então vê');

-- Quem não está no contrato: nem pelo endereço, nem pelo que está ligado a ele.
select is(pg_temp.le('c0000000-0000-0000-0000-000000000003'), 0::bigint, 'dado um contrato alheio, quando a conta comum o abre pelo endereço, então não vê');
select is((select count(*) from public.contrato_historico where contrato_id = 'c0000000-0000-0000-0000-000000000003'), 0::bigint, 'dado um contrato alheio, quando lê o histórico dele, então não vê');
select is((select count(*) from public.contrato_clientes where contrato_id = 'c0000000-0000-0000-0000-000000000003'), 0::bigint, 'dado um contrato alheio, quando lê os clientes dele, então não vê');
select is((select count(*) from public.contrato_participantes where contrato_id = 'c0000000-0000-0000-0000-000000000002'), 0::bigint, 'dado um contrato alheio, quando lê os participantes dele, então não vê');
select is((select count(*) from public.comentarios where contrato_id = 'c0000000-0000-0000-0000-000000000003'), 0::bigint, 'dado um contrato alheio, quando lê os comentários dele, então não vê');
select is((select count(*) from public.contrato_etiquetas where contrato_id = 'c0000000-0000-0000-0000-000000000003'), 0::bigint, 'dado um contrato alheio, quando lê as etiquetas dele, então não vê');
select is((select count(*) from public.contratos where busca like '%so do master%'), 0::bigint, 'dado um contrato alheio, quando busca por ele, então não acha');
select is((select count(*) from public.contrato_clientes where pessoa_id = '10000000-0000-0000-0000-000000000005'), 1::bigint, 'dado o cartão de um cliente, quando a conta comum vê os contratos dele, então só aparecem os dela');

-- Nem por escrita
select is(pg_temp.alterou_sem_filtro(), 1, 'dada uma alteração sem filtro, quando a conta comum a faz, então só alcança o contrato dela');
select throws_ok($$ insert into public.comentarios (contrato_id, autor_id, texto) values ('c0000000-0000-0000-0000-000000000003', auth.uid(), 'Oi') $$, '42501', null, 'dado um contrato alheio, quando comenta nele, então é recusado');
select throws_ok($$ insert into public.contrato_etiquetas (contrato_id, etiqueta_id) values ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001') $$, '42501', null, 'dado um contrato alheio, quando aplica uma etiqueta nele, então é recusado');
select is(pg_temp.apagou('c0000000-0000-0000-0000-000000000003'), 0::bigint, 'dado um contrato alheio, quando tenta excluí-lo, então nada acontece');

-- Pessoas continua comum
select is((select count(*) from public.pessoas where id::text like '10000000-%'), 5::bigint, 'dada qualquer conta da equipe, quando lê Pessoas, então vê todo o cadastro do escritório');

-- Participante e indicador
select pg_temp.entrar('3');
select is(pg_temp.le('c0000000-0000-0000-0000-000000000002'), 1::bigint, 'dada uma participante, quando abre o contrato, então vê');
select is((select count(*) from public.contrato_participantes where contrato_id = 'c0000000-0000-0000-0000-000000000002'), 1::bigint, 'dada uma participante, quando lê os participantes do contrato, então vê');
select is((select count(*) from public.contrato_clientes where contrato_id = 'c0000000-0000-0000-0000-000000000002'), 1::bigint, 'dada uma participante, quando lê os clientes do contrato, então vê');
select is(pg_temp.le('c0000000-0000-0000-0000-000000000003'), 0::bigint, 'dada a indicadora de um contrato, quando o abre, então não vê: o indicador não entra na regra');
select is(pg_temp.lidos(), 1::bigint, 'dada uma participante, quando lê os contratos, então vê só o dela');

-- Quem criou e a demanda ligada
select pg_temp.entrar('4');
select is(pg_temp.le('c0000000-0000-0000-0000-000000000004'), 1::bigint, 'dada quem criou o contrato, sem ser responsável, quando o abre, então vê');
select is((select contrato_codigo is not null from public.demandas where id = 'd0000000-0000-0000-0000-000000000001'), true, 'dada a responsável por uma demanda ligada a um contrato alheio, quando abre a demanda, então vê que há um contrato');
select is((select count(*) from public.contratos k join public.demandas d on d.contrato_id = k.id where d.id = 'd0000000-0000-0000-0000-000000000001'), 0::bigint, 'dada a demanda ligada a um contrato alheio, quando tenta abrir o contrato, então não vê');

-- Outro escritório
select pg_temp.entrar('5');
select is(pg_temp.lidos(), 0::bigint, 'dado o administrador de outro escritório, quando lê os contratos, então não vê nenhum');
select is((select count(*) from public.contrato_historico where contrato_id = 'c0000000-0000-0000-0000-000000000003'), 0::bigint, 'dado o administrador de outro escritório, quando lê um histórico, então não vê');

-- O número do contrato continua vindo de todos os contratos do escritório, mesmo os que quem cria não vê.
select pg_temp.entrar('2');
insert into public.contratos (id, cliente_id, responsavel_id, servico, categoria, criado_por) values
  ('c0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', auth.uid(), 'Novo', 'pro_labore', auth.uid());
select is((select numero from public.contratos where id = 'c0000000-0000-0000-0000-000000000005'), 5, 'dada uma conta que vê poucos contratos, quando cria outro, então ele recebe o próximo número do escritório');
select is(pg_temp.le('c0000000-0000-0000-0000-000000000005'), 1::bigint, 'dado quem acabou de criar um contrato, quando o lê de volta, então vê');

-- Trocas de quem está no contrato
select throws_ok($$ update public.contratos set responsavel_id = 'a0000000-0000-0000-0000-000000000003' where id = 'c0000000-0000-0000-0000-000000000001' $$, '42501', null, 'dado um responsável que não criou o contrato, quando o passa a outro advogado, então é recusado: ele deixaria de ver');
select is((select responsavel_id from public.contratos where id = 'c0000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000002'::uuid, 'depois da recusa, o responsável continua o mesmo');
select lives_ok($$ update public.contratos set responsavel_id = 'a0000000-0000-0000-0000-000000000003',
                     participantes = '[{"pessoa_id": "10000000-0000-0000-0000-000000000002", "percentual": null}]' where id = 'c0000000-0000-0000-0000-000000000001' $$,
                'dado um responsável, quando passa o contrato a outro advogado e fica como participante, então grava');
select is(pg_temp.le('c0000000-0000-0000-0000-000000000001'), 1::bigint, 'dado quem ficou como participante, quando abre o contrato, então continua vendo');
select pg_temp.entrar('3');
select is(pg_temp.le('c0000000-0000-0000-0000-000000000001'), 1::bigint, 'dado o novo responsável, quando abre o contrato, então passa a ver');
select ok((select count(*) from public.contrato_historico where contrato_id = 'c0000000-0000-0000-0000-000000000001') > 0, 'dado o novo responsável, quando abre o histórico, então vê as alterações de antes');

select pg_temp.entrar('1');
select lives_ok($$ update public.contratos set responsavel_id = 'a0000000-0000-0000-0000-000000000001', participantes = '[]' where id = 'c0000000-0000-0000-0000-000000000001' $$,
                'dado um administrador, quando tira todos do contrato, então grava');
select pg_temp.entrar('2');
select is(pg_temp.le('c0000000-0000-0000-0000-000000000001'), 0::bigint, 'dado quem saiu da lista de participantes, quando abre o contrato, então não vê mais');
select is((select count(*) from public.contrato_participantes where contrato_id = 'c0000000-0000-0000-0000-000000000001'), 0::bigint, 'dado quem saiu do contrato, quando lê os participantes, então não vê');
select pg_temp.entrar('3');
select is(pg_temp.le('c0000000-0000-0000-0000-000000000001'), 0::bigint, 'dado o responsável trocado por um administrador, quando abre o contrato, então não vê mais');

-- A versão anterior do site grava só a coluna antiga do participante: a regra acompanha.
select pg_temp.entrar('1');
update public.contratos set participante_id = '10000000-0000-0000-0000-000000000002' where id = 'c0000000-0000-0000-0000-000000000003';
select pg_temp.entrar('2');
select is(pg_temp.le('c0000000-0000-0000-0000-000000000003'), 1::bigint, 'dada a versão anterior do site, quando grava o participante na coluna antiga, então ele passa a ver');

-- Sem sessão, nada
select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'role', 'authenticated', 'aal', 'aal1', 'session_id', '50000000-0000-0000-0000-0000000000ff')::text, true);
select is(pg_temp.lidos(), 0::bigint, 'dada uma sessão encerrada, quando um administrador lê os contratos, então não vê nenhum');

select * from finish();
rollback;
