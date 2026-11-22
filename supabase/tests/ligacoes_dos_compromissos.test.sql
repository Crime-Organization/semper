-- Compromisso ligado a tarefas, demandas e contratos, e o tipo Atendimento (#306). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master), Bia e Caio (usuários comuns), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-ligacoes-compromisso', '{"pessoas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-ligacoes-compromisso-2', '{"pessoas": true}');
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

-- Os cartões, gravados direto (sem os gatilhos de cadastro):
--   C1: reunião da Bia; C2: reunião só da Ana; C3: audiência da Ana, ligada ao processo PR1; C4: reunião arquivada da Bia;
--   C9: do outro escritório. D1: demanda da Ana, com a Bia; D2: demanda só da Ana. T1: tarefa da Bia. K1: contrato da Ana.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, colaboradores, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'PR1', 'judicial', '1', 'a0000000-0000-0000-0000-000000000001', '{}', '{10000000-0000-0000-0000-000000000005}', 'a0000000-0000-0000-0000-000000000001');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Com a Bia', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', 'a0000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'D2', 'Só da Ana', 'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, criado_por)
  select ('70000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'e0000000-0000-0000-0000-000000000001', 'T' || i, 'Tarefa ' || i,
         'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002'
  from generate_series(1, 31) i;
-- T99: tarefa do outro escritório, do Davi.
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, criado_por) values
  ('70000000-0000-0000-0000-000000000099', 'e0000000-0000-0000-0000-000000000002', 'T99', 'De fora', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, categoria, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AN26', 2026, 'AN26-0001-2026', '10000000-0000-0000-0000-000000000005', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001', 'Registro de marca', 'pro_labore', 'a0000000-0000-0000-0000-000000000001');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, modalidade, responsavel_id, processo_id, criado_por, arquivado_em) values
  ('7c000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'C1', 'reuniao', 'Da Bia', '2026-12-01', '10:00', null, 'a0000000-0000-0000-0000-000000000002', null, 'a0000000-0000-0000-0000-000000000002', null),
  ('7c000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'C2', 'reuniao', 'Da Ana', '2026-12-01', '11:00', null, 'a0000000-0000-0000-0000-000000000001', null, 'a0000000-0000-0000-0000-000000000001', null),
  ('7c000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'C3', 'audiencia', null, '2026-12-02', '14:00', 'presencial', 'a0000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', null),
  ('7c000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'C4', 'reuniao', 'Arquivada', '2026-12-01', '12:00', null, 'a0000000-0000-0000-0000-000000000002', null, 'a0000000-0000-0000-0000-000000000002', now());
set local session_replication_role = origin;

-- Quantas linhas um delete apagou (o delete não cabe numa subconsulta). Roda com a permissão de quem chama.
create function pg_temp.apagados(p_sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $f$;
grant execute on function pg_temp.apagados(text) to authenticated;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

-- ---------- o tipo Atendimento ----------
-- Quando a Bia cadastra um atendimento com título e hora, então ele é gravado
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ insert into public.compromissos (tipo, titulo, data, hora, responsavel_id, criado_por)
                   values ('atendimento', 'Primeiro atendimento', '2026-12-03', '09:00', auth.uid(), auth.uid()) $$, 'O atendimento é um tipo aceito');
-- Quando o atendimento vem sem hora, então é recusado, como a reunião
select throws_ok($$ insert into public.compromissos (tipo, titulo, data, responsavel_id, criado_por)
                    values ('atendimento', 'Sem hora', '2026-12-03', auth.uid(), auth.uid()) $$, '23514', null, 'O atendimento precisa de hora');
-- Quando vem um tipo que não existe, então continua recusado
select throws_ok($$ insert into public.compromissos (tipo, titulo, data, hora, responsavel_id, criado_por)
                    values ('visita', 'Tipo novo', '2026-12-03', '09:00', auth.uid(), auth.uid()) $$, '23514', null, 'Um tipo fora da lista é recusado');

-- ---------- ligar ----------
-- Quando a Bia liga o compromisso dela à demanda em que está, então a ligação fica gravada, e o histórico registra
select lives_ok($$ insert into public.compromisso_ligacoes (compromisso_id, demanda_id, criado_por)
                   values ('7c000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', auth.uid()) $$, 'Liga o compromisso à demanda');
select is((select escritorio_id from public.compromisso_ligacoes where demanda_id = '71000000-0000-0000-0000-000000000001'),
          'e0000000-0000-0000-0000-000000000001'::uuid, 'A ligação é do escritório do compromisso');
select is((select alteracoes -> 'ligacao' ->> 'para' from public.compromisso_historico where compromisso_id = '7c000000-0000-0000-0000-000000000001' order by em desc, id desc limit 1),
          'Demanda D1', 'O histórico do compromisso registra a ligação, com o código do item');
-- Quando liga de novo a mesma demanda, então nada muda e não dá erro
select lives_ok($$ insert into public.compromisso_ligacoes (compromisso_id, demanda_id, criado_por)
                   values ('7c000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', auth.uid()) $$, 'Ligar de novo não dá erro');
select is((select count(*) from public.compromisso_ligacoes where compromisso_id = '7c000000-0000-0000-0000-000000000001'), 1::bigint, 'A demanda não se repete');
-- Quando liga também uma tarefa dela, então o compromisso fica com os dois itens
select lives_ok($$ insert into public.compromisso_ligacoes (compromisso_id, tarefa_id, criado_por)
                   values ('7c000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', auth.uid()) $$, 'Liga o compromisso à tarefa');
-- Quando tenta ligar uma demanda que não vê, um contrato de que não é parte ou o compromisso de outra pessoa, então é recusado
select throws_ok($$ insert into public.compromisso_ligacoes (compromisso_id, demanda_id, criado_por)
                    values ('7c000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', auth.uid()) $$, '42501', null, 'Demanda que a pessoa não vê não se liga');
select throws_ok($$ insert into public.compromisso_ligacoes (compromisso_id, contrato_id, criado_por)
                    values ('7c000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', auth.uid()) $$, '42501', null, 'Contrato que a pessoa não alcança não se liga');
select throws_ok($$ insert into public.compromisso_ligacoes (compromisso_id, demanda_id, criado_por)
                    values ('7c000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', auth.uid()) $$, '42501', null, 'Compromisso que a pessoa não muda não se liga');
-- Quando tenta ligar o compromisso arquivado, então é recusado
select throws_ok($$ insert into public.compromisso_ligacoes (compromisso_id, demanda_id, criado_por)
                    values ('7c000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000001', auth.uid()) $$, '42501', null, 'Compromisso arquivado não se liga');
-- Quando a linha traz dois itens de uma vez, então é recusada
select throws_ok($$ insert into public.compromisso_ligacoes (compromisso_id, demanda_id, tarefa_id, criado_por)
                    values ('7c000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', auth.uid()) $$, '23514', null, 'Uma ligação liga um item só');
-- Quando tenta ligar o compromisso dela a uma tarefa de outro escritório (pelo id), então é recusado
select throws_ok($$ insert into public.compromisso_ligacoes (compromisso_id, tarefa_id, criado_por)
                    values ('7c000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000099', auth.uid()) $$, 'P0001', 'Item não encontrado neste escritório.',
                 'Item de outro escritório não se liga');
-- Quando tenta mandar a ligação para outro escritório, então o escritório fica o do compromisso
select lives_ok($$ insert into public.compromisso_ligacoes (escritorio_id, compromisso_id, tarefa_id, criado_por)
                   values ('e0000000-0000-0000-0000-000000000002', '7c000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', auth.uid()) $$, 'Liga a outra tarefa');
select is((select escritorio_id from public.compromisso_ligacoes where tarefa_id = '70000000-0000-0000-0000-000000000002'), 'e0000000-0000-0000-0000-000000000001'::uuid,
          'A ligação fica no escritório do compromisso, não no que veio no pedido');
delete from public.compromisso_ligacoes where tarefa_id = '70000000-0000-0000-0000-000000000002';
-- E o código guardado para o histórico não se lê pela tabela
select throws_ok($$ select item_nome from public.compromisso_ligacoes $$, '42501', null, 'O código guardado não se lê pela tabela');

-- Quando a Ana (administradora) liga o contrato e a audiência do processo à demanda, então vale
select pg_temp.entrar(1);
select lives_ok($$ insert into public.compromisso_ligacoes (compromisso_id, contrato_id, criado_por)
                   values ('7c000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', auth.uid()) $$, 'A administradora liga o contrato');
select lives_ok($$ insert into public.compromisso_ligacoes (compromisso_id, demanda_id, criado_por)
                   values ('7c000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000002', auth.uid()) $$, 'A audiência liga-se a uma demanda');
-- E a audiência continua ligada ao processo dela
select is((select processo_id from public.compromissos where id = '7c000000-0000-0000-0000-000000000003'), '73000000-0000-0000-0000-000000000001'::uuid,
          'O compromisso ligado a um processo continua ligado a ele');

-- ---------- quem vê ----------
-- Dado o Caio, que não está no compromisso C1, quando lê as ligações da demanda D1, então não vê nenhuma
select pg_temp.entrar(3);
select is((select count(*) from public.compromisso_ligacoes where demanda_id = '71000000-0000-0000-0000-000000000001'), 0::bigint, 'Quem não vê o compromisso não vê a ligação');
-- Quando tenta desligar, então nada sai
select is(pg_temp.apagados('delete from public.compromisso_ligacoes where compromisso_id = ''7c000000-0000-0000-0000-000000000001'''), 0::bigint, 'Quem não muda o compromisso não desliga');
-- Dado o Davi, de outro escritório, quando lê ou tenta ligar, então não vê nada e é recusado
select pg_temp.entrar(4);
select is((select count(*) from public.compromisso_ligacoes), 0::bigint, 'Outro escritório não vê as ligações');
select throws_ok($$ insert into public.compromisso_ligacoes (compromisso_id, demanda_id, criado_por)
                    values ('7c000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', auth.uid()) $$, null, null, 'Outro escritório não liga');
-- Dada a Bia, quando lê as ligações do compromisso dela, então vê as três
select pg_temp.entrar(2);
select is((select count(*) from public.compromisso_ligacoes where compromisso_id = '7c000000-0000-0000-0000-000000000001'), 3::bigint, 'Quem vê o compromisso vê todas as ligações dele');

-- ---------- desligar ----------
-- Quando a Bia desliga a tarefa, então a ligação sai e o histórico registra
select is(pg_temp.apagados('delete from public.compromisso_ligacoes where tarefa_id = ''70000000-0000-0000-0000-000000000001'''), 1::bigint, 'Quem muda o compromisso desliga');
select is((select alteracoes -> 'ligacao' ->> 'de' from public.compromisso_historico where compromisso_id = '7c000000-0000-0000-0000-000000000001' order by em desc, id desc limit 1),
          'Tarefa T1', 'O histórico registra o desligamento');
-- Quando a pessoa tenta mudar uma ligação, então não pode (só ligar e desligar)
select throws_ok($$ update public.compromisso_ligacoes set demanda_id = '71000000-0000-0000-0000-000000000002' $$, '42501', null, 'A ligação não se muda');
reset role;

-- ---------- o limite e a exclusão ----------
-- Dado um compromisso com 30 tarefas ligadas, quando entra a 31ª, então é recusada
delete from public.compromisso_ligacoes where compromisso_id = '7c000000-0000-0000-0000-000000000002';
insert into public.compromisso_ligacoes (compromisso_id, tarefa_id)
  select '7c000000-0000-0000-0000-000000000002', ('70000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 30) i;
select throws_ok($$ insert into public.compromisso_ligacoes (compromisso_id, tarefa_id) values ('7c000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000031') $$,
                 'P0001', 'Um compromisso pode ser ligado a no máximo 30 itens.', 'Até 30 itens por compromisso');
-- Quando a demanda é excluída, então a ligação sai junto
delete from public.demandas where id = '71000000-0000-0000-0000-000000000001';
select is((select count(*) from public.compromisso_ligacoes where compromisso_id = '7c000000-0000-0000-0000-000000000001' and demanda_id is not null), 0::bigint, 'Excluir o item tira a ligação');
-- E o histórico do compromisso diz qual item saiu, mesmo com ele já excluído
select is((select alteracoes -> 'ligacao' ->> 'de' from public.compromisso_historico where compromisso_id = '7c000000-0000-0000-0000-000000000001' order by em desc, id desc limit 1),
          'Demanda D1', 'O histórico registra o item excluído pelo código guardado');
-- Quando o compromisso é excluído, então as ligações saem, sem erro no histórico
select lives_ok($$ delete from public.compromissos where id = '7c000000-0000-0000-0000-000000000002' $$, 'Excluir o compromisso leva as ligações');
select is((select count(*) from public.compromisso_ligacoes where compromisso_id = '7c000000-0000-0000-0000-000000000002'), 0::bigint, 'Nenhuma ligação fica sem compromisso');

select * from finish();
rollback;
