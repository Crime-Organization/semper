// As pessoas com papel no processo (#316): autor, réu, testemunha, perito, assistente técnico... além dos clientes. Cada uma num
// quadrinho (ItensLigados) que abre o cartão dela, com o papel embaixo; o "x" ao lado a tira do papel. Embaixo, "Ligar pessoa com
// papel": escolhe o papel (papeisParaEscolher; nos processos de PI, também titular, inventor e autor da criação, #317; os escritos pela
// equipe e o de escrever um agora, #443) e a pessoa do cadastro. A corrente
// do título da seção abre o mesmo formulário (#427), e aí o botão de baixo não aparece.
// Pôr e tirar têm Desfazer no aviso. Quem só lê o processo (ou com ele arquivado) só vê a lista.
import { useId, useState, type FormEvent } from 'react';
import { SD, type PapelDaParte, type ParteDoProcesso, type PessoaLista } from '../dados';
import { cabeOutraParte, nomeDoPapel, papeisParaEscolher } from '../regras/processo';
import { valorDoPapel, type PapelEscolhido } from '../regras/papelEscrito';
import { recarregarPapeisEscritos, usePapeisEscritos } from '../ui/papeisEscritos';
import { OpcoesDoPapel, papelDaEscolha } from './processo/EscolhaDoPapel';
import { falha, feito } from '../ui/avisos';
import { Campo, Carregando, Nota, propsDoCampo } from '../ui/base';
import { Botao } from '../ui/Botoes';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { Icone } from '../ui/Icone';
import { AcoesDosLigados, ItensLigados } from '../ui/ItensLigados';
import { usePedidoDeLigar, type LigarNaSecao } from '../ui/Recolhivel';

/** O nome do botão que abre o formulário. */
export const LIGAR_PARTE = 'Ligar pessoa com papel';
/** O nome da corrente do título da seção (#427), que abre o mesmo formulário. */
export const LIGAR_PARTE_NO_TITULO = 'Ligar pessoa com papel a este processo';
/** Os papéis de qualquer processo (sem os de propriedade intelectual). */
const PAPEIS_FORA_DA_PI = papeisParaEscolher({});
/** Por que não cabe mais ninguém. */
const PARTES_CHEIAS = 'Este processo já tem o máximo de pessoas com papel.';

/** A corrente do título da seção (#427): com a lista cheia, desligada, com o motivo. */
export const ligarParte = (partes: readonly unknown[] | undefined): LigarNaSecao =>
  ({ rotulo: LIGAR_PARTE_NO_TITULO, indisponivel: partes && !cabeOutraParte(partes.length) ? PARTES_CHEIAS : undefined });

interface Props {
  processoId: string;
  /** undefined: ainda lendo. */
  partes: ParteDoProcesso[] | undefined;
  /** Os papéis que o formulário oferece (papeisParaEscolher: nos processos de PI, também titular, inventor e autor, #317). Sem eles, os de qualquer processo. */
  papeis?: PapelDaParte[];
  /** Quem altera o processo, com ele ativo: põe e tira. */
  podeMudar: boolean;
  /** Algo mudou: o cartão lê a lista, o contador e o histórico de novo. */
  aoMudar: () => void;
}

