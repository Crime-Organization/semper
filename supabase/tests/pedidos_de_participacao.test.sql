-- Pedir para participar de um item de que ainda não faço parte (#363).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Beto (responsável pelos itens), Caio (quem criou os itens), Dani (quer participar)
-- e Eva (não aprova nada); e outro escritório com Fabio (administrador) e Gil (usuário comum). A fase de adaptação está desligada.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-pedidos',
   '{"pessoas": true, "tarefas": true, "demandas": true, "processos": true, "compromissos": true, "contratos": true, "anotacoes": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-pedidos-2', '{"pessoas": true, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'dani@exemplo.test', 'Dani', 'usuario', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eva@exemplo.test', 'Eva', 'usuario', privado.resumo_codigo('c5'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'fabio@exemplo.test', 'Fabio', 'master', privado.resumo_codigo('c6'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'gil@exemplo.test', 'Gil', 'usuario', privado.resumo_codigo('c7'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e, jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana@exemplo.test'), (2, 'beto@exemplo.test'), (3, 'caio@exemplo.test'), (4, 'dani@exemplo.test'), (5, 'eva@exemplo.test'),
             (6, 'fabio@exemplo.test'), (7, 'gil@exemplo.test')) as x(n, e);
insert into auth.sessions (id, user_id, created_at, updated_at)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now() from generate_series(1, 7) n;

set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'P4', 'pf', 'DANI', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', 'P9', 'pf', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
update public.perfis set pessoa_id = '10000000-0000-0000-0000-000000000004' where id = 'a0000000-0000-0000-0000-000000000004';
-- Os itens do escritório: responsável Beto, criados por Caio, sem mais ninguém.
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'AAAA0001', 'Tarefa sigilosa', 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'AAAA0002', 'Tarefa cheia', 'a0000000-0000-0000-0000-000000000002',
   array(select ('b0000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 20) n), 'a0000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'AAAA0003', 'Tarefa arquivada', 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000003');
update public.tarefas set arquivado_em = now() where id = '70000000-0000-0000-0000-000000000003';
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'DDDD0001', 'Demanda', 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000003');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, colaboradores, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'EEEE0001', 'judicial', '0001234-97.2026.8.13.0024', 'a0000000-0000-0000-0000-000000000002', '{}',
   '{10000000-0000-0000-0000-000000000009}', 'a0000000-0000-0000-0000-000000000003');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, participantes, criado_por) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'CCCC0001', 'reuniao', 'Reunião', '2030-01-15', '14:30', 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000003');
insert into public.anotacoes (id, escritorio_id, codigo, titulo, texto, responsavel_id, participantes, criado_por) values
  ('74000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'FFFF0001', 'Estratégia', 'segredo', 'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000003');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000009', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000002', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '[]', 'a0000000-0000-0000-0000-000000000003');
-- Mais contratos do mesmo responsável, com os números seguintes (AA11-0002-2030 a AA11-0007-2030), para a contagem dos números;
-- o contrato AA11-0008-2030, de que Dani é a indicadora; e o AA11-0009-2030, com uma parcela.
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, criado_por)
select ('c1000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', n, 'AA11', 2030, 'AA11-' || lpad(n::text, 4, '0') || '-2030',
       '10000000-0000-0000-0000-000000000009', 'CLIENTE', 'a0000000-0000-0000-0000-000000000002', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '[]',
       'a0000000-0000-0000-0000-000000000003'
from generate_series(2, 7) n;
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, criado_por, indicador_id, indicador_percentual) values
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 8, 'AA11', 2030, 'AA11-0008-2030', '10000000-0000-0000-0000-000000000009', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000002', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '[]', 'a0000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000004', 5),
  ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 9, 'AA11', 2030, 'AA11-0009-2030', '10000000-0000-0000-0000-000000000009', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000002', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '[]', 'a0000000-0000-0000-0000-000000000003', null, null);
insert into public.contrato_parcelas (escritorio_id, contrato_id, numero, vencimento, valor) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 1, '2030-02-01', 100000);
-- Dani conhece o código dos contratos 0001, 0008 e 0009 por uma demanda ou tarefa ligada a eles, de que ela faz parte.
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, contrato_id, contrato_codigo, criado_por) values
  ('71000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'DDDD0002', 'Demanda do contrato', 'a0000000-0000-0000-0000-000000000002',
   '{a0000000-0000-0000-0000-000000000004}', 'c0000000-0000-0000-0000-000000000001', 'AA11-0001-2030', 'a0000000-0000-0000-0000-000000000003');
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, contrato_id, contrato_codigo, criado_por) values
  ('70000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'AAAA0004', 'Tarefa do contrato indicado', 'a0000000-0000-0000-0000-000000000002',
   '{a0000000-0000-0000-0000-000000000004}', 'c0000000-0000-0000-0000-000000000002', 'AA11-0008-2030', 'a0000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'AAAA0005', 'Tarefa do contrato com parcelas', 'a0000000-0000-0000-0000-000000000002',
   '{a0000000-0000-0000-0000-000000000004}', 'c0000000-0000-0000-0000-000000000003', 'AA11-0009-2030', 'a0000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'AAAA0006', 'Tarefa arquivada depois', 'a0000000-0000-0000-0000-000000000002', '{}', null, null,
   'a0000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'AAAA0007', 'Tarefa de módulo desligado', 'a0000000-0000-0000-0000-000000000002', '{}', null, null,
   'a0000000-0000-0000-0000-000000000003');
