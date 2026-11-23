// As pessoas com papel no processo (#316): autor, réu, testemunha, perito, assistente técnico... além dos clientes. Cada uma num
// quadrinho (ItensLigados) que abre o cartão dela, com o papel embaixo; o "x" ao lado a tira do papel. Embaixo, "Ligar pessoa com
// papel": escolhe o papel (papeisParaEscolher; nos processos de PI, também titular, inventor e autor da criação, #317) e a pessoa do cadastro. O "+" do título da seção abre o mesmo formulário.
// Pôr e tirar têm Desfazer no aviso. Quem só lê o processo (ou com ele arquivado) só vê a lista.
import { useId, useState, type FormEvent } from 'react';
import { SD, type PapelDaParte, type ParteDoProcesso, type PessoaLista } from '../dados';
import { cabeOutraParte, PAPEIS_DA_PARTE, papeisParaEscolher } from '../regras/processo';
import { falha, feito } from '../ui/avisos';
import { Campo, Carregando, Nota, propsDoCampo } from '../ui/base';
import { Botao } from '../ui/Botoes';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { Icone } from '../ui/Icone';
import { AcoesDosLigados, ItensLigados } from '../ui/ItensLigados';
import { usePedidoDeNovo } from '../ui/Recolhivel';

/** O nome do botão que abre o formulário. */
export const LIGAR_PARTE = 'Ligar pessoa com papel';
/** O nome do "+" do título da seção, que abre o mesmo formulário (como "Nova demanda deste processo" ao lado de "Nova demanda"). */
export const LIGAR_PARTE_NO_TITULO = 'Ligar pessoa com papel a este processo';
/** Os papéis de qualquer processo (sem os de propriedade intelectual). */
const PAPEIS_FORA_DA_PI = papeisParaEscolher({});

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
  const [papel, setPapel] = useState<PapelDaParte | ''>('');
  const [pessoa, setPessoa] = useState<PessoaLista | null>(null);
  const [erro, setErro] = useState('');
  const partes = lidas ?? [], cabe = cabeOutraParte(partes.length);
  usePedidoDeNovo(() => { if (podeMudar && cabe) setAberto(true); });

  function fechar() { setAberto(false); setPapel(''); setPessoa(null); setErro(''); }

  async function incluir(e?: FormEvent) {
    e?.preventDefault();
    if (!papel) { setErro('Escolha o papel da pessoa no processo.'); return; }
    if (!pessoa) { setErro('Escolha a pessoa.'); return; }
    try {
      const x = await SD.processoParteIncluir(processoId, pessoa.id, papel);
      feito(`${pessoa.nome} entrou no processo como ${PAPEIS_DA_PARTE[papel].toLowerCase()}.`, 'inclusão da pessoa com papel',
        async () => { await SD.processoParteRetirar(x.id); });
      fechar();
      aoMudar();
    } catch (err) { falha(err); }
  }

  async function retirar(x: ParteDoProcesso) {
    try {
      await SD.processoParteRetirar(x.id);
      feito(`${x.pessoa.nome} saiu do processo como ${PAPEIS_DA_PARTE[x.papel].toLowerCase()}.`, 'retirada da pessoa com papel',
        async () => { await SD.processoParteIncluir(processoId, x.pessoa.id, x.papel); });
      aoMudar();
    } catch (err) { falha(err); }
  }

  // Quem já tem o papel escolhido aparece desligado na busca (o mesmo papel duas vezes, o banco recusa).
  const jaTem = (p: PessoaLista) => papel && partes.some(x => x.pessoa.id === p.id && x.papel === papel) ? 'já tem esse papel' : null;

  if (!lidas) return <Carregando />;
  return <>
    <ItensLigados rotulo="Pessoas com papel no processo" vazio={aberto ? undefined : 'Nenhuma pessoa com papel neste processo (autor, réu, testemunha, perito…).'}
      itens={partes.map(x => ({
        id: x.id, para: '/pessoas/?id=' + x.pessoa.id, codigo: x.pessoa.codigo, titulo: x.pessoa.nome, detalhe: PAPEIS_DA_PARTE[x.papel],
        selo: x.pessoa.arquivado_em ? 'Arquivada' : undefined,
        acao: podeMudar ? <button type="button" className="icone-btn" title="Tirar do processo" aria-label={`Tirar ${x.pessoa.nome} (${PAPEIS_DA_PARTE[x.papel]}) do processo`}
          onClick={() => void retirar(x)}><Icone nome="fechar" tam={14} /></button> : undefined
      }))} />
    {podeMudar && (aberto
      ? <form className="form-vinculo campos" noValidate aria-label={LIGAR_PARTE} onSubmit={incluir}>
        <Campo rotulo="Papel no processo" para={idDoPapel} obrigatorio erro={erro && !papel ? erro : undefined}>
          <select {...propsDoCampo(idDoPapel, { erro: erro && !papel ? erro : undefined })} value={papel} onChange={e => { setPapel(e.target.value as PapelDaParte | ''); setErro(''); }}>
            <option value="">Escolha o papel</option>
            {papeis.map(x => <option key={x} value={x}>{PAPEIS_DA_PARTE[x]}</option>)}
          </select>
        </Campo>
        <BuscaPessoa rotulo="Pessoa" escolhida={pessoa} aoEscolher={p => { setPessoa(p); setErro(''); }} desativar={jaTem} />
        {erro && papel && <Nota>{erro}</Nota>}
        <div className="form-vinculo-acoes">
          <Botao pequeno onClick={fechar}>Cancelar</Botao>
          <Botao pequeno variante="principal" onClick={() => incluir()}>Ligar ao processo</Botao>
        </div>
      </form>
      : <AcoesDosLigados>
        {cabe ? <Botao forma="mini" onClick={() => setAberto(true)}><Icone nome="vinculo" tam={13} /> {LIGAR_PARTE}</Botao>
          : <Nota>Este processo já tem o máximo de pessoas com papel.</Nota>}
      </AcoesDosLigados>)}
  </>;
}
