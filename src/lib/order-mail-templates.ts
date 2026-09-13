import type { OrderDTO } from "@medusajs/framework/types";

type MailParts = {
  subjectOwner: string;
  subjectCustomer: string;
  htmlOwner: string;
  htmlCustomer: string;
  textOwner: string;
  textCustomer: string;
};

function money(n: number): string {
  return `${Math.round(n).toLocaleString("vi-VN")} VND`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOrderMails(order: OrderDTO & { display_id?: number }): MailParts {
  const code = String(order.display_id ?? order.id);
  const name = [
    order.shipping_address?.first_name,
    order.shipping_address?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || "Khách hàng";
  const phone = order.shipping_address?.phone || "";
  const email = order.email || "";
  const address = [
    order.shipping_address?.address_1,
    order.shipping_address?.city,
    order.shipping_address?.province,
  ]
    .filter(Boolean)
    .join(", ");
  const items = (order.items || [])
    .map(
      (i) =>
        `- ${i.title || i.variant_sku || i.id} x${i.quantity} (${money(Number(i.unit_price || 0) * Number(i.quantity || 0))})`
    )
    .join("\n");
  const total = Number(order.total ?? 0);
  const pay = String((order.metadata as Record<string, string> | null)?.payment_method || "");
  const note = String((order.metadata as Record<string, string> | null)?.note || "");

  const textOwner =
    `Đơn hàng mới #${code}\n` +
    `Khách: ${name}\nSĐT: ${phone}\nEmail: ${email}\n` +
    `Địa chỉ: ${address}\n` +
    `Thanh toán: ${pay || "—"}\n` +
    `Ghi chú: ${note || "—"}\n\n` +
    `Sản phẩm:\n${items || "(không có dòng)"}\n\n` +
    `Tổng: ${money(total)}\n`;

  const textCustomer =
    `Xin chào ${name},\n\n` +
    `Đơn hàng #${code} đã được ghi nhận.\n` +
    `Chúng tôi sẽ liên hệ sớm để xác nhận giao hàng.\n\n` +
    `Sản phẩm:\n${items || "(không có dòng)"}\n\n` +
    `Tổng: ${money(total)}\n` +
    `Cảm ơn bạn đã mua hàng tại Chúc Cà Mau Yến Sào.\n`;

  const htmlShell = (title: string, body: string) =>
    `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222">` +
    `<div style="max-width:560px;margin:0 auto;border:1px solid #eee">` +
    `<div style="background:#B4071A;color:#fff;padding:16px 20px;font-size:18px">${esc(title)}</div>` +
    `<div style="padding:20px;line-height:1.5">${body}</div>` +
    `<div style="padding:12px 20px;font-size:12px;color:#666;border-top:1px solid #eee">Chúc Cà Mau Yến Sào</div>` +
    `</div></body></html>`;

  const detailHtml =
    `<p><b>Mã đơn:</b> ${esc(code)}</p>` +
    `<p><b>Khách:</b> ${esc(name)}<br/>` +
    `<b>SĐT:</b> ${esc(phone)}<br/>` +
    `<b>Email:</b> ${esc(email)}<br/>` +
    `<b>Địa chỉ:</b> ${esc(address)}</p>` +
    `<p><b>Thanh toán:</b> ${esc(pay || "—")}<br/>` +
    `<b>Ghi chú:</b> ${esc(note || "—")}</p>` +
    `<pre style="white-space:pre-wrap;background:#f7f7f7;padding:12px">${esc(items || "(không có dòng)")}</pre>` +
    `<p><b>Tổng:</b> ${esc(money(total))}</p>`;

  return {
    subjectOwner: `[Chúc Cà Mau] Đơn hàng mới từ ${name} – #${code}`,
    subjectCustomer: `[Chúc Cà Mau] Đơn hàng #${code} đã được ghi nhận`,
    htmlOwner: htmlShell("Đơn hàng mới", detailHtml),
    htmlCustomer: htmlShell(
      "Xác nhận đơn hàng",
      `<p>Kính chào ${esc(name)},</p>` +
        `<p>Đơn hàng của bạn đã được ghi nhận. Chúng tôi sẽ liên hệ sớm.</p>` +
        detailHtml
    ),
    textOwner,
    textCustomer,
  };
}
