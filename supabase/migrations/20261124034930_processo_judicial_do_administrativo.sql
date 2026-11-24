-- =====================================================================
-- O processo administrativo ligado ao judicial que nasceu dele, e os campos de PI fora do judicial (#425)
--   1. Ligação nova entre processos: o judicial pode nascer de um administrativo de qualquer área (o administrativo de previdência
--      que vira judicial, o de PI que vai à Justiça). Usa a ligação que já existe (origem_id e ligacao, da migração
--      20261122130109_processo_partes_recursos_e_tipos.sql), com o valor novo "judicial": o judicial guarda o administrativo de
--      origem. A ligação é sempre do processo inteiro, nunca de informações avulsas. O judicial nasce já ligado ("Novo processo
--      judicial a partir deste") ou é ligado depois a um administrativo (processo_judicial_ligar); a ligação "judicial" também se
--      desfaz (processo_judicial_desligar). Os recursos e incidentais continuam como estão: a origem deles não muda depois de criada.
--   2. Os campos de propriedade intelectual (o tipo de proteção e os campos de cada tipo, da migração 20261123003604_propriedade_intelectual.sql)
--      são só do processo administrativo: no judicial, ficam sempre vazios. O dono autorizou apagar os que estejam preenchidos em
--      processos judiciais (não havia nenhum em uso); a limpeza fica no histórico de cada processo.
--   Só acrescenta (uma regra check mais larga, gatilhos e funções novas, e a limpeza autorizada). A versão anterior do site continua
--   funcionando: ela não grava a ligação nova, e o que ela gravar de PI num judicial o gatilho deixa vazio, sem recusar.
-- =====================================================================

-- ---------- 1. A ligação "judicial" ----------
-- O nome da regra é o que o Postgres deu à regra da coluna em 20261122130109_processo_partes_recursos_e_tipos.sql. Se tiver outro
-- nome, a migração para no "drop" e nada muda. A lista é a de LIGACOES, em app/src/regras/processo.ts: mudou aqui, muda lá.
alter table public.processos drop constraint processos_ligacao_check;
alter table public.processos add constraint processos_ligacao_check check (ligacao in ('recurso', 'incidental', 'judicial'));

-- A ligação "judicial" só liga um processo judicial a um administrativo. Roda como quem cria (a leitura da origem passa pelas regras
-- dela), depois do conferir_origem (os gatilhos rodam em ordem alfabética), que já confere o escritório.
create function privado.conferir_ligacao_judicial() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.ligacao is distinct from 'judicial' or new.origem_id is null then return new; end if;
  if new.tipo <> 'judicial'
     or not exists (select 1 from public.processos o where o.id = new.origem_id and o.tipo = 'administrativo') then
    raise exception 'Só um processo judicial pode ser ligado a um processo administrativo.';
  end if;
  return new;
end $$;
revoke execute on function privado.conferir_ligacao_judicial() from public, anon;
create trigger conferir_origem_judicial before insert on public.processos
  for each row execute function privado.conferir_ligacao_judicial();

-- Liga um judicial que já existe a um administrativo. Quem liga altera os dois (a mesma regra de alterar o processo), os dois estão
-- ativos e no escritório de quem liga, e o judicial ainda não tem origem (o recurso e o incidental continuam ligados ao processo de
-- que nasceram). A troca passa pelo histórico do judicial (o gatilho historico_processo).
create function public.processo_judicial_ligar(p_administrativo uuid, p_judicial uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.processos; j public.processos;
begin
  select * into a from public.processos where id = p_administrativo and escritorio_id = privado.meu_escritorio();
  select * into j from public.processos where id = p_judicial and escritorio_id = privado.meu_escritorio() for update;
  if a.id is null or j.id is null
     or not privado.estou_no_processo(a.escritorio_id, a.criado_por, a.responsavel_id, a.colaboradores, a.grupos)
     or not privado.estou_no_processo(j.escritorio_id, j.criado_por, j.responsavel_id, j.colaboradores, j.grupos) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  if a.arquivado_em is not null or j.arquivado_em is not null then
    raise exception 'Processo arquivado não recebe ligação nova.';
  end if;
  if a.tipo <> 'administrativo' or j.tipo <> 'judicial' then
    raise exception 'Só um processo judicial pode ser ligado a um processo administrativo.';
  end if;
  if j.origem_id is not null then
    raise exception 'Este processo judicial já está ligado a outro processo.';
  end if;
  update public.processos set origem_id = a.id, ligacao = 'judicial', atualizado_por = auth.uid(), atualizado_em = now() where id = j.id;
end $$;

-- Desfaz a ligação "judicial" (só ela: o recurso e o incidental não se desligam). Quem desfaz altera um dos dois processos.
create function public.processo_judicial_desligar(p_judicial uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.processos; a public.processos;
begin
  select * into j from public.processos where id = p_judicial and escritorio_id = privado.meu_escritorio() and ligacao = 'judicial' for update;
  select * into a from public.processos where id = j.origem_id;
  if j.id is null or j.origem_id is null
     or not (privado.estou_no_processo(j.escritorio_id, j.criado_por, j.responsavel_id, j.colaboradores, j.grupos)
             or (a.id is not null and privado.estou_no_processo(a.escritorio_id, a.criado_por, a.responsavel_id, a.colaboradores, a.grupos))) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  update public.processos set origem_id = null, ligacao = null, atualizado_por = auth.uid(), atualizado_em = now() where id = j.id;
end $$;
revoke execute on function public.processo_judicial_ligar(uuid, uuid), public.processo_judicial_desligar(uuid) from public, anon;
grant execute on function public.processo_judicial_ligar(uuid, uuid), public.processo_judicial_desligar(uuid) to authenticated;

-- ---------- 2. PI só no processo administrativo ----------
-- O judicial não guarda os campos de PI: o que vier (o site antigo grava os do formulário) fica vazio, sem recusar.
create function privado.judicial_sem_protecao() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.protecao := null; new.deposito := null; new.concessao := null; new.publicacao := null; new.criacao := null;
  new.apresentacao_marca := null; new.natureza_marca := null; new.classes_nice := '{}'; new.especificacao := null;
  new.variacoes := null; new.linguagem := null;
  return new;
end $$;
revoke execute on function privado.judicial_sem_protecao() from public, anon;
create trigger judicial_sem_protecao before insert or update on public.processos
  for each row when (new.tipo = 'judicial') execute function privado.judicial_sem_protecao();

-- A limpeza autorizada pelo dono: os campos de PI que estejam preenchidos em processos judiciais (o gatilho acima os esvazia).
update public.processos set protecao = null
where tipo = 'judicial'
  and (protecao is not null or deposito is not null or concessao is not null or publicacao is not null or criacao is not null
       or apresentacao_marca is not null or natureza_marca is not null or cardinality(classes_nice) > 0 or especificacao is not null
       or variacoes is not null or linguagem is not null);
