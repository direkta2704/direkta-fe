import LegalLayout from "../components/legal-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Widerrufsrecht — Direkta",
};

export default function WiderrufsrechtPage() {
  return (
    <LegalLayout title="Widerrufsbelehrung" lastUpdated="28. April 2026">
      <h2>Widerrufsrecht</h2>
      <p>
        Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag
        zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
      </p>
      <p>
        Um Ihr Widerrufsrecht auszuüben, müssen Sie uns:
      </p>
      <p>
        Direkta GmbH<br />
        Musterstraße 1<br />
        10115 Berlin<br />
        E-Mail: widerruf@direkta.de<br />
        Telefon: +49 (0) 30 123456789
      </p>
      <p>
        mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief oder
        E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können
        dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
      </p>
      <p>
        Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die
        Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
      </p>

      <h2>Folgen des Widerrufs</h2>
      <p>
        Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von
        Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen
        Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von
        uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens
        binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren
        Widerruf dieses Vertrags bei uns eingegangen ist.
      </p>
      <p>
        Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der
        ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich
        etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte
        berechnet.
      </p>

      <h2>Besondere Hinweise</h2>

      <h3>Direkta Flat (€999)</h3>
      <p>
        Der Widerruf ist innerhalb von 14 Tagen nach Vertragsabschluss möglich. Sofern bereits
        Käuferanfragen eingegangen sind, gilt die Leistung als erbracht, und der Widerruf kann
        ausgeschlossen sein, sofern Sie vor Ablauf der Widerrufsfrist ausdrücklich zugestimmt
        haben, dass wir mit der Ausführung der Dienstleistung beginnen, und Ihre Kenntnis davon
        bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der Ausführung des Vertrages
        Ihr Widerrufsrecht verlieren.
      </p>

      <h3>Direkta Success (Erfolgsgebühr)</h3>
      <p>
        Da die Erfolgsgebühr erst bei erfolgreichem Verkaufsabschluss fällig wird, bezieht
        sich das Widerrufsrecht auf den zugrundeliegenden Plattformnutzungsvertrag. Bei Widerruf
        werden aktive Inserate deaktiviert und die Plattformnutzung beendet.
      </p>

      <h2>Muster-Widerrufsformular</h2>
      <p>
        (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus
        und senden Sie es zurück.)
      </p>
      <div className="bg-slate-50 rounded-xl p-6 my-6 text-sm">
        <p>An: Direkta GmbH, Musterstraße 1, 10115 Berlin, E-Mail: widerruf@direkta.de</p>
        <p className="mt-4">
          Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über
          die Erbringung der folgenden Dienstleistung: Nutzung der Direkta-Plattform
        </p>
        <p className="mt-4">Bestellt am (*) / erhalten am (*):</p>
        <p className="mt-2">Name des/der Verbraucher(s):</p>
        <p className="mt-2">Anschrift des/der Verbraucher(s):</p>
        <p className="mt-4">Datum:</p>
        <p className="mt-2">Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):</p>
        <p className="mt-4 text-xs text-slate-400">(*) Unzutreffendes streichen.</p>
      </div>
    </LegalLayout>
  );
}
