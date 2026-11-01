// Importar pessoas de um arquivo CSV (Pessoas > ⋯ > Importar pessoas; só administradores). Cinco etapas: escolher o
// arquivo, ligar os responsáveis à equipe, conferir (nada é gravado antes), gravar e ver o resumo. As regras ficam em
// regras/importacao.ts; cada etapa é um componente (importarPessoas/etapas.tsx), escolhido pela tabela
// ETAPAS_IMPORTACAO. A gravação roda numa loja (ui/gravacaoDaImportacao.ts): fechar a janela não a interrompe, e o
// resumo reaparece ao abrir a importação de novo.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { SD, type ItemImportacao } from '../dados';
import { LOTE_DA_IMPORTACAO, TAMANHO_MAXIMO_DO_ARQUIVO } from '../dados/limites';
import { decodificarTexto } from '../regras/csv';
import {
  classificar, emLotes, lerImportacao, nomesDeResponsaveis, normalizarLinha, planejar,
  type ChaveImportacao, type Classificacao, type Decisao, type LeituraImportacao, type MapaResponsaveis,
  type NomeDoArquivo, type PessoaImportada
} from '../regras/importacao';
import { normal } from '../regras/texto';
import { falha } from '../ui/avisos';
import { Progresso } from '../ui/base';
import { esquecerGravacao, gravacao, gravarImportacao, type EstadoGravacao } from '../ui/gravacaoDaImportacao';
import { janela } from '../ui/janela';
import { useCtx } from '../ui/sessao';
import { hojeISO, subirAoCadastro, useTitulo } from '../ui/util';
import { ImportacaoCtx, type ArquivoLido, type EtapaImportacao, type TelaImportacao } from './importarPessoas/contexto';
import { ETAPAS_IMPORTACAO } from './importarPessoas/etapas';
import { avisoFinal, descricaoDaImportacao, listaComE, textoDaConfirmacao } from './importarPessoas/textos';
import './ImportarPessoas.css';

