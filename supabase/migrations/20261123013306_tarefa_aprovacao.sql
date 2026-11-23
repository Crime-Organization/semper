-- =====================================================================
-- Tarefa: aprovação interna antes de concluir (#313, parte D)
--   Decisão do dono: a aprovação vale só para a tarefa com a caixa "Precisa de aprovação" marcada (o cadastro a marca sozinho quando
--   o solicitante é outra pessoa que não o responsável). Ao ser concluída, essa tarefa espera na coluna que já existe "Aguardando:
--   análise do solicitante" (#314); só o solicitante ou um administrador aprova (ela vai para a coluna das concluídas) ou devolve, com
--   um comentário obrigatório (ela volta para "Fazendo").
--   1. A coluna de aprovação: em cada escritório, a "Aguardando: análise do solicitante" do quadro de tarefas (ou a de nome parecido
--      que ele já tem) passa a ser reconhecida pelo sistema (quadro_colunas.de_aprovacao), mesmo que seja renomeada. Onde ela não existe
--      mais, é criada de novo, depois de "Fazendo" (a mesma lógica de acrescentar_colunas_padrao, sem repetir). O escritório novo nasce
--      com ela. Como a coluna-marco, ela pode ser renomeada e mudar de lugar, mas não pode ser excluída nem criada à mão.
--      Não usa o campo "marco": a versão anterior do site não conhece um marco novo (o menu da coluna quebraria nela).
--   2. tarefas.precisa_aprovacao: a caixa. A tarefa que a tem e é levada à coluna das concluídas por quem não aprova vai, no lugar, para
--      a coluna de aprovação (gatilho aa_aprovacao, antes do gatilho "conclusao": a data de conclusão só é marcada na aprovação). Quem
--      aprova (o solicitante ou um administrador) conclui direto. Sair da coluna de aprovação para outra que não a das concluídas não
--      é travado: quem executa pode retirar a tarefa (e o Desfazer do "enviada para aprovação" funciona).
--   3. Só quem aprova muda a caixa ou troca o solicitante de uma tarefa que precisa de aprovação (senão, quem executa se aprovaria).
--   4. public.tarefa_aprovar(id) e public.tarefa_devolver(id, comentario): para o solicitante, que vê a tarefa mas não a altera
--      (parte B), aprovar e devolver. Os dois conferem quem aprova, a caixa e a coluna. Devolver grava o comentário no cartão.
--   O tamanho do comentário da devolução é TAMANHO_TAREFA.devolucao em app/src/dados/limites.ts.
--
--   Só acrescenta: duas colunas com valor padrão (nenhuma coluna de aprovação; não precisa de aprovação), um índice, funções,
--   gatilhos, e duas regras de quadro_colunas que recusam, além do de antes, criar ou excluir a coluna de aprovação. A versão anterior
--   do site continua funcionando: ela não conhece a caixa (a tarefa dela nasce sem aprovação) e vê a coluna como uma coluna comum
--   (só não consegue excluí-la). Se ela levar às concluídas uma tarefa que precisa de aprovação, a tarefa vai para a de aprovação.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. A coluna de aprovação.
-- ---------------------------------------------------------------------
alter table public.quadro_colunas add column de_aprovacao boolean not null default false;
alter table public.quadro_colunas add constraint quadro_colunas_aprovacao_das_tarefas
  check (not de_aprovacao or (modulo = 'tarefas' and marco is null));
-- Uma só em cada escritório.
create unique index quadro_colunas_aprovacao_unica on public.quadro_colunas (escritorio_id) where de_aprovacao;

-- Ninguém cria a coluna de aprovação pela tela, e ela não se exclui. ("de_aprovacao" fica de fora do que se pode alterar: as colunas
-- que a tela altera são só nome, ordem e grupo_id.)
alter policy incluir on public.quadro_colunas
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()) and marco is null and not de_aprovacao);
alter policy apagar on public.quadro_colunas
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and marco is null and not de_aprovacao);

