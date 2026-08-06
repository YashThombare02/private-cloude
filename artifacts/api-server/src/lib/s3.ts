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
  forcePathStyle: false, // B2 requires virtual-hosted style for CORS preflight to work correctly
  requestChecksumCalculation: "WHEN_NOT_SUPPORTED",
  responseChecksumValidation: "WHEN_NOT_SUPPORTED",
});

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "private-cloud";

// Backblaze B2 Web UI CORS rules DO NOT apply to the S3-compatible API.
// We must explicitly set the CORS rules using the S3 API for presigned URLs to work.
import { PutBucketCorsCommand } from "@aws-sdk/client-s3";

export async function ensureS3Cors() {
  try {
    const corsCommand = new PutBucketCorsCommand({
      Bucket: S3_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
            AllowedOrigins: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    });
    await s3Client.send(corsCommand);
    console.log("[S3] Successfully applied CORS rules to bucket:", S3_BUCKET_NAME);
  } catch (error) {
    console.error("[S3] Failed to apply CORS rules:", error);
  }
}
