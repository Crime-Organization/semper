-- =====================================================================
-- Documentos: pastas e subpastas, como no Obsidian, e as etiquetas do escritório nas anotações (#342)
--   - Pasta é estrutura comum do escritório, como as etiquetas: todo o escritório vê, cria, renomeia, move e apaga. Pode ficar
--     dentro de outra (pasta_mae_id), em quantos níveis se queira.
--   - Não há duas pastas com o mesmo nome dentro da mesma pasta (maiúsculas e acentos não contam), nem pasta dentro dela mesma
--     ou de uma subpasta dela (o gatilho "sem_ciclo" recusa o ciclo, olhando o resultado do comando inteiro).
--   - O nome vazio e o longo demais são recusados por regras com nome próprio (anotacao_pastas_nome_preenchido e
--     anotacao_pastas_nome_tamanho), que app/src/dados/erros.ts traduz para as mesmas mensagens do banco fictício.
--   - Só a pasta vazia é apagada: as chaves estrangeiras das subpastas e das anotações recusam apagar a que tem conteúdo, mesmo
--     as anotações que quem apaga não vê (a conferência das chaves não passa pelas regras de leitura). As chaves são "no action"
--     (conferidas no fim do comando), e não "restrict", para o escritório inteiro ainda poder sair de uma vez (on delete cascade).
--   - A anotação ganha a coluna pasta_id (nula: fora de qualquer pasta). A pasta é do mesmo escritório da anotação (a chave
--     estrangeira vai pelo par pasta e escritório). Quem altera a anotação muda a pasta dela; a mudança entra no histórico com
--     o caminho das pastas ("Pasta: Escritório › POPs → Escritório › Atas").
--   - Etiquetas: a mesma lista do escritório (20261101131705_etiquetas.sql), ligada às anotações como nos outros módulos. Quem vê
--     a anotação vê as etiquetas dela; quem pode alterá-la (privado.altero_a_anotacao: não arquivada) aplica e tira. Excluir a
--     etiqueta ou a anotação apaga a ligação. Aplicar etiqueta não mexe na anotação: não entra no histórico dela.
--   O tamanho do nome da pasta é TAMANHO_PASTA, em app/src/dados/limites.ts.
--
--   Só acrescenta: tabelas, coluna (nula), índices, funções, gatilhos e regras novos, e o caso "pasta_id" no gatilho do
--   histórico das anotações (privado.historico_anotacao, que continua igual para os outros campos). Nenhuma coluna existente
--   muda. A versão anterior do site continua funcionando: ela não lê nem grava a pasta (a anotação que ela cria nasce fora de
--   qualquer pasta) e não lê as etiquetas das anotações.
-- =====================================================================

-- 1. As pastas
create table public.anotacao_pastas (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  nome          text not null
                  constraint anotacao_pastas_nome_preenchido check (btrim(nome) <> '')
                  constraint anotacao_pastas_nome_tamanho check (length(nome) <= 80),
  pasta_mae_id  uuid,                              -- null: no primeiro nível
  criada_por    uuid default auth.uid() references auth.users on delete set null,
  criada_em     timestamptz not null default now(),
  unique (id, escritorio_id),
  -- A mãe é do mesmo escritório; com subpastas, ela não se apaga (no action: veja o cabeçalho).
  constraint anotacao_pastas_mae_fkey foreign key (pasta_mae_id, escritorio_id) references public.anotacao_pastas (id, escritorio_id)
);
-- O mesmo nome não se repete entre as irmãs (as do primeiro nível são irmãs entre si).
create unique index anotacao_pastas_nome_unico on public.anotacao_pastas
  (escritorio_id, coalesce(pasta_mae_id, '00000000-0000-0000-0000-000000000000'::uuid), privado.sem_acento(btrim(nome)));
-- Para a conferência da chave da mãe ao apagar uma pasta, e para achar as filhas.
create index anotacao_pastas_mae on public.anotacao_pastas (pasta_mae_id) where pasta_mae_id is not null;

-- Antes de gravar: o nome sem espaços sobrando. Os espaços do meio viram um só antes de tirar os das pontas, para que um espaço
-- não separável (NBSP, comum em texto colado da web ou do Word) nas pontas também saia, como no trim do banco fictício.
create function privado.preparar_pasta_da_anotacao() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  return new;
end $$;
create trigger preparar before insert or update of nome on public.anotacao_pastas
  for each row execute function privado.preparar_pasta_da_anotacao();

-- A pasta nunca dentro dela mesma ou de uma subpasta dela. O gatilho é "after": roda no fim do comando, depois das chaves
-- estrangeiras (os gatilhos das chaves vêm antes na ordem dos nomes), e vê o resultado de todas as linhas do comando. Assim um
-- comando que move várias pastas é julgado pelo resultado final (B para o primeiro nível e A para dentro de B, juntos, pode), e
-- a mãe já é, com certeza, do mesmo escritório: a resposta nunca depende das pastas de outro escritório. Sobe da pasta até o
-- primeiro nível, só pelas pastas do escritório dela; se passar pela própria pasta, é um ciclo. A trava por escritório faz duas
-- mudanças ao mesmo tempo (A para dentro de B e B para dentro de A, por duas pessoas) uma depois da outra, e a segunda já vê a
-- primeira.
create function privado.conferir_ciclo_da_pasta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.pasta_mae_id is not null and (tg_op = 'INSERT' or new.pasta_mae_id is distinct from old.pasta_mae_id) then
    perform pg_advisory_xact_lock(hashtext('anotacao_pastas:' || new.escritorio_id::text));
    if exists (
      with recursive acima(id) as (
        select p.pasta_mae_id from public.anotacao_pastas p where p.id = new.id and p.escritorio_id = new.escritorio_id
        union
        select p.pasta_mae_id from public.anotacao_pastas p join acima a on p.id = a.id
        where p.escritorio_id = new.escritorio_id and p.pasta_mae_id is not null
      )
      select 1 from acima where acima.id = new.id
    ) then
      raise exception 'Uma pasta não pode ir para dentro dela mesma nem de uma subpasta dela.';
    end if;
  end if;
  return null;
end $$;
create trigger sem_ciclo after insert or update of pasta_mae_id on public.anotacao_pastas
  for each row execute function privado.conferir_ciclo_da_pasta();
create trigger auditoria after insert or update or delete on public.anotacao_pastas for each row execute function privado.auditar();

alter table public.anotacao_pastas enable row level security;
revoke all on public.anotacao_pastas from anon;
-- Só as colunas que a pessoa escreve: o escritório e a data vêm do banco.
revoke insert, update on public.anotacao_pastas from authenticated;
grant insert (id, nome, pasta_mae_id, criada_por) on public.anotacao_pastas to authenticated;
grant update (nome, pasta_mae_id) on public.anotacao_pastas to authenticated;

create policy leitura on public.anotacao_pastas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.anotacao_pastas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criada_por = (select auth.uid()));
create policy alterar on public.anotacao_pastas for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()))
  with check (escritorio_id = (select privado.meu_escritorio()));
