-- Hora e lembrete nos prazos de tarefas e demandas (#286).
-- Só acrescenta: duas colunas em tarefas e em demandas, uma coluna na caixa de mensagens, funções, visões e rotinas. A regra que limita
-- o tipo de aviso de prazo fica mais larga, para aceitar o lembrete. A versão anterior do site (1.24.0) continua funcionando: ela não
-- conhece as colunas novas (grava o prazo sem hora e sem lembrete) e mostra o lembrete como um aviso de prazo, porque ele continua com
-- tipo = 'prazo'.
--   - O prazo pode ter hora (de Brasília, sem fuso, como compromissos.hora) e um lembrete: na hora do prazo, 30 minutos, 1 hora ou 1 dia
--     antes (os minutos de antecedência). Sem hora, o lembrete conta o prazo às 9h de Brasília (privado.hora_padrao_do_lembrete).
--   - Quem recebe: o responsável e os participantes (tarefa) ou colaboradores (demanda), ativos e do mesmo escritório. Módulo desligado
--     no escritório não lembra. O que foi concluído ou arquivado não lembra.
--   - A rotina roda a cada minuto. O lembrete chega quando passa a hora marcada, até 15 minutos depois do prazo (se uma rodada se perder);
--     o prazo que já passou não lembra mais.
--   - Se a data, a hora ou o lembrete mudam, o lembrete não lido que não vale mais sai da caixa, e o novo chega no horário novo. O que já
--     foi lido fica; se ele é da mesma data, volta como não lido no horário novo (chega de novo). Mudar a hora e o lembrete juntos, sem
--     mudar o instante (14h e 1 hora antes para 13h30 e 30 minutos antes), também faz chegar de novo: a caixa guarda a antecedência.
--   - E-mail do lembrete: preferência própria, 'email_lembretes' (EMAILS_DE_PRAZO em app/src/regras/mensagens.ts), ligada para todos.
--     Desligada, o lembrete chega só na caixa de Mensagens. A rotina só chama a função de e-mail quando há lembrete por enviar.
--   - Os avisos automáticos de antes (3 dias antes e no dia, às 7h, só para o responsável; resumo de sexta) não mudam. A limpeza deles e o
--     e-mail das 7h deixam os lembretes de lado. A limpeza dos avisos com mais de 30 dias continua valendo para todos, lembretes também.
--   - A rotina de cada minuto enche o registro das rotinas (cron.job_run_details): uma rotina diária apaga o que tem mais de 7 dias.

-- 1. A hora e o lembrete do prazo. Sem regra que amarre ao prazo: o site antigo grava o prazo vazio sem conhecer estas colunas. O
-- histórico do cartão registra as duas sozinho (o gatilho de histórico olha todas as colunas). Os minutos são LEMBRETES no app.
alter table public.tarefas
  add column prazo_hora time,
  add column lembrete   smallint check (lembrete in (0, 30, 60, 1440));
alter table public.demandas
  add column prazo_hora time,
  add column lembrete   smallint check (lembrete in (0, 30, 60, 1440));
grant update (prazo_hora, lembrete) on public.tarefas to authenticated;
grant update (prazo_hora, lembrete) on public.demandas to authenticated;
create index tarefas_com_lembrete on public.tarefas (escritorio_id, prazo) where lembrete is not null and arquivado_em is null;
create index demandas_com_lembrete on public.demandas (escritorio_id, prazo) where lembrete is not null and arquivado_em is null;

-- 2. As constantes do lembrete, num lugar só.
-- A hora do prazo sem hora. O app guarda a mesma: HORA_PADRAO_DO_LEMBRETE.
create function privado.hora_padrao_do_lembrete() returns time
language sql immutable set search_path = '' as $$ select time '09:00' $$;
-- Até quanto tempo depois do prazo o lembrete ainda chega: cobre uma rodada perdida da rotina, que roda a cada minuto.
create function privado.tolerancia_do_lembrete() returns interval
language sql immutable set search_path = '' as $$ select interval '15 minutes' $$;
-- Quantas vezes se tenta o e-mail do lembrete. Ele é de hora marcada: depois de alguns minutos, não adianta mais.
create function privado.tentativas_do_lembrete() returns integer
language sql immutable set search_path = '' as $$ select 3 $$;
-- Quanto esperar antes de cada nova tentativa do e-mail do lembrete: na hora, 2 minutos e 5 minutos.
create function privado.espera_do_lembrete(p_tentativas integer) returns interval
language sql immutable set search_path = '' as $$
  select case p_tentativas when 0 then interval '0' when 1 then interval '2 minutes' else interval '5 minutes' end
$$;
revoke execute on function privado.hora_padrao_do_lembrete() from public, anon, authenticated;
revoke execute on function privado.tolerancia_do_lembrete() from public, anon, authenticated;
revoke execute on function privado.tentativas_do_lembrete() from public, anon, authenticated;
revoke execute on function privado.espera_do_lembrete(integer) from public, anon, authenticated;

-- 3. O lembrete na caixa de mensagens: continua tipo 'prazo' (o site antigo só conhece 'mencao' e 'prazo'), com um valor novo em
-- prazo_aviso, o instante em que ele dispara e a antecedência com que foi marcado (a caixa mostra a do lembrete que chegou, não a marcada
-- agora no cartão). É pelos dois que se sabe se a hora ou o lembrete mudaram.
alter table public.mensagens drop constraint mensagens_prazo_aviso_check;
alter table public.mensagens add constraint mensagens_prazo_aviso_check check (prazo_aviso in ('proximo', 'hoje', 'lembrete'));
alter table public.mensagens
  add column lembrete_em    timestamptz,
  add column lembrete_antes smallint check (lembrete_antes in (0, 30, 60, 1440));
alter table public.mensagens add constraint mensagens_lembrete check (
  case when prazo_aviso = 'lembrete' then lembrete_em is not null and lembrete_antes is not null and num_nonnulls(demanda_id, tarefa_id) = 1
       else lembrete_em is null and lembrete_antes is null end);
create index mensagens_lembretes on public.mensagens (perfil_id) where prazo_aviso = 'lembrete' and lido_em is null;

-- 4. Os prazos de cada responsável: demandas e tarefas passam a ter a hora. Mesmas colunas, na mesma ordem.
create or replace view privado.prazos_da_equipe as
with itens as (
  select z.escritorio_id, x.responsavel_id as perfil_id, 'processos'::text as modulo, 'processos/' || x.tipo as pagina,
         z.id as item_id, x.id as cartao_id, x.codigo as cartao_codigo, z.descricao as titulo, z.final as data,
         null::text as hora, z.concluido_em is null as aberto
  from public.processo_prazos z join public.processos x on x.id = z.processo_id
  where z.excluido_em is null and x.arquivado_em is null
  union all
  select d.escritorio_id, d.responsavel_id, 'demandas', 'demandas', d.id, d.id, d.codigo, d.titulo, d.prazo, to_char(d.prazo_hora, 'HH24:MI'),
         c.marco is distinct from 'concluido'
  from public.demandas d left join public.quadro_colunas c on c.id = d.etapa_id
  where d.prazo is not null and d.arquivado_em is null
  union all
  select t.escritorio_id, t.responsavel_id, 'tarefas', 'tarefas', t.id, t.id, t.codigo, t.titulo, t.prazo, to_char(t.prazo_hora, 'HH24:MI'),
         c.marco is distinct from 'concluido'
  from public.tarefas t left join public.quadro_colunas c on c.id = t.etapa_id
  where t.prazo is not null and t.arquivado_em is null
  union all
  select m.escritorio_id, m.responsavel_id, 'compromissos', 'agenda', m.id, m.id, m.codigo,
         -- O mesmo nome que nomeDoCompromisso, em app/src/regras/compromisso.ts.
         coalesce(nullif(btrim(m.titulo), ''), concat_ws(' · ',
           case m.tipo when 'audiencia' then 'Audiência' when 'pericia' then 'Perícia' when 'reuniao' then 'Reunião' else 'Outro' end,
           coalesce(nullif(replace(m.pessoa_nome, '; ', ', '), ''), m.processo_numero))),
         m.data, to_char(m.hora, 'HH24:MI'), c.marco is distinct from 'concluido'
  from public.compromissos m left join public.quadro_colunas c on c.id = m.etapa_id
  where m.arquivado_em is null and lower(coalesce(c.nome, '')) not like 'cancelad%'
)
select i.*
from itens i
join public.perfis p on p.id = i.perfil_id and p.ativo
join public.escritorios e on e.id = i.escritorio_id
where e.modulos ->> i.modulo = 'true'
  and not (i.modulo = 'tarefas' and exists (
    select 1 from public.processo_prazos z join public.processos x on x.id = z.processo_id
    where z.tarefa_id = i.item_id and z.excluido_em is null and z.final = i.data and x.responsavel_id = i.perfil_id
      and x.arquivado_em is null and e.modulos ->> 'processos' = 'true'));

-- 5. Os avisos de antes deixam os lembretes de lado: a limpeza dos não lidos só toca os avisos de 3 dias e do dia (o lembrete vai também
-- a quem participa, e prazos_da_equipe só tem o responsável). O e-mail das 7h não leva lembrete.
create or replace function privado.gerar_avisos_de_prazo(p_hoje date default (now() at time zone 'America/Sao_Paulo')::date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.mensagens m where m.tipo = 'prazo' and m.prazo_data < p_hoje - 30;

  delete from public.mensagens m
  where m.tipo = 'prazo' and m.prazo_aviso in ('proximo', 'hoje') and m.lido_em is null
    and not exists (select 1 from privado.prazos_da_equipe a
                    where a.aberto and a.perfil_id = m.perfil_id and a.data = m.prazo_data
                      and a.item_id = coalesce(m.processo_prazo_id, m.demanda_id, m.tarefa_id, m.compromisso_id));

  insert into public.mensagens (escritorio_id, perfil_id, tipo, processo_prazo_id, demanda_id, tarefa_id, compromisso_id, prazo_data, prazo_aviso)
  select a.escritorio_id, a.perfil_id, 'prazo',
         case a.modulo when 'processos' then a.item_id end, case a.modulo when 'demandas' then a.item_id end,
         case a.modulo when 'tarefas' then a.item_id end, case a.modulo when 'compromissos' then a.item_id end,
         a.data, case when a.data = p_hoje then 'hoje' else 'proximo' end
  from privado.prazos_da_equipe a
  where a.aberto and a.data between p_hoje and p_hoje + 3
  on conflict (perfil_id, (coalesce(processo_prazo_id, demanda_id, tarefa_id, compromisso_id)), prazo_data, prazo_aviso) where tipo = 'prazo' do nothing;

  delete from public.mensagens m
  where m.tipo = 'prazo' and m.lido_em is null and m.prazo_aviso = 'proximo'
    and exists (select 1 from public.mensagens h
                where h.tipo = 'prazo' and h.prazo_aviso = 'hoje' and h.perfil_id = m.perfil_id and h.prazo_data = m.prazo_data
                  and coalesce(h.processo_prazo_id, h.demanda_id, h.tarefa_id, h.compromisso_id)
                    = coalesce(m.processo_prazo_id, m.demanda_id, m.tarefa_id, m.compromisso_id));
end $$;

create or replace view privado.emails_de_prazo_devidos as
select m.id, m.perfil_id, m.email_tentativas as tentativas, u.email as para, p.nome, a.modulo, a.pagina, a.cartao_id, a.cartao_codigo, a.titulo, a.data, a.hora, m.prazo_aviso as aviso
from public.mensagens m
join public.perfis p on p.id = m.perfil_id and p.preferencias ->> 'email_prazos_diario' is distinct from 'false'
join auth.users u on u.id = m.perfil_id
join privado.prazos_da_equipe a on a.aberto and a.perfil_id = m.perfil_id and a.data = m.prazo_data
  and a.item_id = coalesce(m.processo_prazo_id, m.demanda_id, m.tarefa_id, m.compromisso_id)
where m.tipo = 'prazo' and m.prazo_aviso in ('proximo', 'hoje') and m.lido_em is null and m.email_enviado_em is null and m.email_tentativas < 4
  and a.data >= (now() at time zone 'America/Sao_Paulo')::date
  and coalesce(m.email_tentado_em, '-infinity') <= now() - privado.espera_do_email(m.email_tentativas);

-- 6. Os lembretes de cada pessoa: uma linha por pessoa que recebe e por tarefa ou demanda em aberto, com prazo e lembrete.
-- "momento" é a hora do prazo (às 9h, sem hora); "instante", quando o lembrete dispara.
create view privado.lembretes_da_equipe as
with cartoes as (
  select d.escritorio_id, 'demandas'::text as modulo, 'demandas'::text as pagina, d.id as item_id, d.codigo as cartao_codigo, d.titulo,
         d.prazo as data, d.prazo_hora, d.lembrete, d.responsavel_id, d.colaboradores as equipe
  from public.demandas d left join public.quadro_colunas c on c.id = d.etapa_id
  where d.prazo is not null and d.lembrete is not null and d.arquivado_em is null and c.marco is distinct from 'concluido'
  union all
  select t.escritorio_id, 'tarefas', 'tarefas', t.id, t.codigo, t.titulo, t.prazo, t.prazo_hora, t.lembrete, t.responsavel_id, t.participantes
  from public.tarefas t left join public.quadro_colunas c on c.id = t.etapa_id
  where t.prazo is not null and t.lembrete is not null and t.arquivado_em is null and c.marco is distinct from 'concluido'
)
select k.escritorio_id, q.perfil_id, k.modulo, k.pagina, k.item_id, k.item_id as cartao_id, k.cartao_codigo, k.titulo, k.data,
       to_char(k.prazo_hora, 'HH24:MI') as hora, k.lembrete as antecedencia, h.momento, h.momento - make_interval(mins => k.lembrete) as instante
from cartoes k
cross join lateral (select k.responsavel_id union select unnest(k.equipe)) q(perfil_id)
cross join lateral (select (k.data + coalesce(k.prazo_hora, privado.hora_padrao_do_lembrete())) at time zone 'America/Sao_Paulo' as momento) h
join public.perfis p on p.id = q.perfil_id and p.ativo and p.escritorio_id = k.escritorio_id
join public.escritorios e on e.id = k.escritorio_id
where e.modulos ->> k.modulo = 'true';

revoke all on privado.lembretes_da_equipe from public, anon, authenticated;

-- 7. A rotina dos lembretes. Pode rodar mais de uma vez no mesmo minuto.
create function privado.gerar_lembretes(p_agora timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- O lembrete não lido que não vale mais (concluído, arquivado, quem saiu do cartão, outra data, outra hora, outro lembrete) sai da caixa.
  delete from public.mensagens m
  where m.tipo = 'prazo' and m.prazo_aviso = 'lembrete' and m.lido_em is null
    and not exists (select 1 from privado.lembretes_da_equipe l
                    where l.perfil_id = m.perfil_id and l.item_id = coalesce(m.demanda_id, m.tarefa_id)
                      and l.data = m.prazo_data and l.instante = m.lembrete_em and l.antecedencia = m.lembrete_antes);

  -- O lembrete que chegou a hora. Se a pessoa já tinha um desta data (lido) e o instante ou a antecedência mudaram, ele chega de novo:
  -- volta ao topo da caixa, como não lido, com um e-mail novo. Se nada mudou, fica como está (lido, e o e-mail que já foi não vai de novo).
  insert into public.mensagens as m (escritorio_id, perfil_id, tipo, demanda_id, tarefa_id, prazo_data, prazo_aviso, lembrete_em, lembrete_antes)
  select l.escritorio_id, l.perfil_id, 'prazo',
         case l.modulo when 'demandas' then l.item_id end, case l.modulo when 'tarefas' then l.item_id end,
         l.data, 'lembrete', l.instante, l.antecedencia
  from privado.lembretes_da_equipe l
  where l.instante <= p_agora and p_agora <= l.momento + privado.tolerancia_do_lembrete()
  on conflict (perfil_id, (coalesce(processo_prazo_id, demanda_id, tarefa_id, compromisso_id)), prazo_data, prazo_aviso) where tipo = 'prazo'
  do update set lembrete_em = excluded.lembrete_em, lembrete_antes = excluded.lembrete_antes, criado_em = now(), lido_em = null,
                email_enviado_em = null, email_tentado_em = null, email_tentativas = 0
  where m.lembrete_em is distinct from excluded.lembrete_em or m.lembrete_antes is distinct from excluded.lembrete_antes;
end $$;
revoke execute on function privado.gerar_lembretes(timestamptz) from public, anon, authenticated;

-- 8. Os e-mails dos lembretes por enviar: um lembrete não lido, não enviado, que ainda vale (mesma data, instante e antecedência), de um
-- prazo que não passou (com a mesma tolerância da rotina: o lembrete "na hora do prazo" dispara no próprio prazo), de quem não desligou o
-- e-mail dos lembretes. A antecedência é a guardada no lembrete.
create view privado.lembretes_devidos as
select m.id, m.perfil_id, m.email_tentativas as tentativas, u.email as para, p.nome, l.modulo, l.pagina, l.cartao_id, l.cartao_codigo,
       l.titulo, l.data, l.hora, m.lembrete_antes as antecedencia, l.momento
from public.mensagens m
join public.perfis p on p.id = m.perfil_id and p.preferencias ->> 'email_lembretes' is distinct from 'false'
join auth.users u on u.id = m.perfil_id
join privado.lembretes_da_equipe l on l.perfil_id = m.perfil_id and l.item_id = coalesce(m.demanda_id, m.tarefa_id)
  and l.data = m.prazo_data and l.instante = m.lembrete_em and l.antecedencia = m.lembrete_antes
where m.tipo = 'prazo' and m.prazo_aviso = 'lembrete' and m.lido_em is null and m.email_enviado_em is null
  and m.email_tentativas < privado.tentativas_do_lembrete()
  and now() <= l.momento + privado.tolerancia_do_lembrete()
  and coalesce(m.email_tentado_em, '-infinity') <= now() - privado.espera_do_lembrete(m.email_tentativas);

revoke all on privado.lembretes_devidos from public, anon, authenticated;

-- Pega os lembretes de até p_limite pessoas, já com mais uma tentativa marcada (como prazos_emails_a_enviar). A trava é própria: o
-- e-mail das 7h e o dos lembretes não esperam um pelo outro. A marca de enviado é a mesma: public.prazos_emails_enviados.
create function public.prazos_lembretes_a_enviar(p_limite integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('prazos_lembretes_a_enviar'));
  with alvo as (
    select * from privado.lembretes_devidos v
    where v.perfil_id in (select d.perfil_id from privado.lembretes_devidos d group by d.perfil_id order by min(d.tentativas), d.perfil_id limit p_limite)
  ), marca as (
    update public.mensagens m set email_tentativas = m.email_tentativas + 1, email_tentado_em = now()
    from alvo where m.id = alvo.id
    returning m.id
  )
  select coalesce(jsonb_agg(x), '[]') into v_resultado
  from (
    select a.para, a.nome,
           jsonb_agg(jsonb_build_object('id', a.id, 'modulo', a.modulo, 'pagina', a.pagina, 'cartao_id', a.cartao_id, 'cartao_codigo', a.cartao_codigo,
             'titulo', a.titulo, 'data', a.data, 'hora', a.hora, 'aviso', 'lembrete', 'antecedencia', a.antecedencia) order by a.momento, a.id) as itens
    from alvo a
    group by a.perfil_id, a.para, a.nome
  ) x;
  return v_resultado;
end $$;
revoke execute on function public.prazos_lembretes_a_enviar(integer) from public, anon, authenticated;
grant execute on function public.prazos_lembretes_a_enviar(integer) to service_role;

-- 9. A rotina de cada minuto: gera os lembretes e só chama a função de e-mail quando há algum por enviar.
create function privado.rodar_lembretes() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.gerar_lembretes();
  if exists (select 1 from privado.lembretes_devidos) then
    perform privado.chamar_emails_de_prazo('lembrete');
  end if;
end $$;
revoke execute on function privado.rodar_lembretes() from public, anon, authenticated;

select cron.schedule('gerar-lembretes-de-prazo', '* * * * *', 'select privado.rodar_lembretes()');
-- Às 3h15 de Brasília (6h15 UTC), fora do horário dos avisos. Os 7 dias bastam para investigar uma rotina que falhou.
select cron.schedule('limpar-registro-das-rotinas', '15 6 * * *', $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
