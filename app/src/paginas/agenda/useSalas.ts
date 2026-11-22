// As salas do escritório (#308), para o cadastro e o cartão do compromisso e o filtro da agenda: lidas uma vez por tela, todas (as
// desativadas também, para os compromissos antigos mostrarem o nome). Enquanto lê, ou se a leitura falhar, a lista vem vazia.
import { useEffect, useState } from 'react';
import { SD, type Sala } from '../../dados';

export function useSalas(ligada = true): Sala[] {
  const [salas, setSalas] = useState<Sala[]>([]);
  useEffect(() => {
    if (!ligada) return;
    let vivo = true;
    SD.salasListar().then(s => { if (vivo) setSalas(s); }).catch(() => { /* sem as salas, a tela segue sem elas */ });
    return () => { vivo = false; };
  }, [ligada]);
  return salas;
}
