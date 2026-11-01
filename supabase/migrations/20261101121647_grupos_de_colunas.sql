-- =====================================================================
-- Grupos de colunas nos quadros (tarefa #175)
--   As colunas de um quadro podem ficar em grupos que abrem e fecham (ex.: no quadro Judicial, Início,
--   Conhecimento, Decisão, Recursal, Cumprimento e Encerrado).
--   - Os grupos são do escritório e de um quadro: todos veem; só os administradores criam, renomeiam,
--     reordenam e excluem. Excluir um grupo não exclui as colunas: elas só ficam sem grupo.
--   - Quem cria uma coluna escolhe o grupo dela. Mudar de grupo depois segue a regra de alterar a coluna
--     (administrador ou quem a criou).
--   - A chave liga a coluna a um grupo do mesmo escritório e do mesmo quadro.
--   - comeca_fechado: o grupo aparece fechado até a pessoa abri-lo (ex.: Encerrado). O que cada pessoa abre
--     ou fecha fica nas preferências dela, não aqui.
--   O tamanho do nome é o de app/src/dados/limites.ts (TAMANHO_GRUPO).
--   Só acrescenta (uma tabela e uma coluna que pode ficar vazia). A versão anterior do site continua
--   funcionando: ela não lê o grupo e cria colunas sem grupo.
-- =====================================================================

create table public.quadro_grupos (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  modulo         text not null check (modulo in ('pessoas', 'contratos', 'demandas', 'tarefas', 'processos', 'compromissos', 'anotacoes', 'financeiro')),
  nome           text not null check (btrim(nome) <> '' and length(nome) <= 60),
  ordem          double precision not null default 0,
  comeca_fechado boolean not null default false,
  criado_em      timestamptz not null default now(),
  unique (id, escritorio_id, modulo)
);
-- Não pode haver dois grupos com o mesmo nome no mesmo quadro (ignora maiúsculas e acentos).
create unique index quadro_grupos_nome_unico on public.quadro_grupos (escritorio_id, modulo, privado.sem_acento(btrim(nome)));

alter table public.quadro_grupos enable row level security;
revoke all on public.quadro_grupos from anon;
revoke update on public.quadro_grupos from authenticated;
grant update (nome, ordem, comeca_fechado) on public.quadro_grupos to authenticated;

create policy leitura on public.quadro_grupos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.quadro_grupos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy alterar on public.quadro_grupos for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()));
create policy apagar on public.quadro_grupos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- A coluna aponta para um grupo do mesmo escritório e quadro. Excluir o grupo só limpa grupo_id.
alter table public.quadro_colunas
  add column grupo_id uuid,
  add constraint quadro_colunas_grupo_fkey foreign key (grupo_id, escritorio_id, modulo)
    references public.quadro_grupos (id, escritorio_id, modulo) on delete set null (grupo_id);
create index quadro_colunas_grupo on public.quadro_colunas (grupo_id) where grupo_id is not null;
grant update (grupo_id) on public.quadro_colunas to authenticated;
