require("dotenv").config({ path: ".env.local" });
async function main() {
  const { IS24ApiDriver, testConnection } = require("../src/lib/is24-api-driver");
  const d = new IS24ApiDriver();
  const conn = await testConnection();
  console.log("Found:", conn.listings, "listings on IS24");
  if (conn.listings === 0) { console.log("Already clean."); return; }

  const { createHmac, randomBytes } = require("crypto");
  const B = "https://rest.sandbox-immobilienscout24.de/restapi";
  const pe = (s: string) => encodeURIComponent(s).replace(/!/g, "%21").replace(/\*/g, "%2A");
  const sg = (m: string, u: string, p: Record<string, string>, cs: string, ts = "") => {
    const ps = Object.keys(p).sort().map(k => pe(k) + "=" + pe(p[k])).join("&");
    return createHmac("sha1", pe(cs) + "&" + pe(ts)).update([m.toUpperCase(), pe(u.split("?")[0]), pe(ps)].join("&")).digest("base64");
  };
  const ah = (m: string, u: string) => {
    const o: Record<string, string> = { oauth_consumer_key: process.env.IS24_CONSUMER_KEY!, oauth_nonce: randomBytes(16).toString("hex"), oauth_signature_method: "HMAC-SHA1", oauth_timestamp: Math.floor(Date.now() / 1000).toString(), oauth_version: "1.0", oauth_token: process.env.IS24_ACCESS_TOKEN! };
    o.oauth_signature = sg(m, u, o, process.env.IS24_SANDBOX_SECRET!, process.env.IS24_ACCESS_TOKEN_SECRET!);
    return "OAuth " + Object.entries(o).map(([k, v]) => pe(k) + '="' + pe(v) + '"').join(", ");
  };

  const url = B + "/api/offer/v1.0/user/me/realestate";
  const r = await fetch(url, { headers: { Authorization: ah("GET", url), Accept: "application/json" } });
  const body = await r.json();
  const entries = body?.["realestates.realEstates"]?.realEstateList?.realEstateElement;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];

  for (const e of list) {
    const id = String(e["@id"]);
    console.log("Deleting:", id, e.title?.slice(0, 40));
    try { await d.withdraw(id); console.log("  Done"); } catch (err: any) { console.log("  Skip:", err.message); }
  }

  const after = await testConnection();
  console.log("\nAfter cleanup:", after.listings, "listings");
}
main();
