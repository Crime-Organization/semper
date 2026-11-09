-- =====================================================================
-- Toda a equipe vê tarefas, demandas, processos e contratos, por enquanto (#271)
--   Os dados importados ainda não estão vinculados aos advogados e não apareceriam para eles. Com a chave "equipe_ve_tudo" ligada em
--   escritorios.modulos (só o dono da plataforma liga e desliga), quem é da equipe do escritório vê esses quatro módulos e comenta,
--   mesmo sem vínculo. Desligada, que é o padrão, vale a regra de sempre. Processos ainda não têm comentários.
--   - Alterar, arquivar, excluir, listas, etiquetas, tempo, andamentos e prazos continuam só com quem já podia. Por isso as regras
--     de escrita que perguntavam "a pessoa enxerga o cartão?" passam a perguntar "a pessoa está no cartão?".
--   - Contratos: as regras da tabela não mudam. Quem não é parte lê pela view contratos_da_equipe, que devolve a linha com o que é
--     financeiro vazio: categoria, valor, entrada, parcelas, descontos, primeiro pagamento, percentuais, indicador, conta, documento
--     e observações. Parcelas, recebimentos, repasses, histórico e os percentuais dos participantes continuam fechados.
--     É parte quem já via o contrato: administradores, quem criou, o responsável, os participantes e o advogado mencionado.
--   - Agora que quem não é parte comenta, a menção dele não vale para ver os valores (senão, dois colegas se mencionariam). O comentário
--     guarda essa marca (autor_sem_vinculo), para continuar sem valer depois de a chave ser desligada. Com a chave desligada, nada muda.
--   - Com a chave ligada, qualquer um da equipe pode ser mencionado em demandas e tarefas. Ligar um cartão a outro continua exigindo estar neles.
-- Só acrescenta (função, view e regras novas; regras e funções trocadas sem mudar tabela nem coluna). A versão anterior do site continua
-- funcionando. Com a chave ligada, ela mostraria botões que o banco recusa: a chave só deve ser ligada depois de publicar o site novo.
-- =====================================================================

create function privado.equipe_ve_tudo() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select e.modulos ->> 'equipe_ve_tudo' = 'true' from public.escritorios e where e.id = privado.meu_escritorio()), false)
$$;
revoke execute on function privado.equipe_ve_tudo() from public, anon;
grant execute on function privado.equipe_ve_tudo() to authenticated;

-- 1. A leitura de demandas, tarefas e processos: uma regra a mais, que soma com a de sempre.
create policy equipe_ve_tudo on public.demandas for select to authenticated using (escritorio_id = (select privado.meu_escritorio()) and (select privado.equipe_ve_tudo()));
create policy equipe_ve_tudo on public.tarefas for select to authenticated using (escritorio_id = (select privado.meu_escritorio()) and (select privado.equipe_ve_tudo()));
create policy equipe_ve_tudo on public.processos for select to authenticated using (escritorio_id = (select privado.meu_escritorio()) and (select privado.equipe_ve_tudo()));

-- 2. A escrita continua com quem está no cartão. Estas regras consultavam o pai pelas regras dele, que agora também mostram o cartão a quem só lê.
create or replace function privado.processo_ativo(p_processo uuid, p_escritorio uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.processos p where p.id = p_processo and p.escritorio_id = p_escritorio and p.arquivado_em is null
                 and privado.vejo_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores))
$$;

alter policy incluir on public.processo_demandas
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()) and privado.processo_ativo(processo_id, escritorio_id)
              and exists (select 1 from public.demandas d where d.id = demanda_id and d.escritorio_id = processo_demandas.escritorio_id and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)));

alter policy incluir on public.tarefa_tempos
  with check (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid())
              and exists (select 1 from public.tarefas t where t.id = tarefa_id and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id)));

alter policy incluir on public.demanda_etiquetas
  with check (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.demandas d where d.id = demanda_id and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)));
