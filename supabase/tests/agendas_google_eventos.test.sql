-- Agendas do escritório no Google Agenda (#166, parte 2): os eventos. Os gatilhos que põem os itens na fila (só quando
-- mudam os campos que vão ao Google), os itens em aberto ao ligar e ao nascer uma agenda, o item como o servidor o lê, as
-- cópias gravadas e quem as vê.
-- Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (master) e Beto (usuário), e outro com Fabio (master); o primeiro com a agenda autorizada e
-- as agendas ainda desligadas, o segundo só com os contatos.
insert into public.escritorios (id, nome, slug) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-eventos-google'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-eventos-google-2');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'beto@exemplo.test', 'Beto', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'fabio@exemplo.test', 'Fabio', 'master', privado.resumo_codigo('c3'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', e, jsonb_build_object('convite', 'c' || n), now(), now()
from (values (1, 'ana@exemplo.test'), (2, 'beto@exemplo.test'), (3, 'fabio@exemplo.test')) as x(n, e);
insert into auth.sessions (id, user_id, created_at, updated_at)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now() from generate_series(1, 3) n;
insert into privado.ligacoes (escritorio_id, provedor, conta_email, escopos, segredo_id)
values ('e0000000-0000-0000-0000-000000000001', 'google', 'contato@exemplo.test',
        '{https://www.googleapis.com/auth/contacts,https://www.googleapis.com/auth/calendar.app.created,https://www.googleapis.com/auth/calendar.acls}',
        vault.create_secret('token-1', 'teste-eventos-1')),
       ('e0000000-0000-0000-0000-000000000002', 'google', 'outro@exemplo.test', '{https://www.googleapis.com/auth/contacts}', vault.create_secret('token-2', 'teste-eventos-2'));

grant usage on schema extensions to authenticated;
create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
grant execute on function pg_temp.entrar(int) to authenticated;
create function pg_temp.hoje() returns date language sql as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
-- A versão do pedido do item na fila (null: não está na fila).
create function pg_temp.na_fila(p_assunto text, p_item uuid) returns integer language sql as $$
  select versao from public.agendas_google_fila where assunto = p_assunto and item_id = p_item
$$;

-- E os itens: uma sala; um compromisso de amanhã da Ana com o Beto, na sala; um de ontem; uma tarefa do Beto com prazo
-- daqui a 5 dias; uma demanda da Ana sem prazo; um contrato da Ana com uma parcela a vencer e uma vencida; um dia sem
-- expediente; e, no outro escritório, um dia sem expediente.
set local session_replication_role = replica;
insert into public.salas (id, escritorio_id, nome, capacidade) values ('5a000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Sala 1', 4);
insert into public.pessoas (id, escritorio_id, codigo, tipo, nome, criado_por) values
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'P1', 'contato', 'CLIENTE', 'a0000000-0000-0000-0000-000000000001');
insert into public.compromissos (id, escritorio_id, codigo, tipo, titulo, data, hora, hora_fim, local, responsavel_id, participantes, sala_id, pessoas, pessoa_nome, criado_por) values
  ('72000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'C1', 'reuniao', 'Reunião com o cliente', pg_temp.hoje() + 1, '14:00', '15:30',
   'Rua A, 10', 'a0000000-0000-0000-0000-000000000001', '{a0000000-0000-0000-0000-000000000002}', '5a000000-0000-0000-0000-000000000001', '{10000000-0000-0000-0000-000000000001}', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'C2', 'reuniao', 'Reunião passada', pg_temp.hoje() - 1, '09:00', null,
   null, 'a0000000-0000-0000-0000-000000000001', '{}', null, '{}', '', 'a0000000-0000-0000-0000-000000000001');
insert into public.tarefas (id, escritorio_id, codigo, titulo, prazo, prazo_hora, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'T1', 'Petição', pg_temp.hoje() + 5, '17:00',
   'a0000000-0000-0000-0000-000000000002', '{}', 'a0000000-0000-0000-0000-000000000001');
insert into public.demandas (id, escritorio_id, codigo, titulo, responsavel_id, colaboradores, criado_por) values
  ('71000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'D1', 'Demanda sem prazo', 'a0000000-0000-0000-0000-000000000001', '{}',
   'a0000000-0000-0000-0000-000000000001');
