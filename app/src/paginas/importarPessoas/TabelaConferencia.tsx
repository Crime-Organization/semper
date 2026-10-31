// A tabela da conferência da importação: as linhas do arquivo de uma situação (a aba escolhida), com o que acontece
// com cada uma. Nas linhas para decidir, as opções (opcoesDaLinha) ficam na própria linha.
import { useMemo, useState, type ReactNode } from 'react';
import { POR_PAGINA } from '../../dados/limites';
import {
  DECISOES, DICA_ARQUIVADA, opcoesDaLinha, ROTULO_DECISAO, type Classificacao, type PessoaImportada, type Situacao
} from '../../regras/importacao';
import { CAMPOS, fmtDocumento } from '../../regras/pessoa';
import { Escolhas, Nota, Selo, Vazio, type TipoSelo } from '../../ui/base';
import { Paginacao } from '../../ui/Paginacao';
import { useImportacao, type TelaImportacao } from './contexto';
import { listaComE, plural } from './textos';

/** Como cada situação aparece na coluna "Situação". */
const SELO_DA_SITUACAO: Record<Situacao, { tipo: TipoSelo; texto: string }> = {
  novo: { tipo: 'ok', texto: 'Novo' },
  completar: { tipo: 'pend', texto: 'Completar' },
  sem_mudanca: { tipo: 'arq', texto: 'Sem mudança' },
  decidir: { tipo: 'pend', texto: 'Decidir' },
  recusada: { tipo: 'erro', texto: 'Erro' }
};

/** "Vai preencher: E-mails, Município. Vai acrescentar 1 responsável." */
function oQueCompleta(c: Classificacao): string {
  const campos = Object.keys(c.mudancas).map(k => CAMPOS[k] ?? k);
  const partes = [
    campos.length ? `Vai preencher: ${listaComE(campos)}.` : '',
    c.responsaveisNovos.length ? `Vai acrescentar ${plural(c.responsaveisNovos.length, 'responsável', 'responsáveis')}.` : ''
  ].filter(Boolean);
  return partes.join(' ') || 'Vai acrescentar a observação ou a pendência da linha.';
}

interface Linha { c: Classificacao; imp: PessoaImportada; tela: TelaImportacao }

/** As opções de uma linha para decidir, com a explicação do caso. */
function OpcoesDaDecisao({ c, tela }: Linha) {
  if (!c.motivo) return null;
  return <Escolhas rotulo={`Linha ${c.linha}`} arranjo="coluna-unica" dica={DECISOES[c.motivo].explicacao}>
    {opcoesDaLinha(c).map(d => <label key={d}>
      <input type="radio" name={`decisao-${c.linha}`} value={d} checked={tela.decisoes[c.linha] === d} onChange={() => tela.decidir(c.linha, d)} />
      {ROTULO_DECISAO[d]}
    </label>)}
  </Escolhas>;
}

/** O que acontece com a linha, em cada situação (os avisos da leitura vêm depois, em todas). */
const O_QUE_ACONTECE: Record<Situacao, (l: Linha) => ReactNode> = {
  novo: () => <Nota>Entra como pessoa nova.</Nota>,
  completar: ({ c }) => <Nota>{oQueCompleta(c)}</Nota>,
  sem_mudanca: () => <Nota>O cadastro no SEMPER já tem tudo o que esta linha traz: nada muda.</Nota>,
  decidir: l => <OpcoesDaDecisao {...l} />,
  recusada: () => <Nota>Não entra. Corrija a linha no arquivo e importe de novo.</Nota>
};

function LinhaDaConferencia(l: Linha) {
  const { c, imp } = l;
  const selo = SELO_DA_SITUACAO[c.situacao];
  const documento = imp.dados.documento ?? imp.documentoNoArquivo;
  return <tr>
    <td>{c.linha}</td>
    <td>
      <div className="nome">{imp.dados.nome || '—'}</div>
      {c.existente && <div className="sub">No SEMPER: {c.existente.nome} ({c.existente.codigo})</div>}
    </td>
    <td style={{ whiteSpace: 'nowrap' }}>{documento ? fmtDocumento(documento) : '—'}</td>
    <td>
      <Selo tipo={selo.tipo}>{selo.texto}</Selo>
      {imp.pendencias.length > 0 && <> <Selo tipo="pend">Incompleta</Selo></>}
    </td>
    <td>
      {O_QUE_ACONTECE[c.situacao](l)}
      {c.arquivada && <Nota>{DICA_ARQUIVADA}</Nota>}
      {imp.problemas.map(p => <Nota key={`${p.campo}-${p.mensagem}`}>{p.mensagem}</Nota>)}
    </td>
  </tr>;
}

export function TabelaConferencia({ situacao }: { situacao: Situacao }) {
  const tela = useImportacao();
  const [pagina, setPagina] = useState(0);
  const porLinha = useMemo(() => new Map(tela.importadas.map(i => [i.linha, i])), [tela.importadas]);
  const linhas = tela.classificacoes.filter(c => c.situacao === situacao && porLinha.has(c.linha));
  if (!linhas.length) return <Vazio>Nenhuma linha nesta situação.</Vazio>;
  const daPagina = linhas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  return <div>
    <div className="tabela"><table aria-label="Linhas do arquivo">
      <thead><tr>
        <th scope="col">Linha</th><th scope="col">Nome</th><th scope="col">CPF/CNPJ</th><th scope="col">Situação</th><th scope="col">O que acontece</th>
      </tr></thead>
      <tbody>{daPagina.map(c => <LinhaDaConferencia key={c.linha} c={c} imp={porLinha.get(c.linha) as PessoaImportada} tela={tela} />)}</tbody>
    </table></div>
    {linhas.length > POR_PAGINA && <Paginacao pagina={pagina} porPagina={POR_PAGINA} naPagina={daPagina.length} total={linhas.length} aoPaginar={setPagina} />}
  </div>;
}
