// O painel do financeiro, só para administradores: o ano de todas as contas num lugar só. No alto, o ano e os meses; depois, os
// totais, o quadro do ano mês a mês e o extrato com filtros. Escolher um mês (no botão ou no quadro) filtra os totais e o extrato.
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { SD, type ContaFinanceira, type Lancamento } from '../../dados';
import { fmtCentavos, nomeDaCategoria } from '../../regras/caixa';
import {
  FILTRO_VAZIO, LINHAS_DO_QUADRO, MESES_DO_ANO, filtrarExtrato, mesDoAno, mesesComLancamento, planilhaDoExtrato, resumoDoAno, temFiltroLigado,
  totaisDoExtrato, type FiltroDoExtrato
} from '../../regras/painelFinanceiro';
import { fmtData } from '../../regras/pessoa';
import { somarDias } from '../../regras/prazos';
import { Aviso, Carregando, estiloBotao, Indicador, Indicadores, Segmentos, TituloSecao, Vazio } from '../../ui/base';
import { Icone } from '../../ui/Icone';
import { PaginaModulo } from '../../ui/PaginaModulo';
import { useCtx } from '../../ui/sessao';
import { hojeISO, useTitulo } from '../../ui/util';
import { AbasDoFinanceiro } from './AbasDoFinanceiro';
import '../Financeiro.css';

/** Quantas linhas do extrato aparecem de cada vez: o ano inteiro pode ter milhares. */
const LINHAS_DO_EXTRATO = 100;
const ANO_TODO = 'ano';

type Lido = { ano: number; contas: ContaFinanceira[]; lancamentos: Lancamento[]; saldos: Map<string, number> } | { ano: number; erro: string };

/** Baixa o arquivo sem passar por servidor nenhum: o texto já está na tela. */
function baixar(nome: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  a.click();
  URL.revokeObjectURL(url);
}

