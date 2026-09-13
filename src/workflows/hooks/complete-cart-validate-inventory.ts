import { completeCartWorkflow } from "@medusajs/medusa/core-flows";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";

/**
 * Phase 1: Block cart completion when stock is insufficient.
 * Reloads cart with items — hook payload may omit nested line items.
 */
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const inventory = container.resolve(Modules.INVENTORY);
  const cartModule = container.resolve(Modules.CART);

  const cartId = cart?.id;
  if (!cartId) return;

  const fullCart = await cartModule.retrieveCart(cartId, {
    relations: ["items"],
  });
  const items =
    fullCart?.items?.length
      ? fullCart.items
      : cart?.items?.length
        ? cart.items
        : await cartModule.listLineItems({ cart_id: cartId });
  if (!items.length) {
    logger.warn(`complete-cart inventory hook: no items on cart ${cartId}`);
    return;
  }

  let locationIds: string[] = [];
  const salesChannelId = fullCart.sales_channel_id || cart.sales_channel_id;
  if (salesChannelId) {
    const { data: channels } = await query.graph({
      entity: "sales_channel",
      fields: ["id", "stock_locations.id"],
      filters: { id: salesChannelId },
    });
    locationIds = (channels?.[0]?.stock_locations ?? [])
      .map((l: { id: string }) => l.id)
      .filter(Boolean);
  }

  if (!locationIds.length) {
    const stockLocation = container.resolve(Modules.STOCK_LOCATION);
    const locs = await stockLocation.listStockLocations({}, { take: 20 });
    locationIds = locs.map((l: { id: string }) => l.id);
  }

  for (const item of items) {
    if (!item.variant_id || !item.quantity) continue;

    const { data: variants } = await query.graph({
      entity: "variant",
      fields: [
        "id",
        "sku",
        "manage_inventory",
        "allow_backorder",
        "inventory_items.inventory_item_id",
        "inventory_items.required_quantity",
      ],
      filters: { id: item.variant_id },
    });

    const variant = variants?.[0] as
      | {
          sku?: string;
          manage_inventory?: boolean;
          allow_backorder?: boolean;
          inventory_items?: {
            inventory_item_id: string;
            required_quantity?: number;
          }[];
        }
      | undefined;

    if (!variant?.manage_inventory || variant.allow_backorder) continue;

    const invItems = variant.inventory_items ?? [];
    if (!invItems.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Variant ${item.variant_id} does not have any inventory items associated with it.`
      );
    }

    for (const inv of invItems) {
      const required =
        Number(item.quantity) * Number(inv.required_quantity ?? 1);
      const ok = await inventory.confirmInventory(
        inv.inventory_item_id,
        locationIds,
        required
      );
      if (!ok) {
        logger.info(
          `Inventory blocked complete: sku=${variant.sku} qty=${required}`
        );
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Some variant does not have the required inventory`,
          MedusaError.Codes.INSUFFICIENT_INVENTORY
        );
      }
    }
  }
});