-- Um processo administrativo com letras no número (uma patente do INPI).
insert into public.processos (id, escritorio_id, codigo, tipo, numero, responsavel_id, colaboradores, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'EEEE0002', 'administrativo', 'BR 10 2020 012345-6', 'a0000000-0000-0000-0000-000000000002', '{}',
   '{10000000-0000-0000-0000-000000000009}', 'a0000000-0000-0000-0000-000000000003');
-- No outro escritório, uma tarefa com o mesmo código, de Fabio.
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'AAAA0001', 'Tarefa do outro', 'a0000000-0000-0000-0000-000000000006', '{}', 'a0000000-0000-0000-0000-000000000006');
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
grant execute on function pg_temp.entrar(int) to authenticated;
-- O pedido pendente de Dani para um item (lido como o banco, sem as regras de leitura).
create function pg_temp.pedido(p_item uuid) returns uuid language sql security definer as $$
  select id from public.pedidos_de_participacao where item_id = p_item and pedido_por = 'a0000000-0000-0000-0000-000000000004'
  order by array_position(array['pendente', 'aprovado', 'recusado', 'cancelado'], situacao) limit 1
$$;
grant execute on function pg_temp.pedido(uuid) to authenticated;

-- ===== A busca =====
-- Quando Dani busca o código exato (em minúsculas), então acha a tarefa só com o módulo, o grupo e o código
select pg_temp.entrar(4); set local role authenticated;
select results_eq($$ select modulo, grupo, id, codigo, numero, pedido_id from public.itens_para_pedir('aaaa0001') $$,
  $$ values ('tarefas'::text, 'tarefas'::text, '70000000-0000-0000-0000-000000000001'::uuid, 'AAAA0001'::text, null::text, null::uuid) $$,
  'Pelo código exato vem só o tipo e o código, do escritório de quem busca');
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 0::bigint, 'Dani não vê a tarefa');
select is((select count(*) from public.itens_para_pedir('AAAA000')), 0::bigint, 'Parte do código não acha');
select is((select count(*) from public.itens_para_pedir('Tarefa sigilosa')), 0::bigint, 'O título não acha');
select is((select count(*) from public.itens_para_pedir('AAAA0003')), 0::bigint, 'Item arquivado não aparece');
select results_eq($$ select modulo, grupo, codigo, numero from public.itens_para_pedir('0001234-97.2026.8.13.0024') $$,
  $$ values ('processos'::text, 'judiciais'::text, 'EEEE0001'::text, '00012349720268130024'::text) $$, 'Pelo número do processo, com pontuação, acha o processo judicial');
