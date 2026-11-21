// O prazo de tarefas e demandas no grupo das datas do cartão (#361): o prazo com a hora e, embaixo, o sino com o lembrete. Quem
// pode alterar o cartão clica e muda ali mesmo, com as mesmas peças do cadastro (#299): o prazo e a hora num campo só
// (<CampoDataHora>, com o calendário pequeno da #357, que abre quando a pessoa pede) e o lembrete no botão com o sino, ao lado, em tamanho de
// cartão. As conferências e o que se grava ficam em regras/datasNoCartao.ts; apagar a data tira o prazo, a hora e o lembrete juntos (#395).
import { camposDoPrazo, lembreteDoPrazo, prazoParaConferir, resumoDoPrazo, textoDoPrazo, type CamposDoPrazo, type ErrosDosCampos, type PrazoGravado } from '../../regras/datasNoCartao';
import type { TipoDeAtalho } from '../../regras/atalhosDoCartao';
import { Icone } from '../Icone';
import { BotaoDoLembrete } from './BotaoDoLembrete';
import { CampoDataHora } from './CampoDataHora';
import { DadoEditavel } from './GrupoDeDatas';

/** O tamanho do sino, ao lado do lembrete. */
const TAMANHO_DO_SINO = 14;

interface Props {
  /** O nome do prazo (ex.: "Prazo", "Prazo de entrega"): no botão e no campo. */
  nome: string;
  valor: PrazoGravado;
  conferir: (c: CamposDoPrazo) => ErrosDosCampos<keyof CamposDoPrazo>;
  /** Quem pode alterar recebe o prazo novo, já conferido. Sem isto, o prazo só se lê. */
  aoSalvar?: (c: CamposDoPrazo) => unknown;
  /** Avisa o cartão do prazo mudado e ainda não salvo (para perguntar antes de fechar). */
  aoMudarRascunho?: (rascunho: string | null) => void;
  /** A linha que o prazo oferece ao menu "Acrescentar ao cartão" (#399; veja DadoEditavel). */
  atalho?: TipoDeAtalho;
}

export function PrazoEditavel({ nome, valor, conferir, aoSalvar, aoMudarRascunho, atalho }: Props) {
  const lembrete = lembreteDoPrazo(valor), marcado = valor.lembrete !== null && valor.lembrete !== undefined;
  const lido = <>
    <b className="num">{textoDoPrazo(valor)}</b>
    {lembrete && <span className={'dado-lembrete' + (marcado ? '' : ' sem')}>
      <Icone nome="sino" tam={TAMANHO_DO_SINO} />{marcado && <span className="sr">Lembrete: </span>}{lembrete}
    </span>}
  </>;
  return <DadoEditavel nome={nome} titulo={`Mudar o ${nome.toLowerCase()}`} resumo={resumoDoPrazo(valor)} lido={lido} inicial={() => camposDoPrazo(valor)}
    conferir={c => conferir(prazoParaConferir(c))} aoSalvar={aoSalvar} aoMudarRascunho={aoMudarRascunho} atalho={atalho} campos={({ rascunho, mudar, marcar }) => {
      const doPrazo = marcar('prazo'), daHora = marcar('hora'), doLembrete = marcar('lembrete');
      return <CampoDataHora discreto aria-label={nome} {...doPrazo} valor={rascunho.prazo} aoMudar={prazo => mudar({ prazo })}
        hora={rascunho.hora} aoMudarHora={hora => mudar({ hora })} rotuloDaHora={`Hora do ${nome.toLowerCase()}`} horaComErro={!!daHora['aria-invalid']}
        descricaoDaHora={daHora['aria-describedby']}
        junto={<BotaoDoLembrete valor={rascunho.lembrete} prazo={rascunho.prazo} comErro={!!doLembrete['aria-invalid']}
          aria-describedby={doLembrete['aria-describedby']} aoMudar={l => mudar({ lembrete: l })} />} />;
    }} />;
}