insert into public.contratos (id, escritorio_id, numero, sigla, ano, codigo, cliente_id, cliente_nome, responsavel_id, servico, objetos, categoria, valor, entrada, parcelas,
                              percentual_escritorio, criado_por) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'AA11', 2030, 'AA11-0001-2030', '10000000-0000-0000-0000-000000000001', 'CLIENTE',
   'a0000000-0000-0000-0000-000000000001', 'Registro de marca', '{Registro de marca}', 'pro_labore', 9000, 1000, 8, 30, 'a0000000-0000-0000-0000-000000000001');
insert into public.contrato_parcelas (id, escritorio_id, contrato_id, numero, vencimento, valor) values
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, pg_temp.hoje() + 30, 100000),
  ('d0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 2, pg_temp.hoje() - 30, 100000);
insert into public.dias_sem_expediente (id, escritorio_id, data, motivo, tipo) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', pg_temp.hoje() + 10, 'Feriado municipal', 'feriado');
set local session_replication_role = origin;

-- ---------------------------------------------------------------------
-- Desligadas, nada entra na fila
-- ---------------------------------------------------------------------
update public.compromissos set titulo = 'Reunião mudada' where id = '72000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000001'), null,
  'dadas as agendas desligadas, quando um compromisso muda, então nada entra na fila');

-- ---------------------------------------------------------------------
-- Ligar: os itens em aberto de hoje em diante
-- ---------------------------------------------------------------------
select pg_temp.entrar(1); set local role authenticated;
select lives_ok($$select public.agendas_google_ligar(true)$$, 'quando Ana liga as agendas, então o banco aceita');
reset role;
select is((select array_agg(assunto || ':' || item_id order by assunto, item_id) from public.agendas_google_fila where assunto <> 'agendas'),
  array['compromisso:72000000-0000-0000-0000-000000000001', 'dia:f0000000-0000-0000-0000-000000000001', 'parcela:d0000000-0000-0000-0000-000000000001',
        'tarefa:70000000-0000-0000-0000-000000000001'],
  'e entram na fila os itens em aberto de hoje em diante: não o compromisso de ontem, a parcela vencida nem a demanda sem prazo');
select is((select count(*)::int from public.agendas_google_fila where assunto = 'agendas'), 1, 'e o escritório também entra, para criar as agendas');

-- ---------------------------------------------------------------------
-- Os gatilhos: só o que vai ao Google
-- ---------------------------------------------------------------------
select pg_temp.entrar(1);
update public.compromissos set observacoes = 'Levar os documentos' where id = '72000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000001'), 1,
  'quando só as observações do compromisso mudam, então o pedido fica como estava (não vão ao Google)');
update public.compromissos set titulo = 'Reunião de novo' where id = '72000000-0000-0000-0000-000000000001';
update public.compromissos set hora = '15:00', hora_fim = '16:00' where id = '72000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000001'), 3,
  'quando o título e depois a hora mudam antes de a fila rodar, então o pedido é um só, com a versão nova (vai o estado final)');
select is((select count(*)::int from public.agendas_google_fila where assunto = 'compromisso' and item_id = '72000000-0000-0000-0000-000000000001'), 1,
  'e não há dois pedidos do mesmo compromisso');

update public.demandas set titulo = 'Demanda renomeada' where id = '71000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('demanda', '71000000-0000-0000-0000-000000000001'), 1, 'quando uma demanda muda o título, então ela entra na fila');
update public.tarefas set data_inicio = pg_temp.hoje() where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('tarefa', '70000000-0000-0000-0000-000000000001'), 1, 'quando só o início da tarefa muda, então o pedido fica como estava (o início não vai ao Google)');
update public.tarefas set participantes = '{a0000000-0000-0000-0000-000000000001}' where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('tarefa', '70000000-0000-0000-0000-000000000001'), 2, 'quando entra um participante na tarefa, então ela vai de novo');

insert into public.tarefas (id, escritorio_id, titulo, responsavel_id, participantes, criado_por) values
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Sem prazo', 'a0000000-0000-0000-0000-000000000001', '{}', 'a0000000-0000-0000-0000-000000000001');
select is(pg_temp.na_fila('tarefa', '70000000-0000-0000-0000-000000000002'), null, 'quando nasce uma tarefa sem prazo, então ela não entra na fila');
update public.tarefas set prazo = pg_temp.hoje() + 2 where id = '70000000-0000-0000-0000-000000000002';
select is(pg_temp.na_fila('tarefa', '70000000-0000-0000-0000-000000000002'), 1, 'quando ela ganha prazo, então entra');

