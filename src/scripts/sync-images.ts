import * as fs from "fs";
import * as path from "path";
import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import { loadCatalog } from "../lib/seed/load-catalog";

/**
 * Upload product images from storefront public/ into Medusa file-local,
 * then point product.images at /static/... URLs.
 *
 * Env:
 *   STOREFRONT_PUBLIC_DIR — default ../chuccamau-yensao/public
 */
export default async function syncImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModule = container.resolve(Modules.PRODUCT);
  const fileModule = container.resolve(Modules.FILE);

  const publicDir =
    process.env.STOREFRONT_PUBLIC_DIR ||
    path.resolve(process.cwd(), "..", "chuccamau-yensao", "public");

  if (!fs.existsSync(publicDir)) {
    throw new Error(
      `STOREFRONT_PUBLIC_DIR not found: ${publicDir}. Set env to storefront public folder.`
    );
  }

  const { products } = loadCatalog(path.join(process.cwd(), "seed", "data"));
  let uploaded = 0;
  let skipped = 0;

  for (const product of products) {
    const existing = await productModule.listProducts(
      { handle: product.slug },
      { take: 1 }
    );
    if (!existing[0]) {
      skipped++;
      continue;
    }

    const relUrls = new Set<string>();
    if (product.thumbnail) relUrls.add(product.thumbnail);
    for (const v of product.variants) {
      if (v.thumbnail) relUrls.add(v.thumbnail);
    }

    const imageRows: { url: string }[] = [];
    const urlByRel = new Map<string, string>();

    for (const rel of relUrls) {
      const diskPath = path.join(
        publicDir,
        rel.replace(/^\//, "").replace(/\//g, path.sep)
      );
      if (!fs.existsSync(diskPath)) {
        logger.warn(`Missing file ${diskPath}`);
        continue;
      }
      const buf = fs.readFileSync(diskPath);
      const filename = `products/${product.slug}/${path.basename(diskPath)}`;
      const [created] = await fileModule.createFiles([
        {
          filename,
          mimeType: diskPath.endsWith(".png")
            ? "image/png"
            : diskPath.endsWith(".webp")
              ? "image/webp"
              : "image/jpeg",
          content: buf.toString("binary"),
          access: "public",
        },
      ]);
      urlByRel.set(rel, created.url);
      imageRows.push({ url: created.url });
      uploaded++;
    }

    if (!imageRows.length) continue;

    // Rebuild SKU → image rank metadata
    const metadata: Record<string, string | number | boolean> = {
      ...(existing[0].metadata || {}),
    };
    for (const v of product.variants) {
      const raw = v.thumbnail || product.thumbnail;
      if (!raw || !urlByRel.has(raw)) continue;
      const abs = urlByRel.get(raw)!;
      const rank = imageRows.findIndex((i) => i.url === abs) + 1;
      if (rank > 0) metadata[v.sku] = rank;
    }

    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: existing[0].id,
            images: imageRows,
            metadata,
          },
        ],
      },
    });
    logger.info(`Images synced for ${product.slug} (${imageRows.length})`);
  }

  logger.info(`sync:images done uploaded=${uploaded} skipped_products=${skipped}`);
}
