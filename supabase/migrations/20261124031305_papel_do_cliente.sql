-- =====================================================================
-- O papel de cada cliente no processo (#426)
--   Antes, o processo tinha um só "Polo do cliente" (polo), opcional, com uma lista menor. Agora cada cliente tem o seu papel,
--   com a mesma lista das pessoas com papel (PAPEIS_DA_PARTE, em app/src/regras/processo.ts: mudou aqui, muda lá). A tela
--   exige o papel de cada cliente ao cadastrar e ao editar (regras/processo.ts); o banco guarda e confere a lista.
--   1. processos.papeis_clientes: o papel de cada cliente, pelo id da pessoa ({"<id>": "autor", ...}). Só os clientes do
--      processo guardam papel (o gatilho preparar_papeis tira o resto), e um papel fora da lista é recusado.
--   2. O apenado, que só existia no polo, entra na lista das pessoas com papel (processo_partes), para a lista ser a mesma.
--   3. Os processos de antes: o polo de cada um vira o papel de cada cliente dele. Sem polo, os clientes ficam sem papel, e a
--      tela pede o papel na próxima edição. A conversão não entra no histórico nem muda a data de atualização.
--   Só acrescenta. A coluna polo continua existindo e aceitando o que aceitava: a versão anterior do site, que só conhece o
--   polo, continua funcionando. Quando ela grava um processo, o cliente que estiver sem papel recebe o polo (o mesmo gatilho).
--   A regra de processo_partes fica mais larga (um valor a mais), como em 20261123003604_propriedade_intelectual.sql.
-- =====================================================================

-- ---------- 1. O papel de cada cliente ----------
alter table public.processos add column papeis_clientes jsonb not null default '{}'
  constraint processos_papeis_clientes_validos check (
    jsonb_typeof(papeis_clientes) = 'object'
    and not jsonb_path_exists(papeis_clientes, '$.* ? (@.type() != "string" || !(@ == "autor" || @ == "reu" || @ == "terceiro" || @ == "testemunha"
      || @ == "perito" || @ == "assistente_tecnico" || @ == "vitima" || @ == "investigado" || @ == "apenado" || @ == "advogado_contrario" || @ == "outro"
      || @ == "titular" || @ == "inventor" || @ == "autor_da_criacao"))'));
comment on column public.processos.papeis_clientes is
  'O papel de cada cliente no processo (#426), pelo id da pessoa. A lista é a de processo_partes.papel (PAPEIS_DA_PARTE).';

-- ---------- 3. Os processos de antes: o polo vira o papel de cada cliente ----------
-- Antes do gatilho novo e sem os gatilhos de alteração (como em 20261027000013_contrato_clientes.sql): a conversão não é uma
-- alteração feita por alguém, então não entra no histórico, não muda a data de atualização nem a auditoria.
alter table public.processos disable trigger historico;
alter table public.processos disable trigger carimbo;
alter table public.processos disable trigger auditoria;
update public.processos p
set papeis_clientes = (select coalesce(jsonb_object_agg(c::text, p.polo), '{}') from unnest(p.clientes) as c)
where p.polo is not null;
alter table public.processos enable trigger historico;
alter table public.processos enable trigger carimbo;
alter table public.processos enable trigger auditoria;

-- Só os clientes do processo guardam papel, na ordem dos clientes; o cliente sem papel recebe o polo, se houver (é o que a
-- versão anterior do site grava). Roda depois do gatilho preparar (a ordem é a do nome), que já tirou os clientes repetidos.
create function privado.preparar_papeis_dos_clientes() returns trigger
language plpgsql set search_path = '' as $$
declare v jsonb := '{}'; x uuid; papel text;
begin
  if jsonb_typeof(new.papeis_clientes) is distinct from 'object' then
    raise exception 'Algum campo está em formato inválido. Confira os dados e tente de novo.' using errcode = '23514';
  end if;
  foreach x in array new.clientes loop
    continue when x is null;
    papel := coalesce(new.papeis_clientes ->> x::text, new.polo);
    if papel is not null then v := v || jsonb_build_object(x::text, papel); end if;
  end loop;
  new.papeis_clientes := v;
  return new;
end $$;
revoke execute on function privado.preparar_papeis_dos_clientes() from public, anon;
create trigger preparar_papeis before insert or update of clientes, papeis_clientes, polo on public.processos
  for each row execute function privado.preparar_papeis_dos_clientes();

-- Quem altera o processo muda o papel dos clientes (a lista do que se altera é por coluna, desde 20261101155218_processos.sql).
grant update (papeis_clientes) on public.processos to authenticated;

-- ---------- 2. O apenado na lista das pessoas com papel ----------
-- O nome da regra é o que 20261123003604_propriedade_intelectual.sql deu. Se tiver outro nome, a migração para no "drop" e nada muda.
alter table public.processo_partes drop constraint processo_partes_papel_check;
alter table public.processo_partes add constraint processo_partes_papel_check
  check (papel in ('autor', 'reu', 'terceiro', 'testemunha', 'perito', 'assistente_tecnico', 'vitima', 'investigado', 'apenado', 'advogado_contrario', 'outro',
                   'titular', 'inventor', 'autor_da_criacao'));
