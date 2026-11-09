-- =====================================================================
-- Fase de adaptação: toda a equipe vê e edita tudo, menos o financeiro (#275)
--   Com a chave "equipe_edita_tudo" do escritório, as regras "a pessoa está no cartão?" de demandas, tarefas, processos e compromissos
--   passam a valer para toda a equipe: é o único ponto de onde dependem as regras de alterar e de tudo o que fica dentro do cartão
--   (listas, etiquetas, tempo, andamentos, prazos). Excluir de vez continua com quem criou e com os administradores.
--   - Contratos: a tabela continua fechada a quem não é parte. Ele altera só situação, etiquetas, objetos, clientes e código antigo, pela
--     função contrato_alterar_sem_valores, que não recebe nem devolve nada financeiro. Responsável e participantes ficam com quem é parte:
--     são eles que decidem quem vê os valores, e quem não é parte poderia se incluir.
--   - Com a fase ligada, qualquer um da equipe pode ser mencionado em compromissos.
--   - O administrador liga e desliga em Configurações (fase_de_adaptacao_definir). Desligar tira também a chave "equipe_ve_tudo"
--     (#271): volta a regra normal. Fica registrado em quem mudou, no registro de ações.
-- Só acrescenta: funções novas e condições a mais nas funções e regras. Com a chave desligada, nada muda, e a versão anterior do site continua
-- funcionando. Com a chave ligada, ela mostraria o aviso de "só leitura" a quem já pode alterar: a chave só deve ser ligada com o site novo no ar.
-- =====================================================================

create function privado.equipe_edita_tudo() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select e.modulos ->> 'equipe_edita_tudo' = 'true' from public.escritorios e where e.id = privado.meu_escritorio()), false)
$$;
revoke execute on function privado.equipe_edita_tudo() from public, anon;
grant execute on function privado.equipe_edita_tudo() to authenticated;

-- 1. "A pessoa está no cartão?" (iguais às anteriores, com a chave).
CREATE OR REPLACE FUNCTION privado.vejo_demanda(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_colaboradores uuid[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_colaboradores))
$function$;

CREATE OR REPLACE FUNCTION privado.vejo_tarefa(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_participantes uuid[], p_demanda uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_participantes)
          or exists (select 1 from public.demandas d where d.id = p_demanda
                     and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)))
$function$;

CREATE OR REPLACE FUNCTION privado.vejo_processo(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_colaboradores uuid[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_colaboradores))
$function$;

CREATE OR REPLACE FUNCTION privado.participo_do_compromisso(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_participantes uuid[], p_processo uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_participantes)
          or exists (select 1 from public.processos p where p.id = p_processo
                     and privado.vejo_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores)))
$function$;

-- 2. As etiquetas do contrato: quem não é parte só lê a tabela pela view.
alter policy incluir on public.contrato_etiquetas
  with check (escritorio_id = (select privado.meu_escritorio()) and (exists (select 1 from public.contratos c where c.id = contrato_id)
              or ((select privado.equipe_edita_tudo()) and exists (select 1 from public.contratos_da_equipe c where c.id = contrato_id))));
alter policy apagar on public.contrato_etiquetas
  using (escritorio_id = (select privado.meu_escritorio()) and (exists (select 1 from public.contratos c where c.id = contrato_id)
         or ((select privado.equipe_edita_tudo()) and exists (select 1 from public.contratos_da_equipe c where c.id = contrato_id))));

-- 3. O que quem não é parte altera no contrato. Só mexe nas colunas que recebe.
create function public.contrato_alterar_sem_valores(p_id uuid, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare k public.contratos;
begin
  if not privado.equipe_edita_tudo() then
    raise exception 'Você não tem permissão para fazer isso.';
  end if;
  select * into k from public.contratos c where c.id = p_id and c.escritorio_id = privado.meu_escritorio() and c.arquivado_em is null for update;
  if k.id is null then
    raise exception 'Contrato não encontrado neste escritório.';
  end if;
  update public.contratos c set
    clientes = case when p_dados ? 'clientes' then array(select v::uuid from jsonb_array_elements_text(p_dados -> 'clientes') v) else c.clientes end,
    objetos = case when p_dados ? 'objetos' then array(select jsonb_array_elements_text(p_dados -> 'objetos')) else c.objetos end,
    servico = case when p_dados ? 'servico' then p_dados ->> 'servico' else c.servico end,
    codigo_antigo = case when p_dados ? 'codigo_antigo' then p_dados ->> 'codigo_antigo' else c.codigo_antigo end,
    etapa_id = case when p_dados ? 'etapa_id' then (p_dados ->> 'etapa_id')::uuid else c.etapa_id end,
    etapa_ordem = case when p_dados ? 'etapa_ordem' then (p_dados ->> 'etapa_ordem')::double precision else c.etapa_ordem end
  where c.id = p_id
  returning c.* into k;
  if not privado.etapa_valida(k.etapa_id, 'contratos') or not privado.partes_do_escritorio(k.cliente_id, k.responsavel_id, k.participante_id, k.indicador_id) then
    raise exception 'Confira a situação e as pessoas do contrato.';
  end if;
end $$;
revoke execute on function public.contrato_alterar_sem_valores(uuid, jsonb) from public, anon;
grant execute on function public.contrato_alterar_sem_valores(uuid, jsonb) to authenticated;

-- 4. O botão de Configurações.
create function public.fase_de_adaptacao_definir(p_ligada boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio();
begin
  if not privado.sou_admin() then
    raise exception 'Só um administrador muda esta opção.';
  end if;
  update public.escritorios set modulos = case when p_ligada then modulos || '{"equipe_ve_tudo": true, "equipe_edita_tudo": true}'::jsonb
                                               else modulos - 'equipe_ve_tudo' - 'equipe_edita_tudo' end
  where id = v_escritorio;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_escritorio, 'escritorios', v_escritorio::text, 'alteracao', jsonb_build_object('fase_de_adaptacao', p_ligada), auth.uid());
end $$;
revoke execute on function public.fase_de_adaptacao_definir(boolean) from public, anon;
grant execute on function public.fase_de_adaptacao_definir(boolean) to authenticated;

-- 5. A menção em compromisso: com a fase ligada, todos veem (igual à anterior, com a chave).
CREATE OR REPLACE FUNCTION privado.mencao_no_compromisso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nome text;
begin
  select p.nome into v_nome from public.perfis p, public.compromissos c
  where c.id = new.compromisso_id and p.id = any(new.mencoes) and not c.geral and not privado.equipe_edita_tudo() and p.papel not in ('master', 'admin')
    and p.id is distinct from c.criado_por and p.id <> c.responsavel_id and not p.id = any(c.participantes)
    and not exists (select 1 from public.processos x where x.id = c.processo_id
                    and (p.id = x.criado_por or p.id = x.responsavel_id or p.id = any(x.colaboradores)))
  order by p.nome limit 1;
  if v_nome is not null then
    raise exception 'Não é possível mencionar % neste compromisso: inclua essa pessoa como participante antes.', v_nome;
  end if;
  return new;
end $function$;
