import puppeteer from "puppeteer";

// ── Public interfaces (unchanged) ────────────────────────────────────

export interface ExposePhoto {
  bytes: Uint8Array;
  mimeType: string;
  roomType?: string;
  caption?: string;
  description?: string;
  features?: string[];
}

export interface ExposeUnit {
  label: string;
  livingArea: number;
  rooms: number | null;
  bathrooms?: number;
  floor?: number;
  askingPrice?: number;
  titleShort?: string;
  roomProgram?: { name: string; area: number }[];
  photos: ExposePhoto[];
  floorPlans: ExposePhoto[];
}

export interface ExposeData {
  titleShort: string;
  descriptionLong: string;
  address: string;
  city: string;
  propertyType: string;
  livingArea: number;
  rooms: number | null;
  yearBuilt: number | null;
  condition: string;
  askingPrice: number | null;
  priceBand: { low: number; median: number; high: number; confidence: string } | null;
  energy: { class: string; value: number; source: string; type: string; validUntil: string } | null;
  attributes: string[];
  photos: ExposePhoto[];
  floorPlans?: ExposePhoto[];
  generatedAt: string;
  postcode?: string;
  contact?: { name?: string; email?: string; phone?: string };
  locationDescription?: string;
  bathrooms?: number;
  floor?: number;
  plotArea?: number;
  roomProgram?: { name: string; area: number }[];
  highlights?: string[];
  exposeHeadline?: string;
  exposeSubheadline?: string;
  units?: ExposeUnit[];
  specifications?: Record<string, string>;
  buildingDescription?: string;
}

// ── Grunderwerbsteuer helper ─────────────────────────────────────────

function grunderwerbsteuer(postcode: string): { land: string; rate: number } {
  const p = parseInt(postcode.slice(0, 2)) || 0;
  if (p <= 4) return { land: "Sachsen", rate: 5.5 };
  if (p <= 6) return { land: "Sachsen-Anhalt", rate: 5.0 };
  if (p <= 9) return { land: "Thüringen", rate: 5.0 };
  if (p <= 12) return { land: "Berlin", rate: 6.0 };
  if (p <= 16) return { land: "Brandenburg", rate: 6.5 };
  if (p <= 19) return { land: "Mecklenburg-Vorpommern", rate: 6.0 };
  if (p <= 21) return { land: "Hamburg", rate: 5.5 };
  if (p <= 25) return { land: "Schleswig-Holstein", rate: 6.5 };
  if (p <= 27) return { land: "Niedersachsen", rate: 5.0 };
  if (p <= 29) return { land: "Bremen", rate: 5.0 };
  if (p <= 31) return { land: "Niedersachsen", rate: 5.0 };
  if (p <= 33) return { land: "Nordrhein-Westfalen", rate: 6.5 };
  if (p <= 36) return { land: "Hessen", rate: 6.0 };
  if (p <= 38) return { land: "Niedersachsen", rate: 5.0 };
  if (p <= 39) return { land: "Sachsen-Anhalt", rate: 5.0 };
  if (p <= 53) return { land: "Nordrhein-Westfalen", rate: 6.5 };
  if (p <= 56) return { land: "Rheinland-Pfalz", rate: 5.0 };
  if (p <= 59) return { land: "Nordrhein-Westfalen", rate: 6.5 };
  if (p <= 65) return { land: "Hessen", rate: 6.0 };
  if (p <= 66) return { land: "Saarland", rate: 6.5 };
  if (p <= 69) return { land: "Rheinland-Pfalz", rate: 5.0 };
  if (p <= 79) return { land: "Baden-Württemberg", rate: 5.0 };
  if (p <= 87) return { land: "Bayern", rate: 3.5 };
  if (p <= 89) return { land: "Baden-Württemberg", rate: 5.0 };
  if (p <= 97) return { land: "Bayern", rate: 3.5 };
  return { land: "Thüringen", rate: 5.0 };
}

const ROOM_TYPE_DE: Record<string, string> = {
  exterior: "Außenansicht", living: "Wohnzimmer", kitchen: "Küche",
  bathroom: "Badezimmer", bedroom: "Schlafzimmer", office: "Arbeitszimmer",
  hallway: "Flur / Eingangsbereich", balcony: "Balkon / Loggia",
  garden: "Garten / Außenbereich", garage: "Garage / Stellplatz",
  basement: "Keller / Untergeschoss", floorplan: "Grundriss", other: "Impressionen",
};

function photoCaption(photo: ExposePhoto): string {
  if (photo.caption) return photo.caption;
  return ROOM_TYPE_DE[photo.roomType || "other"] || "Impressionen";
}

// ── Formatting helpers ───────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtArea(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m²";
}

function fmtAreaShort(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " m²";
}

