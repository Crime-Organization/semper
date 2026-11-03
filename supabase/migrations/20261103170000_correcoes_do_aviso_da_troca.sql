-- =====================================================================
-- Correções no aviso de troca de e-mail pelo administrador (tarefa #230)
--   O nome no aviso perde também os caracteres invisíveis, o reenvio à administração vai só a quem não recebeu e o reenvio não diz
--   que uma troca não foi confirmada só porque houve outra depois dela.
--   Só acrescenta: uma função nova e novas versões de outras três, com os mesmos parâmetros. A versão anterior do site e a das
--   funções do servidor continuam funcionando.
-- =====================================================================

-- A mesma função de 20261103150000_aviso_da_troca_de_email.sql. [[:cntrl:]] não pega os caracteres de formatação do Unicode: os
-- separadores de linha e parágrafo imitariam outro parágrafo, e os de direção espelhariam o texto que mostra quem fez a troca.
create or replace function privado.nome_no_aviso(p_nome text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(left(p_nome, 120), '[[:cntrl:]­؜᠎​-‏ -‮⁠-⁯﻿]+', ' ', 'g'))
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
-- continua valendo a marca da tentativa anterior.
create function public.equipe_email_aviso_resultado(p_registro bigint, p_falhas text[], p_gestao_sem_aviso text[]) returns void
language sql security definer set search_path = '' as $$
  update public.auditoria set resumo = resumo || jsonb_build_object('aviso_falhas', to_jsonb(p_falhas))
    || case when p_gestao_sem_aviso is null then '{}'::jsonb
            else jsonb_build_object('aviso_gestao_falhas',
                   (select coalesce(jsonb_agg(u.id), '[]'::jsonb) from auth.users u where u.email = any (p_gestao_sem_aviso))) end
  where id = p_registro and acao = 'troca_email'
$$;

revoke execute on function public.equipe_email_aviso_resultado(bigint, text[], text[]) from public, anon, authenticated;
grant execute on function public.equipe_email_aviso_resultado(bigint, text[], text[]) to service_role;

-- A mesma função de 20261103162000_reforco_do_aviso_da_troca.sql. A situação vem do que a conta tem agora: se ainda está com o e-mail
-- antigo, a troca não aconteceu de fato e o aviso diz que não foi confirmada. Um e-mail que não é o antigo nem o novo é sinal de outra
-- troca depois desta: o endereço antigo já perdeu o acesso.
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
