import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils";
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";
import { buildMomoCreateSignature, verifyMomoIpnSignature } from "./crypto";

type Options = {
  partnerCode?: string;
  accessKey?: string;
  secretKey?: string;
  url?: string;
  redirectUrl?: string;
  ipnUrl?: string;
  mock?: boolean | string;
  storeUrl?: string;
};

function toVnd(amount: InitiatePaymentInput["amount"]): number {
  const n =
    typeof amount === "object" && amount && "numeric_" in amount
      ? Number((amount as { numeric_: number }).numeric_)
      : Number(amount);
  return Math.round(n);
}

class MomoProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "momo";

  protected options_: Options;

  constructor(container: Record<string, unknown>, options: Options) {
    // @ts-expect-error AbstractPaymentProvider ctor typing
    super(...arguments);
    this.options_ = options || {};
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const medusaSessionId = String(input.data?.session_id || "");
    const sessionId =
      medusaSessionId ||
      `momo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const amountVnd = toVnd(input.amount);
    const context = (input.context || {}) as Record<string, unknown>;
    const cartId = String(
      input.data?.cart_id || context.cart_id || context.resource_id || ""
    );

    if (this.isMock()) {
      const store = this.options_.storeUrl || "http://localhost:3000";
      const payUrl =
        `${store}/payment/mock?provider=momo` +
        `&session_id=${encodeURIComponent(sessionId)}` +
        `&amount=${amountVnd}` +
        (cartId ? `&cart_id=${encodeURIComponent(cartId)}` : "");
      return {
        id: sessionId,
        data: {
          payUrl,
          session_id: sessionId,
          amount: amountVnd,
          provider: "momo",
          mock: true,
        },
      };
    }

    const { partnerCode, accessKey, secretKey, redirectUrl, ipnUrl } =
      this.options_;
    const apiUrl =
      this.options_.url ||
      "https://test-payment.momo.vn/v2/gateway/api/create";
    if (!partnerCode || !accessKey || !secretKey || !redirectUrl || !ipnUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "MoMo missing partner/access/secret/redirect/ipn (or set PAYMENT_MOCK=1)"
      );
    }

    const requestType = "payWithMethod";
    const orderInfo = `Thanh toan ${sessionId}`;
    const extraData = "";
    const requestId = sessionId;
    const orderId = sessionId;
    const amount = String(amountVnd);
    const signature = buildMomoCreateSignature({
      accessKey,
      amount,
      extraData,
      ipnUrl,
      orderId,
      orderInfo,
      partnerCode,
      redirectUrl,
      requestId,
      requestType,
      secretKey,
    });

    const body = {
      partnerCode,
      partnerName: "Chuc Ca Mau Yen Sao",
      storeId: "chuccamau",
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: "vi",
      requestType,
      autoCapture: true,
      extraData,
      signature,
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      resultCode?: number;
      payUrl?: string;
      message?: string;
    };
    if (!res.ok || json.resultCode !== 0 || !json.payUrl) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `MoMo create failed: ${json.message || res.status}`
      );
    }

    return {
      id: sessionId,
      data: {
        payUrl: json.payUrl,
        session_id: sessionId,
        amount: amountVnd,
        provider: "momo",
      },
    };
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const data = (input.data || {}) as Record<string, unknown>;
    if (data.authorized === true || Number(data.resultCode) === 0) {
      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: { ...data, authorized: true },
      };
    }
    return {
      status: PaymentSessionStatus.REQUIRES_MORE,
      data,
    };
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const data = (input.data || {}) as Record<string, unknown>;
    if (data.authorized === true || Number(data.resultCode) === 0) {
      return { status: PaymentSessionStatus.AUTHORIZED };
    }
    return { status: PaymentSessionStatus.PENDING };
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: input.data || {} };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data || {} };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data || {} };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return { data: input.data || {} };
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    return { data: input.data || {} };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data || {} };
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const raw = (payload.data || {}) as Record<string, unknown>;

    if (this.isMock() && raw.mock === "1" && raw.session_id) {
      return {
        action: PaymentActions.AUTHORIZED,
        data: {
          session_id: String(raw.session_id),
          amount: Number(raw.amount || 0),
        },
      };
    }

    if (!this.isMock()) {
      const ok = verifyMomoIpnSignature(
        raw,
        this.options_.accessKey || "",
        this.options_.secretKey || ""
      );
      if (!ok) {
        return { action: PaymentActions.NOT_SUPPORTED };
      }
    }

    const sessionId = String(raw.orderId || raw.session_id || "");
    const amount = Number(raw.amount || 0);
    if (Number(raw.resultCode) === 0 && sessionId) {
      return {
        action: PaymentActions.AUTHORIZED,
        data: { session_id: sessionId, amount },
      };
    }
    if (sessionId) {
      return {
        action: PaymentActions.FAILED,
        data: { session_id: sessionId, amount },
      };
    }
    return { action: PaymentActions.NOT_SUPPORTED };
  }

  protected isMock(): boolean {
    const m = this.options_.mock;
    return m === true || m === "1" || m === "true";
  }
}

export default MomoProviderService;
