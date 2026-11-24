// Em Configurações, na lista de objetos de contrato: separar um objeto que veio com dois serviços num nome só (#410). O administrador
// escreve os nomes novos (dois ou mais) e, se o objeto tem demandas, escolhe a qual objeto novo cada uma fica ligada. O banco troca
// tudo de uma vez (contratos, demandas, lista); as regras dos nomes e o aviso ficam em regras/objetos.ts.
import { useCallback, useEffect, useState } from 'react';
import { SD, type DemandaDoObjeto, type ObjetoDoEscritorio } from '../dados';
import { OBJETOS_MAXIMOS, TAMANHO_CONTRATO } from '../dados/limites';
import {
  alcanceDaSeparacao, avisoDaTroca, erroDosNomesDaSeparacao, escolhasDepoisDosNomes, ligacoesDasDemandas, nomesDaSeparacao, nomesPorExtenso,
  SEM_OBJETO_DA_DEMANDA, trocaPedeConferencia
} from '../regras/objetos';
import { avisar, falha } from '../ui/avisos';
import { Aviso, Campo, Carregando, estiloBotao, Nota, propsDoCampo } from '../ui/base';
import { LinhasRepetidas, type ColunaDaLinha } from '../ui/base/LinhasRepetidas';
import { BotaoDuplo } from '../ui/Botoes';
import { Icone } from '../ui/Icone';

/** Uma linha da lista dos nomes novos. */
type LinhaDoNome = { nome: string };
/** Os nomes novos começam com duas linhas em branco (separar é em dois ou mais). Linha vazia não conta. */
const LINHAS_EM_BRANCO: readonly LinhaDoNome[] = [{ nome: '' }, { nome: '' }];
const COLUNAS_DO_NOME: ColunaDaLinha<LinhaDoNome>[] = [{ campo: 'nome', rotulo: 'Nome novo', maximo: TAMANHO_CONTRATO.objeto }];
/** Quando a busca das demandas falha sem dizer por quê. */
const DEMANDAS_SEM_RESPOSTA = 'Não foi possível buscar as demandas deste objeto. Cancele e abra a separação de novo.';

/** O nome da demanda na escolha: o título, o código e o contrato. */
const rotuloDaDemanda = (d: DemandaDoObjeto) => `${d.titulo} (demanda ${d.codigo}${d.contrato_codigo ? `, contrato ${d.contrato_codigo}` : ''})`;

export function SepararObjeto({ objeto, aoTerminar, aoCancelar }: { objeto: ObjetoDoEscritorio; aoTerminar: () => unknown; aoCancelar: () => void }) {
  const [linhas, setLinhas] = useState<LinhaDoNome[]>(() => LINHAS_EM_BRANCO.map(l => ({ ...l })));
  const [demandas, setDemandas] = useState<DemandaDoObjeto[] | null>(null);
  const [erroDasDemandas, setErroDasDemandas] = useState<string | null>(null);
  /** Para cada demanda, a posição do nome escolhido. */
  const [escolhas, setEscolhas] = useState<Readonly<Partial<Record<string, number>>>>({});
  const [conferido, setConferido] = useState(false);

  // As demandas vêm sempre do banco, mesmo quando a lista diz que não há nenhuma: a contagem da lista é de quando ela abriu, e
  // alguém pode ter criado uma demanda desse objeto depois.
  const buscarDemandas = useCallback(() => SD.demandasDoObjeto(objeto.id)
    .then(d => { setDemandas(d); setErroDasDemandas(null); })
    .catch((e: unknown) => setErroDasDemandas((e as Error)?.message || DEMANDAS_SEM_RESPOSTA)), [objeto.id]);
  useEffect(() => { void buscarDemandas(); }, [buscarDemandas]);

  const campos = linhas.map(l => l.nome);
  const erroDosNomes = conferido ? erroDosNomesDaSeparacao(campos) : null;
  const titulo = `Separar o objeto ${objeto.descricao}`;

  // A escolha de cada demanda aponta para a posição do nome: quando um nome sai, as escolhas acompanham.
  function mudarLinhas(novas: LinhaDoNome[]) {
    setEscolhas(x => escolhasDepoisDosNomes(x, linhas, novas));
    setLinhas(novas);
  }

  async function separar() {
    setConferido(true);
    const ligacoes = demandas && ligacoesDasDemandas(demandas, escolhas, campos);
    if (erroDosNomesDaSeparacao(campos) || !ligacoes) return;
    const nomes = nomesDaSeparacao(campos);
    const troca = await SD.objetoSeparar(objeto.id, nomes, ligacoes).catch((e: unknown) => {
      // Uma demanda criada depois que as demandas foram buscadas: o banco recusa. A tela busca de novo e pergunta dela.
      if ((e as Error)?.message === SEM_OBJETO_DA_DEMANDA) return buscarDemandas().then(() => null);
      throw e;
    });
    if (!troca) return;
    // Separar não tem desfazer, como juntar: não dá para saber depois qual contrato tinha o nome antigo.
    avisar(avisoDaTroca('separar', nomesPorExtenso(nomes), troca), trocaPedeConferencia(troca) ? 'info' : 'ok');
    await aoTerminar();
  }

  return <div className="config-campos-form" role="group" aria-label={titulo}>
    <Nota>Escreva os nomes novos, um em cada linha. {alcanceDaSeparacao({ ...objeto, demandas: demandas?.length ?? objeto.demandas })}</Nota>
    {/* A lista de linhas vai dentro de uma grade de formulário (veja ui/base/LinhasRepetidas.tsx); "campos" dá aos campos dela a cara dos outros. */}
    <div className="grade-form campos">
      <LinhasRepetidas rotulo="Nomes novos" erro={erroDosNomes} item="nome" artigo="o" linhas={linhas} colunas={COLUNAS_DO_NOME}
        nova={{ nome: '' }} maximo={OBJETOS_MAXIMOS} aoMudar={mudarLinhas} />
    </div>

    {erroDasDemandas ? <Aviso tipo="erro">{erroDasDemandas}</Aviso> : !demandas ? <Carregando /> : demandas.length > 0 && <div role="group" aria-label="A qual objeto novo cada demanda fica ligada?">
      <Nota>A qual objeto novo cada demanda fica ligada? A demanda continua a mesma, com as tarefas e o histórico.</Nota>
      {demandas.map(d => {
        const id = `separar-demanda-${d.id}`, escolha = escolhas[d.id];
        const erro = conferido && !(escolha !== undefined && campos[escolha]?.trim()) ? SEM_OBJETO_DA_DEMANDA : null;
        return <Campo key={d.id} rotulo={rotuloDaDemanda(d)} para={id} obrigatorio erro={erro ?? undefined}>
          <select {...propsDoCampo(id, { erro })} value={escolha ?? ''} onChange={e => setEscolhas(x => ({ ...x, [d.id]: e.target.value ? Number(e.target.value) : undefined }))}>
            <option value="">Escolha o objeto novo</option>
            {campos.map((nome, i) => nome.trim() && <option key={i} value={i}>{nome.trim()}</option>)}
          </select>
        </Campo>;
      })}
    </div>}

    <div className="config-campos-acoes">
      <BotaoDuplo variante="principal" confirmar={`Confirmar: separar ${objeto.descricao}`} aoConfirmar={() => separar().catch(falha)}>
        <Icone nome="divisao" tam={15} /> Separar
      </BotaoDuplo>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </div>;
}
