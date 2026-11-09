-- Avisos de prazo na caixa de mensagens e por e-mail, e resumo de sexta-feira (#113).
-- Só acrescenta: colunas na caixa de mensagens, uma tabela, funções e rotinas. A regra que limita os tipos de mensagem fica mais
-- larga, para aceitar o aviso de prazo. A versão anterior do site continua funcionando: a que está no ar (1.17) não tem a caixa de
-- mensagens. A caixa (#112) e estes avisos vão ao ar na mesma publicação.
--   - Geram aviso os prazos de processo, as demandas, as tarefas e os compromissos que ainda estão em aberto. Quem recebe é o
--     responsável (o do processo, no prazo de processo). Módulo desligado no escritório não avisa. A tarefa criada de um prazo de
--     processo, com a mesma data e o mesmo responsável, não avisa de novo: o aviso é o do prazo.
--   - Dois avisos por prazo: até 3 dias antes ('proximo') e no dia ('hoje'). A rotina olha a janela inteira, e não só o terceiro dia:
--     prazo criado perto do vencimento também avisa, e um dia sem rotina não perde o aviso.
--   - A rotina cria os avisos às 6h55 de Brasília e de hora em hora, das 10h às 20h: assim o prazo criado no meio do dia também
--     chega à caixa, e o que foi concluído sai dela em até uma hora.
--   - Os e-mails saem das 7h às 9h55, em levas de 5 em 5 minutos (até 20 pessoas por leva, 720 por manhã; a caixa de envio é a mesma de
--     todos os escritórios). O aviso criado depois disso vai no e-mail da manhã seguinte, se o prazo ainda não tiver passado.
--     O resumo sai às sextas, das 16h às 18h55. O Brasil não tem horário de verão, então o horário UTC das rotinas é fixo.
--   - Um e-mail por pessoa e por dia, com os avisos novos dela.
--   - Quem desliga o e-mail (Minha conta, em perfis.preferencias) continua com o aviso na caixa de mensagens.
--   - O aviso não lido de um prazo que foi concluído, mudou de data ou mudou de responsável sai da caixa na rotina seguinte.
--     O aviso "em 3 dias" não lido também sai quando chega o aviso "hoje". O aviso de prazo que passou há mais de 30 dias sai da caixa,
--     para os avisos antigos não ocuparem o lugar das menções (a caixa mostra as 100 mensagens mais novas).
--   - Entrega dos e-mails: até 4 tentativas, com esperas crescentes (privado.espera_do_email), para o e-mail sobreviver a uma queda do
--     SMTP. Quem teve menos tentativas vem primeiro: com o SMTP fora do ar, os primeiros da fila não tomam a vez dos outros.
-- Os nomes das preferências são os de EMAILS_DE_PRAZO em app/src/regras/mensagens.ts.

-- 1. Os avisos de prazo na caixa de mensagens
alter table public.mensagens drop constraint mensagens_tipo_check;
alter table public.mensagens add constraint mensagens_tipo_check check (tipo in ('mencao', 'prazo'));

alter table public.mensagens
  add column processo_prazo_id uuid references public.processo_prazos on delete cascade,
  add column demanda_id        uuid references public.demandas on delete cascade,
  add column tarefa_id         uuid references public.tarefas on delete cascade,
  add column compromisso_id    uuid references public.compromissos on delete cascade,
  add column prazo_data        date,   -- a data de que o aviso fala; se o prazo mudar, vem outro aviso
  add column prazo_aviso       text check (prazo_aviso in ('proximo', 'hoje')),
  add column email_enviado_em  timestamptz,
  add column email_tentado_em  timestamptz,
  add column email_tentativas  integer not null default 0;

alter table public.mensagens add constraint mensagens_de_cada_tipo check (
  (tipo = 'mencao' and comentario_id is not null and num_nonnulls(processo_prazo_id, demanda_id, tarefa_id, compromisso_id) = 0
    and prazo_data is null and prazo_aviso is null)
  or (tipo = 'prazo' and comentario_id is null and num_nonnulls(processo_prazo_id, demanda_id, tarefa_id, compromisso_id) = 1
    and prazo_data is not null and prazo_aviso is not null)
);

create unique index mensagens_um_aviso_por_prazo on public.mensagens
  (perfil_id, (coalesce(processo_prazo_id, demanda_id, tarefa_id, compromisso_id)), prazo_data, prazo_aviso) where tipo = 'prazo';
create index mensagens_processo_prazo on public.mensagens (processo_prazo_id) where processo_prazo_id is not null;
create index mensagens_demanda on public.mensagens (demanda_id) where demanda_id is not null;
create index mensagens_tarefa on public.mensagens (tarefa_id) where tarefa_id is not null;
create index mensagens_compromisso on public.mensagens (compromisso_id) where compromisso_id is not null;
create index mensagens_emails_de_prazo on public.mensagens (criado_em) where tipo = 'prazo' and email_enviado_em is null;

-- 2. Os prazos de cada responsável, de todos os módulos: é daqui que saem os avisos e o resumo. "aberto" é falso no que já foi
-- concluído. O compromisso cancelado não entra: "Cancelado" é uma coluna comum do quadro, sem marco, e por isso vai pelo nome.
create view privado.prazos_da_equipe as
with itens as (
  select z.escritorio_id, x.responsavel_id as perfil_id, 'processos'::text as modulo, 'processos/' || x.tipo as pagina,
         z.id as item_id, x.id as cartao_id, x.codigo as cartao_codigo, z.descricao as titulo, z.final as data,
         null::text as hora, z.concluido_em is null as aberto
  from public.processo_prazos z join public.processos x on x.id = z.processo_id
  where z.excluido_em is null and x.arquivado_em is null
  union all
  select d.escritorio_id, d.responsavel_id, 'demandas', 'demandas', d.id, d.id, d.codigo, d.titulo, d.prazo, null, c.marco is distinct from 'concluido'
  from public.demandas d left join public.quadro_colunas c on c.id = d.etapa_id
  where d.prazo is not null and d.arquivado_em is null
  union all
  select t.escritorio_id, t.responsavel_id, 'tarefas', 'tarefas', t.id, t.id, t.codigo, t.titulo, t.prazo, null, c.marco is distinct from 'concluido'
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

revoke all on privado.prazos_da_equipe from public, anon, authenticated;

-- 3. A rotina diária: tira os avisos que não valem mais e cria os novos. Pode rodar mais de uma vez no mesmo dia.
-- Os 3 dias são a antecedência combinada na tarefa #113.
create function privado.gerar_avisos_de_prazo(p_hoje date default (now() at time zone 'America/Sao_Paulo')::date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.mensagens m where m.tipo = 'prazo' and m.prazo_data < p_hoje - 30;

  delete from public.mensagens m
  where m.tipo = 'prazo' and m.lido_em is null
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
revoke execute on function privado.gerar_avisos_de_prazo(date) from public, anon, authenticated;

-- 4. Quanto esperar antes de cada nova tentativa de e-mail: 10 minutos, 45 minutos e 90 minutos. Cabem na janela das rotinas (de 3 horas).
create function privado.espera_do_email(p_tentativas integer) returns interval
language sql immutable set search_path = '' as $$
  select case p_tentativas when 0 then interval '0' when 1 then interval '10 minutes' when 2 then interval '45 minutes' else interval '90 minutes' end
$$;
revoke execute on function privado.espera_do_email(integer) from public, anon, authenticated;

-- Os e-mails diários por enviar: um aviso ainda não lido, de um prazo ainda aberto e que não passou, de quem não desligou o e-mail.
create view privado.emails_de_prazo_devidos as
select m.id, m.perfil_id, m.email_tentativas as tentativas, u.email as para, p.nome, a.modulo, a.pagina, a.cartao_id, a.cartao_codigo, a.titulo, a.data, a.hora, m.prazo_aviso as aviso
from public.mensagens m
join public.perfis p on p.id = m.perfil_id and p.preferencias ->> 'email_prazos_diario' is distinct from 'false'
join auth.users u on u.id = m.perfil_id
join privado.prazos_da_equipe a on a.aberto and a.perfil_id = m.perfil_id and a.data = m.prazo_data
  and a.item_id = coalesce(m.processo_prazo_id, m.demanda_id, m.tarefa_id, m.compromisso_id)
where m.tipo = 'prazo' and m.lido_em is null and m.email_enviado_em is null and m.email_tentativas < 4
  and a.data >= (now() at time zone 'America/Sao_Paulo')::date
  and coalesce(m.email_tentado_em, '-infinity') <= now() - privado.espera_do_email(m.email_tentativas);

revoke all on privado.emails_de_prazo_devidos from public, anon, authenticated;

-- Pega os e-mails de até p_limite pessoas, já com mais uma tentativa marcada: se a função cair no meio, a tentativa conta, e o aviso
-- não fica em repetição sem fim. A trava faz duas chamadas ao mesmo tempo esperarem uma pela outra, para não pegarem o mesmo aviso.
create function public.prazos_emails_a_enviar(p_limite integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('prazos_emails_a_enviar'));
  with alvo as (
    select * from privado.emails_de_prazo_devidos v
    where v.perfil_id in (select d.perfil_id from privado.emails_de_prazo_devidos d group by d.perfil_id order by min(d.tentativas), d.perfil_id limit p_limite)
  ), marca as (
    update public.mensagens m set email_tentativas = m.email_tentativas + 1, email_tentado_em = now()
    from alvo where m.id = alvo.id
    returning m.id
  )
  select coalesce(jsonb_agg(x), '[]') into v_resultado
  from (
    select a.para, a.nome,
           jsonb_agg(jsonb_build_object('id', a.id, 'modulo', a.modulo, 'pagina', a.pagina, 'cartao_id', a.cartao_id, 'cartao_codigo', a.cartao_codigo,
             'titulo', a.titulo, 'data', a.data, 'hora', a.hora, 'aviso', a.aviso) order by a.data, a.hora nulls first, a.id) as itens
    from alvo a
    group by a.perfil_id, a.para, a.nome
  ) x;
  return v_resultado;
end $$;
revoke execute on function public.prazos_emails_a_enviar(integer) from public, anon, authenticated;
grant execute on function public.prazos_emails_a_enviar(integer) to service_role;

create function public.prazos_emails_enviados(p_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  update public.mensagens set email_enviado_em = now() where id = any(p_ids) and tipo = 'prazo' and email_enviado_em is null
$$;
revoke execute on function public.prazos_emails_enviados(uuid[]) from public, anon, authenticated;
grant execute on function public.prazos_emails_enviados(uuid[]) to service_role;

-- 5. O resumo de sexta-feira: uma linha por pessoa e por semana, para o resumo sair uma vez só.
create table public.resumos_de_prazos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios on delete cascade,
  perfil_id     uuid not null references public.perfis on delete cascade,
  semana        date not null,   -- a sexta-feira do resumo
  criado_em     timestamptz not null default now(),
  tentado_em    timestamptz,
  tentativas    integer not null default 0,
  enviado_em    timestamptz,
  unique (perfil_id, semana)
);
create index resumos_de_prazos_escritorio on public.resumos_de_prazos (escritorio_id);
create index resumos_de_prazos_por_enviar on public.resumos_de_prazos (criado_em) where enviado_em is null;

alter table public.resumos_de_prazos enable row level security;
revoke all on public.resumos_de_prazos from anon;
revoke insert, update, delete on public.resumos_de_prazos from authenticated;
create policy leitura on public.resumos_de_prazos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));

-- Só quem pode ter prazo recebe o resumo: o escritório precisa ter algum dos quatro módulos ligado.
create function privado.gerar_resumos_de_prazo(p_sexta date default (now() at time zone 'America/Sao_Paulo')::date) returns void
language sql security definer set search_path = '' as $$
  insert into public.resumos_de_prazos (escritorio_id, perfil_id, semana)
  select p.escritorio_id, p.id, p_sexta
  from public.perfis p join public.escritorios e on e.id = p.escritorio_id
  where p.ativo
    and exists (select 1 from jsonb_each_text(e.modulos) m where m.key in ('processos', 'demandas', 'tarefas', 'compromissos') and m.value = 'true')
  on conflict (perfil_id, semana) do nothing
$$;
revoke execute on function privado.gerar_resumos_de_prazo(date) from public, anon, authenticated;

-- Uma seção do resumo: quantos são e os mais perto da sexta-feira. Quem acumulou muitos atrasados não recebe um e-mail sem fim.
create function privado.secao_do_resumo(p_perfil uuid, p_sexta date, p_de date, p_ate date, p_itens integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*) from privado.prazos_da_equipe a where a.aberto and a.perfil_id = p_perfil and a.data between p_de and p_ate),
    'itens', coalesce((select jsonb_agg(i) from (
      select a.modulo, a.pagina, a.cartao_id, a.cartao_codigo, a.titulo, a.data, a.hora
      from privado.prazos_da_equipe a
      where a.aberto and a.perfil_id = p_perfil and a.data between p_de and p_ate
      order by abs(a.data - p_sexta), a.hora nulls first, a.item_id
      limit p_itens) i), '[]'))
