// A seção "Anotações" do cartão de uma pessoa, um processo, um contrato, uma demanda, uma tarefa ou um compromisso (#303):
// as anotações ligadas ao item que quem lê pode ver, cada uma num quadrinho que abre o cartão dela em Documentos, o "+" para
// escrever uma nova já ligada a este item e, embaixo, como nos processos do contrato e da demanda, "Ligar anotação existente"
// (#341) e "Nova anotação". A lista é lida ao abrir o cartão (para o número aparecer com a seção fechada) e de novo quando algo
// muda (a janela do cadastro fechou, ligaram uma anotação, desfizeram algo).
import { useCallback, useEffect, useState } from 'react';
import { SD, type AnotacaoLigada, type AnotacaoParaLigar, type ModuloDaAnotacao } from '../dados';
import { ITEM_DA_ANOTACAO, motivoDeNaoLigarAAnotacao, QUEM_PASSA_A_LER } from '../regras/anotacao';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando } from '../ui/base';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { LigarExistente } from '../ui/LigarExistente';
import { Recolhivel } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';
import { relativo } from '../ui/util';

/** Onde fica o cartão de cada anotação, e o cadastro de uma nova. */
export const ENDERECO_DA_ANOTACAO = '/documentos/?id=';
export const CADASTRO_DE_ANOTACAO = '/documentos/nova/';
/** O aviso quando a anotação escolhida já estava ligada ao item (alguém ligou enquanto a busca estava aberta). */
export const JA_ESTAVA_LIGADA = 'Esta anotação já estava ligada a este item.';

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
  const carregar = useCallback(() => SD.anotacoesDoItem(modulo, id).then(setLista).catch(e => setLista((e as Error).message)), [modulo, id]);
  useEffect(() => { if (ligado) void carregar(); }, [ligado, carregar]);
  useMudancas(() => { if (ligado) void carregar(); });
  if (!ligado) return null;

  const cadastro = `${CADASTRO_DE_ANOTACAO}?${ITEM_DA_ANOTACAO[modulo].parametro}=${id}`;
  const novo = somenteLer ? undefined : { para: cadastro, rotulo: 'Nova anotação ligada a este item' };

  async function ligar(a: AnotacaoParaLigar) {
    try {
      // Se outra pessoa ligou a mesma anotação enquanto a busca estava aberta, nada é gravado: sem Desfazer, que apagaria a dela.
      if (await SD.anotacaoLigar(a.id, modulo, id)) feito(`Anotação ligada: ${a.titulo}.`, 'ligação da anotação', async () => { await SD.anotacaoDesligar(a.id, modulo, id); });
      else avisar(JA_ESTAVA_LIGADA, 'info');
      await carregar();
    } catch (e) { falha(e); }
  }

  return <Recolhivel titulo="Anotações" icone="documentos" preferencia={`${modulo}.cartao.anotacoes`} contador={Array.isArray(lista) ? lista.length : undefined} novo={novo}>
    {lista === null ? <Carregando />
      : typeof lista === 'string' ? <Aviso tipo="erro">{lista}</Aviso>
      : <ItensLigados rotulo="Anotações ligadas" vazio={VAZIO[modulo]} itens={lista.map(a => ({
        id: a.id, para: ENDERECO_DA_ANOTACAO + a.id, codigo: a.codigo, titulo: a.titulo, selo: a.arquivado_em ? 'Arquivada' : undefined,
        detalhe: `Atualizada ${relativo(a.atualizado_em)}`
      }))} />}
    {!somenteLer && <div className="ligados-acoes">
      <LigarExistente<AnotacaoParaLigar> rotulo="Ligar anotação existente" buscar={termo => SD.anotacoesParaLigar(modulo, id, termo)}
        mostrar={a => ({ id: a.id, titulo: a.titulo, detalhe: `${a.codigo} · Atualizada ${relativo(a.atualizado_em)}`, motivo: motivoDeNaoLigarAAnotacao(a) })}
        aoEscolher={ligar} rotuloDaBusca="Buscar anotação para ligar" dicaDaBusca="Título ou código da anotação" nomeDaLista="Anotações para ligar"
        semAchados={{ comTexto: 'Nenhuma anotação ativa com esse texto que você possa ligar.', semTexto: 'Nenhuma anotação ativa que você possa ligar.' }}
        aviso={QUEM_PASSA_A_LER[modulo] || undefined} />
      <BotaoLink forma="mini" to={cadastro}><Icone nome="mais" tam={13} /> Nova anotação</BotaoLink>
    </div>}
  </Recolhivel>;
}
