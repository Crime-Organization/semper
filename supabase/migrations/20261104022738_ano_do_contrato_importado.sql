-- =====================================================================
-- O contrato importado guarda o ano em que foi assinado (#216)
--   Sem isto, um contrato de 2024 trazido das planilhas receberia um código
--   terminado no ano atual. Quem grava sem estar logado no site (os arquivos
--   de importação, que uma pessoa roda no SQL Editor) pode informar o ano.
--   Quem está logado continua recebendo o ano atual, mesmo se mandar outro:
--   é por isso que a conta olha o login, e não o usuário do banco, que dentro
--   desta função é sempre o dono dela.
--   Nova versão da função, com a mesma assinatura. Só acrescenta: a versão
--   anterior do site continua funcionando.
-- =====================================================================

create or replace function privado.numerar_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_cpf text;
begin
  select f.nome, p.documento into v_nome, v_cpf
  from public.perfis f left join public.pessoas p on p.id = f.pessoa_id
  where f.id = new.responsavel_id and f.escritorio_id = new.escritorio_id;
  if v_nome is null then raise exception 'Escolha o advogado responsável.'; end if;
  new.sigla := upper(left(regexp_replace(privado.sem_acento(v_nome), '[^a-z]', '', 'g'), 2)) || right(coalesce(v_cpf, ''), 2);
  if coalesce(v_cpf, '') !~ '^[0-9]{11}$' or new.sigla !~ '^[A-Z]{2}[0-9]{2}$' then
    raise exception 'Cadastre o CPF de % em Pessoas para gerar o número do contrato.', v_nome;
  end if;
  if auth.uid() is not null or new.ano is null then
    new.ano := extract(year from now() at time zone 'America/Sao_Paulo')::integer;
  end if;
  -- A trava do escritório no ano, até o fim da gravação, faz dois contratos criados ao mesmo tempo
  -- receberem números seguidos.
  perform pg_advisory_xact_lock(hashtextextended('contratos ' || new.escritorio_id::text || ' ' || new.ano, 0));
  select coalesce(max(numero), 0) + 1 into new.numero
  from public.contratos where escritorio_id = new.escritorio_id and ano = new.ano;
  new.codigo := new.sigla || '-' || lpad(new.numero::text, greatest(4, length(new.numero::text)), '0') || '-' || new.ano;
  return new;
end $$;
