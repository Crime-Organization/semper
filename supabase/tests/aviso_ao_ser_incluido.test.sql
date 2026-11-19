-- Aviso na caixa de Mensagens para quem entra num item (#377).
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Beto, Caio, Dani, Eva (desativada), Gil (conta reservada) e Hugo (do
-- administrativo); e outro escritório com Fabio. A visualização está fechada (sem a chave "equipe vê tudo").
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-aviso-inclusao',
   '{"pessoas": true, "tarefas": true, "demandas": true, "processos": true, "compromissos": true, "contratos": true, "anotacoes": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-aviso-inclusao-2', '{"pessoas": true, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'dani@exemplo.test', 'Dani', 'usuario', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eva@exemplo.test', 'Eva', 'usuario', privado.resumo_codigo('c5'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'gil@exemplo.test', 'Gil', 'usuario', privado.resumo_codigo('c6'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'hugo@exemplo.test', 'Hugo', 'usuario', privado.resumo_codigo('c7'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'fabio@exemplo.test', 'Fabio', 'master', privado.resumo_codigo('c8'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e, jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana@exemplo.test'), (2, 'beto@exemplo.test'), (3, 'caio@exemplo.test'), (4, 'dani@exemplo.test'), (5, 'eva@exemplo.test'),
             (6, 'gil@exemplo.test'), (7, 'hugo@exemplo.test'), (8, 'fabio@exemplo.test')) as x(n, e);
insert into auth.sessions (id, user_id, created_at, updated_at)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now() from generate_series(1, 8) n;

set local session_replication_role = replica;
-- As pessoas de cada um (Beto é advogado, com CPF, para dar o número dos contratos), uma pessoa sem usuário e uma cliente.
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, documento, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'pf', 'ANA', null, 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'P2', 'pf', 'BETO', '12345678909', 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'P3', 'pf', 'CAIO', null, 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'P4', 'pf', 'DANI', null, 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'P5', 'pf', 'EVA', null, 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'P7', 'pf', 'CLIENTE NOVA', null, 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001', 'P8', 'pf', 'CLIENTE', null, 'a0000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', 'P9', 'pf', 'SEM USUARIO', null, 'a0000000-0000-0000-0000-000000000001');
update public.perfis set pessoa_id = ('10000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid
where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003',
             'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005');
update public.perfis set ativo = false where id = 'a0000000-0000-0000-0000-000000000005';
update public.perfis set reservada = true where id = 'a0000000-0000-0000-0000-000000000006';
update public.perfis set funcao = 'administrativo' where id = 'a0000000-0000-0000-0000-000000000007';
-- A cliente nova tem Beto (advogado) entre os responsáveis: o contrato que nasce dela é dele.
insert into public.pessoa_responsaveis (pessoa_id, perfil_id, escritorio_id, incluido_em) values
  ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', now());
-- Os itens: responsável Caio, criados por Caio, sem mais ninguém (a tarefa 6 foi criada por Dani).
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, criado_por)
select ('70000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'AAAA000' || n, 'Tarefa ' || n,
       'a0000000-0000-0000-0000-000000000003', '{}', case when n = 6 then 'a0000000-0000-0000-0000-000000000004' else 'a0000000-0000-0000-0000-000000000003' end::uuid
from generate_series(1, 7) n;
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por)
select ('71000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', 'DDDD000' || n, 'Demanda ' || n,
       'a0000000-0000-0000-0000-000000000003', '{}', 'a0000000-0000-0000-0000-000000000003'
from generate_series(1, 3) n;
insert into public.processos (id, escritorio_id, codigo, tipo, numero, titulo, responsavel_id, colaboradores, clientes, criado_por) values
  ('73000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'EEEE0001', 'judicial', '0001234-97.2026.8.13.0024', 'Processo 1',
   'a0000000-0000-0000-0000-000000000003', '{}', '{10000000-0000-0000-0000-000000000008}', 'a0000000-0000-0000-0000-000000000003');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, responsavel_id, participantes, criado_por) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'CCCC0001', 'reuniao', 'Reunião', '2030-01-15', '14:30',
   'a0000000-0000-0000-0000-000000000003', '{}', 'a0000000-0000-0000-0000-000000000003');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, clientes, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, participantes, criado_por)
select ('c0000000-0000-0000-0000-00000000000' || n)::uuid, 'e0000000-0000-0000-0000-000000000001', n, 'BE09', 2030, 'BE09-000' || n || '-2030',
       '10000000-0000-0000-0000-000000000008', '{10000000-0000-0000-0000-000000000008}', 'CLIENTE', 'a0000000-0000-0000-0000-000000000003', 'Registro de marca',
       '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, '[]', 'a0000000-0000-0000-0000-000000000003'
from generate_series(1, 2) n;
-- No outro escritório, uma tarefa de Fabio.
insert into public.tarefas (id, escritorio_id, codigo, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'AAAA0009', 'Tarefa do outro', 'a0000000-0000-0000-0000-000000000008', '{}', 'a0000000-0000-0000-0000-000000000008');
-- As colunas-marco que o contrato assinado usa para abrir as demandas e as tarefas do modelo.
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, marco)
select 'e0000000-0000-0000-0000-000000000001', m, n, o, k from (values ('contratos', 'Assinado de teste', 90, 'assinado'), ('demandas', 'Para fazer de teste', 0, 'inicio'),
  ('tarefas', 'A fazer de teste', 0, 'inicio')) as x(m, n, o, k)
