-- =====================================================================
-- "Importada" e "Incompleta" como etiquetas (tarefa #186)
--   Os dois selos fixos de Pessoas viram etiquetas comuns, que qualquer pessoa tira ou acrescenta.
--   - Cada escritório tem no máximo uma etiqueta de cada tipo (coluna sistema). Ela pode ser renomeada e mudar de cor por
--     quem pode mudar etiquetas, mas não pode ser excluída, e ninguém cria outra pela tela.
--   - Importada: entra quando a pessoa é criada por uma importação. Tirá-la não apaga importacao_id, que continua
--     como registro de origem (e o filtro "Importadas" continua valendo por ele).
--   - Incompleta: anda junto com as pendências. Pendência nova aplica a etiqueta; ficar sem pendência a tira. Tirar a
--     etiqueta marca o cadastro como conferido (zera as pendências); aplicá-la à mão deixa o cadastro "a conferir".
--   - Quem já foi importado recebe as etiquetas aqui mesmo.
--   Só acrescenta (uma coluna, um índice, funções e gatilhos). As regras "incluir" e "apagar" de etiquetas ficam mais
--   exigentes só para a coluna nova, que o site anterior nunca envia. A versão anterior do site continua funcionando.
-- =====================================================================

alter table public.etiquetas add column sistema text check (sistema in ('importada', 'incompleta'));
create unique index etiquetas_sistema_unica on public.etiquetas (escritorio_id, sistema) where sistema is not null;

alter policy incluir on public.etiquetas
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()) and sistema is null);
alter policy apagar on public.etiquetas
  using (escritorio_id = (select privado.meu_escritorio()) and ((select privado.sou_admin()) or criado_por = (select auth.uid())) and sistema is null);

-- A etiqueta do tipo pedido, no escritório: a que já existe, a que o escritório criou com o mesmo texto, ou uma nova.
create function privado.etiqueta_do_sistema(p_escritorio uuid, p_sistema text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_texto text := (array['Importada', 'Incompleta'])[array_position(array['importada', 'incompleta'], p_sistema)];
  v_cor text := (array['azul', 'laranja'])[array_position(array['importada', 'incompleta'], p_sistema)];
begin
  select id into v_id from public.etiquetas where escritorio_id = p_escritorio and sistema = p_sistema;
  if v_id is not null then return v_id; end if;
  update public.etiquetas set sistema = p_sistema
  where escritorio_id = p_escritorio and texto is not null and privado.sem_acento(btrim(texto)) = privado.sem_acento(v_texto)
  returning id into v_id;
  if v_id is not null then return v_id; end if;
  insert into public.etiquetas (escritorio_id, cor, texto, sistema, criado_por)
  values (p_escritorio, v_cor, v_texto, p_sistema, null)
  on conflict do nothing returning id into v_id;
  if v_id is not null then return v_id; end if;
  -- Outra gravação criou ao mesmo tempo.
  select id into v_id from public.etiquetas
  where escritorio_id = p_escritorio and (sistema = p_sistema or privado.sem_acento(btrim(texto)) = privado.sem_acento(v_texto));
  return v_id;
end $$;

-- Quem já está no banco recebe as etiquetas.
insert into public.pessoa_etiquetas (escritorio_id, pessoa_id, etiqueta_id)
select p.escritorio_id, p.id, privado.etiqueta_do_sistema(p.escritorio_id, 'importada')
from public.pessoas p where p.importacao_id is not null
on conflict do nothing;
insert into public.pessoa_etiquetas (escritorio_id, pessoa_id, etiqueta_id)
select p.escritorio_id, p.id, privado.etiqueta_do_sistema(p.escritorio_id, 'incompleta')
from public.pessoas p where p.pendencias <> '{}'
on conflict do nothing;

-- Pessoa nova de uma importação ganha "Importada"; as pendências comandam "Incompleta".
create function privado.etiquetas_da_pessoa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.importacao_id is not null then
    insert into public.pessoa_etiquetas (escritorio_id, pessoa_id, etiqueta_id)
    values (new.escritorio_id, new.id, privado.etiqueta_do_sistema(new.escritorio_id, 'importada'))
    on conflict do nothing;
  end if;
  if new.pendencias <> '{}' and (tg_op = 'INSERT' or old.pendencias = '{}') then
    insert into public.pessoa_etiquetas (escritorio_id, pessoa_id, etiqueta_id)
    values (new.escritorio_id, new.id, privado.etiqueta_do_sistema(new.escritorio_id, 'incompleta'))
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and new.pendencias = '{}' and old.pendencias <> '{}' then
    delete from public.pessoa_etiquetas l using public.etiquetas e
    where l.pessoa_id = new.id and l.etiqueta_id = e.id and e.sistema = 'incompleta';
  end if;
  return null;
end $$;
create trigger etiquetas after insert or update of pendencias on public.pessoas
  for each row execute function privado.etiquetas_da_pessoa();

-- Tirar "Incompleta" marca como conferido. Quando a própria etiqueta some numa cascata, ela já não é encontrada aqui.
create function privado.ao_tirar_etiqueta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.etiquetas e where e.id = old.etiqueta_id and e.sistema = 'incompleta') then
    update public.pessoas set pendencias = '{}' where id = old.pessoa_id and pendencias <> '{}';
  end if;
  return null;
end $$;
create trigger conferido after delete on public.pessoa_etiquetas
  for each row execute function privado.ao_tirar_etiqueta();

-- Aplicar "Incompleta" à mão deixa o cadastro a conferir.
create function privado.ao_aplicar_etiqueta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.etiquetas e where e.id = new.etiqueta_id and e.sistema = 'incompleta') then
    update public.pessoas set pendencias = '{conferir}' where id = new.pessoa_id and pendencias = '{}';
  end if;
  return null;
end $$;
create trigger a_conferir after insert on public.pessoa_etiquetas
  for each row execute function privado.ao_aplicar_etiqueta();
