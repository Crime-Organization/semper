// O campo de data e hora do SEMPER (#299): a data e a hora numa caixa só, porque são uma informação só (o prazo de uma tarefa ou de
// uma demanda, o dia do compromisso, a audiência de um processo). A data é a do CampoData (#357): o calendário pequeno no computador,
// o do aparelho no celular. A hora fica logo ao lado, dentro da mesma caixa, e é opcional, salvo quando o cadastro a exige. Escolhido
// o dia no calendário, o foco passa para a hora. Ao lado da caixa cabe um botão do mesmo campo (`junto`: o lembrete, com o sino).
// Vai dentro de <Campo>, com propsDoCampo(), como o CampoData: o rótulo do <Campo> é o da data, e a hora tem o próprio nome. No grupo
// das datas do cartão (#361: o prazo, a data do compromisso), o mesmo campo vem no tamanho de cartão (`discreto`).
import { useRef, type ReactNode } from 'react';
import { APARELHO_DE_TOQUE, CampoData, type PropsCampoData } from './CampoData';

export interface PropsCampoDataHora extends Omit<PropsCampoData, 'hora'> {
  /** A hora (hh:mm), ou vazio. */
  hora: string;
  aoMudarHora: (hora: string) => void;
  /** O nome da hora para o leitor de tela; na tela, ela fica junto da data, sob o mesmo rótulo. */
  rotuloDaHora?: string;
  /** A hora é obrigatória (a audiência, a reunião): o leitor de tela avisa. */
  horaObrigatoria?: boolean;
  /** A hora está com erro (a mensagem aparece no <Campo>, embaixo das duas). */
  horaComErro?: boolean;
  /** O id do que descreve a hora (a dica, o erro). Sem isto, o mesmo da data. */
  descricaoDaHora?: string;
  /** No tamanho de cartão: um pouco mais baixo que o das perguntas (o grupo das datas do cartão, #361). */
  discreto?: boolean;
  /** O que vem logo depois da caixa, na mesma linha (o botão do lembrete). Na tela estreita, desce para a linha de baixo. */
  junto?: ReactNode;
}

/** A data e a hora numa caixa só, com o calendário pequeno (#357) na data. */
export function CampoDataHora({ id, hora, aoMudarHora, rotuloDaHora = 'Hora', horaObrigatoria, horaComErro, descricaoDaHora, discreto, junto, aoEscolher,
  disabled, ...resto }: PropsCampoDataHora) {
  const campoDaHora = useRef<HTMLInputElement>(null);
  // O dia escolhido no calendário pequeno leva o foco à hora, o que falta preencher. Espera o calendário fechar (ele devolve o foco à
  // data). No aparelho de toque, não: o foco abriria o relógio do aparelho sem a pessoa pedir.
  function escolher(valor: string) {
    aoEscolher?.(valor);
    if (!window.matchMedia?.(APARELHO_DE_TOQUE).matches) setTimeout(() => campoDaHora.current?.focus(), 0);
  }
  return <div className={discreto ? 'campo-data-e-hora discreto' : 'campo-data-e-hora'}>
    <div className="campo-quando">
      <CampoData id={id} disabled={disabled} aoEscolher={escolher} {...resto} />
      <input type="time" ref={campoDaHora} id={id ? id + '-hora' : undefined} aria-label={rotuloDaHora} aria-describedby={descricaoDaHora ?? resto['aria-describedby']}
        aria-invalid={horaComErro || undefined} aria-required={horaObrigatoria || undefined} disabled={disabled} value={hora}
        onChange={e => aoMudarHora(e.target.value)} />
    </div>
    {junto}
  </div>;
}
