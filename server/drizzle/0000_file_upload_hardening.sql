-- Existing rows predate byte validation. Treat their requested bucket as their
-- current location; new rows are only exposed after server-side verification.
ALTER TABLE "files" ADD COLUMN "requested_bucket" varchar(20);
UPDATE "files" SET "requested_bucket" = "bucket" WHERE "requested_bucket" IS NULL;
ALTER TABLE "files" ALTER COLUMN "requested_bucket" SET NOT NULL;
ALTER TABLE "files" ADD COLUMN "upload_status" varchar(20) DEFAULT 'pending' NOT NULL;
ALTER TABLE "files" ADD COLUMN "uploader_user_id" uuid REFERENCES "users"("id");

-- Existing public objects must be reviewed/quarantined at the storage layer:
-- they were uploaded before content-type and magic-byte validation existed.
UPDATE "files" SET "upload_status" = 'legacy_unverified' WHERE "bucket" = 'public';