update public.contrato_parcelas set valor = 120000 where id = 'd0000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('parcela', 'd0000000-0000-0000-0000-000000000001'), 2, 'quando o valor da parcela muda, então ela vai de novo');
update public.contratos set responsavel_id = 'a0000000-0000-0000-0000-000000000002' where id = 'c0000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('parcela', 'd0000000-0000-0000-0000-000000000001'), 3,
  'quando o responsável pelo contrato muda, então a parcela a receber vai de novo (muda de agenda)');
select is(pg_temp.na_fila('parcela', 'd0000000-0000-0000-0000-000000000002'), 1,
  'e a vencida ainda não recebida também (pode ter ido antes)');

update public.salas set capacidade = 6 where id = '5a000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000001'), 3, 'quando só a capacidade da sala muda, então o compromisso nela fica como estava');
update public.salas set nome = 'Sala Azul' where id = '5a000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000001'), 4, 'quando o nome da sala muda, então o compromisso nela vai de novo');

insert into public.dias_sem_expediente (id, escritorio_id, data, motivo, tipo) values
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', pg_temp.hoje() + 20, 'Suspensão', 'suspensao');
select is(pg_temp.na_fila('dia', 'f0000000-0000-0000-0000-000000000002'), 1, 'quando o escritório lança um dia sem expediente, então ele entra na fila');
set local session_replication_role = replica;
insert into public.dias_sem_expediente (id, escritorio_id, data, motivo, tipo) values
  ('f0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', pg_temp.hoje() + 10, 'Feriado', 'feriado');
set local session_replication_role = origin;
update public.dias_sem_expediente set motivo = 'Feriado do outro' where id = 'f0000000-0000-0000-0000-000000000009';
select is(pg_temp.na_fila('dia', 'f0000000-0000-0000-0000-000000000009'), null, 'dado o outro escritório com as agendas desligadas, quando um dia dele muda, então nada entra na fila');

-- ---------------------------------------------------------------------
-- O item como o servidor o lê
-- ---------------------------------------------------------------------
insert into public.agendas_google (id, escritorio_id, conta_email, tipo, perfil_id, sala_id, google_id, nome) values
  ('ac000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'pessoa', 'a0000000-0000-0000-0000-000000000001', null, 'ana@google', 'Agenda – Ana'),
  ('ac000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'sala', null, '5a000000-0000-0000-0000-000000000001', 'sala@google', 'Sala Azul'),
  ('ac000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', 'antiga@exemplo.test', 'geral', null, null, 'antiga@google', 'Geral');
select is((select public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'compromisso', '72000000-0000-0000-0000-000000000001') -> 'item'),
  jsonb_build_object('id', '72000000-0000-0000-0000-000000000001', 'titulo', 'Reunião de novo', 'data', to_char(pg_temp.hoje() + 1, 'YYYY-MM-DD'),
    'hora', '15:00', 'hora_fim', '16:00', 'local', 'Rua A, 10', 'geral', false, 'responsavel_id', 'a0000000-0000-0000-0000-000000000001',
    'participantes', jsonb_build_array('a0000000-0000-0000-0000-000000000002'), 'sala_id', '5a000000-0000-0000-0000-000000000001', 'sala_nome', 'Sala Azul',
    'clientes', 'CLIENTE', 'processo_numero', null, 'arquivado', false, 'cancelado', false),
  'dado o compromisso, quando o servidor o lê, então vem como está, com os nomes dos clientes, a sala e se está cancelado');
select is((select jsonb_array_length(public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'compromisso', '72000000-0000-0000-0000-000000000001') -> 'agendas')), 2,
  'e vêm só as agendas da conta ligada agora (não a de outra conta, de antes)');
select is((select public.agendas_google_item('e0000000-0000-0000-0000-000000000002', 'compromisso', '72000000-0000-0000-0000-000000000001') -> 'item'), 'null'::jsonb,
  'quando o outro escritório pede o mesmo compromisso, então não vem nada (cada escritório só o seu)');
