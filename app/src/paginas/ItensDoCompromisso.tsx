// A seção "Ligado a" do cartão do compromisso (#306): as tarefas, as demandas e os contratos ligados a ele, cada um num quadrinho que
// abre o cartão do item, com o número ao lado do título mesmo com a seção fechada. Quem muda o compromisso liga um item que já existe
// (a corrente do título, #427, abre a busca de cada módulo; com mais de um módulo, um menu pequeno pergunta qual) e desliga, com
// Desfazer. O item que a pessoa não vê só conta. O processo e as pessoas têm seções próprias.
import { useEffect, useState } from 'react';
import { SD, type ItemDoCompromisso, type ModuloDoCompromisso } from '../dados';
import { enderecoDoItem, ITEM_DA_ANOTACAO } from '../regras/anotacao';
import { itensPorModulo, motivoSemMaisItens, MODULOS_DO_COMPROMISSO } from '../regras/compromisso';
import { avisar, falha, feito } from '../ui/avisos';
import { Aviso, Carregando, Nota } from '../ui/base';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { LigarDoModulo, ligarDoModulo } from '../ui/LigarDoModulo';
import { Recolhivel, type LigarNaSecao, type VariosNaSecao } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';
import { numero } from '../ui/util';

/** O tamanho do x de desligar, como o da anotação. */
const ICONE_DO_DESLIGAR = 14;
const ITEM_JA_LIGADO = 'Este item já estava ligado a este compromisso.';
/** O nome da corrente do título quando ela abre o menu dos módulos (ou está desligada, com o compromisso cheio). */
const LIGAR_A_UM_ITEM = 'Ligar a um item existente';
type Lidos = { visiveis: ItemDoCompromisso[]; ocultos: number };

interface Props {
  id: string;
  /** Quem só lê (o compromisso arquivado, ou da Agenda geral sem participar) não liga nem desliga. */
  somenteLer: boolean;
  /** Muda quando o cartão foi relido: relê os itens. */
  versao: number;
  /** Depois de ligar ou desligar (o histórico do cartão muda). */
  aoMudar: () => void;
}

export function ItensDoCompromisso({ id, somenteLer, versao, aoMudar }: Props) {
  const ctx = useCtx();
  const [lidos, setLidos] = useState<Lidos | string | null>(null);
  const [mudou, setMudou] = useState(0);
  useEffect(() => {
    let vivo = true;
    SD.compromissoItens(id).then(r => { if (vivo) setLidos(r); }).catch(e => { if (vivo) setLidos((e as Error).message); });
    return () => { vivo = false; };
  }, [id, versao, mudou]);
  const depois = () => { setMudou(n => n + 1); aoMudar(); };
  // Só os módulos ligados no escritório.
  const modulos = MODULOS_DO_COMPROMISSO.filter(m => ctx.escritorio?.modulos?.[m]);
  const total = typeof lidos === 'object' && lidos ? lidos.visiveis.length + lidos.ocultos : undefined;

  async function ligar(modulo: ModuloDoCompromisso, item: { id: string; nome: string }) {
    try {
      // Se outra pessoa ligou o mesmo item enquanto a busca estava aberta, nada é gravado: sem Desfazer, que apagaria a ligação dela.
      if (!await SD.compromissoLigar(id, modulo, item.id)) { avisar(ITEM_JA_LIGADO, 'info'); depois(); return; }
      feito(`Ligado a ${ITEM_DA_ANOTACAO[modulo].rotulo.toLowerCase()}: ${item.nome}.`, 'ligação do compromisso', async () => { await SD.compromissoDesligar(id, modulo, item.id); });
      depois();
    } catch (e) { falha(e); }
  }
  async function desligar(i: ItemDoCompromisso) {
    try {
      await SD.compromissoDesligar(id, i.modulo, i.id);
      feito(`Desligado de ${ITEM_DA_ANOTACAO[i.modulo].rotulo.toLowerCase()}: ${i.nome}.`, 'desligamento do compromisso', async () => { await SD.compromissoLigar(id, i.modulo, i.id); });
      depois();
    } catch (e) { falha(e); }
  }

  const cheio = total !== undefined ? motivoSemMaisItens(total) : '';
  const ligados = (m: ModuloDoCompromisso) => typeof lidos === 'object' && lidos ? lidos.visiveis.filter(i => i.modulo === m).map(i => i.id) : [];
  const opcoes = modulos.map(m => ligarDoModulo(m));
  const corrente: LigarNaSecao | VariosNaSecao<LigarNaSecao> | undefined = somenteLer || !opcoes.length ? undefined
    : cheio ? { rotulo: LIGAR_A_UM_ITEM, indisponivel: cheio }
    : opcoes.length === 1 ? opcoes[0] : { rotulo: LIGAR_A_UM_ITEM, opcoes };
  return <Recolhivel titulo="Ligado a" icone="vinculo" preferencia="compromissos.cartao.ligado" contador={total} ligar={corrente}>
    {lidos === null ? <Carregando />
      : typeof lidos === 'string' ? <Aviso tipo="erro">{lidos}</Aviso>
      : <>
        {lidos.ocultos > 0 && <Nota>Há {numero(lidos.ocultos)} {lidos.ocultos === 1 ? 'item ligado' : 'itens ligados'} aqui que você não tem acesso para abrir.</Nota>}
        {!lidos.visiveis.length && !lidos.ocultos && <Nota>Este compromisso não está ligado a nenhuma tarefa, demanda ou contrato.</Nota>}
        {itensPorModulo(lidos.visiveis).map(g => <ItensLigados key={g.modulo} rotulo={ITEM_DA_ANOTACAO[g.modulo].plural} itens={g.itens.map(i => ({
          id: `${i.modulo}-${i.id}`, para: enderecoDoItem(i), codigo: `${ITEM_DA_ANOTACAO[i.modulo].rotulo} · ${i.codigo}`, titulo: i.nome,
          selo: i.arquivado_em ? 'Arquivado' : undefined,
          acao: somenteLer ? undefined : <button type="button" className="icone-btn" title="Desligar" aria-label={`Desligar ${i.nome}`} onClick={() => desligar(i)}>
            <Icone nome="fechar" tam={ICONE_DO_DESLIGAR} />
          </button>
        }))} />)}
        {!somenteLer && (cheio ? <Nota>{cheio}</Nota> : <div className="ligados-acoes">
          {modulos.includes('tarefas') && <LigarDoModulo modulo="tarefas" filtro={{ fora: ligados('tarefas') }} aoEscolher={t => ligar('tarefas', { id: t.id, nome: t.titulo })} />}
          {modulos.includes('demandas') && <LigarDoModulo modulo="demandas" filtro={{ fora: ligados('demandas') }} aoEscolher={d => ligar('demandas', { id: d.id, nome: d.titulo })} />}
          {modulos.includes('contratos') && <LigarDoModulo modulo="contratos" filtro={{ fora: ligados('contratos') }} aoEscolher={k => ligar('contratos', { id: k.id, nome: k.servico })} />}
        </div>)}
      </>}
  </Recolhivel>;
}