/** Um megabyte, para dizer o tamanho do arquivo como as pessoas leem ("12,5 MB"). */
const MEGABYTE = 1024 * 1024;
const emMegabytes = (bytes: number) => `${(bytes / MEGABYTE).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
/**
 * O que o SEMPER aceita como CSV: pela extensão (.csv ou .txt); só o arquivo sem extensão vale pelo tipo que o
 * navegador informa. O tipo não basta: o .xls do Excel também chega como application/vnd.ms-excel.
 */
const EXTENSOES_CSV = ['csv', 'txt'];
const TIPOS_CSV = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
const extensaoDe = (nome: string) => /\.([^./\\]+)$/.exec(nome)?.[1].toLowerCase() ?? null;
const pareceCsv = (f: File) => {
  const extensao = extensaoDe(f.name);
  return extensao ? EXTENSOES_CSV.includes(extensao) : TIPOS_CSV.includes(f.type);
};
const NAO_E_CSV = 'Não consegui ler o arquivo. Ele precisa ser um CSV (no Excel: Arquivo > Salvar como > CSV).';
const faltamColunas = (faltando: ChaveImportacao[]) => faltando.length === 1
  ? `Este arquivo não tem a coluna “${faltando[0]}”. Baixe o modelo para ver as colunas.`
  : `Este arquivo não tem as colunas ${listaComE(faltando.map(c => `“${c}”`))}. Baixe o modelo para ver as colunas.`;
/** Base legal marcada de início (decidido pelo escritório: os clientes têm contrato). */
const LGPD_PADRAO = 'contrato';

/** Com a gravação em andamento ou concluída, a tela mostra essa etapa (mesmo reaberta); parada, a escolhida aqui. */
const ETAPA_DA_GRAVACAO: Record<EstadoGravacao['fase'], EtapaImportacao | null> = { ocioso: null, gravando: 'gravando', concluida: 'resumo' };
const ORDEM_DAS_ETAPAS = Object.keys(ETAPAS_IMPORTACAO) as EtapaImportacao[];
const semErro = (i: PessoaImportada) => !i.problemas.some(p => p.gravidade === 'erro');
const distintos = (valores: (string | null)[]) => [...new Set(valores.filter((v): v is string => !!v))];

export default function ImportarPessoas() {
  const ctx = useCtx();
  // Garantia de verdade é o banco (as funções da importação recusam quem não é administrador); aqui, só o caminho.
  if (!ctx.ehAdmin) return <Navigate to="/pessoas/" replace />;
  return <Importacao />;
}

function Importacao() {
  useTitulo('Importar pessoas');
  const ctx = useCtx();
  const navegar = useNavigate();
  const estado = gravacao.usar();
  const [escolhida, setEscolhida] = useState<EtapaImportacao>('arquivo');
  const [lgpdPadrao, setLgpdPadrao] = useState(LGPD_PADRAO);
  const [lendo, setLendo] = useState(false);
  const [erroDoArquivo, setErroDoArquivo] = useState('');
  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null);
  const [importadas, setImportadas] = useState<PessoaImportada[]>([]);
  const [nomes, setNomes] = useState<NomeDoArquivo[]>([]);
  const [mapa, setMapa] = useState<MapaResponsaveis>({});
  const [conferindo, setConferindo] = useState(false);
  const [classificacoes, setClassificacoes] = useState<Classificacao[]>([]);
  const [decisoes, setDecisoes] = useState<Record<number, Decisao>>({});
  const plano = useMemo(() => planejar(importadas, classificacoes, decisoes, mapa), [importadas, classificacoes, decisoes, mapa]);

  const etapa = ETAPA_DA_GRAVACAO[estado.fase] ?? escolhida;
  const def = ETAPAS_IMPORTACAO[etapa];
  const indice = ORDEM_DAS_ETAPAS.indexOf(etapa);

  // A cada troca de etapa, o botão clicado some com a etapa: o foco vai para o título da etapa nova (o leitor de tela
  // o anuncia e o Tab segue dali) e a janela volta ao topo, como no cadastro de pessoa. Ao abrir, nada muda.
  const tituloDaEtapa = useRef<HTMLHeadingElement>(null);
  const etapaMostrada = useRef(etapa);
  useEffect(() => {
    if (etapaMostrada.current === etapa) return;
    etapaMostrada.current = etapa;
    tituloDaEtapa.current?.focus({ preventScroll: true });
    subirAoCadastro();
  }, [etapa]);

  async function lerArquivo(f: File) {
    setErroDoArquivo('');
    if (f.size > TAMANHO_MAXIMO_DO_ARQUIVO) {
      setErroDoArquivo(`O arquivo tem ${emMegabytes(f.size)}; o máximo é ${emMegabytes(TAMANHO_MAXIMO_DO_ARQUIVO)}. Divida em partes.`);
      return;
    }
    if (!pareceCsv(f)) { setErroDoArquivo(NAO_E_CSV); return; }
    setLendo(true);
    try {
      let leitura: LeituraImportacao;
      try { leitura = lerImportacao(decodificarTexto(await f.arrayBuffer())); }
      catch (e) { setErroDoArquivo((e as Error)?.message || NAO_E_CSV); return; }
      if (leitura.faltando.length) { setErroDoArquivo(faltamColunas(leitura.faltando)); return; }
      const lidas = leitura.linhas.map(l => normalizarLinha(l, { hoje: hojeISO(), lgpdPadrao }));
      const achados = nomesDeResponsaveis(lidas, ctx.equipe);
      setArquivo({ nome: f.name, desconhecidas: leitura.desconhecidas, repetidas: leitura.repetidas });
      setImportadas(lidas);
      setNomes(achados);
      setMapa(Object.fromEntries(achados.map(n => [normal(n.texto), n.sugestao])));
      setClassificacoes([]);
      setDecisoes({});
      setEscolhida('responsaveis');
    } finally { setLendo(false); }
  }

  // Compara com o que já está no SEMPER: os cadastros (inclusive arquivados) com os CPF/CNPJ ou as referências do arquivo.
  async function conferir() {
    const validas = importadas.filter(semErro);
    setConferindo(true);
    try {
      const existentes = await SD.pessoasParaImportar({
        documentos: distintos(validas.map(i => i.dados.documento ?? null)), referencias: distintos(validas.map(i => i.referencia))
      });
      setClassificacoes(classificar(importadas, existentes, mapa));
      setDecisoes({});
      setEscolhida('conferencia');
    } catch (e) { falha(e); }
    finally { setConferindo(false); }
  }

  async function gravar() {
    const { itens, problemas } = plano;
    if (!itens.length || !arquivo) return;
    const ok = await janela<boolean>({
      titulo: 'Gravar a importação?',
      corpo: <p>{textoDaConfirmacao({ itens, classificacoes, decisoes, problemas })}</p>,
      acoes: [{ rotulo: 'Voltar', valor: false }, { rotulo: 'Gravar', valor: true, tipo: 'pri' }]
    });
    if (!ok) return;
    const descricao = descricaoDaImportacao(importadas.length, itens.length);
    try {
      await gravarImportacao<ItemImportacao>({
        lotes: emLotes(itens, LOTE_DA_IMPORTACAO),
        iniciar: () => SD.importacaoIniciar(descricao, arquivo.nome),
        gravarLote: (id, lote) => SD.pessoasImportar(id, lote),
        concluir: (id, completadas) => SD.importacaoConcluir(id, completadas),
        avisoFinal
      });
    } catch (e) { falha(e); }
  }

  function recomecar() {
    esquecerGravacao();
    setArquivo(null); setImportadas([]); setNomes([]); setMapa({}); setClassificacoes([]); setDecisoes({}); setErroDoArquivo('');
    setEscolhida('arquivo');
  }

  const tela: TelaImportacao = {
    irPara: setEscolhida,
    lgpdPadrao, mudarLgpd: setLgpdPadrao, lendo, erroDoArquivo, lerArquivo, arquivo, importadas,
    nomes, mapa, ligar: (texto, perfil) => setMapa(m => ({ ...m, [normal(texto)]: perfil })), conferindo, conferir,
    classificacoes, decisoes, decidir: (linha, d) => setDecisoes(x => ({ ...x, [linha]: d })), plano, gravar,
    recomecar,
    // Ao fechar, a lista de Pessoas recarrega (App.tsx avisa ao sair da janela).
    fechar: () => { esquecerGravacao(); navegar('/pessoas/', { replace: true }); }
  };
  const Atual = def.Componente;

  return <div className="passos">
    <header>
      {/* Gravando, a janela não fecha ("Espere terminar"): o caminho de volta some até o fim. */}
      <p className="olho">{estado.fase === 'gravando' ? 'Pessoas' : <Link to="/pessoas/">Pessoas</Link>}</p>
      <h1 className="titulo">Importar pessoas<span className="ponto">.</span></h1>
    </header>
    <div className="passos-topo">
      <span>Etapa {indice + 1} de {ORDEM_DAS_ETAPAS.length}</span>
      <Progresso rotulo="Etapas da importação" valor={indice} maximo={ORDEM_DAS_ETAPAS.length - 1} />
    </div>
    <section className="etapa ativa" aria-labelledby="etapa-importacao">
      <header>
        <h2 id="etapa-importacao" ref={tituloDaEtapa} tabIndex={-1}>{def.titulo}</h2>
        {def.explicacao && <p>{def.explicacao}</p>}
      </header>
      <ImportacaoCtx.Provider value={tela}><Atual /></ImportacaoCtx.Provider>
    </section>
  </div>;
}
