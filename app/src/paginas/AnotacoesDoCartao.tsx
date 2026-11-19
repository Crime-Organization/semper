// A seção "Anotações" do cartão de uma pessoa, um processo, um contrato, uma demanda, uma tarefa ou um compromisso (#303):
// as anotações ligadas ao item que quem lê pode ver, o "+" para escrever uma nova já ligada a este item (ela abre em Documentos, na
// mesma janela da anotação, #369) e, embaixo, como nos processos do contrato e da demanda, "Ligar anotação existente" (#341) e
// "Nova anotação". A lista leve (sem o texto) é lida ao abrir o cartão, para o número aparecer com a seção fechada, e de novo quando
// algo muda (a janela do cadastro fechou, ligaram uma anotação, desfizeram algo).
// Desde a #360, a seção fica na coluna da direita do cartão, entre "Comentários" e "Histórico de alterações" (ao lado e na janela
// estreita, no pé do cartão, na mesma ordem), e cada anotação aparece como um comentário (ComoComentario): quem a escreveu e quando
// ela mudou, e, num balão de fundo próprio (--fundo-da-anotacao, para não se misturar aos comentários), o título e o começo do texto
// (inicioDaAnotacao), nunca o texto inteiro. O item todo é o link que abre a anotação em Documentos. O texto só é lido com a seção
// aberta (o Recolhivel só monta o que tem dentro quando aberto): pode ser longo, e a leitura do número fica leve.
import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { SD, type AnotacaoLigada, type AnotacaoLigadaComTexto, type AnotacaoParaLigar, type ModuloDaAnotacao } from '../dados';
import { enderecoDaAnotacaoNova, inicioDaAnotacao, ITEM_DA_ANOTACAO, motivoDeNaoLigarAAnotacao, QUEM_PASSA_A_LER } from '../regras/anotacao';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, Nota, Selo } from '../ui/base';
import { ComoComentario } from '../ui/ComoComentario';
import { Icone } from '../ui/Icone';
import { AcoesDosLigados } from '../ui/ItensLigados';
import { LigarExistente } from '../ui/LigarExistente';
import { Recolhivel } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';
import { relativo } from '../ui/util';

/** Onde fica o cartão de cada anotação. */
export const ENDERECO_DA_ANOTACAO = '/documentos/?id=';
/** O aviso quando a anotação escolhida já estava ligada ao item (alguém ligou enquanto a busca estava aberta). */
export const JA_ESTAVA_LIGADA = 'Esta anotação já estava ligada a este item.';
/**
 * A preferência que guarda se a seção fica aberta, desde que ela foi para a coluna (#360). Não é a de antes
 * (`<módulo>.cartao.anotacoes`): na coluna, a seção começa recolhida para todos, e a escolha vale daqui em diante.
 */
export const preferenciaDasAnotacoes = (modulo: ModuloDaAnotacao) => `${modulo}.coluna.anotacoes`;
/** O tamanho do ícone de documento antes do título, no balão. */
const ICONE_DO_TITULO = 14;

/** O texto da seção vazia, no gênero de cada item. */
const VAZIO: Record<ModuloDaAnotacao, string> = {
  pessoas: 'Nenhuma anotação ligada a esta pessoa.',
  processos: 'Nenhuma anotação ligada a este processo.',
  contratos: 'Nenhuma anotação ligada a este contrato.',
  demandas: 'Nenhuma anotação ligada a esta demanda.',
  tarefas: 'Nenhuma anotação ligada a esta tarefa.',
  compromissos: 'Nenhuma anotação ligada a este compromisso.'
};

interface Props {
  modulo: ModuloDaAnotacao;
  id: string;
  /** Quem só lê o cartão (ou o cartão arquivado) não vê o "+" nem os botões de ligar. */
  somenteLer?: boolean;
}

