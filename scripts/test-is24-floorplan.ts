require("dotenv").config({ path: ".env.local" });

async function main() {
  const { IS24ApiDriver, testConnection } = require("../src/lib/is24-api-driver");
  const { PrismaClient } = require("@prisma/client");
  const { readFile } = require("fs/promises");
  const { join } = require("path");
  const p = new PrismaClient();

  console.log("=== IS24 FLOOR PLAN TEST ===\n");

  // 1. Get listing with floor plans
  const listing = await p.listing.findFirst({
    where: { status: "ACTIVE", property: { media: { some: { kind: "FLOORPLAN" } } } },
    include: {
      property: {
        include: {
          energyCert: true,
          media: { where: { kind: { in: ["PHOTO", "FLOORPLAN"] } }, orderBy: { ordering: "asc" } },
          user: { select: { name: true, email: true, phone: true } },
        },
      },
    },
  });

  if (!listing) { console.log("No active listing"); return; }

  const pr = listing.property;
  const photos = pr.media.filter((m: any) => m.kind === "PHOTO");
  const floorplans = pr.media.filter((m: any) => m.kind === "FLOORPLAN");

  console.log("Listing:", listing.titleShort?.slice(0, 40));
  console.log("Photos:", photos.length);
  console.log("Floor plans:", floorplans.length);
  floorplans.forEach((fp: any) => console.log("  -", fp.fileName, fp.storageKey?.slice(0, 60)));

  // 2. Clean old IS24 listings
  const d = new IS24ApiDriver();
  const conn = await testConnection();
  if (conn.listings > 0) {
    console.log("\nCleaning", conn.listings, "old IS24 listings...");
    // Quick cleanup via API
    const { createHmac, randomBytes } = require("crypto");
    const B = "https://rest.sandbox-immobilienscout24.de/restapi";
    const CK = process.env.IS24_CONSUMER_KEY!;
    const CS = process.env.IS24_SANDBOX_SECRET!;
    const AT = process.env.IS24_ACCESS_TOKEN!;
    const ATS = process.env.IS24_ACCESS_TOKEN_SECRET!;
    function pe(s: string) { return encodeURIComponent(s).replace(/!/g, "%21").replace(/\*/g, "%2A"); }
    function sg(m: string, u: string, pp: Record<string, string>, cs: string, ts = "") {
      const ps = Object.keys(pp).sort().map(k => pe(k) + "=" + pe(pp[k])).join("&");
      return createHmac("sha1", pe(cs) + "&" + pe(ts)).update([m.toUpperCase(), pe(u.split("?")[0]), pe(ps)].join("&")).digest("base64");
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
      try { await d.withdraw(String(e["@id"])); console.log("  Deleted", e["@id"]); } catch {}
    }
  }

  // 3. Publish with floor plans
  console.log("\nPublishing...");
  const mediaKeys = [
    ...photos.map((m: any) => m.storageKey),
    ...floorplans.map((m: any) => `floorplan:${m.storageKey}`),
  ];
  console.log("Media to upload:", mediaKeys.length, `(${photos.length} photos + ${floorplans.length} floor plans)`);

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
    photos: mediaKeys,
    energyClass: pr.energyCert?.energyClass || null,
    energyValue: pr.energyCert?.energyValue || null,
    energyCertType: pr.energyCert?.type || null,
    energyPrimarySource: pr.energyCert?.primarySource || null,
    sellerFirstName: pr.user?.name?.split(" ")[0] || null,
    sellerLastName: pr.user?.name?.split(" ").slice(1).join(" ") || null,
    sellerEmail: pr.user?.email || null,
    sellerPhone: pr.user?.phone || null,
  });

  console.log("\nPublished:", result.externalListingId);
  console.log("URL:", result.externalUrl);

  // 4. Verify attachments
  const { createHmac: ch, randomBytes: rb } = require("crypto");
  const B2 = "https://rest.sandbox-immobilienscout24.de/restapi";
  function ah2(m: string, u: string) {
    const o: Record<string, string> = { oauth_consumer_key: process.env.IS24_CONSUMER_KEY!, oauth_nonce: rb(16).toString("hex"), oauth_signature_method: "HMAC-SHA1", oauth_timestamp: Math.floor(Date.now() / 1000).toString(), oauth_version: "1.0", oauth_token: process.env.IS24_ACCESS_TOKEN! };
    const pe2 = (s: string) => encodeURIComponent(s).replace(/!/g, "%21").replace(/\*/g, "%2A");
    const ps = Object.keys(o).sort().map(k => pe2(k) + "=" + pe2(o[k])).join("&");
    const base = [m.toUpperCase(), pe2(u.split("?")[0]), pe2(ps)].join("&");
    o.oauth_signature = ch("sha1", pe2(process.env.IS24_SANDBOX_SECRET!) + "&" + pe2(process.env.IS24_ACCESS_TOKEN_SECRET!)).update(base).digest("base64");
    return "OAuth " + Object.entries(o).map(([k, v]) => pe2(k) + '="' + pe2(v) + '"').join(", ");
  }
  const attUrl = `${B2}/api/offer/v1.0/user/me/realestate/${result.externalListingId}/attachment`;
  const ar = await fetch(attUrl, { headers: { Authorization: ah2("GET", attUrl), Accept: "application/json" } });
  const ab = await ar.json();
  const atts = ab?.["common.attachments"]?.attachment;
  const attList = Array.isArray(atts) ? atts : atts ? [atts] : [];
  console.log("\nAttachments on IS24:", attList.length);
  attList.forEach((a: any) => console.log("  -", a.title, "| floorplan:", a.floorplan, "| titlePicture:", a.titlePicture));

  await p.$disconnect();
}
main().catch(e => console.error("ERROR:", e));
