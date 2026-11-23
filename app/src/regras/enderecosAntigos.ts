// Os endereços que já existiram e mudaram de lugar: cada um leva, para sempre, à página que faz o mesmo hoje. Os links dos e-mails, os
// favoritos e as abas antigas continuam valendo. Nenhuma linha sai desta tabela: um endereço que muda de novo ganha o destino novo.
// Puro, sem tela: o roteador (App.tsx) só chama enderecoNovo.
import { enderecoNovoDaAnotacaoNova } from './anotacao';
import { TIPOS_PROCESSO } from './processo';

/** As páginas dos tipos de processo que saíram (#406): os processos delas viraram administrativos, e o cartão aberto (?id=) vai junto. */
const paraOsAdministrativos = (busca: string) => TIPOS_PROCESSO.administrativo.caminho + busca;

/** Cada endereço antigo (sem as barras das pontas) e para onde leva, dada a busca ("?…") com que foi aberto. */
export const ENDERECOS_ANTIGOS: Record<string, (busca: string) => string> = {
  // Os nomes antigos das abas do Financeiro.
  'financeiro/receitas': () => '/financeiro/direitos/',
  'financeiro/despesas': () => '/financeiro/obrigacoes/',
  // A página das parcelas de cada mês (#331): o que falta receber, contrato por contrato, está em Direitos.
  'parcelas': () => '/financeiro/direitos/',
  // A anotação nova abre em Documentos, na mesma janela da anotação aberta (#369).
  'documentos/nova': enderecoNovoDaAnotacaoNova,
  'processos/extrajudicial': paraOsAdministrativos,
  'processos/investigacao': paraOsAdministrativos
};

/** O endereço novo de um antigo ("/parcelas/" → "/financeiro/direitos/"); null quando o endereço não é antigo. */
export function enderecoNovo(caminho: string, busca = ''): string | null {
  const destino = ENDERECOS_ANTIGOS[caminho.replace(/^\/+|\/+$/g, '')];
  return destino ? destino(busca) : null;
}