$$;
revoke execute on function privado.secao_do_resumo(uuid, date, date, date, integer) from public, anon, authenticated;

-- Pega os resumos de até p_limite pessoas. A semana vai de segunda (a sexta menos 4 dias) a domingo (mais 2); a seguinte, de mais 3 a mais 9.
create function public.prazos_resumos_a_enviar(p_limite integer, p_itens integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  with alvo as (
    select r.id, r.perfil_id, r.semana, u.email as para, p.nome
    from public.resumos_de_prazos r
    join public.perfis p on p.id = r.perfil_id and p.ativo and p.preferencias ->> 'email_prazos_semanal' is distinct from 'false'
    join auth.users u on u.id = r.perfil_id
    where r.enviado_em is null and r.tentativas < 4 and r.criado_em > now() - interval '4 hours'
      and coalesce(r.tentado_em, '-infinity') <= now() - privado.espera_do_email(r.tentativas)
    order by r.tentativas, r.perfil_id
    limit p_limite
    for update of r skip locked
  ), marca as (
    update public.resumos_de_prazos r set tentativas = r.tentativas + 1, tentado_em = now()
    from alvo where r.id = alvo.id
    returning r.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'para', a.para, 'nome', a.nome, 'semana', a.semana,
    'concluidos', (select count(*) from privado.prazos_da_equipe z where not z.aberto and z.perfil_id = a.perfil_id and z.data between a.semana - 4 and a.semana + 2),
    'atrasados', privado.secao_do_resumo(a.perfil_id, a.semana, '-infinity', a.semana - 1, p_itens),
    'esta_semana', privado.secao_do_resumo(a.perfil_id, a.semana, a.semana, a.semana + 2, p_itens),
    'proxima_semana', privado.secao_do_resumo(a.perfil_id, a.semana, a.semana + 3, a.semana + 9, p_itens)
  )), '[]') into v_resultado
  from alvo a;
  return v_resultado;
