import { getFromS3 } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = path.join("/");

  const file = await getFromS3(key);
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.contentLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
