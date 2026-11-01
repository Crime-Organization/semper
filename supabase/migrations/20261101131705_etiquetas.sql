-- =====================================================================
-- Etiquetas coloridas com texto, em todos os quadros (tarefa #176)
--   O escritório tem uma lista única de etiquetas, cada uma com uma cor de uma paleta fixa e, se quiser, um texto.
--   Qualquer pessoa da equipe aplica as etiquetas nos cartões que vê.
--   - Quem cria uma etiqueta cria para o escritório todo. Muda ou exclui quem criou ou um administrador.
--   - Não há duas etiquetas com o mesmo texto (maiúsculas e acentos não contam), nem duas só de cor na mesma cor.
--   - Cada módulo tem uma tabela que liga cartão e etiqueta, como as de responsáveis: quem vê o cartão vê as etiquetas
--     dele, porque a regra de cada tabela passa pela regra do próprio cartão.
--   - Excluir a etiqueta ou o cartão apaga a ligação. Aplicar etiqueta não mexe no cartão: não entra no histórico dele.
--   Os tamanhos e as cores são os de app/src/dados/limites.ts (TAMANHO_ETIQUETA) e app/src/regras/etiquetas.ts.
--   Só acrescenta (tabelas e regras novas). A versão anterior do site continua funcionando: ela não lê as etiquetas.
-- =====================================================================

create table public.etiquetas (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  cor           text not null check (cor in ('vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo', 'rosa', 'cinza')),
  texto         text check (texto is null or (btrim(texto) <> '' and length(texto) <= 40)),
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  unique (id, escritorio_id)
);
create unique index etiquetas_texto_unico on public.etiquetas (escritorio_id, privado.sem_acento(btrim(texto))) where texto is not null;
create unique index etiquetas_cor_unica on public.etiquetas (escritorio_id, cor) where texto is null;

alter table public.etiquetas enable row level security;
revoke all on public.etiquetas from anon;
revoke update on public.etiquetas from authenticated;
grant update (cor, texto) on public.etiquetas to authenticated;

create policy leitura on public.etiquetas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.etiquetas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()));
create policy alterar on public.etiquetas for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and ((select privado.sou_admin()) or criado_por = (select auth.uid())))
  with check (escritorio_id = (select privado.meu_escritorio()));
create policy apagar on public.etiquetas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and ((select privado.sou_admin()) or criado_por = (select auth.uid())));

-- Uma tabela de ligação por módulo (tabela, coluna do cartão, tabela do cartão). As regras consultam o cartão com as
-- regras dele: quem não vê o cartão não vê nem aplica as etiquetas. Módulo novo = uma linha nova aqui, numa migração nova.
do $$
declare m record;
begin
  for m in select * from (values
    ('pessoa_etiquetas', 'pessoa_id', 'pessoas'),
    ('contrato_etiquetas', 'contrato_id', 'contratos'),
    ('demanda_etiquetas', 'demanda_id', 'demandas'),
    ('tarefa_etiquetas', 'tarefa_id', 'tarefas')
  ) as t(tabela, coluna, cartoes) loop
    execute format($f$
      create table public.%1$I (
        escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
        %2$I          uuid not null references public.%3$I on delete cascade,
        etiqueta_id   uuid not null,
        primary key (%2$I, etiqueta_id),
        foreign key (etiqueta_id, escritorio_id) references public.etiquetas (id, escritorio_id) on delete cascade
      );
      create index %4$I on public.%1$I (etiqueta_id);
      alter table public.%1$I enable row level security;
      revoke all on public.%1$I from anon;
      revoke update on public.%1$I from authenticated;
      create policy leitura on public.%1$I for select to authenticated
        using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.%3$I c where c.id = %2$I));
      create policy incluir on public.%1$I for insert to authenticated
        with check (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.%3$I c where c.id = %2$I));
      create policy apagar on public.%1$I for delete to authenticated
        using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.%3$I c where c.id = %2$I));
    $f$, m.tabela, m.coluna, m.cartoes, m.tabela || '_etiqueta');
  end loop;
end $$;
