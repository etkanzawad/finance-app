ALTER TABLE "income" ADD COLUMN "account_id" integer REFERENCES "accounts"("id") ON DELETE SET NULL;
ALTER TABLE "income" ADD COLUMN "last_processed_date" text;
