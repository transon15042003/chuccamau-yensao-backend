type SendInput = {
  to: string | string[];
  from: string;
  fromName?: string;
  subject: string;
  html: string;
  text: string;
  apiKey: string;
};

/** Send via SendGrid REST API (no extra dependency). */
export async function sendSendgridMail(input: SendInput): Promise<void> {
  const to = (Array.isArray(input.to) ? input.to : [input.to])
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
  if (!to.length) {
    throw new Error("sendSendgridMail: empty recipients");
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to }],
      from: { email: input.from, name: input.fromName || "Chuc Ca Mau Yen Sao" },
      subject: input.subject,
      content: [
        { type: "text/plain", value: input.text },
        { type: "text/html", value: input.html },
      ],
    }),
  });

  if (res.status !== 202 && res.status !== 200) {
    const body = await res.text();
    throw new Error(`SendGrid ${res.status}: ${body.slice(0, 300)}`);
  }
}
