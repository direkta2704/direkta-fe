import LegalLayout from "../components/legal-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Allgemeine Geschäftsbedingungen — Direkta",
};

export default function AGBPage() {
  return (
    <LegalLayout title="Allgemeine Geschäftsbedingungen (AGB)" lastUpdated="28. April 2026">
      <div className="not-prose bg-slate-50 rounded-xl p-6 mb-10 border border-slate-200">
        <h3 className="text-sm font-black text-blueprint mb-3 uppercase tracking-widest">Inhaltsverzeichnis</h3>
        <ol className="grid sm:grid-cols-2 gap-1 text-sm">
          <li><a href="#s1" className="text-primary hover:underline">§ 1 Geltungsbereich</a></li>
          <li><a href="#s2" className="text-primary hover:underline">§ 2 Leistungsbeschreibung</a></li>
          <li><a href="#s3" className="text-primary hover:underline">§ 3 Registrierung und Konto</a></li>
          <li><a href="#s4" className="text-primary hover:underline">§ 4 Preise und Zahlung</a></li>
          <li><a href="#s5" className="text-primary hover:underline">§ 5 Pflichten des Verkäufers</a></li>
          <li><a href="#s6" className="text-primary hover:underline">§ 6 Haftung</a></li>
          <li><a href="#s7" className="text-primary hover:underline">§ 7 Datenschutz</a></li>
          <li><a href="#s8" className="text-primary hover:underline">§ 8 Laufzeit und Kündigung</a></li>
          <li><a href="#s9" className="text-primary hover:underline">§ 9 Änderungen der AGB</a></li>
          <li><a href="#s10" className="text-primary hover:underline">§ 10 Schlussbestimmungen</a></li>
        </ol>
      </div>

      <h2 id="s1">§ 1 Geltungsbereich</h2>
      <p>
        Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Plattform Direkta
        (nachfolgend &quot;Plattform&quot;), betrieben von der Direkta GmbH, Musterstraße 1,
        10115 Berlin (nachfolgend &quot;Direkta&quot;).
      </p>
      <p>
        Direkta ist eine Softwareplattform, die Immobilieneigentümern (nachfolgend &quot;Verkäufer&quot;)
        den eigenständigen Verkauf ihrer Immobilie ermöglicht. Direkta tritt nicht als
        Immobilienmakler auf.
      </p>

      <h2 id="s2">§ 2 Leistungsbeschreibung</h2>
      <p>Direkta bietet folgende Leistungen:</p>
      <ul>
        <li>Erstellung eines professionellen Immobilieninsperats (Exposé) mittels KI-Unterstützung</li>
        <li>Preisempfehlung basierend auf Vergleichsobjekten</li>
        <li>Veröffentlichung des Inserats auf der Direkta-Plattform</li>
        <li>Verwaltung von Käuferanfragen und Besichtigungsterminen</li>
        <li>Angebotsverwaltung mit Bewertungssystem</li>
        <li>Notar-Übergabepaket bei Verkaufsabschluss</li>
      </ul>
      <p>
        Die KI-generierten Texte und Preisempfehlungen sind unverbindliche Vorschläge. Der
        Verkäufer ist der rechtliche Autor seines Inserats und für dessen Richtigkeit verantwortlich.
      </p>

      <h2 id="s3">§ 3 Registrierung und Konto</h2>
      <p>
        Zur Nutzung der Plattform als Verkäufer ist eine Registrierung erforderlich. Der Nutzer
        versichert, dass alle bei der Registrierung angegebenen Daten wahrheitsgemäß und vollständig
        sind. Das Konto ist nicht übertragbar.
      </p>
      <p>
        Der Nutzer ist für die Geheimhaltung seiner Zugangsdaten verantwortlich und haftet für
        alle Aktivitäten, die über sein Konto erfolgen.
      </p>

      <h2 id="s4">§ 4 Preise und Zahlungsbedingungen</h2>

      <h3>4.1 Direkta Flat</h3>
      <p>
        Einmalige Gebühr von €999 (inkl. MwSt.), fällig bei Veröffentlichung des Inserats.
        Beinhaltet alle Module der Plattform. Erstattung innerhalb von 14 Tagen möglich,
        sofern keine Käuferanfragen eingegangen sind.
      </p>

      <h3>4.2 Direkta Success</h3>
      <p>
        Erfolgsgebühr von 1% des Verkaufspreises, gedeckelt bei €4.900 (inkl. MwSt.), fällig
        bei Abschluss des Notarvertrags. Keine Vorabkosten. Keine Gebühr, wenn kein Verkauf
        zustande kommt.
      </p>

      <h3>4.3 Zahlungsabwicklung</h3>
      <p>
        Zahlungen werden über unseren Zahlungsdienstleister Stripe abgewickelt. Es gelten
        zusätzlich die Nutzungsbedingungen von Stripe.
      </p>

      <h2 id="s5">§ 5 Pflichten des Verkäufers</h2>
      <p>Der Verkäufer verpflichtet sich:</p>
      <ul>
        <li>Nur wahrheitsgemäße Angaben zu seiner Immobilie zu machen</li>
        <li>Einen gültigen Energieausweis vorzulegen (GEG-Pflicht)</li>
        <li>Keine irreführenden oder rechtswidrigen Inhalte zu veröffentlichen</li>
        <li>KI-generierte Texte vor Veröffentlichung zu prüfen und ggf. zu korrigieren</li>
        <li>Anfragen und Angebote zeitnah zu bearbeiten</li>
        <li>Direkta über den Verkaufsabschluss zu informieren (bei Erfolgsgebühr)</li>
      </ul>

      <h2 id="s6">§ 6 Haftung</h2>
      <p>
        Direkta haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers
        oder der Gesundheit sowie für vorsätzlich oder grob fahrlässig verursachte Schäden.
      </p>
      <p>
        Für leicht fahrlässig verursachte Schäden haftet Direkta nur bei Verletzung wesentlicher
        Vertragspflichten. Die Haftung ist in diesen Fällen auf den vorhersehbaren,
        vertragstypischen Schaden begrenzt.
      </p>
      <p>
        Direkta haftet nicht für die Richtigkeit von KI-generierten Preisempfehlungen,
        Beschreibungen oder Bewertungen. Diese dienen ausschließlich als unverbindliche Orientierung.
      </p>

      <h2 id="s7">§ 7 Datenschutz</h2>
      <p>
        Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer{" "}
        <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>

      <h2 id="s8">§ 8 Laufzeit und Kündigung</h2>
      <p>
        Der Vertrag wird auf unbestimmte Zeit geschlossen. Beide Parteien können den Vertrag
        jederzeit mit einer Frist von 14 Tagen zum Monatsende kündigen. Das Recht zur
        außerordentlichen Kündigung bleibt unberührt.
      </p>
      <p>
        Bei Kündigung werden aktive Inserate deaktiviert. Der Verkäufer kann seine Daten
        gemäß Art. 20 DSGVO vor der Löschung exportieren.
      </p>

      <h2 id="s9">§ 9 Änderungen der AGB</h2>
      <p>
        Direkta behält sich vor, diese AGB mit angemessener Ankündigungsfrist zu ändern.
        Der Nutzer wird über Änderungen per E-Mail informiert. Widerspricht der Nutzer nicht
        innerhalb von 30 Tagen, gelten die geänderten AGB als akzeptiert.
      </p>

      <h2 id="s10">§ 10 Schlussbestimmungen</h2>
      <p>
        Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist Berlin, sofern
        der Nutzer Kaufmann ist oder keinen allgemeinen Gerichtsstand in Deutschland hat.
      </p>
      <p>
        Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit
        der übrigen Bestimmungen unberührt.
      </p>
    </LegalLayout>
  );
}
