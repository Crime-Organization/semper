// O compromisso que nasce no cartão de uma tarefa, de uma demanda ou de um contrato (#306), pelo "+ Novo compromisso" da seção
// Compromissos (/agenda/novo/?demanda=…). O cadastro lê o item (o aviso do topo diz de onde o compromisso nasce, ou que ele não fica
// ligado, com o item arquivado), começa com as pessoas dele (os clientes da demanda e do contrato, as pessoas da tarefa) e, ao salvar,
// liga o compromisso novo ao item e volta ao cartão dele. Se a ligação falhar depois de gravar, o compromisso fica, o aviso do pé diz o
// que faltou e a tela vai ao cartão do compromisso. Os textos e as decisões ficam em regras/nascerLigado.ts.
import { useEffect, useState } from 'react';
import { SD, type ModuloDoCompromisso, type PessoaResumida } from '../../dados';
import { aoSalvarPelaOrigem, avisoDaLigacaoQueFalhou, clientesDaOrigem, origemDoCompromisso, type OrigemDoItem } from '../../regras/nascerLigado';
import { depoisDeCriar } from '../../regras/origemDoCadastro';
import { avisar, falha } from '../../ui/avisos';

/** A origem lida: o módulo, como o aviso fala dela e as pessoas que o compromisso herda. */
export interface OrigemDoCompromisso { modulo: ModuloDoCompromisso; origem: OrigemDoItem; pessoas: PessoaResumida[] }
type Lido = { item: { id: string; codigo: string; arquivado_em: string | null; nome: string }; pessoas: PessoaResumida[] } | null;

/** Como ler cada origem: o nome do cartão e as pessoas dele. */
const LER: Record<ModuloDoCompromisso, (id: string) => Promise<Lido>> = {
  tarefas: async id => { const t = await SD.tarefaObter(id); return t && { item: { ...t, nome: t.titulo }, pessoas: t.pessoas }; },
  demandas: async id => { const d = await SD.demandaObter(id); return d && { item: { ...d, nome: d.titulo }, pessoas: d.clientes }; },
  contratos: async id => { const k = await SD.contratoObter(id); return k && { item: { ...k, nome: k.servico }, pessoas: k.clientes }; }
};

/** Lê a origem pedida no endereço: null enquanto lê, sem origem ou se ela não foi achada (aí o cadastro segue como o comum). */
export function useOrigemDoCompromisso(pedido: { modulo: ModuloDoCompromisso; id: string } | null): OrigemDoCompromisso | null {
  const [lida, setLida] = useState<OrigemDoCompromisso | null>(null);
  const modulo = pedido?.modulo, id = pedido?.id;
  useEffect(() => {
    if (!modulo || !id) return;
    let vale = true;
    LER[modulo](id)
      .then(r => { if (vale && r) setLida({ modulo, origem: origemDoCompromisso(modulo, r.item), pessoas: r.item.arquivado_em ? [] : clientesDaOrigem(r.pessoas) }); })
      .catch(falha);
    return () => { vale = false; };
  }, [modulo, id]);
  return lida;
}

/** Depois de criar o compromisso: liga-o à origem (se ela aceita) e diz para onde a tela vai (o cartão da origem ou o do compromisso). */
export async function depoisDeCriarNoItem(o: OrigemDoCompromisso | null, compromissoId: string, doCriado: string) {
  if (!o || !aoSalvarPelaOrigem(o.origem, '', doCriado).liga) return doCriado;
  let ligado = false;
  try {
    // false: já estava ligado (outra aba ligou antes); a ligação existe do mesmo jeito.
    await SD.compromissoLigar(compromissoId, o.modulo, o.origem.id);
    ligado = true;
  } catch (e) { avisar(avisoDaLigacaoQueFalhou(`compromisso: ${o.modulo}`, o.origem.codigo, e), 'erro'); }
  return depoisDeCriar(o.origem.cartao, ligado, doCriado);
}
