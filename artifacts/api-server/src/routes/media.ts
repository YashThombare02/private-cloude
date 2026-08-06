import { Router } from "express";
import { db, filesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/jwt";
import { s3Client, S3_BUCKET_NAME } from "../lib/s3";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const router = Router();
router.use(authenticate);

// Generate pre-signed URL for uploading to S3
router.post("/uploads/request-url", requireAdmin, async (req, res) => {
  try {
    const { name, contentType } = req.body;
    
    // Generate a unique object key
    const objectKey = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    res.json({
      uploadUrl,
      objectKey
    });
  } catch (error) {
    console.error("Failed to generate presigned upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Finalize upload
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { originalFilename, mimeType, size, objectPath, mediaType, folderName } = req.body;
    const { userId } = res.locals.user;
    
    const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    const [newFile] = await db.insert(filesTable).values({
      originalFilename,
      mimeType,
      extension: originalFilename.split('.').pop() || "",
      size,
      objectPath,
      mediaType,
      folderName: folderName || null,
      uploadedBy: userId,
      uploadedByUsername: user?.username || "unknown"
    }).returning();

    res.status(201).json({ ...newFile, hasThumbnail: !!newFile.thumbnailObjectPath });
  } catch (error: any) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List media
router.get("/", async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit)) || 40;
    const files = await db.select().from(filesTable).orderBy(desc(filesTable.uploadedAt)).limit(limit);
    
    res.json({
      items: files.map(f => ({ ...f, hasThumbnail: !!f.thumbnailObjectPath })),
      total: files.length,
      hasMore: false
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Stream/View media
router.get("/:id/view", authenticate, async (req, res) => {
  try {
    const [file] = await db.select().from(filesTable).where(eq(filesTable.id, Number(req.params.id)));
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    // Generate a temporary presigned URL for viewing
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: file.objectPath,
    });
    
    // URL expires in 1 hour
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    res.redirect(url);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch file" });
  }
});

// Download file (forces attachment via ResponseContentDisposition in S3)
router.get("/:id/download", authenticate, async (req, res) => {
  try {
    const [file] = await db.select().from(filesTable).where(eq(filesTable.id, Number(req.params.id)));
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: file.objectPath,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.originalFilename)}"`,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    res.redirect(url);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch file" });
  }
});

// Delete entire folder
router.delete("/folder/:name", requireAdmin, async (req, res) => {
  try {
    const folderName = req.params.name;
    
    // Get all files in this folder to delete from S3
    const filesInFolder = await db.select({ 
      id: filesTable.id, 
      objectPath: filesTable.objectPath, 
    }).from(filesTable).where(eq(filesTable.folderName, folderName));

    if (filesInFolder.length === 0) {
      res.status(404).json({ error: "Folder not found or already empty" });
      return;
    }

    // Delete from DB first
    await db.delete(filesTable).where(eq(filesTable.folderName, folderName));
    
    // Delete from S3
    await Promise.allSettled(
      filesInFolder.map(f => 
        s3Client.send(new DeleteObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: f.objectPath
        }))
      )
    );
    
    res.status(204).end();
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete single media
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    // Get the file to delete from S3
    const [file] = await db.select({ objectPath: filesTable.objectPath }).from(filesTable).where(eq(filesTable.id, id)).limit(1);
    
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Delete from DB
    await db.delete(filesTable).where(eq(filesTable.id, id));
    
    // Delete from S3
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: file.objectPath
      }));
    } catch (s3Err) {
      console.error("S3 destroy error:", s3Err);
    }
    
    res.status(204).end();
  } catch (error) {
    console.error("Delete media error:", error);
    res.status(500).json({ error: "Failed to delete media" });
  }
});

export default router;