select results_eq($$ select codigo, numero from public.itens_para_pedir('EEEE0001') $$, $$ values ('EEEE0001'::text, null::text) $$,
  'Pelo código do processo, o número não sai da busca');
select is((select count(*) from public.itens_para_pedir('0001234-97.2026')), 0::bigint, 'Parte do número não acha');
select results_eq($$ select modulo from public.itens_para_pedir('aa11-0001-2030') $$, $$ values ('contratos'::text) $$, 'Acha o contrato pelo número');
select is((select array_agg(modulo order by modulo) from (select modulo from public.itens_para_pedir('DDDD0001') union all select modulo from public.itens_para_pedir('CCCC0001')
  union all select modulo from public.itens_para_pedir('FFFF0001')) x), '{anotacoes,compromissos,demandas}'::text[], 'Acha demanda, compromisso e anotação pelo código');
-- O código do contrato dá para adivinhar (SIGLA-NNNN-ANO): contar os números não lista os contratos do escritório
select is((select array_agg(r.codigo order by r.codigo) from generate_series(1, 50) n, lateral public.itens_para_pedir('AA11-' || lpad(n::text, 4, '0') || '-2030') r),
  '{AA11-0001-2030,AA11-0009-2030}'::text[], 'Contar os números do contrato só acha os contratos ligados a uma demanda ou tarefa de Dani');
select is((select count(*) from public.itens_para_pedir('AA11-0002-2030')), 0::bigint, 'O contrato sem demanda ou tarefa de Dani não é achado pelo código');
select is((select count(*) from public.itens_para_pedir('AA11-0008-2030')), 0::bigint, 'O contrato de que Dani é a indicadora não é oferecido');
select throws_ok($$ select public.participacao_pedir('contratos', 'c0000000-0000-0000-0000-000000000002') $$, 'P0001',
  'Você é o indicador deste contrato: o indicador não entra na divisão como participante.', 'A indicadora não pede para participar do contrato');
-- O número do processo com letras (patente do INPI) acha o processo, como a regra processos_numero_unico compara
select results_eq($$ select modulo, grupo, codigo, numero from public.itens_para_pedir('BR 10 2020 012345-6') $$,
  $$ values ('processos'::text, 'administrativos'::text, 'EEEE0002'::text, 'BR1020200123456'::text) $$, 'O número do processo com letras acha o processo administrativo');
select is((select count(*) from public.itens_para_pedir('br1020200123456')), 1::bigint, 'Sem a pontuação e em minúsculas, também acha');
select is((select count(*) from public.itens_para_pedir('BR 10 2020')), 0::bigint, 'Parte do número com letras não acha');
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is((select count(*) from generate_series(1, 50) n, lateral public.itens_para_pedir('AA11-' || lpad(n::text, 4, '0') || '-2030') r), 0::bigint,
  'Quem não está em nada ligado aos contratos não acha nenhum contando os números');
reset role;

-- Quem já vê o item não o acha por aqui (acha pela busca de sempre)
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.itens_para_pedir('AAAA0001')), 0::bigint, 'O responsável já vê: nada a pedir');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select is((select count(*) from public.itens_para_pedir('AAAA0001')), 0::bigint, 'A administradora já vê: nada a pedir');
reset role;
-- Quem é de outro escritório só acha o item do escritório dele
select pg_temp.entrar(7); set local role authenticated;
select results_eq($$ select id from public.itens_para_pedir('AAAA0001') $$, $$ values ('70000000-0000-0000-0000-000000000009'::uuid) $$, 'Só do escritório de quem busca');
reset role;
-- Quem não está logado não busca
set local role anon;
select throws_ok($$ select * from public.itens_para_pedir('AAAA0001') $$, '42501', null, 'Sem login, não busca');
reset role;

