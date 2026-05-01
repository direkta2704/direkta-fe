require("dotenv").config({ path: ".env.local" });

async function main() {
  const { IS24ApiDriver, testConnection } = require("../src/lib/is24-api-driver");
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  const d = new IS24ApiDriver();

  // 1. Clean orphan IS24 listings
  console.log("1. Cleaning orphan IS24 listings...");
  const conn = await testConnection();
  console.log("   Found:", conn.listings, "on IS24");

  // Get all IS24 listing IDs via API
  const { createHmac, randomBytes } = require("crypto");
  const B = "https://rest.sandbox-immobilienscout24.de/restapi";
  const CK = process.env.IS24_CONSUMER_KEY!;
  const CS = process.env.IS24_SANDBOX_SECRET!;
  const AT = process.env.IS24_ACCESS_TOKEN!;
  const ATS = process.env.IS24_ACCESS_TOKEN_SECRET!;
  function pe(s: string) { return encodeURIComponent(s).replace(/!/g, "%21").replace(/\*/g, "%2A"); }
  function sg(m: string, u: string, pp: Record<string, string>, cs: string, ts = "") {
    const ps = Object.keys(pp).sort().map((k) => pe(k) + "=" + pe(pp[k])).join("&");
    const b = [m.toUpperCase(), pe(u.split("?")[0]), pe(ps)].join("&");
    return createHmac("sha1", pe(cs) + "&" + pe(ts)).update(b).digest("base64");
  }
  function ah(m: string, u: string) {
    const o: Record<string, string> = { oauth_consumer_key: CK, oauth_nonce: randomBytes(16).toString("hex"), oauth_signature_method: "HMAC-SHA1", oauth_timestamp: Math.floor(Date.now() / 1000).toString(), oauth_version: "1.0", oauth_token: AT };
    o.oauth_signature = sg(m, u, o, CS, ATS);
    return "OAuth " + Object.entries(o).map(([k, v]) => pe(k) + '="' + pe(v) + '"').join(", ");
  }

  const url = B + "/api/offer/v1.0/user/me/realestate";
  const r = await fetch(url, { headers: { Authorization: ah("GET", url), Accept: "application/json" } });
  const body = await r.json();
  const entries = body?.["realestates.realEstates"]?.realEstateList?.realEstateElement;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];

  for (const e of list) {
    const id = String(e["@id"]);
    console.log("   Deleting:", id, e.title?.slice(0, 40));
    try { await d.withdraw(id); } catch (err: any) { console.log("   Skip:", err.message); }
  }

  const after = await testConnection();
  console.log("   After cleanup:", after.listings, "listings\n");

  // 2. Find a listing to publish
  console.log("2. Finding an ACTIVE listing to publish...");
  let listing = await p.listing.findFirst({
    where: { status: "ACTIVE", property: { userId: { not: undefined } } },
    include: { property: { include: { energyCert: true, media: { where: { kind: "PHOTO" }, take: 6 } } } },
  });

  if (!listing) {
    console.log("   No ACTIVE listing. Setting one to ACTIVE...");
    const draft = await p.listing.findFirst({
      where: { status: { in: ["DRAFT", "REVIEW", "RESERVED", "CLOSED"] } },
      include: { property: { include: { energyCert: true, media: { where: { kind: "PHOTO" }, take: 6 } } } },
    });
    if (draft) {
      await p.listing.update({ where: { id: draft.id }, data: { status: "ACTIVE" } });
      listing = { ...draft, status: "ACTIVE" } as typeof draft;
      console.log("   Activated:", listing.titleShort?.slice(0, 40));
    }
  }

  if (!listing) {
    console.log("   No listing available to publish");
    await p.$disconnect();
    return;
  }

  console.log("   Listing:", listing.titleShort?.slice(0, 40));
  console.log("   Photos:", listing.property.media.length);
  console.log("   Energy:", listing.property.energyCert ? "Yes" : "No");

  // 3. Check portal credential
  const cred = await p.portalCredential.findFirst({ where: { portal: "IMMOSCOUT24", status: "ACTIVE" } });
  if (!cred) {
    console.log("\n   No IS24 credential. Creating one...");
    const user = await p.user.findFirst();
    if (user) {
      const { encrypt } = require("../src/lib/crypto");
      await p.portalCredential.create({
        data: { userId: user.id, portal: "IMMOSCOUT24", username: "sandbox", passwordCipher: encrypt("sandbox"), consentedAt: new Date(), status: "ACTIVE" },
      });
      console.log("   Credential created");
    }
  } else {
    console.log("   IS24 credential: OK");
  }

  // 4. Publish
  console.log("\n3. Publishing to IS24...");
  const pr = listing.property;
  const result = await d.publish({
    title: listing.titleShort || `${pr.street} ${pr.houseNumber}`,
    description: listing.descriptionLong || "",
    price: listing.askingPrice ? Number(listing.askingPrice) : 0,
    propertyType: pr.type,
    livingArea: pr.livingArea,
    plotArea: pr.plotArea || pr.livingArea,
    rooms: pr.rooms,
    bathrooms: pr.bathrooms,
    floor: pr.floor,
    yearBuilt: pr.yearBuilt,
    condition: pr.condition,
    attributes: (pr.attributes as string[]) || [],
    city: pr.city,
    postcode: pr.postcode,
    street: pr.street,
    houseNumber: pr.houseNumber,
    photos: pr.media.map((m: any) => m.storageKey),
    energyClass: pr.energyCert?.energyClass || null,
    energyValue: pr.energyCert?.energyValue || null,
    energyCertType: pr.energyCert?.type || null,
    energyPrimarySource: pr.energyCert?.primarySource || null,
    sellerFirstName: null,
    sellerLastName: null,
    sellerEmail: null,
    sellerPhone: null,
  });

  console.log("   Published!");
  console.log("   ID:", result.externalListingId);
  console.log("   URL:", result.externalUrl);

  // 5. Save syndication target
  await p.syndicationTarget.create({
    data: {
      listingId: listing.id,
      portal: "IMMOSCOUT24",
      status: "LIVE",
      externalListingId: result.externalListingId,
      externalUrl: result.externalUrl,
      lastSyncedAt: new Date(),
    },
  });
  console.log("   Syndication target saved\n");

  const final = await testConnection();
  console.log("Final: IS24 has", final.listings, "listings");

  await p.$disconnect();
}
main().catch((e) => console.error("ERROR:", e));