alter policy apagar on public.demanda_etiquetas
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.demandas d where d.id = demanda_id and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)));
alter policy incluir on public.tarefa_etiquetas
  with check (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.tarefas t where t.id = tarefa_id and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id)));
alter policy apagar on public.tarefa_etiquetas
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.tarefas t where t.id = tarefa_id and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id)));
alter policy incluir on public.processo_etiquetas
  with check (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.processos p where p.id = processo_id and privado.vejo_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores)));
alter policy apagar on public.processo_etiquetas
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.processos p where p.id = processo_id and privado.vejo_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores)));

-- As listas: "tudo" valia também para ler. A leitura fica numa regra própria, e "tudo" pergunta se a pessoa está no cartão.
create policy leitura on public.demanda_listas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id)));
alter policy tudo on public.demanda_listas
  using (escritorio_id = (select privado.meu_escritorio())
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id))))
  with check (escritorio_id = (select privado.meu_escritorio())
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id))));

create function privado.altero_a_lista(p_lista uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.demanda_listas l
                 left join public.demandas d on d.id = l.demanda_id
                 left join public.tarefas t on t.id = l.tarefa_id
                 where l.id = p_lista
                   and (l.demanda_id is null or (d.id is not null and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)))
                   and (l.tarefa_id is null or (t.id is not null and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id))))
$$;
revoke execute on function privado.altero_a_lista(uuid) from public, anon;
grant execute on function privado.altero_a_lista(uuid) to authenticated;

create policy leitura on public.demanda_lista_itens for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.demanda_listas l where l.id = lista_id));
alter policy tudo on public.demanda_lista_itens
  using (escritorio_id = (select privado.meu_escritorio()) and privado.altero_a_lista(lista_id))
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.altero_a_lista(lista_id));

-- 3. Quem conta como parte por menção: a regra de sempre, sem as menções de quem não era parte ao comentar.
alter table public.comentarios add column autor_sem_vinculo boolean not null default false;

create or replace function privado.contratos_em_que_me_mencionaram() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct c.contrato_id), '{}')
  from public.comentarios c
  where c.contrato_id is not null
    and c.mencoes @> array[auth.uid()]
    and c.escritorio_id = privado.meu_escritorio()
    and c.autor_id is distinct from auth.uid()
    and not c.autor_sem_vinculo
$$;

-- 4. O contrato para quem é da equipe. Roda com os direitos de quem a criou (não passa pelas regras da tabela): por isso filtra o
-- escritório aqui, lista cada coluna (coluna financeira nova não aparece sozinha) e só ela decide o que cada um lê.
create view public.contratos_da_equipe with (security_barrier = true) as
select k.id, k.escritorio_id, k.numero, k.sigla, k.ano, k.codigo, k.codigo_antigo, k.cliente_id, k.cliente_nome, k.clientes, k.responsavel_id,
       k.servico, k.objetos, k.participante_id, k.etapa_id, k.etapa_ordem, k.assinado_em, k.arquivado_em, k.arquivado_por,
       k.criado_por, k.criado_em, k.atualizado_por, k.atualizado_em, k.busca,
       s.parte as ve_financeiro,
       case when s.parte then k.categoria end as categoria,
       case when s.parte then k.valor end as valor,
       case when s.parte then k.entrada end as entrada,
       case when s.parte then k.parcelas end as parcelas,
       case when s.parte then k.descontos end as descontos,
       case when s.parte then k.primeiro_pagamento end as primeiro_pagamento,
       case when s.parte then k.percentual_escritorio end as percentual_escritorio,
       case when s.parte then k.participante_percentual end as participante_percentual,
       case when s.parte then k.indicador_id end as indicador_id,
       case when s.parte then k.indicador_percentual end as indicador_percentual,
       case when s.parte then k.conta_destino_id end as conta_destino_id,
       case when s.parte then k.documento_url end as documento_url,
       case when s.parte then k.observacoes end as observacoes,
       case when s.parte then k.participantes
            else coalesce((select jsonb_agg(x - 'percentual') from jsonb_array_elements(k.participantes) x), '[]'::jsonb) end as participantes,
       (select coalesce(jsonb_agg(jsonb_build_object('ordem', c.ordem, 'pessoa', jsonb_build_object('id', x.id, 'codigo', x.codigo, 'nome', x.nome, 'tipo', x.tipo, 'arquivado_em', x.arquivado_em)) order by c.ordem), '[]'::jsonb)
        from public.contrato_clientes c join public.pessoas x on x.id = c.pessoa_id where c.contrato_id = k.id) as clientela,
       (select coalesce(jsonb_agg(jsonb_build_object('ordem', c.ordem, 'percentual', case when s.parte then c.percentual end, 'pessoa', jsonb_build_object('id', x.id, 'codigo', x.codigo, 'nome', x.nome, 'tipo', x.tipo, 'arquivado_em', x.arquivado_em)) order by c.ordem), '[]'::jsonb)
        from public.contrato_participantes c join public.pessoas x on x.id = c.pessoa_id where c.contrato_id = k.id) as participacoes
