# Harlow & Vance — matter workspace & document signing

A matter-management workspace for a law firm. The firm's Admin manages matters,
clients and documents; external clients receive secure email links to upload
files and sign documents without ever creating an account.

Harlow & Vance LLP is fictional, and so is every matter, client and document in
the seed data.

## Running it

Requires Node 20 or newer and Docker.

```bash
npm install
cp .env.example .env     # then fill in AUTH_SECRET and SECURE_LINK_PEPPER
npm run setup            # starts Postgres, applies migrations, seeds the data
npm run dev
```

Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`npm run setup` prints the demo Admin login and a set of ready-made client links
(one signing link, two upload links, and one dead link) so every client-facing
state can be opened directly.

### Other commands

| Command | What it does |
| --- | --- |
| `npm run db:up` / `db:down` | Start or stop Postgres |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Re-seed without dropping the schema |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Browse the data in Prisma Studio |

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind 4 over a token layer in `app/globals.css` |
| Database | PostgreSQL 17 via Prisma 7 with the `pg` driver adapter |
| File storage | Local disk behind a small adapter in `lib/storage.ts` |
| PDF | `pdf-lib` for stamping signatures and certificate pages |
| Email | Recorded in the database and rendered in the app; a provider adapter for production |

Postgres is the only service that needs a container. Files are written to
`STORAGE_DIR`, and outgoing mail is written to the `EmailMessage` table and
shown inside the app, so the whole flow is reviewable without an SMTP server or
object storage.

## How the data is kept honest

Four rules the schema enforces, rather than leaving to the UI:

**Document versions are append-only.** A correction or a re-upload adds the next
`versionNo` against the same `Document`. Nothing that was stored is overwritten,
so the file a client sent in week one is still retrievable in week six.

**Secure links store only a hash.** A link token is 32 random bytes, shown once
in the email. What is stored is `sha256(SECURE_LINK_PEPPER + token)`, so the
database alone cannot be turned into working links. A link grants one purpose on
one target, and expiry, revocation and single use are re-checked on the server
for every request.

**A signature points at an immutable version.** `SignatureRequest` references a
`DocumentVersion`, never a `Document`, so uploading a new version after a request
has been sent cannot change what the client is signing. The signed output records
its own SHA-256 alongside the hash of the source it was made from.

**History is written with the change.** `ActivityEvent` rows are appended in the
same transaction as the state change they describe, so the timeline cannot drift
from the data. Nothing in the application updates or deletes them.

## Design

The visual identity was designed first, as a clickable prototype, and the token
layer in `app/globals.css` is taken from it: a deep green accent on a paper-like
neutral, a serif for headings and IBM Plex for the interface, and a status
palette that is used consistently for pending, in progress, complete, and
expired or revoked. Both light and dark themes are first-class, and the
client-facing pages are built mobile-first, because that is where people sign.

## Scope and limitations

- One firm and one Admin, as the brief specifies. Tenant-scoped tables already
  carry `firmId`, so supporting several firms would be a query-scoping and
  authorisation change rather than a migration.
- One signer per document version.
- Clients have no accounts and no passwords. Their only access is a secure link.
- Signatures are recorded with a certificate of completion, but this is not a
  qualified electronic signature under eIDAS, and no third-party signing
  provider is involved.

## What is built

**The firm's workspace.** A dashboard of what needs attention, upcoming key
dates and recent activity; a matters list with URL-driven search, status,
priority and sort filters; client records; and a matter page with Overview,
Documents, Client requests, Signatures, Tasks & notes and Activity. Ctrl-K
opens search over matters, clients and documents from anywhere.

**Documents.** Upload, preview and download, with versions kept rather than
replaced. Uploading a file whose name already exists adds the next version.

**Client requests.** Ask the client for files, review what arrives, accept it or
ask for a correction. A correction becomes the next version of the same
document.

**Signing.** Send a document version for signature, watch it move through Sent,
Viewed, Started and Signed, send a reminder, or revoke the link. The client
reviews the PDF, draws or types a signature, and the signed PDF is produced with
`pdf-lib`, carrying a certificate of completion with the signer, the timestamps
and the SHA-256 of the source.

**Client pages.** Secure upload and signing pages built mobile-first, with a
designed outcome for every dead end: expired, revoked, already used, already
signed.

Each page renders its frame immediately and streams its data in behind a
skeleton, which is both the loading state the design calls for and the way
Cache Components wants a dynamic page written.

Two rules follow from that, and they are worth knowing before editing a page.
Every query in `lib/queries.ts` and `lib/link-access.ts` begins with
`await connection()`, which marks it as request-time data and takes the
component that called it out of the prerender. And a dynamic route reads its
`params` inside the Suspense boundary rather than in the page body, by passing
the promise down, so the static shell never depends on the URL. `next build`
reports every route as Partial Prerender when both hold.

## Not done yet

- **Authentication.** There is no login; the workspace currently reads the single
  seeded Admin. `lib/password.ts` and the `Session` model are in place for it.
  Until then `GET /api/documents/[versionId]` is open, and it is marked as such
  in the code.
- Tests, and the email provider adapter.