where not exists (select 1 from public.quadro_colunas c where c.escritorio_id = 'e0000000-0000-0000-0000-000000000001' and c.modulo = x.m and c.marco = x.k);
insert into public.lista_modelos (escritorio_id, nome, itens) values ('e0000000-0000-0000-0000-000000000001', 'Oposição', array['Ler o pedido', 'Escrever a oposição']);
set local session_replication_role = origin;
grant usage on schema extensions to authenticated;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
grant execute on function pg_temp.entrar(int) to authenticated;
create function pg_temp.id(p_quem int) returns uuid language sql immutable as $$ select ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid $$;
grant execute on function pg_temp.id(int) to authenticated;
-- Os avisos de alguém num item, lidos como o banco (sem as regras de leitura): "papel" de cada um, na ordem.
create function pg_temp.avisos(p_quem int, p_item uuid) returns text[] language sql security definer as $$
  select coalesce(array_agg(entrou_como order by entrou_como), '{}') from public.mensagens_de_inclusao where perfil_id = pg_temp.id(p_quem) and item_id = p_item
$$;
grant execute on function pg_temp.avisos(int, uuid) to authenticated;
create function pg_temp.total() returns bigint language sql security definer as $$ select count(*) from public.mensagens_de_inclusao $$;
grant execute on function pg_temp.total() to authenticated;
-- A mensagem inteira (para conferir o campo calculado com outra pessoa logada).
create function pg_temp.aviso(p_quem int, p_item uuid) returns public.mensagens_de_inclusao language sql security definer as $$
  select m from public.mensagens_de_inclusao m where perfil_id = pg_temp.id(p_quem) and item_id = p_item order by criado_em desc limit 1
$$;
grant execute on function pg_temp.aviso(int, uuid) to authenticated;
-- Quem recebeu lê os seus avisos (como a caixa faz depois de abrir o link).
create function pg_temp.ler(p_quem int) returns void language sql security definer as $$
  update public.mensagens_de_inclusao set lido_em = now() where perfil_id = pg_temp.id(p_quem) and lido_em is null
$$;
-- O tempo passa (2 minutos, mais que o do desfazer): as mudanças seguintes começam outra sequência. Dentro da transação do teste,
-- now() não anda, e sem isto todas as mudanças contariam como uma sequência só.
create function pg_temp.passar_o_tempo() returns void language sql security definer as $$
  update privado.mudancas_na_equipe set desde = desde - interval '2 minutes', em = em - interval '2 minutes';
  update public.mensagens_de_inclusao set criado_em = criado_em - interval '2 minutes', lido_em = lido_em - interval '2 minutes';
$$;

