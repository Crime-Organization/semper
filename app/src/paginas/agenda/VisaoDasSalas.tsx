// A visão das salas na Agenda (#438): todas as salas ativas do escritório lado a lado, num dia, por horário, para ver de uma vez
// qual está livre. O horário livre leva ao cadastro de compromisso já com a sala, a data e a hora; o ocupado mostra o compromisso
// (o título, só de quem a pessoa vê; dos outros, só "Ocupado") e não deixa marcar ali. As contas ficam em regras/salasDoDia.ts.
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { SD, type FiltroCompromissos, type OcupacaoNaSala, type Sala } from '../../dados';
import { TIPOS_COMPROMISSO } from '../../regras/compromisso';
import { capacidadeDaSala, comoHora } from '../../regras/sala';
import {
  enderecoParaMarcar, faixasDaSala, horarioDaFaixa, horariosDaGrade, marcarNoHorario, notaDosFiltrosNasSalas, ocupacoesPorSala, rotuloDaOcupacao,
  salasDaVisao, semSalasNaVisao, type FaixaDaSala
} from '../../regras/salasDoDia';
import { cliquesQueAbrem } from '../../ui/abrirItem';
import { Aviso, Carregando, Nota, Vazio } from '../../ui/base';

interface Props {
  /** O dia, aaaa-mm-dd. */
  data: string;
  /** As salas do escritório: a visão mostra as ativas, por nome (regras/salasDoDia.ts, salasDaVisao). */
  salas: Sala[];
  /** Os filtros da agenda: o de sala deixa só ela; os outros não valem aqui, e a nota diz isso. */
  filtro: FiltroCompromissos;
  /** Muda quando algo mudou na página: relê a ocupação. */
  recarga: number | string;
  endereco: (id: string) => string;
  aoAbrir: (id: string) => void;
}

type Lida = { data: string; ocupacoes: OcupacaoNaSala[] } | { data: string; erro: string };

export function VisaoDasSalas({ data, salas: doEscritorio, filtro, recarga, endereco, aoAbrir }: Props) {
  const [lida, setLida] = useState<Lida | null>(null);
  useEffect(() => {
    let vivo = true;
    SD.salasOcupacao(data)
      .then(ocupacoes => { if (vivo) setLida({ data, ocupacoes }); })
      .catch(e => { if (vivo) setLida({ data, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [data, recarga]);

  const salas = salasDaVisao(doEscritorio, filtro.sala);
  if (!salas.length) return <Vazio>{semSalasNaVisao(filtro.sala)}</Vazio>;
  if (!lida || lida.data !== data) return <Carregando />;
  if ('erro' in lida) return <Aviso tipo="erro">{lida.erro}</Aviso>;
  const nota = notaDosFiltrosNasSalas(filtro);

  const porSala = ocupacoesPorSala(lida.ocupacoes);
  const horarios = horariosDaGrade(salas.flatMap(s => porSala[s.id] ?? []));
  const colunas = salas.map(sala => {
    const ocupacoes = porSala[sala.id] ?? [];
    return { sala, ocupacoes, faixas: faixasDaSala(ocupacoes, horarios) };
  });
  // A largura mínima da grade cresce com as salas (em CSS): com muitas, ela rola na horizontal, com os horários parados à esquerda.
  const estilo = { '--salas-na-grade': salas.length } as CSSProperties;

  return <>{nota && <Nota>{nota}</Nota>}<div className="tabela agenda-salas" style={estilo}>
    <table aria-label="Salas por horário">
      <thead><tr>
        <th scope="col" className="agenda-salas-hora">Horário</th>
        {colunas.map(({ sala }) => <th key={sala.id} scope="col">
          <span className="agenda-salas-nome">{sala.nome}</span> <small>{capacidadeDaSala(sala.capacidade)}</small>
        </th>)}
      </tr></thead>
      <tbody>{horarios.map((inicio, linha) => <tr key={inicio}>
        <th scope="row" className="agenda-salas-hora">{comoHora(inicio)}</th>
        {colunas.map(({ sala, ocupacoes, faixas }) => {
          const faixa = faixas.find(f => f.linha === linha);
          // O horário coberto pelo pedaço ocupado de cima não tem célula própria.
          if (!faixa) return null;
          return <td key={sala.id} rowSpan={faixa.linhas}>
            {faixa.ocupacoes.length
              ? <Ocupada faixa={faixa} endereco={endereco} aoAbrir={aoAbrir} />
              : <Link className="sala-livre" to={enderecoParaMarcar(sala.id, data, inicio, ocupacoes)} aria-label={marcarNoHorario(sala.nome, inicio)}>
                <span className="sala-livre-texto">Livre</span>
                <span className="sala-livre-marcar" aria-hidden="true">Marcar às {comoHora(inicio)}</span>
              </Link>}
          </td>;
        })}
      </tr>)}</tbody>
    </table>
  </div></>;
}

/** O pedaço ocupado: cada compromisso com o horário; o que a pessoa vê abre o cartão dele; o dos outros diz só "Ocupado". */
function Ocupada({ faixa, endereco, aoAbrir }: { faixa: FaixaDaSala } & Pick<Props, 'endereco' | 'aoAbrir'>) {
  return <ul className="agenda-lista sala-ocupada">{faixa.ocupacoes.map(o => <li key={o.id}>
    {o.titulo
      ? <a className="agenda-item" data-tipo={o.tipo} title={TIPOS_COMPROMISSO[o.tipo].nome} href={endereco(o.id)} {...cliquesQueAbrem(endereco(o.id), () => aoAbrir(o.id))}>
        <small>{horarioDaFaixa(o)}</small>
        <b>{rotuloDaOcupacao(o)}</b>
      </a>
      : <span className="agenda-item sala-sem-titulo">
        <small>{horarioDaFaixa(o)}</small>
        <b>{rotuloDaOcupacao(o)}</b>
      </span>}
  </li>)}</ul>;
}
