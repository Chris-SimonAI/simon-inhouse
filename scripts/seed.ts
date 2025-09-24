import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import "dotenv/config";
import { type ClientConfig } from "pg";
import fs from "fs";
import { DEMO_HOTEL, DEMO_AMENITIES, DEMO_RESTAURANTS, DEMO_MENU, DEMO_MENU_GROUPS, DEMO_MENU_ITEMS, DEMO_MODIFIER_GROUPS, DEMO_MODIFIER_OPTIONS } from "./seed-data.ts";

const USE_SSL = process.env.USE_SSL_FOR_POSTGRES === "true";

const poolConfig = {
  connectionString: process.env.DATABASE_URL as string,
} as ClientConfig;

if (USE_SSL) {
    // Path to where we download the certificate bundle in user_data script
    const rdsCaCertPath = "/opt/certs/rds-ca-bundle.pem";

  if (!fs.existsSync(rdsCaCertPath)) {
    throw new Error(`SSL is enabled but certificate file not found at: ${rdsCaCertPath}`);
  }

  console.log(`📜 Using SSL certificate from: ${rdsCaCertPath}`);

  poolConfig.ssl = {
    rejectUnauthorized: true, // This is crucial for security
    // Read the certificate authority bundle from the file system
    ca: fs.readFileSync(rdsCaCertPath).toString(),
  };
}

const db = drizzle({
  connection: poolConfig,
});

async function resetTable(tableName: string, idColumn: string) {
  await db.execute(sql.raw(`DELETE FROM ${tableName}`));

  // Fetch the sequence name for the given table + column
  const result = await db.execute(
    sql`SELECT pg_get_serial_sequence(${tableName}, ${idColumn}) as seq;`
  );
  const seqName = result.rows?.[0]?.seq;

  if (seqName) {
    await db.execute(sql.raw(`ALTER SEQUENCE ${seqName} RESTART WITH 1`));
    console.log(`Reset sequence for ${tableName}.${idColumn}: ${seqName}`);
  } else {
    console.warn(`No sequence found for ${tableName}.${idColumn}`);
  }
}

async function resetAllTables() {
  console.log("Resetting all tables...");

  // Reset in correct dependency order (children first, then parents)
  const table_names = [
    "modifier_options",    // No dependencies
    "modifier_groups",     // Depends on menu_items
    "menu_items",          // Depends on menu_groups
    "menu_groups",         // Depends on menus
    "menus",              // Depends on dine_in_restaurants
    "tips",               // Depends on dine_in_restaurants
    "dine_in_restaurants", // Depends on hotels
    "amenities",          // Depends on hotels
    "hotels"              // No dependencies
  ];

  for (const tableName of table_names) {
    await resetTable(tableName, "id");
  }
  console.log("All tables reset successfully!");
}