-- ===== Incluir =====
-- Quando Ana põe Beto entre os colaboradores da demanda 1, então Beto recebe um aviso de participante, de Ana, nessa demanda
select pg_temp.entrar(1); set local role authenticated;
update public.demandas set colaboradores = colaboradores || pg_temp.id(2) where id = '71000000-0000-0000-0000-000000000001';
reset role;
select results_eq($$ select modulo, entrou_como, incluido_por, demanda_id, lido_em is null from public.mensagens_de_inclusao where perfil_id = pg_temp.id(2) $$,
  $$ values ('demandas'::text, 'participante'::text, pg_temp.id(1), '71000000-0000-0000-0000-000000000001'::uuid, true) $$, 'Beto recebe o aviso de participante da demanda, de Ana');
select is(pg_temp.avisos(3, '71000000-0000-0000-0000-000000000001'), '{}'::text[], 'O responsável, que já estava, não recebe nada');

-- Quando Ana passa a responsabilidade da tarefa 1 para Beto, então ele recebe o aviso de responsável
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set responsavel_id = pg_temp.id(2) where id = '70000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000001'), '{responsavel}'::text[], 'Beto recebe o aviso de que agora é o responsável');
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000001'), '{}'::text[], 'Caio, que deixou de ser o responsável, não recebe aviso (avisar quem sai fica para depois)');

-- Quando Ana se põe na tarefa 2, então não recebe aviso
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set participantes = participantes || pg_temp.id(1) where id = '70000000-0000-0000-0000-000000000002';
reset role;
select is(pg_temp.avisos(1, '70000000-0000-0000-0000-000000000002'), '{}'::text[], 'Quem se inclui não recebe aviso');

-- Quando Ana põe Beto, Caio e Dani na tarefa 3 de uma vez (Caio é o responsável e fica fora da lista), então cada um que entrou recebe o seu
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set responsavel_id = pg_temp.id(1), participantes = array[pg_temp.id(2), pg_temp.id(3), pg_temp.id(4)] where id = '70000000-0000-0000-0000-000000000003';
reset role;
select is(array[pg_temp.avisos(2, '70000000-0000-0000-0000-000000000003'), pg_temp.avisos(4, '70000000-0000-0000-0000-000000000003')],
  array['{participante}'::text[], '{participante}'::text[]], 'Beto e Dani recebem um aviso cada');
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000003'), '{}'::text[], 'Caio, que era o responsável e passou a participante, não recebe nada');
-- Quando Ana põe três pessoas de uma vez num item novo, então são três avisos, um para cada
select pg_temp.entrar(1); set local role authenticated;
insert into public.demandas (id, escritorio_id, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', 'Demanda nova', pg_temp.id(1), array[pg_temp.id(2), pg_temp.id(3), pg_temp.id(4)], pg_temp.id(1));
reset role;
select is((select count(distinct perfil_id) from public.mensagens_de_inclusao where item_id = '71000000-0000-0000-0000-000000000009'), 3::bigint, 'Três pessoas de uma vez: três avisos');
select is((select count(*) from public.mensagens_de_inclusao where item_id = '71000000-0000-0000-0000-000000000009'), 3::bigint, 'Um para cada, sem repetir');

-- Quando Ana cria uma tarefa com Beto de responsável e também na lista, então ele recebe um aviso só, o de responsável
select pg_temp.entrar(1); set local role authenticated;
insert into public.tarefas (id, escritorio_id, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001', 'Tarefa nova', pg_temp.id(2), array[pg_temp.id(2), pg_temp.id(4)], pg_temp.id(1));
reset role;
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000008'), '{responsavel}'::text[], 'Responsável e participante no mesmo salvamento: um aviso só, o de responsável');
select is(pg_temp.avisos(4, '70000000-0000-0000-0000-000000000008'), '{participante}'::text[], 'Quem entrou como participante recebe o seu');

-- Quando, um tempo depois, o participante Dani passa a responsável da tarefa 3, então recebe o aviso de responsável
select pg_temp.passar_o_tempo();
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set responsavel_id = pg_temp.id(4) where id = '70000000-0000-0000-0000-000000000003';
reset role;
select is(pg_temp.avisos(4, '70000000-0000-0000-0000-000000000003'), '{participante,responsavel}'::text[], 'O participante que passa a responsável recebe o de responsável');
-- Quando, um tempo depois, o responsável Beto (que já leu o aviso) passa a participante da tarefa 1, então não recebe nada novo
select pg_temp.ler(2);
select pg_temp.passar_o_tempo();
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set responsavel_id = pg_temp.id(3), participantes = array[pg_temp.id(2)] where id = '70000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000001'), '{responsavel}'::text[], 'O responsável que passa a participante não recebe nada (já estava no item)');
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000001'), '{responsavel}'::text[], 'Caio, que volta a ser o responsável depois de um tempo, recebe o aviso');