export function PartesDoProcesso({ processoId, partes: lidas, papeis = PAPEIS_FORA_DA_PI, podeMudar, aoMudar }: Props) {
  const idDoPapel = useId();
  const [aberto, setAberto] = useState(false);
  const [escolha, setEscolha] = useState<PapelEscolhido | null>(null);
  const papel = escolha?.papel ?? '';
  // Os papéis escritos pela equipe (#443), a lista do escritório.
  const lista = usePapeisEscritos();
  const [pessoa, setPessoa] = useState<PessoaLista | null>(null);
  const [erro, setErro] = useState('');
  const partes = lidas ?? [], cabe = cabeOutraParte(partes.length);
  const peloTitulo = usePedidoDeLigar(LIGAR_PARTE_NO_TITULO, () => { if (podeMudar && cabe) setAberto(true); });

  function fechar() { setAberto(false); setEscolha(null); setPessoa(null); setErro(''); }
  // A última opção abre a janela de escrever (#443): se a pessoa desiste, nada muda.
  async function escolherPapel(valor: string) {
    const r = await papelDaEscolha(valor, lista, papeis);
    if (r === undefined) return;
    setEscolha(r);
    setErro('');
  }

  async function incluir(e?: FormEvent) {
    e?.preventDefault();
    if (!escolha) { setErro('Escolha o papel da pessoa no processo.'); return; }
    if (!pessoa) { setErro('Escolha a pessoa.'); return; }
    try {
      const x = await SD.processoParteIncluir(processoId, pessoa.id, escolha.papel, escolha.escrito);
      feito(`${pessoa.nome} entrou no processo como ${nomeDoPapel(x.papel, x.papel_escrito).toLowerCase()}.`, 'inclusão da pessoa com papel',
        async () => { await SD.processoParteRetirar(x.id); });
      // O papel escrito entrou na lista do escritório.
      if (x.papel_escrito) void recarregarPapeisEscritos();
      fechar();
      aoMudar();
    } catch (err) { falha(err); }
  }

  async function retirar(x: ParteDoProcesso) {
    try {
      await SD.processoParteRetirar(x.id);
      feito(`${x.pessoa.nome} saiu do processo como ${nomeDoPapel(x.papel, x.papel_escrito).toLowerCase()}.`, 'retirada da pessoa com papel',
        async () => { await SD.processoParteIncluir(processoId, x.pessoa.id, x.papel, x.papel_escrito); });
      aoMudar();
    } catch (err) { falha(err); }
  }

  // Quem já tem o papel escolhido aparece desligado na busca (o mesmo papel duas vezes, o banco recusa).
  const jaTem = (p: PessoaLista) => papel && partes.some(x => x.pessoa.id === p.id && x.papel === papel) ? 'já tem esse papel' : null;

  if (!lidas) return <Carregando />;
  return <>
    <ItensLigados rotulo="Pessoas com papel no processo" vazio={aberto ? undefined : 'Nenhuma pessoa com papel neste processo (autor, réu, testemunha, perito…).'}
      itens={partes.map(x => ({
        id: x.id, para: '/pessoas/?id=' + x.pessoa.id, codigo: x.pessoa.codigo, titulo: x.pessoa.nome, detalhe: nomeDoPapel(x.papel, x.papel_escrito),
        selo: x.pessoa.arquivado_em ? 'Arquivada' : undefined,
        tirar: podeMudar ? { oQue: `${x.pessoa.nome} (${nomeDoPapel(x.papel, x.papel_escrito)}) do processo`, aoTirar: () => retirar(x) } : undefined
      }))} />
    {podeMudar && (aberto
      ? <form className="form-vinculo campos" noValidate aria-label={LIGAR_PARTE} onSubmit={incluir}>
        <Campo rotulo="Papel no processo" para={idDoPapel} obrigatorio erro={erro && !papel ? erro : undefined}>
          <select {...propsDoCampo(idDoPapel, { erro: erro && !papel ? erro : undefined })} value={valorDoPapel(escolha?.papel, escolha?.escrito)}
            onChange={e => void escolherPapel(e.target.value)}>
            <OpcoesDoPapel vazio="Escolha o papel" fixos={papeis} lista={lista} usados={[escolha?.escrito]} />
          </select>
        </Campo>
        <BuscaPessoa rotulo="Pessoa" escolhida={pessoa} aoEscolher={p => { setPessoa(p); setErro(''); }} desativar={jaTem} />
        {erro && papel && <Nota>{erro}</Nota>}
        <div className="form-vinculo-acoes">
          <Botao pequeno onClick={fechar}>Cancelar</Botao>
          <Botao pequeno variante="principal" onClick={() => incluir()}>Ligar ao processo</Botao>
        </div>
      </form>
      : !cabe ? <Nota>{PARTES_CHEIAS}</Nota>
      : !peloTitulo && <AcoesDosLigados>
        <Botao forma="mini" onClick={() => setAberto(true)}><Icone nome="vinculo" tam={13} /> {LIGAR_PARTE}</Botao>
      </AcoesDosLigados>)}
  </>;
}
