export type Imovel = {
  id: string;
  titulo: string;
  cidade: string;
  bairro: string;
  tipo: 'Apartamento' | 'Casa' | 'Sobrado' | 'Terreno' | 'Comercial' | 'Outro';
  finalidade: 'Venda' | 'Locação';
  preco: number;
  area: number;
  quartos?: number;
  banheiros?: number;
  vagas?: number;
  imagens: string[];
  descricao?: string;
  referencia?: string;
  urlOrigem?: string;
};

// Cadastre aqui somente imóveis reais com autorização de divulgação.
// Fotografias locais devem ficar em public/imoveis/ e usar caminhos como /imoveis/foto.webp.
// Links de portais podem ser registrados em urlOrigem, sem copiar fotos ou anúncios sem permissão.
export const imoveis: Imovel[] = [
  {
    id: 'msn-11472745',
    titulo: 'Casa com piscina à venda em Florianópolis',
    cidade: 'Florianópolis',
    bairro: 'Bairro não informado',
    tipo: 'Casa',
    finalidade: 'Venda',
    preco: 4500000,
    area: 530,
    quartos: 7,
    banheiros: 7,
    vagas: 2,
    imagens: [],
    descricao: 'Casa à venda em Florianópolis/SC, com 530 m² de área total, 7 dormitórios, 7 banheiros e 2 vagas de garagem. Consulte o anúncio original para mais informações.',
    referencia: '11472745',
    urlOrigem: 'https://www.msnimoveis.com.br/imovel/venda/casa-em-florianopolis-sc-11472745'
  }
];
