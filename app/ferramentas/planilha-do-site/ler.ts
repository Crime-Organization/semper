// Ler e gravar os arquivos do conversor (node:fs). Só isto mexe com arquivos; os caminhos vêm por parâmetro.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { decodificarTexto, lerCSV } from '../../src/regras/csv';

/** Um CSV (vírgula ou ponto e vírgula, com ou sem BOM, UTF-8 ou windows-1252) -> células, com as linhas vazias (para o
 *  número de cada linha bater com a planilha). Lança Error em português se o arquivo não existe. */
export function lerTabela(caminho: string, opcao: string): string[][] {
  if (!existsSync(caminho)) throw new Error(`O arquivo de ${opcao} não existe: ${caminho}`);
  return lerCSV(decodificarTexto(readFileSync(caminho)), { manterVazias: true });
}

/** O nome do arquivo, sem a pasta. */
export const nomeDoArquivo = (caminho: string) => basename(caminho);

/** Grava um texto na pasta (criando a pasta, se preciso) e devolve o caminho completo. */
export function gravar(pasta: string, nome: string, texto: string): string {
  mkdirSync(pasta, { recursive: true });
  const caminho = join(pasta, nome);
  writeFileSync(caminho, texto, 'utf8');
  return caminho;
}

