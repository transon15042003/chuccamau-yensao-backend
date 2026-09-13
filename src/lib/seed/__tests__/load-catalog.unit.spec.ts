import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadCatalog } from "../load-catalog";

describe("loadCatalog", () => {
  it("throws when a product is missing slug", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seed-"));
    fs.mkdirSync(path.join(dir, "products"));
    fs.writeFileSync(
      path.join(dir, "product-categories.json"),
      JSON.stringify([{ id: "c1", name: "A", slug: "a" }])
    );
    fs.writeFileSync(
      path.join(dir, "products", "bad.json"),
      JSON.stringify([
        {
          id: "p1",
          name: "No slug",
          description: "",
          thumbnail: "/x.jpg",
          categories: ["a"],
          ingredient: [],
          specs: [],
          variants: [{ sku: "s", name: "s", specs: {}, price: 1 }],
        },
      ])
    );
    expect(() => loadCatalog(dir)).toThrow(/slug/i);
  });
});