-- ===== Pedir e cancelar =====
select pg_temp.entrar(4); set local role authenticated;
select lives_ok($$ select public.participacao_pedir('tarefas', '70000000-0000-0000-0000-000000000001') $$, 'Dani pede para participar da tarefa');
select throws_ok($$ select public.participacao_pedir('tarefas', '70000000-0000-0000-0000-000000000001') $$, 'P0001',
  'Você já pediu para participar deste item. Aguarde a resposta ou cancele o pedido.', 'Pedir de novo, com um pendente, é recusado');
select is((select pedido_id from public.itens_para_pedir('AAAA0001')), pg_temp.pedido('70000000-0000-0000-0000-000000000001'), 'A busca mostra o pedido pendente');
select is((select count(*) from public.pedidos_de_participacao), 1::bigint, 'Dani vê o pedido dela');
select throws_ok($$ select public.participacao_pedir('tarefas', '70000000-0000-0000-0000-000000000003') $$, 'P0001', 'Item não encontrado neste escritório.', 'Item arquivado não recebe pedido');
select throws_ok($$ select public.participacao_pedir('tarefas', '70000000-0000-0000-0000-000000000009') $$, 'P0001', 'Item não encontrado neste escritório.', 'Item de outro escritório não recebe pedido');
select throws_ok($$ select public.participacao_pedir('perfis', '70000000-0000-0000-0000-000000000001') $$, 'P0001', 'Item não encontrado neste escritório.', 'Só os módulos previstos');
reset role;
-- Então a mensagem chega a quem aprova: a administradora, o responsável e quem criou; não a Eva nem a Dani
select is((select array_agg(f.nome order by f.nome) from public.mensagens_de_participacao m join public.perfis f on f.id = m.perfil_id
           where m.pedido_id = pg_temp.pedido('70000000-0000-0000-0000-000000000001') and m.tipo = 'pedido'), '{Ana,Beto,Caio}'::text[], 'O pedido chega a quem aprova');
select pg_temp.entrar(1); set local role authenticated;
select is((select count(*) from public.mensagens_de_participacao where tipo = 'pedido'), 1::bigint, 'A administradora vê a mensagem do pedido');
select is((select count(*) from public.pedidos_de_participacao), 1::bigint, 'A administradora vê o pedido');
reset role;
select pg_temp.entrar(5); set local role authenticated;
select is((select count(*) from public.pedidos_de_participacao), 0::bigint, 'Quem não aprova nem pediu não vê o pedido');
select is((select count(*) from public.mensagens_de_participacao), 0::bigint, 'Nem as mensagens dos outros');
select throws_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('70000000-0000-0000-0000-000000000001')), 'P0001',
  'Só um administrador, o responsável ou quem criou o item responde a este pedido.', 'Quem não aprova não responde');
select throws_ok(format('select public.participacao_cancelar(%L)', pg_temp.pedido('70000000-0000-0000-0000-000000000001')), 'P0001', 'Pedido não encontrado.', 'Só quem pediu cancela');
reset role;
select pg_temp.entrar(6); set local role authenticated;
select is((select count(*) from public.pedidos_de_participacao), 0::bigint, 'Outro escritório não vê o pedido');
select throws_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('70000000-0000-0000-0000-000000000001')), 'P0001', 'Pedido não encontrado.', 'Outro escritório não responde');
reset role;
-- Quando Dani cancela, então o pedido sai da caixa de quem aprovaria
select pg_temp.entrar(4); set local role authenticated;
select throws_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('70000000-0000-0000-0000-000000000001')), 'P0001',
  'Só um administrador, o responsável ou quem criou o item responde a este pedido.', 'Quem pediu não aprova o próprio pedido');
