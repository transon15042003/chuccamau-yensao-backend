import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import { buildOrderMails } from "../lib/order-mail-templates";
import { sendSendgridMail } from "../lib/sendgrid";

const FAKE_CUSTOMER_EMAIL = "no-input@chuccamau.com";

/**
 * Phase 3: email owner + customer when an order is placed (COD or online).
 */
export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_SENDER_EMAIL;
  const owners = (process.env.ORDER_NOTIFY_OWNER_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!apiKey || !from) {
    logger.info(
      "order.placed: skip email (set SENDGRID_API_KEY + SENDGRID_SENDER_EMAIL)"
    );
    return;
  }
  if (!owners.length) {
    logger.warn(
      "order.placed: ORDER_NOTIFY_OWNER_EMAIL empty — owner mail skipped"
    );
  }

  const orderModule = container.resolve(Modules.ORDER);
  const order = await orderModule.retrieveOrder(data.id, {
    relations: ["items", "shipping_address", "billing_address"],
  });

  const mails = buildOrderMails(order);

  if (owners.length) {
    await sendSendgridMail({
      apiKey,
      from,
      to: owners,
      subject: mails.subjectOwner,
      html: mails.htmlOwner,
      text: mails.textOwner,
    });
    logger.info(`order.placed: owner mail sent for ${order.id}`);
  }

  const customerEmail = (order.email || "").trim();
  if (customerEmail && customerEmail !== FAKE_CUSTOMER_EMAIL) {
    await sendSendgridMail({
      apiKey,
      from,
      to: customerEmail,
      subject: mails.subjectCustomer,
      html: mails.htmlCustomer,
      text: mails.textCustomer,
    });
    logger.info(`order.placed: customer mail sent for ${order.id}`);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
