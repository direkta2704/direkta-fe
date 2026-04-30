import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { isS3Enabled, uploadToS3 } from "@/lib/s3";
import { executeTool, rebuildMemory, MAX_COST_CENTS } from "@/lib/expose-agent";
import type { PhotoUpload } from "@/lib/expose-agent";
import type { Prisma } from "@prisma/client";

function asJson<T>(v: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;
}

export const dynamic = "force-dynamic";

// Upload a photo or Energieausweis PDF into the agent conversation.
// Photos are tracked in WorkingMemory.uploads[]; Energieausweis PDFs additionally
// trigger the energy_extract tool to populate energy fields.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id, status: "ACTIVE" },
      include: { turns: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Konversation nicht gefunden" }, { status: 404 });
    }

    const agentRun = await prisma.agentRun.findFirst({
      where: { conversationId: id, agentKind: "EXPOSE" },
      orderBy: { startedAt: "desc" },
    });
    if (!agentRun) {
      return NextResponse.json({ error: "AgentRun nicht gefunden" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const kindRaw = (formData.get("kind") as string) || "PHOTO";
    const kind: "PHOTO" | "FLOORPLAN" | "ENERGY_PDF" =
      kindRaw === "ENERGY_PDF" ? "ENERGY_PDF" : kindRaw === "FLOORPLAN" ? "FLOORPLAN" : "PHOTO";

    if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

    const allowed = kind === "ENERGY_PDF"
      ? ["application/pdf", "image/jpeg", "image/png"]
      : ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: kind === "ENERGY_PDF" ? "Erlaubt: PDF, JPG, PNG" : "Nur Bilddateien erlaubt" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Datei zu groß (max. 25 MB)" }, { status: 400 });
    }

    const memory = rebuildMemory(conversation.turns);
    if (kind === "PHOTO") {
      const existing = memory.uploads.filter((u) => u.kind === "PHOTO").length;
      if (existing >= 30) return NextResponse.json({ error: "Maximal 30 Fotos" }, { status: 400 });
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer()) as Buffer;
    let finalBuffer: Buffer = rawBuffer;
    let finalExt = (file.name.split(".").pop() || "bin").toLowerCase();
    let finalMime = file.type;
    let width: number | undefined;
    let height: number | undefined;

    if (file.type.startsWith("image/")) {
      const image = sharp(rawBuffer);
      const meta = await image.metadata();
      const maxDim = kind === "FLOORPLAN" ? 2400 : 1920;
      const needsResize = (meta.width && meta.width > maxDim) || (meta.height && meta.height > maxDim);
      const pipeline = needsResize
        ? image.resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
        : image;
      finalBuffer = (await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer()) as Buffer;
      finalExt = "jpg";
      finalMime = "image/jpeg";
      const outMeta = await sharp(finalBuffer).metadata();
      width = outMeta.width;
      height = outMeta.height;
    }

    const fileName = `${randomUUID()}.${finalExt}`;
    let storageKey: string;
    if (isS3Enabled()) {
      const s3Key = `conversations/${id}/${fileName}`;
      storageKey = await uploadToS3(s3Key, finalBuffer, finalMime);
    } else {
      const uploadDir = path.join(process.cwd(), "public", "uploads", "conversations", id);
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, fileName), finalBuffer);
      storageKey = `/uploads/conversations/${id}/${fileName}`;
    }

    const upload: PhotoUpload = {
      storageKey,
      fileName: file.name,
      mimeType: finalMime,
      sizeBytes: finalBuffer.length,
      width: width ?? null,
      height: height ?? null,
      kind,
    };

    // For non-ENERGY_PDF: just record the upload in memory via a SYSTEM turn
    // For ENERGY_PDF: extract text, run energy_extract tool, persist as TOOL turn
    if (kind !== "ENERGY_PDF") {
      // Persist the upload as a SYSTEM turn (memory.uploads gains the file)
      await prisma.conversationTurn.create({
        data: {
          conversationId: id,
          role: "SYSTEM",
          content: `[Upload] ${kind === "FLOORPLAN" ? "Grundriss" : "Foto"}: ${file.name}`,
          toolName: "upload",
          toolOutput: asJson({ memoryPatch: { uploads: [upload] } }),
        },
      });

      // Auto-trigger photo_analyse (with cost cap check)
      const memAfterUpload = rebuildMemory((await prisma.conversation.findFirst({
        where: { id }, include: { turns: { orderBy: { createdAt: "asc" } } },
      }))?.turns ?? []);
      const photoIndex = memAfterUpload.uploads.length - 1;
      const currentCost = agentRun.costCents ?? 0;
      if (photoIndex >= 0 && currentCost < MAX_COST_CENTS) {
        const tr = await executeTool("photo_analyse", { photoIndex }, memAfterUpload);

        await prisma.conversationTurn.create({
          data: {
            conversationId: id,
            role: "TOOL",
            content: "photo_analyse",
            toolName: "photo_analyse",
            toolInput: asJson({ photoIndex }),
            toolOutput: asJson({ ...tr.output, memoryPatch: tr.memoryPatch }),
            latencyMs: tr.latencyMs,
          },
        });

        const lastOrdinal = await prisma.agentStep.findFirst({
          where: { agentRunId: agentRun.id },
          orderBy: { ordinal: "desc" },
          select: { ordinal: true },
        });
        await prisma.agentStep.create({
          data: {
            agentRunId: agentRun.id,
            ordinal: (lastOrdinal?.ordinal ?? -1) + 1,
            toolName: "photo_analyse",
            input: asJson({ photoIndex, fileName: file.name }),
            output: asJson({ ...tr.output, memoryPatch: tr.memoryPatch }),
            latencyMs: tr.latencyMs,
            ok: tr.ok,
          },
        });
        await prisma.agentRun.update({
          where: { id: agentRun.id },
          data: { costCents: { increment: tr.costCents } },
        });
      }

      const refreshed = await prisma.conversation.findFirst({
        where: { id },
        include: { turns: { orderBy: { createdAt: "asc" } } },
      });
      const newMem = rebuildMemory(refreshed?.turns ?? []);
      return NextResponse.json({ ok: true, upload, memory: newMem });
    }

    // Energieausweis path: try text extraction, fall back to vision on the
    // PDF bytes (real Energieausweise are often scanned/image-only).
    let rawText = "";
    let pdfBase64: string | undefined;
    if (file.type === "application/pdf") {
      try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: new Uint8Array(rawBuffer) });
        const result = await parser.getText();
        await parser.destroy();
        rawText = (result.text || "").replace(/\s+/g, " ").trim().slice(0, 8000);
      } catch (e) {
        console.error("PDF text extraction failed:", e);
        rawText = "";
      }
      pdfBase64 = rawBuffer.toString("base64");
    } else if (file.type.startsWith("image/")) {
      // Image: pass directly as if it were a single-page PDF rendering. The
      // tool's vision path also accepts images by base64-coding them.
      pdfBase64 = rawBuffer.toString("base64");
    }

    const tr = await executeTool("energy_extract", { rawText, pdfBase64 }, memory);

    // Persist the upload as a SYSTEM turn (so memory.uploads gains the file)
    await prisma.conversationTurn.create({
      data: {
        conversationId: id,
        role: "SYSTEM",
        content: `[Upload] Energieausweis: ${file.name}`,
        toolName: "upload",
        toolOutput: asJson({ memoryPatch: { uploads: [upload] } }),
      },
    });

    // Persist the tool execution as a TOOL turn
    await prisma.conversationTurn.create({
      data: {
        conversationId: id,
        role: "TOOL",
        content: "energy_extract",
        toolName: "energy_extract",
        toolInput: asJson({ rawText: rawText.slice(0, 200) + (rawText.length > 200 ? "…" : "") }),
        toolOutput: asJson({ ...tr.output, memoryPatch: tr.memoryPatch }),
        latencyMs: tr.latencyMs,
      },
    });

    // AgentStep audit (F-M5-11)
    const lastOrdinal = await prisma.agentStep.findFirst({
      where: { agentRunId: agentRun.id },
      orderBy: { ordinal: "desc" },
      select: { ordinal: true },
    });
    await prisma.agentStep.create({
      data: {
        agentRunId: agentRun.id,
        ordinal: (lastOrdinal?.ordinal ?? -1) + 1,
        toolName: "energy_extract",
        input: asJson({ fileName: file.name, sizeBytes: finalBuffer.length }),
        output: asJson({ ...tr.output, memoryPatch: tr.memoryPatch }),
        latencyMs: tr.latencyMs,
        ok: tr.ok,
      },
    });

    // Update cost
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: { costCents: { increment: tr.costCents } },
    });

    const refreshed = await prisma.conversation.findFirst({
      where: { id },
      include: { turns: { orderBy: { createdAt: "asc" } } },
    });
    const newMem = rebuildMemory(refreshed?.turns ?? []);

    return NextResponse.json({
      ok: tr.ok,
      upload,
      extractedFields: tr.memoryPatch ?? null,
      memory: newMem,
      message: tr.ok
        ? "Energieausweis erkannt — bitte prüfen Sie die Werte."
        : "Energieausweis konnte nicht automatisch ausgelesen werden. Bitte tragen Sie die Werte manuell ein.",
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 });
  }
}
