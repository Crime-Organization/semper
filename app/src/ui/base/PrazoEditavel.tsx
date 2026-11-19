// O prazo de tarefas e demandas no grupo das datas do cartão (#361): o prazo com a hora e, embaixo, o sino com o lembrete. Quem
// pode alterar o cartão clica e muda ali mesmo: o campo do prazo abre com o calendário pequeno (#357), com a hora logo abaixo dele,
// e ao lado ficam a hora e o sino do lembrete. Enquanto a #299 (prazo e hora num campo só, lembrete num botão) não chega, são os
// campos de hoje, em tamanho de cartão. As conferências e o que se grava ficam em regras/datasNoCartao.ts.
// A hora aparece em dois lugares: no calendário (que só existe no computador, enquanto ele está aberto) e ao lado do prazo (no
// celular, o calendário é o do aparelho, sem hora). Por isso a de fora tem um nome só dela ("Hora do prazo").
import { camposDoPrazo, lembreteDoPrazo, resumoDoPrazo, textoDoPrazo, type CamposDoPrazo, type ErrosDosCampos, type PrazoGravado } from '../../regras/datasNoCartao';
import { LEMBRETES, lerLembrete, OPCOES_DE_LEMBRETE, SEM_LEMBRETE } from '../../regras/lembrete';
import { Icone } from '../Icone';
import { CampoData } from './CampoData';
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
}

export function PrazoEditavel({ nome, valor, conferir, aoSalvar, aoMudarRascunho }: Props) {
  const lembrete = lembreteDoPrazo(valor), marcado = valor.lembrete !== null && valor.lembrete !== undefined;
  const lido = <>
    <b className="num">{textoDoPrazo(valor)}</b>
    {lembrete && <span className={'dado-lembrete' + (marcado ? '' : ' sem')}>
      <Icone nome="sino" tam={TAMANHO_DO_SINO} />{marcado && <span className="sr">Lembrete: </span>}{lembrete}
    </span>}
  </>;
  return <DadoEditavel nome={nome} titulo={`Mudar o ${nome.toLowerCase()}`} resumo={resumoDoPrazo(valor)} lido={lido} inicial={() => camposDoPrazo(valor)}
    conferir={conferir} aoSalvar={aoSalvar} aoMudarRascunho={aoMudarRascunho} campos={({ rascunho, mudar, marcar }) => <>
      <CampoData aria-label={nome} className="data-editavel-campo" {...marcar('prazo')} valor={rascunho.prazo} abrirAoAparecer
        aoMudar={prazo => mudar({ prazo })} hora={{ valor: rascunho.hora, aoMudar: hora => mudar({ hora }) }} />
      <label className="dado-editavel-legenda">Hora
        <input type="time" aria-label={`Hora do ${nome.toLowerCase()}`} className="data-editavel-campo dado-editavel-hora" {...marcar('hora')}
          value={rascunho.hora} onChange={e => mudar({ hora: e.target.value })} />
      </label>
      <span className="dado-editavel-sino">
        <Icone nome="sino" tam={TAMANHO_DO_SINO} />
        <select aria-label="Lembrete" className="data-editavel-campo" {...marcar('lembrete')} value={rascunho.lembrete ?? ''}
          onChange={e => mudar({ lembrete: lerLembrete(e.target.value) })}>
          <option value="">{SEM_LEMBRETE}</option>
          {OPCOES_DE_LEMBRETE.map(l => <option key={l} value={l}>{LEMBRETES[l].nome}</option>)}
        </select>
      </span>
    </>} />;
}
