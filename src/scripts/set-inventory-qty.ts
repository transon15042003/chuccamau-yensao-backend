import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

/** Usage: medusa exec ./src/scripts/set-inventory-qty.ts <inventory_item_id> <location_id> <qty> */
export default async function setInventoryQty({
  container,
  args,
}: ExecArgs & { args: string[] }) {
  const [inventoryItemId, locationId, qtyStr] = args ?? [];
  if (!inventoryItemId || !locationId || qtyStr === undefined) {
    throw new Error(
      "Usage: medusa exec ./src/scripts/set-inventory-qty.ts <inventory_item_id> <location_id> <qty>"
    );
  }
  const inventory = container.resolve(Modules.INVENTORY);
  await inventory.updateInventoryLevels([
    {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      stocked_quantity: Number(qtyStr),
    },
  ]);
  console.log(
    `set inventory_item=${inventoryItemId} location=${locationId} qty=${qtyStr}`
  );
}