select lives_ok(format('select public.participacao_cancelar(%L)', pg_temp.pedido('70000000-0000-0000-0000-000000000001')), 'Dani cancela o pedido');
select throws_ok(format('select public.participacao_cancelar(%L)', pg_temp.pedido('70000000-0000-0000-0000-000000000001')), 'P0001', 'Este pedido já foi respondido.', 'O cancelado não se cancela de novo');
select is((select pedido_id from public.itens_para_pedir('AAAA0001')), null::uuid, 'Sem pedido pendente na busca');
reset role;
select is((select situacao from public.pedidos_de_participacao where id = pg_temp.pedido('70000000-0000-0000-0000-000000000001')), 'cancelado', 'O pedido fica cancelado');
select is((select count(*) from public.mensagens_de_participacao where tipo = 'pedido'), 0::bigint, 'O cancelado sai da caixa de quem aprovaria');
select pg_temp.entrar(1); set local role authenticated;
select throws_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('70000000-0000-0000-0000-000000000001')), 'P0001', 'Este pedido foi cancelado por quem pediu.', 'O cancelado não se aprova');
reset role;

-- ===== Aprovar e recusar =====
-- Dado um pedido novo da tarefa, quando a administradora aprova, então Dani entra como participante, vê a tarefa e é avisada
select pg_temp.entrar(4); set local role authenticated;
select lives_ok($$ select public.participacao_pedir('tarefas', '70000000-0000-0000-0000-000000000001') $$, 'Depois de cancelar, pode pedir de novo');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select lives_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('70000000-0000-0000-0000-000000000001')), 'A administradora aprova');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select throws_ok(format('select public.participacao_responder(%L, false)', pg_temp.pedido('70000000-0000-0000-0000-000000000001')), 'P0001', 'Este pedido já foi respondido.', 'O segundo que responde vê "já respondido"');
reset role;
select is((select participantes from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), '{a0000000-0000-0000-0000-000000000004}'::uuid[], 'Dani entrou na tarefa');
select is((select alteracoes -> 'pedido_aprovado' ->> 'para' from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001' and alteracoes ? 'pedido_aprovado'),
  'Dani', 'A resposta fica no histórico da tarefa, com o nome de quem pediu');
select is((select feito_por from public.tarefa_historico where tarefa_id = '70000000-0000-0000-0000-000000000001' and alteracoes ? 'participantes'),
  'a0000000-0000-0000-0000-000000000001'::uuid, 'A entrada fica no histórico como a do lápis, por quem aprovou');
select is((select count(*) from public.mensagens_de_participacao m where m.pedido_id = pg_temp.pedido('70000000-0000-0000-0000-000000000001') and m.tipo = 'pedido'), 0::bigint,
  'O pedido sai da caixa de todos os que aprovariam');
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000001'), 1::bigint, 'Dani passa a ver a tarefa');
select is((select count(*) from public.itens_para_pedir('AAAA0001')), 0::bigint, 'E não a acha mais para pedir');
select results_eq($$ select m.tipo, p.situacao, p.respondido_por from public.mensagens_de_participacao m join public.pedidos_de_participacao p on p.id = m.pedido_id
  where p.tarefa_id = '70000000-0000-0000-0000-000000000001' $$, $$ values ('resposta'::text, 'aprovado'::text, 'a0000000-0000-0000-0000-000000000001'::uuid) $$,
  'Dani recebe a resposta na caixa dela');
select throws_ok($$ select public.participacao_pedir('tarefas', '70000000-0000-0000-0000-000000000001') $$, 'P0001', 'Você já faz parte deste item.', 'Quem já está no item não pede');
-- E pede nos outros módulos
select lives_ok($$ select public.participacao_pedir('demandas', '71000000-0000-0000-0000-000000000001') $$, 'Pede na demanda');
select lives_ok($$ select public.participacao_pedir('processos', '73000000-0000-0000-0000-000000000001') $$, 'Pede no processo');
select lives_ok($$ select public.participacao_pedir('compromissos', '72000000-0000-0000-0000-000000000001') $$, 'Pede no compromisso');
select lives_ok($$ select public.participacao_pedir('anotacoes', '74000000-0000-0000-0000-000000000001') $$, 'Pede na anotação');
select lives_ok($$ select public.participacao_pedir('contratos', 'c0000000-0000-0000-0000-000000000001') $$, 'Pede no contrato');
select lives_ok($$ select public.participacao_pedir('tarefas', '70000000-0000-0000-0000-000000000002') $$, 'Pede na tarefa cheia');
reset role;

-- Quando o responsável aprova a demanda, quem criou aprova o processo e a anotação, e a administradora aprova o contrato
select pg_temp.entrar(2); set local role authenticated;
select lives_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('71000000-0000-0000-0000-000000000001')), 'O responsável aprova na demanda');
select lives_ok(format('select public.participacao_responder(%L, false)', pg_temp.pedido('72000000-0000-0000-0000-000000000001')), 'O responsável recusa no compromisso');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select lives_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('73000000-0000-0000-0000-000000000001')), 'Quem criou aprova no processo');
select lives_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('74000000-0000-0000-0000-000000000001')), 'Quem criou aprova na anotação');
reset role;
select pg_temp.entrar(1); set local role authenticated;
select lives_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('c0000000-0000-0000-0000-000000000001')), 'A administradora aprova no contrato');
select throws_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('70000000-0000-0000-0000-000000000002')), 'P0001',
  'Uma tarefa pode ter até 20 participantes.', 'Com a lista cheia, a aprovação é recusada');
