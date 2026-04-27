import LegalLayout from "../components/legal-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung — Direkta",
};

export default function DatenschutzPage() {
  return (
    <LegalLayout title="Datenschutzerklärung" lastUpdated="28. April 2026">
      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlich für die Datenverarbeitung auf dieser Website ist:<br />
        Direkta GmbH, Musterstraße 1, 10115 Berlin<br />
        E-Mail: datenschutz@direkta.de
      </p>

      <h2>2. Erhebung und Speicherung personenbezogener Daten</h2>

      <h3>2.1 Beim Besuch der Website</h3>
      <p>
        Beim Aufrufen unserer Website werden durch den auf Ihrem Endgerät zum Einsatz kommenden
        Browser automatisch Informationen an den Server unserer Website gesendet. Diese Informationen
        werden temporär in einem sog. Logfile gespeichert. Folgende Informationen werden dabei ohne
        Ihr Zutun erfasst und bis zur automatisierten Löschung gespeichert:
      </p>
      <ul>
        <li>IP-Adresse des anfragenden Rechners</li>
        <li>Datum und Uhrzeit des Zugriffs</li>
        <li>Name und URL der abgerufenen Datei</li>
        <li>Website, von der aus der Zugriff erfolgt (Referrer-URL)</li>
        <li>Verwendeter Browser und ggf. das Betriebssystem Ihres Rechners</li>
      </ul>
      <p>
        Die Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
        technischen Bereitstellung und Sicherheit der Website).
      </p>

      <h3>2.2 Bei Registrierung (Verkäufer)</h3>
      <p>Bei der Erstellung eines Kontos erheben wir:</p>
      <ul>
        <li>Name</li>
        <li>E-Mail-Adresse</li>
        <li>Passwort (verschlüsselt gespeichert)</li>
        <li>Telefonnummer (optional)</li>
      </ul>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</p>

      <h3>2.3 Bei Immobilienangaben</h3>
      <p>
        Zur Erstellung eines Inserats erheben wir Immobiliendaten wie Adresse, Wohnfläche,
        Zustand, Fotos und Energieausweis-Daten. Diese Daten werden zur Erbringung unserer
        Dienstleistung verarbeitet.
      </p>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</p>

      <h3>2.4 Bei Kaufanfragen (Käufer)</h3>
      <p>
        Käufer können ohne Konto eine Anfrage senden. Dabei erheben wir: Name, E-Mail-Adresse,
        Telefonnummer (optional) und Nachricht. Diese Daten werden ausschließlich an den
        jeweiligen Eigentümer weitergeleitet.
      </p>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).</p>

      <h2>3. Weitergabe von Daten</h2>
      <p>Eine Übermittlung Ihrer persönlichen Daten an Dritte erfolgt nur:</p>
      <ul>
        <li>wenn Sie ausdrücklich eingewilligt haben (Art. 6 Abs. 1 lit. a DSGVO)</li>
        <li>wenn dies zur Vertragserfüllung erforderlich ist (Art. 6 Abs. 1 lit. b DSGVO)</li>
        <li>wenn eine gesetzliche Verpflichtung besteht (Art. 6 Abs. 1 lit. c DSGVO)</li>
      </ul>
      <p>
        Käuferanfragen werden nicht verkauft, syndiziert oder für Werbezwecke verwendet.
      </p>

      <h2>4. Auftragsverarbeiter</h2>
      <p>Wir setzen folgende Dienstleister als Auftragsverarbeiter ein:</p>
      <ul>
        <li><strong>Amazon Web Services (AWS)</strong> — Hosting und Datenbank (EU-Region Frankfurt)</li>
        <li><strong>Vercel Inc.</strong> — Frontend-Hosting</li>
        <li><strong>OpenRouter / Anthropic</strong> — KI-Textgenerierung (mit DPA)</li>
        <li><strong>PostHog</strong> — Produktanalyse (EU-gehostet)</li>
      </ul>
      <p>
        Mit allen Auftragsverarbeitern wurden Auftragsverarbeitungsverträge (AVV) gemäß
        Art. 28 DSGVO geschlossen. Alle Daten werden in der EU verarbeitet und gespeichert.
      </p>

      <h2>5. Cookies</h2>
      <p>
        Unsere Website verwendet Cookies. Bei Cookies handelt es sich um kleine Textdateien,
        die Ihr Browser automatisch erstellt und auf Ihrem Gerät speichert.
      </p>

      <h3>5.1 Technisch notwendige Cookies</h3>
      <p>
        Diese Cookies sind für den Betrieb der Website erforderlich (z.B. Session-Cookie für
        die Anmeldung). Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
      </p>

      <h3>5.2 Analyse-Cookies</h3>
      <p>
        Wir verwenden PostHog zur Analyse der Websitenutzung. Diese Cookies werden nur mit
        Ihrer Einwilligung gesetzt. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO.
      </p>
      <p>
        Sie können Ihre Cookie-Einstellungen jederzeit über den Cookie-Banner am unteren
        Bildschirmrand ändern.
      </p>

      <h2>6. Ihre Rechte</h2>
      <p>Sie haben gegenüber uns folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:</p>
      <ul>
        <li><strong>Auskunftsrecht</strong> (Art. 15 DSGVO)</li>
        <li><strong>Recht auf Berichtigung</strong> (Art. 16 DSGVO)</li>
        <li><strong>Recht auf Löschung</strong> (Art. 17 DSGVO)</li>
        <li><strong>Recht auf Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO)</li>
        <li><strong>Recht auf Datenübertragbarkeit</strong> (Art. 20 DSGVO)</li>
        <li><strong>Widerspruchsrecht</strong> (Art. 21 DSGVO)</li>
      </ul>
      <p>
        Diese Rechte können Sie über Ihre Kontoeinstellungen ausüben oder per E-Mail an
        datenschutz@direkta.de. Wir werden Ihre Anfrage innerhalb von 30 Tagen bearbeiten.
      </p>

      <h3>6.1 Datenexport</h3>
      <p>
        Sie können alle Ihre Daten als JSON- und PDF-Datei über die Kontoeinstellungen
        herunterladen (Art. 20 DSGVO).
      </p>

      <h3>6.2 Kontolöschung</h3>
      <p>
        Sie können Ihr Konto und alle damit verbundenen Daten über die Kontoeinstellungen
        löschen. Nach einer 14-tägigen Widerrufsfrist werden alle Daten unwiderruflich gelöscht
        (Art. 17 DSGVO).
      </p>

      <h2>7. Datensicherheit</h2>
      <p>
        Wir verwenden innerhalb des Website-Besuchs das verbreitete TLS-Verfahren (Transport
        Layer Security) in Verbindung mit der jeweils höchsten Verschlüsselungsstufe. Passwörter
        werden mit bcrypt gehasht gespeichert. Alle Datenbanken sind verschlüsselt (Encryption at Rest).
      </p>

      <h2>8. Datenresidenz</h2>
      <p>
        Alle personenbezogenen Daten werden ausschließlich in der Europäischen Union (AWS Region
        Frankfurt, eu-central-1) gespeichert und verarbeitet.
      </p>

      <h2>9. Beschwerderecht</h2>
      <p>
        Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung
        Ihrer personenbezogenen Daten zu beschweren. Zuständige Aufsichtsbehörde:<br />
        Berliner Beauftragte für Datenschutz und Informationsfreiheit<br />
        Friedrichstr. 219, 10969 Berlin
      </p>
    </LegalLayout>
  );
}
