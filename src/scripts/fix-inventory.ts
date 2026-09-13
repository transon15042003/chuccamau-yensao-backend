import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows";

/** Backfill inventory_level for all inventory items at default stock location. */
export default async function fixInventory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION);

  const locations = await stockLocationModule.listStockLocations({}, { take: 5 });
  const location = locations[0];
  if (!location) throw new Error("No stock location");

  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const { data: existingLevels } = await query.graph({
    entity: "inventory_level",
    fields: ["id", "inventory_item_id", "location_id"],
  });
  const have = new Set(
    (existingLevels || []).map(
      (l: { inventory_item_id: string; location_id: string }) =>
        `${l.inventory_item_id}:${l.location_id}`
    )
  );

  const inventory_levels: CreateInventoryLevelInput[] = [];
  for (const item of items || []) {
    const key = `${item.id}:${location.id}`;
    if (have.has(key)) continue;
    inventory_levels.push({
      inventory_item_id: item.id,
      location_id: location.id,
      stocked_quantity: 100,
    });
  }

  if (!inventory_levels.length) {
    logger.info("No inventory levels to create");
    return;
  }

  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels },
  });
  logger.info(`Created ${inventory_levels.length} inventory levels at ${location.name}`);
}
