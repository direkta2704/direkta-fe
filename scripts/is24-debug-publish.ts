import { config } from "dotenv";
config({ path: ".env.local" });
import { createHmac, randomBytes } from "crypto";

const B = "https://rest.sandbox-immobilienscout24.de/restapi";
const CK = process.env.IS24_CONSUMER_KEY!;
const CS = process.env.IS24_SANDBOX_SECRET!;
const AT = process.env.IS24_ACCESS_TOKEN!;
const ATS = process.env.IS24_ACCESS_TOKEN_SECRET!;

function pe(s: string) {
  return encodeURIComponent(s).replace(/!/g, "%21").replace(/\*/g, "%2A");
}
function sg(m: string, u: string, p: Record<string, string>, cs: string, ts = "") {
  const ps = Object.keys(p).sort().map((k) => pe(k) + "=" + pe(p[k])).join("&");
  const b = [m.toUpperCase(), pe(u.split("?")[0]), pe(ps)].join("&");
  return createHmac("sha1", pe(cs) + "&" + pe(ts)).update(b).digest("base64");
}
function ah(m: string, u: string) {
  const o: Record<string, string> = {
    oauth_consumer_key: CK,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    oauth_token: AT,
  };
  o.oauth_signature = sg(m, u, o, CS, ATS);
  return "OAuth " + Object.entries(o).map(([k, v]) => pe(k) + '="' + pe(v) + '"').join(", ");
}

async function main() {
  const id = "325292309";

  // 1. Check listing exists
  console.log("1. Checking listing...");
  const getUrl = `${B}/api/offer/v1.0/user/me/realestate/${id}`;
  const gr = await fetch(getUrl, { headers: { Authorization: ah("GET", getUrl), Accept: "application/json" } });
  console.log("   GET listing:", gr.status);

  // 2. Try publish with JSON
  console.log("\n2. Publishing (JSON)...");
  const pubUrl = `${B}/api/offer/v1.0/publish`;
  const pubBody = { "common.publishObject": { realEstate: { "@id": id }, publishChannel: { "@id": "10000" } } };
  const pr = await fetch(pubUrl, {
    method: "POST",
    headers: { Authorization: ah("POST", pubUrl), "Content-Type": "application/json;charset=UTF-8", Accept: "application/json" },
    body: JSON.stringify(pubBody),
  });
  console.log("   POST publish:", pr.status);
  const pt = await pr.text();
  console.log("   Response:", pt.slice(0, 500));

  // 3. Try GET publish status
  console.log("\n3. Checking publish status...");
  const checkUrl = `${B}/api/offer/v1.0/publish/${id}`;
  const cr = await fetch(checkUrl, { headers: { Authorization: ah("GET", checkUrl), Accept: "application/json" } });
  console.log("   GET publish:", cr.status);
  console.log("   Response:", (await cr.text()).slice(0, 500));

  // 4. List all real estates to see state
  console.log("\n4. Listing all real estates...");
  const listUrl = `${B}/api/offer/v1.0/user/me/realestate`;
  const lr = await fetch(listUrl, { headers: { Authorization: ah("GET", listUrl), Accept: "application/json" } });
  console.log("   GET list:", lr.status);
  const lb = await lr.json();
  const entries = lb?.["realestates.realEstates"]?.realEstateList?.realEstateElement;
  if (Array.isArray(entries)) {
    entries.forEach((e: any) => console.log("   -", e["@id"], e.title, e["@publishDate"]));
  } else if (entries) {
    console.log("   -", entries["@id"], entries.title, entries["@publishDate"]);
  }

  // 5. Check attachments
  console.log("\n5. Checking attachments...");
  const attUrl = `${B}/api/offer/v1.0/user/me/realestate/${id}/attachment`;
  const ar = await fetch(attUrl, { headers: { Authorization: ah("GET", attUrl), Accept: "application/json" } });
  console.log("   GET attachments:", ar.status);
  const ab = await ar.text();
  console.log("   Response:", ab.slice(0, 500));
}

main().catch((e) => console.error(e));
