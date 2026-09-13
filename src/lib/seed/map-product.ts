import type { SeedProduct } from "./types";

export type MapProductContext = {
  categoryIdByHandle: Map<string, string>;
  shippingProfileId: string;
  salesChannelId: string;
};

export type MedusaSeedProductInput = {
  title: string;
  handle: string;
  description: string;
  status: "published";
  shipping_profile_id: string;
  category_ids: string[];
  images: { url: string }[];
  options: { title: string; values: string[] }[];
  variants: {
    title: string;
    sku: string;
    options: Record<string, string>;
    prices: { amount: number; currency_code: "vnd" }[];
    manage_inventory?: boolean;
  }[];
  sales_channels: { id: string }[];
  metadata: Record<string, string | number | boolean>;
};

export function mapSeedProductToMedusaInput(
  product: SeedProduct,
  ctx: MapProductContext
): MedusaSeedProductInput {
  const category_ids = product.categories
    .map((handle) => ctx.categoryIdByHandle.get(handle))
    .filter((id): id is string => Boolean(id));
  if (!category_ids.length) {
    throw new Error(
      `No Medusa category ids for product handle=${product.slug} categories=${product.categories.join(",")}`
    );
  }

  const images: { url: string }[] = [];
  const metadata: Record<string, string | number | boolean> = {
    ingredient: JSON.stringify(product.ingredient ?? []),
  };
  if (typeof product.isNew === "boolean") metadata.isNew = product.isNew;
  if (typeof product.totalSold === "number") metadata.totalSold = product.totalSold;

  for (const variant of product.variants) {
    const url = variant.thumbnail || product.thumbnail;
    if (!url) continue;
    const existing = images.findIndex((i) => i.url === url);
    const rank =
      existing >= 0 ? existing + 1 : (images.push({ url }), images.length);
    metadata[variant.sku] = rank;
  }

  return {
    title: product.name,
    handle: product.slug,
    description: product.description ?? "",
    status: "published",
    shipping_profile_id: ctx.shippingProfileId,
    category_ids,
    images,
    options: product.specs.map((s) => ({ title: s.key, values: s.value })),
    variants: product.variants.map((v) => ({
      title: v.name,
      sku: v.sku,
      options: v.specs,
      manage_inventory: true,
      prices: [{ amount: v.price, currency_code: "vnd" }],
    })),
    sales_channels: [{ id: ctx.salesChannelId }],
    metadata,
  };
}