-- ===== Cada módulo =====
select pg_temp.entrar(1); set local role authenticated;
update public.processos set colaboradores = array[pg_temp.id(2)] where id = '73000000-0000-0000-0000-000000000001';
update public.compromissos set participantes = array[pg_temp.id(2)] where id = '72000000-0000-0000-0000-000000000001';
-- A anotação que nasce já compartilhada (como a cópia de uma anotação, que leva os participantes)
insert into public.anotacoes (id, titulo, texto, responsavel_id, participantes, criado_por) values
  ('74000000-0000-0000-0000-000000000001', 'Estratégia (cópia)', 'texto', pg_temp.id(1), array[pg_temp.id(2), pg_temp.id(3)], pg_temp.id(1));
reset role;
select is(pg_temp.avisos(2, '73000000-0000-0000-0000-000000000001'), '{participante}'::text[], 'No processo, o colaborador novo recebe');
select is(pg_temp.avisos(2, '72000000-0000-0000-0000-000000000001'), '{participante}'::text[], 'No compromisso, o participante novo recebe');
select is(array[pg_temp.avisos(2, '74000000-0000-0000-0000-000000000001'), pg_temp.avisos(3, '74000000-0000-0000-0000-000000000001')],
  array['{participante}'::text[], '{participante}'::text[]], 'A anotação nova (como a cópia) avisa cada pessoa com quem foi compartilhada');

-- No contrato: a pessoa de cada participante da divisão (todo participante tem usuário); quem está desativado não recebe
select pg_temp.entrar(1); set local role authenticated;
update public.contratos set participantes = '[{"pessoa_id": "10000000-0000-0000-0000-000000000002", "percentual": 10},
  {"pessoa_id": "10000000-0000-0000-0000-000000000005", "percentual": 0}]'
where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.avisos(2, 'c0000000-0000-0000-0000-000000000001'), '{participante}'::text[], 'No contrato, Beto (pela pessoa dele) recebe');
select is((select count(*) from public.mensagens_de_inclusao where item_id = 'c0000000-0000-0000-0000-000000000001'), 1::bigint,
  'A participante desativada não recebe');
-- Quando Ana muda só o percentual de Beto (que já leu o aviso), então nada muda
select pg_temp.ler(2);
select pg_temp.entrar(1); set local role authenticated;
update public.contratos set participantes = '[{"pessoa_id": "10000000-0000-0000-0000-000000000002", "percentual": 20},
  {"pessoa_id": "10000000-0000-0000-0000-000000000005", "percentual": 0}]'
where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is((select lido_em is not null from public.mensagens_de_inclusao where perfil_id = pg_temp.id(2) and item_id = 'c0000000-0000-0000-0000-000000000001'), true,
  'Mudar só o percentual não avisa de novo');
-- Quando Ana troca o responsável do contrato para Dani, então Dani recebe o de responsável
select pg_temp.entrar(1); set local role authenticated;
update public.contratos set responsavel_id = pg_temp.id(4) where id = 'c0000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.avisos(4, 'c0000000-0000-0000-0000-000000000001'), '{responsavel}'::text[], 'No contrato, o novo responsável recebe');
-- Quando a versão anterior do site grava só as colunas antigas do participante, então o aviso chega do mesmo jeito
select pg_temp.entrar(1); set local role authenticated;
update public.contratos set participante_id = '10000000-0000-0000-0000-000000000004', participante_percentual = 0 where id = 'c0000000-0000-0000-0000-000000000002';
reset role;
select is(pg_temp.avisos(4, 'c0000000-0000-0000-0000-000000000002'), '{participante}'::text[], 'Pelas colunas antigas (versão anterior do site), Dani recebe');

