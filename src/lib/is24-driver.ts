import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type { PortalDriver, PublishInput, PublishResult, PortalStatSnapshot, PortalLead } from "./portal-driver";

const IS24_BASE = "https://www.immobilienscout24.de";
const IS24_LOGIN = "https://sso.immobilienscout24.de/sso/login";

const TYPE_MAP: Record<string, string> = {
  ETW: "wohnung",
  EFH: "haus",
  MFH: "mehrfamilienhaus",
  DHH: "haus",
  RH: "haus",
  GRUNDSTUECK: "grundstueck",
};

export class IS24BrowserDriver implements PortalDriver {
  readonly portal = "IMMOSCOUT24";
  private email: string;
  private password: string;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(email?: string, password?: string) {
    this.email = email || process.env.IS24_EMAIL || "";
    this.password = password || process.env.IS24_PASSWORD || "";

    if (!this.email || !this.password) {
      throw new Error("IS24 Zugangsdaten fehlen (IS24_EMAIL / IS24_PASSWORD)");
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
    return this.browser;
  }

  private async getPage(): Promise<Page> {
    const browser = await this.getBrowser();

    if (!this.context) {
      this.context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        viewport: { width: 1440, height: 900 },
        locale: "de-DE",
      });
    }

    return await this.context.newPage();
  }

  private async login(page: Page): Promise<void> {
    console.log("[IS24] Navigating to login...");
    await page.goto(IS24_LOGIN, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Accept cookies if banner appears
    try {
      const cookieBtn = page.locator("#gdpr-consent-accept, button:has-text('Alle akzeptieren'), #consent-accept");
      await cookieBtn.first().click({ timeout: 5000 });
      console.log("[IS24] Cookie consent accepted");
    } catch {
      // No cookie banner
    }

    await page.waitForTimeout(1000);

    // Fill email
    const emailInput = page.locator('input[name="username"], input[type="email"], #username');
    await emailInput.first().fill(this.email);
    console.log("[IS24] Email entered");

    // Click submit/next
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Weiter"), button:has-text("Einloggen")');
    await submitBtn.first().click();
    await page.waitForTimeout(2000);

    // Fill password (may be on same page or next page)
    const passwordInput = page.locator('input[name="password"], input[type="password"], #password');
    await passwordInput.first().waitFor({ timeout: 10000 });
    await passwordInput.first().fill(this.password);
    console.log("[IS24] Password entered");

    // Submit login
    const loginBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Einloggen"), button:has-text("Anmelden")');
    await loginBtn.first().click();

    // Wait for redirect to dashboard
    await page.waitForURL(/immobilienscout24\.de/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log("[IS24] Post-login URL:", currentUrl);

    if (currentUrl.includes("sso.immobilienscout24") || currentUrl.includes("login")) {
      throw new Error("IS24 Login fehlgeschlagen — bitte Zugangsdaten pruefen");
    }

    console.log("[IS24] Login erfolgreich");
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const page = await this.getPage();

    try {
      await this.login(page);

      // Navigate to create listing
      console.log("[IS24] Navigating to create listing...");
      await page.goto(`${IS24_BASE}/anbieten/privat/`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      // Accept any additional cookie/consent dialogs
      try {
        const consentBtn = page.locator('button:has-text("Alle akzeptieren"), button:has-text("Akzeptieren")');
        await consentBtn.first().click({ timeout: 3000 });
      } catch { /* no consent dialog */ }

      // Select property type — "Verkaufen" (sell)
      try {
        const sellBtn = page.locator('button:has-text("Verkaufen"), a:has-text("Verkaufen"), [data-testid*="sell"]');
        await sellBtn.first().click({ timeout: 5000 });
        await page.waitForTimeout(1000);
      } catch {
        console.log("[IS24] No sell button found, might already be on form");
      }

      // Select type (Wohnung/Haus etc.)
      const typeLabel = TYPE_MAP[input.propertyType] || "wohnung";
      try {
        const typeBtn = page.locator(`button:has-text("${typeLabel}"), a:has-text("${typeLabel}"), label:has-text("${typeLabel}")`);
        await typeBtn.first().click({ timeout: 5000 });
        await page.waitForTimeout(1000);
      } catch {
        console.log("[IS24] Could not select property type, continuing...");
      }

      // Fill address
      await this.fillField(page, 'input[name*="street"], input[name*="strasse"], input[placeholder*="Straße"]', input.street);
      await this.fillField(page, 'input[name*="houseNumber"], input[name*="hausnummer"]', input.houseNumber);
      await this.fillField(page, 'input[name*="zip"], input[name*="postcode"], input[name*="plz"]', input.postcode);
      await this.fillField(page, 'input[name*="city"], input[name*="ort"], input[name*="stadt"]', input.city);

      // Fill details
      await this.fillField(page, 'input[name*="livingSpace"], input[name*="wohnflaeche"], input[name*="livingArea"]', String(input.livingArea));
      if (input.rooms) {
        await this.fillField(page, 'input[name*="room"], input[name*="zimmer"]', String(input.rooms));
      }
      await this.fillField(page, 'input[name*="price"], input[name*="preis"], input[name*="kaufpreis"]', String(input.price));

      // Fill title and description
      await this.fillField(page, 'input[name*="title"], input[name*="titel"]', input.title);
      await this.fillField(page, 'textarea[name*="description"], textarea[name*="beschreibung"]', input.description);

      // Energy certificate
      if (input.energyClass) {
        await this.fillField(page, 'input[name*="energy"], input[name*="energie"]', String(input.energyValue || ""));
      }

      // Try to submit / navigate through steps
      for (let step = 0; step < 5; step++) {
        try {
          const nextBtn = page.locator('button:has-text("Weiter"), button:has-text("Naechster"), button[type="submit"]:has-text("Weiter")');
          await nextBtn.first().click({ timeout: 3000 });
          await page.waitForTimeout(2000);
        } catch {
          break;
        }
      }

      // Upload photos
      if (input.photos.length > 0) {
        console.log("[IS24] Uploading photos...");
        try {
          const fileInput = page.locator('input[type="file"]');
          for (const photo of input.photos.slice(0, 15)) {
            try {
              const isUrl = photo.startsWith("http");
              if (!isUrl) {
                const path = require("path");
                const filePath = path.join(process.cwd(), "public", photo);
                await fileInput.first().setInputFiles(filePath);
                await page.waitForTimeout(1500);
              }
            } catch (e) {
              console.log("[IS24] Photo upload skipped:", photo, e);
            }
          }
        } catch {
          console.log("[IS24] No file input found for photos");
        }
      }

      // Final submit
      try {
        const publishBtn = page.locator('button:has-text("Veröffentlichen"), button:has-text("Inserat aufgeben"), button:has-text("Kostenpflichtig")');
        await publishBtn.first().click({ timeout: 5000 });
        await page.waitForTimeout(3000);
      } catch {
        console.log("[IS24] Could not find final publish button");
      }

      // Extract the listing ID from the URL or page
      const finalUrl = page.url();
      console.log("[IS24] Final URL:", finalUrl);

      const idMatch = finalUrl.match(/\/expose\/(\d+)/);
      const externalId = idMatch ? idMatch[1] : `is24-${Date.now()}`;

      // Try to extract from page content if not in URL
      let externalUrl = `${IS24_BASE}/expose/${externalId}`;
      try {
        const successLink = page.locator('a[href*="/expose/"]');
        const href = await successLink.first().getAttribute("href", { timeout: 3000 });
        if (href) {
          externalUrl = href.startsWith("http") ? href : `${IS24_BASE}${href}`;
          const match = href.match(/\/expose\/(\d+)/);
          if (match) {
            return { externalListingId: match[1], externalUrl };
          }
        }
      } catch { /* no success link */ }

      console.log("[IS24] Listing created:", externalId);
      return { externalListingId: externalId, externalUrl };
    } catch (err) {
      console.error("[IS24] Publish error:", err);
      // Take screenshot for debugging
      try {
        await page.screenshot({ path: "is24-error-publish.png" });
        console.log("[IS24] Error screenshot saved: is24-error-publish.png");
      } catch { /* ignore */ }
      throw err;
    } finally {
      await page.close();
    }
  }

  async update(externalId: string, input: Partial<PublishInput>): Promise<void> {
    const page = await this.getPage();
    try {
      await this.login(page);
      await page.goto(`${IS24_BASE}/meinkonto/exposes/${externalId}/bearbeiten`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      if (input.title) await this.fillField(page, 'input[name*="title"], input[name*="titel"]', input.title);
      if (input.description) await this.fillField(page, 'textarea[name*="description"], textarea[name*="beschreibung"]', input.description);
      if (input.price) await this.fillField(page, 'input[name*="price"], input[name*="preis"]', String(input.price));

      const saveBtn = page.locator('button:has-text("Speichern"), button[type="submit"]');
      await saveBtn.first().click({ timeout: 5000 });
      await page.waitForTimeout(2000);

      console.log("[IS24] Listing updated:", externalId);
    } catch (err) {
      console.error("[IS24] Update error:", err);
      try { await page.screenshot({ path: "is24-error-update.png" }); } catch { /* ignore */ }
      throw err;
    } finally {
      await page.close();
    }
  }

  async pause(externalId: string): Promise<void> {
    const page = await this.getPage();
    try {
      await this.login(page);
      await page.goto(`${IS24_BASE}/meinkonto/exposes`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      // Find listing and click deactivate
      const listingRow = page.locator(`[data-expose-id="${externalId}"], a[href*="${externalId}"]`);
      await listingRow.first().hover({ timeout: 5000 });
      const deactivateBtn = page.locator('button:has-text("Deaktivieren"), a:has-text("Deaktivieren")');
      await deactivateBtn.first().click({ timeout: 5000 });
      await page.waitForTimeout(2000);

      console.log("[IS24] Listing paused:", externalId);
    } catch (err) {
      console.error("[IS24] Pause error:", err);
      try { await page.screenshot({ path: "is24-error-pause.png" }); } catch { /* ignore */ }
      throw err;
    } finally {
      await page.close();
    }
  }

  async withdraw(externalId: string): Promise<void> {
    const page = await this.getPage();
    try {
      await this.login(page);
      await page.goto(`${IS24_BASE}/meinkonto/exposes`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      const deleteBtn = page.locator(`button:has-text("Löschen"), a:has-text("Löschen")`);
      await deleteBtn.first().click({ timeout: 5000 });

      // Confirm deletion
      const confirmBtn = page.locator('button:has-text("Endgültig löschen"), button:has-text("Ja, löschen"), button:has-text("Bestätigen")');
      await confirmBtn.first().click({ timeout: 5000 });
      await page.waitForTimeout(2000);

      console.log("[IS24] Listing withdrawn:", externalId);
    } catch (err) {
      console.error("[IS24] Withdraw error:", err);
      try { await page.screenshot({ path: "is24-error-withdraw.png" }); } catch { /* ignore */ }
      throw err;
    } finally {
      await page.close();
    }
  }

  async fetchStats(externalId: string): Promise<PortalStatSnapshot> {
    const page = await this.getPage();
    try {
      await this.login(page);
      await page.goto(`${IS24_BASE}/meinkonto/exposes/${externalId}/statistik`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);

      const getText = async (sel: string): Promise<number> => {
        try {
          const text = await page.locator(sel).first().textContent({ timeout: 3000 });
          return parseInt(text?.replace(/\D/g, "") || "0");
        } catch { return 0; }
      };

      const impressions = await getText('[data-testid*="impression"], .stat-impressions, :text("Aufrufe") + *');
      const detailViews = await getText('[data-testid*="detail"], .stat-detail, :text("Detailansichten") + *');
      const contactRequests = await getText('[data-testid*="contact"], .stat-contact, :text("Kontaktanfragen") + *');
      const bookmarks = await getText('[data-testid*="bookmark"], .stat-bookmark, :text("Merkzettel") + *');

      console.log("[IS24] Stats fetched:", { impressions, detailViews, contactRequests, bookmarks });
      return { impressions, detailViews, contactRequests, bookmarks };
    } catch (err) {
      console.error("[IS24] Stats error:", err);
      return { impressions: 0, detailViews: 0, contactRequests: 0, bookmarks: 0 };
    } finally {
      await page.close();
    }
  }

  async fetchLeads(externalId: string): Promise<PortalLead[]> {
    const page = await this.getPage();
    try {
      await this.login(page);
      await page.goto(`${IS24_BASE}/meinkonto/nachrichten`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);

      const leads: PortalLead[] = [];

      const messages = page.locator('.message-item, [data-testid*="message"], .contact-request');
      const count = await messages.count();

      for (let i = 0; i < Math.min(count, 20); i++) {
        try {
          const msg = messages.nth(i);
          const name = await msg.locator('.sender-name, .contact-name').first().textContent({ timeout: 2000 }) || "";
          const email = await msg.locator('.sender-email, a[href^="mailto"]').first().textContent({ timeout: 2000 }) || "";

          if (name && email) {
            leads.push({ name: name.trim(), email: email.trim() });
          }
        } catch { continue; }
      }

      console.log("[IS24] Leads fetched:", leads.length);
      return leads;
    } catch (err) {
      console.error("[IS24] Leads error:", err);
      return [];
    } finally {
      await page.close();
    }
    void externalId;
  }

  async close(): Promise<void> {
    if (this.context) { await this.context.close(); this.context = null; }
    if (this.browser) { await this.browser.close(); this.browser = null; }
  }

  private async fillField(page: Page, selector: string, value: string): Promise<void> {
    try {
      const field = page.locator(selector);
      await field.first().waitFor({ timeout: 3000 });
      await field.first().fill(value);
    } catch {
      // Field not found, skip
    }
  }
}
