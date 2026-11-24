// Em Configurações, na lista de objetos de contrato: separar um objeto que veio com dois serviços num nome só (#410). O administrador
// escreve os nomes novos (dois ou mais) e, se o objeto tem demandas, escolhe a qual objeto novo cada uma fica ligada. O banco troca
// tudo de uma vez (contratos, demandas, lista); as regras dos nomes e o aviso ficam em regras/objetos.ts.
import { useEffect, useState } from 'react';
import { SD, type DemandaDoObjeto, type ObjetoDoEscritorio } from '../dados';
import { OBJETOS_MAXIMOS, TAMANHO_CONTRATO } from '../dados/limites';
import {
  alcanceDaSeparacao, avisoDaTroca, erroDosNomesDaSeparacao, ligacoesDasDemandas, nomesDaSeparacao, nomesPorExtenso, SEM_OBJETO_DA_DEMANDA, trocaPedeConferencia
} from '../regras/objetos';
import { avisar, falha } from '../ui/avisos';
import { Campo, Carregando, estiloBotao, Nota, propsDoCampo } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { Icone } from '../ui/Icone';

/** Os nomes novos começam com dois campos em branco (separar é em dois ou mais). Campo vazio não conta. */
const NOMES_EM_BRANCO = ['', ''];

/** O nome da demanda na escolha: o título, o código e o contrato. */
const rotuloDaDemanda = (d: DemandaDoObjeto) => `${d.titulo} (demanda ${d.codigo}${d.contrato_codigo ? `, contrato ${d.contrato_codigo}` : ''})`;

export function SepararObjeto({ objeto, aoTerminar, aoCancelar }: { objeto: ObjetoDoEscritorio; aoTerminar: () => unknown; aoCancelar: () => void }) {
  const [campos, setCampos] = useState(NOMES_EM_BRANCO);
  const [demandas, setDemandas] = useState<DemandaDoObjeto[] | null>(objeto.demandas ? null : []);
  /** Para cada demanda, a posição do nome escolhido. */
  const [escolhas, setEscolhas] = useState<Partial<Record<string, number>>>({});
  const [conferido, setConferido] = useState(false);

  useEffect(() => {
    if (objeto.demandas) SD.demandasDoObjeto(objeto.id).then(setDemandas).catch(falha);
  }, [objeto.id, objeto.demandas]);

  const erroDosNomes = conferido ? erroDosNomesDaSeparacao(campos) : null;
  const titulo = `Separar o objeto ${objeto.descricao}`;

  const mudarCampo = (i: number, nome: string) => setCampos(c => c.map((x, j) => j === i ? nome : x));

  async function separar() {
    setConferido(true);
    const ligacoes = demandas && ligacoesDasDemandas(demandas, escolhas, campos);
    if (erroDosNomesDaSeparacao(campos) || !ligacoes) return;
    const nomes = nomesDaSeparacao(campos);
    const troca = await SD.objetoSeparar(objeto.id, nomes, ligacoes);
    // Separar não tem desfazer, como juntar: não dá para saber depois qual contrato tinha o nome antigo.
    avisar(avisoDaTroca('separar', nomesPorExtenso(nomes), troca), trocaPedeConferencia(troca) ? 'info' : 'ok');
    await aoTerminar();
  }

  return <div className="config-campos-form" role="group" aria-label={titulo}>
    <Nota>Escreva os nomes novos, um em cada campo. {alcanceDaSeparacao(objeto)}</Nota>
    {campos.map((nome, i) => {
      // O erro dos nomes aparece no primeiro campo.
      const id = `separar-nome-${i}`, erro = i === 0 ? erroDosNomes : null;
      return <Campo key={i} rotulo={`Nome novo ${i + 1}`} para={id} obrigatorio={i < NOMES_EM_BRANCO.length} erro={erro ?? undefined}>
        <input type="text" {...propsDoCampo(id, { erro })} maxLength={TAMANHO_CONTRATO.objeto} value={nome} onChange={e => mudarCampo(i, e.target.value)} />
      </Campo>;
    })}
    <div><button type="button" className={estiloBotao({ forma: 'mini' })} disabled={campos.length >= OBJETOS_MAXIMOS}
      onClick={() => setCampos(c => [...c, ''])}><Icone nome="mais" tam={13} /> Mais um nome</button></div>

    {!demandas ? <Carregando /> : demandas.length > 0 && <div role="group" aria-label="A qual objeto novo cada demanda fica ligada?">
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
