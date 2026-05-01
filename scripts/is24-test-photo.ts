import { config } from "dotenv";
config({ path: ".env.local" });
import { readFile } from "fs/promises";
import { join } from "path";
import { createHmac, randomBytes } from "crypto";

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

async function main() {
  const id = "325292320";
  const photoFile = join(process.cwd(), "public", "uploads", "cmojjb6jj0027j0iw38kjgdtl", "d05f8078-fa60-4767-aae5-2c6c28b502ae.JPG");

  console.log("1. Reading photo...");
  const buf = await readFile(photoFile);
  console.log("   Size:", buf.length, "bytes");

  console.log("\n2. Uploading to IS24 listing", id, "...");
  const url = `${B}/api/offer/v1.0/user/me/realestate/${id}/attachment`;
  const boundary = "----IS24Boundary" + randomBytes(8).toString("hex");

  const meta = JSON.stringify({
    "common.attachment": {
      "@xsi.type": "common:Picture",
      title: "Titelbild",
      floorplan: false,
      titlePicture: true,
    },
  });

  const parts = [
    `--${boundary}\r\n`,
    `Content-Type: application/json;charset=UTF-8\r\n`,
    `Content-Disposition: form-data; name="metadata"\r\n\r\n`,
    `${meta}\r\n`,
    `--${boundary}\r\n`,
    `Content-Type: image/jpeg\r\n`,
    `Content-Disposition: form-data; name="attachment"; filename="photo.jpg"\r\n\r\n`,
  ];
  const head = Buffer.from(parts.join(""));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, buf, tail]);

  console.log("   Multipart body:", body.length, "bytes");

  const auth = ah("POST", url);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  console.log("   Response:", res.status);
  const text = await res.text();
  console.log("   Body:", text.slice(0, 500));

  // 3. Check attachments
  console.log("\n3. Checking attachments...");
  const attUrl = `${B}/api/offer/v1.0/user/me/realestate/${id}/attachment`;
  const ar = await fetch(attUrl, { headers: { Authorization: ah("GET", attUrl), Accept: "application/json" } });
  console.log("   Attachments:", ar.status, (await ar.text()).slice(0, 300));
}

main().catch((e) => console.error("ERROR:", e));
