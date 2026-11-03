-- =====================================================================
-- Correções no aviso de troca de e-mail pelo administrador (tarefa #230)
--   O nome no aviso perde também os caracteres invisíveis, o reenvio à administração vai só a quem não recebeu e o reenvio não diz
--   que uma troca não foi confirmada só porque houve outra depois dela.
--   Só acrescenta: uma função nova e novas versões de outras três, com os mesmos parâmetros. A versão anterior do site e a das
--   funções do servidor continuam funcionando.
-- =====================================================================

-- A mesma função de 20261103150000_aviso_da_troca_de_email.sql. [[:cntrl:]] não pega os caracteres invisíveis do Unicode: os de direção
-- espelhariam o texto que mostra quem fez a troca, e os separadores de linha e parágrafo imitariam outro parágrafo. Os separadores viram
-- espaço; os outros somem sem deixar espaço, para não partir ao meio uma palavra colada de outro lugar.
create or replace function privado.nome_no_aviso(p_nome text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(regexp_replace(left(p_nome, 120), '[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\uFFF0-\uFFFB\U000E0000-\U000E0FFF]+', '', 'g'), '[[:cntrl:]\u2028\u2029]+', ' ', 'g'))
$$;

-- A mesma função de 20261103150000_aviso_da_troca_de_email.sql. Se um envio já marcou quem da administração não recebeu, só essas
-- pessoas entram: quem já foi avisado não recebe de novo a cada reenvio.
create or replace function public.equipe_email_aviso_dados(p_registro bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'escritorio', privado.nome_no_aviso(e.nome), 'alvo', privado.nome_no_aviso(a.resumo ->> 'nome'),
    'autor', privado.nome_no_aviso(q.nome), 'autor_email', qu.email, 'em', a.em, 'email_antigo', a.resumo ->> 'email_antigo',
    'gestao', (select coalesce(jsonb_agg(u.email order by u.email), '[]'::jsonb)
               from public.perfis g join auth.users u on u.id = g.id
               where g.escritorio_id = a.escritorio_id and g.ativo and g.papel in ('master', 'admin')
                 and g.id <> q.id and g.id::text <> a.registro_id
                 and (q.papel = 'master' or g.papel = 'master'
                      or not exists (select 1 from public.perfis m
                                     where m.escritorio_id = a.escritorio_id and m.ativo and m.papel = 'master'))
                 and (a.resumo -> 'aviso_gestao_falhas' is null or a.resumo -> 'aviso_gestao_falhas' ? g.id::text)))
  from public.auditoria a
  join public.escritorios e on e.id = a.escritorio_id
  join public.perfis q on q.id = a.feito_por
  join auth.users qu on qu.id = q.id
  where a.id = p_registro and a.acao = 'troca_email'
$$;

-- Como a versão de dois parâmetros, que fica para as funções do servidor anteriores a esta. Quem da administração não recebeu fica
-- guardado pelo identificador da pessoa, sem acrescentar endereços ao registro. Sem a lista (null), os dados do aviso nem vieram:
-- continua valendo a marca da tentativa anterior. Se alguém trocou de e-mail durante o envio, não dá para saber quem é: a marca sai, e
-- o reenvio vai a toda a administração. É melhor sobrar um aviso do que alguém ficar sem ele.
create function public.equipe_email_aviso_resultado(p_registro bigint, p_falhas text[], p_gestao_sem_aviso text[]) returns void
language sql security definer set search_path = '' as $$
  with achados as (
    select coalesce(jsonb_agg(u.id), '[]'::jsonb) as ids, count(*) as quantos
    from auth.users u where u.email = any (p_gestao_sem_aviso)
  )
  update public.auditoria a
  set resumo = case when p_gestao_sem_aviso is null then a.resumo
                    when q.quantos < cardinality(p_gestao_sem_aviso) then a.resumo - 'aviso_gestao_falhas'
                    else a.resumo || jsonb_build_object('aviso_gestao_falhas', q.ids) end
               || jsonb_build_object('aviso_falhas', to_jsonb(p_falhas))
  from achados q
  where a.id = p_registro and a.acao = 'troca_email'
$$;

revoke execute on function public.equipe_email_aviso_resultado(bigint, text[], text[]) from public, anon, authenticated;
grant execute on function public.equipe_email_aviso_resultado(bigint, text[], text[]) to service_role;

-- A mesma função de 20261103162000_reforco_do_aviso_da_troca.sql. A situação vem do que a conta tem agora: um e-mail diferente do antigo
-- mostra que a troca aconteceu, ainda que outra tenha vindo depois. Com o e-mail antigo, ou a troca não aconteceu de fato, ou foi desfeita:
-- nos dois casos o aviso diz que não foi confirmada, sem afirmar que o endereço perdeu o acesso, o que seria falso.
create or replace function public.equipe_email_avisos_pendentes()
returns table (registro bigint, situacao text, destinos text[])
language sql security definer set search_path = '' as $$
  with devidos as (
    select a.id from public.auditoria a
    where a.acao = 'troca_email'
      and a.em > now() - interval '24 hours'
      and coalesce((a.resumo ->> 'aviso_tentado_em')::timestamptz, a.em) <= now() - case coalesce((a.resumo ->> 'aviso_reenvios')::int, 0)
            when 0 then interval '10 minutes' when 1 then interval '2 hours' else interval '12 hours' end
      and a.resumo ->> 'situacao' is distinct from 'falhou'
      and (a.resumo -> 'aviso_falhas' is null or jsonb_array_length(a.resumo -> 'aviso_falhas') > 0)
      and coalesce((a.resumo ->> 'aviso_reenvios')::int, 0) < 3
      and exists (select 1 from auth.users c where c.id::text = a.registro_id)
    order by coalesce((a.resumo ->> 'aviso_reenvios')::int, 0), a.em
    limit 5
    for update of a skip locked
  )
  update public.auditoria a
  set resumo = a.resumo || jsonb_build_object('aviso_reenvios', coalesce((a.resumo ->> 'aviso_reenvios')::int, 0) + 1, 'aviso_tentado_em', now())
  from devidos d, auth.users u
  where a.id = d.id and u.id::text = a.registro_id
  returning a.id,
    case when lower(u.email) = a.resumo ->> 'email_antigo' then 'nao-confirmada' else 'trocada' end,
    case when a.resumo -> 'aviso_falhas' is null then array['antigo', 'gestao']
         else array(select jsonb_array_elements_text(a.resumo -> 'aviso_falhas')) end
$$;