export default function Painel() {
  useTitulo('Financeiro');
  const ctx = useCtx();
  const hoje = hojeISO();
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));
  const [lido, setLido] = useState<Lido | null>(null);
  const [filtro, setFiltro] = useState<FiltroDoExtrato>(FILTRO_VAZIO);
  const [quantas, setQuantas] = useState(LINHAS_DO_EXTRATO);
  const pode = ctx.ehAdmin && !!ctx.escritorio?.modulos?.financeiro;

  // Só vale a leitura do ano escolhido: trocar de ano não pode trazer de volta a lista anterior.
  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    (async () => {
      const contas = await SD.financeiroContas();
      const [listas, saldos] = await Promise.all([
        Promise.all(contas.map(c => SD.financeiroLancamentos(c.id, `${ano}-01-01`, `${ano}-12-31`))),
        Promise.all(contas.filter(c => !c.arquivada_em).map(async c => [c.id, await SD.financeiroSaldoAntes(c.id, somarDias(hoje, 1))] as const))
      ]);
      return { ano, contas, lancamentos: listas.flat(), saldos: new Map(saldos) };
    })().then(x => { if (vivo) setLido(x); }).catch(e => { if (vivo) setLido({ ano, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [ano, pode, hoje]);

  if (!pode) return <Navigate to="/financeiro/contratos/" replace />;
  const cabecalho = { titulo: 'Financeiro', visoes: [], acao: { rotulo: 'Nova entrada', para: '/financeiro/entradas/' } };
  const atual = lido?.ano === ano ? lido : null;
  const trocarAno = (n: number) => { setAno(n); setFiltro(f => ({ ...f, mes: null })); setQuantas(LINHAS_DO_EXTRATO); };
  const mudarFiltro = (m: Partial<FiltroDoExtrato>) => { setFiltro(f => ({ ...f, ...m })); setQuantas(LINHAS_DO_EXTRATO); };

  const barra = <div className="painel-barra">
    <div className="painel-ano" role="group" aria-label="Ano">
      <button type="button" className="icone-btn" aria-label="Ano anterior" onClick={() => trocarAno(ano - 1)}><Icone nome="voltar" tam={16} /></button>
      <b className="num">{ano}</b>
      <button type="button" className="icone-btn" aria-label="Próximo ano" onClick={() => trocarAno(ano + 1)}><Icone nome="seta" tam={16} /></button>
    </div>
    {atual && 'lancamentos' in atual && <Segmentos rotulo="Mês" atual={filtro.mes ?? ANO_TODO} aoEscolher={m => mudarFiltro({ mes: m === ANO_TODO ? null : m })}
      opcoes={[{ id: ANO_TODO, rotulo: 'Ano todo' }, ...MESES_DO_ANO.map((nome, i) => {
        const mes = mesDoAno(ano, i);
        return { id: mes, rotulo: nome, marcado: mesesComLancamento(atual.lancamentos, ano).has(mes) };
      })]} />}
  </div>;

  if (!atual) return <PaginaModulo {...cabecalho}><AbasDoFinanceiro />{barra}<Carregando /></PaginaModulo>;
  if ('erro' in atual) return <PaginaModulo {...cabecalho}><AbasDoFinanceiro />{barra}<Aviso tipo="erro">{atual.erro}</Aviso></PaginaModulo>;

  const { contas, lancamentos, saldos } = atual;
  const nomeDaConta = new Map(contas.map(c => [c.id, c.nome]));
  const doPeriodo = filtrarExtrato(lancamentos, { ...FILTRO_VAZIO, mes: filtro.mes });
  const extrato = filtrarExtrato(lancamentos, filtro);
  const periodo = totaisDoExtrato(doPeriodo);
  const noFiltro = totaisDoExtrato(extrato);
  const saldoTotal = [...saldos.values()].reduce((s, v) => s + v, 0);
  const nomeDoPeriodo = filtro.mes ? `${MESES_DO_ANO[Number(filtro.mes.slice(5)) - 1]}/${ano}` : String(ano);
  const ano12 = resumoDoAno(lancamentos, ano);
  const categorias = [...new Set(lancamentos.map(l => l.categoria))];

  return <PaginaModulo {...cabecalho} contador={nomeDoPeriodo}>
    <AbasDoFinanceiro />
    {barra}

    <Indicadores rotulo={`Totais de ${nomeDoPeriodo}`}>
      <Indicador tom="entrada" rotulo={`Entradas · ${nomeDoPeriodo}`} valor={fmtCentavos(periodo.entradas)} />
      <Indicador tom="saida" rotulo={`Saídas · ${nomeDoPeriodo}`} valor={fmtCentavos(periodo.saidas)} />
      <Indicador tom={periodo.resultado < 0 ? 'saida' : 'entrada'} rotulo={`Resultado · ${nomeDoPeriodo}`} valor={fmtCentavos(periodo.resultado)} />
      <Indicador tom="destaque" rotulo="Saldo hoje nas contas" valor={fmtCentavos(saldoTotal)}
        detalhe={contas.filter(c => saldos.has(c.id)).map(c => `${c.nome} ${fmtCentavos(saldos.get(c.id)!)}`).join(' · ')} />
    </Indicadores>

    <section className="painel-secao" aria-labelledby="tQuadro">
      <TituloSecao id="tQuadro">O ano mês a mês</TituloSecao>
      <div className="tabela"><table className="quadro-ano" aria-label={`O ano de ${ano} mês a mês`}>
        <thead><tr>
          <th scope="col">Linha</th>
          {ano12.meses.map((m, i) => <th key={m.mes} scope="col" className="financeiro-num">
            <button type="button" className="quadro-mes" aria-pressed={filtro.mes === m.mes} onClick={() => mudarFiltro({ mes: filtro.mes === m.mes ? null : m.mes })}>{MESES_DO_ANO[i]}</button>
          </th>)}
          <th scope="col" className="financeiro-num quadro-total">Total</th>
        </tr></thead>
        <tbody>{LINHAS_DO_QUADRO.map(linha => <tr key={linha.id} className={'tom-' + linha.tom}>
          <th scope="row">{linha.rotulo}</th>
          {ano12.meses.map(m => { const v = linha.valor(m); return <td key={m.mes} className="financeiro-num">{v ? fmtCentavos(v) : '–'}</td>; })}
          <td className="financeiro-num quadro-total"><b>{fmtCentavos(linha.valor(ano12.total))}</b></td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className="painel-secao" aria-labelledby="tExtrato">
      <div className="secao-topo">
        <TituloSecao id="tExtrato">Extrato de {nomeDoPeriodo}</TituloSecao>
        <div className="financeiro-acoes">
          <button type="button" className={estiloBotao()} disabled={!extrato.length} onClick={() => baixar(`financeiro-${nomeDoPeriodo.replace('/', '-')}.csv`, planilhaDoExtrato(extrato, contas))}>
            <Icone nome="baixar" tam={15} /> Baixar planilha
          </button>
        </div>
      </div>
      <div className="financeiro-filtros" role="search" aria-label="Filtros do extrato">
        <label className="busca-campo"><Icone nome="buscar" tam={18} /><span className="sr">Buscar no extrato</span>
          <input type="search" placeholder="Buscar descrição ou categoria" value={filtro.busca} onChange={e => mudarFiltro({ busca: e.target.value })} />
        </label>
        <select className="campo" aria-label="Tipo" value={filtro.tipo} onChange={e => mudarFiltro({ tipo: e.target.value as FiltroDoExtrato['tipo'] })}>
          <option value="todos">Entradas e saídas</option><option value="entrada">Só entradas</option><option value="saida">Só saídas</option>
        </select>
        <select className="campo" aria-label="Categoria" value={filtro.categoria} onChange={e => mudarFiltro({ categoria: e.target.value as FiltroDoExtrato['categoria'] })}>
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{nomeDaCategoria(c)}</option>)}
        </select>
        {contas.length > 1 && <select className="campo" aria-label="Conta" value={filtro.conta} onChange={e => mudarFiltro({ conta: e.target.value })}>
          <option value="">Todas as contas</option>
          {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>}
        {temFiltroLigado(filtro) && <button type="button" className={estiloBotao({ forma: 'link' })} onClick={() => mudarFiltro({ ...FILTRO_VAZIO, mes: filtro.mes })}>Limpar filtros</button>}
      </div>
      {extrato.length ? <>
        <p className="painel-conta-filtro num">{noFiltro.quantos.toLocaleString('pt-BR')} lançamentos · entradas <b className="tom-entrada">{fmtCentavos(noFiltro.entradas)}</b> · saídas <b className="tom-saida">{fmtCentavos(noFiltro.saidas)}</b></p>
        <div className="tabela"><table className="extrato" aria-label={`Extrato de ${nomeDoPeriodo}`}>
          <thead><tr>
            <th scope="col">Data</th>{contas.length > 1 && <th scope="col">Conta</th>}<th scope="col">Descrição</th><th scope="col">Categoria</th>
            <th scope="col" className="financeiro-num">Entrada</th><th scope="col" className="financeiro-num">Saída</th>
          </tr></thead>
          <tbody>{extrato.slice(0, quantas).map(l => <tr key={l.id}>
            <td>{fmtData(l.data)}</td>{contas.length > 1 && <td>{nomeDaConta.get(l.conta_id)}</td>}
            <td>{l.descricao}</td><td><span className="sub">{nomeDaCategoria(l.categoria)}</span></td>
            <td className="financeiro-num tom-entrada">{l.tipo === 'entrada' ? fmtCentavos(l.valor) : ''}</td>
            <td className="financeiro-num tom-saida">{l.tipo === 'saida' ? fmtCentavos(l.valor) : ''}</td>
          </tr>)}</tbody>
        </table></div>
        {extrato.length > quantas && <button type="button" className={estiloBotao()} onClick={() => setQuantas(q => q + LINHAS_DO_EXTRATO)}>
          Mostrar mais {Math.min(LINHAS_DO_EXTRATO, extrato.length - quantas).toLocaleString('pt-BR')} de {(extrato.length - quantas).toLocaleString('pt-BR')}
        </button>}
      </> : <Vazio>{lancamentos.length ? 'Nenhum lançamento com esses filtros.' : `Nenhum lançamento em ${ano}.`}</Vazio>}
    </section>
  </PaginaModulo>;
}
