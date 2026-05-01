/**
 * Full verification of IS24 listing: S3 photos, IS24 real estate, attachments, publish status
 */
require("dotenv").config({ path: ".env.local" });

const { createHmac, randomBytes } = require("crypto");

const B = "https://rest.sandbox-immobilienscout24.de/restapi";
const CK = process.env.IS24_CONSUMER_KEY!;
const CS = process.env.IS24_SANDBOX_SECRET!;
const AT = process.env.IS24_ACCESS_TOKEN!;
const ATS = process.env.IS24_ACCESS_TOKEN_SECRET!;

function pe(s: string) { return encodeURIComponent(s).replace(/!/g, "%21").replace(/\*/g, "%2A"); }
function sg(m: string, u: string, p: Record<string, string>, cs: string, ts = "") {
  const ps = Object.keys(p).sort().map((k) => pe(k) + "=" + pe(p[k])).join("&");
  const b = [m.toUpperCase(), pe(u.split("?")[0]), pe(ps)].join("&");
  return createHmac("sha1", pe(cs) + "&" + pe(ts)).update(b).digest("base64");
}
function ah(m: string, u: string) {
  const o: Record<string, string> = {
    oauth_consumer_key: CK, oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1", oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0", oauth_token: AT,
  };
  o.oauth_signature = sg(m, u, o, CS, ATS);
  return "OAuth " + Object.entries(o).map(([k, v]) => pe(k) + '="' + pe(v) + '"').join(", ");
}

async function apiGet(path: string) {
  const url = B + path;
  const r = await fetch(url, { headers: { Authorization: ah("GET", url), Accept: "application/json" } });
  return { status: r.status, body: await r.json().catch(() => r.text()) };
}

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  console.log("=== FULL IS24 + S3 VERIFICATION ===\n");

  // 1. Check S3 photos
  console.log("1. S3 PHOTO VERIFICATION");
  const media = await prisma.mediaAsset.findMany({
    where: { property: { listings: { some: { id: "cmojjg3zw003dj0iwxh8z0hm1" } } }, kind: "PHOTO" },
    orderBy: { ordering: "asc" },
  });
  console.log(`   ${media.length} photos in DB\n`);

  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    const url = m.storageKey;
    try {
      const r = await fetch(url, { method: "HEAD" });
      const size = Number(r.headers.get("content-length") || 0);
      const type = r.headers.get("content-type");
      console.log(`   Photo ${i + 1}: ${r.status} | ${(size / 1024).toFixed(0)} KB | ${type} | ${url.split("/").pop()}`);
    } catch (e: any) {
      console.log(`   Photo ${i + 1}: FETCH ERROR - ${e.message} | ${url}`);
    }
  }

  // 2. Check IS24 syndication target
  console.log("\n2. SYNDICATION TARGET");
  const target = await prisma.syndicationTarget.findFirst({
    where: { listingId: "cmojjg3zw003dj0iwxh8z0hm1" },
  });
  console.log(`   Status: ${target?.status}`);
  console.log(`   External ID: ${target?.externalListingId}`);
  console.log(`   URL: ${target?.externalUrl}`);

  const id = target?.externalListingId;
  if (!id) {
    console.log("\n   No external listing ID — cannot verify on IS24");
    await prisma.$disconnect();
    return;
  }

  // 3. Check IS24 listing via API
  console.log("\n3. IS24 LISTING (API)");
  const listing = await apiGet(`/api/offer/v1.0/user/me/realestate/${id}`);
  console.log(`   GET /realestate/${id}: ${listing.status}`);
  if (listing.status === 200) {
    const key = Object.keys(listing.body).find((k: string) => k.startsWith("realestates."));
    if (key) {
      const d = listing.body[key];
      console.log(`   Title: ${d.title}`);
      console.log(`   Price: ${d.price?.value} ${d.price?.currency}`);
      console.log(`   Rooms: ${d.numberOfRooms} | Bathrooms: ${d.numberOfBathRooms}`);
      console.log(`   LivingSpace: ${d.livingSpace} | PlotArea: ${d.plotArea}`);
      console.log(`   Condition: ${d.condition}`);
      console.log(`   Cellar: ${d.cellar} | Garden: ${d.garden}`);
      console.log(`   Courtage: ${JSON.stringify(d.courtage)}`);
      console.log(`   Contact: ${JSON.stringify(d.contact)}`);
      console.log(`   Energy: ${JSON.stringify(d.energyCertificate)}`);
      console.log(`   @publishDate: ${d["@publishDate"]}`);
      console.log(`   @creation: ${d["@creation"]}`);
    }
  }

  // 4. Check attachments on IS24
  console.log("\n4. IS24 ATTACHMENTS");
  const att = await apiGet(`/api/offer/v1.0/user/me/realestate/${id}/attachment`);
  console.log(`   GET /attachment: ${att.status}`);
  const attachments = att.body?.["common.attachments"]?.attachment;
  if (Array.isArray(attachments)) {
    console.log(`   ${attachments.length} attachments found:`);
    for (const a of attachments) {
      console.log(`     - ${a["@xsi.type"]} | title: ${a.title} | titlePicture: ${a.titlePicture} | id: ${a["@id"]}`);
    }
  } else if (attachments) {
    console.log(`   1 attachment: ${attachments.title}`);
  } else {
    console.log(`   NO attachments!`);
  }

  // 5. Check publish status
  console.log("\n5. IS24 PUBLISH STATUS");
  const pub = await apiGet(`/api/offer/v1.0/publish/${id}`);
  console.log(`   GET /publish/${id}: ${pub.status}`);
  if (pub.status === 200) {
    console.log(`   Published:`, JSON.stringify(pub.body).slice(0, 300));
  } else {
    console.log(`   Response:`, JSON.stringify(pub.body).slice(0, 300));
  }

  // 6. List ALL real estates
  console.log("\n6. ALL REAL ESTATES ON ACCOUNT");
  const all = await apiGet("/api/offer/v1.0/user/me/realestate");
  if (all.status === 200) {
    const entries = all.body?.["realestates.realEstates"]?.realEstateList?.realEstateElement;
    const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
    console.log(`   ${list.length} total listings:`);
    for (const e of list) {
      console.log(`     - ID: ${e["@id"]} | ${e.title} | published: ${e["@publishDate"] || "NO"}`);
    }
  }

  // 7. Try the expose URL directly
  console.log("\n7. EXPOSE PAGE TEST");
  const exposeUrl = `https://www.sandbox-immobilienscout24.de/expose/${id}`;
  try {
    const r = await fetch(exposeUrl, { redirect: "follow" });
    console.log(`   GET ${exposeUrl}: ${r.status}`);
    const html = await r.text();
    const hasOffer = !html.includes("No offer found") && !html.includes("Kein Angebot gefunden");
    console.log(`   Contains listing content: ${hasOffer}`);
    if (!hasOffer) {
      // Check if it redirects
      console.log(`   Final URL: ${r.url}`);
      console.log(`   Page title: ${html.match(/<title>([^<]+)</)?.[1] || "unknown"}`);
    }
  } catch (e: any) {
    console.log(`   FETCH ERROR: ${e.message}`);
  }

  await prisma.$disconnect();
  console.log("\n=== VERIFICATION COMPLETE ===");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