function fmtPrice(n: number): string {
  return "EUR " + n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPriceEuro(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

function toDataUrl(photo: ExposePhoto): string {
  return `data:${photo.mimeType};base64,${Buffer.from(photo.bytes).toString("base64")}`;
}

function floorLabel(floor: number): string {
  if (floor === 0) return "EG";
  if (floor < 0) return `${Math.abs(floor)}. UG`;
  return `${floor}. OG`;
}

function floorLabelLong(floor: number): string {
  if (floor === 0) return "Erdgeschoss";
  if (floor < 0) return `${Math.abs(floor)}. Untergeschoss`;
  return `${floor}. Obergeschoss`;
}

function energyBadgeColor(cls: string): string {
  const m: Record<string, string> = {
    "A+": "#008000", A: "#4fa84f", B: "#8bc34a", C: "#cddc39",
    D: "#ffeb3b", E: "#ff9800", F: "#ff5722", G: "#d32f2f", H: "#b71c1c",
  };
  return m[cls] || "#808080";
}

// ── HTML builder ─────────────────────────────────────────────────────

function buildExposeHtml(data: ExposeData): string {
  const isBundle = data.units && data.units.length > 0;
  const totalArea = isBundle
    ? data.units!.reduce((s, u) => s + u.livingArea, 0)
    : data.livingArea;

  let sectionIdx = 0;
  const sections: string[] = [];

  // ────────────────────────────── COVER PAGE
  {
    const heroUrl = data.photos.length > 0 ? toDataUrl(data.photos[0]) : "";
    const streetAddress = data.address.split(",")[0].trim();
    const coverTitle = esc(streetAddress);
    const coverSub = data.exposeHeadline
      ? esc(data.exposeHeadline)
      : data.exposeSubheadline
        ? esc(data.exposeSubheadline)
        : esc(data.descriptionLong.split("\n")[0].slice(0, 160));

    const eyebrowParts: string[] = [esc(data.propertyType)];
    if (isBundle) eyebrowParts.push(`${data.units!.length} Wohneinheiten`);
    eyebrowParts.push(esc(data.city));
    const eyebrow = eyebrowParts.join(" &middot; ");

    interface CoverFact { label: string; value: string; unit?: string }
    const facts: CoverFact[] = [
      { label: "WOHNFLÄCHE", value: fmtAreaShort(totalArea) },
    ];
    if (isBundle) {
      facts.push({ label: "EINHEITEN", value: `${data.units!.length} WE` });
    } else if (data.rooms) {
      facts.push({ label: "ZIMMER", value: String(data.rooms) });
    }
    if (data.yearBuilt) facts.push({ label: "BAUJAHR", value: String(data.yearBuilt) });
    if (data.condition) facts.push({ label: "ZUSTAND", value: esc(data.condition) });
    if (facts.length < 4 && data.askingPrice) {
      facts.push({ label: "KAUFPREIS", value: fmtPriceEuro(data.askingPrice) });
    }

    const factsHtml = facts.map((f, i) => `
      <div class="cover-fact${i < facts.length - 1 ? " cover-fact--border" : ""}">
        <span class="cover-fact__label">${f.label}</span>
        <span class="cover-fact__value">${f.value}</span>
      </div>
    `).join("");

    const conditionBadge = data.condition
      ? `<div class="cover-badge">${esc(data.condition)}</div>`
      : "";

    sections.push(`
      <div class="page cover-page">
        ${heroUrl ? `<img class="cover-hero" src="${heroUrl}" alt="" />` : `<div class="cover-hero cover-hero--placeholder"></div>`}
        <div class="cover-gradient-top"></div>
        <div class="cover-gradient-bottom"></div>
        <div class="cover-brand">DIREKTA &middot; Verkauf</div>
        ${conditionBadge}
        <div class="cover-content">
          <div class="cover-eyebrow">${eyebrow}</div>
          <h1 class="cover-title">${coverTitle}</h1>
          <p class="cover-subtitle">${coverSub}</p>
          <div class="cover-address">${esc(streetAddress)} &middot; ${esc(data.postcode || "")} ${esc(data.city)}</div>
          <div class="cover-facts">${factsHtml}</div>
        </div>
        <div class="cover-footer">
          <span>Expos&eacute; &middot; Stand ${esc(data.generatedAt)}</span>
          <span>www.direkta.de</span>
        </div>
      </div>
    `);
  }

  // ────────────────────────────── AUF EINEN BLICK
  {
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, "0");

    const highlightsHtml = (data.highlights && data.highlights.length > 0)
      ? data.highlights.slice(0, 10).map(h => `<li>&mdash; ${esc(h)}</li>`).join("")
      : data.attributes.slice(0, 10).map(a => `<li>&mdash; ${esc(a)}</li>`).join("");

    interface FactRow { label: string; value: string }
    const factRows: FactRow[] = [
      { label: "Adresse", value: `${esc(data.address)}, ${esc(data.city)}` },
      { label: "Objekttyp", value: esc(data.propertyType) },
      { label: "Wohnfläche", value: fmtAreaShort(totalArea) },
    ];
    if (isBundle) factRows.push({ label: "Wohneinheiten", value: String(data.units!.length) });
    if (!isBundle && data.rooms) factRows.push({ label: "Zimmer", value: String(data.rooms) });
    if (!isBundle && data.bathrooms) factRows.push({ label: "Badezimmer", value: String(data.bathrooms) });
    if (!isBundle && data.floor != null) factRows.push({ label: "Etage", value: floorLabelLong(data.floor) });
    if (data.plotArea) factRows.push({ label: "Grundstücksfläche", value: fmtAreaShort(data.plotArea) });
    if (data.yearBuilt) factRows.push({ label: "Baujahr", value: String(data.yearBuilt) });
    if (data.condition) factRows.push({ label: "Zustand", value: esc(data.condition) });
    if (data.askingPrice) factRows.push({
      label: "Kaufpreis",
      value: isBundle
        ? `${fmtPriceEuro(data.askingPrice)} (Paket)`
        : fmtPriceEuro(data.askingPrice),
    });
    if (data.priceBand) factRows.push({
      label: "Preisempfehlung",
      value: `${fmtPriceEuro(data.priceBand.low)} – ${fmtPriceEuro(data.priceBand.high)} (${esc(data.priceBand.confidence)})`,
    });

    const factsRowsHtml = factRows.map(r => `
      <div class="fact-row">
        <span class="fact-row__label">${r.label}</span>
        <span class="fact-row__value">${r.value}</span>
      </div>
    `).join("");

    const leadText = esc(data.descriptionLong.split("\n\n")[0] || data.descriptionLong.split("\n")[0] || data.titleShort);

    sections.push(`
      <div class="page content-page">
        <div class="page-header">
          <span class="header-brand">DIREKTA<span class="accent">.</span></span>
          <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
        </div>
        <div class="section-eyebrow">${num} &mdash; Auf einen Blick</div>
        <h2 class="section-title">Auf einen Blick</h2>
        <div class="gold-rule"></div>
        <p class="lead-text">${leadText}</p>
        <div class="two-col">
          <div class="two-col__left">
            <ul class="highlights-list">${highlightsHtml}</ul>
          </div>
          <div class="two-col__right">
            <div class="facts-panel">${factsRowsHtml}</div>
          </div>
        </div>
        <div class="page-footer">
          <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
          <span class="footer-section">Auf einen Blick</span>
        </div>
      </div>
    `);
  }

  // ────────────────────────────── OBJEKTBESCHREIBUNG
  {
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, "0");
    const desc = data.descriptionLong.replace(/\r\n/g, "\n");
    const paras = desc.split("\n\n").filter(Boolean);
    const leadPara = paras[0] || "";
    const restParas = paras.slice(1);

    const restHtml = restParas.map(p => `<p>${esc(p)}</p>`).join("");

    const attrsHtml = data.attributes.length > 0
      ? `<div class="attr-section">
          <div class="attr-label">AUSSTATTUNG</div>
          ${data.attributes.map(a => `<div class="attr-item"><span class="attr-dash">&mdash;</span> ${esc(a)}</div>`).join("")}
        </div>`
      : "";

    sections.push(`
      <div class="page content-page">
        <div class="page-header">
          <span class="header-brand">DIREKTA<span class="accent">.</span></span>
          <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
        </div>
        <div class="section-eyebrow">${num} &mdash; Objektbeschreibung</div>
        <h2 class="section-title">${esc(data.titleShort)}</h2>
        <div class="gold-rule"></div>
        <p class="lead-text">${esc(leadPara)}</p>
        <div class="desc-body two-col-text">${restHtml}</div>
        ${attrsHtml}
        <div class="page-footer">
          <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
          <span class="footer-section">Objektbeschreibung</span>
        </div>
      </div>
    `);
  }

  // ────────────────────────────── AUSSTATTUNG & MATERIALIEN
  if (data.specifications && Object.keys(data.specifications).length > 0) {
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, "0");
    const entries = Object.entries(data.specifications);
    const half = Math.ceil(entries.length / 2);
    const leftEntries = entries.slice(0, half);
    const rightEntries = entries.slice(half);

    const renderSpecCol = (specs: [string, string][]): string =>
      specs.map(([label, value]) => `
        <div class="spec-item">
          <div class="spec-item__label">${esc(label)}</div>
          <div class="spec-item__value">${esc(value)}</div>
        </div>
      `).join("");

    const buildingDescHtml = data.buildingDescription
      ? `<p class="building-desc">${esc(data.buildingDescription)}</p>`
      : "";

    const notInScope = (data.condition === "Erstbezug" || data.condition === "Neubau")
      ? `<div class="not-in-scope">
          <div class="not-in-scope__label">NICHT IM LIEFERUMFANG</div>
          <p>M&ouml;blierung, K&uuml;chenzeile, Sanit&auml;robjekte, Armaturen, Spiegel. Anschl&uuml;sse und Vorw&auml;nde sind fachgerecht vorinstalliert.</p>
        </div>`
      : "";

    sections.push(`
      <div class="page content-page">
        <div class="page-header">
          <span class="header-brand">DIREKTA<span class="accent">.</span></span>
          <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
        </div>
        <div class="section-eyebrow">${num} &mdash; Ausstattung &amp; Materialien</div>
        <h2 class="section-title">Was verbaut wird</h2>
        <div class="gold-rule"></div>
        ${buildingDescHtml}
        <div class="two-col">
          <div class="two-col__left">${renderSpecCol(leftEntries)}</div>
          <div class="two-col__right">${renderSpecCol(rightEntries)}</div>
        </div>
        ${notInScope}
        <div class="page-footer">
          <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
          <span class="footer-section">Ausstattung</span>
        </div>
      </div>
    `);
  }

  // ────────────────────────────── LAGE
  if (data.locationDescription) {
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, "0");
    const locDesc = data.locationDescription.replace(/\r\n/g, "\n");
    const locParas = locDesc.split("\n\n").filter(Boolean);
    const leadPara = locParas[0] || "";
    const restParas = locParas.slice(1);

    // Detect category paragraphs for grid layout
    const catRegex = /^(Versorgung|Bildung|Verkehr|Freizeit|Arbeit|Region|Mikrolage|Erreichbarkeit|Nahversorgung|Infrastruktur)[:\s]/i;
    const catItems: { label: string; text: string }[] = [];
    const plainParas: string[] = [];

    for (const p of restParas) {
      const match = p.match(catRegex);
      if (match) {
        catItems.push({ label: match[1].toUpperCase(), text: p.slice(match[0].length).trim() });
      } else {
        plainParas.push(p);
      }
    }

    const plainHtml = plainParas.map(p => `<p>${esc(p)}</p>`).join("");
    const catHtml = catItems.length > 0
      ? `<div class="location-grid">${catItems.map(c => `
          <div class="location-grid__item">
            <div class="location-grid__label">${esc(c.label)}</div>
            <p class="location-grid__text">${esc(c.text)}</p>
          </div>
        `).join("")}</div>`
      : "";

    sections.push(`
      <div class="page content-page">
        <div class="page-header">
          <span class="header-brand">DIREKTA<span class="accent">.</span></span>
          <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
        </div>
        <div class="section-eyebrow">${num} &mdash; Lage</div>
        <h2 class="section-title">Standort &amp; Umgebung</h2>
        <div class="gold-rule"></div>
        <p class="lead-text">${esc(leadPara)}</p>
        ${plainHtml}
        ${catHtml}
        <div class="page-footer">
          <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
          <span class="footer-section">Lage</span>
        </div>
      </div>
    `);
  }

  // ────────────────────────────── WOHNUNGSÜBERSICHT
  if (isBundle) {
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, "0");
    let sumArea = 0;

    const rowsHtml = data.units!.map(unit => {
      sumArea += unit.livingArea;
      const flTxt = unit.floor != null ? floorLabel(unit.floor) : "&ndash;";
      const prTxt = unit.askingPrice
        ? fmtPriceEuro(unit.askingPrice)
        : `<span class="price-inquiry">auf Anfrage</span>`;
      return `
        <tr>
          <td class="cell-label">${esc(unit.label)}</td>
          <td>${fmtAreaShort(unit.livingArea)}</td>
          <td>${unit.rooms ? unit.rooms : "&ndash;"}</td>
          <td>${flTxt}</td>
          <td class="cell-price">${prTxt}</td>
        </tr>
      `;
    }).join("");

    const bundlePrice = data.askingPrice
      ? fmtPriceEuro(data.askingPrice)
      : "auf Anfrage";

    sections.push(`
      <div class="page content-page">
        <div class="page-header">
          <span class="header-brand">DIREKTA<span class="accent">.</span></span>
          <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
        </div>
        <div class="section-eyebrow">${num} &mdash; Wohnungs&uuml;bersicht</div>
        <h2 class="section-title">Die Wohnungen im &Uuml;berblick</h2>
        <div class="gold-rule"></div>
        <table class="units-table">
          <thead>
            <tr>
              <th>EINHEIT</th>
              <th>WOHNFL&Auml;CHE</th>
              <th>ZIMMER</th>
              <th>ETAGE</th>
              <th>KAUFPREIS</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr class="units-table__total">
              <td class="cell-label">Paket &middot; alle ${data.units!.length} WE</td>
              <td>${fmtAreaShort(sumArea)}</td>
              <td></td>
              <td></td>
              <td class="cell-price cell-price--accent">${bundlePrice}</td>
            </tr>
          </tfoot>
        </table>
        <p class="units-note">Erwerb einzeln je Einheit oder als Gesamtpaket m&ouml;glich. Konditionen auf Anfrage.</p>
        <div class="page-footer">
          <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
          <span class="footer-section">Wohnungs&uuml;bersicht</span>
        </div>
      </div>
    `);
  }

  // ────────────────────────────── FLOOR PLANS (building-level)
  if (data.floorPlans && data.floorPlans.length > 0) {
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, "0");
    for (let i = 0; i < data.floorPlans.length; i++) {
      const fp = data.floorPlans[i];
      if (fp.mimeType === "application/pdf") continue; // pre-converted to image in route
      const label = data.floorPlans.length > 1
        ? `Grundriss (${i + 1}/${data.floorPlans.length})`
        : "Grundriss";
      sections.push(`
        <div class="page content-page floorplan-page">
          <div class="page-header">
            <span class="header-brand">DIREKTA<span class="accent">.</span></span>
            <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
          </div>
          ${i === 0 ? `
            <div class="section-eyebrow">${num} &mdash; Grundriss</div>
            <h2 class="section-title">Grundrissdarstellung</h2>
            <div class="gold-rule"></div>
          ` : `<h3 class="floorplan-subtitle">${esc(label)}</h3>`}
          <div class="floorplan-container">
            <img class="floorplan-img" src="${toDataUrl(fp)}" alt="${esc(label)}" />
          </div>
          <div class="page-footer">
            <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
            <span class="footer-section">${esc(label)}</span>
          </div>
        </div>
      `);
    }
  }

  // ────────────────────────────── PER-UNIT PAGES
  if (isBundle) {
    for (let ui = 0; ui < data.units!.length; ui++) {
      const unit = data.units![ui];
      sectionIdx++;
      const num = String(sectionIdx).padStart(2, "0");

      // UNIT DIVIDER
      {
        const statsItems: { label: string; value: string }[] = [
          { label: "WOHNFLÄCHE", value: fmtAreaShort(unit.livingArea) },
        ];
        if (unit.rooms) statsItems.push({ label: "ZIMMER", value: String(unit.rooms) });
        if (unit.bathrooms) statsItems.push({ label: "BÄDER", value: String(unit.bathrooms) });
        if (unit.floor != null) statsItems.push({ label: "ETAGE", value: floorLabel(unit.floor) });
        if (unit.askingPrice) statsItems.push({ label: "PREIS", value: fmtPriceEuro(unit.askingPrice) });

        const statsHtml = statsItems.map((s, i) => `
          <div class="unit-stat${i < statsItems.length - 1 ? " unit-stat--border" : ""}">
            <span class="unit-stat__label">${s.label}</span>
            <span class="unit-stat__value">${s.value}</span>
          </div>
        `).join("");

        const roomProgramHtml = (unit.roomProgram && unit.roomProgram.length > 0)
          ? (() => {
              let rpTotal = 0;
              const rows = unit.roomProgram.map(r => {
                rpTotal += r.area;
                return `<div class="rp-row">
                  <span class="rp-row__name">${esc(r.name)}</span>
                  <span class="rp-row__area">${fmtArea(r.area)}</span>
                </div>`;
              }).join("");
              return `
                <div class="room-program">
                  <div class="room-program__label">RAUMPROGRAMM</div>
                  ${rows}
                  <div class="rp-row rp-row--total">
                    <span class="rp-row__name">Gesamt</span>
                    <span class="rp-row__area">${fmtArea(rpTotal)}</span>
                  </div>
                </div>
              `;
            })()
          : "";

        const unitTitle = unit.titleShort || `${unit.label} &middot; ${fmtAreaShort(unit.livingArea)}`;

        sections.push(`
          <div class="page content-page unit-divider-page">
            <div class="page-header">
              <span class="header-brand">DIREKTA<span class="accent">.</span></span>
              <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
            </div>
            <div class="section-eyebrow">${num} &mdash; ${esc(unit.label)}</div>
            <div class="unit-divider__number">${String(ui + 1).padStart(2, "0")}</div>
            <div class="unit-divider__tag">Einheit ${ui + 1} von ${data.units!.length}</div>
            <h2 class="unit-divider__title">${unitTitle}</h2>
            <div class="unit-stats">${statsHtml}</div>
            ${roomProgramHtml}
            <div class="page-footer">
              <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
              <span class="footer-section">${esc(unit.label)}</span>
            </div>
          </div>
        `);
      }

      // UNIT PHOTOS — individual pages per photo
      if (unit.photos.length > 0) {
        unit.photos.forEach((photo, pIdx) => {
          const cap = esc(photoCaption(photo));
          const desc = photo.description ? esc(photo.description) : "";
          const roomMeta = ROOM_TYPE_DE[photo.roomType || "other"] || "";

          sections.push(`
            <div class="page content-page">
              <div class="page-header">
                <span class="header-brand">DIREKTA<span class="accent">.</span></span>
                <span class="header-address">${esc(data.address)} &middot; ${esc(unit.label)}</span>
              </div>
              ${pIdx === 0 ? `<div class="section-eyebrow">${esc(unit.label)} &middot; Eindr&uuml;cke</div>` : ""}
              <div class="img-hero-container">
                <img class="img-hero" src="${toDataUrl(photo)}" alt="${cap}" />
              </div>
              <div class="room-caption">
                <span class="room-name">${cap}</span>
                ${roomMeta && roomMeta !== cap ? `<span class="room-meta">${esc(roomMeta)}</span>` : ""}
              </div>
              ${desc ? `
                <div class="img-note">
                  ${desc}
                </div>
              ` : ""}
              <div class="page-footer">
                <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
                <span class="footer-section">${esc(unit.label)} &middot; ${pIdx + 1}/${unit.photos.length}</span>
              </div>
            </div>
          `);
        });
      }

      // UNIT FLOOR PLANS
      for (const fp of unit.floorPlans) {
        if (fp.mimeType === "application/pdf") continue; // pre-converted to image in route
        sections.push(`
          <div class="page content-page floorplan-page">
            <div class="page-header">
              <span class="header-brand">DIREKTA<span class="accent">.</span></span>
              <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
            </div>
            <h3 class="floorplan-subtitle">Grundriss ${esc(unit.label)}</h3>
            <div class="floorplan-container">
              <img class="floorplan-img" src="${toDataUrl(fp)}" alt="Grundriss ${esc(unit.label)}" />
            </div>
            <div class="page-footer">
              <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
              <span class="footer-section">Grundriss ${esc(unit.label)}</span>
            </div>
          </div>
        `);
      }
    }
  }

  // ────────────────────────────── PHOTOS (individual pages per photo)
  {
    const gallery = data.photos.slice(1);
    if (gallery.length > 0) {
      sectionIdx++;
      const num = String(sectionIdx).padStart(2, "0");

      gallery.forEach((photo, idx) => {
        const cap = esc(photoCaption(photo));
        const desc = photo.description ? esc(photo.description) : "";
        const roomMeta = ROOM_TYPE_DE[photo.roomType || "other"] || "";

        sections.push(`
          <div class="page content-page">
            <div class="page-header">
              <span class="header-brand">DIREKTA<span class="accent">.</span></span>
              <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
            </div>
            ${idx === 0 ? `
              <div class="section-eyebrow">${num} &mdash; Eindr&uuml;cke</div>
            ` : ""}
            <div class="img-hero-container">
              <img class="img-hero" src="${toDataUrl(photo)}" alt="${cap}" />
            </div>
            <div class="room-caption">
              <span class="room-name">${cap}</span>
              ${roomMeta && roomMeta !== cap ? `<span class="room-meta">${esc(roomMeta)}</span>` : ""}
            </div>
            ${desc ? `
              <div class="img-note">
                ${desc}
              </div>
            ` : ""}
            <div class="page-footer">
              <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
              <span class="footer-section">Eindr&uuml;cke &middot; ${idx + 1}/${gallery.length}</span>
            </div>
          </div>
        `);
      });
    }
  }

  // ────────────────────────────── ENERGIE
  if (data.energy) {
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, "0");

    interface EnergyRow { label: string; value: string }
    const eRows: EnergyRow[] = [
      { label: "Art", value: data.energy.type === "BEDARF" ? "Bedarfsausweis" : "Verbrauchsausweis" },
      { label: "Kennwert", value: `${data.energy.value} kWh/(m²·a)` },
      { label: "Effizienzklasse", value: data.energy.class },
      { label: "Energieträger", value: data.energy.source },
      { label: "Gültig bis", value: data.energy.validUntil },
    ];

    const eRowsHtml = eRows.map(r => `
      <div class="energy-row">
        <span class="energy-row__label">${esc(r.label)}</span>
        <span class="energy-row__value">${esc(r.value)}</span>
      </div>
    `).join("");

    const badgeColor = energyBadgeColor(data.energy.class);

    // Also build the Eckdaten table
    const eckdatenRows: { label: string; value: string }[] = [
      { label: "Adresse", value: `${data.address}, ${data.city}` },
      { label: "Objekttyp", value: data.propertyType },
      { label: "Wohnfläche", value: fmtAreaShort(totalArea) },
    ];
    if (data.yearBuilt) eckdatenRows.push({ label: "Baujahr", value: String(data.yearBuilt) });
    if (data.condition) eckdatenRows.push({ label: "Zustand", value: data.condition });

    const eckdatenHtml = eckdatenRows.map(r => `
      <div class="fact-row">
        <span class="fact-row__label">${esc(r.label)}</span>
        <span class="fact-row__value">${esc(r.value)}</span>
      </div>
    `).join("");

    sections.push(`
      <div class="page content-page">
        <div class="page-header">
          <span class="header-brand">DIREKTA<span class="accent">.</span></span>
          <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
        </div>
        <div class="section-eyebrow">${num} &mdash; Energie</div>
        <h2 class="section-title">Eckdaten &amp; Energieausweis</h2>
        <div class="gold-rule"></div>

        <div class="eckdaten-panel">${eckdatenHtml}</div>

        <div class="energy-box">
          <div class="energy-box__header">
            <span>Pflichtangaben Energieausweis (GEG)</span>
            <div class="energy-badge" style="background: ${badgeColor};">${esc(data.energy.class)}</div>
          </div>
          ${eRowsHtml}
        </div>

        <div class="energy-warning">
          <strong>Hinweis gem. &sect;87 GEG:</strong> Die Pflichtangaben zum Energieausweis werden gem&auml;&szlig; den Vorgaben des Geb&auml;udeenergiegesetzes (GEG) ver&ouml;ffentlicht. Der Energieausweis liegt zur Besichtigung vor.
        </div>

        <div class="page-footer">
          <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
          <span class="footer-section">Energie</span>
        </div>
      </div>
    `);
  }

  // ────────────────────────────── VERKAUFSOPTIONEN
  if (isBundle || data.askingPrice) {
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, "0");

    let optionsHtml = "";
    let priceTableHtml = "";
    let nebenkostenHtml = "";

    if (isBundle) {
      let sumArea = 0;
      const unitPriceRows = data.units!.map(unit => {
        sumArea += unit.livingArea;
        const pr = unit.askingPrice
          ? fmtPriceEuro(unit.askingPrice)
          : `<span class="price-inquiry">auf Anfrage</span>`;
        return `
          <tr>
            <td class="cell-label">${esc(unit.label)}</td>
            <td>${fmtAreaShort(unit.livingArea)}</td>
            <td class="cell-price">${pr}</td>
          </tr>
        `;
      }).join("");

      const bundlePrice = data.askingPrice
        ? fmtPriceEuro(data.askingPrice)
        : "Paketpreis auf Anfrage";

      optionsHtml = `
        <div class="option-cards">
          <div class="option-card">
            <div class="option-card__label">OPTION A</div>
            <h3 class="option-card__title">Einzelerwerb</h3>
            <p>Geeignet f&uuml;r Selbstnutzer, die sich f&uuml;r die Wohnung entscheiden, die zu ihrer Lebenssituation passt. Jeder Einzelerwerber profitiert vom gleichen Standard &mdash; keine Abstriche bei Material oder Technik.</p>
          </div>
          <div class="option-card">
            <div class="option-card__label">OPTION B</div>
            <h3 class="option-card__title">Paket-Erwerb</h3>
            <p>Alle Einheiten als Gesamtpaket. Diversifizierung im selben Objekt, Skalenvorteile bei Verwaltung, Instandhaltung und Vermietung.</p>
          </div>
        </div>
      `;

      priceTableHtml = `
        <table class="price-table">
          <thead>
            <tr><th>EINHEIT</th><th>WOHNFL&Auml;CHE</th><th>KAUFPREIS</th></tr>
          </thead>
          <tbody>${unitPriceRows}</tbody>
          <tfoot>
            <tr class="price-table__total">
              <td class="cell-label">Paket &middot; alle ${data.units!.length} WE</td>
              <td>${fmtAreaShort(sumArea)}</td>
              <td class="cell-price cell-price--accent">${bundlePrice}</td>
            </tr>
          </tfoot>
        </table>
      `;
    }

    if (data.askingPrice && data.postcode) {
      const ge = grunderwerbsteuer(data.postcode);
      const notarRate = 2.0;
      const gestAmt = Math.round(data.askingPrice * ge.rate / 100);
      const notarAmt = Math.round(data.askingPrice * notarRate / 100);
      const gesamt = data.askingPrice + gestAmt + notarAmt;

      nebenkostenHtml = `
        <div class="nebenkosten-box">
          <h3 class="nebenkosten-box__title">Kaufnebenkosten (gesch&auml;tzt)</h3>
          <div class="nk-row">
            <span>Kaufpreis</span>
            <span class="nk-row__value">${fmtPriceEuro(data.askingPrice)}</span>
          </div>
          <div class="nk-row">
            <span>Grunderwerbsteuer (${esc(ge.land)}, ${ge.rate.toFixed(1)} %)</span>
            <span class="nk-row__value">${fmtPriceEuro(gestAmt)}</span>
          </div>
          <div class="nk-row">
            <span>Notar &amp; Grundbuch (ca. ${notarRate.toFixed(1)} %)</span>
            <span class="nk-row__value">ca. ${fmtPriceEuro(notarAmt)}</span>
          </div>
          <div class="nk-row nk-row--total">
            <span>Gesamtinvestition</span>
            <span class="nk-row__value">ca. ${fmtPriceEuro(gesamt)}</span>
          </div>
        </div>
        <p class="nk-note">K&auml;uferprovision, Notar- und Grundbuchkosten, Grunderwerbsteuer (${esc(ge.land)}: ${ge.rate.toFixed(1)} %) sind separat zu tragen.</p>
      `;
    }

    sections.push(`
      <div class="page content-page">
        <div class="page-header">
          <span class="header-brand">DIREKTA<span class="accent">.</span></span>
          <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
        </div>
        <div class="section-eyebrow">${num} &mdash; Verkaufsoptionen</div>
        <h2 class="section-title">Einzeln oder als Paket</h2>
        <div class="gold-rule"></div>
        ${optionsHtml}
        ${priceTableHtml}
        ${nebenkostenHtml}
        <div class="page-footer">
          <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
          <span class="footer-section">Verkaufsoptionen</span>
        </div>
      </div>
    `);
  }

  // ────────────────────────────── RAUMPROGRAMM (non-bundle)
  if (data.roomProgram && data.roomProgram.length > 0 && !isBundle) {
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, "0");
    let rpTotal = 0;
    const rpRows = data.roomProgram.map(r => {
      rpTotal += r.area;
      return `
        <div class="rp-row">
          <span class="rp-row__name">${esc(r.name)}</span>
          <span class="rp-row__area">${fmtArea(r.area)}</span>
        </div>
      `;
    }).join("");

    sections.push(`
      <div class="page content-page">
        <div class="page-header">
          <span class="header-brand">DIREKTA<span class="accent">.</span></span>
          <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
        </div>
        <div class="section-eyebrow">${num} &mdash; Raumprogramm</div>
        <h2 class="section-title">Fl&auml;chenaufstellung</h2>
        <div class="gold-rule"></div>
        <div class="room-program room-program--standalone">
          ${rpRows}
          <div class="rp-row rp-row--total">
            <span class="rp-row__name">Wohnfl&auml;che gesamt</span>
            <span class="rp-row__area">${fmtArea(rpTotal)}</span>
          </div>
        </div>
        <div class="page-footer">
          <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
          <span class="footer-section">Raumprogramm</span>
        </div>
      </div>
    `);
  }

  // ────────────────────────────── KONTAKT & RECHTLICHES
  {
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, "0");
    const hasContact = data.contact && (data.contact.name || data.contact.email || data.contact.phone);

    const contactLeftHtml = hasContact ? `
      <div class="contact-card__section">
        <div class="contact-card__sublabel">EIGENT&Uuml;MER / VERKAUF</div>
        ${data.contact!.name ? `<div class="contact-card__name">${esc(data.contact!.name)}</div>` : ""}
        ${data.contact!.phone ? `
          <div class="contact-card__row">
            <span class="contact-card__row-label">TELEFON</span>
            <span>${esc(data.contact!.phone)}</span>
          </div>
        ` : ""}
        ${data.contact!.email ? `
          <div class="contact-card__row">
            <span class="contact-card__row-label">E-MAIL</span>
            <span>${esc(data.contact!.email)}</span>
          </div>
        ` : ""}
      </div>
    ` : `<div class="contact-card__section"><div class="contact-card__name">Kontakt &uuml;ber Direkta</div></div>`;

    sections.push(`
      <div class="page content-page">
        <div class="page-header">
          <span class="header-brand">DIREKTA<span class="accent">.</span></span>
          <span class="header-address">${esc(data.address)} &middot; ${esc(data.city)}</span>
        </div>
        <div class="section-eyebrow">${num} &mdash; Kontakt</div>
        <h2 class="section-title">Wir freuen uns auf Ihre Anfrage</h2>
        <div class="gold-rule"></div>

        <div class="contact-card">
          <div class="contact-card__left">${contactLeftHtml}</div>
          <div class="contact-card__right">
            <div class="contact-card__sublabel">TERMIN VEREINBAREN</div>
            <div class="contact-card__cta-title">Besichtigung &amp;<br/>Konditionen.</div>
            <p class="contact-card__cta-text">F&uuml;r einen Besichtigungstermin oder konkrete Konditionen wenden Sie sich an den genannten Ansprechpartner.</p>
          </div>
        </div>

        <div class="legal-section">
          <div class="legal-section__label">RECHTLICHE HINWEISE</div>
          <p>Dieses Expos&eacute; dient ausschlie&szlig;lich der Information m&ouml;glicher Kaufinteressenten. Es stellt kein bindendes Angebot dar. Alle Angaben beruhen auf vom Eigent&uuml;mer bzw. dessen Bevollm&auml;chtigten zur Verf&uuml;gung gestellten Unterlagen. Eine Haftung f&uuml;r Vollst&auml;ndigkeit und Richtigkeit kann nicht &uuml;bernommen werden. Ma&szlig;geblich f&uuml;r einen Erwerb sind ausschlie&szlig;lich die im notariell beurkundeten Kaufvertrag getroffenen Regelungen.</p>
          <p>Zwischenverkauf, Irrtum und &Auml;nderungen vorbehalten. Die in diesem Expos&eacute; verwendeten Abbildungen zeigen den aktuellen oder geplanten Zustand der Immobilie. Tats&auml;chliche Bauausf&uuml;hrung kann in Details abweichen.</p>
          <p>Gem&auml;&szlig; Geldw&auml;schegesetz (GwG) ist der Verk&auml;ufer verpflichtet, die Identit&auml;t des Erwerbers vor Abschluss des Kaufvertrags festzustellen.</p>
          <p>Erstellt &uuml;ber die Plattform Direkta. Direkta tritt nicht als Immobilienmakler im Sinne des &sect; 34c GewO auf. Preisempfehlungen sind unverbindliche Sch&auml;tzungen und stellen keine Bewertungsgutachten dar.</p>
        </div>
        <div class="page-footer">
          <span class="footer-brand">DIREKTA<span class="accent">.</span></span>
          <span class="footer-section">Kontakt &amp; Rechtliches</span>
        </div>
      </div>
    `);
  }

  // ────────────────────────────── BACK COVER
  {
    sections.push(`
      <div class="page back-cover">
        <div class="back-cover__content">
          <div class="back-cover__brand">DIREKTA<span class="accent">.</span></div>
          <div class="back-cover__rule"></div>
          <div class="back-cover__tagline">Immobilie verkaufen. Direkt.</div>
        </div>
        <div class="back-cover__footer">
          ${esc(data.address)} &middot; ${esc(data.city)} &middot; Expos&eacute; &middot; Stand ${esc(data.generatedAt)} &middot; www.direkta.de
        </div>
      </div>
    `);
  }

  // ────────────────────────────── FULL HTML
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
/* ── Reset & Base ────────────────────────────────────────────── */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; overflow: hidden; }
html::-webkit-scrollbar { display: none; }

