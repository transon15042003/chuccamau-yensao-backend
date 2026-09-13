import { buildOrderMails } from "../order-mail-templates";

describe("order mail templates", () => {
  it("builds vietnamese html and text", () => {
    const mails = buildOrderMails({
      id: "order_1",
      display_id: 42,
      email: "khach@example.com",
      total: 150000,
      metadata: { payment_method: "COD", note: "Giao sáng" },
      shipping_address: {
        first_name: "An",
        last_name: "Nguyen",
        phone: "090",
        address_1: "1 Duong",
        city: "Ca Mau",
        province: "Ca Mau",
      },
      items: [
        {
          id: "i1",
          title: "Yen",
          quantity: 2,
          unit_price: 75000,
        },
      ],
    } as never);

    expect(mails.subjectOwner).toContain("#42");
    expect(mails.subjectCustomer).toContain("#42");
    expect(mails.textOwner).toContain("Giao sáng");
    expect(mails.textCustomer).toContain("Xin chào An Nguyen");
    expect(mails.htmlOwner).toContain("Đơn hàng mới");
    expect(mails.htmlCustomer).toContain("Xác nhận đơn hàng");
  });
});
