import {
  defineMiddlewares,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";

async function assertCartInventory(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const cartId = req.params.id;
    if (!cartId) {
      return next();
    }

    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    logger.info(`inventory middleware hit for cart ${cartId}`);

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const inventory = req.scope.resolve(Modules.INVENTORY);
    const cartModule = req.scope.resolve(Modules.CART);

    const cart = await cartModule.retrieveCart(cartId, {
      relations: ["items"],
    });
    // Module retrieve can omit items under some scopes — list explicitly.
    const items =
      cart.items?.length
        ? cart.items
        : await cartModule.listLineItems({ cart_id: cartId });
    logger.info(
      `inventory middleware items=${items.length} sc=${cart.sales_channel_id}`
    );
    if (!items.length) {
      return next();
    }

    let locationIds: string[] = [];
    if (cart.sales_channel_id) {
      const { data: channels } = await query.graph({
        entity: "sales_channel",
        fields: ["id", "stock_locations.id"],
        filters: { id: cart.sales_channel_id },
      });
      locationIds = (channels?.[0]?.stock_locations ?? [])
        .map((l) => l?.id)
        .filter((id): id is string => Boolean(id));
    }
    if (!locationIds.length) {
      const stockLocation = req.scope.resolve(Modules.STOCK_LOCATION);
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
            manage_inventory?: boolean;
            allow_backorder?: boolean;
            inventory_items?: {
              inventory_item_id: string;
              required_quantity?: number;
            }[];
          }
        | undefined;

      if (!variant?.manage_inventory || variant.allow_backorder) continue;

      for (const inv of variant.inventory_items ?? []) {
        const required =
          Number(item.quantity) * Number(inv.required_quantity ?? 1);
        const ok = await inventory.confirmInventory(
          inv.inventory_item_id,
          locationIds,
          required
        );
        if (!ok) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            `Some variant does not have the required inventory`,
            MedusaError.Codes.INSUFFICIENT_INVENTORY
          );
        }
      }
    }

    return next();
  } catch (e) {
    return next(e);
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/carts/*/complete",
      methods: ["POST"],
      middlewares: [assertCartInventory],
    },
    {
      matcher: "/store/carts/:id/complete",
      methods: ["POST"],
      middlewares: [assertCartInventory],
    },
  ],
});
