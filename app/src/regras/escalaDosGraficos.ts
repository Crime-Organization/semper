// A escala das barras em pé dos painéis (ui/Graficos.tsx): até onde vai o eixo, para as linhas da grade caírem em números redondos
// ("R$ 3 mil, R$ 6 mil, R$ 9 mil", e não "R$ 2,7 mil, R$ 5,4 mil, R$ 8,1 mil", que só repetem o maior valor dividido em partes).

/** Os passos redondos entre duas linhas da grade, dentro de cada potência de dez (1, 1,5, 2, 2,5… 10; 100, 150, 200…). */
const PASSOS_REDONDOS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;
/** A base das potências dos passos. */
const DEZ = 10;
/** A folga da conta com frações (0,1 × 3 dá 0,30000000000000004): abaixo dela, o passo já é o redondo. */
const FOLGA_DA_CONTA = 1e-9;

/**
 * O topo do eixo, para um gráfico cujo maior valor é "maior", com "linhas" espaços entre a base e o topo. Para contagens ("inteira"),
 * o passo é o menor número inteiro que cobre o maior valor; para o resto (reais, horas), o menor passo redondo que cobre. O topo nunca
 * fica abaixo do maior valor; sem nada (zero ou menos), a escala vai de 0 a "linhas" (cada linha, 1).
 */
export function topoDaEscala(maior: number, linhas: number, inteira = false): number {
  if (!(maior > 0)) return linhas;
  if (inteira) return Math.ceil(maior / linhas) * linhas;
  const passo = maior / linhas;
  const potencia = DEZ ** Math.floor(Math.log10(passo));
  const redondo = PASSOS_REDONDOS.find(p => p * potencia >= passo * (1 - FOLGA_DA_CONTA)) ?? DEZ;
  return redondo * potencia * linhas;
}
