import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isDocx = file.name.toLowerCase().endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (isDocx) {
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(buffer);
      const docEntry = zip.getEntry("word/document.xml");

      if (!docEntry) {
        return NextResponse.json({ error: "Kein document.xml in der .docx Datei gefunden" }, { status: 400 });
      }

      const xmlContent = docEntry.getData().toString("utf-8");

      // Simple regex-based text extraction from Word XML
      // Matches all <w:t> tags and extracts their text content
      const lines: string[] = [];
      let currentLine = "";

      // Split by paragraphs <w:p>
      const paragraphs = xmlContent.split(/<w:p[ >]/);
      for (const para of paragraphs) {
        currentLine = "";
        // Extract text from <w:t> tags
        const textMatches = para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        for (const match of textMatches) {
          currentLine += match[1];
        }
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
      }

      const text = lines.join("\n");

      if (!text) {
        return NextResponse.json({ error: "Kein Text in der Datei gefunden" }, { status: 400 });
      }

      return NextResponse.json({ text, filename: file.name, lines: lines.length });
    }

    // Plain text files
    const text = buffer.toString("utf-8");
    return NextResponse.json({ text, filename: file.name });
  } catch (err) {
    console.error("Extract text error:", err);
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: `Textextraktion fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
