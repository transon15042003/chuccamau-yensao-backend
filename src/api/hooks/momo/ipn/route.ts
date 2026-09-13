import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows";
import { Modules, PaymentActions } from "@medusajs/framework/utils";

/** MoMo IPN (POST JSON). */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const payment = req.scope.resolve(Modules.PAYMENT);
  const data = (req.body || {}) as Record<string, unknown>;

  try {
    const actionAndData = await payment.getWebhookActionAndData({
      provider: "momo_momo",
      payload: {
        data,
        rawData: JSON.stringify(data),
        headers: req.headers as Record<string, string>,
      },
    });

    if (
      actionAndData.action === PaymentActions.AUTHORIZED ||
      actionAndData.action === PaymentActions.SUCCESSFUL ||
      actionAndData.action === PaymentActions.FAILED
    ) {
      await processPaymentWorkflow(req.scope).run({
        input: actionAndData as {
          action: PaymentActions;
          data: { session_id: string; amount: number };
        },
      });
    }

    res.status(204).send();
  } catch {
    res.status(400).json({ message: "ipn error" });
  }
}
