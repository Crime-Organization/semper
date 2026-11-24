-- O processo administrativo ligado ao judicial que nasceu dele, e os campos de PI fora do judicial (#425). Roda num banco local:
-- supabase db start && supabase test db. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo é desfeito no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Bia (usuária comum), e o Davi em outro escritório.
insert into public.escritorios (id, nome, slug) values
  ('e4250000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-425'),
  ('e4250000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-425-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e4250000-0000-0000-0000-000000000001', 'ana-425@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c4251'), now()),
  ('e4250000-0000-0000-0000-000000000001', 'bia-425@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c4252'), now()),
  ('e4250000-0000-0000-0000-000000000002', 'davi-425@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4254'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a4250000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana-425@exemplo.test', '{"convite":"c4251"}', now(), now()),
  ('a4250000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia-425@exemplo.test', '{"convite":"c4252"}', now(), now()),
  ('a4250000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi-425@exemplo.test', '{"convite":"c4254"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('54250000-0000-0000-0000-000000000001', 'a4250000-0000-0000-0000-000000000001', now(), now()),
  ('54250000-0000-0000-0000-000000000002', 'a4250000-0000-0000-0000-000000000002', now(), now()),
  ('54250000-0000-0000-0000-000000000004', 'a4250000-0000-0000-0000-000000000004', now(), now());

-- Os processos, gravados direto (sem os gatilhos de cadastro):
--   AD1: administrativo de previdência da Ana, com a Bia; AD2: administrativo só da Ana; JU1: judicial da Ana, com a Bia;
--   JU2: judicial só da Ana; JU3: judicial arquivado; RE1: recurso do JU1; JU9: judicial do outro escritório.
set local session_replication_role = replica;
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('14250000-0000-0000-0000-000000000001', 'e4250000-0000-0000-0000-000000000001', 'C1', 'contato', 'CLIENTE TESTE', 'a4250000-0000-0000-0000-000000000001'),
  ('14250000-0000-0000-0000-000000000009', 'e4250000-0000-0000-0000-000000000002', 'F1', 'contato', 'PESSOA DE FORA', 'a4250000-0000-0000-0000-000000000004');
insert into public.processos (id, escritorio_id, codigo, tipo, numero, area, responsavel_id, colaboradores, clientes, criado_por, arquivado_em, origem_id, ligacao) values
  ('74250000-0000-0000-0000-000000000001', 'e4250000-0000-0000-0000-000000000001', 'AD1', 'administrativo', 'A1', 'Previdenciário', 'a4250000-0000-0000-0000-000000000001',
   '{a4250000-0000-0000-0000-000000000002}', '{14250000-0000-0000-0000-000000000001}', 'a4250000-0000-0000-0000-000000000001', null, null, null),
  ('74250000-0000-0000-0000-000000000002', 'e4250000-0000-0000-0000-000000000001', 'AD2', 'administrativo', 'A2', null, 'a4250000-0000-0000-0000-000000000001',
   '{}', '{14250000-0000-0000-0000-000000000001}', 'a4250000-0000-0000-0000-000000000001', null, null, null),
  ('74250000-0000-0000-0000-000000000011', 'e4250000-0000-0000-0000-000000000001', 'JU1', 'judicial', 'J1', null, 'a4250000-0000-0000-0000-000000000001',
   '{a4250000-0000-0000-0000-000000000002}', '{14250000-0000-0000-0000-000000000001}', 'a4250000-0000-0000-0000-000000000001', null, null, null),
  ('74250000-0000-0000-0000-000000000012', 'e4250000-0000-0000-0000-000000000001', 'JU2', 'judicial', 'J2', null, 'a4250000-0000-0000-0000-000000000001',
   '{}', '{14250000-0000-0000-0000-000000000001}', 'a4250000-0000-0000-0000-000000000001', null, null, null),
  ('74250000-0000-0000-0000-000000000013', 'e4250000-0000-0000-0000-000000000001', 'JU3', 'judicial', 'J3', null, 'a4250000-0000-0000-0000-000000000001',
   '{}', '{14250000-0000-0000-0000-000000000001}', 'a4250000-0000-0000-0000-000000000001', now(), null, null),
  ('74250000-0000-0000-0000-000000000021', 'e4250000-0000-0000-0000-000000000001', 'RE1', 'judicial', 'R1', null, 'a4250000-0000-0000-0000-000000000001',
   '{}', '{14250000-0000-0000-0000-000000000001}', 'a4250000-0000-0000-0000-000000000001', null, '74250000-0000-0000-0000-000000000011', 'recurso'),
  ('74250000-0000-0000-0000-000000000019', 'e4250000-0000-0000-0000-000000000002', 'JU9', 'judicial', 'J9', null, 'a4250000-0000-0000-0000-000000000004',
   '{}', '{14250000-0000-0000-0000-000000000009}', 'a4250000-0000-0000-0000-000000000004', null, null, null);
set local session_replication_role = origin;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a4250000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '54250000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;

-- ---------- 1. O judicial que nasce do administrativo ----------
select pg_temp.entrar(1); set local role authenticated;
-- Quando a Ana cadastra o judicial a partir do administrativo, então ele nasce ligado a ele.
select lives_ok($$ insert into public.processos (id, tipo, numero, responsavel_id, clientes, criado_por, origem_id, ligacao) values
  ('74250000-0000-0000-0000-000000000031', 'judicial', 'J31', auth.uid(), '{14250000-0000-0000-0000-000000000001}', auth.uid(),
   '74250000-0000-0000-0000-000000000001', 'judicial') $$,
  'Quando cadastra o judicial a partir do administrativo, então ele é gravado');
select is((select origem_id::text || '/' || ligacao from public.processos where id = '74250000-0000-0000-0000-000000000031'),
  '74250000-0000-0000-0000-000000000001/judicial', 'Então o judicial guarda o administrativo de origem');
-- Quando o novo da ligação "judicial" é administrativo, ou a origem é judicial, então é recusado.
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por, origem_id, ligacao) values
  ('administrativo', 'A32', auth.uid(), '{14250000-0000-0000-0000-000000000001}', auth.uid(), '74250000-0000-0000-0000-000000000001', 'judicial') $$,
  'P0001', 'Só um processo judicial pode ser ligado a um processo administrativo.', 'Quando o novo não é judicial, então é recusado');
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por, origem_id, ligacao) values
  ('judicial', 'J33', auth.uid(), '{14250000-0000-0000-0000-000000000001}', auth.uid(), '74250000-0000-0000-0000-000000000012', 'judicial') $$,
  'P0001', 'Só um processo judicial pode ser ligado a um processo administrativo.', 'Quando a origem é judicial, então é recusado');
