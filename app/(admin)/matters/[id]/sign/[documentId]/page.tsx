import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FirmSignForm } from "@/components/matters/firm-sign-form";
import { FormPage } from "@/components/ui/form";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth";
import { documentTitle, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getFirm } from "@/lib/queries";

export const metadata = { title: "Sign a document" };

type Params = Promise<{ id: string; documentId: string }>;

async function FirmSign({ params }: { params: Params }) {
  const { id, documentId } = await params;
  const [user, firm] = await Promise.all([requireAdmin(), getFirm()]);

  const document = await prisma.document.findFirst({
    where: { id: documentId, matterId: id, archivedAt: null },
    include: {
      versions: { orderBy: { versionNo: "desc" }, take: 1 },
      matter: { select: { title: true, reference: true, archivedAt: true } },
    },
  });

  if (!document || document.versions.length === 0) notFound();
  if (document.matter.archivedAt) notFound();

  const version = document.versions[0];
  const backHref = `/matters/${id}?tab=documents`;

  return (
    <FormPage
      backHref={backHref}
      backLabel="Back to matter"
      title={`Sign ${documentTitle(document.name)}`}
      description={`Version ${version.versionNo}, uploaded ${formatDate(version.createdAt)} by ${version.uploadedByName}. Read it before you sign.`}
    >
      <div className="overflow-hidden rounded-card border border-line bg-surface-2">
        <iframe
          src={`/api/documents/${version.id}`}
          title={`${document.name}, preview`}
          className="h-[55vh] min-h-[360px] w-full"
        />
      </div>

      <FirmSignForm
        matterId={id}
        documentId={document.id}
        signerName={user.name}
        firmName={firm.name}
        backHref={backHref}
      />
    </FormPage>
  );
}

export default function FirmSignPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<SkeletonCard rows={5} />}>
      <FirmSign params={params} />
    </Suspense>
  );
}
