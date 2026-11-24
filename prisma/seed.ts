import "dotenv/config";

import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";
import {
  createSecureToken,
  hashSecureToken,
  signUrl,
  uploadUrl,
} from "../lib/secure-link";
import { documentKey, putObject } from "../lib/storage";
import { buildSamplePdf } from "./sample-pdf";

/**
 * Fictional data for a single firm, Abdyli & Partners.
 *
 * Dates are relative to the moment the seed runs, so the workspace always opens
 * with deadlines approaching, one task overdue, uploads waiting for review and
 * signatures in several states.
 */

const DAY = 86_400_000;
const NOW = Date.now();

function at(days: number, hour = 10, minute = 0): Date {
  const date = new Date(NOW + days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
}

const DEMO_EMAIL = "artiole.abdyli@abdylipartners.example";
const DEMO_PASSWORD = "workspace-demo";

type ActorType = "ADMIN" | "CLIENT" | "SYSTEM";
type Folder = "CONTRACTS" | "CLIENT_UPLOADS" | "SIGNED";

async function clear() {
  // Reverse dependency order, so no foreign key is ever left dangling.
  await prisma.secureLink.deleteMany();
  await prisma.signatureRequest.deleteMany();
  await prisma.documentRequest.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.emailMessage.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.task.deleteMany();
  await prisma.note.deleteMany();
  await prisma.matterKeyDate.deleteMany();
  await prisma.matter.deleteMany();
  await prisma.client.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.firm.deleteMany();
}

type VersionInput = {
  uploadedByType: ActorType;
  uploadedByName: string;
  createdAt: Date;
  signer?: {
    name: string;
    email: string;
    signedAt: Date;
    method: "DRAWN" | "TYPED";
    sourceSha256: string;
  };
};

async function addDocument(input: {
  matterId: string;
  reference: string;
  folder: Folder;
  name: string;
  /** Title printed inside the PDF, usually the file name without its suffix. */
  title: string;
  kind?: "contract" | "upload";
  versions: VersionInput[];
}) {
  const document = await prisma.document.create({
    data: {
      matterId: input.matterId,
      folder: input.folder,
      name: input.name,
      createdAt: input.versions[0].createdAt,
    },
  });

  const versions = [];
  for (const [index, version] of input.versions.entries()) {
    const versionNo = index + 1;
    const bytes = await buildSamplePdf({
      title: input.title,
      reference: input.reference,
      versionNo,
      kind: input.kind,
      signer: version.signer,
    });
    const stored = await putObject(
      documentKey(input.matterId, document.id, versionNo),
      bytes,
    );
    versions.push(
      await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          versionNo,
          storageKey: stored.key,
          sha256: stored.sha256,
          byteSize: stored.byteSize,
          uploadedByType: version.uploadedByType,
          uploadedByName: version.uploadedByName,
          createdAt: version.createdAt,
        },
      }),
    );
  }

  return { document, versions, latest: versions[versions.length - 1] };
}

async function event(
  matterId: string,
  type: "MATTER" | "DOCUMENT" | "REQUEST" | "SIGNATURE" | "TASK" | "NOTE",
  summary: string,
  actorType: ActorType,
  actorName: string,
  createdAt: Date,
) {
  await prisma.activityEvent.create({
    data: { matterId, type, summary, actorType, actorName, createdAt },
  });
}