export function AnotacoesDoCartao({ modulo, id, somenteLer = false }: Props) {
  const ctx = useCtx();
  const ligado = !!ctx.escritorio?.modulos?.anotacoes;
  const [lista, setLista] = useState<AnotacaoLigada[] | string | null>(null);
  // Cada leitura do número conta uma versão: a lista com o texto, se a seção está aberta, lê de novo junto.
  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => {
    setVersao(v => v + 1);
    return SD.anotacoesDoItem(modulo, id).then(setLista).catch(e => setLista((e as Error).message));
  }, [modulo, id]);
  useEffect(() => { if (ligado) void carregar(); }, [ligado, carregar]);
  useMudancas(() => { if (ligado) void carregar(); });
  if (!ligado) return null;

  // A anotação nova abre em Documentos, na janela da anotação, já ligada a este item (#369).
  const cadastro = enderecoDaAnotacaoNova({ [ITEM_DA_ANOTACAO[modulo].parametro]: id });
  const novo = somenteLer ? undefined : { para: cadastro, rotulo: 'Nova anotação ligada a este item' };

  async function ligar(a: AnotacaoParaLigar) {
    try {
      // Se outra pessoa ligou a mesma anotação enquanto a busca estava aberta, nada é gravado: sem Desfazer, que apagaria a dela.
      if (await SD.anotacaoLigar(a.id, modulo, id)) feito(`Anotação ligada: ${a.titulo}.`, 'ligação da anotação', async () => { await SD.anotacaoDesligar(a.id, modulo, id); });
      else avisar(JA_ESTAVA_LIGADA, 'info');
      await carregar();
    } catch (e) { falha(e); }
  }

  return <Recolhivel titulo="Anotações" icone="documentos" preferencia={preferenciaDasAnotacoes(modulo)} contador={Array.isArray(lista) ? lista.length : undefined} novo={novo}>
    {lista === null ? <Carregando />
      : typeof lista === 'string' ? <Aviso tipo="erro">{lista}</Aviso>
      : !lista.length ? <Nota>{VAZIO[modulo]}</Nota>
      : <ListaDasAnotacoes modulo={modulo} id={id} versao={versao} />}
    {!somenteLer && <AcoesDosLigados novo={{ para: cadastro, rotulo: 'Nova anotação' }}>
      <LigarExistente<AnotacaoParaLigar> rotulo="Ligar anotação existente" buscar={termo => SD.anotacoesParaLigar(modulo, id, termo)}
        mostrar={a => ({ id: a.id, titulo: a.titulo, detalhe: `${a.codigo} · Atualizada ${relativo(a.atualizado_em)}`, motivo: motivoDeNaoLigarAAnotacao(a) })}
        aoEscolher={ligar} rotuloDaBusca="Buscar anotação para ligar" dicaDaBusca="Título ou código da anotação" nomeDaLista="Anotações para ligar"
        semAchados={{ comTexto: 'Nenhuma anotação ativa com esse texto que você possa ligar.', semTexto: 'Nenhuma anotação ativa que você possa ligar.' }}
        aviso={QUEM_PASSA_A_LER[modulo] || undefined} />
    </AcoesDosLigados>}
  </Recolhivel>;
}

/**
 * A lista com o começo do texto de cada anotação, que só existe com a seção aberta: lê as anotações com o texto ao aparecer e a
 * cada versão nova da leitura do número. Uma resposta atrasada, de uma versão anterior, não passa por cima da nova.
 */
function ListaDasAnotacoes({ modulo, id, versao }: { modulo: ModuloDaAnotacao; id: string; versao: number }) {
  const [lista, setLista] = useState<AnotacaoLigadaComTexto[] | string | null>(null);
  useEffect(() => {
    let valendo = true;
    SD.anotacoesDoItemComTexto(modulo, id).then(l => { if (valendo) setLista(l); }).catch(e => { if (valendo) setLista((e as Error).message); });
    return () => { valendo = false; };
  }, [modulo, id, versao]);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  if (!lista.length) return <Nota>{VAZIO[modulo]}</Nota>;
  return <ol className="anotacoes-na-coluna" aria-label="Anotações ligadas">{lista.map(a => <AnotacaoNaColuna key={a.id} a={a} />)}</ol>;
}

/**
 * Uma anotação ligada, como um comentário: a bolinha e o nome de quem a escreveu, quando ela mudou, o código e, se for o caso, o selo
 * "Arquivada"; no balão, o título e o começo do texto. Para o leitor de tela, o link se chama pelo título ("Abrir a anotação …"), e
 * quem escreveu, quando e o começo do texto vão na descrição dele.
 */
function AnotacaoNaColuna({ a }: { a: AnotacaoLigadaComTexto }) {
  const inicio = inicioDaAnotacao(a.texto);
  const idDaCabeca = useId(), idDoInicio = useId();
  return <li>
    <Link className="anotacao-na-coluna" to={ENDERECO_DA_ANOTACAO + a.id} aria-label={`Abrir a anotação ${a.titulo}`}
      aria-describedby={inicio ? `${idDaCabeca} ${idDoInicio}` : idDaCabeca}>
      <ComoComentario autorId={a.criado_por} quando={a.atualizado_em} antesDoQuando="Atualizada" bolinhaSemDica idDaCabeca={idDaCabeca}
        extra={<><span className="codigo">{a.codigo}</span>{a.arquivado_em && <>{' '}<Selo tipo="arq">Arquivada</Selo></>}</>}>
        <span className="anotacao-na-coluna-balao">
          <b className="anotacao-na-coluna-titulo"><Icone nome="documentos" tam={ICONE_DO_TITULO} />{a.titulo}</b>
          {inicio && <span className="anotacao-na-coluna-inicio" id={idDoInicio}>{inicio}</span>}
        </span>
      </ComoComentario>
    </Link>
  </li>;
}
