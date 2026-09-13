import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const paymentMock =
  process.env.PAYMENT_MOCK === "1" || process.env.PAYMENT_MOCK === "true";

const paymentProviders = [
  {
    resolve: "./src/modules/payment-vnpay",
    id: "vnpay",
    options: {
      tmnCode: process.env.VNPAY_TMN_CODE,
      hashSecret: process.env.VNPAY_HASH_SECRET,
      url:
        process.env.VNPAY_URL ||
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      returnUrl: process.env.VNPAY_RETURN_URL,
      ipnUrl: process.env.VNPAY_IPN_URL,
      mock: paymentMock,
      storeUrl: process.env.STORE_URL || "http://localhost:3000",
    },
  },
  {
    resolve: "./src/modules/payment-momo",
    id: "momo",
    options: {
      partnerCode: process.env.MOMO_PARTNER_CODE,
      accessKey: process.env.MOMO_ACCESS_KEY,
      secretKey: process.env.MOMO_SECRET_KEY,
      url:
        process.env.MOMO_URL ||
        "https://test-payment.momo.vn/v2/gateway/api/create",
      redirectUrl: process.env.MOMO_REDIRECT_URL,
      ipnUrl: process.env.MOMO_IPN_URL,
      mock: paymentMock,
      storeUrl: process.env.STORE_URL || "http://localhost:3000",
    },
  },
];

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: paymentProviders,
      },
    },
  ],
});