-- Quando a ligação não é da lista, então é recusado.
select throws_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por, origem_id, ligacao) values
  ('judicial', 'J34', auth.uid(), '{14250000-0000-0000-0000-000000000001}', auth.uid(), '74250000-0000-0000-0000-000000000001', 'outra') $$,
  '23514', null, 'Quando a ligação não é da lista, então é recusado');
-- Então o recurso e o incidental continuam como antes (a origem de qualquer tipo).
select lives_ok($$ insert into public.processos (tipo, numero, responsavel_id, clientes, criado_por, origem_id, ligacao) values
  ('administrativo', 'A35', auth.uid(), '{14250000-0000-0000-0000-000000000001}', auth.uid(), '74250000-0000-0000-0000-000000000001', 'recurso') $$,
  'Então o recurso do administrativo continua sendo gravado');
-- Quando muda a ligação ou a origem direto na tabela, então é recusado (continuam fora do que se altera).
select throws_ok($$ update public.processos set ligacao = null where id = '74250000-0000-0000-0000-000000000031' $$,
  '42501', null, 'Quando muda a ligação direto na tabela, então é recusado');

-- ---------- 2. Ligar um judicial que já existe ----------
-- Quando a Ana liga o JU1 ao AD1, então ele fica ligado, e a ligação entra no histórico do JU1.
select lives_ok($$ select public.processo_judicial_ligar('74250000-0000-0000-0000-000000000001', '74250000-0000-0000-0000-000000000011') $$,
  'Quando liga um judicial existente ao administrativo, então funciona');
