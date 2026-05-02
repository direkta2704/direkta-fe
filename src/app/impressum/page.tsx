import LegalLayout from "../components/legal-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum — Direkta",
};

export default function ImpressumPage() {
  return (
    <LegalLayout title="Impressum" lastUpdated="28. April 2026">
      {/* Table of contents */}
      <div className="not-prose bg-slate-50 rounded-xl p-6 mb-10 border border-slate-200">
        <h3 className="text-sm font-black text-blueprint mb-3 uppercase tracking-widest">Inhaltsverzeichnis</h3>
        <ol className="grid sm:grid-cols-2 gap-1 text-sm">
          <li><a href="#angaben" className="text-primary hover:underline">Angaben gemäß § 5 TMG</a></li>
          <li><a href="#vertreten" className="text-primary hover:underline">Vertreten durch</a></li>
          <li><a href="#kontakt" className="text-primary hover:underline">Kontakt</a></li>
          <li><a href="#register" className="text-primary hover:underline">Registereintrag</a></li>
          <li><a href="#ust" className="text-primary hover:underline">Umsatzsteuer-ID</a></li>
          <li><a href="#inhalt" className="text-primary hover:underline">Verantwortlich für Inhalt</a></li>
          <li><a href="#streit" className="text-primary hover:underline">EU-Streitschlichtung</a></li>
          <li><a href="#haftung-inhalt" className="text-primary hover:underline">Haftung für Inhalte</a></li>
          <li><a href="#haftung-links" className="text-primary hover:underline">Haftung für Links</a></li>
          <li><a href="#urheberrecht" className="text-primary hover:underline">Urheberrecht</a></li>
          <li><a href="#plattform" className="text-primary hover:underline">Hinweis zur Plattform</a></li>
        </ol>
      </div>

      <h2 id="angaben">Angaben gemäß § 5 TMG</h2>
      <p>
        Direkta GmbH<br />
        Musterstraße 1<br />
        10115 Berlin<br />
        Deutschland
      </p>

      <h2 id="vertreten">Vertreten durch</h2>
      <p>Geschäftsführer: [Name des Geschäftsführers]</p>

      <h2 id="kontakt">Kontakt</h2>
      <p>
        Telefon: +49 (0) 30 123456789<br />
        E-Mail: kontakt@direkta.de<br />
        Website: www.direkta.de
      </p>

      <h2 id="register">Registereintrag</h2>
      <p>
        Eintragung im Handelsregister.<br />
        Registergericht: Amtsgericht Berlin-Charlottenburg<br />
        Registernummer: HRB [Nummer]
      </p>

      <h2 id="ust">Umsatzsteuer-ID</h2>
      <p>
        Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:<br />
        DE [Nummer]
      </p>

      <h2 id="inhalt">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>
        [Name des Verantwortlichen]<br />
        Musterstraße 1<br />
        10115 Berlin
      </p>

      <h2 id="streit">EU-Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
        {" "}<a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>.
        Unsere E-Mail-Adresse finden Sie oben im Impressum.
      </p>

      <h2 id="verbraucher">Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2 id="haftung-inhalt">Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen
        Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir
        als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
        Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
        Tätigkeit hinweisen.
      </p>
      <p>
        Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
        allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch
        erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei
        Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
      </p>

      <h2 id="haftung-links">Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
        Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
        Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
        Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
        Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
      </p>

      <h2 id="urheberrecht">Urheberrecht</h2>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
        dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art
        der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung
        des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den
        privaten, nicht kommerziellen Gebrauch gestattet.
      </p>

      <h2 id="plattform">Hinweis zur Plattform</h2>
      <p>
        Direkta ist eine Softwareplattform, die Immobilieneigentümern den Privatverkauf ihrer
        Immobilie ermöglicht. Direkta tritt nicht als Immobilienmakler im Sinne des § 34c GewO auf.
        Preisempfehlungen sind unverbindliche Schätzungen und stellen keine Bewertungsgutachten dar.
        Der Verkäufer ist der rechtliche Autor seines Inserats. Für den Notartermin und die
        rechtliche Abwicklung ist ausschließlich der beurkundende Notar verantwortlich.
      </p>
    </LegalLayout>
  );
}
