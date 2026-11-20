-- =====================================================================
-- Pessoas no Google Contatos da conta do escritório (tarefa #164, etapa 1 de 2: criar e atualizar)
--   Com a conta Google ligada (20261031120000_ligacao_google.sql) e a sincronização ligada pelo administrador, cada pessoa
--   cadastrada ou editada vira (ou atualiza) UM contato no Google: nome em maiúsculas, telefones, e-mails e aniversário
--   (nascimento; para empresa, a abertura), sem a qualificação. A conta Google é do escritório: cada escritório sincroniza
--   só com a própria conta.
--   - A sincronização começa DESLIGADA. Ligá-la é uma escolha do administrador em Configurações, depois de conferir a
--     base (#165) e de tirar o envio provisório à planilha antiga (#219), que também cria contatos: os dois juntos
--     criariam contatos repetidos.
--   - Quem grava no SEMPER nunca espera o Google: o gatilho só põe a pessoa numa FILA (uma linha por pessoa; editar de
--     novo só marca uma versão nova). A função do servidor google-sincronizar esvazia a fila: renova o acesso com o token
--     de renovação guardado no cofre, cria ou atualiza o contato e guarda a ligação pessoa ↔ contato (o "resourceName" e
--     o "etag" do Google), para nunca criar o mesmo contato duas vezes.
--   - Se o Google falha, a pessoa fica na fila e a tentativa se repete com esperas crescentes, sem fim: o cadastro no
--     SEMPER nunca se perde. A partir da 3ª tentativa falha, o administrador vê o aviso em Configurações, com o que
--     fazer. Autorização vencida ou retirada para a fila do escritório até a conta ser ligada de novo.
--   - Pessoa arquivada ou excluída: o contato fica no Google como está (decisão do dono; nada é apagado lá). Arquivada
--     não é sincronizada; ao desarquivar, volta para a fila.
--   - A rotina do banco chama a função do servidor a cada 2 minutos, só quando há alguém na fila para agora; o
--     administrador também pode pedir "Sincronizar agora". O endereço e a senha da rotina ficam no Vault
--     (semper_url_do_projeto e semper_senha_da_rotina, os mesmos dos avisos de troca de e-mail e dos prazos).
--   Só acrescenta (colunas novas com valor padrão, tabelas, funções, um gatilho e uma rotina). A versão anterior do site
--   continua funcionando: ela não usa nada disto, e o desligar antigo (ligacao_google_desligar) continua valendo.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- A chave da sincronização e o problema que impede a fila de andar, na ligação do escritório
-- ---------------------------------------------------------------------
alter table privado.ligacoes
  add column contatos_ativos          boolean not null default false,
  add column contatos_problema        text check (contatos_problema in ('autorizacao')),
  add column contatos_problema_em     timestamptz,
  add column contatos_sincronizado_em timestamptz;

-- Ligar a conta de novo (ligacao_guardar muda o ligado_em) dá uma autorização nova: o problema de autorização some.
create function privado.ligacao_renovada() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.contatos_problema := null;
  new.contatos_problema_em := null;
  return new;
end $$;
create trigger renovada before update of ligado_em on privado.ligacoes for each row execute function privado.ligacao_renovada();

-- ---------------------------------------------------------------------
-- Pessoa ↔ contato do Google, por conta (ligar outra conta começa do zero nela; religar a mesma reaproveita)
-- ---------------------------------------------------------------------
create table public.contatos_google (
  pessoa_id       uuid not null references public.pessoas on delete cascade,
  escritorio_id   uuid not null references public.escritorios on delete cascade,
  conta_email     text not null check (length(conta_email) <= 254),
  recurso         text not null check (recurso ~ '^people/[A-Za-z0-9_-]+$' and length(recurso) <= 200),
  etag            text check (length(etag) <= 200),
  sincronizado_em timestamptz not null default now(),
  primary key (pessoa_id, conta_email)
);
create index contatos_google_escritorio on public.contatos_google (escritorio_id);

-- A fila: uma linha por pessoa. "versao" cresce a cada edição, para a conclusão de uma versão antiga não apagar a nova.
-- "em_andamento_ate": a linha está com uma execução da função até essa hora (duas execuções não pegam a mesma pessoa).
create table public.contatos_google_fila (
  pessoa_id        uuid primary key references public.pessoas on delete cascade,
  escritorio_id    uuid not null references public.escritorios on delete cascade,
  versao           integer not null default 1,
  pedido_em        timestamptz not null default now(),
  tentativas       integer not null default 0,
  proxima_em       timestamptz not null default now(),
  em_andamento_ate timestamptz,
  erro             text check (erro in ('autorizacao', 'temporario', 'recusado')),
  erro_detalhe     text check (length(erro_detalhe) <= 200)
);
create index contatos_google_fila_escritorio on public.contatos_google_fila (escritorio_id, proxima_em);
create index contatos_google_fila_devidos on public.contatos_google_fila (proxima_em);

-- Regras: cada escritório vê só as próprias linhas, e só os administradores. Ninguém grava pelo navegador: só o gatilho e
-- as funções do servidor.
alter table public.contatos_google enable row level security;
alter table public.contatos_google_fila enable row level security;
create policy leitura on public.contatos_google for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy leitura on public.contatos_google_fila for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
revoke all on public.contatos_google, public.contatos_google_fila from public, anon, authenticated;
grant select on public.contatos_google, public.contatos_google_fila to authenticated;
grant select, insert, update, delete on public.contatos_google, public.contatos_google_fila to service_role;

-- ---------------------------------------------------------------------
-- O gatilho: cadastrar, editar o que vai ao Google ou desarquivar põe a pessoa na fila
-- ---------------------------------------------------------------------
create function privado.contato_google_enfileirar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.arquivado_em is not null then return null; end if;
  if tg_op = 'UPDATE'
     and (new.nome, new.tipo, new.telefones, new.emails, new.nascimento, new.abertura, old.arquivado_em is null)
         is not distinct from (old.nome, old.tipo, old.telefones, old.emails, old.nascimento, old.abertura, true) then
    return null;
  end if;
  if not exists (select 1 from privado.ligacoes l
                 where l.escritorio_id = new.escritorio_id and l.perfil_id is null and l.provedor = 'google' and l.contatos_ativos) then
    return null;
  end if;
  -- Uma edição nova depois de o Google recusar os dados (talvez já corrigidos) tenta logo; nas outras falhas, a espera continua.
  insert into public.contatos_google_fila as f (pessoa_id, escritorio_id) values (new.id, new.escritorio_id)
  on conflict (pessoa_id) do update
    set versao = f.versao + 1, pedido_em = now(),
        tentativas = case when f.erro = 'recusado' then 0 else f.tentativas end,
        proxima_em = case when f.erro = 'recusado' then now() else f.proxima_em end;
  return null;
end $$;
create trigger contato_google after insert or update of nome, tipo, telefones, emails, nascimento, abertura, arquivado_em
  on public.pessoas for each row execute function privado.contato_google_enfileirar();

-- ---------------------------------------------------------------------
-- Pelo navegador (administradores)
-- ---------------------------------------------------------------------

-- Como está a sincronização do escritório. Vazio sem conta ligada ou para quem não é administrador.
-- "com_falha": quem já falhou 3 vezes ou mais. O problema mais grave vem primeiro: autorização > Google fora > dados recusados.
create function public.sincronizacao_google()
returns table (ativa boolean, pendentes integer, com_falha integer, problema text, problema_em timestamptz, sincronizado_em timestamptz)
language sql stable security definer set search_path = '' as $$
  with l as (
    select * from privado.ligacoes l
    where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google' and privado.sou_admin()
  ), f as (
    select count(*)::int as pendentes,
           count(*) filter (where f.tentativas >= 3)::int as com_falha,
           bool_or(f.tentativas >= 3 and f.erro = 'temporario') as fora,
           bool_or(f.tentativas >= 3 and f.erro = 'recusado') as recusado,
           max(f.proxima_em) filter (where f.tentativas >= 3) as falhou_em
    from public.contatos_google_fila f where f.escritorio_id = (select l.escritorio_id from l)
  )
  select l.contatos_ativos, f.pendentes, f.com_falha,
         coalesce(l.contatos_problema, case when f.fora then 'google-fora' when f.recusado then 'recusado' end),
         case when l.contatos_problema is not null then l.contatos_problema_em when f.fora or f.recusado then f.falhou_em end,
         l.contatos_sincronizado_em
  from l, f
$$;

-- Liga ou desliga a sincronização (só administradores, com a conta ligada). Desligar esvazia a fila: o que estava
-- esperando não vai mais ao Google. Fica no registro de ações.
create function public.sincronizacao_google_ligar(p_ligar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v privado.ligacoes;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores ligam e desligam a sincronização dos contatos'; end if;
  update privado.ligacoes l set contatos_ativos = coalesce(p_ligar, false)
  where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google'
  returning * into v;
  if v.id is null then raise exception 'Ligue a conta Google do escritório antes de sincronizar os contatos'; end if;
  if not v.contatos_ativos then delete from public.contatos_google_fila f where f.escritorio_id = v.escritorio_id; end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v.escritorio_id, 'ligacoes', v.id::text, 'alteracao', jsonb_build_object('email', v.conta_email, 'contatos', v.contatos_ativos), auth.uid());
end $$;

revoke execute on function public.sincronizacao_google(), public.sincronizacao_google_ligar(boolean) from public, anon;
grant execute on function public.sincronizacao_google(), public.sincronizacao_google_ligar(boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Pelas funções do servidor (chave de serviço), nunca pelo navegador
-- ---------------------------------------------------------------------

-- O escritório de um administrador ativo (com a verificação em duas etapas nesta sessão, se ele a ativou, como em
-- ligacao_pedido_usar), ou vazio. Para as funções do servidor chamadas pela página de Configurações.
create function privado.escritorio_do_admin(p_usuario uuid, p_nivel text) returns uuid
language sql stable security definer set search_path = '' as $$
  select f.escritorio_id from public.perfis f
  where f.id = p_usuario and f.ativo and f.papel in ('master', 'admin')
    and (p_nivel = 'aal2' or not exists (select 1 from auth.mfa_factors m where m.user_id = p_usuario and m.status = 'verified'))
$$;

-- Desliga a conta Google do escritório, como ligacao_google_desligar, e devolve o token de renovação, lido antes de
-- sair do cofre, para a função google-desligar revogá-lo no Google. Também esvazia a fila do escritório.
-- resultado: 'desligada', 'sem-ligacao' ou 'sem-permissao'.
create function public.ligacao_google_desligar_servidor(p_usuario uuid, p_nivel text) returns table (resultado text, token text)
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.escritorio_do_admin(p_usuario, p_nivel); v privado.ligacoes; v_token text;
begin
  if v_escritorio is null then return query select 'sem-permissao'::text, null::text; return; end if;
  select * into v from privado.ligacoes l
  where l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google' for update;
  if v.id is null then return query select 'sem-ligacao'::text, null::text; return; end if;
  select s.decrypted_secret into v_token from vault.decrypted_secrets s where s.id = v.segredo_id;
  delete from privado.ligacoes l where l.id = v.id;
  delete from public.contatos_google_fila f where f.escritorio_id = v_escritorio;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_escritorio, 'ligacoes', v.id::text, 'exclusao', jsonb_build_object('email', v.conta_email), p_usuario);
  return query select 'desligada'::text, v_token;
end $$;

-- "Sincronizar agora": o escritório do administrador, com a fila dele liberada para já (as esperas e o problema de
-- autorização são zerados: se continuar falhando, a função marca de novo). Vazio se não é administrador ou se a
-- sincronização está desligada.
create function public.contatos_google_agora(p_usuario uuid, p_nivel text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.escritorio_do_admin(p_usuario, p_nivel);
begin
  if v_escritorio is null or not exists (select 1 from privado.ligacoes l where l.escritorio_id = v_escritorio
                                         and l.perfil_id is null and l.provedor = 'google' and l.contatos_ativos) then
    return null;
  end if;
  update privado.ligacoes l set contatos_problema = null, contatos_problema_em = null
  where l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google';
  update public.contatos_google_fila f set proxima_em = now()
  where f.escritorio_id = v_escritorio and (f.em_andamento_ate is null or f.em_andamento_ate < now());
  return v_escritorio;
end $$;

-- As pessoas a sincronizar agora (de um escritório, ou de todos), já reservadas para esta execução por 10 minutos (mais
-- que o tempo máximo de uma função do servidor) e com mais uma tentativa contada. Só de escritórios com a sincronização
-- ligada e sem problema de autorização. Quem tem menos tentativas vem primeiro. Vem com a conta ligada agora e o contato
-- já ligado a essa conta, se houver. Pessoas arquivadas saem da fila.
create function public.contatos_google_pendentes(p_escritorio uuid, p_limite integer)
returns table (pessoa_id uuid, versao integer, tentativas integer, escritorio_id uuid, conta_email text, recurso text, etag text,
               tipo text, nome text, telefones text[], emails text[], nascimento date, abertura date)
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.contatos_google_fila f using public.pessoas p
  where p.id = f.pessoa_id and p.arquivado_em is not null and (p_escritorio is null or f.escritorio_id = p_escritorio);
  return query
  with devidos as (
    select f.pessoa_id from public.contatos_google_fila f
    join privado.ligacoes l on l.escritorio_id = f.escritorio_id and l.perfil_id is null and l.provedor = 'google'
    where l.contatos_ativos and l.contatos_problema is null
      and f.proxima_em <= now() and (f.em_andamento_ate is null or f.em_andamento_ate < now())
      and (p_escritorio is null or f.escritorio_id = p_escritorio)
    order by f.tentativas, f.pedido_em
    limit greatest(coalesce(p_limite, 0), 0)
    for update of f skip locked
  ), reservados as (
    update public.contatos_google_fila f set em_andamento_ate = now() + interval '10 minutes', tentativas = f.tentativas + 1
    from devidos d where f.pessoa_id = d.pessoa_id
    returning f.pessoa_id, f.versao, f.tentativas, f.escritorio_id
  )
  select r.pessoa_id, r.versao, r.tentativas, r.escritorio_id, l.conta_email, c.recurso, c.etag,
         p.tipo, p.nome, p.telefones, p.emails, p.nascimento, p.abertura
  from reservados r
  join public.pessoas p on p.id = r.pessoa_id
  join privado.ligacoes l on l.escritorio_id = r.escritorio_id and l.perfil_id is null and l.provedor = 'google'
  left join public.contatos_google c on c.pessoa_id = r.pessoa_id and c.conta_email = l.conta_email;
end $$;

-- Deu certo: guarda (ou troca) a ligação pessoa ↔ contato na conta usada e tira a pessoa da fila, se ninguém a editou
-- enquanto isso (senão ela volta para a fila, para levar a versão nova).
create function public.contatos_google_concluir(p_pessoa uuid, p_versao integer, p_conta text, p_recurso text, p_etag text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid;
begin
  select p.escritorio_id into v_escritorio from public.pessoas p where p.id = p_pessoa;
  if v_escritorio is null then return; end if;
  insert into public.contatos_google as c (pessoa_id, escritorio_id, conta_email, recurso, etag)
  values (p_pessoa, v_escritorio, lower(p_conta), p_recurso, p_etag)
  on conflict (pessoa_id, conta_email) do update set recurso = excluded.recurso, etag = excluded.etag, sincronizado_em = now();
  delete from public.contatos_google_fila f where f.pessoa_id = p_pessoa and f.versao = p_versao;
  update public.contatos_google_fila f set em_andamento_ate = null, tentativas = 0, erro = null, erro_detalhe = null, proxima_em = now()
  where f.pessoa_id = p_pessoa;
  update privado.ligacoes l set contatos_sincronizado_em = now()
  where l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google';
end $$;

-- Deu errado: a pessoa continua na fila e espera p_espera segundos (a função calcula, crescendo com as tentativas).
-- Autorização vencida ou retirada marca o problema na ligação: a fila do escritório para até a conta ser ligada de novo
-- (ou o administrador pedir "Sincronizar agora").
create function public.contatos_google_falhou(p_pessoa uuid, p_erro text, p_detalhe text, p_espera integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid;
begin
  update public.contatos_google_fila f
  set em_andamento_ate = null, erro = p_erro, erro_detalhe = left(p_detalhe, 200),
      proxima_em = now() + make_interval(secs => greatest(coalesce(p_espera, 0), 0))
  where f.pessoa_id = p_pessoa
  returning f.escritorio_id into v_escritorio;
  if p_erro = 'autorizacao' and v_escritorio is not null then
    update privado.ligacoes l set contatos_problema = 'autorizacao', contatos_problema_em = now()
    where l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google' and l.contatos_problema is null;
  end if;
end $$;

revoke execute on function privado.escritorio_do_admin(uuid, text) from public, anon, authenticated;
revoke execute on function public.ligacao_google_desligar_servidor(uuid, text), public.contatos_google_agora(uuid, text),
  public.contatos_google_pendentes(uuid, integer), public.contatos_google_concluir(uuid, integer, text, text, text),
  public.contatos_google_falhou(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.ligacao_google_desligar_servidor(uuid, text), public.contatos_google_agora(uuid, text),
  public.contatos_google_pendentes(uuid, integer), public.contatos_google_concluir(uuid, integer, text, text, text),
  public.contatos_google_falhou(uuid, text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------
-- A rotina: a cada 2 minutos, chama a função do servidor se há alguém na fila para agora
-- ---------------------------------------------------------------------
-- O endereço e a senha da rotina ficam no Vault, nunca no código: sem eles (banco local ou antes de uma pessoa configurar),
-- não chama nada. Os 120 segundos são quanto o pedido espera a resposta (em milissegundos).
create function privado.chamar_sincronizacao_de_contatos() returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_senha text;
begin
  if not exists (select 1 from public.contatos_google_fila f
                 join privado.ligacoes l on l.escritorio_id = f.escritorio_id and l.perfil_id is null and l.provedor = 'google'
                 where l.contatos_ativos and l.contatos_problema is null
                   and f.proxima_em <= now() and (f.em_andamento_ate is null or f.em_andamento_ate < now())) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'semper_url_do_projeto';
  select decrypted_secret into v_senha from vault.decrypted_secrets where name = 'semper_senha_da_rotina';
  if v_url is null or v_senha is null then
    raise warning 'Sincronização de contatos: faltam semper_url_do_projeto ou semper_senha_da_rotina no Vault.';
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/google-sincronizar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-senha-da-rotina', v_senha),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end $$;

revoke execute on function privado.chamar_sincronizacao_de_contatos() from public, anon, authenticated;

select cron.schedule('sincronizar-contatos-google', '*/2 * * * *', 'select privado.chamar_sincronizacao_de_contatos()');
