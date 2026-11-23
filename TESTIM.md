# Udhëzues testimi

Çdo hap që duhet ndërmarrë për ta provuar aplikacionin, nga ngritja e tij deri
te rrjedhat e plota. Shëno kutizat ndërsa kalon.

Koha e nevojshme: rreth **30 minuta** për gjithçka, ose **10 minuta** nëse bën
vetëm pjesën e shënuar me ⭐.

---

## 1. Para se të fillosh

- [ ] **Docker Desktop është i hapur** dhe poshtë majtas shkruan "Engine running"
- [ ] Node 20 ose më i ri: `node --version`

Pa Docker-in, baza nuk punon dhe çdo faqe do të japë gabim.

---

## 2. Ngritja nga zero ⭐

```bash
npm install
```

```bash
cp .env.example .env
```

Hap `.env` dhe mbush dy sekretet. Gjeneroje secilin me:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] `AUTH_SECRET` i mbushur
- [ ] `SECURE_LINK_PEPPER` i mbushur

```bash
npm run setup
```

Kjo ngre Postgres-in, krijon tabelat dhe i mbush me të dhëna.

- [ ] Në fund printohen **kredencialet e Admin-it** dhe **linqet e klientëve**
- [ ] **Kopjoji ato linqe diku** — do të të duhen te hapi 6

```bash
npm run dev
```

- [ ] Hapet te `http://localhost:3000`

---

## 3. Testet automatike ⭐

```bash
npm test
```

- [ ] **37 teste kalojnë**, pa pasur nevojë për bazë të dhënash

```bash
npm run test:e2e
```

- [ ] **10 teste kalojnë** (marrin rreth dy minuta)

Katër prej tyre janë kontrolle aksesueshmërie me axe: faqja e hyrjes, faqet e
zyrës, tabs-at e një lënde dhe faqet e klientit. Dështojnë në çdo shkelje
serioze.

Testet end-to-end nënshkruajnë dokumente, pra i ndryshojnë të dhënat. Nëse do
t'i rikthesh në gjendjen fillestare:

```bash
npm run db:seed
```

---

## 4. Hyrja dhe siguria ⭐

- [ ] Hap `localhost:3000/matters` **pa qenë i kyçur** → të dërgon te `/login`
- [ ] Provo një fjalëkalim të gabuar → thotë *"That email address and password do not match."*

Vëre se nuk thotë cila gjysmë ishte e gabuar. Kjo është me qëllim: ndryshe faqja
do të ishte mënyrë për të zbuluar kush ka llogari.

- [ ] Hyr me:

```
elena.vance@harlowvance.example
workspace-demo
```

- [ ] Të çon te dashboard-i, me emrin tënd poshtë majtas

---

## 5. Hapësira e punës

**Dashboard**

- [ ] Katër numrat lart janë të klikueshëm
- [ ] "Needs your attention" liston ngarkime për rishikim dhe nënshkrime të ndalura
- [ ] Datat kyçe të 14 ditëve të ardhshme shfaqen me ngjyrë sipas afërsisë

**Lëndët**

- [ ] Shkruaj `lease` te kërkimi → lista ngushtohet
- [ ] Zgjidh "On hold" → mbeten vetëm ato
- [ ] Zgjidh "High" → numri poshtë ndryshon bashkë me listën
- [ ] Kalo te faqja 2 dhe 3 — janë 26 lëndë, 5 për faqe
- [ ] **Kopjo adresën e faqes 3 dhe hape në tab të ri** → ruan filtrat dhe faqen
- [ ] Shëno "Show archived" → shfaqet edhe lënda e arkivuar

**Kërkimi i shpejtë**

- [ ] Shtyp **Ctrl K** kudo → kërkon mes lëndëve, klientëve dhe dokumenteve
- [ ] Shigjetat lart/poshtë dhe Enter funksionojnë

**Klientët**

