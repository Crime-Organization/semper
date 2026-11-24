-- Avisos da tarefa na caixa de Mensagens para o solicitante e para quem executa (#415). Roda num banco local: supabase db start && supabase test db
-- Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Tudo fica numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Dado um escritório com Ana (administradora), Bia, Caio e Eva (usuários comuns), e o Davi, administrador de outro escritório.
insert into public.escritorios (id, nome, slug, modulos) values
  ('e0000000-0000-0000-0000-000000000001', 'Escritório de teste', 'teste-avisos-tarefa', '{"pessoas": true, "tarefas": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'Outro escritório', 'teste-avisos-tarefa-2', '{"pessoas": true, "tarefas": true}');
insert into public.convites (escritorio_id, email, nome, papel, codigo_hash, link_criado_em) values
  ('e0000000-0000-0000-0000-000000000001', 'ana@exemplo.test', 'Ana', 'master', privado.resumo_codigo('c1'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'bia@exemplo.test', 'Bia', 'usuario', privado.resumo_codigo('c2'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'caio@exemplo.test', 'Caio', 'usuario', privado.resumo_codigo('c3'), now()),
  ('e0000000-0000-0000-0000-000000000002', 'davi@exemplo.test', 'Davi', 'master', privado.resumo_codigo('c4'), now()),
  ('e0000000-0000-0000-0000-000000000001', 'eva@exemplo.test', 'Eva', 'usuario', privado.resumo_codigo('c5'), now());
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ana@exemplo.test', '{"convite":"c1"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bia@exemplo.test', '{"convite":"c2"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'caio@exemplo.test', '{"convite":"c3"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'davi@exemplo.test', '{"convite":"c4"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'eva@exemplo.test', '{"convite":"c5"}', now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at) select ('50000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, now(), now()
  from generate_series(1, 5) as n;

create function pg_temp.entrar(p_quem int) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-00000000000' || p_quem, 'role', 'authenticated', 'aal', 'aal1',
    'session_id', '50000000-0000-0000-0000-00000000000' || p_quem)::text, true)
$$;
create function pg_temp.perfil(p_quem int) returns uuid language sql as $$ select ('a0000000-0000-0000-0000-00000000000' || p_quem)::uuid $$;
grant execute on function pg_temp.perfil(int) to authenticated;
create function pg_temp.coluna(p_qual text) returns uuid language sql security definer as $$
  select id from public.quadro_colunas where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and modulo = 'tarefas'
    and (marco = p_qual or (p_qual = 'aprovacao' and de_aprovacao) or nome = p_qual)
$$;
grant execute on function pg_temp.coluna(text) to authenticated;
create function pg_temp.executa() returns uuid language sql security definer as $$
  select id from public.funcoes_na_tarefa where escritorio_id = 'e0000000-0000-0000-0000-000000000001' and executa order by ordem limit 1
$$;
grant execute on function pg_temp.executa() to authenticated;
-- Os avisos de uma pessoa numa tarefa, lidos sem as regras de quem vê: "aviso/quem fez/lido", em ordem.
create function pg_temp.avisos(p_quem int, p_tarefa text) returns text language sql security definer as $$
  select coalesce(string_agg(m.aviso || '/' || coalesce(f.nome, '-') || '/' || case when m.lido_em is null then 'nova' else 'lida' end, ', '
    order by m.aviso, m.criado_em), '')
  from public.mensagens_da_tarefa m left join public.perfis f on f.id = m.feito_por
  where m.perfil_id = pg_temp.perfil(p_quem) and m.tarefa_id = p_tarefa::uuid
$$;
grant execute on function pg_temp.avisos(int, text) to authenticated;
-- O minuto do desfazer passou: as sequências e os avisos ficam com 2 minutos a mais de idade.
create function pg_temp.passar_o_tempo() returns void language sql security definer as $$
  update privado.mudancas_do_solicitante set desde = desde - interval '2 minutes', em = em - interval '2 minutes';
  update public.mensagens_da_tarefa set criado_em = criado_em - interval '2 minutes';
$$;
grant execute on function pg_temp.passar_o_tempo() to authenticated;

-- ---------- 1. o solicitante ----------
-- Dada a Ana logada, quando ela cria uma tarefa para a Bia, com o Caio como solicitante, então o Caio recebe o aviso e a Ana, nada
select pg_temp.entrar(1); set local role authenticated;
insert into public.tarefas (id, titulo, responsavel_id, solicitante_id, precisa_aprovacao, criado_por, etapa_id) values
  ('70000000-0000-0000-0000-000000000001', 'Minutar a petição', pg_temp.perfil(2), pg_temp.perfil(3), true, auth.uid(), pg_temp.coluna('Fazendo'));
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000001'), 'solicitante/Ana/nova', 'Quem é posto como solicitante recebe o aviso');
select is(pg_temp.avisos(1, '70000000-0000-0000-0000-000000000001'), '', 'Quem pôs não recebe nada');

-- Quando a Ana se põe como solicitante numa tarefa nova, então ninguém recebe nada (o que fez a si mesma)
insert into public.tarefas (id, titulo, responsavel_id, solicitante_id, criado_por, etapa_id) values
  ('70000000-0000-0000-0000-000000000002', 'Tirar cópias', pg_temp.perfil(2), auth.uid(), auth.uid(), pg_temp.coluna('Fazendo'));
select is(pg_temp.avisos(1, '70000000-0000-0000-0000-000000000002'), '', 'Ninguém recebe aviso de se pôr como solicitante');

-- Quando a Ana troca o solicitante para o Caio e desfaz logo (volta a ela), então o aviso não lido do Caio some
update public.tarefas set solicitante_id = pg_temp.perfil(3) where id = '70000000-0000-0000-0000-000000000002';
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000002'), 'solicitante/Ana/nova', 'Trocar o solicitante avisa o novo');
update public.tarefas set solicitante_id = pg_temp.perfil(1) where id = '70000000-0000-0000-0000-000000000002';
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000002'), '', 'Desfazer logo apaga o aviso que ele não leu');

-- Dada a tarefa com o Caio de solicitante (passado o minuto), quando a Ana troca para a Eva e desfaz, então o Caio não recebe outro aviso
select pg_temp.entrar(1);
update public.tarefas set solicitante_id = pg_temp.perfil(3) where id = '70000000-0000-0000-0000-000000000002';
select pg_temp.passar_o_tempo();
update public.tarefas set solicitante_id = pg_temp.perfil(5) where id = '70000000-0000-0000-0000-000000000002';
update public.tarefas set solicitante_id = pg_temp.perfil(3) where id = '70000000-0000-0000-0000-000000000002';
select is(pg_temp.avisos(5, '70000000-0000-0000-0000-000000000002'), '', 'A Eva, que entrou e saiu logo, fica sem aviso');
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000002'), 'solicitante/Ana/nova', 'O Caio, que nunca deixou de ser, fica com um aviso só');

-- Dados os avisos do Caio lidos, quando ele é posto de novo, passado o minuto, então o aviso antigo dele é renovado (um só, não lido)
reset role;
update public.mensagens_da_tarefa set lido_em = now() where perfil_id = pg_temp.perfil(3);
set local role authenticated;
select pg_temp.passar_o_tempo();
update public.tarefas set solicitante_id = pg_temp.perfil(1) where id = '70000000-0000-0000-0000-000000000002';
select pg_temp.passar_o_tempo();
update public.tarefas set solicitante_id = pg_temp.perfil(3) where id = '70000000-0000-0000-0000-000000000002';
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000002'), 'solicitante/Ana/nova', 'Ser posto de novo renova o aviso');

-- Quem está desativado não recebe
reset role;
update public.perfis set ativo = false where id = pg_temp.perfil(5);
set local role authenticated;
update public.tarefas set solicitante_id = pg_temp.perfil(5) where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.avisos(5, '70000000-0000-0000-0000-000000000001'), '', 'Quem está desativado não recebe aviso');
update public.tarefas set solicitante_id = pg_temp.perfil(3) where id = '70000000-0000-0000-0000-000000000001';
reset role;
update public.perfis set ativo = true where id = pg_temp.perfil(5);
set local role authenticated;

-- ---------- 2. a chegada à aprovação ----------
-- Dada a tarefa da Bia pedida pelo Caio, com aprovação, quando a Bia a conclui, então ela espera a aprovação e o Caio é avisado
select pg_temp.passar_o_tempo();
select pg_temp.entrar(2);
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000001'), 'aprovacao/Bia/nova, solicitante/Ana/lida', 'O solicitante é avisado quando a tarefa chega à aprovação');
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000001'), '', 'Quem enviou não recebe nada');

-- Quando a Bia retira logo a tarefa da aprovação (o Desfazer), então o aviso que o Caio não leu sai
update public.tarefas set etapa_id = pg_temp.coluna('Fazendo') where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000001'), 'solicitante/Ana/lida', 'Desfazer o envio apaga o aviso não lido');
-- Quando ela conclui de novo, então o aviso volta (um só)
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000001';
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000001'), 'aprovacao/Bia/nova, solicitante/Ana/lida', 'Concluir de novo avisa de novo');

-- Dada uma tarefa sem aprovação, quando ela é concluída, então ninguém é avisado
select pg_temp.entrar(1);
insert into public.tarefas (id, titulo, responsavel_id, solicitante_id, criado_por, etapa_id) values
  ('70000000-0000-0000-0000-000000000003', 'Organizar a pasta', pg_temp.perfil(2), pg_temp.perfil(3), auth.uid(), pg_temp.coluna('Fazendo'));
select pg_temp.entrar(2);
update public.tarefas set etapa_id = pg_temp.coluna('concluido') where id = '70000000-0000-0000-0000-000000000003';
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000003'), 'solicitante/Ana/nova', 'Sem a caixa, concluir não avisa ninguém da aprovação');

-- ---------- 3. a devolução ----------
-- Dada a tarefa na aprovação, com a Eva participante que executa e a Ana participante sem função, quando o Caio a devolve com
-- comentário, então a Bia (responsável) e a Eva são avisadas, com o comentário; a Ana e o Caio, não
select pg_temp.entrar(1);
update public.tarefas set participantes = array[pg_temp.perfil(5), pg_temp.perfil(1)], funcoes = jsonb_build_object(pg_temp.perfil(5)::text, pg_temp.executa())
where id = '70000000-0000-0000-0000-000000000001';
select pg_temp.entrar(3);
select is(public.tarefa_devolver('70000000-0000-0000-0000-000000000001', ' Falta o pedido de tutela. '), pg_temp.coluna('Fazendo'), 'Devolver continua dizendo para onde a tarefa voltou');
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000001'), 'devolvida/Caio/nova', 'O responsável é avisado da devolução');
select is(pg_temp.avisos(5, '70000000-0000-0000-0000-000000000001'), 'devolvida/Caio/nova', 'Quem participa executando é avisado da devolução');
select is(pg_temp.avisos(1, '70000000-0000-0000-0000-000000000001'), '', 'Quem participa sem função de execução não é avisado');
select is(pg_temp.avisos(3, '70000000-0000-0000-0000-000000000001'), 'aprovacao/Bia/nova, solicitante/Ana/lida', 'Quem devolveu não recebe a devolução');
-- E a Bia lê o aviso com o comentário (pela regra de leitura dos comentários) e o marca como lido
select pg_temp.entrar(2);
select is((select c.texto from public.mensagens_da_tarefa m join public.comentarios c on c.id = m.comentario_id where m.aviso = 'devolvida'),
  'Tarefa devolvida: Falta o pedido de tutela.', 'O aviso traz o comentário da devolução');
update public.mensagens_da_tarefa set lido_em = now() where aviso = 'devolvida';
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000001'), 'devolvida/Caio/lida', 'Quem recebe marca o aviso como lido');

-- ---------- a caixa de cada um ----------
-- Quando a Bia lê a tabela, então só vê os seus avisos; não cria nem apaga nenhum
select is((select count(*) from public.mensagens_da_tarefa where perfil_id <> auth.uid()), 0::bigint, 'Cada um só vê os seus avisos');
select throws_ok($$ insert into public.mensagens_da_tarefa (escritorio_id, perfil_id, aviso, tarefa_id)
  values ('e0000000-0000-0000-0000-000000000001', pg_temp.perfil(3), 'solicitante', '70000000-0000-0000-0000-000000000001') $$, '42501', null,
  'Ninguém cria aviso pela tela');
select throws_ok($$ update public.mensagens_da_tarefa set aviso = 'aprovacao' $$, '42501', null, 'Só a data de leitura muda pela tela');
-- Quando o Davi (administrador de outro escritório) lê a tabela, então não vê nada
select pg_temp.entrar(4);
select is((select count(*) from public.mensagens_da_tarefa), 0::bigint, 'Outro escritório não vê os avisos');

-- ---------- quem sai ----------
-- Quando a Bia é excluída da equipe, então os avisos dela saem
reset role;
update public.perfis set ativo = false, excluido_em = now() where id = pg_temp.perfil(2);
select is(pg_temp.avisos(2, '70000000-0000-0000-0000-000000000001'), '', 'Quem é excluído perde os avisos');

select * from finish();
rollback;
