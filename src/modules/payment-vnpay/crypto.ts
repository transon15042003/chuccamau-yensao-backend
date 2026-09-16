import { createHmac } from "crypto";

export function sortAndSign(
  params: Record<string, string | number | undefined>,
  secret: string
): { query: string; secureHash: string } {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "" && k !== "vnp_SecureHash")
    .sort();
  const query = keys.map((k) => `${k}=${encodeURIComponent(String(params[k]))}`).join("&");
  const secureHash = createHmac("sha512", secret).update(query).digest("hex");
  return { query, secureHash };
}

export function verifyVnpayHash(
  params: Record<string, string>,
  secret: string
): boolean {
  const received = params.vnp_SecureHash || params.vnp_securehash;
  if (!received) return false;
  const copy = { ...params };
  delete copy.vnp_SecureHash;
  delete copy.vnp_SecureHashType;
  delete copy.vnp_securehash;
  delete copy.vnp_securehashtype;
  const { secureHash } = sortAndSign(copy, secret);
  return secureHash.toLowerCase() === received.toLowerCase();
}
