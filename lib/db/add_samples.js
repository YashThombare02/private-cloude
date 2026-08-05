import "dotenv/config";
import { db, filesTable, usersTable } from "./src/index.ts";
import { eq } from "drizzle-orm";

async function main() {
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  
  if (!admin) {
    console.error("Admin user not found");
    process.exit(1);
  }

  // Insert a sample photo
  await db.insert(filesTable).values({
    originalFilename: "sample-photo.jpg",
    mimeType: "image/jpeg",
    extension: "jpg",
    size: 250000,
    objectPath: "cld-sample", // Standard cloudinary sample
    mediaType: "photo",
    uploadedBy: admin.id,
    uploadedByUsername: admin.username
  });

  // Insert a sample video
  await db.insert(filesTable).values({
    originalFilename: "sample-video.mp4",
    mimeType: "video/mp4",
    extension: "mp4",
    size: 5000000,
    objectPath: "samples/elephants", // Standard cloudinary sample
    mediaType: "video",
    uploadedBy: admin.id,
    uploadedByUsername: admin.username
  });

  console.log("Sample media inserted successfully!");
  process.exit(0);
}

main().catch(console.error);
