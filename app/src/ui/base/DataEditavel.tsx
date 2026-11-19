// Data que se muda no próprio lugar do cartão (#357), no jeito do título e da descrição (#346): quem pode alterar clica na data e
// ela vira o campo de data (CampoData), com o calendário já aberto. Escolher um dia salva; escrever à mão e apertar Enter (ou sair
// do campo) também; Esc desfaz. Quem só lê vê a data comum. Serve à data de início de tarefas e demandas; o nome dela (ex.: "Início")
// fica em cima, no grupo das datas do cartão (DadoDoGrupo, #361).
import { useRef, useState, type KeyboardEvent } from 'react';
import { fmtData } from '../../regras/pessoa';
import { isoDoTexto } from '../../regras/campoData';
import { avisar, falha } from '../avisos';
import { CampoData } from './CampoData';

interface Props {
  /** O nome inteiro, para o leitor de tela e o campo (ex.: "Data de início"). */
  nome: string;
  /** A data gravada (aaaa-mm-dd). */
  valor: string;
  /** Quem pode alterar recebe a data nova (aaaa-mm-dd), só quando ela mudou. Sem isto, a data só se lê. */
  aoSalvar?: (iso: string) => unknown;
  /** O que a data escrita (dd/mm/aaaa) confere antes de salvar ('' = está certa). */
  conferir: (texto: string) => string;
}

export function DataEditavel({ nome, valor, aoSalvar, conferir }: Props) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  /** Marcado ao salvar ou desfazer: o campo some, e o "sair do campo" que vem depois não salva de novo. */
  const fechado = useRef(false);
  const botao = useRef<HTMLButtonElement>(null);
  const mostrado = fmtData(valor);

  if (!aoSalvar) return <span className="data-editavel"><b className="num">{mostrado}</b></span>;

  /** Fecha o campo. Pelo teclado (e ao escolher no calendário), o foco volta à data, e quem usa o teclado não se perde no cartão. */
  function desfazer(devolverFoco: boolean) {
    fechado.current = true;
    setRascunho(null);
    if (devolverFoco) setTimeout(() => botao.current?.focus({ preventScroll: true }), 0);
  }
  /** Salva a data escrita ou escolhida. Pelo Enter, uma data errada deixa o campo aberto; ao sair do campo, volta à gravada. */
  function salvar(texto: string, pelo: 'enter' | 'escolha' | 'saida') {
    if (fechado.current) return;
    const iso = isoDoTexto(texto);
    if (iso === valor) { desfazer(pelo !== 'saida'); return; }
    const erro = conferir(texto);
    if (erro || !iso) {
      avisar(erro, 'erro');
      if (pelo === 'saida') desfazer(false);
      return;
    }
    desfazer(pelo !== 'saida');
    void Promise.resolve().then(() => aoSalvar!(iso)).catch(falha);
  }
  function teclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); salvar(rascunho ?? '', 'enter'); }
    // Esc desfaz só a data, sem fechar o cartão em volta.
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); desfazer(true); }
  }

  if (rascunho !== null) return <span className="data-editavel editando">
    <CampoData aria-label={nome} valor={rascunho} aoMudar={setRascunho} abrirAoAparecer className="data-editavel-campo"
      aoEscolher={texto => salvar(texto, 'escolha')} aoDesistir={() => desfazer(true)} onKeyDown={teclar}
      onBlur={() => salvar(rascunho, 'saida')} />
  </span>;
  return <span className="data-editavel">
    <button ref={botao} type="button" className="data-editavel-botao num" aria-label={`${nome}: ${mostrado}. Clique para mudar`} title={`Clique para mudar a ${nome.toLowerCase()}`}
      onClick={() => { fechado.current = false; setRascunho(mostrado); }}>
      {mostrado}
    </button>
  </span>;
}