async function insertedMenu(
  restaurantId: number,
  menuData: typeof DEMO_MENU,
  menuGroups: typeof DEMO_MENU_GROUPS,
  menuItems: typeof DEMO_MENU_ITEMS,
  modifierGroups: typeof DEMO_MODIFIER_GROUPS,
  modifierOptions: typeof DEMO_MODIFIER_OPTIONS
) { 
  const insertedMenu = await db.execute(sql`
    INSERT INTO menus (restaurant_id, menu_guid, name, description, metadata, created_at, updated_at)
    VALUES (${restaurantId}, ${menuData.menuGuid}, ${menuData.name}, ${menuData.description}, ${JSON.stringify(menuData.metadata)}, NOW(), NOW())
    RETURNING id
  `);
  const menuId = insertedMenu.rows[0].id;
  console.log(`Inserted menu with ID: ${menuId}`);

  // Insert menu groups
  const insertedMenuGroups = [];
  for (const group of menuGroups) {
    const imageUrlsArray = `{${group.imageUrls.map(url => `"${url.replace(/"/g, '\\"')}"`).join(',')}}`;
    const result = await db.execute(sql`
      INSERT INTO menu_groups (menu_id, menu_group_guid, name, image_urls, description, metadata, created_at, updated_at)
      VALUES (${menuId}, ${group.menuGroupGuid}, ${group.name}, ${imageUrlsArray}::text[], ${group.description}, ${JSON.stringify(group.metadata)}, NOW(), NOW())
      RETURNING id
    `);
    insertedMenuGroups.push(result);
  }
  console.log(`Inserted ${insertedMenuGroups?.length} menu groups`);

  // Create mapping of group GUIDs to IDs
  const groupIdMap = new Map<string, number>();
  insertedMenuGroups.forEach((group, index) => {
    groupIdMap.set(menuGroups[index].menuGroupGuid, group.rows[0].id as number);
  });

  // Create item to group mapping using direct menuGroupGuid references
  const itemToGroupMapping: Record<string, string> = {};
  
  // Map items to groups using the menuGroupGuid field
  menuItems.forEach(item => {
    if (item.menuGroupGuid) {
      itemToGroupMapping[item.menuItemGuid] = item.menuGroupGuid;
    }
  });

  // Insert menu items
  const insertedMenuItems = [];
  for (const item of menuItems) {
    const groupGuid = itemToGroupMapping[item.menuItemGuid];
    const menuGroupId = groupIdMap.get(groupGuid);
    if (!menuGroupId) {
      throw new Error(`Menu group not found for item ${item.menuItemGuid}`);
    }
    const { modifierGroupsReferences: _modifierGroupsReferences, ...itemWithoutRefs } = item;
    const imageUrlsArray = `{${itemWithoutRefs.imageUrls.map(img => `"${img.replace(/"/g, '\\"')}"`).join(',')}}`;
    const allergensArray = `{${itemWithoutRefs.allergens.map(allergen => `"${allergen.replace(/"/g, '\\"')}"`).join(',')}}`;
    const result = await db.execute(sql`
      INSERT INTO menu_items (menu_group_id, menu_item_guid, name, description, price, calories, image_urls, allergens, modifier_groups_references, sort_order, metadata, created_at, updated_at)
      VALUES (${menuGroupId}, ${itemWithoutRefs.menuItemGuid}, ${itemWithoutRefs.name}, ${itemWithoutRefs.description}, ${itemWithoutRefs.price}, ${itemWithoutRefs.calories}, ${imageUrlsArray}::text[], ${allergensArray}::text[], ARRAY[]::integer[], ${itemWithoutRefs.sortOrder}, ${JSON.stringify(itemWithoutRefs.metadata)}, NOW(), NOW())
      RETURNING id
    `);
    insertedMenuItems.push(result);
  }
  console.log(`Inserted ${insertedMenuItems?.length} menu items`);

  // Create mapping of item GUIDs to IDs
  const itemIdMap = new Map<string, number>();
  insertedMenuItems.forEach((item, index) => {
    itemIdMap.set(menuItems[index].menuItemGuid, item.rows[0].id as number);
  });

  // Create modifier groups by name and category for better lookup
  const modifierGroupsByCategory = new Map();
  modifierGroups.forEach(group => {
    const key = `${group.name}-${group.metadata.category}`;
    modifierGroupsByCategory.set(key, group);
  });

  // Define modifier group to item mapping using optimized lookups
  const modifierGroupToItemMapping = new Map();
  
  // Map modifier groups to items based on the modifierGroupsReferences in menu items
  menuItems.forEach(item => {
    item.modifierGroupsReferences.forEach(modifierGroupGuid => {
      modifierGroupToItemMapping.set(modifierGroupGuid, item.menuItemGuid);
    });
  });

  // Insert modifier groups
  const insertedModifierGroups = [];
  for (const group of modifierGroups) {
    const itemGuid = modifierGroupToItemMapping.get(group.modifierGroupGuid);
    if (!itemGuid) {
      console.error(`No mapping found for modifier group: ${group.name} (${group.modifierGroupGuid})`);
      console.error('Available mappings:', Array.from(modifierGroupToItemMapping.keys()));
      throw new Error(`No mapping found for modifier group ${group.name} (${group.modifierGroupGuid})`);
    }
    const menuItemId = itemIdMap.get(itemGuid);
    if (!menuItemId) {
      console.error(`Menu item not found for GUID: ${itemGuid}`);
      console.error('Available menu items:', Array.from(itemIdMap.keys()));
      throw new Error(`Menu item not found for modifier group ${group.modifierGroupGuid}`);
    }
    const { modifierOptionsReferences: _modifierOptionsReferences, ...groupWithoutRefs } = group;
    
    const result = await db.execute(sql`
      INSERT INTO modifier_groups (menu_item_id, modifier_group_guid, name, description, min_selections, max_selections, is_required, is_multi_select, metadata, created_at, updated_at)
      VALUES (${menuItemId}, ${groupWithoutRefs.modifierGroupGuid}, ${groupWithoutRefs.name}, ${groupWithoutRefs.description}, ${groupWithoutRefs.minSelections}, ${groupWithoutRefs.maxSelections}, ${groupWithoutRefs.isRequired}, ${groupWithoutRefs.isMultiSelect}, ${JSON.stringify(groupWithoutRefs.metadata)}, NOW(), NOW())
      RETURNING id
    `);
    insertedModifierGroups.push(result);
  }
  console.log(`Inserted ${insertedModifierGroups?.length} modifier groups`);

  // Create mapping of modifier group GUIDs to IDs
  const modifierGroupIdMap = new Map<string, number>();
  insertedModifierGroups.forEach((group, index) => {
    modifierGroupIdMap.set(modifierGroups[index].modifierGroupGuid, group.rows[0].id as number);
  });

  // Update menu items with correct modifier group IDs
  for (const item of menuItems) {
    const modifierGroupIds = item.modifierGroupsReferences
      .map(guid => modifierGroupIdMap.get(guid))
      .filter(id => id !== undefined) as number[];
    
    if (modifierGroupIds.length > 0) {
      await db.execute(sql`
        UPDATE menu_items 
        SET modifier_groups_references = ${sql.raw(`ARRAY[${modifierGroupIds.join(',')}]::integer[]`)}
        WHERE menu_item_guid = ${item.menuItemGuid}
      `);
    }
  }
  console.log(`Updated menu items with modifier group references`);

  // Define modifier option to group mapping using optimized lookups
  const modifierOptionToGroupMapping = new Map();
  
  // Map modifier options to groups based on the modifierOptionsReferences in modifier groups
  modifierGroups.forEach(group => {
    group.modifierOptionsReferences.forEach(modifierOptionGuid => {
      modifierOptionToGroupMapping.set(modifierOptionGuid, group.modifierGroupGuid);
    });
  });
  

  // Insert modifier options
  const insertedModifierOptions = [];
  for (const option of modifierOptions) {
    const groupGuid = modifierOptionToGroupMapping.get(option.modifierOptionGuid);
    if (!groupGuid) {
      console.error(`No mapping found for modifier option: ${option.name} (${option.modifierOptionGuid})`);
      console.error('Available mappings:', Array.from(modifierOptionToGroupMapping.keys()));
      throw new Error(`No mapping found for modifier option ${option.name} (${option.modifierOptionGuid})`);
    }
    const modifierGroupId = modifierGroupIdMap.get(groupGuid);
    if (!modifierGroupId) {
      console.error(`Modifier group not found for GUID: ${groupGuid}`);
      console.error('Available modifier groups:', Array.from(modifierGroupIdMap.keys()));
      throw new Error(`Modifier group not found for option ${option.modifierOptionGuid}`);
    }
    const { modifierGroupReferences: _modifierGroupReferences, ...optionWithoutRefs } = option;
    
    const result = await db.execute(sql`
      INSERT INTO modifier_options (modifier_group_id, modifier_option_guid, name, description, price, calories, is_default, metadata, created_at, updated_at)
      VALUES (${modifierGroupId}, ${optionWithoutRefs.modifierOptionGuid}, ${optionWithoutRefs.name}, ${optionWithoutRefs.description}, ${optionWithoutRefs.price}, ${optionWithoutRefs.calories}, ${optionWithoutRefs.isDefault}, '{}', NOW(), NOW())
      RETURNING id
    `);
    insertedModifierOptions.push(result);
  }
  console.log(`Inserted ${insertedModifierOptions?.length} modifier options`);
  console.log(`- Menus: 1`);
  console.log(`- Menu Groups: ${insertedMenuGroups?.length}`);
  console.log(`- Menu Items: ${insertedMenuItems?.length}`);
  console.log(`- Modifier Groups: ${insertedModifierGroups?.length}`);
  console.log(`- Modifier Options: ${insertedModifierOptions?.length}`);
}

