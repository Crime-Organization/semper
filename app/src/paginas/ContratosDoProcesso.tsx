// No cartão do processo, os contratos ligados a ele (a ligação é feita no cartão ou no cadastro do contrato) (#294).
// Quem não é parte vê o contrato sem os valores; o que a pessoa não pode abrir só conta.
import { useEffect, useState } from 'react';
import { SD, type ContratoDoProcesso } from '../dados';
import { clientesPorExtenso } from '../regras/contrato';
import { Aviso, Carregando, Nota } from '../ui/base';
import { ItensLigados } from '../ui/ItensLigados';
import { plural } from './importarPessoas/textos';

export function ContratosDoProcesso({ processoId, versao }: { processoId: string; versao: number }) {
  const [lista, setLista] = useState<{ visiveis: ContratoDoProcesso[]; ocultos: number } | string | null>(null);
  useEffect(() => {
    let vivo = true;
    SD.contratosDoProcesso(processoId).then(x => { if (vivo) setLista(x); }).catch(e => { if (vivo) setLista((e as Error).message); });
    return () => { vivo = false; };
  }, [processoId, versao]);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  return <>
    {lista.ocultos > 0 && <Nota>Há {plural(lista.ocultos, 'contrato ligado', 'contratos ligados')} a este processo que você não tem acesso para abrir.</Nota>}
    <ItensLigados rotulo="Contratos ligados" vazio={lista.ocultos ? undefined : 'Nenhum contrato ligado a este processo. A ligação é feita no cartão do contrato.'}
      itens={lista.visiveis.map(k => ({ id: k.id, para: '/contratos/?id=' + k.id, codigo: k.codigo, titulo: k.servico, detalhe: clientesPorExtenso(k.cliente_nome),
        selo: k.arquivado_em ? 'Arquivado' : undefined }))} />
  </>;
}
