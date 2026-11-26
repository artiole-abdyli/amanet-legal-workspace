-- A document request can be withdrawn by the firm.
ALTER TYPE "DocumentRequestStatus" ADD VALUE 'CANCELLED';
ALTER TABLE "DocumentRequest" ADD COLUMN "cancelReason" TEXT;

-- Documents can be archived out of the library without losing any version.
ALTER TABLE "Document" ADD COLUMN "archivedAt" TIMESTAMP(3);
