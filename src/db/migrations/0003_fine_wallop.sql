CREATE TABLE "dine_in_restaurants" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hotel_id" bigint NOT NULL,
	"restaurant_guid" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cuisine" text,
	"image_urls" text[] DEFAULT '{}',
	"rating" numeric(10, 2),
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"country" text,
	"phone_number" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"restaurant_id" bigint NOT NULL,
	"menu_guid" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_urls" text[] DEFAULT '{}',
	"last_updated" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_groups" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"menu_group_guid" uuid NOT NULL,
	"menu_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_urls" text[] DEFAULT '{}',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"menu_group_id" bigint NOT NULL,
	"menu_item_guid" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2),
	"calories" integer,
	"image_urls" text[] DEFAULT '{}',
	"allergens" text[],
	"modifier_groups_references" integer[],
	"sort_order" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_groups" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"modifier_group_guid" uuid NOT NULL,
	"menu_item_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"min_selections" integer,
	"max_selections" integer,
	"is_required" boolean,
	"is_multi_select" boolean,
	"modifier_options_references" integer[],
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_options" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"modifier_option_guid" uuid NOT NULL,
	"modifier_group_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2),
	"calories" integer,
	"is_default" boolean,
	"modifier_group_references" integer[],
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amenities" ALTER COLUMN "image_urls" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "dine_in_restaurants" ADD CONSTRAINT "dine_in_restaurants_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_restaurant_id_dine_in_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."dine_in_restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_groups" ADD CONSTRAINT "menu_groups_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menu_group_id_menu_groups_id_fk" FOREIGN KEY ("menu_group_id") REFERENCES "public"."menu_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_modifier_group_id_modifier_groups_id_fk" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dine_in_restaurants_hotel_id_index" ON "dine_in_restaurants" USING btree ("hotel_id");--> statement-breakpoint
CREATE INDEX "dine_in_restaurants_restaurant_guid_index" ON "dine_in_restaurants" USING btree ("restaurant_guid");--> statement-breakpoint
CREATE INDEX "menus_restaurant_id_index" ON "menus" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menus_menu_guid_index" ON "menus" USING btree ("menu_guid");--> statement-breakpoint
CREATE INDEX "menu_groups_menu_id_index" ON "menu_groups" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "menu_groups_menu_group_guid_index" ON "menu_groups" USING btree ("menu_group_guid");--> statement-breakpoint
CREATE INDEX "menu_items_menu_group_id_index" ON "menu_items" USING btree ("menu_group_id");--> statement-breakpoint
CREATE INDEX "menu_items_menu_item_guid_index" ON "menu_items" USING btree ("menu_item_guid");--> statement-breakpoint
CREATE INDEX "modifier_groups_menu_item_id_index" ON "modifier_groups" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "modifier_groups_modifier_group_guid_index" ON "modifier_groups" USING btree ("modifier_group_guid");--> statement-breakpoint
CREATE INDEX "modifier_options_modifier_group_id_index" ON "modifier_options" USING btree ("modifier_group_id");--> statement-breakpoint
CREATE INDEX "modifier_options_modifier_option_guid_index" ON "modifier_options" USING btree ("modifier_option_guid");--> statement-breakpoint
CREATE INDEX "amenities_hotel_id_index" ON "amenities" USING btree ("hotel_id");