-- Marca (ou cria) a coluna de aprovação de um escritório: a primeira coluna comum das tarefas com o nome de "Aguardando: análise do
-- solicitante" ou um dos parecidos (privado.colunas_novas_das_tarefas, #314); sem nenhuma, ela é criada depois de "Fazendo". Um
-- quadro sem colunas fica como está (o preparo do escritório é que o monta). O mesmo de colunaDeAprovacaoNoQuadro no site.
create function privado.marcar_coluna_de_aprovacao(p_escritorio uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_padrao jsonb := privado.colunas_novas_das_tarefas() -> 0;
  v_coluna uuid;
begin
  if exists (select 1 from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.de_aprovacao) then return; end if;
  for i in 1 .. 2 loop
    select c.id into v_coluna from public.quadro_colunas c
    where c.escritorio_id = p_escritorio and c.modulo = 'tarefas' and c.marco is null
      and privado.chave_da_coluna(c.nome) in (
        select privado.chave_da_coluna(v_padrao ->> 'nome')
        union all
        select privado.chave_da_coluna(p) from jsonb_array_elements_text(coalesce(v_padrao -> 'parecidos', '[]'::jsonb)) p)
    order by c.ordem, c.id limit 1;
    exit when v_coluna is not null or i = 2;
    -- Não existe: entra depois de "Fazendo" (ou nada, se o quadro ainda não tem colunas).
    perform privado.acrescentar_colunas_padrao(p_escritorio, 'tarefas', jsonb_build_array(v_padrao), 'Fazendo');
  end loop;
  if v_coluna is not null then
    update public.quadro_colunas set de_aprovacao = true where id = v_coluna;
  end if;
end $$;
revoke execute on function privado.marcar_coluna_de_aprovacao(uuid) from public, anon, authenticated;

-- Escritório novo: depois das colunas novas das tarefas (#314). O nome vem depois de "zy_colunas_novas_das_tarefas" e antes de
-- "zz_grupos_depois_das_colunas" na ordem alfabética (o Postgres roda os gatilhos nessa ordem).
create function privado.coluna_de_aprovacao_do_escritorio_novo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.marcar_coluna_de_aprovacao(new.id);
  return null;
end $$;
revoke execute on function privado.coluna_de_aprovacao_do_escritorio_novo() from public, anon, authenticated;
create trigger zy_colunas_novas_das_tarefas_aprovacao after insert on public.escritorios
  for each row execute function privado.coluna_de_aprovacao_do_escritorio_novo();

-- Escritório que já existe: uma vez, agora.
select privado.marcar_coluna_de_aprovacao(e.id) from public.escritorios e;

-- ---------------------------------------------------------------------
-- 2. A caixa "Precisa de aprovação" e o desvio para a coluna de aprovação.
-- ---------------------------------------------------------------------
alter table public.tarefas add column precisa_aprovacao boolean not null default false;
grant update (precisa_aprovacao) on public.tarefas to authenticated;

-- Quem aprova a tarefa: o solicitante ou um administrador. Sem ninguém logado (uma rotina, a importação), vale como quem aprova.
create function privado.aprovo_a_tarefa(p_solicitante uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is null or auth.uid() = p_solicitante or privado.sou_admin()
$$;
revoke execute on function privado.aprovo_a_tarefa(uuid) from public, anon, authenticated;

-- Antes de gravar: (a) só quem aprova muda a caixa ou troca o solicitante de uma tarefa que precisa de aprovação; (b) a tarefa que
-- precisa de aprovação e chega à coluna das concluídas pelas mãos de quem não aprova vai, no lugar, para a coluna de aprovação. O nome
-- começa com "aa_" para rodar antes do gatilho "conclusao" (que marca a data de conclusão pela coluna de chegada).
create function privado.aprovacao_da_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_aprovacao uuid;
begin
  if tg_op = 'UPDATE' and (old.precisa_aprovacao or new.precisa_aprovacao)
     and (new.precisa_aprovacao is distinct from old.precisa_aprovacao or new.solicitante_id is distinct from old.solicitante_id)
     and not privado.aprovo_a_tarefa(old.solicitante_id) then
    raise exception 'Só quem pediu a tarefa ou um administrador muda a aprovação ou o solicitante dela.';
  end if;
  if not new.precisa_aprovacao or (tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id)
     or privado.aprovo_a_tarefa(new.solicitante_id)
     or not exists (select 1 from public.quadro_colunas c where c.id = new.etapa_id and c.marco = 'concluido') then
    return new;
  end if;
  select c.id into v_aprovacao from public.quadro_colunas c where c.escritorio_id = new.escritorio_id and c.de_aprovacao;
  if v_aprovacao is not null then
    new.etapa_id := v_aprovacao;
  end if;
  return new;
end $$;
revoke execute on function privado.aprovacao_da_tarefa() from public, anon, authenticated;
create trigger aa_aprovacao before insert or update of etapa_id, precisa_aprovacao, solicitante_id on public.tarefas
  for each row execute function privado.aprovacao_da_tarefa();

-- ---------------------------------------------------------------------
-- 3. Aprovar e devolver.
-- ---------------------------------------------------------------------
-- A tarefa que espera a aprovação de quem está logado (senão, a recusa em português).
create function privado.tarefa_que_aprovo(p_id uuid) returns public.tarefas
language plpgsql stable security definer set search_path = '' as $$
declare t public.tarefas;
begin
  select * into t from public.tarefas where id = p_id and escritorio_id = privado.meu_escritorio();
  if t.id is null then raise exception 'Tarefa não encontrada neste escritório.'; end if;
  if not (auth.uid() = t.solicitante_id or privado.sou_admin()) then
    raise exception 'Só quem pediu a tarefa ou um administrador aprova ou devolve.';
  end if;
  if t.arquivado_em is not null or not t.precisa_aprovacao
     or not exists (select 1 from public.quadro_colunas c where c.id = t.etapa_id and c.de_aprovacao) then
    raise exception 'Esta tarefa não está esperando aprovação.';
  end if;
  return t;
end $$;
revoke execute on function privado.tarefa_que_aprovo(uuid) from public, anon, authenticated;

-- Aprovar: a tarefa vai para a coluna das concluídas (no fim da ordem manual, como a tela faz). Devolve a coluna.
create function public.tarefa_aprovar(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t public.tarefas := privado.tarefa_que_aprovo(p_id); v_fim uuid;
begin
  select c.id into v_fim from public.quadro_colunas c where c.escritorio_id = t.escritorio_id and c.modulo = 'tarefas' and c.marco = 'concluido';
  if v_fim is null then raise exception 'O quadro de tarefas não tem a coluna das concluídas.'; end if;
  update public.tarefas set etapa_id = v_fim, etapa_ordem = extract(epoch from clock_timestamp()) where id = p_id;
  return v_fim;
end $$;
revoke execute on function public.tarefa_aprovar(uuid) from public, anon;
grant execute on function public.tarefa_aprovar(uuid) to authenticated;

-- Devolver: o comentário (obrigatório) entra no cartão, com quem devolveu como autor, e a tarefa volta para "Fazendo" (a coluna comum
-- com esse nome; sem ela, a coluna do início). Devolve a coluna.
create function public.tarefa_devolver(p_id uuid, p_comentario text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t public.tarefas := privado.tarefa_que_aprovo(p_id); v_texto text := btrim(coalesce(p_comentario, '')); v_volta uuid;
begin
  if v_texto = '' then raise exception 'Diga o que precisa ser ajustado.'; end if;
  if length(v_texto) > 1000 then raise exception 'O comentário da devolução pode ter até 1000 caracteres.'; end if;   -- TAMANHO_TAREFA.devolucao
  select c.id into v_volta from public.quadro_colunas c
  where c.escritorio_id = t.escritorio_id and c.modulo = 'tarefas' and c.marco is null and not c.de_aprovacao
    and privado.chave_da_coluna(c.nome) = privado.chave_da_coluna('Fazendo')
  order by c.ordem, c.id limit 1;
  if v_volta is null then
    select c.id into v_volta from public.quadro_colunas c where c.escritorio_id = t.escritorio_id and c.modulo = 'tarefas' and c.marco = 'inicio';
  end if;
  if v_volta is null then raise exception 'O quadro de tarefas não tem a coluna para onde a tarefa volta.'; end if;
  insert into public.comentarios (escritorio_id, tarefa_id, autor_id, texto) values (t.escritorio_id, p_id, auth.uid(), 'Tarefa devolvida: ' || v_texto);
  update public.tarefas set etapa_id = v_volta, etapa_ordem = extract(epoch from clock_timestamp()) where id = p_id;
  return v_volta;
end $$;
revoke execute on function public.tarefa_devolver(uuid, text) from public, anon;
grant execute on function public.tarefa_devolver(uuid, text) to authenticated;
