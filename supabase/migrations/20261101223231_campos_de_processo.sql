-- =====================================================================
-- Campos que o escritório cria nos processos (tarefa #177)
--   - O administrador cria campos de texto, data, número ou lista, para o quadro judicial, o administrativo ou os dois.
--   - Nenhum é obrigatório. O tipo não muda depois de criado; nome, onde aparece e opções mudam.
--   - Apagar só esconde (apagado_em): o que já foi preenchido fica guardado e volta se o campo for reativado.
--     Excluir de verdade, só o campo que nenhum processo usa (é o que faz desfazer a criação, liberando o nome).
--   - O valor fica em processos.campos, por id do campo. Data em AAAA-MM-DD; número com ponto decimal.
--   - O histórico mostra cada campo mudado, como "campo:<id>".
-- =====================================================================
create table public.processo_campos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  nome          text not null check (btrim(nome) <> '' and length(nome) <= 80),
  tipo          text not null check (tipo in ('texto', 'data', 'numero', 'lista')),
  aparece_em    text not null default 'ambos' check (aparece_em in ('judicial', 'administrativo', 'ambos')),
  opcoes        text[] not null default '{}' check (cardinality(opcoes) <= 50),
  apagado_em    timestamptz,
  criado_em     timestamptz not null default now(),
  check ((tipo = 'lista') = (cardinality(opcoes) > 0))
);
create unique index processo_campos_nome_unico on public.processo_campos (escritorio_id, privado.sem_acento(btrim(nome)));

-- Nome limpo; opções limpas, sem repetir e sem contar acento nem maiúsculas.
create function privado.preparar_campo_de_processo() returns trigger
language plpgsql set search_path = '' as $$
declare limpas text[] := '{}'; o text;
begin
  new.nome := btrim(new.nome);
  foreach o in array new.opcoes loop
    o := btrim(o);
    continue when o = '' or privado.sem_acento(o) = any (select privado.sem_acento(x) from unnest(limpas) x);
    if length(o) > 120 then raise exception 'Cada opção pode ter até 120 caracteres.'; end if;
    limpas := limpas || o;
  end loop;
  new.opcoes := limpas;
  return new;
end $$;
create trigger preparar before insert or update of nome, opcoes on public.processo_campos
  for each row execute function privado.preparar_campo_de_processo();

alter table public.processo_campos enable row level security;
revoke all on public.processo_campos from anon;
revoke update on public.processo_campos from authenticated;
grant update (nome, aparece_em, opcoes, apagado_em) on public.processo_campos to authenticated;
create policy leitura on public.processo_campos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.processo_campos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy alterar on public.processo_campos for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- Os valores, por id do campo.
alter table public.processos add column campos jsonb not null default '{}' check (jsonb_typeof(campos) = 'object');
grant update (campos) on public.processos to authenticated;

-- Excluir de verdade, só o campo que nenhum processo usa.
create policy apagar on public.processo_campos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin())
         and not exists (select 1 from public.processos p where p.escritorio_id = processo_campos.escritorio_id and p.campos ? processo_campos.id::text));

-- AAAA-MM-DD de um dia que existe (31/02 não).
create function privado.data_valida(v text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  return v ~ '^\d{4}-\d{2}-\d{2}$' and v::date is not null;
exception when others then
  return false;
end $$;

-- O valor segue o tipo do campo. Campo de fora do escritório ou que não vale para esse tipo de processo é recusado.
-- O que não mudou passa sem conferir: um campo apagado ou uma opção retirada não trava as outras alterações.
create function privado.preparar_campos_do_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  guardados jsonb := case when tg_op = 'UPDATE' then old.campos else '{}'::jsonb end;
  novos jsonb := '{}'; k text; v text; c public.processo_campos; valido boolean;
begin
  for k, v in select key, value from jsonb_each_text(new.campos) loop
    v := nullif(btrim(v), '');
    continue when v is null;
    if guardados ->> k is distinct from v then
      select * into c from public.processo_campos x where x.id::text = k and x.escritorio_id = new.escritorio_id and x.apagado_em is null;
      if not found or c.aparece_em not in (new.tipo, 'ambos') then raise exception 'Campo não encontrado neste escritório.'; end if;
      valido := case c.tipo
        when 'texto' then length(v) <= 1000
        when 'numero' then v ~ '^-?\d{1,20}(\.\d{1,10})?$'
        when 'lista' then v = any (c.opcoes)
        when 'data' then privado.data_valida(v)
      end;
      if not valido then raise exception 'Confira o valor do campo "%".', c.nome; end if;
    end if;
    novos := novos || jsonb_build_object(k, v);
  end loop;
  new.campos := novos;
  return new;
end $$;
create trigger preparar_campos before insert or update of campos on public.processos
  for each row execute function privado.preparar_campos_do_processo();

-- O histórico mostra cada campo mudado. A função é a de 20261101223028_historico_processos_sem_nome_ordem.sql, acrescida deles.
create or replace function privado.historico_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'tipo', 'cliente_nome', 'busca', 'nome_ordem', 'etapa_ordem', 'arquivado_por',
                        'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'campos');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'colaboradores' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.colaboradores), 'para', privado.nomes_da_equipe(new.colaboradores)))
      when 'clientes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.clientes, ', '), 'para', privado.nomes_dos_clientes(new.clientes, ', ')))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  for k in select jsonb_object_keys(old.campos) union select jsonb_object_keys(new.campos) loop
    continue when old.campos -> k is not distinct from new.campos -> k;
    a := a || jsonb_build_object('campo:' || k, jsonb_build_object('de', old.campos -> k, 'para', new.campos -> k));
  end loop;
  if a <> '{}' then
    insert into public.processo_historico (escritorio_id, processo_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