-- ===== Quem não recebe =====
-- Quando Ana põe Eva (desativada) e Gil (conta reservada) na tarefa 4, então nenhum dos dois recebe
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set participantes = array[pg_temp.id(5), pg_temp.id(6)] where id = '70000000-0000-0000-0000-000000000004';
reset role;
select is((select count(*) from public.mensagens_de_inclusao where item_id = '70000000-0000-0000-0000-000000000004'), 0::bigint, 'Desativada e conta reservada não recebem');
-- Quando o próprio banco muda a equipe (uma rotina, uma importação, o SQL), então ninguém recebe
update public.tarefas set participantes = array[pg_temp.id(2)] where id = '70000000-0000-0000-0000-000000000005';
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000005'), '{}'::text[], 'Sem ninguém logado (rotina, importação), não há aviso');
-- Quando algo que não é a equipe muda (título, situação), então nenhum aviso novo
create temp table antes_de_mexer as select pg_temp.total() as total;
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set titulo = 'Outro título' where id = '70000000-0000-0000-0000-000000000003';
update public.demandas set titulo = 'Outro título', etapa_ordem = 5 where id = '71000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.total(), (select total from antes_de_mexer), 'Mudar o título ou a ordem não cria aviso');

-- ===== O pedido aprovado =====
-- Dado que Dani pediu para participar da tarefa 7, quando Caio (o responsável) aprova, então Dani recebe só a resposta, sem o aviso de inclusão
select pg_temp.entrar(4); set local role authenticated;
select lives_ok($$ select public.participacao_pedir('tarefas', '70000000-0000-0000-0000-000000000007') $$, 'Dani pede para participar');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select lives_ok($$ select public.participacao_responder((select id from public.pedidos_de_participacao where item_id = '70000000-0000-0000-0000-000000000007'), true) $$, 'Caio aprova');
reset role;
select is((select participantes from public.tarefas where id = '70000000-0000-0000-0000-000000000007'), array[pg_temp.id(4)], 'Dani entrou na tarefa');
select is((select count(*) from public.mensagens_de_participacao where perfil_id = pg_temp.id(4) and tipo = 'resposta'), 1::bigint, 'Dani tem a resposta');
select is(pg_temp.avisos(4, '70000000-0000-0000-0000-000000000007'), '{}'::text[], 'E nenhum aviso de inclusão repetido');

-- ===== Criações automáticas =====
-- Quando Hugo (do administrativo) move a cliente para "Contrato fechado", então o contrato nasce de Beto (o advogado dela), sem aviso:
-- quem escolhe o responsável é o sistema
select pg_temp.entrar(7); set local role authenticated;
create temp table fechado as select (public.pessoa_fechar_contrato('10000000-0000-0000-0000-000000000007') ->> 'id')::uuid as id;
reset role;
select is((select responsavel_id from public.contratos where id = (select id from fechado)), pg_temp.id(2), 'O contrato nasce do advogado da cliente');
select is(pg_temp.avisos(2, (select id from fechado)), '{}'::text[], 'O contrato que o sistema cria não avisa');
-- Quando Ana assina esse contrato, então as demandas e as tarefas que nascem sozinhas (de Beto) não avisam
select pg_temp.entrar(1); set local role authenticated;
update public.contratos set objetos = array['Oposição'],
  etapa_id = (select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'contratos' and marco = 'assinado' limit 1)
where id = (select id from fechado);
reset role;
select ok((select count(*) from public.demandas where contrato_id = (select id from fechado)) > 0
  and (select count(*) from public.tarefas t join public.demandas d on d.id = t.demanda_id where d.contrato_id = (select id from fechado)) > 0, 'O contrato assinado abriu demandas e tarefas');
select is((select count(*) from public.mensagens_de_inclusao where perfil_id = pg_temp.id(2) and (demanda_id is not null or tarefa_id is not null)
  and item_id in (select d.id from public.demandas d where d.contrato_id = (select id from fechado)
                  union select t.id from public.tarefas t join public.demandas d on d.id = t.demanda_id where d.contrato_id = (select id from fechado))), 0::bigint,
  'As demandas e as tarefas criadas sozinhas não avisam');

