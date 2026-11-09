// O que aparece se uma tela não abrir: um erro no código dela, ou um arquivo que deixou de existir depois de uma publicação nova.
import { Aviso, estiloBotao } from './base';

export function ErroDaTela() {
  return <div className="miolo">
    <Aviso tipo="erro">Não foi possível abrir esta tela. Recarregue a página para tentar de novo. Se continuar assim, fale com a administração do escritório.</Aviso>
    <div><button type="button" className={estiloBotao({ variante: 'principal' })} onClick={() => location.reload()}>Recarregar a página</button></div>
  </div>;
}
