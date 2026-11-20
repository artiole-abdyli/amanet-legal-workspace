import { prisma } from "@/lib/prisma";

/**
 * Outgoing mail.
 *
 * Every message is written to `EmailMessage` first. With EMAIL_TRANSPORT set to
 * "outbox" — the default in development — that row is the delivery: the app
 * renders it, so the whole flow can be reviewed without an SMTP server. A
 * provider such as Resend is a second step after the row is written, which also
 * leaves the log that production needs.
 */
export async function sendEmail(input: {
  firmId: string;
  to: string;
  subject: string;
  body: string;
}) {
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

  if (transport === "outbox") {
    return prisma.emailMessage.update({
      where: { id: message.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  }

  // Delivery through a provider belongs here. Until one is configured, the
  // message stays QUEUED rather than claiming it was sent.
  return message;
}
