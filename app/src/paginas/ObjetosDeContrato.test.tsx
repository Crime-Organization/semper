// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A lista de objetos de contrato nas Configurações (#281): os números de uso, corrigir, juntar e apagar.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type ObjetoDoEscritorio } from '../dados';
import { Avisos } from '../ui/avisos';
import { iniciarPreferencias } from '../ui/preferencias';
import { ObjetosDeContrato } from './ObjetosDeContrato';

const objeto = (id: string, descricao: string, campos: Partial<ObjetoDoEscritorio> = {}): ObjetoDoEscritorio =>
  ({ id, descricao, contratos_ativos: 0, contratos_arquivados: 0, demandas: 0, ...campos });
const LISTA = [
  objeto('o1', 'Registro de marca', { contratos_ativos: 3, contratos_arquivados: 1, demandas: 2 }),
  objeto('o2', 'Registro da marca.', { contratos_ativos: 1, demandas: 1 }),
  objeto('o3', 'Parecer')
];
const SEM_TROCA = { contratos: 0, demandas: 0, modelos: 0, contratos_com_duas_demandas: 0 };
const linha = (nome: string) => screen.getByRole('row', { name: new RegExp(`^Marcar ${nome} para juntar`) });

beforeEach(() => {
  vi.restoreAllMocks();
  iniciarPreferencias({});
  vi.spyOn(SD, 'objetosDoEscritorio').mockResolvedValue(LISTA);
});

describe('Os objetos de contrato nas Configurações', () => {
  it('quando o administrador abre a lista, então vê os contratos (com os arquivados) e as demandas de cada objeto, e os parecidos marcados', async () => {
    // Dado / Quando
    render(<ObjetosDeContrato />);
    await screen.findByText('Registro de marca');
    // Então
    expect(within(linha('Registro de marca')).getByText('3 + 1 arquivado')).toBeInTheDocument();
    expect(within(linha('Registro de marca')).getByText('parecido')).toBeInTheDocument();
    expect(within(linha('Parecer')).queryByText('parecido')).toBeNull();
    // Quando: só os parecidos
    await userEvent.click(screen.getByLabelText('Só os parecidos'));
    // Então
    expect(screen.queryByText('Parecer')).toBeNull();
  });

  it('dado um objeto, quando o administrador corrige o nome, então grava o nome sem espaços nas pontas; o nome de outro objeto é recusado', async () => {
    // Dado
    const renomear = vi.spyOn(SD, 'objetoRenomear').mockResolvedValue({ ...SEM_TROCA, contratos: 1 });
    render(<ObjetosDeContrato />);
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir o objeto Parecer' }));
    const nome = screen.getByLabelText(/Nome do objeto/);
    // Quando
    await userEvent.clear(nome);
    await userEvent.type(nome, 'registro de MARCA');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));
    // Então
    expect(screen.getByText('Já existe um objeto com esse nome. Para unir os dois, marque-os e use Juntar.')).toBeInTheDocument();
    expect(renomear).not.toHaveBeenCalled();
    // Quando
    await userEvent.clear(nome);
    await userEvent.type(nome, ' Parecer jurídico ');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));
    // Então
    expect(renomear).toHaveBeenCalledWith('o3', 'Parecer jurídico');
  });

  it('dado um objeto em uso, quando o administrador tenta apagar, então o aviso diz em quantos contratos ele está e nada é apagado', async () => {
    // Dado
    const apagar = vi.spyOn(SD, 'objetoApagar');
    render(<Avisos><ObjetosDeContrato /></Avisos>);
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar o objeto Registro de marca' }));
    // Então
    expect(await screen.findByText('Este objeto está em 4 contratos. Troque-o por outro antes de apagar: marque os dois e use Juntar.')).toBeInTheDocument();
    expect(apagar).not.toHaveBeenCalled();
  });

  it('dado um objeto sem uso, quando o administrador confirma o apagar, então ele é apagado', async () => {
    // Dado
    const apagar = vi.spyOn(SD, 'objetoApagar').mockResolvedValue();
    render(<ObjetosDeContrato />);
    await screen.findByText('Parecer');
    // Quando
    await userEvent.click(within(linha('Parecer')).getByRole('button', { name: /Apagar/ }));
    await userEvent.click(within(linha('Parecer')).getByRole('button', { name: 'Confirmar: apagar Parecer' }));
    // Então
    expect(apagar).toHaveBeenCalledWith('o3');
  });

  it('dados dois objetos marcados, quando o administrador confirma juntar, então fica o mais usado (ou o escolhido)', async () => {
    // Dado
    const juntar = vi.spyOn(SD, 'objetosJuntar').mockResolvedValue({ ...SEM_TROCA, contratos: 1, demandas: 1 });
    render(<ObjetosDeContrato />);
    await userEvent.click(await screen.findByLabelText('Marcar Registro da marca. para juntar'));
    expect(screen.getByText('Marque outro objeto para juntar os dois.')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Marcar Registro de marca para juntar'));
    // Então: o mais usado já vem escolhido, e a tela diz o que vai mudar
    const juncao = screen.getByRole('group', { name: 'Juntar objetos' });
    expect(within(juncao).getByLabelText('Registro de marca')).toBeChecked();
    expect(within(juncao).getByText('Sai 1 objeto, usado em 1 contrato e 1 demanda. Ele passa a ter o nome do que fica. Não dá para desfazer.')).toBeInTheDocument();
    // Quando
    await userEvent.click(within(juncao).getByRole('button', { name: /Juntar 2 objetos/ }));
    await userEvent.click(within(juncao).getByRole('button', { name: 'Confirmar: juntar em Registro de marca' }));
    // Então
    expect(juntar).toHaveBeenCalledWith(['o2', 'o1'], 'o1');
  });
});