create policy apagar on public.anotacao_pastas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));

-- 2. A pasta da anotação
alter table public.anotacoes add column pasta_id uuid;
alter table public.anotacoes add constraint anotacoes_pasta_fkey
  foreign key (pasta_id, escritorio_id) references public.anotacao_pastas (id, escritorio_id);
-- Para a lista filtrada pela pasta, e para a conferência da chave ao apagar uma pasta.
create index anotacoes_pasta on public.anotacoes (pasta_id) where pasta_id is not null;
-- Quem cria e quem altera a anotação escolhe a pasta (as regras de incluir e alterar continuam as mesmas).
grant insert (pasta_id), update (pasta_id) on public.anotacoes to authenticated;

-- O caminho da pasta, do primeiro nível até ela ("Escritório › POPs › Financeiro"), para o histórico. Inteiro, em qualquer
-- número de níveis, como textoDoCaminho no banco fictício. O gatilho "sem_ciclo" não deixa haver ciclo; mesmo assim, a subida
-- para numa pasta já vista ("vistas"), para a consulta sempre terminar.
create function privado.caminho_da_pasta(p_pasta uuid) returns text
language sql stable security definer set search_path = '' as $$
  with recursive acima(id, nome, mae, nivel, vistas) as (
    select p.id, p.nome, p.pasta_mae_id, 0, array[p.id] from public.anotacao_pastas p where p.id = p_pasta
    union all
    select p.id, p.nome, p.pasta_mae_id, a.nivel + 1, a.vistas || p.id from public.anotacao_pastas p join acima a on p.id = a.mae
    where p.id <> all (a.vistas)
  )
  select string_agg(nome, ' › ' order by nivel desc) from acima
$$;
revoke execute on function privado.caminho_da_pasta(uuid) from public, anon, authenticated;

-- O histórico da anotação, como em 20261117143714_anotacoes.sql, com a pasta pelo caminho (e não pelo id, que ninguém lê).
create or replace function privado.historico_anotacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'busca', 'ligada_a', 'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'texto' then jsonb_build_object(k, jsonb_build_object('de', null, 'para', null))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.participantes), 'para', privado.nomes_da_equipe(new.participantes)))
      when 'pasta_id' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.caminho_da_pasta(old.pasta_id), 'para', privado.caminho_da_pasta(new.pasta_id)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.anotacao_historico (escritorio_id, anotacao_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;

-- 3. As etiquetas das anotações, no mesmo formato das tabelas de ligação dos outros módulos.
create table public.anotacao_etiquetas (
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  anotacao_id   uuid not null references public.anotacoes on delete cascade,
  etiqueta_id   uuid not null,
  primary key (anotacao_id, etiqueta_id),
  foreign key (etiqueta_id, escritorio_id) references public.etiquetas (id, escritorio_id) on delete cascade
);
create index anotacao_etiquetas_etiqueta on public.anotacao_etiquetas (etiqueta_id);
alter table public.anotacao_etiquetas enable row level security;
revoke all on public.anotacao_etiquetas from anon;
revoke update on public.anotacao_etiquetas from authenticated;
-- Ler segue quem vê a anotação (a regra de leitura dela); aplicar e tirar, só quem pode alterá-la (quem só a vê por um item
-- ligado, não; e a arquivada fica como está).
create policy leitura on public.anotacao_etiquetas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.anotacoes a where a.id = anotacao_id));
create policy incluir on public.anotacao_etiquetas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.altero_a_anotacao(anotacao_id));
create policy apagar on public.anotacao_etiquetas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and privado.altero_a_anotacao(anotacao_id));