async function main() {
  await clear();

  const firm = await prisma.firm.create({
    data: {
      name: "Abdyli & Partners",
      email: "hello@abdylipartners.example",
      phone: "+44 20 7946 0999",
    },
  });

  await prisma.user.create({
    data: {
      firmId: firm.id,
      name: "Artiole Abdyli",
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      role: "ADMIN",
    },
  });

  const ana = await prisma.client.create({
    data: {
      firmId: firm.id,
      name: "Ana Berisha",
      type: "INDIVIDUAL",
      email: "ana.berisha@example.com",
      phone: "+383 44 120 553",
    },
  });
  const northwind = await prisma.client.create({
    data: {
      firmId: firm.id,
      name: "Northwind Logistics Ltd",
      type: "COMPANY",
      contactName: "Tomas Reed",
      email: "t.reed@northwind-logistics.example",
      phone: "+44 20 7946 0181",
    },
  });
  const marco = await prisma.client.create({
    data: {
      firmId: firm.id,
      name: "Marco Lindqvist",
      type: "INDIVIDUAL",
      email: "marco.lindqvist@example.com",
      phone: "+46 70 555 0142",
    },
  });
  const priya = await prisma.client.create({
    data: {
      firmId: firm.id,
      name: "Priya Raman",
      type: "INDIVIDUAL",
      email: "priya.raman@example.com",
      phone: "+44 7700 900461",
    },
  });

  const demoLinks: string[] = [];

  // -------------------------------------------------------------------------
  // AP-2026-0142 — the matter the demo walks through
  // -------------------------------------------------------------------------

  const elmRow = await prisma.matter.create({
    data: {
      firmId: firm.id,
      clientId: ana.id,
      reference: "AP-2026-0142",
      title: "Residential purchase, 14 Elm Row",
      practiceArea: "Property",
      status: "ACTIVE",
      priority: "HIGH",
      openedAt: at(-47, 9, 30),
      deadline: at(27),
      keyDates: {
        create: [
          { label: "Searches returned", date: at(2) },
          { label: "Exchange of contracts", date: at(13) },
          { label: "Completion", date: at(27) },
        ],
      },
      tasks: {
        create: [
          {
            title: "Order local authority searches",
            dueDate: at(-43),
            completedAt: at(-43, 16),
          },
          { title: "Confirm mortgage offer with lender", dueDate: at(-2) },
          { title: "Review searches when returned", dueDate: at(2) },
          { title: "Prepare completion statement", dueDate: at(20) },
        ],
      },
      notes: {
        create: [
          {
            body: "Seller wants to exchange before the 13th. Ana is flexible on completion but needs two weeks for removals.",
            authorName: "Artiole Abdyli",
            createdAt: at(-6, 17, 2),
          },
          {
            body: "Lender confirmed the valuation passed. Mortgage offer expected this week.",
            authorName: "Artiole Abdyli",
            createdAt: at(-4, 10, 30),
          },
        ],
      },
    },
  });

  const purchaseContract = await addDocument({
    matterId: elmRow.id,
    reference: elmRow.reference,
    folder: "CONTRACTS",
    name: "Purchase contract — 14 Elm Row.pdf",
    title: "Purchase contract — 14 Elm Row",
    versions: [
      {
        uploadedByType: "ADMIN",
        uploadedByName: "Artiole Abdyli",
        createdAt: at(-14, 15, 10),
      },
      {
        uploadedByType: "ADMIN",
        uploadedByName: "Artiole Abdyli",
        createdAt: at(-6, 16, 45),
      },
    ],
  });

  await addDocument({
    matterId: elmRow.id,
    reference: elmRow.reference,
    folder: "CONTRACTS",
    name: "Property information form.pdf",
    title: "Property information form",
    versions: [
      {
        uploadedByType: "ADMIN",
        uploadedByName: "Artiole Abdyli",
        createdAt: at(-29, 11, 2),
      },
    ],
  });

  const careLetter = await addDocument({
    matterId: elmRow.id,
    reference: elmRow.reference,
    folder: "CONTRACTS",
    name: "Client care letter.pdf",
    title: "Client care letter",
    versions: [
      {
        uploadedByType: "ADMIN",
        uploadedByName: "Artiole Abdyli",
        createdAt: at(-47, 10),
      },
    ],
  });

  const idScan = await addDocument({
    matterId: elmRow.id,
    reference: elmRow.reference,
    folder: "CLIENT_UPLOADS",
    name: "ID card scan.pdf",
    title: "ID card scan",
    kind: "upload",
    versions: [
      {
        uploadedByType: "CLIENT",
        uploadedByName: "Ana Berisha",
        createdAt: at(-8, 19, 2),
      },
    ],
  });

  const bankStatement = await addDocument({
    matterId: elmRow.id,
    reference: elmRow.reference,
    folder: "CLIENT_UPLOADS",
    name: "Bank statement — October.pdf",
    title: "Bank statement — October",
    kind: "upload",
    versions: [
      {
        uploadedByType: "CLIENT",
        uploadedByName: "Ana Berisha",
        createdAt: at(-1, 20, 5),
      },
    ],
  });

  // The signed output of the client care letter, citing the source it was made from.
  const careSignedAt = at(-45, 10, 22);
  const careSigned = await addDocument({
    matterId: elmRow.id,
    reference: elmRow.reference,
    folder: "SIGNED",
    name: "Client care letter — signed.pdf",
    title: "Client care letter",
    versions: [
      {
        uploadedByType: "CLIENT",
        uploadedByName: "Ana Berisha (e-signed)",
        createdAt: careSignedAt,
        signer: {
          name: "Ana Berisha",
          email: ana.email,
          signedAt: careSignedAt,
          method: "DRAWN",
          sourceSha256: careLetter.latest.sha256,
        },
      },
    ],
  });

  await prisma.signatureRequest.create({
    data: {
      matterId: elmRow.id,
      documentVersionId: careLetter.latest.id,
      signerName: "Ana Berisha",
      signerEmail: ana.email,
      status: "SIGNED",
      sentAt: at(-47, 10, 5),
      viewedAt: at(-46, 19, 12),
      startedAt: at(-45, 10, 20),
      signedAt: careSignedAt,
      expiresAt: at(-33),
      signatureMethod: "DRAWN",
      signerIp: "192.0.2.24",
      signerUserAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X)",
      signedDocumentId: careSigned.document.id,
      signedSha256: careSigned.latest.sha256,
    },
  });

  // Live signature request: sent, opened, not finished.
  const elmSignToken = createSecureToken();
  const elmSignature = await prisma.signatureRequest.create({
    data: {
      matterId: elmRow.id,
      documentVersionId: purchaseContract.latest.id,
      signerName: "Ana Berisha",
      signerEmail: ana.email,
      status: "VIEWED",
      sentAt: at(-2, 9, 12),
      viewedAt: at(-1, 18, 40),
      expiresAt: at(12),
      links: {
        create: {
          purpose: "SIGN",
          tokenHash: hashSecureToken(elmSignToken),
          expiresAt: at(12),
          lastSeenAt: at(-1, 18, 40),
          lastSeenIp: "192.0.2.24",
        },
      },
    },
  });
  demoLinks.push(`Sign  (Ana Berisha, purchase contract v2)   ${signUrl(elmSignToken)}`);

  // Document requests in three different states.
  const idRequest = await prisma.documentRequest.create({
    data: {
      matterId: elmRow.id,
      title: "Government-issued ID",
      description:
        "Passport or national ID card, both sides, as a clear colour scan.",
      status: "CHANGES_REQUESTED",
      dueDate: at(4),
      reviewNote:
        "The scan is too blurry to read the ID number. Please upload a clearer copy.",
      submittedDocumentId: idScan.document.id,
      requestedAt: at(-10),
      submittedAt: at(-8, 19, 2),
    },
  });

  await prisma.documentRequest.create({
    data: {
      matterId: elmRow.id,
      title: "Bank statements (last 3 months)",
      description:
        "Statements for the account that will pay the deposit.",
      status: "SUBMITTED",
      dueDate: at(2),
      submittedDocumentId: bankStatement.document.id,
      requestedAt: at(-10),
      submittedAt: at(-1, 20, 5),
    },
  });

  const addressRequest = await prisma.documentRequest.create({
    data: {
      matterId: elmRow.id,
      title: "Proof of address",
      description:
        "A utility bill or council tax letter dated within the last three months.",
      status: "PENDING",
      dueDate: at(7),
      requestedAt: at(-10),
    },
  });

  const uploadToken = createSecureToken();
  await prisma.secureLink.create({
    data: {
      purpose: "UPLOAD",
      tokenHash: hashSecureToken(uploadToken),
      documentRequestId: addressRequest.id,
      expiresAt: at(11),
    },
  });
  demoLinks.push(`Upload (Ana Berisha, proof of address)      ${uploadUrl(uploadToken)}`);

  const idUploadToken = createSecureToken();
  await prisma.secureLink.create({
    data: {
      purpose: "UPLOAD",
      tokenHash: hashSecureToken(idUploadToken),
      documentRequestId: idRequest.id,
      expiresAt: at(11),
    },
  });
  demoLinks.push(`Upload (Ana Berisha, clearer ID copy)       ${uploadUrl(idUploadToken)}`);

  // An expired, revoked link so the client-facing dead ends are reachable.
  const deadToken = createSecureToken();
  await prisma.secureLink.create({
    data: {
      purpose: "SIGN",
      tokenHash: hashSecureToken(deadToken),
      signatureRequestId: elmSignature.id,
      expiresAt: at(-3),
      revokedAt: at(-3, 9),
    },
  });
  demoLinks.push(`Dead link (expired and revoked)             ${signUrl(deadToken)}`);

  for (const entry of [
    ["MATTER", "Matter opened by Artiole Abdyli", "ADMIN", "Artiole Abdyli", at(-47, 9, 30)],
    ["SIGNATURE", "Ana Berisha signed Client care letter", "CLIENT", "Ana Berisha", careSignedAt],
    ["DOCUMENT", "Purchase contract v1 uploaded", "ADMIN", "Artiole Abdyli", at(-14, 15, 10)],
    ["REQUEST", "Requested 3 documents from Ana Berisha", "ADMIN", "Artiole Abdyli", at(-10)],
    ["REQUEST", "Ana Berisha uploaded ID card scan.pdf", "CLIENT", "Ana Berisha", at(-8, 19, 2)],
    ["REQUEST", "Asked Ana Berisha for a clearer copy of her ID", "ADMIN", "Artiole Abdyli", at(-7, 9, 15)],
    ["DOCUMENT", "Purchase contract v2 uploaded, v1 kept in history", "ADMIN", "Artiole Abdyli", at(-6, 16, 45)],
    ["SIGNATURE", "Signature request sent to Ana Berisha for Purchase contract v2", "ADMIN", "Artiole Abdyli", at(-2, 9, 12)],
    ["SIGNATURE", "Ana Berisha opened Purchase contract v2", "CLIENT", "Ana Berisha", at(-1, 18, 40)],
    ["REQUEST", "Ana Berisha uploaded Bank statement — October.pdf", "CLIENT", "Ana Berisha", at(-1, 20, 5)],
  ] as const) {
    await event(elmRow.id, entry[0], entry[1], entry[2], entry[3], entry[4]);
  }

  // -------------------------------------------------------------------------
  // AP-2026-0137 — a signature already in progress
  // -------------------------------------------------------------------------

  const supplier = await prisma.matter.create({
    data: {
      firmId: firm.id,
      clientId: northwind.id,
      reference: "AP-2026-0137",
      title: "Supplier agreement renewal",
      practiceArea: "Commercial",
      status: "ACTIVE",
      priority: "MEDIUM",
      openedAt: at(-66),
      deadline: at(9),
      keyDates: {
        create: [
          { label: "Draft to counterparty", date: at(1) },
          { label: "Renewal deadline", date: at(9) },
        ],
      },
      tasks: {
        create: [
          { title: "Mark up liability cap clause", dueDate: at(1) },
          { title: "Send draft to counterparty", dueDate: at(1) },
        ],
      },
      notes: {
        create: [
          {
            body: "Northwind will not accept a liability cap below 12 months of fees.",
            authorName: "Artiole Abdyli",
            createdAt: at(-8, 15, 40),
          },
        ],
      },
    },
  });

  const supplierAgreement = await addDocument({
    matterId: supplier.id,
    reference: supplier.reference,
    folder: "CONTRACTS",
    name: "Supplier agreement 2027.pdf",
    title: "Supplier agreement 2027",
    versions: [
      { uploadedByType: "ADMIN", uploadedByName: "Artiole Abdyli", createdAt: at(-21, 10) },
      { uploadedByType: "ADMIN", uploadedByName: "Artiole Abdyli", createdAt: at(-12, 9, 30) },
      { uploadedByType: "ADMIN", uploadedByName: "Artiole Abdyli", createdAt: at(-4, 17, 20) },
    ],
  });

  await addDocument({
    matterId: supplier.id,
    reference: supplier.reference,
    folder: "CONTRACTS",
    name: "Pricing schedule.pdf",
    title: "Pricing schedule",
    versions: [
      { uploadedByType: "ADMIN", uploadedByName: "Artiole Abdyli", createdAt: at(-12, 9, 32) },
    ],
  });

  const supplierToken = createSecureToken();
  await prisma.signatureRequest.create({
    data: {
      matterId: supplier.id,
      documentVersionId: supplierAgreement.latest.id,
      signerName: "Tomas Reed",
      signerEmail: northwind.email,
      status: "STARTED",
      sentAt: at(-3, 11),
      viewedAt: at(-3, 14, 22),
      startedAt: at(-3, 14, 25),
      expiresAt: at(11),
      links: {
        create: {
          purpose: "SIGN",
          tokenHash: hashSecureToken(supplierToken),
          expiresAt: at(11),
          lastSeenAt: at(-3, 14, 25),
        },
      },
    },
  });
  demoLinks.push(`Sign  (Tomas Reed, supplier agreement v3)   ${signUrl(supplierToken)}`);

  await prisma.documentRequest.create({
    data: {
      matterId: supplier.id,
      title: "Signed board resolution",
      description: "Board resolution approving the 2027 supplier agreement.",
      status: "PENDING",
      dueDate: at(5),
      requestedAt: at(-4),
    },
  });

  for (const entry of [
    ["MATTER", "Matter opened by Artiole Abdyli", "ADMIN", "Artiole Abdyli", at(-66)],
    ["DOCUMENT", "Supplier agreement 2027 v3 uploaded", "ADMIN", "Artiole Abdyli", at(-4, 17, 20)],
    ["SIGNATURE", "Signature request sent to Tomas Reed for Supplier agreement 2027 v3", "ADMIN", "Artiole Abdyli", at(-3, 11)],
    ["SIGNATURE", "Tomas Reed opened Supplier agreement 2027 v3", "CLIENT", "Tomas Reed", at(-3, 14, 22)],
    ["SIGNATURE", "Tomas Reed started signing", "CLIENT", "Tomas Reed", at(-3, 14, 25)],
  ] as const) {
    await event(supplier.id, entry[0], entry[1], entry[2], entry[3], entry[4]);
  }

  // -------------------------------------------------------------------------
  // AP-2026-0129 — on hold, with a revoked signing link
  // -------------------------------------------------------------------------

  const dismissal = await prisma.matter.create({
    data: {
      firmId: firm.id,
      clientId: marco.id,
      reference: "AP-2026-0129",
      title: "Unfair dismissal claim",
      practiceArea: "Employment",
      status: "ON_HOLD",
      priority: "HIGH",
      openedAt: at(-81),
      deadline: at(2),
      keyDates: {
        create: [
          { label: "Tribunal filing deadline", date: at(2) },
          { label: "Preliminary hearing", date: at(56) },
        ],
      },
      tasks: {
        create: [
          { title: "Calculate tribunal filing deadline", dueDate: at(-78), completedAt: at(-78, 14) },
          { title: "Draft ET1 claim form", dueDate: at(1) },
        ],
      },
      notes: {
        create: [
          {
            body: "On hold while settlement talks continue. The filing deadline still applies: do not miss it.",
            authorName: "Artiole Abdyli",
            createdAt: at(-13, 9, 35),
          },
        ],
      },
    },
  });

  const settlement = await addDocument({
    matterId: dismissal.id,
    reference: dismissal.reference,
    folder: "CONTRACTS",
    name: "Settlement agreement.pdf",
    title: "Settlement agreement",
    versions: [
      { uploadedByType: "ADMIN", uploadedByName: "Artiole Abdyli", createdAt: at(-18, 14) },
    ],
  });

  const payslips = await addDocument({
    matterId: dismissal.id,
    reference: dismissal.reference,
    folder: "CLIENT_UPLOADS",
    name: "Employment contract and payslips.pdf",
    title: "Employment contract and payslips",
    kind: "upload",
    versions: [
      { uploadedByType: "CLIENT", uploadedByName: "Marco Lindqvist", createdAt: at(-77, 8, 41) },
    ],
  });

  await prisma.documentRequest.create({
    data: {
      matterId: dismissal.id,
      title: "Employment contract and payslips",
      description: "Your contract and the last six payslips.",
      status: "ACCEPTED",
      dueDate: at(-74),
      submittedDocumentId: payslips.document.id,
      requestedAt: at(-80),
      submittedAt: at(-77, 8, 41),
      resolvedAt: at(-76, 11),
    },
  });

  await prisma.signatureRequest.create({
    data: {
      matterId: dismissal.id,
      documentVersionId: settlement.latest.id,
      signerName: "Marco Lindqvist",
      signerEmail: marco.email,
      status: "REVOKED",
      sentAt: at(-17, 10),
      viewedAt: at(-17, 21, 14),
      revokedAt: at(-14, 9, 30),
      revokedReason: "Settlement terms changed",
      expiresAt: at(-3),
    },
  });

  for (const entry of [
    ["MATTER", "Matter opened by Artiole Abdyli", "ADMIN", "Artiole Abdyli", at(-81)],
    ["REQUEST", "Marco Lindqvist uploaded Employment contract and payslips.pdf", "CLIENT", "Marco Lindqvist", at(-77, 8, 41)],
    ["SIGNATURE", "Signature request sent to Marco Lindqvist for Settlement agreement", "ADMIN", "Artiole Abdyli", at(-17, 10)],
    ["SIGNATURE", "Signing link revoked: settlement terms changed", "ADMIN", "Artiole Abdyli", at(-14, 9, 30)],
    ["MATTER", "Status changed to On hold", "ADMIN", "Artiole Abdyli", at(-13, 9, 30)],
  ] as const) {
    await event(dismissal.id, entry[0], entry[1], entry[2], entry[3], entry[4]);
  }

  // -------------------------------------------------------------------------
  // AP-2026-0118 — quiet matter with one completed signature
  // -------------------------------------------------------------------------

  const will = await prisma.matter.create({
    data: {
      firmId: firm.id,
      clientId: priya.id,
      reference: "AP-2026-0118",
      title: "Will and estate plan",
      practiceArea: "Private client",
      status: "ACTIVE",
      priority: "LOW",
      openedAt: at(-120),
      deadline: at(52),
      keyDates: {
        create: [
          { label: "Draft will review", date: at(14) },
          { label: "Signing appointment", date: at(52) },
        ],
      },
      tasks: {
        create: [
          { title: "Prepare will draft", dueDate: at(-6), completedAt: at(-5, 12, 15) },
          { title: "Book signing appointment", dueDate: at(12) },
        ],
      },
      notes: {
        create: [
          {
            body: "Priya wants her sister named as second executor.",
            authorName: "Artiole Abdyli",
            createdAt: at(-5, 12, 20),
          },
        ],
      },
    },
  });

  await addDocument({
    matterId: will.id,
    reference: will.reference,
    folder: "CONTRACTS",
    name: "Will — draft for review.pdf",
    title: "Will — draft for review",
    versions: [
      { uploadedByType: "ADMIN", uploadedByName: "Artiole Abdyli", createdAt: at(-5, 12, 15) },
    ],
  });

  const priyaCare = await addDocument({
    matterId: will.id,
    reference: will.reference,
    folder: "CONTRACTS",
    name: "Client care letter.pdf",
    title: "Client care letter",
    versions: [
      { uploadedByType: "ADMIN", uploadedByName: "Artiole Abdyli", createdAt: at(-120, 15) },
    ],
  });

  const priyaSignedAt = at(-119, 8, 5);
  const priyaSigned = await addDocument({
    matterId: will.id,
    reference: will.reference,
    folder: "SIGNED",
    name: "Client care letter — signed.pdf",
    title: "Client care letter",
    versions: [
      {
        uploadedByType: "CLIENT",
        uploadedByName: "Priya Raman (e-signed)",
        createdAt: priyaSignedAt,
        signer: {
          name: "Priya Raman",
          email: priya.email,
          signedAt: priyaSignedAt,
          method: "TYPED",
          sourceSha256: priyaCare.latest.sha256,
        },
      },
    ],
  });

  await prisma.signatureRequest.create({
    data: {
      matterId: will.id,
      documentVersionId: priyaCare.latest.id,
      signerName: "Priya Raman",
      signerEmail: priya.email,
      status: "SIGNED",
      sentAt: at(-120, 15),
      viewedAt: at(-120, 18, 31),
      startedAt: at(-119, 8, 3),
      signedAt: priyaSignedAt,
      expiresAt: at(-106),
      signatureMethod: "TYPED",
      signerIp: "198.51.100.7",
      signerUserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      signedDocumentId: priyaSigned.document.id,
      signedSha256: priyaSigned.latest.sha256,
    },
  });

  for (const entry of [
    ["MATTER", "Matter opened by Artiole Abdyli", "ADMIN", "Artiole Abdyli", at(-120)],
    ["SIGNATURE", "Priya Raman signed Client care letter", "CLIENT", "Priya Raman", priyaSignedAt],
    ["DOCUMENT", "Will — draft for review uploaded", "ADMIN", "Artiole Abdyli", at(-5, 12, 15)],
  ] as const) {
    await event(will.id, entry[0], entry[1], entry[2], entry[3], entry[4]);
  }

  // -------------------------------------------------------------------------
  // AP-2026-0096 — archived, so the archive filter has something to show
  // -------------------------------------------------------------------------

  const warehouse = await prisma.matter.create({
    data: {
      firmId: firm.id,
      clientId: northwind.id,
      reference: "AP-2026-0096",
      title: "Warehouse lease termination",
      practiceArea: "Property",
      status: "CLOSED",
      priority: "MEDIUM",
      openedAt: at(-252),
      deadline: at(-141),
      archivedAt: at(-140),
      keyDates: { create: [{ label: "Lease end", date: at(-141) }] },
    },
  });

  await addDocument({
    matterId: warehouse.id,
    reference: warehouse.reference,
    folder: "CONTRACTS",
    name: "Lease termination notice.pdf",
    title: "Lease termination notice",
    versions: [
      { uploadedByType: "ADMIN", uploadedByName: "Artiole Abdyli", createdAt: at(-170, 11) },
    ],
  });

  await event(warehouse.id, "MATTER", "Matter archived", "ADMIN", "Artiole Abdyli", at(-140));

  // -------------------------------------------------------------------------
  // A fuller caseload
  //
  // The five matters above carry the demo. These fill the list out to a size a
  // real firm would have, so search, filters and pagination have something to
  // work on rather than looking decorative.
  // -------------------------------------------------------------------------

  // More client records, so the clients list is worth searching and paging.
  const more = await Promise.all(
    (
      [
        ["Halden & Rowe Architects", "COMPANY", "accounts@haldenrowe.example", "Nina Halden"],
        ["Bramley Construction Ltd", "COMPANY", "legal@bramley-build.example", "Owen Bramley"],
        ["Clearwater Foods Ltd", "COMPANY", "contracts@clearwaterfoods.example", "Sofia Marchetti"],
        ["Keswick Property Group", "COMPANY", "office@keswickproperty.example", "Daniel Keswick"],
        ["Orla Devlin", "INDIVIDUAL", "orla.devlin@example.com", null],
        ["Hassan Qureshi", "INDIVIDUAL", "hassan.qureshi@example.com", null],
        ["Margit Sandberg", "INDIVIDUAL", "margit.sandberg@example.com", null],
        ["Tobias Lenz", "INDIVIDUAL", "tobias.lenz@example.com", null],
        ["Fiona Achebe", "INDIVIDUAL", "fiona.achebe@example.com", null],
        ["Rowan Pethick", "INDIVIDUAL", "rowan.pethick@example.com", null],
      ] as const
    ).map(([name, type, email, contactName]) =>
      prisma.client.create({
        data: {
          firmId: firm.id,
          name,
          type,
          email,
          contactName,
        },
      }),
    ),
  );

  const roster: [string, string, string, "ACTIVE" | "ON_HOLD" | "CLOSED",
    "LOW" | "MEDIUM" | "HIGH", number, string][] = [
    ["Commercial lease, Unit 4 Brampton Yard", "Property", northwind.id, "ACTIVE", "MEDIUM", 18, "Heads of terms agreed"],
    ["Shareholder agreement review", "Commercial", northwind.id, "ACTIVE", "HIGH", 5, "Board meeting"],
    ["Trademark opposition, STILLWATER", "Commercial", northwind.id, "ON_HOLD", "LOW", 40, "Opposition deadline"],
    ["Partnership dissolution", "Commercial", marco.id, "ACTIVE", "MEDIUM", 23, "Accounts to be agreed"],
    ["Boundary dispute, 7 Larkspur Lane", "Litigation", priya.id, "ACTIVE", "HIGH", 8, "Surveyor's report due"],
    ["Redundancy consultation", "Employment", northwind.id, "ACTIVE", "HIGH", 3, "Consultation ends"],
    ["Share purchase, Mallory Foods", "Commercial", northwind.id, "ACTIVE", "MEDIUM", 31, "Completion"],
    ["Probate, estate of J. Whitfield", "Private client", priya.id, "ACTIVE", "LOW", 46, "Grant application"],
    ["Lease assignment, 22 Quarry Street", "Property", ana.id, "ACTIVE", "MEDIUM", 12, "Landlord consent"],
    ["Data protection audit", "Commercial", northwind.id, "ON_HOLD", "LOW", 60, "Audit report"],
    ["Construction contract dispute", "Litigation", northwind.id, "ACTIVE", "HIGH", 15, "Adjudication response"],
    ["Franchise agreement renewal", "Commercial", marco.id, "CLOSED", "LOW", -20, "Renewal signed"],
    ["Employment tribunal, Okafor", "Employment", marco.id, "ACTIVE", "MEDIUM", 27, "Bundle exchange"],
    ["Office relocation lease", "Property", northwind.id, "CLOSED", "MEDIUM", -8, "Keys handed over"],
    ["Practice incorporation", "Commercial", more[0].id, "ACTIVE", "MEDIUM", 21, "Articles to be filed"],
    ["Subcontractor dispute, Pier Road", "Litigation", more[1].id, "ACTIVE", "HIGH", 6, "Mediation"],
    ["Supply terms rewrite", "Commercial", more[2].id, "ACTIVE", "LOW", 35, "Terms issued"],
    ["Portfolio refinance", "Property", more[3].id, "ACTIVE", "HIGH", 10, "Lender report"],
    ["Divorce settlement", "Private client", more[4].id, "ON_HOLD", "MEDIUM", 48, "Financial disclosure"],
    ["Visa sponsorship review", "Employment", more[5].id, "ACTIVE", "LOW", 29, "Licence renewal"],
    ["Cohabitation agreement", "Private client", more[6].id, "ACTIVE", "LOW", 52, "Draft to both parties"],
    ["Unpaid invoice recovery", "Litigation", more[7].id, "ACTIVE", "MEDIUM", 9, "Letter before action"],
  ];

  let sequence = 143;
  for (const [title, area, clientId, status, priority, inDays, keyDate] of roster) {
    const reference = `AP-2026-0${sequence++}`;
    const matter = await prisma.matter.create({
      data: {
        firmId: firm.id,
        clientId,
        reference,
        title,
        practiceArea: area,
        status,
        priority,
        openedAt: at(-90 + (sequence % 40)),
        deadline: at(inDays),
        keyDates: { create: [{ label: keyDate, date: at(inDays) }] },
        tasks: {
          create: [
            status === "CLOSED"
              ? { title: "Close the file", dueDate: at(inDays), completedAt: at(inDays, 16) }
              : { title: `Review ${title.toLowerCase()}`, dueDate: at(Math.max(1, inDays - 4)) },
          ],
        },
        activity: {
          create: {
            type: "MATTER",
            summary: "Matter opened",
            actorType: "ADMIN",
            actorName: "Artiole Abdyli",
            createdAt: at(-90 + (sequence % 40)),
          },
        },
      },
    });

    await addDocument({
      matterId: matter.id,
      reference,
      folder: "CONTRACTS",
      name: `${title}.pdf`,
      title,
      versions: [
        {
          uploadedByType: "ADMIN",
          uploadedByName: "Artiole Abdyli",
          createdAt: at(-60 + (sequence % 30)),
        },
      ],
    });
  }

  // -------------------------------------------------------------------------
  // Notifications and the email log
  // -------------------------------------------------------------------------

  await prisma.notification.createMany({
    data: [
      {
        firmId: firm.id,
        matterId: elmRow.id,
        text: "Ana Berisha uploaded Bank statement — October.pdf",
        href: `/matters/${elmRow.id}?tab=requests`,
        createdAt: at(-1, 20, 5),
      },
      {
        firmId: firm.id,
        matterId: elmRow.id,
        text: "Ana Berisha opened Purchase contract v2 but has not signed yet",
        href: `/matters/${elmRow.id}?tab=signatures`,
        createdAt: at(-1, 18, 40),
      },
      {
        firmId: firm.id,
        matterId: elmRow.id,
        text: "Task overdue: Confirm mortgage offer with lender",
        href: `/matters/${elmRow.id}?tab=tasks`,
        createdAt: at(-1, 8),
      },
      {
        firmId: firm.id,
        matterId: supplier.id,
        text: "Tomas Reed started signing Supplier agreement 2027",
        href: `/matters/${supplier.id}?tab=signatures`,
        createdAt: at(-3, 14, 25),
        readAt: at(-3, 15),
      },
    ],
  });

  await prisma.emailMessage.createMany({
    data: [
      {
        firmId: firm.id,
        to: ana.email,
        subject: "Please sign: Purchase contract — 14 Elm Row",
        body: "Hello Ana, Artiole Abdyli at Abdyli & Partners has asked you to sign a document. The link in this message works only for you and expires automatically.",
        status: "SENT",
        sentAt: at(-2, 9, 12),
        createdAt: at(-2, 9, 12),
      },
      {
        firmId: firm.id,
        to: ana.email,
        subject: "We need a clearer copy of your ID",
        body: "Hello Ana, the ID scan you sent is too blurry to read the ID number. Please upload a clearer copy using the secure link below.",
        status: "SENT",
        sentAt: at(-7, 9, 15),
        createdAt: at(-7, 9, 15),
      },
      {
        firmId: firm.id,
        to: northwind.email,
        subject: "Please sign: Supplier agreement 2027",
        body: "Hello Tomas, please review and sign the renewed supplier agreement. Call us if anything is unclear.",
        status: "SENT",
        sentAt: at(-3, 11),
        createdAt: at(-3, 11),
      },
    ],
  });

  console.log(`
Seeded Abdyli & Partners.

  Admin login
    ${DEMO_EMAIL}
    ${DEMO_PASSWORD}

  Client links (no account needed)
${demoLinks.map((line) => `    ${line}`).join("\n")}

  ${await prisma.matter.count()} matters, ${await prisma.document.count()} documents, ${await prisma.documentVersion.count()} versions.
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
