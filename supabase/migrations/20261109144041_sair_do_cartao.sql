-- =====================================================================
-- A pessoa sempre pode sair de um cartão, e a saída fica registrada (#276)
--   A regra de alterar recusa a gravação que tira a pessoa do cartão que ela só vê por participar dele. Esta função é o caminho para sair:
--   tira só quem está chamando, de tarefas, demandas, processos e compromissos. O responsável passa o cartão a outra pessoa antes.
--   A saída entra no histórico do cartão, pelo gatilho de sempre, com quem saiu e quando. Contratos ficam de fora: tirar um participante
--   muda a divisão dos valores.
--   Tarefas e demandas passam a conferir só quem está entrando, como processos e compromissos: alguém que saiu da equipe não trava a saída dos outros.
--   Só acrescenta: uma função nova e uma conferência a menos, para quem já estava no cartão. A versão anterior do site continua funcionando.
-- =====================================================================

create function public.cartao_sair(p_modulo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_eu uuid := auth.uid();
  v_escritorio uuid := privado.meu_escritorio();
  v_coluna text := case p_modulo when 'tarefas' then 'participantes' when 'compromissos' then 'participantes'
                                 when 'demandas' then 'colaboradores' when 'processos' then 'colaboradores' end;
  v_linhas integer;
begin
  if v_coluna is null or v_escritorio is null then
    raise exception 'Você não tem permissão para fazer isso.';
  end if;
  execute format('update public.%I set %I = array_remove(%I, $1) where id = $2 and escritorio_id = $3 and $1 = any(%I)', p_modulo, v_coluna, v_coluna, v_coluna)
    using v_eu, p_id, v_escritorio;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Você não está entre as pessoas deste cartão.';
  end if;
end $$;
revoke execute on function public.cartao_sair(text, uuid) from public, anon;
grant execute on function public.cartao_sair(text, uuid) to authenticated;

create or replace function privado.preparar_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid[] := '{}'; x uuid; d public.demandas;
begin
  new.titulo := btrim(new.titulo);
  foreach x in array new.pessoas loop
    continue when x is null or x = any(v);
    if not exists (select 1 from public.pessoas where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'Pessoa não encontrada neste escritório.';
    end if;
    v := v || x;
  end loop;
  new.pessoas := v;
  new.pessoa_nome := coalesce(privado.nomes_dos_clientes(v, '; '), '');

  if not exists (select 1 from public.perfis where id = new.responsavel_id and escritorio_id = new.escritorio_id) then
    raise exception 'O responsável precisa ser alguém da equipe do escritório.';
  end if;
  v := '{}';
  foreach x in array new.participantes loop
    continue when x is null or x = any(v) or x = new.responsavel_id;
    -- Confere só quem está entrando: quem já estava e saiu da equipe não trava a saída de ninguém.
    if (tg_op = 'INSERT' or x <> all(old.participantes))
       and not exists (select 1 from public.perfis where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'O participante precisa ser alguém da equipe do escritório.';
    end if;
    v := v || x;
  end loop;
  new.participantes := v;

  if new.demanda_id is null then
    new.demanda_codigo := null;
  elsif tg_op = 'INSERT' or new.demanda_id is distinct from old.demanda_id then
    select * into d from public.demandas where id = new.demanda_id and escritorio_id = new.escritorio_id;
    if d.id is null or (auth.uid() is not null
        and not privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)) then
      raise exception 'Demanda não encontrada neste escritório.';
    end if;
    new.demanda_codigo := d.codigo;
  end if;

  if new.contrato_id is null then
    new.contrato_codigo := null;
  elsif tg_op = 'INSERT' or new.contrato_id is distinct from old.contrato_id then
    select codigo into new.contrato_codigo from public.contratos where id = new.contrato_id and escritorio_id = new.escritorio_id;
    if new.contrato_codigo is null then raise exception 'Contrato não encontrado neste escritório.'; end if;
  end if;
  return new;
end $$;

create or replace function privado.preparar_demanda() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid[] := '{}'; x uuid;
begin
  new.titulo := btrim(new.titulo);
  foreach x in array new.clientes loop
    continue when x is null or x = any(v);
    if not exists (select 1 from public.pessoas where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'Cliente não encontrado neste escritório.';
    end if;
    v := v || x;
  end loop;
  new.clientes := v;
  new.cliente_nome := coalesce(privado.nomes_dos_clientes(v, '; '), '');

  if not exists (select 1 from public.perfis where id = new.responsavel_id and escritorio_id = new.escritorio_id) then
    raise exception 'O responsável precisa ser alguém da equipe do escritório.';
  end if;
  v := '{}';
  foreach x in array new.colaboradores loop
    continue when x is null or x = any(v) or x = new.responsavel_id;
    -- Confere só quem está entrando: quem já estava e saiu da equipe não trava a saída de ninguém.
    if (tg_op = 'INSERT' or x <> all(old.colaboradores))
       and not exists (select 1 from public.perfis where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'O colaborador precisa ser alguém da equipe do escritório.';
    end if;
    v := v || x;
  end loop;
  new.colaboradores := v;

  if new.contrato_id is null then
    new.contrato_codigo := null;
  elsif tg_op = 'INSERT' or new.contrato_id is distinct from old.contrato_id then
    select codigo into new.contrato_codigo from public.contratos where id = new.contrato_id and escritorio_id = new.escritorio_id;
    if new.contrato_codigo is null then raise exception 'Contrato não encontrado neste escritório.'; end if;
  end if;
  return new;
end $$;
