// O aviso do consentimento sem data no Início (#409), só para os administradores: quantas pessoas do escritório têm a base legal
// "consentimento" e a data dele vazia, com o link para a página Pessoas já filtrada. Sem nenhuma (ou se a contagem falhar), não aparece.
import { useEffect, useState } from 'react';
import { SD } from '../../dados';
import { avisoDoConsentimentoSemData, LISTA_SEM_DATA, VER_SEM_DATA } from '../../regras/consentimentoSemData';
import { Aviso, BotaoLink } from '../../ui/base';

/** versao: muda a cada mudança no sistema (o Início lê tudo de novo), para a conta acompanhar as datas completadas. */
export function AvisoDoConsentimento({ versao }: { versao: number }) {
  const [quantas, setQuantas] = useState(0);
  useEffect(() => {
    let vivo = true;
    // O aviso é um lembrete: se a contagem falhar, o painel segue sem ele, em vez de mostrar um erro.
    SD.pessoasSemDataDoConsentimento().then(n => { if (vivo) setQuantas(n); }).catch(() => {});
    return () => { vivo = false; };
  }, [versao]);
  const frase = avisoDoConsentimentoSemData(quantas);
  if (!frase) return null;
  return <Aviso tipo="info">
    {frase} <BotaoLink forma="link" to={LISTA_SEM_DATA}>{VER_SEM_DATA}</BotaoLink>
  </Aviso>;
}
