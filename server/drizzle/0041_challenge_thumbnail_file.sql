ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "thumbnail_file_id" uuid REFERENCES "files"("id") ON DELETE SET NULL;
