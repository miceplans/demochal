ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "poster_file_id" uuid REFERENCES "files"("id") ON DELETE SET NULL;
