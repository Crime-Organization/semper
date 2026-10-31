-- =====================================================================
-- CNPJ com letras (tarefa #160)
--   Desde julho de 2026 a Receita Federal emite CNPJ alfanumérico (IN RFB
--   2.229/2024): os 12 primeiros caracteres podem ser letras maiúsculas ou
--   números, e os 2 últimos continuam sendo os dígitos verificadores.
--   O documento da pessoa e o CNPJ do escritório passam a aceitar esse formato.
--   O CPF continua com 11 números. O site grava sempre sem pontuação e em
--   maiúsculas.
--   A regra só fica mais larga: tudo o que já estava gravado continua valendo,
--   e a versão anterior do site, que só grava números, continua funcionando.
--   A função que salva os dados do escritório (escritorio_salvar) passa a
--   guardar o CNPJ com as letras, em maiúsculas, em vez de apagá-las; o resto
--   dela fica igual, e quem pode chamá-la não muda.
-- =====================================================================

alter table public.pessoas drop constraint pessoas_documento_check;
alter table public.pessoas add constraint pessoas_documento_check
  check (documento ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$');

alter table public.escritorios drop constraint escritorios_cnpj_check;
alter table public.escritorios add constraint escritorios_cnpj_check
  check (cnpj is null or cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$');

-- Igual à de 20261027000008_identidade_escritorio.sql, só com o CNPJ guardando letras e números.
create or replace function public.escritorio_salvar(p jsonb) returns void
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
    cnpj         = nullif(upper(regexp_replace(coalesce(p->>'cnpj', ''), '[^0-9A-Za-z]', '', 'g')), ''),
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