-- ===== Sair, desfazer e entrar de novo =====
-- Quando Ana põe Beto na demanda 2 e desfaz logo em seguida (antes de ele ler), então o aviso some
select pg_temp.entrar(1); set local role authenticated;
update public.demandas set colaboradores = colaboradores || pg_temp.id(2) where id = '71000000-0000-0000-0000-000000000002';
update public.demandas set colaboradores = '{}' where id = '71000000-0000-0000-0000-000000000002';
reset role;
select is(pg_temp.avisos(2, '71000000-0000-0000-0000-000000000002'), '{}'::text[], 'Desfazer logo depois de incluir apaga o aviso que ainda não foi lido');
-- Quando Ana troca o responsável da tarefa 5 de Caio para Dani e desfaz logo, então o aviso de Dani some e Caio, que volta, não
-- recebe nada (para ele, nada mudou)
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set responsavel_id = pg_temp.id(4) where id = '70000000-0000-0000-0000-000000000005';
update public.tarefas set responsavel_id = pg_temp.id(3) where id = '70000000-0000-0000-0000-000000000005';
reset role;
select is(pg_temp.avisos(4, '70000000-0000-0000-0000-000000000005'), '{}'::text[], 'Desfazer a troca do responsável apaga o aviso de quem deixou de ser');
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000005'), '{}'::text[], 'Quem volta a ser o responsável no desfazer não recebe aviso');
-- Quando Ana tira Beto da tarefa 5 (em que ele estava sem aviso nenhum) e desfaz logo, então ele não recebe "incluiu você"
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set participantes = '{}' where id = '70000000-0000-0000-0000-000000000005';
update public.tarefas set participantes = array[pg_temp.id(2)] where id = '70000000-0000-0000-0000-000000000005';
reset role;
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000005'), '{}'::text[], 'Tirar e desfazer: quem nunca saiu de fato não recebe aviso');
-- Dado Beto participante da tarefa 2 (já leu o aviso) e Caio o responsável, quando Ana põe Beto como responsável (Caio passa a
-- participante) e desfaz logo, então o aviso de responsável de Beto some e Caio não recebe nada
select pg_temp.passar_o_tempo();
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set participantes = participantes || pg_temp.id(2) where id = '70000000-0000-0000-0000-000000000002';
reset role;
select pg_temp.ler(2);
select pg_temp.passar_o_tempo();
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set responsavel_id = pg_temp.id(2), participantes = array[pg_temp.id(1), pg_temp.id(3)] where id = '70000000-0000-0000-0000-000000000002';
reset role;
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000002'), '{participante,responsavel}'::text[], 'O participante posto como responsável recebe o aviso');
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set responsavel_id = pg_temp.id(3), participantes = array[pg_temp.id(1), pg_temp.id(2)] where id = '70000000-0000-0000-0000-000000000002';
reset role;
select results_eq($$ select entrou_como, lido_em is not null from public.mensagens_de_inclusao where perfil_id = pg_temp.id(2) and item_id = '70000000-0000-0000-0000-000000000002' $$,
  $$ values ('participante'::text, true) $$, 'Desfazer a promoção apaga o aviso de responsável e deixa só o de participante, já lido');
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000002'), '{}'::text[], 'Quem volta a ser o responsável no desfazer não recebe aviso');
-- Quando Ana põe Beto como responsável da tarefa 4 e logo depois o passa a participante (antes de ele ler), então ele fica com o
-- aviso de participante, não com o de responsável
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set responsavel_id = pg_temp.id(2) where id = '70000000-0000-0000-0000-000000000004';
update public.tarefas set responsavel_id = pg_temp.id(1), participantes = participantes || pg_temp.id(2) where id = '70000000-0000-0000-0000-000000000004';
reset role;
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000004'), '{participante}'::text[], 'Posto como responsável e logo passado a participante: o aviso é o de participante');
-- Quando o aviso tem mais que o tempo do desfazer, então sair do item não o apaga
select pg_temp.entrar(1); set local role authenticated;
update public.demandas set colaboradores = array[pg_temp.id(2)] where id = '71000000-0000-0000-0000-000000000002';
reset role;
select pg_temp.passar_o_tempo();
select pg_temp.entrar(1); set local role authenticated;
update public.demandas set colaboradores = '{}' where id = '71000000-0000-0000-0000-000000000002';
reset role;
select is(pg_temp.avisos(2, '71000000-0000-0000-0000-000000000002'), '{participante}'::text[], 'O aviso antigo fica, para a pessoa ver que não faz mais parte');
-- Quando Ana tira Beto (que já leu) da demanda 1 e desfaz logo, então o aviso dele não volta a ser novo
select pg_temp.ler(2);
select pg_temp.passar_o_tempo();
select pg_temp.entrar(1); set local role authenticated;
update public.demandas set colaboradores = '{}' where id = '71000000-0000-0000-0000-000000000001';
update public.demandas set colaboradores = array[pg_temp.id(2)] where id = '71000000-0000-0000-0000-000000000001';
reset role;
select results_eq($$ select entrou_como, lido_em is not null from public.mensagens_de_inclusao where perfil_id = pg_temp.id(2) and item_id = '71000000-0000-0000-0000-000000000001' $$,
  $$ values ('participante'::text, true) $$, 'Tirar e desfazer: o aviso lido continua lido, sem "incluiu você" de novo');