select is((select origem_id::text || '/' || ligacao from public.processos where id = '74250000-0000-0000-0000-000000000011'),
  '74250000-0000-0000-0000-000000000001/judicial', 'Então o judicial fica ligado ao administrativo');
select ok(exists (select 1 from public.processo_historico where processo_id = '74250000-0000-0000-0000-000000000011' and alteracoes ? 'origem_id' and alteracoes ? 'ligacao'),
  'Então a ligação entra no histórico do judicial');
-- Quando liga de novo o mesmo judicial (ou o recurso, que já tem origem), então é recusado.
select throws_ok($$ select public.processo_judicial_ligar('74250000-0000-0000-0000-000000000002', '74250000-0000-0000-0000-000000000011') $$,
  'P0001', 'Este processo judicial já está ligado a outro processo.', 'Quando o judicial já está ligado, então é recusado');
select throws_ok($$ select public.processo_judicial_ligar('74250000-0000-0000-0000-000000000001', '74250000-0000-0000-0000-000000000021') $$,
  'P0001', 'Este processo judicial já está ligado a outro processo.', 'Quando o judicial é um recurso, então é recusado');
-- Quando os tipos estão trocados, então é recusado.
select throws_ok($$ select public.processo_judicial_ligar('74250000-0000-0000-0000-000000000012', '74250000-0000-0000-0000-000000000002') $$,
  'P0001', 'Só um processo judicial pode ser ligado a um processo administrativo.', 'Quando os tipos estão trocados, então é recusado');
-- Quando o judicial está arquivado, então é recusado.
select throws_ok($$ select public.processo_judicial_ligar('74250000-0000-0000-0000-000000000002', '74250000-0000-0000-0000-000000000013') $$,
  'P0001', 'Processo arquivado não recebe ligação nova.', 'Quando o judicial está arquivado, então é recusado');
-- Quando o judicial é de outro escritório, então é recusado.
select throws_ok($$ select public.processo_judicial_ligar('74250000-0000-0000-0000-000000000002', '74250000-0000-0000-0000-000000000019') $$,
  '42501', null, 'Quando o judicial é de outro escritório, então é recusado');
reset role;

-- Quando a Bia (que não está no AD2) liga o JU2 ao AD2, então é recusado; e o JU2 ao AD1 (ela não está no JU2), também.
select pg_temp.entrar(2); set local role authenticated;
select throws_ok($$ select public.processo_judicial_ligar('74250000-0000-0000-0000-000000000002', '74250000-0000-0000-0000-000000000012') $$,
  '42501', null, 'Quando quem liga não está no administrativo, então é recusado');
select throws_ok($$ select public.processo_judicial_ligar('74250000-0000-0000-0000-000000000001', '74250000-0000-0000-0000-000000000012') $$,
  '42501', null, 'Quando quem liga não está no judicial, então é recusado');

-- ---------- 3. Desfazer a ligação ----------
-- Quando a Bia (que está nos dois) desfaz a ligação do JU1, então ele fica sem origem.
select lives_ok($$ select public.processo_judicial_desligar('74250000-0000-0000-0000-000000000011') $$, 'Quando desfaz a ligação, então funciona');
select ok((select origem_id is null and ligacao is null from public.processos where id = '74250000-0000-0000-0000-000000000011'),
  'Então o judicial fica sem a origem');
reset role;
-- Quando a Bia desfaz a ligação do J31 (ela não está nele, mas está no administrativo), então funciona.
select pg_temp.entrar(2); set local role authenticated;
select lives_ok($$ select public.processo_judicial_desligar('74250000-0000-0000-0000-000000000031') $$,
  'Quando quem desfaz está só no administrativo, então funciona');
