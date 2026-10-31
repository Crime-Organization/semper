-- =====================================================================
-- Perfil profissional da equipe (tarefa #140)
--   Cada usuário tem um perfil profissional: a base das páginas da equipe
--   no site do escritório (o CMS, tarefa #50), do currículo em PDF e da
--   importação do Lattes. Um perfil por usuário, no escritório dele.
--   - Todos da equipe veem os perfis do próprio escritório.
--   - Cada um edita o próprio; os administradores editam o de qualquer um
--     do escritório.
--   - "Aparecer no site" e a ordem na página da equipe: só administradores.
--   - Sair da equipe (o usuário apagado) apaga o perfil (LGPD).
--   - Cada inclusão e alteração fica no registro de ações.
--   Só acrescenta (tabela, funções, gatilhos e regras novos). A versão
--   anterior do site continua funcionando (ela não usa perfis profissionais).
-- =====================================================================

-- As listas do perfil (inscrições na OAB, formação, experiência, publicações, redes) são listas de objetos só com os
-- campos esperados, todos texto. Até 30 linhas; cada texto com até 300 letras (o link, até 500).
-- (TAMANHO_PERFIL e LINHAS_DO_PERFIL em app/src/dados/limites.ts)
create function privado.linhas_do_perfil(p jsonb, p_campos text[]) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 30
    and not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e) <> 'object'
         or exists (select 1 from jsonb_each(e) c
                    where not (c.key = any (p_campos)) or jsonb_typeof(c.value) <> 'string'
                       or length(c.value #>> '{}') > case when c.key = 'link' then 500 else 300 end))
$$;
-- As listas de textos simples (áreas de atuação, idiomas, associações): até 30, cada um com 1 a 300 letras.
create function privado.textos_do_perfil(p text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(p) <= 30 and not exists (select 1 from unnest(p) t where btrim(t) = '' or length(t) > 300)
$$;
-- Link vazio ou começando por http:// ou https://.
create function privado.link_do_perfil(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p = '' or (p ~* '^https?://\S+$' and length(p) <= 500)
$$;

create table public.perfil_profissional (
  perfil_id        uuid primary key references public.perfis on delete cascade,
  escritorio_id    uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  nome_exibicao    text not null default '' check (length(nome_exibicao) <= 120),
  cargo            text not null default '' check (length(cargo) <= 120),
  oab              jsonb not null default '[]' check (privado.linhas_do_perfil(oab, array['numero', 'uf'])),
  areas            text[] not null default '{}' check (privado.textos_do_perfil(areas)),
  bio_curta        text not null default '' check (length(bio_curta) <= 300),
  biografia        text not null default '' check (length(biografia) <= 5000),
  formacao         jsonb not null default '[]' check (privado.linhas_do_perfil(formacao, array['curso', 'instituicao', 'ano'])),
  idiomas          text[] not null default '{}' check (privado.textos_do_perfil(idiomas)),
  experiencia      jsonb not null default '[]' check (privado.linhas_do_perfil(experiencia, array['cargo', 'lugar', 'periodo'])),
  associacoes      text[] not null default '{}' check (privado.textos_do_perfil(associacoes)),
  publicacoes      jsonb not null default '[]' check (privado.linhas_do_perfil(publicacoes, array['titulo', 'onde', 'ano', 'link'])),
  lattes           text not null default '' check (privado.link_do_perfil(lattes)),
  email_publico    text not null default '' check (email_publico = '' or (email_publico ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email_publico) <= 254)),
  telefone_publico text not null default '' check (length(telefone_publico) <= 30),
  linkedin         text not null default '' check (privado.link_do_perfil(linkedin)),
  redes            jsonb not null default '[]' check (privado.linhas_do_perfil(redes, array['nome', 'link'])),
  no_site          boolean not null default false,            -- aparece na página da equipe do site
  ordem_no_site    integer check (ordem_no_site between 0 and 9999),
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid default auth.uid() references auth.users on delete set null
);
create index perfil_profissional_site on public.perfil_profissional (escritorio_id, ordem_no_site) where no_site;

-- Textos sem espaços nas pontas; quem e quando alterou; "aparecer no site" e a ordem, só administradores.
create function privado.preparar_perfil_profissional() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not privado.sou_admin() and (
       (tg_op = 'INSERT' and (new.no_site or new.ordem_no_site is not null))
    or (tg_op = 'UPDATE' and (new.no_site is distinct from old.no_site or new.ordem_no_site is distinct from old.ordem_no_site))) then
    raise exception 'Só administradores decidem quem aparece no site.' using errcode = '42501';
  end if;
  new.nome_exibicao := btrim(new.nome_exibicao);
  new.cargo := btrim(new.cargo);
  new.bio_curta := btrim(new.bio_curta);
  new.biografia := btrim(new.biografia);
  new.lattes := btrim(new.lattes);
  new.email_publico := lower(btrim(new.email_publico));
  new.telefone_publico := btrim(new.telefone_publico);
  new.linkedin := btrim(new.linkedin);
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
create trigger preparar before insert or update on public.perfil_profissional
  for each row execute function privado.preparar_perfil_profissional();
create trigger auditoria after insert or update on public.perfil_profissional for each row execute function privado.auditar();

alter table public.perfil_profissional enable row level security;
revoke all on public.perfil_profissional from anon;
revoke update, delete on public.perfil_profissional from authenticated;
grant update (nome_exibicao, cargo, oab, areas, bio_curta, biografia, formacao, idiomas, experiencia, associacoes, publicacoes,
              lattes, email_publico, telefone_publico, linkedin, redes, no_site, ordem_no_site) on public.perfil_profissional to authenticated;

-- Todos da equipe veem os perfis do escritório; grava o próprio, ou o de alguém do escritório se for administrador.
create policy leitura on public.perfil_profissional for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.perfil_profissional for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio())
              and (perfil_id = (select auth.uid()) or (select privado.sou_admin()))
              and exists (select 1 from public.perfis p where p.id = perfil_id and p.escritorio_id = (select privado.meu_escritorio())));
create policy alterar on public.perfil_profissional for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (perfil_id = (select auth.uid()) or (select privado.sou_admin())))
  with check (escritorio_id = (select privado.meu_escritorio()) and (perfil_id = (select auth.uid()) or (select privado.sou_admin())));
