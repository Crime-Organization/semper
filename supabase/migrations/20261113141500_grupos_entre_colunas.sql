-- =====================================================================
-- Grupo do quadro entre colunas sem grupo (#296)
--   Até aqui, o site mostrava primeiro as colunas sem grupo e depois os grupos, cada um com a sua ordem (quadro_grupos.ordem
--   contava só entre os grupos). Agora a ordem do grupo vale junto com a das colunas sem grupo (quadro_colunas.ordem): o
--   grupo fica onde a ordem dele cai, e pode ir para entre duas colunas sem grupo.
--   Para os quadros de hoje continuarem iguais, cada grupo ganha uma ordem bem maior que a de todas as colunas do mesmo
--   quadro (uma folga de 1.000.000), na mesma sequência de antes.
--   A folga é para a versão anterior do site, que ainda pode ficar aberta: ela cria a coluna nova com a maior ordem de
--   coluna + 1, e a coluna continua antes dos grupos, como ela mesma mostra. O grupo que ela cria num quadro sem grupos
--   (com ordem 1) é empurrado para depois das colunas pelo gatilho abaixo.
--   Escritório novo: o quadro de Processos nasce com grupos de ordem 1 a 6 e colunas de 1 a 30; um gatilho os põe depois
--   das colunas, como nos quadros de hoje.
--   Só acrescenta (funções e gatilhos) e renumera a ordem dos grupos. A versão anterior do site continua funcionando: ela
--   ainda põe os grupos depois das colunas sem grupo e os ordena entre si, e a sequência entre os grupos não muda.
-- =====================================================================

-- Folga entre a última coluna do quadro e o primeiro grupo (veja acima).
create function privado.folga_dos_grupos() returns double precision
language sql immutable set search_path = '' as $$ select 1000000::double precision $$;
revoke execute on function privado.folga_dos_grupos() from public, anon, authenticated;

-- Põe os grupos de cada quadro depois de todas as colunas dele, com a folga, na ordem em que já estavam. Serve para um
-- escritório (e um módulo) ou para todos (null).
create function privado.grupos_depois_das_colunas(p_escritorio uuid, p_modulo text) returns void
language sql security definer set search_path = '' as $$
  update public.quadro_grupos g set ordem = n.nova
  from (
    select g2.id,
           coalesce((select max(c.ordem) from public.quadro_colunas c where c.escritorio_id = g2.escritorio_id and c.modulo = g2.modulo), 0)
             + privado.folga_dos_grupos()
             + row_number() over (partition by g2.escritorio_id, g2.modulo order by g2.ordem, g2.criado_em, g2.id) as nova
    from public.quadro_grupos g2
    where (p_escritorio is null or g2.escritorio_id = p_escritorio) and (p_modulo is null or g2.modulo = p_modulo)
  ) n
  where n.id = g.id;
$$;
revoke execute on function privado.grupos_depois_das_colunas(uuid, text) from public, anon, authenticated;

select privado.grupos_depois_das_colunas(null, null);

-- Grupo criado com uma ordem que não passa da maior coluna do quadro (a versão anterior do site, num quadro sem grupos,
-- usa 1): vai para depois das colunas e dos outros grupos, onde aquela versão o mostra. O site novo já cria no fim.
create function privado.grupo_novo_depois_das_colunas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_colunas double precision; v_grupos double precision;
begin
  select max(c.ordem) into v_colunas from public.quadro_colunas c where c.escritorio_id = new.escritorio_id and c.modulo = new.modulo;
  if v_colunas is not null and new.ordem <= v_colunas then
    select max(g.ordem) into v_grupos from public.quadro_grupos g where g.escritorio_id = new.escritorio_id and g.modulo = new.modulo;
    new.ordem := greatest(v_colunas + privado.folga_dos_grupos(), coalesce(v_grupos, 0) + 1);
  end if;
  return new;
end $$;
revoke execute on function privado.grupo_novo_depois_das_colunas() from public, anon, authenticated;
create trigger depois_das_colunas before insert on public.quadro_grupos
  for each row execute function privado.grupo_novo_depois_das_colunas();

-- Escritório novo: depois que os outros gatilhos montam os quadros (o Postgres os roda em ordem alfabética, e este nome vem
-- por último), os grupos vão para depois das colunas.
create function privado.grupos_do_escritorio_novo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.grupos_depois_das_colunas(new.id, null);
  return null;
end $$;
revoke execute on function privado.grupos_do_escritorio_novo() from public, anon, authenticated;
create trigger zz_grupos_depois_das_colunas after insert on public.escritorios
  for each row execute function privado.grupos_do_escritorio_novo();
