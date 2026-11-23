import { prisma } from "@/lib/prisma";

/**
 * Outgoing mail.
 *
 * Every message becomes an `EmailMessage` row first, whatever happens next.
 * That row is the delivery log in production and the mailbox in development,
 * which is why the workspace can show the whole email side of the brief at
 * /emails without an SMTP server.
 *
 * Two transports:
 *
 *   outbox  the row is the delivery. The default, and what a reviewer runs.
 *   resend  the row is written, then handed to Resend over its HTTP API.
 *
 * A failed send is recorded as FAILED with the provider's reason rather than
 * thrown, because the thing the message was attached to — a signature request,
 * an upload link — has already happened and must not be rolled back by a mail
 * server having a bad afternoon. The Admin sees the failure at /emails.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type SendInput = {
  firmId: string;
  to: string;
  subject: string;
  body: string;
};

async function deliverWithResend(input: SendInput): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "RESEND_API_KEY is not set";

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "no-reply@example.com",
        to: [input.to],
        subject: input.subject,
        text: input.body,
      }),
    });

    if (response.ok) return null;

    // Keep the provider's own wording, trimmed: it is what makes a bounced
    // address or a bad domain diagnosable from the outbox.
    const detail = (await response.text()).slice(0, 500);
    return `Resend returned ${response.status}: ${detail}`;
  } catch (error) {
    return error instanceof Error ? error.message : "Unknown delivery error";
  }
}

export async function sendEmail(input: SendInput) {
  const transport = process.env.EMAIL_TRANSPORT ?? "outbox";

  const message = await prisma.emailMessage.create({
    data: {
      firmId: input.firmId,
      to: input.to,
      subject: input.subject,
      body: input.body,
      status: "QUEUED",
    },
  });

  if (transport !== "resend") {
    return prisma.emailMessage.update({
      where: { id: message.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  }

  const error = await deliverWithResend(input);

  return prisma.emailMessage.update({
    where: { id: message.id },
    data: error
      ? { status: "FAILED", error }
      : { status: "SENT", sentAt: new Date() },
  });
}
