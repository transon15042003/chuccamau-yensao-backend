import { sortAndSign, verifyVnpayHash } from "../crypto";

describe("vnpay crypto", () => {
  it("signs and verifies", () => {
    const secret = "secret";
    const params = {
      vnp_Amount: "1000000",
      vnp_TxnRef: "payses_test",
      vnp_ResponseCode: "00",
    };
    const { secureHash } = sortAndSign(params, secret);
    expect(
      verifyVnpayHash({ ...params, vnp_SecureHash: secureHash }, secret)
    ).toBe(true);
    expect(
      verifyVnpayHash({ ...params, vnp_SecureHash: "bad" }, secret)
    ).toBe(false);
  });
});
