CREATE TYPE "public"."event_status" AS ENUM('active', 'cancelled', 'sold_out');--> statement-breakpoint
CREATE TYPE "public"."seat_section" AS ENUM('front', 'back', 'balcony', 'vip');--> statement-breakpoint
CREATE TYPE "public"."seat_status" AS ENUM('available', 'reserved', 'sold');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"venue" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"image_url" text,
	"status" "event_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"section" "seat_section" NOT NULL,
	"row" text NOT NULL,
	"seat_number" text NOT NULL,
	"price_cents" integer NOT NULL,
	"status" "seat_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_tenant_starts_at_idx" ON "events" USING btree ("tenant_id","starts_at");--> statement-breakpoint
CREATE INDEX "inventory_event_status_idx" ON "inventory" USING btree ("event_id","status");