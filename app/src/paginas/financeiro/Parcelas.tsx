// As parcelas na tela: a tabela, o formulário da parcela, o recebimento com a divisão enquanto se digita e o que ficou gravado. Aparecem
// no cartão do contrato, no da pessoa e na página de Parcelas. Quem vê é quem pode: um administrador ou o responsável pelo contrato.
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { SD, type Coluna, type Contrato, type Parcela, type ParaReceber, type ParcelaDoEscritorio, type RecebimentoGravado } from '../../dados';
import { PARCELAS_DA_PESSOA } from '../../dados/limites';
import { fmtCentavos } from '../../regras/caixa';
import {
  avisoDaSoma, chegouAoAssinado, dadosDaParcela, dadosDaParcelaImportada, errosDaParcelaImportada, formDaParcelaImportada, type FormDaParcelaImportada, dadosDoRecebimento, divisaoGravada, errosDaParcela, errosDoFormDeRecebimento, formDaParcela, linhasDaDivisao, nomesDoRecebimento, parcelaNova, parcelasDoContrato,
  previaDoRecebimento, recebimentoNovo, SITUACOES_DA_PARCELA, parcelaAntiga, situacaoDaParcela, type FormDaParcela, type FormDoRecebimento, type LinhaDaDivisao, maiorParcelaPorContrato, numeroDaParcela } from '../../regras/parcelas';
import { fmtData } from '../../regras/pessoa';
import { falha, feito, useMudancas } from '../../ui/avisos';
import { Aviso, Campo, Carregando, estiloBotao, Nota, propsDoCampo, Selo, Vazio } from '../../ui/base';
import { Botao } from '../../ui/Botoes';
import { Icone, type NomeIcone } from '../../ui/Icone';
import { confirmar } from '../../ui/janela';
import { MenuFlutuante } from '../../ui/Menu';
import { useCtx } from '../../ui/sessao';
import { Recolhivel } from '../../ui/Recolhivel';
import { hojeISO } from '../../ui/util';
import { HistoricoDoCartao } from '../HistoricoDoCartao';
import { CorrigirRecebimento } from './CorrigirRecebimento';

/** A divisão de um recebimento: cada parte e o valor dela. */
export function Divisao({ linhas, rotulo }: { linhas: LinhaDaDivisao[]; rotulo: string }) {
  return <dl className="financeiro-divisao" aria-label={rotulo}>
    {linhas.map(l => <div key={l.rotulo}><dt>{l.rotulo}</dt><dd>{fmtCentavos(l.valor)}</dd></div>)}
  </dl>;
}

/**
 * A tabela. Com o contrato, é a lista do escritório ou da pessoa; sem ele, a do cartão do contrato, e "total" é quantas
 * parcelas o contrato tem. A parcela aparece como na planilha: "1/10".
 */
export function TabelaDeParcelas<P extends Parcela>({ lista, hoje, contrato, total, acoes }: { lista: P[]; hoje: string; contrato?: (p: P) => ParcelaDoEscritorio; total?: number | null; acoes?: (p: P) => ReactNode }) {
  const maior = maiorParcelaPorContrato(lista);
  return <div className="tabela"><table className={contrato ? undefined : 'tabela-parcelas'} aria-label="Parcelas">
    <thead><tr>
      {contrato && <th scope="col">Contrato</th>}
      {contrato && <th scope="col">Cliente</th>}
      <th scope="col">Parcela</th><th scope="col">Vencimento</th><th scope="col" className="financeiro-num">Valor</th><th scope="col">Situação</th>
      {acoes && <th scope="col"><span className="sr">Ações</span></th>}
    </tr></thead>
    <tbody>{lista.map(p => {
      const situacao = SITUACOES_DA_PARCELA[situacaoDaParcela(p, hoje)];
      const doContrato = contrato?.(p);
      return <tr key={p.id}>
        {doContrato && <td><Link to={'/contratos/?id=' + p.contrato_id}>{doContrato.contrato_codigo}</Link></td>}
        {doContrato && <td>{doContrato.cliente_nome}</td>}
        <td className="num">{numeroDaParcela(p.numero, total ?? doContrato?.total_parcelas, maior.get(p.contrato_id))}</td>
        <td>{fmtData(p.vencimento)}</td>
        <td className="financeiro-num">{fmtCentavos(p.recebido ?? p.valor)}</td>
        <td><Selo tipo={situacao.selo}>{situacao.nome}</Selo>{p.recebida_em && <> em {fmtData(p.recebida_em)}</>}</td>
        {acoes && <td><span className="financeiro-acoes">{acoes(p)}</span></td>}
      </tr>;
    })}</tbody>
  </table></div>;
}

