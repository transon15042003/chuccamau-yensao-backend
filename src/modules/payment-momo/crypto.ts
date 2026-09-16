import { createHmac } from "crypto";

/** MoMo create/confirm signature over `|`-joined fields in fixed order. */
export function momoSign(raw: string, secretKey: string): string {
  return createHmac("sha256", secretKey).update(raw).digest("hex");
}

export function buildMomoCreateSignature(input: {
  accessKey: string;
  amount: string;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
  secretKey: string;
}): string {
  const raw =
    `accessKey=${input.accessKey}` +
    `&amount=${input.amount}` +
    `&extraData=${input.extraData}` +
    `&ipnUrl=${input.ipnUrl}` +
    `&orderId=${input.orderId}` +
    `&orderInfo=${input.orderInfo}` +
    `&partnerCode=${input.partnerCode}` +
    `&redirectUrl=${input.redirectUrl}` +
    `&requestId=${input.requestId}` +
    `&requestType=${input.requestType}`;
  return momoSign(raw, input.secretKey);
}

export function verifyMomoIpnSignature(
  body: Record<string, unknown>,
  accessKey: string,
  secretKey: string
): boolean {
  const raw =
    `accessKey=${accessKey}` +
    `&amount=${body.amount ?? ""}` +
    `&extraData=${body.extraData ?? ""}` +
    `&message=${body.message ?? ""}` +
    `&orderId=${body.orderId ?? ""}` +
    `&orderInfo=${body.orderInfo ?? ""}` +
    `&orderType=${body.orderType ?? ""}` +
    `&partnerCode=${body.partnerCode ?? ""}` +
    `&payType=${body.payType ?? ""}` +
    `&requestId=${body.requestId ?? ""}` +
    `&responseTime=${body.responseTime ?? ""}` +
    `&resultCode=${body.resultCode ?? ""}` +
    `&transId=${body.transId ?? ""}`;
  const expected = momoSign(raw, secretKey);
  return expected === String(body.signature || "");
}
