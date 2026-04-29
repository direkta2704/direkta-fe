import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Was ist meine Immobilie wert? — Kostenlose Bewertung | Direkta",
  description:
    "Erhalten Sie in 60 Sekunden eine fundierte Preiseinschätzung für Ihre Immobilie. Kostenlos, unverbindlich und ohne Makler. Basierend auf aktuellen Marktdaten und Vergleichsobjekten.",
  openGraph: {
    title: "Was ist meine Immobilie wert? — Kostenlose Bewertung",
    description: "Kostenlose Immobilienbewertung in 60 Sekunden. Marktgerechte Preiseinschätzung basierend auf aktuellen Vergleichsobjekten.",
    type: "website",
  },
};

export default function ValuationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