function FormParcela({ inicial, rotulo, salvar, aoCancelar }: { inicial: FormDaParcela; rotulo: string; salvar: (f: FormDaParcela) => Promise<void>; aoCancelar: () => void }) {
  const id = useId();
  const [f, setF] = useState(inicial);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const erros = conferido ? errosDaParcela(f) : {};
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDaParcela(f)).length) return;
    setOcupado(true);
    try { await salvar(f); } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label={rotulo} onSubmit={enviar}>
    <div className="financeiro-form-linha">
      <Campo rotulo="Vencimento" para={id + 'venc'} obrigatorio erro={erros.vencimento}>
        <input type="date" {...propsDoCampo(id + 'venc', { erro: erros.vencimento })} value={f.vencimento} onChange={e => setF({ ...f, vencimento: e.target.value })} />
      </Campo>
      <Campo rotulo="Valor" para={id + 'valor'} obrigatorio erro={erros.valor}>
        <input type="text" inputMode="decimal" placeholder="1.500,00" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} />
      </Campo>
    </div>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar parcela'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

/** Corrigir a parcela importada como paga: o caixa não muda. */
function FormParcelaImportada({ parcela, salvar, aoCancelar }: { parcela: Parcela; salvar: (f: FormDaParcelaImportada) => Promise<void>; aoCancelar: () => void }) {
  const id = useId();
  const [f, setF] = useState(() => formDaParcelaImportada(parcela));
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const erros = conferido ? errosDaParcelaImportada(f, hojeISO()) : {};
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDaParcelaImportada(f, hojeISO())).length) return;
    setOcupado(true);
    try { await salvar(f); } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label={`Corrigir a parcela ${parcela.numero}`} onSubmit={enviar}>
    <Nota>Esta parcela veio do histórico importado. Corrigir aqui não muda o caixa, os repasses nem o lucro.</Nota>
    <div className="financeiro-form-linha">
      <Campo rotulo="Vencimento" para={id + 'venc'} obrigatorio erro={erros.vencimento}>
        <input type="date" {...propsDoCampo(id + 'venc', { erro: erros.vencimento })} value={f.vencimento} onChange={e => setF({ ...f, vencimento: e.target.value })} />
      </Campo>
      <Campo rotulo="Valor" para={id + 'valor'} obrigatorio erro={erros.valor}>
        <input type="text" inputMode="decimal" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} />
      </Campo>
      <Campo rotulo="Recebida em" para={id + 'data'} obrigatorio erro={erros.recebidaEm}>
        <input type="date" {...propsDoCampo(id + 'data', { erro: erros.recebidaEm })} value={f.recebidaEm} onChange={e => setF({ ...f, recebidaEm: e.target.value })} />
      </Campo>
      <Campo rotulo="Valor recebido" para={id + 'recebido'} obrigatorio erro={erros.recebido}>
        <input type="text" inputMode="decimal" {...propsDoCampo(id + 'recebido', { erro: erros.recebido })} value={f.recebido} onChange={e => setF({ ...f, recebido: e.target.value })} />
      </Campo>
    </div>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar correção'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

type Preparo = { data: string; prep: ParaReceber } | { data: string; erro: string };

