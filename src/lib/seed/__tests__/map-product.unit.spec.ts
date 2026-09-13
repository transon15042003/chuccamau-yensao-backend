import { mapSeedProductToMedusaInput } from "../map-product";
import type { SeedProduct } from "../types";

const sample: SeedProduct = {
  id: "chan-yen-tho",
  name: "Chân Yến Thô",
  slug: "chan-yen-tho",
  price: 450000,
  thumbnail: "/images/products/yen-sao-tho/chan-yen-tho-100g.jpg",
  description: "Chân yến thô",
  categories: ["yen-sao-tho"],
  ingredient: ["Nguyên chất 100%"],
  specs: [
    { key: "size", value: ["25g", "50g"] },
    { key: "savour", value: ["chân yến thô"] },
  ],
  variants: [
    {
      sku: "chan-tho-25g",
      name: "Chân yến thô - 25 gram",
      specs: { size: "25g", savour: "chân yến thô" },
      price: 450000,
      stock: 112,
      thumbnail: "/images/products/yen-sao-tho/chan-yen-tho-25g.jpg",
    },
    {
      sku: "chan-tho-50g",
      name: "Chân yến thô - 50 gram",
      specs: { size: "50g", savour: "chân yến thô" },
      price: 900000,
      stock: 45,
      thumbnail: "/images/products/yen-sao-tho/chan-yen-tho-50g.jpg",
    },
  ],
  isNew: false,
  totalSold: 201,
};

describe("mapSeedProductToMedusaInput", () => {
  it("maps handle, VND prices, options, images, and sku metadata ranks", () => {
    const out = mapSeedProductToMedusaInput(sample, {
      categoryIdByHandle: new Map([["yen-sao-tho", "cat_123"]]),
      shippingProfileId: "sp_1",
      salesChannelId: "sc_1",
    });
    expect(out.handle).toBe("chan-yen-tho");
    expect(out.title).toBe("Chân Yến Thô");
    expect(out.category_ids).toEqual(["cat_123"]);
    expect(out.metadata).toMatchObject({
      ingredient: JSON.stringify(["Nguyên chất 100%"]),
      isNew: false,
      totalSold: 201,
      "chan-tho-25g": 1,
      "chan-tho-50g": 2,
    });
    expect(out.images?.map((i) => i.url)).toEqual([
      "/images/products/yen-sao-tho/chan-yen-tho-25g.jpg",
      "/images/products/yen-sao-tho/chan-yen-tho-50g.jpg",
    ]);
    expect(out.options).toEqual([
      { title: "size", values: ["25g", "50g"] },
      { title: "savour", values: ["chân yến thô"] },
    ]);
    expect(out.variants?.[0]).toMatchObject({
      sku: "chan-tho-25g",
      options: { size: "25g", savour: "chân yến thô" },
      prices: [{ amount: 450000, currency_code: "vnd" }],
    });
  });

  it("absolutizes image urls when storePublicUrl set", () => {
    const out = mapSeedProductToMedusaInput(sample, {
      categoryIdByHandle: new Map([["yen-sao-tho", "cat_123"]]),
      shippingProfileId: "sp_1",
      salesChannelId: "sc_1",
      storePublicUrl: "http://localhost:3000",
    });
    expect(out.images?.[0]?.url).toBe(
      "http://localhost:3000/images/products/yen-sao-tho/chan-yen-tho-25g.jpg"
    );
  });
});
