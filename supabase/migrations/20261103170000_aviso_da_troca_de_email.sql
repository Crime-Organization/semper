-- =====================================================================
-- Aviso por e-mail quando um administrador troca o e-mail de acesso de um colega (tarefa #224)
--   Quem envia é a função do servidor equipe-trocar-email. Estas funções do banco dizem o que o aviso conta e a quem ele vai,
--   e guardam no registro de ações para quem ele não saiu; só a chave de serviço as chama.
--   Só acrescenta (duas funções novas): a versão anterior do site continua funcionando.
-- =====================================================================

-- Cada pessoa edita o próprio nome, sem limite de tamanho: no aviso, ele vai curto (120 letras, como o nome do escritório em
-- app/src/dados/limites.ts) e em uma linha só. Um nome gigante não pode derrubar o envio nem o nome pode imitar outro parágrafo.
create function privado.nome_no_aviso(p_nome text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(left(p_nome, 120), '[[:cntrl:]]+', ' ', 'g'))
$$;
revoke execute on function privado.nome_no_aviso(text) from public, anon, authenticated;

-- O e-mail novo fica de fora de propósito: o e-mail antigo pode estar nas mãos de quem o invadiu, e o master vê o novo no registro.
-- O e-mail de acesso de quem trocou vai junto do nome: o nome pode ser mudado antes da troca para imitar outra pessoa.
-- Vai à administração do mesmo escritório, sem quem trocou e sem o dono da conta (que já recebe no e-mail antigo):
--   quem trocou é master: os outros administradores e masters;
--   quem trocou é administrador: os masters, ou, se o escritório não tiver master ativo, os outros administradores.
create function public.equipe_email_aviso_dados(p_registro bigint) returns jsonb
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
                                     where m.escritorio_id = a.escritorio_id and m.ativo and m.papel = 'master'))))
  from public.auditoria a
  join public.escritorios e on e.id = a.escritorio_id
  join public.perfis q on q.id = a.feito_por
  join auth.users qu on qu.id = q.id
  where a.id = p_registro and a.acao = 'troca_email'
$$;

-- O envio terminou: guarda para quem o aviso não saiu ('antigo', 'gestao'); lista vazia é que saiu para todos. Só diz o tipo de
-- destino, sem acrescentar endereços ao registro. Um registro sem esta marca é um envio que não chegou ao fim.
create function public.equipe_email_aviso_resultado(p_registro bigint, p_falhas text[]) returns void
language sql security definer set search_path = '' as $$
  update public.auditoria set resumo = resumo || jsonb_build_object('aviso_falhas', to_jsonb(p_falhas))
  where id = p_registro and acao = 'troca_email'
$$;

revoke execute on function public.equipe_email_aviso_dados(bigint), public.equipe_email_aviso_resultado(bigint, text[])
  from public, anon, authenticated;
grant execute on function public.equipe_email_aviso_dados(bigint), public.equipe_email_aviso_resultado(bigint, text[])
  to service_role;
