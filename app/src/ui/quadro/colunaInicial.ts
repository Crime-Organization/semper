// A coluna em que entra o cartão novo quando ninguém escolheu uma (a regra está em regras/quadro.ts).
import { SD, type Modulo } from '../../dados';
import { colunaDoCartaoNovo } from '../../regras/quadro';

export async function colunaInicial(modulo: Modulo) {
  const [colunas, grupos] = await Promise.all([SD.colunasListar(modulo), SD.gruposListar(modulo)]);
  return colunaDoCartaoNovo(colunas, grupos)?.id ?? null;
}
