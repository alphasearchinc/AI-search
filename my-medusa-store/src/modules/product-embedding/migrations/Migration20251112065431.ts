import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20251112065431 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "product_embedding" ("id" text not null, "product_id" text not null, "embedding_vector" jsonb not null, "embedded_text" text not null, "metadata" jsonb null, "generated_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_embedding_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_embedding_deleted_at" ON "product_embedding" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_embedding" cascade;`);
  }

}
