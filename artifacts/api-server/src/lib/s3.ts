import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.S3_ENDPOINT || !process.env.S3_REGION || !process.env.S3_BUCKET_NAME || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
  console.warn("S3 environment variables are not fully configured.");
}

export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "",
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  // Required for Backblaze B2 and other S3-compatible providers
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || true, 
});

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "private-cloud";