reset role;
-- Então cada um entra na coluna do módulo; no contrato, com 0%
select is((select colaboradores from public.demandas where id = '71000000-0000-0000-0000-000000000001'), '{a0000000-0000-0000-0000-000000000004}'::uuid[], 'Dani é colaboradora da demanda');
select is((select colaboradores from public.processos where id = '73000000-0000-0000-0000-000000000001'), '{a0000000-0000-0000-0000-000000000004}'::uuid[], 'Dani é colaboradora do processo');
select is((select participantes from public.anotacoes where id = '74000000-0000-0000-0000-000000000001'), '{a0000000-0000-0000-0000-000000000004}'::uuid[], 'A anotação foi compartilhada com Dani');
select is((select participantes from public.contratos where id = 'c0000000-0000-0000-0000-000000000001'),
  '[{"pessoa_id": "10000000-0000-0000-0000-000000000004", "percentual": 0}]'::jsonb, 'Dani entra no contrato com 0%');
select is((select percentual from public.contrato_participantes where contrato_id = 'c0000000-0000-0000-0000-000000000001'), 0::numeric, 'A divisão do contrato tem Dani com 0%');
select is((select participantes from public.compromissos where id = '72000000-0000-0000-0000-000000000001'), '{}'::uuid[], 'Recusado, Dani não entra no compromisso');
select is((select alteracoes -> 'pedido_recusado' ->> 'para' from public.compromisso_historico where compromisso_id = '72000000-0000-0000-0000-000000000001'),
  'Dani', 'A recusa fica no histórico do compromisso');
