import * as fs from "fs";
import * as path from "path";
import type { SeedCategory, SeedProduct } from "./types";

export function loadCatalog(seedDataDir: string): {
  categories: SeedCategory[];
  products: SeedProduct[];
} {
  const categoriesPath = path.join(seedDataDir, "product-categories.json");
  if (!fs.existsSync(categoriesPath)) {
    throw new Error(`Missing categories file: ${categoriesPath}`);
  }
  const categories = JSON.parse(
    fs.readFileSync(categoriesPath, "utf8")
  ) as SeedCategory[];
  for (const c of categories) {
    if (!c.slug || !c.name) {
      throw new Error(`Invalid category (need name+slug): ${JSON.stringify(c)}`);
    }
  }

  const productsDir = path.join(seedDataDir, "products");
  const files = fs.readdirSync(productsDir).filter((f) => f.endsWith(".json"));
  const products: SeedProduct[] = [];
  for (const file of files) {
    const full = path.join(productsDir, file);
    const batch = JSON.parse(fs.readFileSync(full, "utf8")) as SeedProduct[];
    for (const p of batch) {
      if (!p.slug) {
        throw new Error(`Product missing slug in ${file}: id=${p.id}`);
      }
      if (!p.variants?.length) {
        throw new Error(`Product missing variants in ${file}: handle=${p.slug}`);
      }
      products.push(p);
    }
  }
  return { categories, products };
}