- [ ] Filtro sipas "Companies" → mbeten 5
- [ ] Kërko `devlin` → një rezultat, dhe teksti thotë **"1 client"**, jo "1 clients"
- [ ] Shtyp lapsin te një rresht → hapet redaktimi

---

## 6. Rrjedha e plotë e nënshkrimit ⭐

Kjo është pjesa qendrore e detyrës. Bëje tërë rrugën.

**Dërgimi**

- [ ] Hap lëndën **Residential purchase, 14 Elm Row**
- [ ] Shtyp **Request signature**
- [ ] Lëre dokumentin dhe nënshkruesin si janë, shtyp **Send request**
- [ ] Te tab-i Signatures shfaqet një kërkesë e re me statusin **Sent**

**Marrja e linkut**

- [ ] Shko te **Email** në shiritin anësor
- [ ] Mesazhi i parë është ai që sapo u dërgua
- [ ] Kopjo linkun `/sign/...` nga trupi i mesazhit

Vëre: linku ekziston **vetëm** në mesazh. Në bazë ruhet vetëm hash-i i tij.

**Nënshkrimi si klient**

- [ ] Hape linkun (mundësisht në një dritare private, për ta parë si klienti)
- [ ] Shfaqet PDF-ja për lexim
- [ ] Shtyp **Continue to sign**
- [ ] Vizato nënshkrimin me mausin
- [ ] Provo edhe skedën **Type** → shkruan emrin me shkrim dore
- [ ] Shëno kutizën e pëlqimit
- [ ] Shtyp **Sign document**
- [ ] Shfaqet faqja e falënderimit me dokumentin, orën dhe email-in
- [ ] **Rifresko atë faqe** → mbetet faqja e falënderimit, nuk ri-nënshkruan

**Kontrolli te zyra**

- [ ] Kthehu te lënda → tab-i Signatures tregon **Signed**
- [ ] Hapat Sent → Viewed → Started → Signed kanë orët e tyre
- [ ] Zilja e njoftimeve ka një njoftim të ri
- [ ] Te tab-i **Documents**, dosja Signed ka një PDF të ri
- [ ] Hape atë PDF → nënshkrimi është në faqen e fundit
- [ ] **Faqja e dytë është certifikata** me emrin, orët, IP-në dhe SHA-256

---

## 7. Nënshkrimi nga vetë zyra

- [ ] Te tab-i Documents, shtyp **Sign** te një kontratë
- [ ] Lexo PDF-në, vizato nënshkrimin, shëno kutizën, nënshkruaj
- [ ] Krijohet një PDF i ri me `— signed by the firm`
- [ ] Shfaqet edhe te tab-i Signatures

Provoje edhe mbi një fajll që e ka ngarkuar klienti — ticket-i e kërkon
shprehimisht këtë.

---

## 8. Kërkesa për dokumente ⭐

- [ ] Te lënda, shtyp **Request documents**
- [ ] Shkruaj p.sh. "Proof of income", një përshkrim, dhe dërgo
- [ ] Te **Email** merr linkun `/upload/...`
- [ ] Hape si klient
- [ ] Provo të ngarkosh një fajll **që nuk është PDF** → refuzohet me shpjegim
- [ ] Ngarko një PDF
- [ ] Te zyra statusi bëhet **Needs review**
- [ ] Shtyp **Request changes**, shkruaj arsyen, dërgo
- [ ] Klienti merr link të ri; i vjetri **nuk punon më**
- [ ] Ngarko përsëri → krijohet **versioni 2**, i pari ruhet
- [ ] Shtyp **Accept** → statusi bëhet Accepted

---

## 9. Linqet e sigurta

- [ ] Te një nënshkrim aktiv shtyp **Revoke**, jep arsyen
- [ ] Hap atë link si klient → *"This link is no longer active"*
- [ ] Hap linkun e vdekur nga seed-i → *"This link has expired"*
- [ ] Ndrysho një shkronjë në një link → *"We could not find this link"*