-- Quando tenta desfazer um recurso, então é recusado (só a ligação "judicial" se desfaz).
select throws_ok($$ select public.processo_judicial_desligar('74250000-0000-0000-0000-000000000021') $$,
  '42501', null, 'Quando tenta desligar um recurso, então é recusado');
reset role;
select is((select origem_id::text from public.processos where id = '74250000-0000-0000-0000-000000000021'), '74250000-0000-0000-0000-000000000011',
  'Então o recurso continua ligado');
-- Quando o Davi (outro escritório) tenta desligar, então é recusado.
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$ select public.processo_judicial_ligar('74250000-0000-0000-0000-000000000002', '74250000-0000-0000-0000-000000000012') $$, 'Dado o JU2 ligado ao AD2');
reset role;
select pg_temp.entrar(4); set local role authenticated;
select throws_ok($$ select public.processo_judicial_desligar('74250000-0000-0000-0000-000000000012') $$,
  '42501', null, 'Quando alguém de outro escritório tenta desligar, então é recusado');
reset role;

-- ---------- 4. PI só no administrativo ----------
select pg_temp.entrar(1); set local role authenticated;
-- Quando o site antigo grava campos de PI num judicial, então ele é gravado, mas os campos ficam vazios.
select lives_ok($$ insert into public.processos (id, tipo, numero, area, responsavel_id, clientes, criado_por, protecao, deposito, classes_nice, especificacao) values
  ('74250000-0000-0000-0000-000000000041', 'judicial', 'J41', 'Propriedade intelectual', auth.uid(), '{14250000-0000-0000-0000-000000000001}', auth.uid(),
   'marca', '2020-03-10', '{9,35}', 'Roupas') $$,
  'Quando grava PI num judicial, então o processo é gravado');
select is((select row(protecao, deposito, cardinality(classes_nice), especificacao)::text from public.processos where id = '74250000-0000-0000-0000-000000000041'),
  row(null::text, null::date, 0, null::text)::text, 'Então o judicial fica sem os campos de PI');
select lives_ok($$ update public.processos set protecao = 'patente_invencao', deposito = '2020-01-01' where id = '74250000-0000-0000-0000-000000000041' $$,
  'Quando altera PI num judicial, então a alteração é gravada');
select is((select row(protecao, deposito)::text from public.processos where id = '74250000-0000-0000-0000-000000000041'), row(null::text, null::date)::text,
  'Então os campos de PI continuam vazios');
-- Quando grava PI num administrativo, então os campos ficam.
select lives_ok($$ update public.processos set area = 'Propriedade intelectual', protecao = 'marca', deposito = '2020-03-10'
  where id = '74250000-0000-0000-0000-000000000002' $$, 'Quando grava PI no administrativo, então funciona');
select is((select protecao from public.processos where id = '74250000-0000-0000-0000-000000000002'), 'marca', 'Então o administrativo guarda o tipo de proteção');
reset role;

-- A limpeza da migração: um judicial com PI gravado antes (direto, sem os gatilhos) fica vazio ao rodar a mesma limpeza.
set local session_replication_role = replica;
update public.processos set protecao = 'marca', deposito = '2020-03-10', linguagem = 'X' where id = '74250000-0000-0000-0000-000000000012';
set local session_replication_role = origin;
update public.processos set protecao = null
where tipo = 'judicial'
  and (protecao is not null or deposito is not null or concessao is not null or publicacao is not null or criacao is not null
       or apresentacao_marca is not null or natureza_marca is not null or cardinality(classes_nice) > 0 or especificacao is not null
       or variacoes is not null or linguagem is not null);
select is((select row(protecao, deposito, linguagem)::text from public.processos where id = '74250000-0000-0000-0000-000000000012'),
  row(null::text, null::date, null::text)::text, 'Então a limpeza apaga todos os campos de PI do judicial');
select is((select protecao from public.processos where id = '74250000-0000-0000-0000-000000000002'), 'marca', 'Então a limpeza não mexe no administrativo');

select * from finish();
rollback;
