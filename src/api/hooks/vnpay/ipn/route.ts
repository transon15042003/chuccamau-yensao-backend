import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows";
import { Modules, PaymentActions } from "@medusajs/framework/utils";

/** VNPay IPN (GET or POST). Responds with VNPay-required JSON body. */
async function handle(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const payment = req.scope.resolve(Modules.PAYMENT);
  const data = {
    ...((req.query || {}) as Record<string, string>),
    ...((req.body || {}) as Record<string, string>),
  };

  try {
    const actionAndData = await payment.getWebhookActionAndData({
      provider: "vnpay_vnpay",
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

    res.status(200).json({ RspCode: "00", Message: "success" });
  } catch {
    res.status(200).json({ RspCode: "99", Message: "error" });
  }
}

export const GET = handle;
export const POST = handle;