select is((select count(*) from public.demanda_historico where demanda_id = '71000000-0000-0000-0000-000000000001' and alteracoes ? 'pedido_aprovado'), 1::bigint, 'A aprovação fica no histórico da demanda');
select is((select count(*) from public.processo_historico where processo_id = '73000000-0000-0000-0000-000000000001' and alteracoes ? 'pedido_aprovado'), 1::bigint, 'E no do processo');
select is((select count(*) from public.anotacao_historico where anotacao_id = '74000000-0000-0000-0000-000000000001' and alteracoes ? 'pedido_aprovado'), 1::bigint, 'E no da anotação');
select is((select count(*) from public.contrato_historico where contrato_id = 'c0000000-0000-0000-0000-000000000001' and alteracoes ? 'pedido_aprovado'), 1::bigint, 'E no do contrato');
select is((select situacao from public.pedidos_de_participacao where id = pg_temp.pedido('70000000-0000-0000-0000-000000000002')), 'pendente', 'A lista cheia deixa o pedido pendente');
select is((select array_agg(p.situacao order by p.modulo) from public.mensagens_de_participacao m join public.pedidos_de_participacao p on p.id = m.pedido_id
           where m.perfil_id = 'a0000000-0000-0000-0000-000000000004' and m.tipo = 'resposta'),
  '{aprovado,recusado,aprovado,aprovado,aprovado,aprovado}'::text[], 'Dani recebe uma resposta por pedido respondido (anotação, compromisso, contrato, demanda, processo, tarefa)');
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.compromissos where id = '72000000-0000-0000-0000-000000000001'), 0::bigint, 'Recusada, Dani continua sem ver o compromisso');
select is((select count(*) from public.contratos_da_equipe where id = 'c0000000-0000-0000-0000-000000000001'), 1::bigint, 'Aprovada, Dani vê o contrato');
-- Quando Dani marca a resposta como lida, então só a data de leitura muda
select lives_ok($$ update public.mensagens_de_participacao set lido_em = now() $$, 'Dani marca as dela como lidas');
select throws_ok($$ update public.mensagens_de_participacao set tipo = 'pedido' $$, '42501', null, 'Só a data de leitura muda pela tela');
select throws_ok($$ insert into public.pedidos_de_participacao (escritorio_id, modulo, tarefa_id, item_codigo, pedido_por) values
  ('e0000000-0000-0000-0000-000000000001', 'tarefas', '70000000-0000-0000-0000-000000000003', 'AAAA0003', 'a0000000-0000-0000-0000-000000000004') $$, '42501', null,
  'Pedido só pela função');
reset role;
select is((select count(*) from public.mensagens_de_participacao where perfil_id = 'a0000000-0000-0000-0000-000000000004' and lido_em is null), 0::bigint, 'As respostas de Dani ficaram lidas');

-- ===== O que muda depois do pedido =====
select pg_temp.entrar(4); set local role authenticated;
select lives_ok($$ select public.participacao_pedir('tarefas', '70000000-0000-0000-0000-000000000006') $$, 'Dani pede a tarefa que depois é arquivada');
select lives_ok($$ select public.participacao_pedir('tarefas', '70000000-0000-0000-0000-000000000007') $$, 'E a tarefa cujo módulo depois é desligado');
select lives_ok($$ select public.participacao_pedir('contratos', 'c0000000-0000-0000-0000-000000000003') $$, 'E o contrato com parcelas');
reset role;
-- Quando a tarefa é arquivada depois do pedido, então ninguém aprova, mas o pedido pode ser recusado
update public.tarefas set arquivado_em = now() where id = '70000000-0000-0000-0000-000000000006';
select pg_temp.entrar(1); set local role authenticated;
select throws_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('70000000-0000-0000-0000-000000000006')), 'P0001',
  'Este item foi arquivado: ele não recebe participantes. Recuse o pedido ou desarquive o item antes.', 'O item arquivado depois do pedido não é aprovado');
select lives_ok(format('select public.participacao_responder(%L, false)', pg_temp.pedido('70000000-0000-0000-0000-000000000006')), 'Mas o pedido pode ser recusado');
reset role;
select is((select participantes from public.tarefas where id = '70000000-0000-0000-0000-000000000006'), '{}'::uuid[], 'Dani não entra na tarefa arquivada');
select is((select count(*) from public.mensagens_de_participacao m where m.pedido_id = pg_temp.pedido('70000000-0000-0000-0000-000000000006') and m.tipo = 'pedido'), 0::bigint,
  'Recusado, o pedido do item arquivado sai da caixa de quem aprovaria');
-- Quando o módulo é desligado depois do pedido, então ninguém aprova
update public.escritorios set modulos = modulos || '{"tarefas": false}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(1); set local role authenticated;
select throws_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('70000000-0000-0000-0000-000000000007')), 'P0001',
  'O módulo deste item está desligado no escritório: ele não recebe participantes.', 'O módulo desligado depois do pedido não recebe ninguém');
