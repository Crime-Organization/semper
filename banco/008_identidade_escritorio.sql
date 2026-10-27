-- =====================================================================
-- 008 · Dados da instituição (cada escritório tem os seus)
--   O SEMPER é um produto; o nome, a logomarca e os dados de cada escritório
--   ficam aqui e aparecem nas telas dele (barra lateral, convites e, no
--   futuro, contratos e procurações). Quem altera: master e administradores,
--   pela função escritorio_salvar (os módulos ligados continuam só com o dono
--   da plataforma). Cada alteração fica no registro de ações.
-- =====================================================================

alter table public.escritorios
  add column logo         text check (logo is null or (logo ~ '^data:image/(png|webp|jpeg);base64,' and length(logo) <= 400000)),
  add column cnpj         text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  add column oab_registro text check (oab_registro is null or length(oab_registro) <= 60),
  add column logradouro   text check (logradouro is null or length(logradouro) <= 200),
  add column numero       text check (numero is null or length(numero) <= 20),
  add column complemento  text check (complemento is null or length(complemento) <= 100),
  add column bairro       text check (bairro is null or length(bairro) <= 100),
  add column municipio    text check (municipio is null or length(municipio) <= 100),
  add column uf           text check (uf is null or uf ~ '^[A-Z]{2}$'),
  add column cep          text check (cep is null or cep ~ '^[0-9]{8}$'),
  add column telefone     text check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  add column email        text check (email is null or (length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column site         text check (site is null or (length(site) <= 200 and site ~ '^https?://'));

-- Salva os dados da instituição de quem está logado. "logo" ausente mantém a logomarca atual;
-- "logo" vazio a remove. Os campos de texto vazios ficam sem valor.
create function public.escritorio_salvar(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid := privado.meu_escritorio();
  v_nome text := left(btrim(coalesce(p->>'nome', '')), 120);
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores alteram os dados do escritório'; end if;
  if v_nome = '' then raise exception 'Informe o nome do escritório'; end if;
  update public.escritorios set
    nome         = v_nome,
    logo         = case when p ? 'logo' then nullif(p->>'logo', '') else logo end,
    cnpj         = nullif(regexp_replace(coalesce(p->>'cnpj', ''), '\D', '', 'g'), ''),
    oab_registro = nullif(btrim(coalesce(p->>'oab_registro', '')), ''),
    logradouro   = nullif(btrim(coalesce(p->>'logradouro', '')), ''),
    numero       = nullif(btrim(coalesce(p->>'numero', '')), ''),
    complemento  = nullif(btrim(coalesce(p->>'complemento', '')), ''),
    bairro       = nullif(btrim(coalesce(p->>'bairro', '')), ''),
    municipio    = nullif(btrim(coalesce(p->>'municipio', '')), ''),
    uf           = nullif(upper(btrim(coalesce(p->>'uf', ''))), ''),
    cep          = nullif(regexp_replace(coalesce(p->>'cep', ''), '\D', '', 'g'), ''),
    telefone     = nullif(regexp_replace(coalesce(p->>'telefone', ''), '\D', '', 'g'), ''),
    email        = nullif(lower(btrim(coalesce(p->>'email', ''))), ''),
    site         = nullif(btrim(coalesce(p->>'site', '')), '')
  where id = v_id;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_id, 'escritorios', v_id::text, 'alteracao', jsonb_build_object('nome', v_nome), auth.uid());
end $$;
revoke execute on function public.escritorio_salvar(jsonb) from public, anon;
grant execute on function public.escritorio_salvar(jsonb) to authenticated;