async function main() {
  console.log("Starting comprehensive seed...");

  // Reset all tables
  await resetAllTables();

  // Insert hotel using direct SQL
  const insertedHotel = await db.execute(sql`
    INSERT INTO hotels (name, address, latitude, longitude, metadata, created_at, updated_at)
    VALUES (${DEMO_HOTEL.name}, ${DEMO_HOTEL.address}, ${DEMO_HOTEL.latitude}, ${DEMO_HOTEL.longitude}, ${JSON.stringify(DEMO_HOTEL.metadata)}, NOW(), NOW())
    RETURNING id
  `);
  const hotelId = insertedHotel.rows[0].id;
  console.log(`Inserted hotel with ID: ${hotelId}`);

  // Insert amenities using direct SQL with proper array formatting
  for (const amenity of DEMO_AMENITIES) {
    // Convert arrays to PostgreSQL array format
    const imageUrlsArray = `{${amenity.imageUrls.map(url => `"${url.replace(/"/g, '\\"')}"`).join(',')}}`;
    const tagsArray = `{${amenity.tags.map(tag => `"${tag.replace(/"/g, '\\"')}"`).join(',')}}`;

    await db.execute(sql`
      INSERT INTO amenities (hotel_id, name, description, long_description, image_urls, tags, metadata, created_at, updated_at)
      VALUES (${hotelId}, ${amenity.name}, ${amenity.description}, ${amenity.longDescription}, ${imageUrlsArray}::text[], ${tagsArray}::varchar[], ${JSON.stringify(amenity.metadata)}, NOW(), NOW())
    `);
  }
  console.log(`Inserted ${DEMO_AMENITIES.length} amenities`);

  // Insert restaurants
  for (const restaurant of DEMO_RESTAURANTS) {
    const imageUrlsArray = `{${restaurant.imageUrls.map(url => `"${url.replace(/"/g, '\\"')}"`).join(',')}}`;
    const restaurantResult = await db.execute(sql`
      INSERT INTO dine_in_restaurants (
        hotel_id, restaurant_guid, name, description, cuisine,
        image_urls, rating, address_line1, address_line2,
        city, state, zip_code, country, phone_number, metadata, created_at, updated_at
      )
      VALUES (
        ${hotelId}, ${restaurant.restaurantGuid}, ${restaurant.name},
        ${restaurant.description}, ${restaurant.cuisine},
        ${imageUrlsArray}::text[],   
        ${restaurant.rating},
        ${restaurant.addressLine1}, '', ${restaurant.city}, ${restaurant.state},
        ${restaurant.zipCode}, ${restaurant.country}, ${restaurant.phoneNumber},
        ${JSON.stringify(restaurant.metadata)}::jsonb,
        NOW(), NOW()
      )
      RETURNING id
    `);
    
    const restaurantId = restaurantResult.rows[0].id as number;
    console.log(`Inserted restaurant with ID: ${restaurantId}`);
    
    // Insert menu for this restaurant
    await insertedMenu(
      restaurantId,
      DEMO_MENU,
      DEMO_MENU_GROUPS,
      DEMO_MENU_ITEMS,
      DEMO_MODIFIER_GROUPS,
      DEMO_MODIFIER_OPTIONS
    );
  }

  console.log(`- Hotel: ${hotelId}`);
  console.log(`- Amenities: ${DEMO_AMENITIES.length}`);
  console.log(`- Restaurants: ${DEMO_RESTAURANTS.length}`);
  console.log("Comprehensive seed completed successfully!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});