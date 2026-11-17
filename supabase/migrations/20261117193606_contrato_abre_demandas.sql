-- =====================================================================
-- Quem está num contrato vê as demandas e as tarefas dele (#326)
--   O contrato é o centro: quem trabalha nele precisa ver o que sai dele. Até aqui, ser incluído num contrato não abria as demandas
--   dele nem as tarefas ligadas só ao contrato.
--   - "Estar no contrato" é ter criado o contrato, ser o responsável ou um participante (a pessoa do perfil, minha_pessoa(), está em
--     contratos.participantes). A menção não conta: ela dá só a leitura do próprio contrato.
--   - Quem está num contrato lê as demandas dele (demandas.contrato_id) e as tarefas ligadas ao contrato (tarefas.contrato_id) ou a uma
--     dessas demandas. O que fica dentro do cartão e segue "quem vê o cartão" (comentários, listas e itens, histórico, etiquetas,
--     clientes, pessoas da tarefa, ligações a processos) vem junto, porque a leitura dessas tabelas consulta o cartão pelas regras dele.
--     O que lia o cartão por vejo_demanda ou vejo_tarefa direto ganha o mesmo caminho: as anotações ligadas (anotacoes_pelos_itens),
--     o resumo do tempo da tarefa (resumo_do_tempo) e o tempo da demanda (tempo_da_demanda).
--   - Só lê: vejo_demanda, vejo_tarefa e as regras de escrita não mudam. Não altera, não arquiva, não mexe nas listas, nas etiquetas
--     nem no tempo. Comenta, como quem lê com a chave equipe_ve_tudo: a regra de incluir comentário pede ver o cartão.
--   - Quem pode ser mencionado no comentário de uma demanda ou tarefa passa a incluir quem está no contrato dela (quem vê o cartão).
--   - Saiu do contrato, deixa de ver na hora: a regra é calculada a cada leitura. Um escritório nunca vê nada de outro.
--   - Desempenho (#278): os contratos e as demandas alcançados são calculados uma vez por consulta, por funções que devolvem a lista
--     (contratos_em_que_estou, demandas_dos_meus_contratos), e não cartão a cartão.
--   Se a regra de "estar no contrato" mudar (a leitura dos contratos, 20261104150227_visibilidade_dos_contratos.sql), estas funções
--   mudam junto. O teste contrato_abre_demandas confere os casos.
--
--   Só acrescenta: duas funções novas; as regras de leitura e as funções trocadas mostram o mesmo de antes e mais, nada sai. Nenhuma
--   tabela ou coluna muda, e a versão anterior do site continua funcionando: quem está num contrato só passa a ver mais cartões, para ler.
-- =====================================================================

-- 1. Os contratos em que quem está logado está (sem a menção), e as demandas deles. Leem as tabelas sem passar pelas regras delas
--    (security definer): a leitura dos contratos inclui a menção, que aqui não conta, e a das tarefas consultaria as demandas de novo.
--    Quem está logado (escritório, usuário, pessoa) entra como (select ...): é calculado uma vez, e não contrato a contrato. Sem isso,
--    cada contrato repetia a conferência do perfil, da sessão e das duas etapas (#278): meio segundo por leitura com 5 mil contratos.
create function privado.contratos_em_que_estou() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(k.id), '{}')
    from public.contratos k
    where k.escritorio_id = (select privado.meu_escritorio())
      and ((select auth.uid()) in (k.criado_por, k.responsavel_id)
           or ((select privado.minha_pessoa()) is not null
               and k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))))
$$;
revoke execute on function privado.contratos_em_que_estou() from public, anon;
grant execute on function privado.contratos_em_que_estou() to authenticated;

create function privado.demandas_dos_meus_contratos() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(d.id), '{}')
    from public.demandas d
    where d.escritorio_id = (select privado.meu_escritorio())
      and d.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
$$;
revoke execute on function privado.demandas_dos_meus_contratos() from public, anon;
grant execute on function privado.demandas_dos_meus_contratos() to authenticated;

-- 2. A leitura de demandas e tarefas: as condições de 20261109180534_leitura_rapida_dos_quadros.sql, mais o caminho do contrato.
--    Nas tarefas, o caminho novo vem antes da conferência cartão a cartão pela demanda ligada, para ela rodar só quando nada mais deu acesso.
alter policy leitura on public.demandas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin())
              or (select privado.equipe_edita_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id)
              or (select auth.uid()) = any(colaboradores)
              or contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])));

alter policy leitura on public.tarefas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin())
              or (select privado.equipe_edita_tudo())
              or (select privado.equipe_ve_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id)
              or (select auth.uid()) = any(participantes)
              or contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
              or demanda_id = any ((select privado.demandas_dos_meus_contratos())::uuid[])
              or (demanda_id is not null
                  and privado.vejo_tarefa(escritorio_id, criado_por, responsavel_id, participantes, demanda_id))));