select is((select public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'tarefa', '70000000-0000-0000-0000-000000000001') -> 'item' ->> 'prazo_hora'), '17:00',
  'dada a tarefa com hora, então a hora do prazo vem junto');
select is((select (public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'parcela', 'd0000000-0000-0000-0000-000000000001') -> 'item')
               - 'vencimento'),
  jsonb_build_object('id', 'd0000000-0000-0000-0000-000000000001', 'contrato_id', 'c0000000-0000-0000-0000-000000000001', 'contrato_codigo', 'AA11-0001-2030',
    'numero', 1, 'total', 8, 'valor', 120000, 'clientes', 'CLIENTE', 'responsavel_id', 'a0000000-0000-0000-0000-000000000002', 'recebida', false, 'excluida', false),
  'dada a parcela, então vem com o contrato e o responsável por ele');
select is((select public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'dia', 'f0000000-0000-0000-0000-000000000001') -> 'item' ->> 'tipo'), 'feriado',
  'dado o dia sem expediente, então vem com o tipo');

update public.compromissos set etapa_id = (select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'compromissos' and nome = 'Cancelado')
where id = '72000000-0000-0000-0000-000000000001';
select is((select (public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'compromisso', '72000000-0000-0000-0000-000000000001') -> 'item' ->> 'cancelado')::boolean), true,
  'quando o compromisso vai para a coluna "Cancelado", então ele vem cancelado (e entra na fila: versão 5)');
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000001'), 5, 'e a fila tem a versão nova');

-- ---------------------------------------------------------------------
-- As cópias gravadas
-- ---------------------------------------------------------------------
select public.agendas_google_evento_gravado('ac000000-0000-0000-0000-000000000001', 'compromisso', '72000000-0000-0000-0000-000000000001', 'c72000000000000000000000000000001', 'abc');
select public.agendas_google_evento_gravado('ac000000-0000-0000-0000-000000000001', 'compromisso', '72000000-0000-0000-0000-000000000001', 'c72000000000000000000000000000001', 'def');
select is((select public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'compromisso', '72000000-0000-0000-0000-000000000001') -> 'eventos'),
  jsonb_build_array(jsonb_build_object('agenda_id', 'ac000000-0000-0000-0000-000000000001', 'agenda_google_id', 'ana@google',
    'evento_id', 'c72000000000000000000000000000001', 'assinatura', 'def')),
  'dada a cópia gravada duas vezes, então fica uma só, com a assinatura da última');
select throws_ok($$select public.agendas_google_evento_gravado('ac000000-0000-0000-0000-000000000001', 'compromisso', '72000000-0000-0000-0000-000000000001', 'C-x!', 'a')$$,
  '23514', null, 'quando o id do evento não é dos que o Google aceita, então o banco recusa');

delete from public.agendas_google_fila where assunto = 'compromisso';
delete from public.compromissos where id = '72000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('compromisso', '72000000-0000-0000-0000-000000000001'), 1,
  'quando o compromisso com cópia no Google é excluído, então ele entra na fila (para a cópia sair)');
select is((select public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'compromisso', '72000000-0000-0000-0000-000000000001') -> 'item'), 'null'::jsonb,
  'e o servidor o lê como excluído, ainda com a cópia gravada para tirar');
delete from public.tarefas where id = '70000000-0000-0000-0000-000000000002';
delete from public.agendas_google_fila where assunto = 'tarefa' and item_id = '70000000-0000-0000-0000-000000000002';
delete from public.demandas where id = '71000000-0000-0000-0000-000000000001';
select is(pg_temp.na_fila('demanda', '71000000-0000-0000-0000-000000000001'), 2,
  'quando uma demanda sem cópia no Google, mas com pedido na fila, é excluída, então a versão do pedido sobe (um pedido só, que a próxima passada leva)');

select public.agendas_google_evento_apagado('ac000000-0000-0000-0000-000000000001', 'c72000000000000000000000000000001');
select is((select count(*)::int from public.agenda_google_eventos), 0, 'quando a cópia sai do Google, então ela é esquecida');