end $$;
revoke execute on function public.prazos_resumos_a_enviar(integer, integer) from public, anon, authenticated;
grant execute on function public.prazos_resumos_a_enviar(integer, integer) to service_role;

create function public.prazos_resumo_enviado(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.resumos_de_prazos set enviado_em = now() where id = p_id and enviado_em is null
$$;
revoke execute on function public.prazos_resumo_enviado(uuid) from public, anon, authenticated;
grant execute on function public.prazos_resumo_enviado(uuid) to service_role;

-- 6. As rotinas. O endereço e a senha da rotina ficam no Vault, os mesmos do reenvio de avisos: sem eles (banco local ou antes de uma
-- pessoa configurar), a rotina não chama nada. Os 120 segundos são quanto o pedido espera a resposta (em milissegundos).
create function privado.chamar_emails_de_prazo(p_tipo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_senha text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'semper_url_do_projeto';
  select decrypted_secret into v_senha from vault.decrypted_secrets where name = 'semper_senha_da_rotina';
  if v_url is null or v_senha is null then
    raise warning 'E-mails de prazo: faltam semper_url_do_projeto ou semper_senha_da_rotina no Vault.';
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/prazos-enviar-emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-senha-da-rotina', v_senha),
    body := jsonb_build_object('tipo', p_tipo),
    timeout_milliseconds := 120000
  );
end $$;
revoke execute on function privado.chamar_emails_de_prazo(text) from public, anon, authenticated;

-- Horários em UTC (Brasília + 3). Os avisos são criados 5 minutos antes da primeira leva de e-mails. As rotinas de hora em hora começam
-- depois da última leva da manhã, para o aviso criado no meio do dia não virar um segundo e-mail na mesma manhã.
select cron.schedule('gerar-avisos-de-prazo', '55 9 * * *', 'select privado.gerar_avisos_de_prazo()');
select cron.schedule('gerar-avisos-de-prazo-no-dia', '0 13-23 * * *', 'select privado.gerar_avisos_de_prazo()');
select cron.schedule('enviar-emails-de-prazo', '*/5 10-12 * * *', $$select privado.chamar_emails_de_prazo('diario')$$);
select cron.schedule('gerar-resumos-de-prazo', '55 18 * * 5', 'select privado.gerar_resumos_de_prazo()');
select cron.schedule('enviar-resumos-de-prazo', '*/5 19-21 * * 5', $$select privado.chamar_emails_de_prazo('resumo')$$);

-- 7. Gravar uma preferência sem mexer nas outras. Antes o site regravava a lista inteira, a partir da cópia lida ao abrir o sistema: outra
-- aba ou outro aparelho apagaria o "não quero este e-mail", que agora é lido pelo servidor.
create function public.preferencia_gravar(p_chave text, p_valor jsonb) returns void
language sql set search_path = '' as $$
  update public.perfis set preferencias = preferencias || jsonb_build_object(p_chave, p_valor) where id = (select auth.uid())
$$;
revoke execute on function public.preferencia_gravar(text, jsonb) from public, anon;
grant execute on function public.preferencia_gravar(text, jsonb) to authenticated;