-- Quando Beto sai da demanda 1 e entra de novo um tempo depois, então continua uma linha só, que volta a ser nova
select pg_temp.passar_o_tempo();
select pg_temp.entrar(1); set local role authenticated;
update public.demandas set colaboradores = '{}' where id = '71000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.passar_o_tempo();
select pg_temp.entrar(1); set local role authenticated;
update public.demandas set colaboradores = array[pg_temp.id(2)] where id = '71000000-0000-0000-0000-000000000001';
reset role;
select results_eq($$ select entrou_como, lido_em is null from public.mensagens_de_inclusao where perfil_id = pg_temp.id(2) and item_id = '71000000-0000-0000-0000-000000000001' $$,
  $$ values ('participante'::text, true) $$, 'Entrar de novo não repete a linha: ela volta a ser não lida');

-- ===== Quem foi retirado =====
-- Dado que Beto (que já leu) foi retirado do processo, quando lê a caixa, então a mensagem continua, mas ele não faz mais parte nem vê o processo
select pg_temp.ler(2);
select pg_temp.entrar(1); set local role authenticated;
update public.processos set colaboradores = '{}' where id = '73000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.mensagens_de_inclusao where item_id = '73000000-0000-0000-0000-000000000001'), 1::bigint, 'A mensagem de quem foi retirado continua');
select is((select public.ainda_faz_parte(m) from public.mensagens_de_inclusao m where item_id = '73000000-0000-0000-0000-000000000001'), false, 'Beto não faz mais parte do processo');
select is((select count(*) from public.mensagens_de_inclusao m join public.processos p on p.id = m.processo_id where m.item_id = '73000000-0000-0000-0000-000000000001'), 0::bigint,
  'Com a visualização fechada, a ligação com o processo vem vazia');
select is((select public.ainda_faz_parte(m) from public.mensagens_de_inclusao m where item_id = '71000000-0000-0000-0000-000000000001'), true, 'Na demanda em que está, Beto faz parte');
reset role;
-- Quando a chave "equipe vê tudo" está ligada, então Beto vê o processo, mas continua sem fazer parte dele
update public.escritorios set modulos = modulos || '{"equipe_ve_tudo": true}' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*) from public.processos where id = '73000000-0000-0000-0000-000000000001'), 1::bigint, 'Com a chave ligada, Beto vê o processo');
select is((select public.ainda_faz_parte(m) from public.mensagens_de_inclusao m where item_id = '73000000-0000-0000-0000-000000000001'), false, 'Mas não faz mais parte dele');
reset role;
update public.escritorios set modulos = modulos - 'equipe_ve_tudo' where id = 'e0000000-0000-0000-0000-000000000001';
-- Quando Caio põe Ana (administradora) na demanda 3 e a tira depois, então ela vê a demanda (por ser administradora), mas não faz mais parte
select pg_temp.entrar(3); set local role authenticated;
update public.demandas set colaboradores = array[pg_temp.id(1)] where id = '71000000-0000-0000-0000-000000000003';
reset role;
select pg_temp.ler(1);
select pg_temp.entrar(3); set local role authenticated;
update public.demandas set colaboradores = '{}' where id = '71000000-0000-0000-0000-000000000003';
reset role;
select pg_temp.entrar(1); set local role authenticated;
select is((select count(*) from public.demandas where id = '71000000-0000-0000-0000-000000000003'), 1::bigint, 'A administradora vê a demanda');
select is((select public.ainda_faz_parte(m) from public.mensagens_de_inclusao m where item_id = '71000000-0000-0000-0000-000000000003'), false, 'Mas não faz mais parte dela');
reset role;
-- Quando Ana põe Dani na tarefa 6 (que Dani criou) e a tira depois, então Dani vê a tarefa (por tê-la criado), mas não faz mais parte
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set participantes = array[pg_temp.id(4)] where id = '70000000-0000-0000-0000-000000000006';
reset role;
select pg_temp.ler(4);
select pg_temp.entrar(1); set local role authenticated;
update public.tarefas set participantes = '{}' where id = '70000000-0000-0000-0000-000000000006';
reset role;
select pg_temp.entrar(4); set local role authenticated;
select is((select count(*) from public.tarefas where id = '70000000-0000-0000-0000-000000000006'), 1::bigint, 'Quem criou a tarefa a vê');
select is((select public.ainda_faz_parte(m) from public.mensagens_de_inclusao m where item_id = '70000000-0000-0000-0000-000000000006'), false, 'Mas não faz mais parte dela');
-- O campo calculado só responde sobre quem está logado: a mensagem de outra pessoa dá falso
select is(public.ainda_faz_parte(pg_temp.aviso(2, '71000000-0000-0000-0000-000000000001')), false, 'Sobre a mensagem de outra pessoa, o campo calculado não conta nada');
reset role;