-- 3. As anotações ligadas a uma demanda ou tarefa abrem também pelo contrato (igual à de 20261117143714_anotacoes.sql, com o caminho novo).
--    Quem está logado entra como (select ...), calculado uma vez, e não ligação a ligação (como no item 1). O que a função de antes já
--    fazia não muda de sentido: só passa a ser calculado uma vez.
create or replace function privado.anotacoes_pelos_itens() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct l.anotacao_id), '{}')
    from public.anotacao_ligacoes l
    left join public.processos p on p.id = l.processo_id
    left join public.demandas d on d.id = l.demanda_id
    left join public.tarefas t on t.id = l.tarefa_id
    left join public.compromissos c on c.id = l.compromisso_id
    left join public.contratos k on k.id = l.contrato_id
    where l.escritorio_id = (select privado.meu_escritorio())
      and ((p.id is not null and privado.vejo_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores))
        or (d.id is not null and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores))
        or (d.id is not null and d.escritorio_id = (select privado.meu_escritorio())
            and d.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[]))
        or (t.id is not null and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id))
        or (t.id is not null and t.escritorio_id = (select privado.meu_escritorio())
            and (t.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
                 or t.demanda_id = any ((select privado.demandas_dos_meus_contratos())::uuid[])))
        or (c.id is not null and ((c.geral and c.escritorio_id = (select privado.meu_escritorio()))
                                  or privado.participo_do_compromisso(c.escritorio_id, c.criado_por, c.responsavel_id, c.participantes, c.processo_id)))
        or (k.id is not null and k.escritorio_id = (select privado.meu_escritorio())
            and ((select privado.sou_admin())
                 or (select auth.uid()) in (k.criado_por, k.responsavel_id)
                 or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))
                 or k.id = any ((select privado.contratos_em_que_me_mencionaram())::uuid[]))))
$$;

-- 4. O tempo, que lia o cartão por vejo_tarefa e vejo_demanda direto (iguais às de 20261030120000_tempo_nas_tarefas.sql, com o caminho
--    novo). Lançar tempo continua com quem está no cartão (regra incluir de tarefa_tempos).
create or replace function public.resumo_do_tempo(p_tarefa uuid)
returns table(perfil_id uuid, percentual numeric, total bigint)
language sql stable security definer set search_path = '' as $$
  with visivel as (
    select t.id from public.tarefas t
    where t.id = p_tarefa
      and (privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id)
           or (t.escritorio_id = privado.meu_escritorio()
               and (t.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
                    or t.demanda_id = any ((select privado.demandas_dos_meus_contratos())::uuid[]))))
  ), por_pessoa as (
    select tt.perfil_id, sum(tt.segundos)::bigint as s from public.tarefa_tempos tt join visivel v on v.id = tt.tarefa_id group by tt.perfil_id
  ), soma as (select coalesce(sum(greatest(s, 0)), 0)::bigint as total from por_pessoa)
  select p.perfil_id, round(100.0 * p.s / soma.total, 1), soma.total
  from por_pessoa p, soma where p.s > 0 and soma.total > 0
  order by 2 desc
$$;

create or replace function public.tempo_da_demanda(p_demanda uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select greatest(coalesce(sum(tt.segundos), 0), 0)::bigint
  from public.demandas d
  join public.tarefas t on t.demanda_id = d.id
  join public.tarefa_tempos tt on tt.tarefa_id = t.id
  where d.id = p_demanda
    and (privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)
         or (d.escritorio_id = privado.meu_escritorio() and d.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])))
$$;

-- 5. Quem pode ser mencionado: quem vê o cartão, agora também quem está no contrato da demanda ou da tarefa (ou no da demanda da
--    tarefa). Igual à de 20261109102349_equipe_ve_tudo.sql, salvo essas duas condições.
create function privado.perfil_no_contrato(p_perfil uuid, p_contrato uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_contrato is not null and exists (
    select 1 from public.contratos k join public.perfis p on p.id = p_perfil and p.escritorio_id = k.escritorio_id
    where k.id = p_contrato
      and (p.id in (k.criado_por, k.responsavel_id)
           or (p.pessoa_id is not null and k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', p.pessoa_id)))))
$$;
revoke execute on function privado.perfil_no_contrato(uuid, uuid) from public, anon;
grant execute on function privado.perfil_no_contrato(uuid, uuid) to authenticated;

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
  -- Na demanda: quem não é administrador, não está nela e não está no contrato dela.
  if new.demanda_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.demandas d
    where d.id = new.demanda_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from d.criado_por and p.id <> d.responsavel_id and not p.id = any(d.colaboradores)
      and not privado.perfil_no_contrato(p.id, d.contrato_id)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta demanda: inclua essa pessoa como colaboradora antes.', v_nome;
    end if;
  end if;
  -- Na tarefa: quem não é administrador, não está nela, não vê a demanda ligada a ela e não está no contrato dela (nem no da demanda).
  if new.tarefa_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.tarefas t
    where t.id = new.tarefa_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from t.criado_por and p.id <> t.responsavel_id and not p.id = any(t.participantes)
      and not exists (select 1 from public.demandas d where d.id = t.demanda_id
                      and (p.id = d.criado_por or p.id = d.responsavel_id or p.id = any(d.colaboradores)
                           or privado.perfil_no_contrato(p.id, d.contrato_id)))
      and not privado.perfil_no_contrato(p.id, t.contrato_id)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta tarefa: inclua essa pessoa como participante antes.', v_nome;
    end if;
  end if;
  return new;
end $function$;
