export function generateICS(event: {
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  organizer?: string;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Direkta//Besichtigung//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(event.startsAt)}`,
    `DTEND:${fmt(event.endsAt)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}`,
    `LOCATION:${event.location}`,
    `STATUS:CONFIRMED`,
    `UID:${crypto.randomUUID()}@direkta.de`,
    `DTSTAMP:${fmt(new Date())}`,
    event.organizer ? `ORGANIZER:mailto:${event.organizer}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