Vëre se **nuk ka buton "kopjo linkun"**, vetëm "Resend link". Kjo nuk është
harresë: meqë ruhet vetëm hash-i, linku i vjetër nuk mund të rikuperohet.

---

## 10. Dokumentet dhe versionet

- [ ] Shtyp **Upload PDF** te një lëndë, ngarko një fajll
- [ ] Ngarko **të njëjtin emër fajlli përsëri** → bëhet versioni 2
- [ ] Shtyp "Earlier versions" → versioni 1 është ende aty dhe hapet

---

## 11. Redaktimi i lëndës

- [ ] Shtyp **Edit** te koka e lëndës
- [ ] Ndrysho titullin, prioritetin dhe afatin → ruaj
- [ ] Shto një datë kyçe → shfaqet te Overview dhe te dashboard-i
- [ ] Hiq një datë kyçe
- [ ] Te tab-i **Activity** janë shënuar të gjitha këto ndryshime

---

## 12. Taskat, shënimet dhe arkivimi

- [ ] Shto një task me afat → shfaqet
- [ ] Shëno një task si të kryer → kalon menjëherë, pa pritje
- [ ] Shto një shënim të brendshëm
- [ ] Arkivo lëndën → bëhet vetëm për lexim, butonat zhduken
- [ ] Rikthe lëndën

---

## 13. Kontrolle sigurie ⭐

- [ ] Dil nga llogaria (ikona poshtë majtas)
- [ ] Ngjit adresën e një lënde direkt → të dërgon te `/login`
- [ ] **Hap një link klienti pa qenë i kyçur → duhet të punojë**

Ky i fundit është kontrolli më i rëndësishëm. Klienti nuk ka llogari; nëse
porta e Admin-it do t'i zinte edhe faqet e tij, i gjithë qëllimi i detyrës do
të prishej.

- [ ] Provo pesë fjalëkalime të gabuara radhazi → pas dhjetë përpjekjeve bllokohet
- [ ] Një hyrje e saktë **nuk** e konsumon atë kufi

---

## 14. Pamja

- [ ] Ngushtoje dritaren në gjerësi telefoni → tabelat rrëshqasin, asgjë nuk del jashtë
- [ ] Ndrysho temën e sistemit në **dark mode** → gjithçka mbetet e lexueshme
- [ ] Lundro vetëm me tastierën (Tab) → fokusi duket gjithmonë

---

## Çka dihet se nuk është bërë

Këto nuk janë gabime; janë zgjedhje të shkruara edhe në README:

- **Rate limiting-u numëron brenda një procesi.** Për një server është i saktë;
  për disa instanca do të duhej Redis.
- **Email-i nuk dërgohet vërtet** nëse `EMAIL_TRANSPORT` është `outbox`.
  Adapteri për Resend ekziston dhe aktivizohet me `EMAIL_TRANSPORT=resend` plus
  një `RESEND_API_KEY`.
- **Një zyrë, një Admin.** Nuk ka regjistrim dhe nuk ka ftesa përdoruesish.
  Skema e mban `firmId` kudo, pra zgjerimi do të ishte ndryshim query-sh, jo
  migrim.
- **Nuk është nënshkrim i kualifikuar elektronik** sipas eIDAS. Certifikata
  dokumenton kush nënshkroi, kur dhe çfarë, por pa autoritet certifikues.

---

## Nëse diçka prishet

| Simptoma | Shkaku i mundshëm |
|---|---|
| Çdo faqe jep gabim baze | Docker Desktop është i mbyllur |
| `npm run dev` nuk lidhet | Nis bazën me `npm run db:up` |
| Linqet e vjetra nuk punojnë | Seed-i i rigjeneron token-at sa herë nis |
| Testet e2e dështojnë | Rifresko të dhënat me `npm run db:seed` |
| Login bllokohet | Prit 15 minuta, ose ristarto dev server-in |
