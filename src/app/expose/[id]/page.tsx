import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.listing.findFirst({
    where: { id }, include: { property: true },
  });
  return { title: listing ? `Expose — ${listing.property.street} ${listing.property.houseNumber}` : "Expose" };
}

const TYPE_DE: Record<string, string> = {
  ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
  DHH: "Doppelhaushaelfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstueck",
};
const COND_DE: Record<string, string> = {
  ERSTBEZUG: "Erstbezug", NEUBAU: "Neubau", GEPFLEGT: "Gepflegt",
  RENOVIERUNGS_BEDUERFTIG: "Renovierungsbedarf", SANIERUNGS_BEDUERFTIG: "Sanierungsbedarf", ROHBAU: "Rohbau",
};

export default async function ExposePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.listing.findFirst({
    where: { id },
    include: {
      property: {
        include: {
          energyCert: true,
          media: { orderBy: { ordering: "asc" } },
          units: {
            orderBy: { unitLabel: "asc" },
            include: {
              media: { orderBy: { ordering: "asc" } },
              energyCert: true,
            },
          },
        },
      },
      priceRecommendation: true,
    },
  });
  if (!listing) notFound();

  const p = listing.property;
  const photos = p.media.filter((m) => m.kind === "PHOTO");
  const floorplans = p.media.filter((m) => m.kind === "FLOORPLAN");
  const units = p.units || [];
  const isBundle = units.length > 0;
  const price = listing.askingPrice ? Number(listing.askingPrice) : null;
  const rooms = p.roomProgram as { name: string; area: number }[] | null;
  const specs = p.specifications as Record<string, Record<string, string>> | null;
  const bldg = p.buildingInfo as Record<string, string> | null;
  const highlights = listing.highlights as string[] | null;
  const contact = listing.sellerContact as { name?: string; phone?: string; email?: string; company?: string } | null;
  const attrs = p.attributes as string[] | null;
  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: EXPOSE_CSS }} />
        {/* ═══ COVER ═══ */}
        <section className="page cover">
          <div className="cover-top">
            {photos[0] ? (
              <img src={photos[0].storageKey} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div className="placeholder"><span className="ph-tag">Titelbild</span></div>
            )}
            <div className="cover-gradient" />
          </div>
          <div className="cover-brand-bar">
            <span className="brand">Direkta<span className="dot">.</span></span>
            <span className="badge">Expose · Verkauf</span>
          </div>
          <div className="cover-bottom">
            <div className="cover-headline-block">
              <span className="cover-eyebrow">{TYPE_DE[p.type] || p.type} · {p.city}</span>
              <h1 className="cover-headline">
                {listing.exposeHeadline || listing.titleShort || `${p.street} ${p.houseNumber}`}
              </h1>
              <div className="cover-sub">
                <strong>{p.street} {p.houseNumber}</strong> · {p.postcode} {p.city}
              </div>
            </div>
            <div className="cover-key-strip">
              {isBundle ? (
                <>
                  <div className="cover-key">
                    <span className="k-label">Wohnungen</span>
                    <span className="k-value">{units.length}</span>
                  </div>
                  <div className="cover-key">
                    <span className="k-label">Gesamtflaeche</span>
                    <span className="k-value">{p.livingArea}<span className="k-unit"> m²</span></span>
                  </div>
                  <div className="cover-key">
                    <span className="k-label">Baujahr</span>
                    <span className="k-value">{p.yearBuilt || "-"}</span>
                  </div>
                  <div className="cover-key">
                    <span className="k-label">Zustand</span>
                    <span className="k-value">{COND_DE[p.condition] || p.condition}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="cover-key">
                    <span className="k-label">Wohnflaeche</span>
                    <span className="k-value">{p.livingArea}<span className="k-unit"> m²</span></span>
                  </div>
                  <div className="cover-key">
                    <span className="k-label">Zimmer</span>
                    <span className="k-value">{p.rooms || "-"}</span>
                  </div>
                  <div className="cover-key">
                    <span className="k-label">Baujahr</span>
                    <span className="k-value">{p.yearBuilt || "-"}</span>
                  </div>
                  <div className="cover-key">
                    <span className="k-label">Zustand</span>
                    <span className="k-value">{COND_DE[p.condition] || p.condition}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="cover-footer">
            <span>Expose · Stand {today}</span>
            <span>www.direkta.de</span>
          </div>
        </section>

        {/* ═══ OVERVIEW ═══ */}
        <section className="page">
          <div className="page-inner">
            <PageHeader address={`${p.street} ${p.houseNumber} · ${p.city}`} />
            <div className="section-head">
              <div className="meta-row">
                <span className="section-num">01 — Auf einen Blick</span>
                <span className="eyebrow">Zusammenfassung</span>
              </div>
              <h1>{listing.exposeHeadline || `${TYPE_DE[p.type]} in ${p.city}`}</h1>
              <div className="section-rule" />
            </div>

            {listing.descriptionLong && (
              <p className="lede">{listing.descriptionLong.substring(0, 500)}</p>
            )}

            {highlights && highlights.length > 0 && (
              <div className="pull">
                <div className="pull-eyebrow">Highlights</div>
                <ul className="f-list">
                  {highlights.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
            )}

            <div style={{ marginTop: "6mm" }}>
              <span className="eyebrow">Eckdaten</span>
              <div style={{ height: "3mm" }} />
              <div className="meta-grid">
                <MetaCell label="Typ" value={TYPE_DE[p.type] || p.type} />
                <MetaCell label="Wohnflaeche" value={`${p.livingArea} m²`} />
                <MetaCell label="Zimmer" value={p.rooms ? String(p.rooms) : "-"} />
                <MetaCell label="Baujahr" value={p.yearBuilt ? String(p.yearBuilt) : "-"} />
                <MetaCell label="Zustand" value={COND_DE[p.condition] || p.condition} />
                <MetaCell label="Badezimmer" value={p.bathrooms ? String(p.bathrooms) : "-"} />
                {p.plotArea && <MetaCell label="Grundstueck" value={`${p.plotArea} m²`} />}
              </div>
            </div>
          </div>
          <PageFooter section="Auf einen Blick" page={2} total={getPageCount(listing, photos, floorplans)} />
        </section>

        {/* ═══ LOCATION ═══ */}
        {listing.locationDescription && (
          <section className="page">
            <div className="page-inner">
              <PageHeader address={`${p.street} ${p.houseNumber} · ${p.city}`} />
              <div className="section-head">
                <div className="meta-row">
                  <span className="section-num">02 — Die Lage</span>
                  <span className="eyebrow">{p.city}</span>
                </div>
                <h1>{p.city} —<br /><em>Standort und Umgebung.</em></h1>
                <div className="section-rule" />
              </div>
              <div className="lede" style={{ whiteSpace: "pre-line" }}>{listing.locationDescription}</div>
            </div>
            <PageFooter section="Die Lage" page={3} total={getPageCount(listing, photos, floorplans)} />
          </section>
        )}

        {/* ═══ BUILDING ═══ */}
        <section className="page">
          <div className="page-inner">
            <PageHeader address={`${p.street} ${p.houseNumber} · ${p.city}`} />
            <div className="section-head">
              <div className="meta-row">
                <span className="section-num">{listing.locationDescription ? "03" : "02"} — Das Gebaeude</span>
                <span className="eyebrow">Bestand</span>
              </div>
              <h1>{TYPE_DE[p.type] || p.type}<br /><em>in {p.city}.</em></h1>
              <div className="section-rule" />
            </div>

            {photos[1] && (
              <div style={{ marginBottom: "6mm" }}>
                <img src={photos[1].storageKey} alt="" style={{ width: "100%", height: "70mm", objectFit: "cover" }} />
              </div>
            )}

            {listing.buildingDescription && (
              <p style={{ whiteSpace: "pre-line" }}>{listing.buildingDescription}</p>
            )}

            <div style={{ marginTop: "5mm" }}>
              <span className="eyebrow">Eckdaten Gebaeude</span>
              <div style={{ height: "2mm" }} />
              <table className="data-table compact">
                <tbody>
                  <tr><td className="label">Gebaeudetyp</td><td className="value">{TYPE_DE[p.type]}</td></tr>
                  <tr><td className="label">Adresse</td><td className="value">{p.street} {p.houseNumber}, {p.postcode} {p.city}</td></tr>
                  <tr><td className="label">Baujahr</td><td className="value">{p.yearBuilt || "k.A."}</td></tr>
                  <tr><td className="label">Wohnflaeche</td><td className="value">{p.livingArea} m²</td></tr>
                  {p.plotArea && <tr><td className="label">Grundstuecksflaeche</td><td className="value">{p.plotArea} m²</td></tr>}
                  <tr><td className="label">Zustand</td><td className="value">{COND_DE[p.condition]}</td></tr>
                  {bldg && Object.entries(bldg).map(([k, v]) => (
                    <tr key={k}><td className="label">{k}</td><td className="value">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <PageFooter section="Das Gebaeude" page={listing.locationDescription ? 4 : 3} total={getPageCount(listing, photos, floorplans)} />
        </section>

        {/* ═══ AUSSTATTUNG ═══ */}
        {(attrs && attrs.length > 0) || specs ? (
          <section className="page">
            <div className="page-inner">
              <PageHeader address={`${p.street} ${p.houseNumber} · ${p.city}`} />
              <div className="section-head">
                <div className="meta-row">
                  <span className="section-num">— Ausstattung</span>
                  <span className="eyebrow">Materialien & Technik</span>
                </div>
                <h1>Ausstattung<br /><em>im Detail.</em></h1>
                <div className="section-rule" />
              </div>

              {specs ? (
                <div className="two-col">
                  {Object.entries(specs).map(([category, items]) => (
                    <div className="spec-block" key={category}>
                      <h3>{category}</h3>
                      <table className="spec-table">
                        <tbody>
                          {Object.entries(items as Record<string, string>).map(([k, v]) => (
                            <tr key={k}><td>{k}</td><td>{v}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ) : attrs && (
                <div className="two-col">
                  <div>
                    <ul className="f-list">
                      {attrs.slice(0, Math.ceil(attrs.length / 2)).map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                  <div>
                    <ul className="f-list">
                      {attrs.slice(Math.ceil(attrs.length / 2)).map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <PageFooter section="Ausstattung" page={0} total={getPageCount(listing, photos, floorplans)} />
          </section>
        ) : null}

        {/* ═══ UNIT OVERVIEW (bundle only) ═══ */}
        {isBundle && (
          <section className="page">
            <div className="page-inner">
              <PageHeader address={`${p.street} ${p.houseNumber} · ${p.city}`} />
              <div className="section-head">
                <div className="meta-row">
                  <span className="section-num">— Wohnungsuebersicht</span>
                  <span className="eyebrow">{units.length} Wohneinheiten</span>
                </div>
                <h1>Wohnungen<br /><em>im Ueberblick.</em></h1>
                <div className="section-rule" />
              </div>

              <table className="data-table" style={{ marginTop: "6mm" }}>
                <thead>
                  <tr>
                    <td className="label" style={{ fontWeight: 600 }}>Wohnung</td>
                    <td className="label" style={{ fontWeight: 600 }}>Flaeche</td>
                    <td className="label" style={{ fontWeight: 600 }}>Zimmer</td>
                    <td className="label" style={{ fontWeight: 600 }}>Bad</td>
                    <td className="label" style={{ fontWeight: 600 }}>Etage</td>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit) => (
                    <tr key={unit.id}>
                      <td className="value" style={{ fontWeight: 600 }}>{unit.unitLabel || "Wohnung"}</td>
                      <td className="value">{unit.livingArea} m²</td>
                      <td className="value">{unit.rooms || "-"}</td>
                      <td className="value">{unit.bathrooms || "-"}</td>
                      <td className="value">{unit.floor != null ? `${unit.floor}. OG` : "EG"}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid var(--ink)" }}>
                    <td className="value" style={{ fontWeight: 600 }}>Gesamt</td>
                    <td className="value" style={{ fontWeight: 600 }}>{units.reduce((s, u) => s + u.livingArea, 0)} m²</td>
                    <td className="value" style={{ fontWeight: 600 }}>{units.reduce((s, u) => s + (u.rooms || 0), 0)}</td>
                    <td className="value" style={{ fontWeight: 600 }}>{units.reduce((s, u) => s + (u.bathrooms || 0), 0)}</td>
                    <td className="value">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <PageFooter section="Wohnungsuebersicht" page={0} total={getPageCount(listing, photos, floorplans)} />
          </section>
        )}

        {/* ═══ PER-UNIT DETAIL PAGES (bundle only) ═══ */}
        {isBundle && units.map((unit) => {
          const unitRooms = unit.roomProgram as { name: string; area: number }[] | null;
          const unitFloorplans = unit.media.filter((m: { kind: string }) => m.kind === "FLOORPLAN");
          const unitPhotos = unit.media.filter((m: { kind: string }) => m.kind === "PHOTO");
          return [
            /* ── Unit Detail Page: key facts + room program ── */
            <section className="page" key={unit.id}>
              <div className="page-inner">
                <PageHeader address={`${p.street} ${p.houseNumber} · ${unit.unitLabel || "Wohnung"}`} />
                <div className="section-head">
                  <div className="meta-row">
                    <span className="section-num">— {unit.unitLabel || "Wohnung"}</span>
                    <span className="eyebrow">{unit.livingArea} m² · {unit.rooms || "-"} Zimmer</span>
                  </div>
                  <h1>{unit.unitLabel || "Wohnung"}<br /><em>{unit.livingArea} m²</em></h1>
                  <div className="section-rule" />
                </div>

                <div className="meta-grid" style={{ marginBottom: "6mm" }}>
                  <MetaCell label="Flaeche" value={`${unit.livingArea} m²`} />
                  <MetaCell label="Zimmer" value={unit.rooms ? String(unit.rooms) : "-"} />
                  <MetaCell label="Badezimmer" value={unit.bathrooms ? String(unit.bathrooms) : "-"} />
                  <MetaCell label="Etage" value={unit.floor != null ? `${unit.floor}. OG` : "EG"} />
                </div>

                {unitRooms && unitRooms.length > 0 && (
                  <div style={{ marginBottom: "6mm" }}>
                    <span className="eyebrow">Raumprogramm</span>
                    <div style={{ height: "2mm" }} />
                    <div className="rooms">
                      {unitRooms.map((r, i) => (
                        <div className="room-row" key={i}>
                          <span className="r-name">{r.name}</span>
                          <span className="r-area">{r.area} m²</span>
                        </div>
                      ))}
                      <div className="room-row total">
                        <span className="r-name">Gesamt</span>
                        <span className="r-area">{unitRooms.reduce((s, r) => s + r.area, 0).toFixed(1)} m²</span>
                      </div>
                    </div>
                  </div>
                )}

                {unitPhotos.length > 0 && (
                  <div>
                    <span className="eyebrow">Impressionen</span>
                    <div style={{ height: "3mm" }} />
                    <div className="photo-grid">
                      {unitPhotos.slice(0, 4).map((ph: { id: string; storageKey: string }) => (
                        <div key={ph.id} className="photo-cell">
                          <img src={ph.storageKey} alt="" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <PageFooter section={unit.unitLabel || "Wohnung"} page={0} total={getPageCount(listing, photos, floorplans)} />
            </section>,

            /* ── Unit Floor Plan Pages: one per floor plan ── */
            ...unitFloorplans.map((ufp: { id: string; storageKey: string; fileName: string | null }, ufpIdx: number) => (
              <section className="page" key={`${unit.id}-fp-${ufp.id}`}>
                <div className="page-inner">
                  <PageHeader address={`${p.street} ${p.houseNumber} · ${unit.unitLabel || "Wohnung"}`} />
                  <div className="section-head">
                    <div className="meta-row">
                      <span className="section-num">— Grundriss {unit.unitLabel || "Wohnung"}{unitFloorplans.length > 1 ? ` (${ufpIdx + 1}/${unitFloorplans.length})` : ""}</span>
                      <span className="eyebrow">{unit.livingArea} m²</span>
                    </div>
                    <h1>Grundriss<br /><em>{unit.unitLabel || "Wohnung"}</em></h1>
                    <div className="section-rule" />
                  </div>
                  <div style={{ textAlign: "center", marginTop: "6mm" }}>
                    {ufp.storageKey.toLowerCase().endsWith(".pdf") ? (
                      <iframe src={`${ufp.storageKey}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} style={{ width: "100%", height: "220mm", border: "none" }} />
                    ) : (
                      <img src={ufp.storageKey} alt={`Grundriss ${unit.unitLabel}`} style={{ maxWidth: "100%", maxHeight: "210mm" }} />
                    )}
                  </div>
                </div>
                <PageFooter section={`Grundriss ${unit.unitLabel || ""}`} page={0} total={getPageCount(listing, photos, floorplans)} />
              </section>
            )),
          ];
        })}

        {/* ═══ ROOM PROGRAM ═══ */}
        {rooms && rooms.length > 0 && (
          <section className="page">
            <div className="page-inner">
              <PageHeader address={`${p.street} ${p.houseNumber} · ${p.city}`} />
              <div className="section-head">
                <div className="meta-row">
                  <span className="section-num">— Raumprogramm</span>
                  <span className="eyebrow">Flaechen</span>
                </div>
                <h1>Raumprogramm<br /><em>im Detail.</em></h1>
                <div className="section-rule" />
              </div>
              <div className="rooms">
                {rooms.map((r, i) => (
                  <div className={`room-row${i === rooms.length - 1 ? " total" : ""}`} key={i}>
                    <span className="r-name">{r.name}</span>
                    <span className="r-area">{r.area} m²</span>
                  </div>
                ))}
              </div>
            </div>
            <PageFooter section="Raumprogramm" page={0} total={getPageCount(listing, photos, floorplans)} />
          </section>
        )}

        {/* ═══ FLOOR PLANS ═══ */}
        {floorplans.map((fp, fpIdx) => (
          <section className="page" key={`fp-${fp.id}`}>
            <div className="page-inner">
              <PageHeader address={`${p.street} ${p.houseNumber} · ${p.city}`} />
              <div className="section-head">
                <div className="meta-row">
                  <span className="section-num">— {isBundle ? "Grundriss Gebaeude" : "Grundriss"}{floorplans.length > 1 ? ` (${fpIdx + 1}/${floorplans.length})` : ""}</span>
                </div>
                <h1>{isBundle ? "Gebaeudegrundriss" : "Grundriss"}</h1>
                <div className="section-rule" />
              </div>
              <div style={{ textAlign: "center", marginTop: "8mm" }}>
                {fp.storageKey.toLowerCase().endsWith(".pdf") ? (
                  <iframe src={`${fp.storageKey}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} style={{ width: "100%", height: "220mm", border: "none" }} />
                ) : (
                  <img src={fp.storageKey} alt={fp.fileName || "Grundriss"} style={{ maxWidth: "100%", maxHeight: "210mm" }} />
                )}
              </div>
            </div>
            <PageFooter section="Grundriss" page={0} total={getPageCount(listing, photos, floorplans)} />
          </section>
        ))}

        {/* ═══ ENERGIE & VERKAUF ═══ */}
        <section className="page">
          <div className="page-inner">
            <PageHeader address={`${p.street} ${p.houseNumber} · ${p.city}`} />
            <div className="section-head">
              <div className="meta-row">
                <span className="section-num">— Energie & Verkauf</span>
                <span className="eyebrow">Pflichtangaben & Konditionen</span>
              </div>
              <h1>Pflichtangaben<br /><em>nach GEG.</em></h1>
              <div className="section-rule" />
            </div>

            <div className="two-col">
              <div>
                {p.energyCert ? (
                  <>
                    <span className="eyebrow">Energieausweis</span>
                    <div style={{ height: "4mm" }} />
                    <EnergyScale energyClass={p.energyCert.energyClass} />
                    <div style={{ height: "4mm" }} />
                    <table className="data-table compact">
                      <tbody>
                        <tr><td className="label">Art</td><td className="value">{p.energyCert.type === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis"}</td></tr>
                        <tr><td className="label">Kennwert</td><td className="value">{p.energyCert.energyValue} kWh/(m²·a)</td></tr>
                        <tr><td className="label">Energietraeger</td><td className="value">{p.energyCert.primarySource}</td></tr>
                        <tr><td className="label">Baujahr</td><td className="value">{p.yearBuilt || "k.A."}</td></tr>
                        <tr><td className="label">Gueltig bis</td><td className="value">{new Date(p.energyCert.validUntil).toLocaleDateString("de-DE")}</td></tr>
                      </tbody>
                    </table>
                  </>
                ) : (
                  <>
                    <span className="eyebrow">Energieausweis</span>
                    <div style={{ height: "3mm" }} />
                    <p className="muted">Energieausweis liegt zur Besichtigung vor.</p>
                  </>
                )}
              </div>
              <div>
                <span className="eyebrow">Kaufpreis</span>
                <div style={{ height: "3mm" }} />
                {price ? (
                  <div style={{ fontSize: "22pt", fontWeight: 500, fontFamily: "Georgia, serif", color: "var(--accent-ink)" }}>
                    EUR {price.toLocaleString("de-DE")}
                  </div>
                ) : (
                  <div style={{ fontSize: "14pt", fontStyle: "italic", color: "var(--ink-soft)" }}>auf Anfrage</div>
                )}
                <p className="small muted" style={{ marginTop: "4mm" }}>
                  Kaeufer-Provision, Notar- und Grundbuchkosten sowie Grunderwerbsteuer sind separat zu tragen.
                </p>
              </div>
            </div>
          </div>
          <PageFooter section="Energie & Verkauf" page={0} total={getPageCount(listing, photos, floorplans)} />
        </section>

        {/* ═══ PHOTO PAGES ═══ */}
        {photos.length > 2 && (
          <section className="page">
            <div className="page-inner">
              <PageHeader address={`${p.street} ${p.houseNumber} · ${p.city}`} />
              <div className="section-head">
                <div className="meta-row"><span className="section-num">— Impressionen</span></div>
                <h1>Bildergalerie</h1>
                <div className="section-rule" />
              </div>
              <div className="photo-grid">
                {photos.slice(2, 8).map((ph) => (
                  <div key={ph.id} className="photo-cell">
                    <img src={ph.storageKey} alt="" />
                  </div>
                ))}
              </div>
            </div>
            <PageFooter section="Impressionen" page={0} total={getPageCount(listing, photos, floorplans)} />
          </section>
        )}

        {/* ═══ CONTACT & LEGAL ═══ */}
        <section className="page">
          <div className="page-inner">
            <PageHeader address={`${p.street} ${p.houseNumber} · ${p.city}`} />
            <div className="section-head">
              <div className="meta-row">
                <span className="section-num">— Kontakt</span>
                <span className="eyebrow">Ansprechpartner</span>
              </div>
              <h1>Wir freuen uns<br /><em>auf Ihre Anfrage.</em></h1>
              <div className="section-rule" />
            </div>

            <div className="contact-card">
              <div>
                <div className="cc-eyebrow">— Eigentuemer / Verkauf</div>
                <h3>{contact?.company || "Direkta GmbH"}</h3>
                {contact?.name && <div className="c-line"><span className="c-key">Ansprechpartner</span> {contact.name}</div>}
                {contact?.phone && <div className="c-line"><span className="c-key">Telefon</span> {contact.phone}</div>}
                {contact?.email && <div className="c-line"><span className="c-key">E-Mail</span> {contact.email}</div>}
              </div>
              <div>
                <div className="cc-eyebrow">— Termin vereinbaren</div>
                <h3>Besichtigung &<br />Konditionen.</h3>
                <p style={{ fontSize: "8.5pt", color: "rgba(247,243,234,.75)", lineHeight: 1.55, marginTop: "3mm" }}>
                  Fuer einen Besichtigungstermin oder konkrete Anfragen wenden Sie sich bitte an den oben genannten Ansprechpartner.
                </p>
              </div>
            </div>

            <div className="legal" style={{ marginTop: "10mm" }}>
              <h4>Rechtliche Hinweise</h4>
              <p>
                Dieses Expose dient ausschliesslich der Information moeglicher Kaufinteressenten.
                Es stellt kein bindendes Angebot dar. Alle Angaben beruhen auf vom Eigentuemer zur
                Verfuegung gestellten Unterlagen. Eine Haftung fuer Vollstaendigkeit und Richtigkeit
                kann nicht uebernommen werden. Massgeblich sind die im notariell beurkundeten
                Kaufvertrag getroffenen Regelungen.
              </p>
              <p>
                Zwischenverkauf, Irrtum und Aenderungen vorbehalten. Gemaess Geldwaeschegesetz (GwG) ist
                der Verkaeufer verpflichtet, die Identitaet des Erwerbers vor Abschluss des Kaufvertrags festzustellen.
              </p>
            </div>
          </div>
          <PageFooter section="Kontakt & Rechtliches" page={0} total={getPageCount(listing, photos, floorplans)} />
        </section>

        {/* ═══ BACK COVER ═══ */}
        <section className="page back-cover">
          <div className="bc-mark">
            <span className="brand">Direkta<span className="dot">.</span></span>
            <div className="bc-rule" />
            <div className="bc-tag">Immobilie verkaufen. Direkt.</div>
          </div>
          <div className="bc-bottom">
            {p.street} {p.houseNumber} · {p.postcode} {p.city} · Expose · Stand {today} · www.direkta.de
          </div>
        </section>
    </>
  );
}

const ENERGY_COLORS: Record<string, string> = {
  "A+": "#00823b", A: "#1a9641", B: "#55b247", C: "#a6d96a",
  D: "#d9ef8b", E: "#fee08b", F: "#fdae61", G: "#f46d43", H: "#d73027",
};
const ENERGY_CLASSES_LIST = ["A+", "A", "B", "C", "D", "E", "F", "G", "H"];

function EnergyScale({ energyClass }: { energyClass: string }) {
  return (
    <div className="energy-scale">
      {ENERGY_CLASSES_LIST.map((cls) => {
        const isActive = cls === energyClass;
        return (
          <div key={cls} className={`es-cell${isActive ? " es-active" : ""}`} style={{ background: ENERGY_COLORS[cls] || "#ccc" }}>
            <span className="es-label">{cls}</span>
            {isActive && <div className="es-arrow" />}
          </div>
        );
      })}
    </div>
  );
}

function PageHeader({ address }: { address: string }) {
  return (
    <div className="page-header">
      <span className="ph-brand">Direkta<span className="dot">.</span></span>
      <span className="ph-meta">{address}</span>
    </div>
  );
}

function PageFooter({ section, page, total }: { section: string; page: number; total: number }) {
  return (
    <div className="page-footer">
      <span className="pf-brand">Direkta<span className="dot">.</span></span>
      <span>{section}</span>
      <span>{page > 0 ? `${String(page).padStart(2, "0")} / ${total}` : ""}</span>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-cell">
      <span className="m-label">{label}</span>
      <span className="m-value">{value}</span>
    </div>
  );
}

function getPageCount(listing: { locationDescription: string | null }, photos: unknown[], floorplans: unknown[]): number {
  let count = 5; // cover + overview + building + energy + contact + back
  if (listing.locationDescription) count++;
  if (floorplans.length > 0) count++;
  if (photos.length > 2) count++;
  return count;
}

// ─── Full CSS from reference (adapted) ───
const EXPOSE_CSS = `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --ink: #0F1B2E; --ink-soft: #485468; --ink-faint: #8A92A0;
  --paper: #F7F3EA; --paper-pure: #FBF8F1;
  --accent: #B85432; --accent-ink: #7A3920;
  --line: #D9D0BE; --line-soft: #E7DFCD;
  --muted: #EAE2CE; --muted-2: #DDD3BC;
}
html, body { background: var(--paper); color: var(--ink); font-family: Georgia, 'Palatino', serif; font-size: 9.5pt; line-height: 1.55; font-weight: 300; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; height: 297mm; position: relative; page-break-after: always; background: var(--paper); overflow: hidden; margin: 0 auto; }
.page:last-child { page-break-after: auto; }
.page-inner { position: absolute; inset: 18mm 18mm 24mm 18mm; }
.brand { font-family: Helvetica, Arial, sans-serif; font-weight: 700; font-size: 10pt; letter-spacing: .2em; color: var(--ink); text-transform: uppercase; }
.brand .dot { color: var(--accent); }
.eyebrow { font-family: Helvetica, sans-serif; font-size: 7pt; letter-spacing: .25em; text-transform: uppercase; color: var(--ink-faint); font-weight: 500; }
.eyebrow.accent { color: var(--accent); }
.section-num { font-style: italic; font-size: 11pt; color: var(--accent); letter-spacing: .04em; }
.section-head { margin-bottom: 8mm; }
.section-head .meta-row { display: flex; justify-content: space-between; align-items: baseline; }
.section-head h1 { font-size: 26pt; font-weight: 400; line-height: 1.05; letter-spacing: -.01em; color: var(--ink); margin-top: 3mm; }
.section-head h1 em { font-style: italic; color: var(--accent-ink); }
.section-rule { width: 40mm; height: 2px; background: var(--accent); margin-top: 2mm; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 5mm; border-bottom: 1px solid var(--line); margin-bottom: 8mm; }
.page-header .ph-brand { font-family: Helvetica, sans-serif; font-weight: 700; font-size: 9pt; letter-spacing: .2em; text-transform: uppercase; }
.page-header .ph-brand .dot { color: var(--accent); }
.page-header .ph-meta { font-family: Helvetica, sans-serif; font-size: 7pt; letter-spacing: .15em; text-transform: uppercase; color: var(--ink-faint); text-align: right; }
.page-footer { position: absolute; bottom: 8mm; left: 18mm; right: 18mm; display: flex; justify-content: space-between; align-items: center; font-family: Helvetica, sans-serif; font-size: 7pt; letter-spacing: .15em; color: var(--ink-faint); text-transform: uppercase; }
.page-footer .pf-brand { font-weight: 600; color: var(--ink); }
.page-footer .pf-brand .dot { color: var(--accent); }
.lede { font-size: 12pt; line-height: 1.55; color: var(--ink); font-weight: 400; letter-spacing: .005em; }
.lede em { color: var(--accent-ink); font-style: italic; }
p { font-size: 9.5pt; line-height: 1.65; color: var(--ink); margin-bottom: 4mm; }
p.muted { color: var(--ink-soft); }
p.small { font-size: 8.5pt; line-height: 1.55; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
.pull { margin: 6mm 0; padding: 6mm 8mm; background: var(--paper-pure); border-left: 3px solid var(--accent); }
.pull .pull-eyebrow { font-family: Helvetica, sans-serif; font-size: 7pt; letter-spacing: .25em; text-transform: uppercase; color: var(--accent); font-weight: 600; margin-bottom: 2mm; }
.f-list { list-style: none; padding: 0; margin: 0; }
.f-list li { font-size: 9pt; padding: 2mm 0 2mm 6mm; position: relative; border-bottom: 1px solid var(--line-soft); line-height: 1.5; }
.f-list li:last-child { border-bottom: none; }
.f-list li::before { content: ""; position: absolute; left: 0; top: 4.2mm; width: 3mm; height: 1px; background: var(--accent); }
.meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--line-soft); border: 1px solid var(--line-soft); }
.meta-cell { background: var(--paper-pure); padding: 4mm; display: flex; flex-direction: column; gap: 1.5mm; }
.meta-cell .m-label { font-family: Helvetica, sans-serif; font-size: 6.5pt; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-faint); font-weight: 500; }
.meta-cell .m-value { font-size: 13pt; font-weight: 500; color: var(--ink); line-height: 1.1; }
.data-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
.data-table td { text-align: left; padding: 2.8mm 3mm; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
.data-table .label { color: var(--ink-soft); font-weight: 300; width: 50%; }
.data-table .value { color: var(--ink); font-weight: 500; }
.data-table.compact td { padding: 2mm 2.5mm; font-size: 8.5pt; }
.rooms { display: grid; grid-template-columns: 1fr; gap: 0; }
.rooms .room-row { display: flex; justify-content: space-between; align-items: baseline; padding: 2mm 0; border-bottom: 1px solid var(--line-soft); font-size: 9pt; }
.rooms .room-row.total { border-bottom: none; border-top: 1px solid var(--ink); padding-top: 2.5mm; margin-top: 1mm; font-weight: 600; }
.rooms .r-name { color: var(--ink-soft); font-weight: 300; }
.rooms .r-area { color: var(--ink); font-weight: 500; }
.rooms .room-row.total .r-name, .rooms .room-row.total .r-area { color: var(--ink); }
.spec-block { margin-bottom: 4mm; }
.spec-block h3 { font-size: 10.5pt; font-weight: 500; letter-spacing: .01em; margin-bottom: 1.5mm; color: var(--ink); display: flex; align-items: baseline; gap: 4mm; }
.spec-block h3::after { content: ""; flex: 1; height: 1px; background: var(--line-soft); }
.spec-block .spec-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
.spec-block .spec-table td { padding: 1.4mm 3mm 1.4mm 0; vertical-align: top; line-height: 1.4; }
.spec-block .spec-table td:first-child { color: var(--ink-soft); width: 40%; }
.spec-block .spec-table td:last-child { color: var(--ink); }
.contact-card { background: var(--ink); color: var(--paper-pure); padding: 12mm 14mm; display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
.contact-card .cc-eyebrow { font-family: Helvetica, sans-serif; font-size: 7pt; letter-spacing: .3em; text-transform: uppercase; color: rgba(247,243,234,.55); margin-bottom: 3mm; }
.contact-card h3 { font-weight: 400; font-size: 16pt; line-height: 1.2; margin-bottom: 4mm; }
.contact-card .c-line { font-size: 9pt; margin-bottom: 1.5mm; color: rgba(247,243,234,.85); display: flex; gap: 4mm; }
.contact-card .c-key { display: inline-block; min-width: 32mm; color: rgba(247,243,234,.5); font-family: Helvetica, sans-serif; font-size: 7.5pt; letter-spacing: .15em; text-transform: uppercase; padding-top: 1mm; }
.legal { font-size: 7.5pt; line-height: 1.55; color: var(--ink-soft); }
.legal h4 { font-family: Helvetica, sans-serif; font-size: 7pt; letter-spacing: .25em; text-transform: uppercase; color: var(--ink); margin: 3mm 0 1.5mm; font-weight: 600; }
.legal p { font-size: 7.5pt; margin-bottom: 2.5mm; line-height: 1.55; }
.back-cover { background: var(--ink); color: var(--paper-pure); }
.back-cover .bc-mark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
.back-cover .bc-mark .brand { color: var(--paper-pure); font-size: 22pt; letter-spacing: .25em; }
.back-cover .bc-rule { width: 16mm; height: 2px; background: var(--accent); margin: 4mm auto; }
.back-cover .bc-tag { font-style: italic; font-size: 11pt; color: rgba(247,243,234,.7); }
.back-cover .bc-bottom { position: absolute; bottom: 12mm; left: 0; right: 0; text-align: center; font-family: Helvetica, sans-serif; font-size: 7pt; letter-spacing: .25em; text-transform: uppercase; color: rgba(247,243,234,.4); }
.cover { background: var(--paper); }
.cover-top { position: absolute; top: 0; left: 0; right: 0; height: 60%; overflow: hidden; }
.cover-top img { width: 100%; height: 100%; object-fit: cover; }
.cover-gradient { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(15,27,46,.25) 0%, rgba(15,27,46,0) 35%, rgba(15,27,46,0) 65%, rgba(15,27,46,.45) 100%); }
.cover-brand-bar { position: absolute; top: 14mm; left: 14mm; right: 14mm; display: flex; justify-content: space-between; align-items: center; z-index: 3; color: var(--paper-pure); }
.cover-brand-bar .brand { color: var(--paper-pure); font-size: 11pt; }
.cover-brand-bar .badge { border: 1px solid rgba(247,243,234,.6); padding: 1.5mm 4mm; font-family: Helvetica, sans-serif; font-size: 7pt; letter-spacing: .25em; text-transform: uppercase; }
.cover-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 40%; padding: 12mm 14mm 10mm 14mm; display: flex; flex-direction: column; justify-content: space-between; }
.cover-headline-block { display: flex; flex-direction: column; gap: 4mm; }
.cover-eyebrow { font-family: Helvetica, sans-serif; font-size: 8pt; letter-spacing: .35em; text-transform: uppercase; color: var(--accent); font-weight: 500; }
.cover-headline { font-size: 32pt; line-height: 1.02; font-weight: 400; letter-spacing: -.015em; color: var(--ink); max-width: 145mm; }
.cover-sub { font-size: 11pt; color: var(--ink-soft); font-weight: 300; }
.cover-sub strong { color: var(--ink); font-weight: 500; }
.cover-key-strip { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--line); padding-top: 5mm; }
.cover-key { display: flex; flex-direction: column; gap: 1mm; padding-right: 4mm; border-right: 1px solid var(--line-soft); }
.cover-key:last-child { border-right: none; }
.cover-key .k-label { font-family: Helvetica, sans-serif; font-size: 6.5pt; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-faint); }
.cover-key .k-value { font-size: 14pt; font-weight: 500; color: var(--ink); line-height: 1; }
.cover-key .k-unit { font-size: 7pt; color: var(--ink-soft); }
.cover-footer { position: absolute; bottom: 6mm; left: 14mm; right: 14mm; display: flex; justify-content: space-between; font-family: Helvetica, sans-serif; font-size: 7pt; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-faint); }
.placeholder { background: var(--muted); display: flex; align-items: center; justify-content: center; min-height: 60mm; }
.placeholder .ph-tag { font-family: Helvetica, sans-serif; font-size: 7pt; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-faint); }
.photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 6mm; }
.photo-cell img { width: 100%; height: 80mm; object-fit: cover; display: block; }
.energy-scale { display: flex; gap: 1px; margin: 0; }
.es-cell { flex: 1; text-align: center; padding: 2.5mm 0; position: relative; transition: all .15s; }
.es-cell .es-label { font-family: Helvetica, sans-serif; font-size: 7pt; font-weight: 600; color: white; letter-spacing: .04em; text-shadow: 0 0.5px 1px rgba(0,0,0,.3); }
.es-cell.es-active { transform: scaleY(1.35); z-index: 2; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
.es-cell.es-active .es-label { font-size: 9pt; font-weight: 700; }
.es-arrow { position: absolute; bottom: -3mm; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 2mm solid transparent; border-right: 2mm solid transparent; border-top: 2.5mm solid var(--ink); }
@media screen { .page { margin: 10mm auto; box-shadow: 0 2px 20px rgba(0,0,0,.1); } }
`;
