import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || "Direkta <noreply@direkta.de>";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

function layout(content: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f7f3ea;font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-size:18px;font-weight:700;letter-spacing:0.15em;color:#0F1B2E;">DIREKTA<span style="color:#B85432">.</span></span>
  </div>
  <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e7dfcd;">
    ${content}
  </div>
  <div style="text-align:center;margin-top:20px;font-size:11px;color:#8A92A0;">
    Direkta GmbH · www.direkta.de · Immobilie verkaufen. Direkt.
  </div>
</div>
</body></html>`;
}

function btn(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:#B85432;color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;letter-spacing:0.05em;margin-top:16px;">${label}</a>`;
}

export async function sendNewLeadEmail(to: string, data: {
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  message?: string;
  qualityScore: number;
  propertyAddress: string;
  listingId: string;
}) {
  const scoreBadge = data.qualityScore >= 80 ? "🔥 Heiss" : data.qualityScore >= 50 ? "Warm" : "Kalt";
  await transporter.sendMail({
    from: FROM, to,
    subject: `Neue Anfrage: ${data.propertyAddress} (Score: ${data.qualityScore})`,
    html: layout(`
      <h2 style="margin:0 0 4px;font-size:18px;color:#0F1B2E;">Neue Kaufanfrage</h2>
      <p style="margin:0 0 20px;color:#485468;font-size:14px;">${data.propertyAddress}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#8A92A0;width:40%;">Name</td><td style="padding:8px 0;color:#0F1B2E;font-weight:500;">${data.leadName}</td></tr>
        <tr><td style="padding:8px 0;color:#8A92A0;">E-Mail</td><td style="padding:8px 0;color:#0F1B2E;">${data.leadEmail}</td></tr>
        ${data.leadPhone ? `<tr><td style="padding:8px 0;color:#8A92A0;">Telefon</td><td style="padding:8px 0;color:#0F1B2E;">${data.leadPhone}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#8A92A0;">Lead-Score</td><td style="padding:8px 0;color:#0F1B2E;font-weight:700;">${data.qualityScore}/100 ${scoreBadge}</td></tr>
      </table>
      ${data.message ? `<div style="margin-top:16px;padding:12px;background:#f7f3ea;border-radius:8px;font-size:13px;color:#485468;">${data.message}</div>` : ""}
      <div style="text-align:center;margin-top:20px;">
        ${btn(`${APP_URL}/dashboard/leads`, "Anfragen ansehen")}
      </div>
    `),
  });
}

export async function sendNewOfferEmail(to: string, data: {
  buyerName: string;
  amount: string;
  scoreComposite: number;
  propertyAddress: string;
  listingId: string;
}) {
  await transporter.sendMail({
    from: FROM, to,
    subject: `Neues Kaufangebot: EUR ${data.amount} fur ${data.propertyAddress}`,
    html: layout(`
      <h2 style="margin:0 0 4px;font-size:18px;color:#0F1B2E;">Neues Kaufangebot</h2>
      <p style="margin:0 0 20px;color:#485468;font-size:14px;">${data.propertyAddress}</p>
      <div style="text-align:center;padding:20px;background:#f7f3ea;border-radius:8px;margin-bottom:16px;">
        <div style="font-size:28px;font-weight:700;color:#B85432;">EUR ${data.amount}</div>
        <div style="font-size:12px;color:#8A92A0;margin-top:4px;">Angebotsscore: ${data.scoreComposite}/100</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#8A92A0;width:40%;">Kaeufer</td><td style="padding:8px 0;color:#0F1B2E;font-weight:500;">${data.buyerName}</td></tr>
      </table>
      <div style="text-align:center;margin-top:20px;">
        ${btn(`${APP_URL}/dashboard/offers`, "Angebote vergleichen")}
      </div>
    `),
  });
}

export async function sendViewingConfirmationEmail(to: string, data: {
  buyerName: string;
  propertyAddress: string;
  date: string;
  time: string;
  mode: string;
}) {
  await transporter.sendMail({
    from: FROM, to,
    subject: `Besichtigung bestaetigt: ${data.propertyAddress}`,
    html: layout(`
      <h2 style="margin:0 0 4px;font-size:18px;color:#0F1B2E;">Besichtigung bestaetigt</h2>
      <p style="margin:0 0 20px;color:#485468;font-size:14px;">${data.propertyAddress}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#8A92A0;width:40%;">Datum</td><td style="padding:8px 0;color:#0F1B2E;font-weight:500;">${data.date}</td></tr>
        <tr><td style="padding:8px 0;color:#8A92A0;">Uhrzeit</td><td style="padding:8px 0;color:#0F1B2E;">${data.time}</td></tr>
        <tr><td style="padding:8px 0;color:#8A92A0;">Art</td><td style="padding:8px 0;color:#0F1B2E;">${data.mode === "ONSITE" ? "Vor-Ort-Besichtigung" : "Virtuelle Besichtigung"}</td></tr>
        <tr><td style="padding:8px 0;color:#8A92A0;">Interessent</td><td style="padding:8px 0;color:#0F1B2E;">${data.buyerName}</td></tr>
      </table>
      <div style="text-align:center;margin-top:20px;">
        ${btn(`${APP_URL}/dashboard/viewings`, "Besichtigungen verwalten")}
      </div>
    `),
  });
}

export async function sendOfferDecisionEmail(to: string, data: {
  buyerName: string;
  propertyAddress: string;
  amount: string;
  accepted: boolean;
}) {
  const title = data.accepted ? "Angebot angenommen" : "Angebot abgelehnt";
  const color = data.accepted ? "#16a34a" : "#dc2626";
  await transporter.sendMail({
    from: FROM, to,
    subject: `${title}: ${data.propertyAddress}`,
    html: layout(`
      <h2 style="margin:0 0 4px;font-size:18px;color:#0F1B2E;">${title}</h2>
      <p style="margin:0 0 20px;color:#485468;font-size:14px;">${data.propertyAddress}</p>
      <div style="text-align:center;padding:20px;background:#f7f3ea;border-radius:8px;">
        <div style="font-size:14px;font-weight:700;color:${color};letter-spacing:0.1em;text-transform:uppercase;">${title}</div>
        <div style="font-size:22px;font-weight:700;color:#0F1B2E;margin-top:8px;">EUR ${data.amount}</div>
        <div style="font-size:12px;color:#8A92A0;margin-top:4px;">${data.buyerName}</div>
      </div>
      ${data.accepted ? `<p style="margin-top:16px;font-size:13px;color:#485468;">Der Eigentuemer wird sich in Kuerze bezueglich der naechsten Schritte (Notartermin) bei Ihnen melden.</p>` : `<p style="margin-top:16px;font-size:13px;color:#485468;">Vielen Dank fuer Ihr Interesse. Leider hat sich der Eigentuemer fuer ein anderes Angebot entschieden.</p>`}
    `),
  });
}

export async function sendBuyerEnquiryConfirmation(to: string, data: {
  buyerName: string;
  propertyAddress: string;
  pdfBuffer?: Buffer;
  pdfFilename?: string;
}) {
  const attachments = data.pdfBuffer && data.pdfFilename
    ? [{ filename: data.pdfFilename, content: data.pdfBuffer, contentType: "application/pdf" }]
    : [];

  await transporter.sendMail({
    from: FROM, to,
    subject: `Ihr Expose: ${data.propertyAddress}`,
    html: layout(`
      <h2 style="margin:0 0 4px;font-size:18px;color:#0F1B2E;">Vielen Dank fuer Ihr Interesse</h2>
      <p style="margin:0 0 20px;color:#485468;font-size:14px;">${data.propertyAddress}</p>
      <p style="font-size:13px;color:#485468;line-height:1.6;">
        Hallo ${data.buyerName},<br><br>
        vielen Dank fuer Ihre Anfrage. Anbei finden Sie das ausfuehrliche Expose mit allen Details zur Immobilie.
        Der Eigentuemer wird sich in Kuerze bei Ihnen melden.
      </p>
      ${data.pdfBuffer ? `<div style="margin-top:16px;padding:12px;background:#f7f3ea;border-radius:8px;font-size:13px;color:#485468;">
        <strong>📎 Expose PDF</strong> — ${data.pdfFilename} (im Anhang)
      </div>` : ""}
      <p style="margin-top:16px;font-size:12px;color:#8A92A0;">
        Diese E-Mail wurde automatisch von Direkta versendet.
      </p>
    `),
    attachments,
  });
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${APP_URL}/api/auth/verify-email?token=${token}`;
  await transporter.sendMail({
    from: FROM, to,
    subject: "Direkta — E-Mail bestätigen",
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:18px;color:#0F1B2E;">E-Mail-Adresse bestätigen</h2>
      <p style="color:#4A5568;font-size:14px;line-height:1.6;">Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren und Inserate veröffentlichen zu können.</p>
      ${btn(url, "E-Mail bestätigen")}
      <p style="color:#8A92A0;font-size:12px;margin-top:16px;">Dieser Link ist 30 Minuten gültig.</p>
    `),
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${APP_URL}/api/auth/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM, to,
    subject: "Direkta — Passwort zurücksetzen",
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:18px;color:#0F1B2E;">Passwort zurücksetzen</h2>
      <p style="color:#4A5568;font-size:14px;line-height:1.6;">Sie haben eine Passwort-Zurücksetzung angefordert. Klicken Sie auf den Button, um ein neues Passwort zu setzen.</p>
      ${btn(url, "Neues Passwort setzen")}
      <p style="color:#8A92A0;font-size:12px;margin-top:16px;">Dieser Link ist 30 Minuten gültig. Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>
    `),
  });
}

export async function sendMagicLinkEmail(to: string, token: string) {
  const url = `${APP_URL}/api/auth/magic-link?token=${token}`;
  await transporter.sendMail({
    from: FROM, to,
    subject: "Direkta — Anmeldung per Link",
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:18px;color:#0F1B2E;">Anmelden bei Direkta</h2>
      <p style="color:#4A5568;font-size:14px;line-height:1.6;">Klicken Sie auf den Button, um sich ohne Passwort anzumelden.</p>
      ${btn(url, "Jetzt anmelden")}
      <p style="color:#8A92A0;font-size:12px;margin-top:16px;">Dieser Link ist 30 Minuten gültig und kann nur einmal verwendet werden.</p>
    `),
  });
}

export async function sendBuyerQualificationEmail(to: string, data: {
  buyerName: string;
  propertyAddress: string;
  listingId: string;
}) {
  const url = `${APP_URL}/api/public/qualify?listingId=${data.listingId}&email=${encodeURIComponent(to)}`;
  await transporter.sendMail({
    from: FROM, to,
    subject: `Direkta — Ihre Anfrage für ${data.propertyAddress}`,
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:18px;color:#0F1B2E;">Vielen Dank für Ihre Anfrage</h2>
      <p style="color:#4A5568;font-size:14px;line-height:1.6;">
        Hallo ${data.buyerName},<br><br>
        vielen Dank für Ihr Interesse an der Immobilie <strong>${data.propertyAddress}</strong>.
        Um Ihnen schnellstmöglich weiterhelfen zu können, bitten wir Sie um drei kurze Angaben:
      </p>
      <div style="background:#f7f3ea;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="color:#0F1B2E;font-size:13px;font-weight:700;margin:0 0 8px;">1. Wie hoch ist Ihr Budget?</p>
        <p style="color:#0F1B2E;font-size:13px;font-weight:700;margin:0 0 8px;">2. Wie ist Ihr Finanzierungsstatus?</p>
        <p style="color:#4A5568;font-size:12px;margin:0 0 4px;">□ Barzahlung / Eigenkapital</p>
        <p style="color:#4A5568;font-size:12px;margin:0 0 4px;">□ Finanzierung vorab genehmigt</p>
        <p style="color:#4A5568;font-size:12px;margin:0 0 4px;">□ Finanzierung in Bearbeitung</p>
        <p style="color:#4A5568;font-size:12px;margin:0 0 8px;">□ Noch keine Finanzierung</p>
        <p style="color:#0F1B2E;font-size:13px;font-weight:700;margin:0;">3. Wann möchten Sie kaufen?</p>
        <p style="color:#4A5568;font-size:12px;margin:4px 0 0;">□ Sofort  □ Innerhalb 3 Monate  □ Innerhalb 6 Monate  □ Später</p>
      </div>
      ${btn(url, "Jetzt beantworten")}
      <p style="color:#8A92A0;font-size:12px;margin-top:16px;">
        Oder antworten Sie einfach auf diese E-Mail mit Ihren Angaben.
        Ihre Daten werden nur an den Eigentümer weitergeleitet.
      </p>
    `),
  });
}