from public.contratos k
cross join lateral (
  select coalesce((select privado.sou_admin())
      or (select auth.uid()) in (k.criado_por, k.responsavel_id)
      or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))
      or k.id = any ((select privado.contratos_em_que_me_mencionaram())::uuid[]), false) as parte
) s
where k.escritorio_id = (select privado.meu_escritorio()) and (s.parte or (select privado.equipe_ve_tudo()));

revoke all on public.contratos_da_equipe from public, anon, authenticated;
grant select on public.contratos_da_equipe to authenticated;

-- 5. Comentar no contrato sem ser parte, e ver os clientes e as etiquetas dele. A view já diz quem alcança o contrato.
alter policy leitura on public.comentarios
  using (escritorio_id = (select privado.meu_escritorio())
         and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
         and (contrato_id is null or exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id))
         and (compromisso_id is null or exists (select 1 from public.compromissos c where c.id = compromisso_id)));
alter policy incluir on public.comentarios
  with check (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid())
         and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
         and (contrato_id is null or exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id))
         and (compromisso_id is null or exists (select 1 from public.compromissos c where c.id = compromisso_id)));
alter policy alterar on public.comentarios
  using (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid())
         and (contrato_id is null or exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id)));

alter policy leitura on public.contrato_clientes
  using (exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id));
alter policy leitura on public.contrato_etiquetas
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.contratos_da_equipe c where c.id = contrato_id));

