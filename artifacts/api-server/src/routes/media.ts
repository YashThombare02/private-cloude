import { Router } from "express";
import { db, filesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/jwt";
import { cloudinary } from "../lib/cloudinary";

const router = Router();
router.use(authenticate);

// Generate pre-signed URL
router.post("/uploads/request-url", requireAdmin, async (req, res) => {
  try {
    const timestamp = Math.round((new Date()).getTime() / 1000);
    const folder = 'private-cloud';
    const signature = cloudinary.utils.api_sign_request({
      timestamp,
      folder
    }, process.env.CLOUDINARY_API_SECRET!);

    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate upload signature" });
  }
});

// Finalize upload
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { originalFilename, mimeType, size, objectPath, mediaType, folderName } = req.body;
    const { userId } = res.locals.user;
    console.log("[DEBUG] POST /api/media body:", { originalFilename, mediaType, folderName, hasFolder: !!folderName });

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
  } catch (error) {
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

// Stream media
router.get("/:id/view", authenticate, async (req, res) => {
  try {
    const [file] = await db.select().from(filesTable).where(eq(filesTable.id, Number(req.params.id)));
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    // Cloudinary automatically serves optimal video streams and images
    const url = cloudinary.url(file.objectPath, { secure: true, resource_type: file.mediaType === 'video' ? 'video' : 'image' });
    res.redirect(url);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch file" });
  }
});

// Download file (forces attachment)
router.get("/:id/download", authenticate, async (req, res) => {
  try {
    const [file] = await db.select().from(filesTable).where(eq(filesTable.id, Number(req.params.id)));
    
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    
    const url = cloudinary.url(file.objectPath, { 
      secure: true, 
      resource_type: file.mediaType === 'video' ? 'video' : 'image',
      flags: "attachment"
    });
    res.redirect(url);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch file" });
  }
});

// Delete entire folder
router.delete("/folder/:name", requireAdmin, async (req, res) => {
  try {
    const folderName = req.params.name;
    
    // Get all files in this folder to delete from Cloudinary
    const filesInFolder = await db.select({ 
      id: filesTable.id, 
      objectPath: filesTable.objectPath, 
      mediaType: filesTable.mediaType 
    }).from(filesTable).where(eq(filesTable.folderName, folderName));

    if (filesInFolder.length === 0) {
      res.status(404).json({ error: "Folder not found or already empty" });
      return;
    }

    // Delete from DB first
    await db.delete(filesTable).where(eq(filesTable.folderName, folderName));
    
    // Delete from Cloudinary
    await Promise.allSettled(
      filesInFolder.map(f => 
        cloudinary.uploader.destroy(f.objectPath, { 
          resource_type: f.mediaType === 'video' ? 'video' : 'image' 
        })
      )
    );
    
    res.status(204).end();
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete media
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    // Get the file to delete from Cloudinary
    const [file] = await db.select({ objectPath: filesTable.objectPath, mediaType: filesTable.mediaType }).from(filesTable).where(eq(filesTable.id, id)).limit(1);
    
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Delete from DB
    await db.delete(filesTable).where(eq(filesTable.id, id));
    
    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(file.objectPath, { 
        resource_type: file.mediaType === 'video' ? 'video' : 'image' 
      });
    } catch (cloudinaryErr) {
      console.error("Cloudinary destroy error:", cloudinaryErr);
    }
    
    res.status(204).end();
  } catch (error) {
    console.error("Delete media error:", error);
    res.status(500).json({ error: "Failed to delete media" });
  }
});

// Toggle favorite
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { favorite } = req.body;

    const [updated] = await db.update(filesTable).set({ favorite }).where(eq(filesTable.id, id)).returning();
    
    if (!updated) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    
    res.json({ ...updated, hasThumbnail: !!updated.thumbnailObjectPath });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
