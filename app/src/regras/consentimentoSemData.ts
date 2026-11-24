// O consentimento sem data (#409): antes da #405/#408, o cadastro podia salvar a base legal "consentimento" sem a data dele. A página
// Pessoas filtra esses cadastros ("Situação do cadastro" > "Consentimento sem data") e o Início avisa os administradores, com quantos
// são e o link para a lista já filtrada, para o escritório completar as datas. A conta é a de faltaDataDoConsentimento (regras/pessoa.ts).
import type { MarcaPessoas } from '../dados/tipos';

/** A marca do filtro de Pessoas com os cadastros de base legal "consentimento" e sem a data dele. */
export const MARCA_SEM_DATA = 'consentimento_sem_data' satisfies MarcaPessoas;
/** O nome da opção no filtro "Situação do cadastro" da página Pessoas. */
export const ROTULO_SEM_DATA = 'Consentimento sem data';
/** A página Pessoas já filtrada, na tabela (o quadro não mostra as arquivadas, que também entram na conta). */
export const LISTA_SEM_DATA = `/pessoas/?visao=tabela&marca=${MARCA_SEM_DATA}`;
/** O texto do link do aviso. */
export const VER_SEM_DATA = 'Completar as datas';

/** A frase do aviso do Início com quantas pessoas estão sem a data; sem nenhuma, não há aviso (null). */
export function avisoDoConsentimentoSemData(quantas: number): string | null {
  if (quantas <= 0) return null;
  const sujeito = quantas === 1 ? '1 pessoa está' : `${quantas.toLocaleString('pt-BR')} pessoas estão`;
  return `${sujeito} com a base legal "consentimento" e sem a data dele. A data é a prova de quando a pessoa autorizou o uso dos dados (LGPD).`;
}
