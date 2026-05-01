import { createHmac, randomBytes } from "crypto";
import type {
  PortalDriver,
  PublishInput,
  PublishResult,
  PortalStatSnapshot,
  PortalLead,
} from "./portal-driver";

// ── Config ──────────────────────────────────────────────────────────

const SANDBOX_BASE = "https://rest.sandbox-immobilienscout24.de/restapi";
const PROD_BASE = "https://rest.immobilienscout24.de/restapi";

function isSandbox(): boolean {
  return process.env.IS24_USE_SANDBOX === "true";
}

function baseUrl(): string {
  return isSandbox() ? SANDBOX_BASE : PROD_BASE;
}

function consumerKey(): string {
  return process.env.IS24_CONSUMER_KEY || "";
}

function consumerSecret(): string {
  return isSandbox()
    ? process.env.IS24_SANDBOX_SECRET || ""
    : process.env.IS24_CONSUMER_SECRET || "";
}

// ── OAuth 1.0a ──────────────────────────────────────────────────────

function pctEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

function nonce(): string {
  return randomBytes(16).toString("hex");
}

function timestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function sign(
  method: string,
  url: string,
  params: Record<string, string>,
  cSecret: string,
  tSecret = ""
): string {
  const paramStr = Object.keys(params)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(params[k])}`)
    .join("&");

  const base = [method.toUpperCase(), pctEncode(url.split("?")[0]), pctEncode(paramStr)].join("&");
  const key = `${pctEncode(cSecret)}&${pctEncode(tSecret)}`;
  return createHmac("sha1", key).update(base).digest("base64");
}

function authHeader(
  method: string,
  url: string,
  token = "",
  tokenSecret = "",
  extra: Record<string, string> = {}
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: consumerKey(),
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp(),
    oauth_version: "1.0",
    ...extra,
  };
  if (token) oauth.oauth_token = token;

  const allParams = { ...oauth };
  try {
    const u = new URL(url);
    u.searchParams.forEach((v, k) => {
      allParams[k] = v;
    });
  } catch {
    /* not a full URL yet */
  }

  oauth.oauth_signature = sign(method, url, allParams, consumerSecret(), tokenSecret);

  const hdr = Object.entries(oauth)
    .map(([k, v]) => `${pctEncode(k)}="${pctEncode(v)}"`)
    .join(", ");
  return `OAuth ${hdr}`;
}

// ── Token cache ─────────────────────────────────────────────────────

interface AccessToken {
  token: string;
  secret: string;
}

let cached: AccessToken | null = null;

async function obtainToken(): Promise<AccessToken> {
  if (cached) return cached;

  // If pre-configured access token exists (from prior authorization), use it directly
  if (process.env.IS24_ACCESS_TOKEN && process.env.IS24_ACCESS_TOKEN_SECRET) {
    cached = {
      token: process.env.IS24_ACCESS_TOKEN,
      secret: process.env.IS24_ACCESS_TOKEN_SECRET,
    };
    return cached;
  }

  throw new Error(
    "IS24 access token not configured. Run `npx tsx scripts/is24-authorize.ts` to authorize and obtain tokens."
  );
}

/**
 * Step 1 of the OAuth dance — get a request token and return the
 * authorization URL that the user must open in their browser.
 */
export async function startOAuthFlow(): Promise<{
  requestToken: string;
  requestTokenSecret: string;
  authorizeUrl: string;
}> {
  const base = baseUrl();
  const rtUrl = `${base}/security/oauth/request_token`;
  const rtAuth = authHeader("POST", rtUrl, "", "", { oauth_callback: "oob" });

  const res = await fetch(rtUrl, {
    method: "POST",
    headers: { Authorization: rtAuth },
  });
  if (!res.ok) {
    throw new Error(`IS24 request-token failed: ${res.status} ${await res.text()}`);
  }

  const body = new URLSearchParams(await res.text());
  const requestToken = body.get("oauth_token")!;
  const requestTokenSecret = body.get("oauth_token_secret")!;
  const authorizeUrl = `${base}/security/oauth/confirm_access?oauth_token=${encodeURIComponent(requestToken)}`;

  return { requestToken, requestTokenSecret, authorizeUrl };
}

/**
 * Step 2 of the OAuth dance — exchange the request token + verifier
 * (obtained after the user grants access in the browser) for an access token.
 */
export async function completeOAuthFlow(
  requestToken: string,
  requestTokenSecret: string,
  verifier: string
): Promise<{ accessToken: string; accessTokenSecret: string }> {
  const base = baseUrl();
  const atUrl = `${base}/security/oauth/access_token`;
  const atAuth = authHeader("POST", atUrl, requestToken, requestTokenSecret, {
    oauth_verifier: verifier,
  });

  const res = await fetch(atUrl, {
    method: "POST",
    headers: { Authorization: atAuth },
  });
  if (!res.ok) {
    throw new Error(`IS24 access-token failed: ${res.status} ${await res.text()}`);
  }

  const body = new URLSearchParams(await res.text());
  const accessToken = body.get("oauth_token")!;
  const accessTokenSecret = body.get("oauth_token_secret")!;

  // Cache it for the current process
  cached = { token: accessToken, secret: accessTokenSecret };

  return { accessToken, accessTokenSecret };
}

// ── Signed API request ──────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const { token, secret } = await obtainToken();
  const url = `${baseUrl()}${path}`;
  const auth = authHeader(method, url, token, secret);

  const headers: Record<string, string> = {
    Authorization: auth,
    Accept: "application/json",
  };
  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json;charset=UTF-8";
    init.body = JSON.stringify(body);
  }

  return fetch(url, init);
}

// ── Property-type mapping ───────────────────────────────────────────

interface TypeInfo {
  jsonKey: string;
  buildingType?: string;
}

const TYPE_MAP: Record<string, TypeInfo> = {
  ETW: { jsonKey: "realestates.apartmentBuy" },
  EFH: { jsonKey: "realestates.houseBuy", buildingType: "SINGLE_FAMILY_HOUSE" },
  MFH: { jsonKey: "realestates.houseBuy", buildingType: "MULTI_FAMILY_HOUSE" },
  DHH: { jsonKey: "realestates.houseBuy", buildingType: "SEMI_DETACHED_HOUSE" },
  RH: { jsonKey: "realestates.houseBuy", buildingType: "MID_TERRACE_HOUSE" },
  GRUNDSTUECK: { jsonKey: "realestates.livingBuySite" },
};

const CONDITION_MAP: Record<string, string> = {
  ERSTBEZUG: "FIRST_TIME_USE",
  GEPFLEGT: "WELL_KEPT",
  RENOVIERUNGS_BEDUERFTIG: "NEED_OF_RENOVATION",
  SANIERUNGS_BEDUERFTIG: "NEED_OF_RENOVATION",
  NEUBAU: "FIRST_TIME_USE_AFTER_REFURBISHMENT",
  ROHBAU: "SHELL_CONSTRUCTION",
};

const ENERGY_SOURCE_MAP: Record<string, string> = {
  Gas: "NATURAL_GAS",
  Erdgas: "NATURAL_GAS",
  Öl: "OIL",
  Oil: "OIL",
  Fernwärme: "DISTRICT_HEATING",
  Strom: "ELECTRICITY",
  Pellets: "PELLET_HEATING",
  Holz: "WOOD",
  Solar: "SOLAR_HEATING",
  Wärmepumpe: "HEAT_PUMP",
};

const ATTR_MAP: Record<string, string> = {
  Keller: "cellar",
  Stellplatz: "parking",
  Garage: "parking",
  Garten: "garden",
  Balkon: "balcony",
  Terrasse: "terrace",
  Aufzug: "lift",
  Fussbodenheizung: "floorHeating",
  "Gäste-WC": "guestToilet",
  "Smart Home": "smartHome",
};

function buildPayload(input: PublishInput): { key: string; data: Record<string, unknown> } {
  const info = TYPE_MAP[input.propertyType] || TYPE_MAP.ETW;

  const data: Record<string, unknown> = {
    title: input.title,
    descriptionNote: input.description,
    showAddress: true,
    address: {
      street: input.street,
      houseNumber: input.houseNumber,
      postcode: input.postcode,
      city: input.city,
    },
    livingSpace: input.livingArea,
    numberOfRooms: input.rooms ?? 1,
    price: {
      value: input.price,
      currency: "EUR",
      marketingType: "PURCHASE",
      priceIntervalType: "ONE_TIME_CHARGE",
    },
    courtage: {
      hasCourtage: "NO",
      courtage: "provisionsfrei",
    },
    freeFrom: "nach Vereinbarung",
  };

  // Seller contact
  if (input.sellerFirstName || input.sellerLastName) {
    data.contact = {
      firstname: input.sellerFirstName || "",
      lastname: input.sellerLastName || "",
      ...(input.sellerEmail && { email: input.sellerEmail }),
      ...(input.sellerPhone && { phoneNumber: input.sellerPhone }),
    };
  }

  // Basic fields
  const isHouseType = ["EFH", "MFH", "DHH", "RH"].includes(input.propertyType);
  if (input.plotArea) data.plotArea = input.plotArea;
  else if (isHouseType) data.plotArea = input.livingArea;
  if (input.floor != null) data.floor = input.floor;
  if (input.yearBuilt) data.constructionYear = input.yearBuilt;
  if (input.bathrooms) data.numberOfBathRooms = input.bathrooms;
  if (info.buildingType) data.buildingType = info.buildingType;
  if (input.condition && CONDITION_MAP[input.condition]) {
    data.condition = CONDITION_MAP[input.condition];
  }

  // Property features from attributes
  const attrs = new Set(input.attributes || []);
  if (attrs.has("Keller")) data.cellar = "YES";
  if (attrs.has("Gäste-WC")) data.guestToilet = "YES";
  if (attrs.has("Balkon")) data.balcony = true;
  if (attrs.has("Aufzug")) data.lift = "YES";
  if (attrs.has("Stellplatz") || attrs.has("Garage")) {
    data.numberOfParkingSpaces = 1;
    data.parkingSpaceType = attrs.has("Garage") ? "GARAGE" : "OUTDOOR";
  }
  if (attrs.has("Garten")) data.garden = true;
  if (attrs.has("Fussbodenheizung")) data.heatingType = "FLOOR_HEATING";

  // Energy certificate (GEG-compliant)
  if (input.energyValue) {
    const certType =
      input.energyCertType === "BEDARF" ? "ENERGY_REQUIRED" : "ENERGY_CONSUMPTION";
    const cert: Record<string, unknown> = {
      energyCertificateAvailability: "AVAILABLE",
      energyCertificateCreationDate: "FROM_MAY_2014",
      buildingEnergyRatingType: certType,
      thermalCharacteristic: input.energyValue,
    };
    // IS24 only accepts energyEfficiencyClass for Bedarfsausweis
    if (input.energyClass && certType === "ENERGY_REQUIRED") {
      cert.energyEfficiencyClass = input.energyClass.replace("+", "_PLUS");
    }
    if (input.energyPrimarySource) {
      const mapped = ENERGY_SOURCE_MAP[input.energyPrimarySource];
      if (mapped) {
        cert.energySourcesEnev2014 = { energySourceEnev2014: [mapped] };
      }
    }
    data.energyCertificate = cert;
  }

  return { key: info.jsonKey, data };
}

// ── Helpers ─────────────────────────────────────────────────────────

function extractId(res: Response, body: unknown): string {
  // Location header
  const loc = res.headers.get("Location") || "";
  const locMatch = loc.match(/\/(\d+)$/);
  if (locMatch) return locMatch[1];

  // Response body — multiple IS24 response shapes
  const obj = body as Record<string, unknown>;

  // { "common.messages": [{ id: "123" }] }
  const msgs =
    (obj?.["common.messages"] as Record<string, unknown>)?.message ??
    obj?.["common.messages"];
  if (Array.isArray(msgs) && msgs[0]?.id) return String(msgs[0].id);
  if (msgs && typeof msgs === "object" && (msgs as Record<string, unknown>).id)
    return String((msgs as Record<string, unknown>).id);

  // Direct id field
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && (v as Record<string, unknown>)["@id"])
      return String((v as Record<string, unknown>)["@id"]);
  }

  throw new Error("IS24: Could not extract listing ID from response");
}

// ── Driver ──────────────────────────────────────────────────────────

export class IS24ApiDriver implements PortalDriver {
  readonly portal = "IMMOSCOUT24";

  async publish(input: PublishInput): Promise<PublishResult> {
    console.log("[IS24-API] Creating real estate...");

    // 1. Create the real estate object
    const { key, data } = buildPayload(input);
    const createRes = await api("POST", "/api/offer/v1.0/user/me/realestate", { [key]: data });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`IS24 create failed: ${createRes.status} ${err}`);
    }

    const createBody = await createRes.json().catch(() => ({}));
    const realEstateId = extractId(createRes, createBody);
    console.log("[IS24-API] Real estate created:", realEstateId);

    // 2. Upload photos (best-effort)
    console.log(`[IS24-API] Uploading ${Math.min(input.photos.length, 15)} photos...`);
    for (let i = 0; i < Math.min(input.photos.length, 15); i++) {
      try {
        console.log(`[IS24-API] Photo ${i + 1}/${input.photos.length}: uploading...`);
        await this.uploadPhoto(realEstateId, input.photos[i], i === 0);
        console.log(`[IS24-API] Photo ${i + 1}: done`);
      } catch (e) {
        console.warn(`[IS24-API] Photo ${i + 1} skipped:`, e instanceof Error ? e.message : e);
      }
    }

    // 3. Publish to IS24 search (channel 10000)
    const pubRes = await api("POST", "/api/offer/v1.0/publish", {
      "common.publishObject": {
        realEstate: { "@id": realEstateId },
        publishChannel: { "@id": "10000" },
      },
    });
    if (!pubRes.ok) {
      console.warn("[IS24-API] Publish-to-channel returned", pubRes.status, "— listing exists but may not be searchable");
    }

    const domain = isSandbox()
      ? "www.sandbox-immobilienscout24.de"
      : "www.immobilienscout24.de";

    const result: PublishResult = {
      externalListingId: realEstateId,
      externalUrl: `https://${domain}/expose/${realEstateId}`,
    };

    console.log("[IS24-API] Published:", result.externalUrl);
    return result;
  }

  private async uploadPhoto(
    realEstateId: string,
    photoRef: string,
    titlePicture: boolean
  ): Promise<void> {
    const { token, secret } = await obtainToken();
    const url = `${baseUrl()}/api/offer/v1.0/user/me/realestate/${realEstateId}/attachment`;
    const auth = authHeader("POST", url, token, secret);

    let buf: Buffer;
    let mime: string;

    if (photoRef.startsWith("http")) {
      const photoRes = await fetch(photoRef);
      if (!photoRes.ok) throw new Error(`Fetch photo failed: ${photoRes.status}`);
      buf = Buffer.from(await photoRes.arrayBuffer());
      mime = photoRes.headers.get("content-type") || "image/jpeg";
    } else {
      // Try S3 first, then local filesystem
      const { getFromS3 } = await import("./s3");
      const key = photoRef.replace(/^\/+/, "");
      const data = await getFromS3(key);
      if (data) {
        const reader = data.body.getReader();
        const chunks: Uint8Array[] = [];
        let done = false;
        while (!done) {
          const r = await reader.read();
          done = r.done;
          if (r.value) chunks.push(r.value);
        }
        buf = Buffer.concat(chunks);
        mime = data.contentType;
      } else {
        // Fallback: read from local public/ directory
        const { readFile } = await import("fs/promises");
        const { join } = await import("path");
        const localPath = join(process.cwd(), "public", key);
        buf = await readFile(localPath);
        const ext = localPath.toLowerCase().split(".").pop();
        mime = ext === "png" ? "image/png" : "image/jpeg";
      }
    }

    const boundary = `----IS24${randomBytes(8).toString("hex")}`;
    const meta = JSON.stringify({
      "common.attachment": {
        "@xsi.type": "common:Picture",
        title: titlePicture ? "Titelbild" : "Foto",
        floorplan: false,
        titlePicture,
      },
    });

    const head = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json;charset=UTF-8\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\nContent-Disposition: form-data; name="attachment"; filename="photo.jpg"\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, buf, tail]);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Photo upload failed: ${res.status} ${await res.text()}`);
    }
  }

  async update(externalId: string, input: Partial<PublishInput>): Promise<void> {
    console.log("[IS24-API] Updating:", externalId);

    // GET current state to preserve fields we're not changing
    const getRes = await api("GET", `/api/offer/v1.0/user/me/realestate/${externalId}`);
    if (!getRes.ok) throw new Error(`IS24 GET failed: ${getRes.status}`);

    const existing = await getRes.json();
    const jsonKey =
      Object.keys(existing).find((k) => k.startsWith("realestates.")) ||
      "realestates.apartmentBuy";
    const data = existing[jsonKey] || {};

    if (input.title) data.title = input.title;
    if (input.description) data.descriptionNote = input.description;
    if (input.price) data.price = { ...data.price, value: input.price };
    if (input.livingArea) data.livingSpace = input.livingArea;
    if (input.rooms) data.numberOfRooms = input.rooms;

    const putRes = await api("PUT", `/api/offer/v1.0/user/me/realestate/${externalId}`, {
      [jsonKey]: data,
    });
    if (!putRes.ok) {
      throw new Error(`IS24 update failed: ${putRes.status} ${await putRes.text()}`);
    }
    console.log("[IS24-API] Updated:", externalId);
  }

  async pause(externalId: string): Promise<void> {
    console.log("[IS24-API] Pausing:", externalId);
    const res = await api("DELETE", `/api/offer/v1.0/publish/${externalId},10000`);
    if (!res.ok && res.status !== 404) {
      throw new Error(`IS24 pause failed: ${res.status} ${await res.text()}`);
    }
    console.log("[IS24-API] Paused:", externalId);
  }

  async withdraw(externalId: string): Promise<void> {
    console.log("[IS24-API] Withdrawing:", externalId);
    const res = await api("DELETE", `/api/offer/v1.0/user/me/realestate/${externalId}`);
    if (!res.ok && res.status !== 404) {
      throw new Error(`IS24 withdraw failed: ${res.status} ${await res.text()}`);
    }
    console.log("[IS24-API] Withdrawn:", externalId);
  }

  async fetchStats(externalId: string): Promise<PortalStatSnapshot> {
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 86_400_000);
    const dateFrom = from.toISOString().split("T")[0];
    const dateTo = now.toISOString().split("T")[0];

    const res = await api(
      "GET",
      `/api/offer/v1.0/user/me/realestate/${externalId}/dailystatistics?dateFrom=${dateFrom}&dateTo=${dateTo}`
    );

    if (!res.ok) {
      console.warn("[IS24-API] Stats unavailable:", res.status);
      return { impressions: 0, detailViews: 0, contactRequests: 0, bookmarks: 0 };
    }

    const body = await res.json();
    const entries =
      body?.["dailyStatistics.dailyStatisticsList"]?.dailyStatistics ??
      body?.dailyStatistics ??
      [];
    const list = Array.isArray(entries) ? entries : [entries];

    let impressions = 0,
      detailViews = 0,
      contactRequests = 0,
      bookmarks = 0;

    for (const e of list) {
      impressions += e?.searchResultListImpressions ?? e?.impressions ?? 0;
      detailViews += e?.exposeViews ?? e?.detailViewCount ?? 0;
      contactRequests += e?.emailContactCount ?? e?.contactRequests ?? 0;
      bookmarks += e?.bookmarkCount ?? e?.bookmarks ?? 0;
    }

    return { impressions, detailViews, contactRequests, bookmarks };
  }

  async fetchLeads(externalId: string): Promise<PortalLead[]> {
    try {
      const res = await api(
        "GET",
        `/api/offer/v1.0/user/me/realestate/${externalId}/contact`
      );
      if (!res.ok) return [];

      const body = await res.json();
      const contacts =
        body?.["contactRequest.contactRequests"]?.contactRequest ??
        body?.contactRequests ??
        [];
      const list = Array.isArray(contacts) ? contacts : [contacts];

      return list
        .filter((c: Record<string, unknown>) => {
          const d = c?.contactDetails as Record<string, unknown> | undefined;
          return d?.email;
        })
        .map((c: Record<string, unknown>) => {
          const d = c.contactDetails as Record<string, string>;
          return {
            name: [d.firstname, d.lastname].filter(Boolean).join(" "),
            email: d.email,
            phone: d.phoneNumber || undefined,
            message: (c.message as string) || undefined,
          };
        });
    } catch {
      return [];
    }
  }
}

// ── Exported test helper ────────────────────────────────────────────

export async function testConnection(): Promise<{
  ok: boolean;
  message: string;
  listings?: number;
}> {
  try {
    await obtainToken();
    const res = await api("GET", "/api/offer/v1.0/user/me/realestate");
    if (!res.ok) {
      return { ok: false, message: `API returned ${res.status}` };
    }
    const body = await res.json();
    const entries =
      body?.["realestates.realEstates"]?.realEstateList?.realEstateElement;
    const count = Array.isArray(entries) ? entries.length : entries ? 1 : 0;
    return { ok: true, message: "Verbindung erfolgreich", listings: count };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