-- 6. O comentário guarda a marca, e a ligação entre cartões continua exigindo estar neles (iguais às anteriores, salvo o que muda aqui).
CREATE OR REPLACE FUNCTION privado.preparar_comentario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nome text;
begin
  new.texto := btrim(new.texto);
  if new.texto = '' then raise exception 'Escreva o comentário.'; end if;
  if tg_op = 'UPDATE' then new.editado_em := now(); end if;
  select coalesce(array_agg(distinct p.id), '{}') into new.mencoes
  from regexp_matches(new.texto, '(^|[^a-z0-9._-])@([a-z0-9._-]+)', 'gi') as m(partes)
  join public.perfis p on p.usuario = rtrim(lower(m.partes[2]), '.') and p.escritorio_id = new.escritorio_id and p.ativo;
  -- Quem não é parte comenta com a chave ligada, mas a menção dele não dá acesso aos valores, nem depois de a chave ser desligada.
  new.autor_sem_vinculo := new.contrato_id is not null and privado.equipe_ve_tudo()
    and not exists (select 1 from public.contratos k where k.id = new.contrato_id
                    and (privado.sou_admin() or auth.uid() = k.criado_por or auth.uid() = k.responsavel_id
                         or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', privado.minha_pessoa()))))
    and not new.contrato_id = any(privado.contratos_em_que_me_mencionaram());
  if new.contrato_id is not null then
    select p.nome into v_nome from public.perfis p where p.id = any(new.mencoes) and p.funcao <> 'advogado' order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % em contratos: só advogados podem ser mencionados.', v_nome;
    end if;
  end if;
  if new.demanda_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.demandas d
    where d.id = new.demanda_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from d.criado_por and p.id <> d.responsavel_id and not p.id = any(d.colaboradores)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta demanda: inclua essa pessoa como colaboradora antes.', v_nome;
    end if;
  end if;
  -- Na tarefa: quem não é administrador, não está nela e não vê a demanda ligada a ela.
  if new.tarefa_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.tarefas t
    where t.id = new.tarefa_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from t.criado_por and p.id <> t.responsavel_id and not p.id = any(t.participantes)
      and not exists (select 1 from public.demandas d where d.id = t.demanda_id
                      and (p.id = d.criado_por or p.id = d.responsavel_id or p.id = any(d.colaboradores)))
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta tarefa: inclua essa pessoa como participante antes.', v_nome;
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION privado.preparar_andamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.texto := btrim(new.texto);
  new.local := nullif(btrim(new.local), '');
  -- A tarefa foi desligada (ou excluída) sem ninguém mexer na marcação: a intimação volta a ficar a tratar.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is null and new.tratada_em is not distinct from old.tratada_em then
    new.tratada_em := null;
  end if;
  if new.tratada_em is null then
    new.tratada_por := null;
  elsif tg_op = 'INSERT' or old.tratada_em is null then
    new.tratada_em := now();
    new.tratada_por := auth.uid();
  else
    new.tratada_em := old.tratada_em;
  end if;
  if new.excluido_em is not null then
    new.excluido_em := case when tg_op = 'UPDATE' and old.excluido_em is not null then old.excluido_em else now() end;
  end if;
  -- Outra pessoa já criou a tarefa, com a tela desatualizada aqui: não troca uma tarefa por outra.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is not null and new.tarefa_id <> old.tarefa_id then
    raise exception 'Já existe uma tarefa ligada a este item.';
  end if;
  if new.tarefa_id is not null and (tg_op = 'INSERT' or new.tarefa_id is distinct from old.tarefa_id)
     and not exists (select 1 from public.tarefas t where t.id = new.tarefa_id and t.escritorio_id = new.escritorio_id
                     and (auth.uid() is null or privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id))) then
    raise exception 'Tarefa não encontrada neste escritório.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION privado.preparar_prazo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.descricao := btrim(new.descricao);
  if new.concluido_em is null then
    new.concluido_por := null;
  elsif tg_op = 'INSERT' or old.concluido_em is null then
    new.concluido_em := now();
    new.concluido_por := auth.uid();
  else
    new.concluido_em := old.concluido_em;
  end if;
  if new.excluido_em is not null then
    new.excluido_em := case when tg_op = 'UPDATE' and old.excluido_em is not null then old.excluido_em else now() end;
  end if;
  if new.andamento_id is not null and (tg_op = 'INSERT' or new.andamento_id is distinct from old.andamento_id)
     and not exists (select 1 from public.processo_andamentos a where a.id = new.andamento_id and a.processo_id = new.processo_id) then
    raise exception 'Este andamento não é deste processo.';
  end if;
  -- Outra pessoa já criou a tarefa, com a tela desatualizada aqui: não troca uma tarefa por outra.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is not null and new.tarefa_id <> old.tarefa_id then
    raise exception 'Já existe uma tarefa ligada a este item.';
  end if;
  if new.tarefa_id is not null and (tg_op = 'INSERT' or new.tarefa_id is distinct from old.tarefa_id)
     and not exists (select 1 from public.tarefas t where t.id = new.tarefa_id and t.escritorio_id = new.escritorio_id
                     and (auth.uid() is null or privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id))) then
    raise exception 'Tarefa não encontrada neste escritório.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION privado.conferir_processo_da_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.processo_id is not null
     and not exists (select 1 from public.processos p where p.id = new.processo_id and p.escritorio_id = new.escritorio_id
                     and (auth.uid() is null or privado.vejo_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores))) then
    raise exception 'Processo não encontrado neste escritório.';
  end if;
  return new;
end $function$;
