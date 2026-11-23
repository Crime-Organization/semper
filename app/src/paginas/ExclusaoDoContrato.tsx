// A janela que pergunta antes de excluir contratos (#284), no cartão e na seção Arquivados: o que sai junto (demandas, tarefas,
// parcelas, recebimentos) e os valores, lidos da prévia do banco. O texto é montado em regras/exclusaoDoContrato.ts; aqui só se mostra.
import { SD } from '../dados';
import { janelaDaExclusao } from '../regras/exclusaoDoContrato';
import { falha } from '../ui/avisos';
import { Aviso, Nota } from '../ui/base';
import { janela } from '../ui/janela';

/**
 * Lê a prévia e pergunta. Devolve true se a pessoa confirmou. Se algo impede a exclusão (pagamento já feito, dinheiro recebido e
 * quem pede não é administrador, nada que ela possa excluir), a janela diz por quê, só com o Fechar, e devolve false.
 */
export async function perguntarExclusaoDeContratos(ids: string[]): Promise<boolean> {
  let j;
  try { j = janelaDaExclusao(await SD.contratoExclusaoPrevia(ids)); } catch (e) { falha(e); return false; }
  if (j.bloqueio) {
    const { texto, lista } = j.bloqueio;
    await janela({ titulo: j.titulo, corpo: <>
      <Aviso tipo="erro">{texto}</Aviso>
      {lista.length > 0 && <ul aria-label="Pagamentos já feitos">{lista.map(x => <li key={x}>{x}</li>)}</ul>}
    </> });
    return false;
  }
  return !!await janela<boolean>({
    titulo: j.titulo,
    corpo: <>
      {j.itens.length > 0 && <>
        <p>Sai junto:</p>
        <ul aria-label="O que sai junto">{j.itens.map(x => <li key={x}>{x}</li>)}</ul>
      </>}
      {j.avisos.map(x => <Nota key={x}>{x}</Nota>)}
    </>,
    acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Excluir definitivamente', valor: true, tipo: 'perigo' }]
  });
}
