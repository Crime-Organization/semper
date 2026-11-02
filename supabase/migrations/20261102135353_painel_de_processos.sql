-- =====================================================================
-- Painel de Processos (parte da tarefa #47)
--   Uma consulta só, com o que o painel mostra: prazos abertos até uma data, audiências e perícias marcadas, intimações a
--   tratar, últimos andamentos, processos parados e quantos processos há em cada coluna.
--   - Roda com a permissão de quem consulta: as regras RLS já deixam só os processos que a pessoa pode ver.
--   - Processo arquivado e item excluído ficam de fora. "Meus": a pessoa é responsável ou colaboradora.
--   - Parado: sem andamento há mais dias do que o escritório escolheu (60, se ninguém mudar). Quem nunca teve andamento conta
--     da distribuição ou, sem ela, do dia do cadastro em Brasília. Quem está na última coluna do quadro (encerrado) não está parado.
--   - Os vencidos e os que ainda vão vencer são cortados à parte: muitos vencidos não escondem os prazos de hoje.
--   Os dias e os limites são os de app/src/regras/painelProcessos.ts e DIAS_PARADO em app/src/dados/limites.ts.
--   Só acrescenta: uma coluna com valor padrão e duas funções. A versão anterior do site continua funcionando.
-- =====================================================================
alter table public.escritorios add column dias_processo_parado integer not null default 60 check (dias_processo_parado between 1 and 3650);

create function public.painel_de_processos(p_hoje date, p_ate_prazos date, p_ate_marcados date, p_meus boolean, p_limite integer, p_ultimos integer) returns jsonb
language sql stable set search_path = '' as $$
  with base as (
    select p.id, p.codigo, p.tipo, p.numero, p.titulo, p.cliente_nome, p.responsavel_id, p.colaboradores, p.clientes, p.etapa_id, p.distribuicao, p.criado_em
    from public.processos p
    where p.arquivado_em is null and (not p_meus or auth.uid() = p.responsavel_id or auth.uid() = any(p.colaboradores))
  ),
  andamentos as (
    select a.id, a.tipo, a.data, to_char(a.hora, 'HH24:MI') as hora, a.local, a.texto, a.tratada_em, a.tarefa_id, a.criado_em, to_jsonb(b) as processo
    from public.processo_andamentos a join base b on b.id = a.processo_id
    where a.excluido_em is null
  ),
  prazos as (
    select z.id, z.descricao, z.final, z.tarefa_id, to_jsonb(b) as processo
    from public.processo_prazos z join base b on b.id = z.processo_id
    where z.excluido_em is null and z.concluido_em is null and z.final <= p_ate_prazos
  ),
  marcados as (select * from andamentos where tipo in ('audiencia', 'pericia') and data between p_hoje and p_ate_marcados),
  intimacoes as (select * from andamentos where tipo = 'intimacao' and tratada_em is null and tarefa_id is null),
  dias as (select e.dias_processo_parado as n from public.escritorios e where e.id = privado.meu_escritorio()),
  parados as (
    select to_jsonb(b) as processo, u.ultimo, p_hoje - u.ultimo as dias
    from base b
    left join public.quadro_colunas c on c.id = b.etapa_id
    cross join lateral (
      select coalesce((select max(a.data) from public.processo_andamentos a where a.processo_id = b.id and a.excluido_em is null and a.data <= p_hoje),
                      b.distribuicao, (b.criado_em at time zone 'America/Sao_Paulo')::date) as ultimo
    ) u
    where c.marco is distinct from 'concluido' and p_hoje - u.ultimo > (select n from dias)
  )
  select jsonb_build_object(
    'prazos', coalesce((select jsonb_agg(x) from (
      (select * from prazos where final < p_hoje order by final, id limit p_limite)
      union all
      (select * from prazos where final >= p_hoje order by final, id limit p_limite)) x), '[]'),
    'total_vencidos', (select count(*) from prazos where final < p_hoje),
    'total_a_vencer', (select count(*) from prazos where final >= p_hoje),
    'marcados', coalesce((select jsonb_agg(x) from (select * from marcados order by data, hora nulls last, id limit p_limite) x), '[]'),
    'total_marcados', (select count(*) from marcados),
    'intimacoes', coalesce((select jsonb_agg(x) from (select * from intimacoes order by data, criado_em limit p_limite) x), '[]'),
    'total_intimacoes', (select count(*) from intimacoes),
    'ultimos', coalesce((select jsonb_agg(x) from (select * from andamentos where data <= p_hoje order by data desc, criado_em desc limit p_ultimos) x), '[]'),
    'parados', coalesce((select jsonb_agg(x) from (select * from parados order by dias desc limit p_limite) x), '[]'),
    'total_parados', (select count(*) from parados),
    'dias_parado', (select n from dias),
    'fases', coalesce((select jsonb_agg(x) from (select b.tipo, b.etapa_id, count(*) as n from base b group by b.tipo, b.etapa_id) x), '[]')
  )
$$;
revoke execute on function public.painel_de_processos(date, date, date, boolean, integer, integer) from public, anon;
grant execute on function public.painel_de_processos(date, date, date, boolean, integer, integer) to authenticated;

-- Quantos dias sem andamento fazem um processo aparecer como parado: só os administradores mudam.
create function public.dias_processo_parado_salvar(p_dias integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.sou_admin() then
    raise exception 'Só um administrador muda isso.' using errcode = '42501';
  end if;
  update public.escritorios set dias_processo_parado = p_dias where id = privado.meu_escritorio();
end $$;
revoke execute on function public.dias_processo_parado_salvar(integer) from public, anon;
grant execute on function public.dias_processo_parado_salvar(integer) to authenticated;
