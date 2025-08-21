export type CoffeeType = 'hot' | 'iced';
export type CoffeeCard = {
  id: number;
  title: string;
  description: string;
  ingredients: string[];
  image: string; // URL из источника
};
