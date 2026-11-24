// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Separar um objeto de contrato em dois ou mais, na lista das Configurações (#410).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type ObjetoDoEscritorio } from '../dados';
import { Avisos } from '../ui/avisos';
import { iniciarPreferencias } from '../ui/preferencias';
import { SEM_OBJETO_DA_DEMANDA } from '../regras/objetos';
import { SepararObjeto } from './SepararObjeto';

const JUNTOS: ObjetoDoEscritorio = { id: 'o1', descricao: 'Marca e patente', contratos_ativos: 2, contratos_arquivados: 0, demandas: 2 };
const DEMANDAS = [
  { id: 'd1', codigo: 'D1', titulo: 'Marca e patente', contrato_codigo: 'AN26-0001-2026' },
  { id: 'd2', codigo: 'D2', titulo: 'Registro do logotipo', contrato_codigo: 'AN26-0002-2026' }
];
const TROCA = { contratos: 2, demandas: 2, modelos: 0, modelos_sem_objeto: 0, contratos_com_duas_demandas: 0 };

async function escreverNomes(...nomes: string[]) {
  for (const [i, nome] of nomes.entries()) await userEvent.type(screen.getByRole('textbox', { name: `Nome novo (nome ${i + 1})` }), nome);
}
async function clicarSeparar() {
  await userEvent.click(screen.getByRole('button', { name: /Separar/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar: separar Marca e patente' }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  iniciarPreferencias({});
  vi.spyOn(SD, 'demandasDoObjeto').mockResolvedValue(DEMANDAS);
});

describe('Separar um objeto de contrato', () => {
  it('dado um objeto com demandas, quando o administrador escreve dois nomes e escolhe o objeto de cada demanda, então separa e avisa', async () => {
    // Dado
    const separar = vi.spyOn(SD, 'objetoSeparar').mockResolvedValue(TROCA);
    const aoTerminar = vi.fn();
    render(<Avisos><SepararObjeto objeto={JUNTOS} aoTerminar={aoTerminar} aoCancelar={vi.fn()} /></Avisos>);
    expect(screen.getByText(/Muda em 2 contratos e 2 demandas/)).toBeInTheDocument();
    // Quando
    await escreverNomes(' Registro de marca ', 'Patente');
    await userEvent.selectOptions(await screen.findByLabelText(/Marca e patente \(demanda D1, contrato AN26-0001-2026\)/), 'Registro de marca');
    await userEvent.selectOptions(screen.getByLabelText(/Registro do logotipo \(demanda D2/), 'Patente');
    await clicarSeparar();
    // Então
    expect(separar).toHaveBeenCalledWith('o1', ['Registro de marca', 'Patente'],
      [{ demanda: 'd1', objeto: 'Registro de marca' }, { demanda: 'd2', objeto: 'Patente' }]);
    expect(await screen.findByText('Objeto separado em "Registro de marca" e "Patente". Mudou em 2 contratos e 2 demandas.')).toBeInTheDocument();
    expect(aoTerminar).toHaveBeenCalled();
  });

  it('quando falta um nome ou a escolha de uma demanda, então a tela diz o que falta e nada é separado', async () => {
    // Dado
    const separar = vi.spyOn(SD, 'objetoSeparar');
    render(<SepararObjeto objeto={JUNTOS} aoTerminar={vi.fn()} aoCancelar={vi.fn()} />);
    await screen.findByLabelText(/Registro do logotipo/);
    // Quando: um nome só
    await escreverNomes('Registro de marca');
    await clicarSeparar();
    // Então
    expect(screen.getByText('Escreva ao menos dois nomes para separar.')).toBeInTheDocument();
    expect(screen.getAllByText('Escolha o objeto novo de cada demanda.')).toHaveLength(2);
    expect(separar).not.toHaveBeenCalled();
  });

  it('dado um objeto sem demandas, quando o administrador separa em três nomes, então não pergunta nada sobre demandas', async () => {
    // Dado: o banco confirma que o objeto não tem demandas
    const separar = vi.spyOn(SD, 'objetoSeparar').mockResolvedValue(TROCA);
    vi.spyOn(SD, 'demandasDoObjeto').mockResolvedValue([]);
    render(<SepararObjeto objeto={{ ...JUNTOS, demandas: 0 }} aoTerminar={vi.fn()} aoCancelar={vi.fn()} />);
    await screen.findByText(/Muda em 2 contratos e 0 demandas/);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar nome' }));
    await escreverNomes('Parecer', 'Consulta', 'Recurso');
    await clicarSeparar();
    // Então
    expect(screen.queryByRole('group', { name: 'A qual objeto novo cada demanda fica ligada?' })).toBeNull();
    expect(separar).toHaveBeenCalledWith('o1', ['Parecer', 'Consulta', 'Recurso'], []);
  });

  it('dado três nomes e uma demanda ligada ao terceiro, quando o administrador tira o segundo, então a demanda continua ligada ao mesmo nome', async () => {
    // Dado
    const separar = vi.spyOn(SD, 'objetoSeparar').mockResolvedValue(TROCA);
    vi.spyOn(SD, 'demandasDoObjeto').mockResolvedValue([DEMANDAS[0]]);
    render(<SepararObjeto objeto={JUNTOS} aoTerminar={vi.fn()} aoCancelar={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar nome' }));
    expect(screen.getByRole('textbox', { name: 'Nome novo (nome 3)' })).toHaveFocus();
    await escreverNomes('Registro de marca', 'Errado', 'Patente');
    await userEvent.selectOptions(await screen.findByLabelText(/Marca e patente \(demanda D1/), 'Patente');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o nome 2' }));
    await clicarSeparar();
    // Então
    expect(screen.getByLabelText(/Marca e patente \(demanda D1/)).toHaveDisplayValue('Patente');
    expect(separar).toHaveBeenCalledWith('o1', ['Registro de marca', 'Patente'], [{ demanda: 'd1', objeto: 'Patente' }]);
  });

  it('dado a lista dizendo que o objeto não tem demandas, quando a separação abre e o banco tem uma (criada depois), então a tela pergunta dela', async () => {
    // Dado: a contagem da lista é de antes da demanda nova
    vi.spyOn(SD, 'demandasDoObjeto').mockResolvedValue([DEMANDAS[0]]);
    // Quando
    render(<SepararObjeto objeto={{ ...JUNTOS, demandas: 0 }} aoTerminar={vi.fn()} aoCancelar={vi.fn()} />);
    // Então
    expect(await screen.findByLabelText(/Marca e patente \(demanda D1/)).toBeInTheDocument();
    expect(screen.getByText(/Muda em 2 contratos e 1 demanda:/)).toBeInTheDocument();
  });

  it('dado uma demanda criada depois que a separação abriu, quando o banco recusa por falta da escolha dela, então a tela busca de novo e pergunta dela', async () => {
    // Dado: ao abrir, o objeto tinha só a demanda D1; depois alguém criou a D2
    vi.spyOn(SD, 'demandasDoObjeto').mockResolvedValueOnce([DEMANDAS[0]]).mockResolvedValue(DEMANDAS);
    const separar = vi.spyOn(SD, 'objetoSeparar').mockRejectedValueOnce(new Error(SEM_OBJETO_DA_DEMANDA)).mockResolvedValue(TROCA);
    render(<Avisos><SepararObjeto objeto={JUNTOS} aoTerminar={vi.fn()} aoCancelar={vi.fn()} /></Avisos>);
    await escreverNomes('Registro de marca', 'Patente');
    await userEvent.selectOptions(await screen.findByLabelText(/Marca e patente \(demanda D1/), 'Registro de marca');
    // Quando
    await clicarSeparar();
    // Então: a demanda nova aparece, com o que falta
    const nova = await screen.findByLabelText(/Registro do logotipo \(demanda D2/);
    expect(nova).toHaveAccessibleDescription(SEM_OBJETO_DA_DEMANDA);
    // Quando: o administrador escolhe e separa de novo
    await userEvent.selectOptions(nova, 'Patente');
    await clicarSeparar();
    // Então
    expect(separar).toHaveBeenLastCalledWith('o1', ['Registro de marca', 'Patente'],
      [{ demanda: 'd1', objeto: 'Registro de marca' }, { demanda: 'd2', objeto: 'Patente' }]);
  });

  it('quando a busca das demandas falha, então a tela mostra o erro no lugar de "Carregando" e não separa', async () => {
    // Dado
    vi.spyOn(SD, 'demandasDoObjeto').mockRejectedValue(new Error('Sem conexão com o servidor.'));
    const separar = vi.spyOn(SD, 'objetoSeparar');
    // Quando
    render(<SepararObjeto objeto={JUNTOS} aoTerminar={vi.fn()} aoCancelar={vi.fn()} />);
    // Então
    expect(await screen.findByText(/Sem conexão com o servidor\./)).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    await escreverNomes('Registro de marca', 'Patente');
    await clicarSeparar();
    expect(separar).not.toHaveBeenCalled();
  });
});