/* ── Design Tokens ───────────────────────────────────────────── */
:root {
  --gold: #8b6f47;
  --ink: #1a1f26;
  --ink-soft: #4a5260;
  --ink-faint: #8a8478;
  --beige: #faf8f4;
  --line: #e6e1d7;
  --line-soft: #f0ece4;
  --paper: #fbf8f1;
  --white: #ffffff;

  --serif: 'Cormorant Garamond', 'Playfair Display', 'Times New Roman', serif;
  --sans: 'Inter', 'Helvetica Neue', Arial, sans-serif;
}

/* ── Page Setup ──────────────────────────────────────────────── */
@page { size: A4; margin: 0; }

.page {
  position: relative;
  overflow: hidden;
  page-break-after: always;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page:last-child { page-break-after: auto; }

/* ── Content page ────────────────────────────────────────────── */
.content-page {
  background: var(--beige);
  padding: 22mm 20mm 20mm 20mm;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-wrap: break-word;
  word-wrap: break-word;
}

/* ── Page Header & Footer ────────────────────────────────────── */
.page-header {
  position: absolute;
  top: 14mm;
  left: 20mm;
  right: 20mm;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 6px;
  border-bottom: 0.5px solid var(--line);
}
.header-brand {
  font-family: var(--sans);
  font-size: 9pt;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0.06em;
}
.header-address {
  font-family: var(--sans);
  font-size: 7pt;
  color: var(--ink-faint);
}

.page-footer {
  position: absolute;
  bottom: 10mm;
  left: 20mm;
  right: 20mm;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.footer-brand {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0.06em;
}
.footer-section {
  font-family: var(--sans);
  font-size: 7pt;
  color: var(--ink-faint);
}

.accent { color: var(--gold); }

/* ── Section Headings ────────────────────────────────────────── */
.section-eyebrow {
  font-family: var(--sans);
  font-size: 8pt;
  font-weight: 500;
  color: var(--ink-faint);
  letter-spacing: 0.04em;
  margin-bottom: 8px;
  margin-top: 4px;
}
.section-title {
  font-family: var(--serif);
  font-size: 32pt;
  font-weight: 300;
  color: var(--ink);
  line-height: 1.15;
  margin-bottom: 12px;
}
.gold-rule {
  width: 18mm;
  height: 1.5px;
  background: var(--gold);
  margin-bottom: 18px;
}

/* ── Lead Text ───────────────────────────────────────────────── */
.lead-text {
  font-family: var(--serif);
  font-size: 11.5pt;
  font-weight: 400;
  color: var(--ink);
  line-height: 1.65;
  margin-bottom: 18px;
  max-width: 155mm;
}

/* ══════════════════════════════════════════════════════════════
   COVER PAGE
   ══════════════════════════════════════════════════════════════ */
.cover-page {
  background: var(--ink);
  padding: 0;
  width: 100%;
  height: 100vh;
}
.cover-hero {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}
.cover-hero--placeholder {
  background: linear-gradient(135deg, #2a3140 0%, #1a1f26 100%);
}
.cover-gradient-top {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 60mm;
  background: linear-gradient(to bottom, rgba(20,25,32,0.85), transparent);
  z-index: 1;
}
.cover-gradient-bottom {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 145mm;
  background: linear-gradient(to top, rgba(20,25,32,0.98) 0%, rgba(20,25,32,0.92) 35%, rgba(20,25,32,0.6) 65%, transparent 100%);
  z-index: 1;
}
.cover-brand {
  position: absolute;
  top: 16mm; left: 16mm;
  font-family: var(--sans);
  font-size: 10pt;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  letter-spacing: 0.1em;
  z-index: 2;
}
.cover-badge {
  position: absolute;
  top: 15mm; right: 16mm;
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 0.5px solid rgba(255,255,255,0.5);
  padding: 5px 11px;
  z-index: 2;
}
.cover-content {
  position: absolute;
  bottom: 32mm; left: 16mm; right: 16mm;
  z-index: 2;
}
.cover-eyebrow {
  font-family: var(--sans);
  font-size: 8pt;
  font-weight: 500;
  color: var(--gold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.cover-title {
  font-family: var(--serif);
  font-size: 56pt;
  font-weight: 300;
  color: #fff;
  line-height: 1.05;
  margin-bottom: 10px;
  max-width: 170mm;
}
.cover-subtitle {
  font-family: var(--serif);
  font-style: italic;
  font-size: 16pt;
  font-weight: 300;
  color: rgba(255,255,255,0.85);
  line-height: 1.4;
  margin-bottom: 10px;
  max-width: 155mm;
}
.cover-address {
  font-family: var(--sans);
  font-size: 9pt;
  font-weight: 400;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.04em;
  margin-bottom: 18px;
}
.cover-facts {
  display: flex;
  gap: 0;
  border-top: 0.5px solid rgba(255,255,255,0.2);
  padding-top: 14px;
}
.cover-fact {
  flex: 1;
  padding-right: 12px;
}
.cover-fact--border {
  border-right: 0.5px solid rgba(255,255,255,0.15);
  margin-right: 12px;
}
.cover-fact__label {
  display: block;
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 600;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}
.cover-fact__value {
  display: block;
  font-family: var(--serif);
  font-size: 22pt;
  font-weight: 400;
  color: #fff;
  line-height: 1.1;
}
.cover-footer {
  position: absolute;
  bottom: 10mm; left: 16mm; right: 16mm;
  display: flex;
  justify-content: space-between;
  font-family: var(--sans);
  font-size: 7pt;
  color: rgba(255,255,255,0.35);
  z-index: 2;
}

/* ══════════════════════════════════════════════════════════════
   TWO-COLUMN LAYOUTS
   ══════════════════════════════════════════════════════════════ */
.two-col {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}
.two-col__left { flex: 1; min-width: 0; }
.two-col__right { flex: 1; min-width: 0; }

.two-col-text {
  column-count: 2;
  column-gap: 20px;
  font-family: var(--sans);
  font-size: 9.5pt;
  color: var(--ink);
  line-height: 1.65;
  margin-bottom: 16px;
}
.two-col-text p { margin-bottom: 10px; }

/* ── Highlights List ─────────────────────────────────────────── */
.highlights-list {
  list-style: none;
  padding: 0;
}
.highlights-list li {
  font-family: var(--sans);
  font-size: 9pt;
  color: var(--ink);
  line-height: 1.55;
  padding: 5px 0;
  border-bottom: 0.5px solid var(--line-soft);
}
.highlights-list li:last-child { border-bottom: none; }

/* ── Facts Panel ─────────────────────────────────────────────── */
.facts-panel {
  background: var(--paper);
  border: 0.5px solid var(--line);
  padding: 14px 16px;
  overflow: hidden;
}
.fact-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 5px 0;
  border-bottom: 0.3px solid var(--line-soft);
}
.fact-row:last-child { border-bottom: none; }
.fact-row__label {
  font-family: var(--sans);
  font-size: 8.5pt;
  color: var(--ink-soft);
}
.fact-row__value {
  font-family: var(--sans);
  font-size: 8.5pt;
  font-weight: 600;
  color: var(--ink);
  text-align: right;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Eckdaten Panel ──────────────────────────────────────────── */
.eckdaten-panel {
  background: var(--paper);
  border: 0.5px solid var(--line);
  padding: 14px 16px;
  margin-bottom: 18px;
}

/* ── Attributes ──────────────────────────────────────────────── */
.attr-section { margin-top: 18px; }
.attr-label {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}
.attr-item {
  font-family: var(--sans);
  font-size: 9pt;
  color: var(--ink);
  padding: 5px 0;
  border-bottom: 0.3px solid var(--line-soft);
}
.attr-item:last-child { border-bottom: none; }
.attr-dash { color: var(--gold); }

/* ── Specifications ──────────────────────────────────────────── */
.spec-item { margin-bottom: 12px; }
.spec-item__label {
  font-family: var(--sans);
  font-size: 8pt;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 3px;
}
.spec-item__value {
  font-family: var(--sans);
  font-size: 8.5pt;
  color: var(--ink-soft);
  line-height: 1.5;
}
.building-desc {
  font-family: var(--sans);
  font-size: 9pt;
  color: var(--ink-soft);
  line-height: 1.6;
  margin-bottom: 16px;
}
.not-in-scope {
  margin-top: 18px;
  padding-top: 12px;
  border-top: 0.5px solid var(--line);
}
.not-in-scope__label {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.not-in-scope p {
  font-family: var(--sans);
  font-size: 8.5pt;
  color: var(--ink-soft);
  line-height: 1.5;
}

/* ── Location ────────────────────────────────────────────────── */
.location-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
  margin-top: 14px;
}
.location-grid__item { }
.location-grid__label {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.06em;
  margin-bottom: 5px;
}
.location-grid__text {
  font-family: var(--sans);
  font-size: 9pt;
  color: var(--ink-soft);
  line-height: 1.55;
}

/* ══════════════════════════════════════════════════════════════
   UNITS TABLE
   ══════════════════════════════════════════════════════════════ */
.units-table, .price-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 14px;
  font-family: var(--sans);
  font-size: 9pt;
}
.units-table th, .price-table th {
  font-size: 7pt;
  font-weight: 700;
  color: var(--ink-faint);
  letter-spacing: 0.06em;
  text-align: left;
  padding: 6px 0;
  border-bottom: 0.5px solid var(--line);
}
.units-table td, .price-table td {
  padding: 8px 0;
  border-bottom: 0.3px solid var(--line-soft);
  color: var(--ink);
  vertical-align: baseline;
}
.units-table tfoot td, .price-table tfoot td {
  border-top: 1px solid var(--ink);
  border-bottom: none;
  background: var(--paper);
  padding: 10px 4px;
}
.cell-label { font-weight: 700; }
.cell-price { text-align: right; font-family: var(--serif); font-style: italic; }
.cell-price--accent { color: var(--gold); font-weight: 600; font-style: normal; }
.price-inquiry { color: var(--gold); }
.units-note {
  font-family: var(--sans);
  font-size: 8.5pt;
  color: var(--ink-soft);
  margin-top: 8px;
}
.units-table th:last-child, .units-table td:last-child,
.price-table th:last-child, .price-table td:last-child {
  text-align: right;
}

/* ══════════════════════════════════════════════════════════════
   FLOOR PLAN PAGE
   ══════════════════════════════════════════════════════════════ */
.floorplan-page { background: #fff; }
.floorplan-subtitle {
  font-family: var(--serif);
  font-size: 18pt;
  font-weight: 400;
  color: var(--ink);
  margin-bottom: 14px;
}
.floorplan-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}
.floorplan-img {
  max-width: 100%;
  max-height: 210mm;
  object-fit: contain;
}

/* ══════════════════════════════════════════════════════════════
   UNIT DIVIDER PAGE
   ══════════════════════════════════════════════════════════════ */
.unit-divider-page {
  display: flex;
  flex-direction: column;
}
.unit-divider__number {
  font-family: var(--serif);
  font-size: 100pt;
  font-weight: 300;
  color: var(--line);
  line-height: 1;
  margin: 10px 0 4px 0;
}
.unit-divider__tag {
  font-family: var(--sans);
  font-size: 8pt;
  font-weight: 500;
  color: var(--gold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.unit-divider__title {
  font-family: var(--serif);
  font-size: 38pt;
  font-weight: 300;
  color: var(--ink);
  line-height: 1.15;
  margin-bottom: 20px;
}
.unit-stats {
  display: flex;
  gap: 0;
  border-top: 0.5px solid var(--line);
  border-bottom: 0.5px solid var(--line);
  padding: 12px 0;
  margin-bottom: 20px;
}
.unit-stat {
  flex: 1;
  padding-right: 10px;
}
.unit-stat--border {
  border-right: 0.5px solid var(--line);
  margin-right: 10px;
}
.unit-stat__label {
  display: block;
  font-family: var(--sans);
  font-size: 6.5pt;
  font-weight: 600;
  color: var(--ink-faint);
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}
.unit-stat__value {
  display: block;
  font-family: var(--serif);
  font-size: 16pt;
  font-weight: 400;
  color: var(--ink);
}

/* ── Room Program ────────────────────────────────────────────── */
.room-program {
  margin-top: 6px;
}
.room-program--standalone {
  max-width: 120mm;
}
.room-program__label {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}
.rp-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 5px 0;
  border-bottom: 0.3px solid var(--line-soft);
}
.rp-row:last-child { border-bottom: none; }
.rp-row--total {
  border-top: 1px solid var(--ink);
  border-bottom: none;
  margin-top: 2px;
  padding-top: 6px;
}
.rp-row__name {
  font-family: var(--sans);
  font-size: 8.5pt;
  color: var(--ink-soft);
}
.rp-row--total .rp-row__name {
  font-weight: 700;
  color: var(--ink);
}
.rp-row__area {
  font-family: var(--serif);
  font-size: 9pt;
  font-weight: 600;
  color: var(--ink);
}
.rp-row--total .rp-row__area {
  font-size: 10pt;
}

/* ══════════════════════════════════════════════════════════════
   PHOTO PAGES — individual image with caption + description
   ══════════════════════════════════════════════════════════════ */
.img-hero-container {
  width: 100%;
  aspect-ratio: 3/2;
  overflow: hidden;
  margin-bottom: 16px;
}
.img-hero {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.room-caption {
  margin-bottom: 14px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.room-name {
  font-family: var(--serif);
  font-size: 14pt;
  font-weight: 400;
  color: var(--ink);
}
.room-meta {
  font-family: var(--sans);
  font-size: 8pt;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--gold);
}
.img-note {
  background: #faf8f4;
  border-left: 2px solid var(--gold);
  padding: 14px 18px;
  font-size: 9pt;
  color: #4a5260;
  line-height: 1.55;
  margin-top: 6px;
}
.img-note strong {
  color: var(--ink);
  font-weight: 600;
}

/* ══════════════════════════════════════════════════════════════
   ENERGY
   ══════════════════════════════════════════════════════════════ */
.energy-box {
  background: var(--paper);
  border: 0.5px solid var(--line);
  padding: 16px 18px;
  margin-bottom: 14px;
}
.energy-box__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-family: var(--serif);
  font-size: 12pt;
  font-weight: 600;
  color: var(--ink);
}
.energy-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 32px;
  color: #fff;
  font-family: var(--serif);
  font-size: 20pt;
  font-weight: 600;
  border-radius: 3px;
}
.energy-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0;
  border-bottom: 0.3px solid var(--line-soft);
}
.energy-row:last-child { border-bottom: none; }
.energy-row__label {
  font-family: var(--sans);
  font-size: 8.5pt;
  color: var(--ink-soft);
}
.energy-row__value {
  font-family: var(--sans);
  font-size: 8.5pt;
  font-weight: 600;
  color: var(--ink);
}
.energy-warning {
  font-family: var(--sans);
  font-size: 8pt;
  color: var(--ink-soft);
  line-height: 1.5;
  background: var(--paper);
  border-left: 2px solid var(--gold);
  padding: 10px 14px;
  margin-top: 8px;
}

/* ══════════════════════════════════════════════════════════════
   SALES OPTIONS
   ══════════════════════════════════════════════════════════════ */
.option-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 18px;
}
.option-card {
  flex: 1;
  background: var(--paper);
  border: 0.5px solid var(--line);
  padding: 14px 16px;
}
.option-card__label {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.option-card__title {
  font-family: var(--sans);
  font-size: 11pt;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 6px;
}
.option-card p {
  font-family: var(--sans);
  font-size: 8.5pt;
  color: var(--ink-soft);
  line-height: 1.55;
}

/* ── Nebenkosten ─────────────────────────────────────────────── */
.nebenkosten-box {
  background: var(--paper);
  border: 0.5px solid var(--line);
  padding: 14px 16px;
  margin-top: 16px;
  margin-bottom: 10px;
}
.nebenkosten-box__title {
  font-family: var(--serif);
  font-size: 12pt;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 12px;
}
.nk-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0;
  font-family: var(--sans);
  font-size: 8.5pt;
  color: var(--ink-soft);
  border-bottom: 0.3px solid var(--line-soft);
}
.nk-row:last-child { border-bottom: none; }
.nk-row__value {
  font-weight: 600;
  color: var(--ink);
}
.nk-row--total {
  border-top: 0.5px solid var(--ink);
  border-bottom: none;
  margin-top: 4px;
  padding-top: 6px;
  font-weight: 700;
  color: var(--ink);
}
.nk-row--total .nk-row__value {
  font-family: var(--serif);
  font-size: 11pt;
  font-weight: 700;
}
.nk-note {
  font-family: var(--sans);
  font-size: 8pt;
  color: var(--ink-soft);
  line-height: 1.5;
  margin-top: 6px;
}

/* ══════════════════════════════════════════════════════════════
   CONTACT
   ══════════════════════════════════════════════════════════════ */
.contact-card {
  display: flex;
  background: var(--ink);
  color: var(--paper);
  margin-bottom: 20px;
}
.contact-card__left, .contact-card__right {
  flex: 1;
  padding: 18px 20px;
}
.contact-card__right {
  border-left: 0.5px solid rgba(255,255,255,0.1);
}
.contact-card__sublabel {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 500;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}
.contact-card__name {
  font-family: var(--serif);
  font-size: 16pt;
  font-weight: 400;
  color: var(--paper);
  margin-bottom: 12px;
}
.contact-card__row {
  font-family: var(--sans);
  font-size: 9pt;
  color: rgba(255,255,255,0.85);
  margin-bottom: 6px;
  display: flex;
  gap: 8px;
}
.contact-card__row-label {
  font-size: 7pt;
  font-weight: 500;
  color: rgba(255,255,255,0.45);
  min-width: 55px;
  padding-top: 1px;
}
.contact-card__cta-title {
  font-family: var(--serif);
  font-size: 16pt;
  font-weight: 400;
  color: var(--paper);
  line-height: 1.3;
  margin-bottom: 10px;
}
.contact-card__cta-text {
  font-family: var(--sans);
  font-size: 8.5pt;
  color: rgba(255,255,255,0.7);
  line-height: 1.55;
}

/* ── Legal Section ───────────────────────────────────────────── */
.legal-section {
  margin-top: 8px;
}
.legal-section__label {
  font-family: var(--sans);
  font-size: 7pt;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}
.legal-section p {
  font-family: var(--sans);
  font-size: 7.5pt;
  color: var(--ink-soft);
  line-height: 1.55;
  margin-bottom: 6px;
}

/* ══════════════════════════════════════════════════════════════
   BACK COVER
   ══════════════════════════════════════════════════════════════ */
.back-cover {
  background: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  width: 100%;
  height: 100vh;
}
.back-cover__content {
  text-align: center;
}
.back-cover__brand {
  font-family: var(--sans);
  font-size: 28pt;
  font-weight: 700;
  color: var(--paper);
  letter-spacing: 0.06em;
}
.back-cover__rule {
  width: 45px;
  height: 2px;
  background: var(--gold);
  margin: 14px auto;
}
.back-cover__tagline {
  font-family: var(--serif);
  font-style: italic;
  font-size: 14pt;
  font-weight: 300;
  color: rgba(255,255,255,0.65);
}
.back-cover__footer {
  position: absolute;
  bottom: 16mm;
  left: 20mm;
  right: 20mm;
  text-align: center;
  font-family: var(--sans);
  font-size: 7pt;
  color: rgba(255,255,255,0.35);
}

@media print {
  .page { overflow: hidden !important; page-break-after: always !important; }
  .page:last-child { page-break-after: auto !important; }
}
</style>
</head>
<body>
${sections.join("\n")}
</body>
</html>`;
}

// ── PDF generation ───────────────────────────────────────────────────

export async function generateExposePdf(data: ExposeData): Promise<Buffer> {
  const html = buildExposeHtml(data);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