-- ---------------------------------------------------------------------
-- A agenda nova recebe os itens dela; a que sumiu volta à fila das agendas
-- ---------------------------------------------------------------------
delete from public.agendas_google_fila;
select public.agendas_google_agenda_criada('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'pessoa', 'a0000000-0000-0000-0000-000000000002', null, 'beto@google', 'Agenda – Beto');
select is((select array_agg(assunto || ':' || item_id order by assunto) from public.agendas_google_fila),
  array['parcela:d0000000-0000-0000-0000-000000000001', 'tarefa:70000000-0000-0000-0000-000000000001'],
  'quando a agenda do Beto nasce, então entram na fila só os itens em aberto dele (a tarefa e a parcela do contrato que agora é dele)');
delete from public.agendas_google_fila;
select public.agendas_google_agenda_criada('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'geral', null, null, 'geral@google', 'Geral');
select is((select array_agg(assunto || ':' || item_id order by item_id) from public.agendas_google_fila),
  array['dia:f0000000-0000-0000-0000-000000000001', 'dia:f0000000-0000-0000-0000-000000000002'],
  'quando a Geral nasce, então entram os dias sem expediente (não há compromisso da Agenda geral em aberto)');
select public.agendas_google_evento_gravado('ac000000-0000-0000-0000-000000000002', 'dia', 'f0000000-0000-0000-0000-000000000001', 'ff0000000000000000000000000000001', 'x');
select public.agendas_google_agenda_criada('e0000000-0000-0000-0000-000000000001', 'contato@exemplo.test', 'sala', null, '5a000000-0000-0000-0000-000000000001', 'sala2@google', 'Sala Azul');
select is((select count(*)::int from public.agenda_google_eventos where agenda_id = 'ac000000-0000-0000-0000-000000000002'), 0,
  'quando a agenda da sala é criada de novo (a velha sumiu), então as cópias da velha são esquecidas');
delete from public.agendas_google_fila;
select public.agendas_google_agenda_sumiu('ac000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.agendas_google_fila where assunto = 'agendas'), 1,
  'quando uma agenda some do Google, então o escritório volta à fila das agendas (para criá-la de novo)');

-- ---------------------------------------------------------------------
-- Quem vê e quem chama
-- ---------------------------------------------------------------------
select public.agendas_google_evento_gravado('ac000000-0000-0000-0000-000000000002', 'dia', 'f0000000-0000-0000-0000-000000000001', 'ff0000000000000000000000000000001', 'x');
select pg_temp.entrar(1); set local role authenticated;
select is((select count(*)::int from public.agenda_google_eventos), 1, 'dada Ana (administradora), então ela vê as cópias do escritório');
select throws_ok($$select public.agendas_google_item('e0000000-0000-0000-0000-000000000001', 'dia', 'f0000000-0000-0000-0000-000000000001')$$, '42501', null,
  'quando alguém logado tenta ler o item como o servidor, então o banco recusa');
select throws_ok($$select public.agendas_google_evento_gravado('ac000000-0000-0000-0000-000000000002', 'dia', 'f0000000-0000-0000-0000-000000000001', 'aaaaa', 'x')$$, '42501', null,
  'e também recusa gravar uma cópia pelo navegador');
select throws_ok($$insert into public.agenda_google_eventos (agenda_id, escritorio_id, assunto, item_id, evento_id, assinatura)
  values ('ac000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'dia', 'f0000000-0000-0000-0000-000000000001', 'bbbbb', 'x')$$, '42501', null,
  'e gravar direto na tabela');
reset role;
select pg_temp.entrar(2); set local role authenticated;
select is((select count(*)::int from public.agenda_google_eventos), 0, 'dado Beto (não administrador), então ele não vê as cópias');
reset role;
select pg_temp.entrar(3); set local role authenticated;
select is((select count(*)::int from public.agenda_google_eventos), 0, 'dado Fabio, do outro escritório, então ele não vê as cópias deste');
reset role;

-- ---------------------------------------------------------------------
-- Desligar esvazia a fila (as cópias ficam no Google)
-- ---------------------------------------------------------------------
select public.agendas_google_ligar(false) from (select pg_temp.entrar(1)) x;
select is((select count(*)::int from public.agendas_google_fila), 0, 'quando Ana desliga as agendas, então a fila esvazia');
select is((select count(*)::int from public.agenda_google_eventos), 1, 'e as cópias gravadas continuam lembradas (nada é apagado no Google)');

select * from finish();
rollback;
