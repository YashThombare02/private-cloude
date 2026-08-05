import {
  bigint,
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const filesTable = pgTable("files", {
  id: serial("id").primaryKey(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  extension: text("extension").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  mediaType: text("media_type", { enum: ["photo", "video"] }).notNull(),
  objectPath: text("object_path").notNull(),
  thumbnailObjectPath: text("thumbnail_object_path"),
  uploadedBy: integer("uploaded_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  uploadedByUsername: text("uploaded_by_username").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  favorite: boolean("favorite").notNull().default(false),
  folderName: text("folder_name"),
});

export const insertFileSchema = createInsertSchema(filesTable).omit({
  id: true,
  uploadedAt: true,
});
export type InsertFile = z.infer<typeof insertFileSchema>;
export type MediaFile = typeof filesTable.$inferSelect;
