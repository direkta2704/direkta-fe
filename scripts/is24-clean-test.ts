/**
 * Clean IS24 test: create listing, upload 1 photo, verify, publish, verify expose
 */
require("dotenv").config({ path: ".env.local" });

import { createHmac, randomBytes } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";

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

async function apiJson(method: string, path: string, body?: any) {
  const url = B + path;
  const headers: Record<string, string> = { Authorization: ah(method, url), Accept: "application/json" };
  const init: RequestInit = { method, headers };
  if (body) { headers["Content-Type"] = "application/json;charset=UTF-8"; init.body = JSON.stringify(body); }
  const r = await fetch(url, init);
  const text = await r.text();
  return { status: r.status, text, json: () => { try { return JSON.parse(text); } catch { return text; } }, headers: r.headers };
}

async function main() {
  console.log("=== CLEAN IS24 TEST ===\n");

  // 0. Clean up ALL old listings
  console.log("0. Cleaning up old listings...");
  const all = await apiJson("GET", "/api/offer/v1.0/user/me/realestate");
  const entries = all.json()?.["realestates.realEstates"]?.realEstateList?.realEstateElement;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
  for (const e of list) {
    const id = e["@id"];
    const del = await apiJson("DELETE", `/api/offer/v1.0/user/me/realestate/${id}`);
    console.log(`   Deleted ${id}: ${del.status}`);
  }

  // 1. Create listing
  console.log("\n1. Creating listing...");
  const createBody = {
    "realestates.houseBuy": {
      title: "TEST MFH Gaggenau – 8 Zimmer",
      descriptionNote: "Gepflegtes Mehrfamilienhaus mit 3 Wohneinheiten in ruhiger Lage.",
      showAddress: true,
      address: { street: "Marktstraße", houseNumber: "12", postcode: "76571", city: "Gaggenau" },
      livingSpace: 250,
      plotArea: 450,
      numberOfRooms: 8,
      numberOfBathRooms: 3,
      buildingType: "MULTI_FAMILY_HOUSE",
      condition: "WELL_KEPT",
      constructionYear: 1999,
      cellar: "YES",
      freeFrom: "nach Vereinbarung",
      heatingType: "FLOOR_HEATING",
      price: { value: 525000, currency: "EUR", marketingType: "PURCHASE", priceIntervalType: "ONE_TIME_CHARGE" },
      courtage: { hasCourtage: "NO" },
      energyCertificate: {
        energyCertificateAvailability: "AVAILABLE",
        energyCertificateCreationDate: "FROM_MAY_2014",
        buildingEnergyRatingType: "ENERGY_CONSUMPTION",
        thermalCharacteristic: 70.2,
      },
    },
  };
  const cr = await apiJson("POST", "/api/offer/v1.0/user/me/realestate", createBody);
  console.log(`   Create: ${cr.status}`);
  console.log(`   Location: ${cr.headers.get("Location")}`);
  const loc = cr.headers.get("Location") || "";
  const idMatch = loc.match(/\/(\d+)$/);
  const msgs = cr.json()?.["common.messages"];
  let id = "";
  if (idMatch) { id = idMatch[1]; }
  else if (Array.isArray(msgs)) { id = String(msgs[0]?.message?.id || msgs[0]?.id); }
  else if (msgs?.message) { const m = Array.isArray(msgs.message) ? msgs.message[0] : msgs.message; id = String(m.id); }
  console.log(`   Listing ID: ${id}`);
  if (!id || id === "undefined") { console.log("   FAILED to get ID"); return; }

  // 2. Upload ONE photo (small — resize first)
  console.log("\n2. Uploading photo...");
  const photoPath = join(process.cwd(), "public", "uploads", "cmojjb6jj0027j0iw38kjgdtl", "3063ea70-569d-4f6f-8979-66b84b9f0688.JPG");
  let buf = await readFile(photoPath);
  console.log(`   Original: ${(buf.length / 1024).toFixed(0)} KB`);

  // Resize to < 5MB for safety
  const sharp = require("sharp");
  buf = await sharp(buf).resize({ width: 1920, height: 1920, fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
  console.log(`   Resized: ${(buf.length / 1024).toFixed(0)} KB`);

  const url = `${B}/api/offer/v1.0/user/me/realestate/${id}/attachment`;
  const boundary = "----IS24" + randomBytes(8).toString("hex");
  const meta = JSON.stringify({ "common.attachment": { "@xsi.type": "common:Picture", title: "Titelbild", floorplan: false, titlePicture: true } });
  const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json;charset=UTF-8\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Disposition: form-data; name="attachment"; filename="photo.jpg"\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, buf, tail]);

  const uploadRes = await fetch(url, {
    method: "POST",
    headers: { Authorization: ah("POST", url), "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  console.log(`   Upload: ${uploadRes.status}`);
  console.log(`   Response: ${(await uploadRes.text()).slice(0, 200)}`);

  // 3. Verify attachment
  console.log("\n3. Verifying attachment...");
  const att = await apiJson("GET", `/api/offer/v1.0/user/me/realestate/${id}/attachment`);
  console.log(`   Attachments: ${att.status}`);
  const atts = att.json()?.["common.attachments"]?.attachment;
  const attList = Array.isArray(atts) ? atts : atts ? [atts] : [];
  console.log(`   Count: ${attList.length}`);
  attList.forEach((a: any) => console.log(`   - ${a.title} | type: ${a["@xsi.type"]} | id: ${a["@id"]}`));

  // 4. Publish to channel
  console.log("\n4. Publishing to search channel...");
  const pubRes = await apiJson("POST", "/api/offer/v1.0/publish", {
    "common.publishObject": { realEstate: { "@id": id }, publishChannel: { "@id": "10000" } },
  });
  console.log(`   Publish: ${pubRes.status}`);
  console.log(`   Response: ${pubRes.text.slice(0, 200)}`);

  // 5. Check expose page
  console.log("\n5. Checking expose page...");
  const exposeUrl = `https://www.sandbox-immobilienscout24.de/expose/${id}`;
  console.log(`   URL: ${exposeUrl}`);
  const er = await fetch(exposeUrl, { redirect: "follow" });
  console.log(`   HTTP: ${er.status}`);
  const html = await er.text();
  const hasTitle = html.includes("TEST MFH Gaggenau") || html.includes("Gaggenau");
  const hasNoOffer = html.includes("No offer found") || html.includes("Kein Angebot");
  console.log(`   Has listing title: ${hasTitle}`);
  console.log(`   Shows 'No offer found': ${hasNoOffer}`);

  console.log(`\n=== RESULT: Listing ${id} ===`);
  console.log(`URL: ${exposeUrl}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
