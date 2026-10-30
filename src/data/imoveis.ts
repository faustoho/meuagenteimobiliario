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
export const imoveis: Imovel[] = [];
