-- =====================================================================
-- 011 · Numeração dos contratos por ano
--   O número sequencial recomeça a cada ano (o ano da criação já faz parte
--   do número: HE62-0001-2027). O próximo número é o maior número que
--   existe no ano, mais um. Assim:
--   - contrato arquivado continua existindo, e o número dele continua contando;
--   - contrato excluído libera o número só se era o último do ano. Se outro
--     foi criado depois dele, a numeração segue do último e o número
--     excluído fica vago.
--   Depois de dado, o número não muda (nem com troca de responsável nem
--   com rescisão), como antes.
--
--   A tabela privado.contrato_numeracao (009) deixa de ser usada; sai numa
--   migração separada, depois. A versão anterior do site continua
--   funcionando: quem dá o número é o banco.
-- =====================================================================

-- O número se repete de um ano para o outro: passa a ser único no escritório e no ano.
alter table public.contratos drop constraint contratos_escritorio_id_numero_key;
alter table public.contratos add constraint contratos_numero_do_ano unique (escritorio_id, ano, numero);

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
  new.ano := extract(year from now() at time zone 'America/Sao_Paulo')::integer;
  -- A trava do escritório no ano, até o fim da gravação, faz dois contratos criados ao mesmo tempo
  -- receberem números seguidos.
  perform pg_advisory_xact_lock(hashtextextended('contratos ' || new.escritorio_id::text || ' ' || new.ano, 0));
  select coalesce(max(numero), 0) + 1 into new.numero
  from public.contratos where escritorio_id = new.escritorio_id and ano = new.ano;
  new.codigo := new.sigla || '-' || lpad(new.numero::text, greatest(4, length(new.numero::text)), '0') || '-' || new.ano;
  return new;
end $$;