/** Registrar o recebimento: a divisão aparece enquanto se digita, e o banco refaz a mesma conta ao salvar. */
function FormReceber({ parcela, aoTerminar, aoCancelar }: { parcela: Parcela; aoTerminar: () => void; aoCancelar: () => void }) {
  const { ehAdmin } = useCtx();
  const id = useId();
  const [f, setF] = useState<FormDoRecebimento>(() => recebimentoNovo(parcela, hojeISO(), []));
  const [lido, setLido] = useState<Preparo | null>(null);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const dataBoa = !errosDoFormDeRecebimento({ ...f, contaId: 'qualquer' }, false).data;

  // A divisão depende da data: quem era sócio e o DAS do mês. Só vale a leitura mais recente.
  useEffect(() => {
    if (!dataBoa) return;
    let vivo = true;
    SD.financeiroParaReceber(parcela.id, f.data)
      .then(prep => { if (vivo) setLido({ data: f.data, prep }); })
      .catch(e => { if (vivo) setLido({ data: f.data, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [parcela.id, f.data, dataBoa]);

  const mudar = (m: Partial<FormDoRecebimento>) => setF(x => ({ ...x, ...m }));
  const atual = lido?.data === f.data ? lido : null;
  const prep = atual && 'prep' in atual ? atual.prep : null;
  // Até a pessoa escolher, vale a conta que recolhe DAS.
  const form: FormDoRecebimento = { ...f, contaId: f.contaId || (prep ? recebimentoNovo(parcela, f.data, prep.contas).contaId : '') };
  const conta = prep?.contas.find(c => c.id === form.contaId);
  const erros = conferido ? errosDoFormDeRecebimento(form, !!conta?.tem_das) : {};
  const previa = prep ? previaDoRecebimento(form, prep) : null;
  const nomes = new Map([...(prep?.terceiros ?? []), ...(prep?.socio_indicador ? [prep.socio_indicador] : [])].map(x => [x.id, x.nome]));

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || !prep || !conta || Object.keys(errosDoFormDeRecebimento(form, conta.tem_das)).length || !previa || 'erro' in previa) return;
    setOcupado(true);
    try {
      const { data, valor, contaId, taxa } = dadosDoRecebimento(form, conta.tem_das);
      const novo = await SD.financeiroReceber({ parcela: parcela.id, data, valor, conta: contaId, taxa });
      feito('Recebimento registrado.', 'recebimento', () => SD.financeiroEstornar(novo));
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }

  return <form className="cartao financeiro-form" noValidate aria-label={`Receber a parcela ${parcela.numero}`} onSubmit={enviar}>
    <div className="financeiro-form-linha">
      <Campo rotulo="Data" para={id + 'data'} obrigatorio erro={erros.data}>
        <input type="date" {...propsDoCampo(id + 'data', { erro: erros.data })} value={f.data} onChange={e => mudar({ data: e.target.value })} />
      </Campo>
      <Campo rotulo="Valor recebido" para={id + 'valor'} obrigatorio erro={erros.valor}>
        <input type="text" inputMode="decimal" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={f.valor} onChange={e => mudar({ valor: e.target.value })} />
      </Campo>
      <Campo rotulo="Conta" para={id + 'conta'} erro={erros.contaId}>
        <select {...propsDoCampo(id + 'conta', { erro: erros.contaId })} value={form.contaId} onChange={e => mudar({ contaId: e.target.value })}>
          {prep?.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      {conta?.tem_das && <Campo rotulo="Taxa da máquina" para={id + 'taxa'} erro={erros.taxa}>
        <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'taxa', { erro: erros.taxa })} value={f.taxa} onChange={e => mudar({ taxa: e.target.value })} />
      </Campo>}
    </div>
    {atual && 'erro' in atual && <Aviso tipo="erro">{atual.erro}</Aviso>}
    {prep && !prep.contas.length && <Aviso tipo="info">Nenhuma conta ativa. Um administrador cria as contas em Caixa.</Aviso>}
    {previa && 'erro' in previa && previa.erro && <Aviso tipo="erro">{previa.erro}</Aviso>}
    {previa && 'divisao' in previa && <>
      {previa.aviso && <Aviso tipo="info">{previa.aviso}</Aviso>}
      <Divisao rotulo="Como fica a divisão" linhas={linhasDaDivisao(previa.divisao, previa.aliquota, x => nomes.get(x) ?? '', prep!.responsavel_socio, ehAdmin)} />
    </>}
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado || !prep}>{ocupado ? 'Salvando…' : 'Registrar recebimento'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

/** O recebimento como ficou gravado, com o DAS usado. */
function RecebimentoDaParcela({ parcela, aoFechar }: { parcela: Parcela; aoFechar: () => void }) {
  const { ehAdmin } = useCtx();
  const [r, setR] = useState<RecebimentoGravado | string | null>(null);
  useEffect(() => {
    let vivo = true;
    SD.financeiroRecebimento(parcela.recebimento_id!)
      .then(x => { if (vivo) setR(x ?? 'Este recebimento não foi encontrado.'); })
      .catch(e => { if (vivo) setR((e as Error).message); });
    return () => { vivo = false; };
  }, [parcela.recebimento_id]);
  const fechar = <div className="financeiro-acoes"><button type="button" className={estiloBotao()} onClick={aoFechar}>Fechar</button></div>;
  if (r === null) return <Carregando />;
  if (typeof r === 'string') return <><Aviso tipo="erro">{r}</Aviso>{fechar}</>;
  const nomes = nomesDoRecebimento(r);
  return <section className="cartao financeiro-form" aria-label={`Recebimento da parcela ${parcela.numero}`}>
    <Nota>Recebido em {fmtData(r.data)}: {fmtCentavos(r.valor)}.</Nota>
    <Divisao rotulo="Como ficou a divisão" linhas={linhasDaDivisao(divisaoGravada(r), r.aliquota_das, x => nomes.get(x) ?? '', r.responsavel_socio, ehAdmin)} />
    {fechar}
  </section>;
}

type Aberto = { o: 'receber' | 'mudar' | 'ver' | 'corrigir' | 'corrigirRecebimento'; parcela: Parcela } | null;

/** O que o menu ⋯ de cada parcela oferece, conforme ela está. Uma ação nova é uma linha nova aqui. */
type Situacao = 'aReceber' | 'recebida' | 'importada';
const situacaoDoMenu = (p: Parcela): Situacao => parcelaAntiga(p) ? 'importada' : p.recebimento_id ? 'recebida' : 'aReceber';
type Agir = { p: Parcela; abrir: (a: Aberto) => void; excluir: (p: Parcela) => Promise<void>; estornar: (p: Parcela) => Promise<void> };
type AcaoDaParcela = { rotulo: string; icone: NomeIcone; perigo?: boolean; fazer: (x: Agir) => void | Promise<void> };
const ACOES_DA_PARCELA: Record<Situacao, AcaoDaParcela[]> = {
  aReceber: [
    { rotulo: 'Mudar', icone: 'editar', fazer: ({ p, abrir }) => abrir({ o: 'mudar', parcela: p }) },
    { rotulo: 'Excluir', icone: 'lixeira', perigo: true, fazer: async ({ p, excluir }) => { if (await confirmar(`Excluir a parcela ${p.numero}?`, 'Dá para desfazer logo depois, no aviso do pé da tela.', 'Excluir', true)) void excluir(p); } }
  ],
  recebida: [
    { rotulo: 'Corrigir', icone: 'editar', fazer: ({ p, abrir }) => abrir({ o: 'corrigirRecebimento', parcela: p }) },
    { rotulo: 'Estornar', icone: 'voltar', perigo: true, fazer: async ({ p, estornar }) => { if (await confirmar(`Estornar o recebimento da parcela ${p.numero}?`, 'A entrada sai do caixa e a parcela volta a ficar a receber.', 'Estornar', true)) void estornar(p); } }
  ],
  importada: [
    { rotulo: 'Corrigir', icone: 'editar', fazer: ({ p, abrir }) => abrir({ o: 'corrigir', parcela: p }) },
    { rotulo: 'Excluir', icone: 'lixeira', perigo: true, fazer: async ({ p, excluir }) => { if (await confirmar(`Excluir a parcela ${p.numero}?`, 'Dá para desfazer logo depois, no aviso do pé da tela.', 'Excluir', true)) void excluir(p); } }
  ]
};

/** A lista com o que se pode fazer em cada parcela. */
export function GestaoDeParcelas<P extends Parcela>({ lista, hoje, contrato, total, aoMudar, topo }: { lista: P[]; hoje: string; contrato?: (p: P) => ParcelaDoEscritorio; total?: number | null; aoMudar: () => void; topo?: ReactNode }) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const [menu, setMenu] = useState<{ botao: HTMLElement; parcela: P } | null>(null);
  useMudancas(() => setAberto(null));
  const terminou = () => { setAberto(null); aoMudar(); };
  async function excluir(p: Parcela) {
    try {
      await SD.parcelaExcluir(p.id);
      feito(`Parcela ${p.numero} excluída.`, 'exclusão da parcela', () => SD.parcelaRestaurar(p.id));
      terminou();
    } catch (e) { falha(e); }
  }
  async function estornar(p: Parcela) {
    try {
      const id = p.recebimento_id!;
      await SD.financeiroEstornar(id);
      feito(`Recebimento da parcela ${p.numero} estornado.`, 'estorno do recebimento', () => SD.financeiroRestaurarRecebimento(id));
      terminou();
    } catch (e) { falha(e); }
  }
  const salvarMudanca = (p: Parcela) => async (f: FormDaParcela) => {
    const { vencimento, valor } = p;
    await SD.parcelaAtualizar(p.id, dadosDaParcela(f));
    feito(`Parcela ${p.numero} atualizada.`, 'mudança da parcela', () => SD.parcelaAtualizar(p.id, { vencimento, valor }));
    terminou();
  };
  const salvarCorrecao = (p: Parcela) => async (f: FormDaParcelaImportada) => {
    const { vencimento, valor, recebida_em, recebido } = p;
    await SD.parcelaCorrigirImportada(p.id, dadosDaParcelaImportada(f));
    feito(`Parcela ${p.numero} corrigida.`, 'correção da parcela', () => SD.parcelaCorrigirImportada(p.id, { vencimento, valor, recebida_em: recebida_em!, recebido: recebido! }));
    terminou();
  };
  return <>
    {topo}
    {aberto?.o === 'corrigirRecebimento' && <CorrigirRecebimento key={aberto.parcela.id} recebimentoId={aberto.parcela.recebimento_id!} parcela={aberto.parcela} aoTerminar={() => { setAberto(null); aoMudar(); }} aoCancelar={() => setAberto(null)} />}
    {aberto?.o === 'corrigir' && <FormParcelaImportada key={aberto.parcela.id} parcela={aberto.parcela} salvar={salvarCorrecao(aberto.parcela)} aoCancelar={() => setAberto(null)} />}
    {aberto?.o === 'receber' && <FormReceber key={aberto.parcela.id} parcela={aberto.parcela} aoTerminar={terminou} aoCancelar={() => setAberto(null)} />}
    {aberto?.o === 'mudar' && <FormParcela key={aberto.parcela.id} rotulo={`Mudar a parcela ${aberto.parcela.numero}`} inicial={formDaParcela(aberto.parcela)} salvar={salvarMudanca(aberto.parcela)} aoCancelar={() => setAberto(null)} />}
    {aberto?.o === 'ver' && <RecebimentoDaParcela key={aberto.parcela.id} parcela={aberto.parcela} aoFechar={() => setAberto(null)} />}
    {lista.length > 0 && <TabelaDeParcelas lista={lista} hoje={hoje} contrato={contrato} total={total} acoes={p => <>
      {parcelaAntiga(p) ? <span className="nota">Importada</span>
        : p.recebimento_id ? <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Ver a divisão da parcela ${p.numero}`} onClick={() => setAberto({ o: 'ver', parcela: p })}>Ver divisão</button>
        : <button type="button" className={estiloBotao({ forma: 'mini', variante: 'principal' })} aria-label={`Receber a parcela ${p.numero}`} onClick={() => setAberto({ o: 'receber', parcela: p })}>Receber</button>}
      <button type="button" className="icone-btn" aria-haspopup="menu" aria-label={`Mais ações da parcela ${p.numero}`} onClick={e => setMenu({ botao: e.currentTarget, parcela: p })}><Icone nome="pontos" tam={16} /></button>
    </>} />}
    {/* A parcela como está agora na lista (ela pode ter mudado depois do clique, ex.: acabou de ser recebida). */}
    {menu && (() => { const atual = lista.find(x => x.id === menu.parcela.id) ?? menu.parcela; return <MenuFlutuante botao={menu.botao} aoFechar={() => setMenu(null)} rotulo={`Ações da parcela ${atual.numero}`}>
      {ACOES_DA_PARCELA[situacaoDoMenu(atual)].map(a => <button key={a.rotulo} type="button" role="menuitem" className={a.perigo ? 'perigo' : undefined}
        aria-label={`${a.rotulo} a parcela ${atual.numero}`} onClick={() => { setMenu(null); void a.fazer({ p: atual, abrir: setAberto, excluir, estornar }); }}>
        <Icone nome={a.icone} tam={15} /> {a.rotulo}
      </button>)}
    </MenuFlutuante>; })()}
  </>;
}

/** A seção do cartão do contrato. */
/** `versao` vem do cartão, que muda quando o contrato muda de coluna: é aí que as parcelas nascem. */
export function ParcelasDoContrato({ k, versao, aoMudar }: { k: Contrato; versao: number; aoMudar: () => void }) {
  const [lista, setLista] = useState<Parcela[] | string | null>(null);
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [nova, setNova] = useState(false);
  const hoje = hojeISO();
  useEffect(() => {
    let vivo = true;
    Promise.all([SD.parcelasDoContrato(k.id), SD.colunasListar('contratos')])
      .then(([x, c]) => { if (vivo) { setLista(x); setColunas(c); } })
      .catch(e => { if (vivo) setLista((e as Error).message); });
    return () => { vivo = false; };
  }, [k.id, versao]);
  useMudancas(() => setNova(false));
  const mudou = () => { setNova(false); aoMudar(); };

  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  async function criar(f: FormDaParcela) {
    const p = await SD.parcelaCriar(k.id, dadosDaParcela(f));
    feito('Parcela criada.', 'parcela', () => SD.parcelaExcluir(p.id));
    mudou();
  }
  async function gerar() {
    // Se falhar, relê do mesmo jeito: pode ser que já tenham gerado.
    try { await SD.parcelasGerar(k.id); } catch (e) { falha(e); }
    mudou();
  }
  const geraSozinho = parcelasDoContrato(k, hoje).length > 0;
  const podeGerar = !lista.length && geraSozinho && chegouAoAssinado(colunas, k.etapa_id, k.assinado_em);
  const vazio = !geraSozinho ? 'Nenhuma parcela. Este contrato não gera parcelas sozinho: lance cada uma quando souber o valor.'
    : podeGerar ? 'Nenhuma parcela. Este contrato foi assinado antes de o financeiro existir: gere as parcelas ou lance à mão.'
    : 'Nenhuma parcela ainda. Elas nascem quando o contrato chega à coluna de assinado.';
  const soma = avisoDaSoma(lista, k.valor, k.descontos);
  return <div className="financeiro-form">
    {!lista.length && <Vazio>{vazio}</Vazio>}
    {soma && <Aviso tipo="info">{soma}</Aviso>}
    <GestaoDeParcelas lista={lista} hoje={hoje} total={k.parcelas} aoMudar={mudou} />
    {nova && <FormParcela rotulo="Nova parcela" inicial={parcelaNova(hoje)} salvar={criar} aoCancelar={() => setNova(false)} />}
    <div className="financeiro-acoes">
      {podeGerar && <Botao variante="principal" onClick={gerar}>Gerar parcelas</Botao>}
      {!nova && <button type="button" className={estiloBotao()} onClick={() => setNova(true)}><Icone nome="mais" tam={15} /> Nova parcela</button>}
    </div>
    <Recolhivel titulo="Histórico das parcelas" icone="relogio" preferencia="contratos.cartao.parcelas.historico">
      <HistoricoDoCartao carregar={() => SD.parcelasHistorico(k.id)} campos={{}} valor={(_campo, v) => v === null || v === undefined ? '—' : String(v)} versao={versao} />
    </Recolhivel>
  </div>;
}

/** A seção do cartão da pessoa: só mostra, com o link para o contrato. */
export function ParcelasDaPessoa({ pessoaId }: { pessoaId: string }) {
  const [lista, setLista] = useState<ParcelaDoEscritorio[] | string | null>(null);
  useEffect(() => {
    let vivo = true;
    SD.parcelasDaPessoa(pessoaId).then(x => { if (vivo) setLista(x); }).catch(e => { if (vivo) setLista((e as Error).message); });
    return () => { vivo = false; };
  }, [pessoaId]);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  if (!lista.length) return <Nota>Nenhuma parcela para mostrar. Só aparecem as dos contratos de que você é responsável.</Nota>;
  return <>
    <TabelaDeParcelas lista={lista} hoje={hojeISO()} contrato={p => p} />
    {lista.length === PARCELAS_DA_PESSOA && <Nota>Mostrando as {PARCELAS_DA_PESSOA} mais novas.</Nota>}
  </>;
}
