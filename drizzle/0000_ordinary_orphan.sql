CREATE TABLE "task" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nis" text NOT NULL,
	"name" text NOT NULL,
	"gender" text,
	"class" text,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp,
	"deleted_by" text,
	CONSTRAINT "students_nis_unique" UNIQUE("nis")
);
--> statement-breakpoint
CREATE TABLE "saving_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"saving_type" text NOT NULL,
	"default_target_amount" numeric,
	"default_contribution_type" text,
	"default_contribution_value" numeric,
	"start_date" date,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp,
	"deleted_by" text,
	CONSTRAINT "saving_plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "student_savings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"saving_plan_id" uuid NOT NULL,
	"target_amount" numeric,
	"current_amount" numeric DEFAULT '0' NOT NULL,
	"contribution_type" text,
	"contribution_value" numeric,
	"start_date" date,
	"end_date" date,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_savings_id" uuid NOT NULL,
	"reference_no" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric NOT NULL,
	"description" text,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "reversals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ledger_entries_id" uuid NOT NULL,
	"reason" text,
	"reversed_by" text,
	"reversed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_savings" ADD CONSTRAINT "student_savings_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_savings" ADD CONSTRAINT "student_savings_saving_plan_id_saving_plans_id_fk" FOREIGN KEY ("saving_plan_id") REFERENCES "public"."saving_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_student_savings_id_student_savings_id_fk" FOREIGN KEY ("student_savings_id") REFERENCES "public"."student_savings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reversals" ADD CONSTRAINT "reversals_ledger_entries_id_ledger_entries_id_fk" FOREIGN KEY ("ledger_entries_id") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "students_nis_idx" ON "students" USING btree ("nis");--> statement-breakpoint
CREATE INDEX "students_active_idx" ON "students" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "students_class_idx" ON "students" USING btree ("class");--> statement-breakpoint
CREATE INDEX "students_name_idx" ON "students" USING btree ("name");--> statement-breakpoint
CREATE INDEX "students_deleted_at_idx" ON "students" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "saving_plans_code_idx" ON "saving_plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "saving_plans_active_idx" ON "saving_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "saving_plans_type_idx" ON "saving_plans" USING btree ("saving_type");--> statement-breakpoint
CREATE INDEX "saving_plans_start_date_idx" ON "saving_plans" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "saving_plans_end_date_idx" ON "saving_plans" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "saving_plans_created_by_idx" ON "saving_plans" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "saving_plans_deleted_at_idx" ON "saving_plans" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "student_savings_student_idx" ON "student_savings" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_savings_plan_idx" ON "student_savings" USING btree ("saving_plan_id");--> statement-breakpoint
CREATE INDEX "student_savings_status_idx" ON "student_savings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transfers_student_savings_idx" ON "ledger_entries" USING btree ("student_savings_id");--> statement-breakpoint
CREATE INDEX "transfers_reference_idx" ON "ledger_entries" USING btree ("reference_no");--> statement-breakpoint
CREATE INDEX "transfers_type_idx" ON "ledger_entries" USING btree ("type");--> statement-breakpoint
CREATE INDEX "transfers_created_at_idx" ON "ledger_entries" USING btree ("created_at");