-- ===== Regras de acesso =====
select pg_temp.entrar(2); set local role authenticated;
select ok((select count(*) from public.mensagens_de_inclusao) > 0, 'Beto lê os seus avisos');
select is((select count(*) from public.mensagens_de_inclusao where perfil_id <> pg_temp.id(2)), 0::bigint, 'E só os seus');
select throws_ok($$ insert into public.mensagens_de_inclusao (escritorio_id, perfil_id, modulo, entrou_como, tarefa_id)
  values ('e0000000-0000-0000-0000-000000000001', pg_temp.id(2), 'tarefas', 'participante', '70000000-0000-0000-0000-000000000005') $$, '42501', null, 'Ninguém cria aviso pela tela');
select throws_ok($$ delete from public.mensagens_de_inclusao $$, '42501', null, 'Nem apaga');
select throws_ok($$ update public.mensagens_de_inclusao set entrou_como = 'responsavel' $$, '42501', null, 'Só a data de leitura muda');
select throws_ok($$ select count(*) from privado.mudancas_na_equipe $$, '42501', null, 'As sequências de mudanças não se leem pela tela');
select lives_ok($$ update public.mensagens_de_inclusao set lido_em = now() $$, 'Beto marca os seus como lidos');
reset role;
select pg_temp.entrar(3); set local role authenticated;
update public.mensagens_de_inclusao set lido_em = null where perfil_id = pg_temp.id(2);
reset role;
select is((select count(*) from public.mensagens_de_inclusao where perfil_id = pg_temp.id(2) and lido_em is null), 0::bigint, 'Caio não mexe nos avisos de Beto');
select pg_temp.entrar(8); set local role authenticated;
select is((select count(*) from public.mensagens_de_inclusao), 0::bigint, 'Fabio, do outro escritório, não lê nenhum');
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.mensagens_de_inclusao $$, '42501', null, 'Quem não entrou não lê nada');
reset role;

-- ===== Quem saiu da equipe =====
-- Quando Dani é excluída da equipe, então os avisos dela saem
update public.perfis set ativo = false, excluido_em = now() where id = pg_temp.id(4);
select is((select count(*) from public.mensagens_de_inclusao where perfil_id = pg_temp.id(4)), 0::bigint, 'Os avisos de quem foi excluído saem');

-- ===== A versão anterior do site =====
-- Ela lê só as tabelas de sempre: nenhuma delas ganhou um tipo novo
select is((select count(*) from public.mensagens where tipo not in ('mencao', 'prazo')), 0::bigint, 'A caixa de sempre não tem tipo novo');
select is((select count(*) from public.mensagens_de_participacao where tipo not in ('pedido', 'resposta')), 0::bigint, 'A dos pedidos também não');

select * from finish();
rollback;
