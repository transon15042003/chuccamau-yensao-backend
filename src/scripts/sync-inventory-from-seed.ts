import * as path from "path";
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { loadCatalog } from "../lib/seed/load-catalog";

/**
 * Set inventory_level.stocked_quantity from seed JSON variant.stock by SKU.
 * Variants missing stock → 0.
 */
export default async function syncInventoryFromSeed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const inventoryModule = container.resolve(Modules.INVENTORY);

  const { products } = loadCatalog(path.join(process.cwd(), "seed", "data"));
  const stockBySku = new Map<string, number>();
  for (const p of products) {
    for (const v of p.variants) {
      stockBySku.set(v.sku, typeof v.stock === "number" ? v.stock : 0);
    }
  }

  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id", "sku", "inventory_items.inventory_item_id"],
  });

  let updated = 0;
  let skipped = 0;

  for (const variant of variants || []) {
    const sku = variant.sku as string | undefined;
    if (!sku || !stockBySku.has(sku)) {
      skipped++;
      continue;
    }
    const qty = stockBySku.get(sku)!;
    const invItemId = (
      variant as {
        inventory_items?: { inventory_item_id: string }[];
      }
    ).inventory_items?.[0]?.inventory_item_id;
    if (!invItemId) {
      logger.warn(`No inventory item for sku=${sku}`);
      continue;
    }

    const { data: levels } = await query.graph({
      entity: "inventory_level",
      fields: ["id", "location_id", "stocked_quantity"],
      filters: { inventory_item_id: invItemId },
    });

    for (const level of levels || []) {
      await inventoryModule.updateInventoryLevels([
        {
          inventory_item_id: invItemId,
          location_id: level.location_id,
          stocked_quantity: qty,
        },
      ]);
      updated++;
    }
  }

  logger.info(
    `Inventory sync done: updated_levels=${updated} skipped_variants=${skipped} skus_in_seed=${stockBySku.size}`
  );
}
