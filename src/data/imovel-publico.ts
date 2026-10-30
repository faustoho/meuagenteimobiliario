import type { Imovel } from './imoveis';

export type ImovelPublico = Omit<Imovel, 'area' | 'quartos' | 'banheiros' | 'vagas'> & {
  area: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
};
