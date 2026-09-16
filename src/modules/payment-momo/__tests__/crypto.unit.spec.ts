import { buildMomoCreateSignature, verifyMomoIpnSignature } from "../crypto";

describe("momo crypto", () => {
  it("builds create signature deterministically", () => {
    const sig = buildMomoCreateSignature({
      accessKey: "access",
      amount: "1000",
      extraData: "",
      ipnUrl: "http://localhost/ipn",
      orderId: "ord1",
      orderInfo: "info",
      partnerCode: "partner",
      redirectUrl: "http://localhost/return",
      requestId: "req1",
      requestType: "payWithMethod",
      secretKey: "secret",
    });
    expect(sig).toHaveLength(64);
    expect(
      buildMomoCreateSignature({
        accessKey: "access",
        amount: "1000",
        extraData: "",
        ipnUrl: "http://localhost/ipn",
        orderId: "ord1",
        orderInfo: "info",
        partnerCode: "partner",
        redirectUrl: "http://localhost/return",
        requestId: "req1",
        requestType: "payWithMethod",
        secretKey: "secret",
      })
    ).toBe(sig);
  });

  it("rejects bad ipn signature", () => {
    expect(
      verifyMomoIpnSignature(
        { amount: "1", orderId: "o", signature: "x", resultCode: 0 },
        "access",
        "secret"
      )
    ).toBe(false);
  });
});
