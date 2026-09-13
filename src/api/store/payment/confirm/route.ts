import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { completeCartWorkflow } from "@medusajs/medusa/core-flows";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";

type Body = {
  provider?: "vnpay" | "momo";
  session_id?: string;
  cart_id?: string;
  amount?: number;
  mock?: boolean;
};

/**
 * Confirm online payment then complete cart.
 * Used by PAYMENT_MOCK storefront page (and return handlers).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Body;
  const sessionId = body.session_id;
  const cartId = body.cart_id;
  if (!sessionId || !cartId) {
    res.status(400).json({ message: "session_id and cart_id required" });
    return;
  }

  const mockEnv =
    process.env.PAYMENT_MOCK === "1" || process.env.PAYMENT_MOCK === "true";
  if (body.mock && !mockEnv) {
    res.status(403).json({ message: "mock confirm disabled" });
    return;
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const payment = req.scope.resolve(Modules.PAYMENT);

  const session = await payment.retrievePaymentSession(sessionId);
  await payment.updatePaymentSession({
    id: sessionId,
    currency_code: session.currency_code,
    amount: session.amount,
    data: {
      ...(session.data || {}),
      authorized: true,
      mock: body.mock || undefined,
      provider: body.provider,
    },
  });

  try {
    await payment.authorizePaymentSession(sessionId, {});
  } catch (e) {
    logger.warn(`authorizePaymentSession: ${(e as Error).message}`);
  }

  try {
    const { result } = await completeCartWorkflow(req.scope).run({
      input: { id: cartId },
    });
    const order =
      (result as { id?: string; display_id?: number }) ||
      (result as { order?: { id?: string; display_id?: number } })?.order;
    res.status(200).json({
      ok: true,
      order_id: (result as { id?: string })?.id || order?.id,
      display_id:
        (result as { display_id?: number })?.display_id || order?.display_id,
    });
  } catch (e) {
    logger.error(`confirm complete failed: ${(e as Error).message}`);
    res.status(400).json({ message: (e as Error).message });
  }
}
