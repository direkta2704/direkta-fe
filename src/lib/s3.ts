import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_S3_REGION || process.env.AWS_REGION || "eu-central-1";

const useS3 = !!(bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

const client = useS3
  ? new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null;

export function isS3Enabled() {
  return useS3;
}

export function getStorageUrl(s3Key: string): string {
  if (process.env.AWS_CLOUDFRONT_URL) {
    return `${process.env.AWS_CLOUDFRONT_URL}/${s3Key}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
}


export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!client || !bucket) throw new Error("S3 not configured");

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));

  return getStorageUrl(key);
}

export async function getFromS3(key: string): Promise<{ body: ReadableStream; contentType: string; contentLength: number } | null> {
  if (!client || !bucket) return null;

  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return {
      body: res.Body!.transformToWebStream(),
      contentType: res.ContentType || "application/octet-stream",
      contentLength: res.ContentLength || 0,
    };
  } catch {
    return null;
  }
}

export async function deleteFromS3(key: string): Promise<void> {
  if (!client || !bucket) return;

  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
}

export function extractS3Key(url: string): string | null {
  if (process.env.AWS_CLOUDFRONT_URL && url.startsWith(process.env.AWS_CLOUDFRONT_URL)) {
    return url.slice(process.env.AWS_CLOUDFRONT_URL.length + 1);
  }
  const s3Prefix = `https://${bucket}.s3.${region}.amazonaws.com/`;
  if (url.startsWith(s3Prefix)) {
    return url.slice(s3Prefix.length);
  }
  const apiPrefix = "/api/s3/";
  if (url.startsWith(apiPrefix)) {
    return url.slice(apiPrefix.length);
  }
  return null;
}
