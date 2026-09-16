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
import { sortAndSign, verifyVnpayHash } from "./crypto";

type Options = {
  tmnCode?: string;
  hashSecret?: string;
  url?: string;
  returnUrl?: string;
  ipnUrl?: string;
  mock?: boolean | string;
  storeUrl?: string;
};

function toVnd(amount: InitiatePaymentInput["amount"]): number {
  if (typeof amount === "object" && amount && "numeric_" in amount) {
    return Math.round(Number((amount as Record<string, unknown>).numeric_));
  }
  return Math.round(Number(amount));
}

class VnpayProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "vnpay";

  protected options_: Options;

  constructor(container: Record<string, unknown>, options: Options) {
    // @ts-expect-error AbstractPaymentProvider ctor typing
    super(...arguments);
    this.options_ = options || {};
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const medusaSessionId = String(input.data?.session_id || "");
    const sessionId =
      medusaSessionId ||
      `vnp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const amountVnd = toVnd(input.amount);
    const context = (input.context || {}) as Record<string, unknown>;
    const cartId = String(
      input.data?.cart_id || context.cart_id || context.resource_id || ""
    );

    if (this.isMock()) {
      const store = this.options_.storeUrl || "http://localhost:3000";
      const payUrl =
        `${store}/payment/mock?provider=vnpay` +
        `&session_id=${encodeURIComponent(sessionId)}` +
        `&amount=${amountVnd}` +
        (cartId ? `&cart_id=${encodeURIComponent(cartId)}` : "");
      return {
        id: sessionId,
        data: {
          payUrl,
          session_id: sessionId,
          amount: amountVnd,
          provider: "vnpay",
          mock: true,
        },
      };
    }

    const tmnCode = this.options_.tmnCode;
    const hashSecret = this.options_.hashSecret;
    const payHost =
      this.options_.url || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const returnUrl = this.options_.returnUrl;
    if (!tmnCode || !hashSecret || !returnUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "VNPay missing tmnCode/hashSecret/returnUrl (or set PAYMENT_MOCK=1)"
      );
    }

    const createDate = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);
    const params: Record<string, string | number> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Amount: amountVnd * 100,
      vnp_CurrCode: "VND",
      vnp_TxnRef: sessionId,
      vnp_OrderInfo: `Thanh toan ${sessionId}`,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: String(context.ip_address || "127.0.0.1"),
      vnp_CreateDate: createDate,
    };
    const { query, secureHash } = sortAndSign(params, hashSecret);
    const payUrl = `${payHost}?${query}&vnp_SecureHash=${secureHash}`;

    return {
      id: sessionId,
      data: {
        payUrl,
        session_id: sessionId,
        amount: amountVnd,
        provider: "vnpay",
      },
    };
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const data = (input.data || {}) as Record<string, unknown>;
    if (data.authorized === true || data.vnp_ResponseCode === "00") {
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
    if (data.authorized === true || data.vnp_ResponseCode === "00") {
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
    const raw = (payload.data || {}) as Record<string, string>;
    const amountVnd = Math.round(Number(raw.vnp_Amount || 0) / 100);
    const sessionId = String(raw.session_id || raw.vnp_TxnRef || "");

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
      const secret = this.options_.hashSecret || "";
      if (!verifyVnpayHash(raw, secret)) {
        return { action: PaymentActions.NOT_SUPPORTED };
      }
    }

    if (raw.vnp_ResponseCode === "00" && sessionId) {
      return {
        action: PaymentActions.AUTHORIZED,
        data: { session_id: sessionId, amount: amountVnd },
      };
    }
    if (sessionId) {
      return {
        action: PaymentActions.FAILED,
        data: { session_id: sessionId, amount: amountVnd },
      };
    }
    return { action: PaymentActions.NOT_SUPPORTED };
  }

  protected isMock(): boolean {
    const m = this.options_.mock;
    return m === true || m === "1" || m === "true";
  }
}

export default VnpayProviderService;
