export type SeedCategory = {
  id: string;
  name: string;
  slug: string;
};

export type SeedProductVariant = {
  sku: string;
  name: string;
  specs: Record<string, string>;
  price: number;
  stock?: number;
  isActive?: boolean;
  thumbnail?: string;
};

export type SeedProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  thumbnail: string;
  description: string;
  categories: string[];
  ingredient: string[];
  specs: { key: string; value: string[] }[];
  variants: SeedProductVariant[];
  isNew?: boolean;
  totalSold?: number;
  createdAt?: string;
};