reset role;
update public.escritorios set modulos = modulos || '{"tarefas": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select is((select participantes from public.tarefas where id = '70000000-0000-0000-0000-000000000007'), '{}'::uuid[], 'Dani não entra na tarefa do módulo desligado');
-- Dado o financeiro ligado e o contrato com parcelas, quando o responsável (que não é administrador) aprova, então a trava da divisão recusa
update public.escritorios set modulos = modulos || '{"financeiro": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(2); set local role authenticated;
select throws_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('c0000000-0000-0000-0000-000000000003')), 'P0001',
  'Este contrato tem parcelas: só um administrador muda a divisão.', 'No contrato com parcelas, o responsável que não é administrador não aprova');
select throws_ok($$ update public.contratos set participantes = '[{"pessoa_id": "10000000-0000-0000-0000-000000000004", "percentual": 0}]' where id = 'c0000000-0000-0000-0000-000000000003' $$,
  'P0001', 'Este contrato tem parcelas: só um administrador muda a divisão.', 'É a mesma regra do lápis');
reset role;
select is((select situacao from public.pedidos_de_participacao where id = pg_temp.pedido('c0000000-0000-0000-0000-000000000003')), 'pendente', 'O pedido fica para um administrador');
select is((select participantes from public.contratos where id = 'c0000000-0000-0000-0000-000000000003'), '[]'::jsonb, 'Dani não entrou na divisão');
select pg_temp.entrar(1); set local role authenticated;
select lives_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('c0000000-0000-0000-0000-000000000003')), 'A administradora aprova no contrato com parcelas');
reset role;
select is((select participantes from public.contratos where id = 'c0000000-0000-0000-0000-000000000003'),
  '[{"pessoa_id": "10000000-0000-0000-0000-000000000004", "percentual": 0}]'::jsonb, 'Aprovado pela administradora, Dani entra com 0%');
-- Quando a pessoa de quem pediu vira a indicadora depois do pedido, então ninguém aprova (o gatilho do contrato recusa) e o pedido fica pendente
select pg_temp.entrar(4); set local role authenticated;
select lives_ok($$ select public.participacao_pedir('contratos', 'c1000000-0000-0000-0000-000000000002') $$, 'Dani pede o contrato AA11-0002-2030 (pelo id, que ela já tinha)');
reset role;
update public.contratos set indicador_id = '10000000-0000-0000-0000-000000000004', indicador_percentual = 5 where id = 'c1000000-0000-0000-0000-000000000002';
select pg_temp.entrar(1); set local role authenticated;
select throws_ok(format('select public.participacao_responder(%L, true)', pg_temp.pedido('c1000000-0000-0000-0000-000000000002')), 'P0001',
  'O indicador e os participantes precisam ser pessoas diferentes.', 'A indicadora não entra na divisão pela aprovação');
select lives_ok(format('select public.participacao_responder(%L, false)', pg_temp.pedido('c1000000-0000-0000-0000-000000000002')), 'O pedido pode ser recusado');
reset role;

-- Quando Dani é excluída da equipe, então os pedidos pendentes dela são cancelados e as mensagens dela saem
update public.perfis set ativo = false, excluido_em = now() where id = 'a0000000-0000-0000-0000-000000000004';
select is((select situacao from public.pedidos_de_participacao where id = pg_temp.pedido('70000000-0000-0000-0000-000000000002')), 'cancelado', 'O pendente de quem saiu é cancelado');
select is((select count(*) from public.mensagens_de_participacao m join public.pedidos_de_participacao p on p.id = m.pedido_id where p.pedido_por = 'a0000000-0000-0000-0000-000000000004'),
  0::bigint, 'As mensagens dos pedidos de quem saiu saem de todas as caixas');

select * from finish();
rollback;
