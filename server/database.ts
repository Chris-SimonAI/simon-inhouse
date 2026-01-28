import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'admin.db');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    address TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('hotel', 'airbnb')),
    url TEXT,
    image_url TEXT,
    timezone TEXT DEFAULT 'America/Los_Angeles',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    toast_url TEXT NOT NULL,
    delivery_available INTEGER DEFAULT 0,
    high_delivery_fee INTEGER DEFAULT 0,
    last_checked DATETIME,
    hours TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'unavailable')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    base_price REAL NOT NULL,
    markup_percent REAL DEFAULT 0,
    markup_flat REAL DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    category TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS modifier_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    required INTEGER DEFAULT 0,
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS modifiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    group_id INTEGER,
    name TEXT NOT NULL,
    price REAL DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants(location_id);
  CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_modifier_groups_menu_item ON modifier_groups(menu_item_id);
  CREATE INDEX IF NOT EXISTS idx_modifiers_menu_item ON modifiers(menu_item_id);
  CREATE INDEX IF NOT EXISTS idx_modifiers_group ON modifiers(group_id);

  -- Location-Restaurant junction table for shared menus
  CREATE TABLE IF NOT EXISTS location_restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    delivery_available INTEGER DEFAULT 0,
    high_delivery_fee INTEGER DEFAULT 0,
    delivery_verified_at DATETIME,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'unavailable', 'out_of_range')),
    markup_percent REAL DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(location_id, restaurant_id)
  );

  CREATE INDEX IF NOT EXISTS idx_location_restaurants_location ON location_restaurants(location_id);
  CREATE INDEX IF NOT EXISTS idx_location_restaurants_restaurant ON location_restaurants(restaurant_id);

  CREATE TABLE IF NOT EXISTS order_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER,
    location_id INTEGER,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'success', 'failed')),
    stage TEXT CHECK (stage IN ('init', 'page_load', 'add_to_cart', 'checkout', 'delivery', 'customer_info', 'payment', 'submit', 'complete')),
    error_message TEXT,
    error_type TEXT,
    screenshot_path TEXT,
    order_total REAL,
    items_json TEXT,
    customer_json TEXT,
    dry_run INTEGER DEFAULT 0,
    retry_of INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
    FOREIGN KEY (retry_of) REFERENCES order_attempts(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_order_attempts_restaurant ON order_attempts(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_order_attempts_location ON order_attempts(location_id);
  CREATE INDEX IF NOT EXISTS idx_order_attempts_status ON order_attempts(status);
  CREATE INDEX IF NOT EXISTS idx_order_attempts_created ON order_attempts(created_at);

  -- Twilio phone number pool for order tracking
  CREATE TABLE IF NOT EXISTS twilio_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL UNIQUE,
    friendly_name TEXT,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    active INTEGER DEFAULT 1,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_twilio_numbers_location ON twilio_numbers(location_id);
  CREATE INDEX IF NOT EXISTS idx_twilio_numbers_active ON twilio_numbers(active);

  -- Orders table for tracking guest orders with generated contact info
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_attempt_id INTEGER REFERENCES order_attempts(id) ON DELETE SET NULL,
    location_id INTEGER NOT NULL REFERENCES locations(id),
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
    guest_first_name TEXT NOT NULL,
    guest_last_name TEXT NOT NULL,
    guest_phone TEXT NOT NULL,
    guest_email TEXT,
    generated_email TEXT NOT NULL,
    twilio_number_id INTEGER REFERENCES twilio_numbers(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'driver_assigned', 'en_route', 'delivered', 'failed')),
    external_order_id TEXT,
    confirmation_number TEXT,
    tracking_url TEXT,
    estimated_delivery TEXT,
    items_json TEXT,
    order_total REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_orders_location ON orders(location_id);
  CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_twilio ON orders(twilio_number_id);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

  -- Order status history/timeline
  CREATE TABLE IF NOT EXISTS order_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    message TEXT,
    source TEXT DEFAULT 'system' CHECK (source IN ('system', 'sms', 'manual')),
    raw_sms TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_order_statuses_order ON order_statuses(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_statuses_created ON order_statuses(created_at);

  -- App-wide settings (key-value store for Twilio credentials, etc.)
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Guest profiles for tracking preferences and order history
  CREATE TABLE IF NOT EXISTS guest_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    dietary_preferences TEXT,
    allergies TEXT,
    favorite_cuisines TEXT,
    dislikes TEXT,
    notes TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_guest_profiles_phone ON guest_profiles(phone);
  CREATE INDEX IF NOT EXISTS idx_guest_profiles_email ON guest_profiles(email);
`);

// Migration: Add slug column to locations (without UNIQUE constraint in ALTER TABLE)
try {
  db.exec(`ALTER TABLE locations ADD COLUMN slug TEXT`);
  console.log('Migration: Added slug column to locations table');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.error('Migration error:', e.message);
  }
}

// Create unique index on slug after column exists
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_slug ON locations(slug)`);
} catch (e: any) {
  // Index may already exist or fail if there are duplicate values
}

// Migration: Add image_url column to locations
try {
  db.exec(`ALTER TABLE locations ADD COLUMN image_url TEXT`);
  console.log('Migration: Added image_url column to locations table');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.error('Migration error:', e.message);
  }
}

// Migration: Add timezone column to locations
try {
  db.exec(`ALTER TABLE locations ADD COLUMN timezone TEXT DEFAULT 'America/Los_Angeles'`);
  console.log('Migration: Added timezone column to locations table');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.error('Migration error:', e.message);
  }
}

// Migration: Generate slugs for existing locations without slugs
try {
  const locationsWithoutSlug = db.prepare('SELECT id, name FROM locations WHERE slug IS NULL').all() as any[];
  for (const loc of locationsWithoutSlug) {
    const slug = loc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    db.prepare('UPDATE locations SET slug = ? WHERE id = ?').run(slug, loc.id);
  }
  if (locationsWithoutSlug.length > 0) {
    console.log(`Migration: Generated slugs for ${locationsWithoutSlug.length} locations`);
  }
} catch (e: any) {
  console.error('Migration error:', e.message);
}

// Migration: Make location_id nullable in restaurants table (for library-only restaurants)
try {
  // Check if we need to migrate (if location_id is still NOT NULL)
  const tableInfo = db.prepare("PRAGMA table_info(restaurants)").all() as any[];
  const locationIdCol = tableInfo.find((c: any) => c.name === 'location_id');

  if (locationIdCol && locationIdCol.notnull === 1) {
    console.log('Migration: Making location_id nullable in restaurants table...');

    // Disable foreign keys for migration
    db.exec('PRAGMA foreign_keys = OFF');

    // Drop any existing temp table from failed migration
    db.exec('DROP TABLE IF EXISTS restaurants_new');

    // Create new table with nullable location_id
    db.exec(`
      CREATE TABLE restaurants_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_id INTEGER,
        name TEXT NOT NULL,
        toast_url TEXT NOT NULL,
        delivery_available INTEGER DEFAULT 0,
        high_delivery_fee INTEGER DEFAULT 0,
        last_checked DATETIME,
        hours TEXT,
        last_scraped_at DATETIME,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'unavailable')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
      )
    `);

    // Copy data from old table
    db.exec(`
      INSERT INTO restaurants_new (id, location_id, name, toast_url, delivery_available, high_delivery_fee, last_checked, hours, last_scraped_at, status, created_at)
      SELECT id, location_id, name, toast_url, delivery_available, high_delivery_fee, last_checked, hours, last_scraped_at, status, created_at
      FROM restaurants
    `);

    // Drop old table and rename new one
    db.exec(`DROP TABLE restaurants`);
    db.exec(`ALTER TABLE restaurants_new RENAME TO restaurants`);

    // Re-enable foreign keys
    db.exec('PRAGMA foreign_keys = ON');

    console.log('Migration: Successfully made location_id nullable');
  }
} catch (e: any) {
  console.error('Migration error (location_id nullable):', e.message);
  // Re-enable foreign keys even on error
  try { db.exec('PRAGMA foreign_keys = ON'); } catch {}
}

// Migration: Add hours column if it doesn't exist
try {
  db.exec(`ALTER TABLE restaurants ADD COLUMN hours TEXT`);
  console.log('Migration: Added hours column to restaurants table');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.error('Migration error:', e.message);
  }
}

// Migration: Add last_scraped_at column
try {
  db.exec(`ALTER TABLE restaurants ADD COLUMN last_scraped_at DATETIME`);
  console.log('Migration: Added last_scraped_at column to restaurants table');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.error('Migration error:', e.message);
  }
}

// Migration: Populate location_restaurants from existing restaurants (always sync missing records)
try {
  // Count missing records first
  const missing = db.prepare(`
    SELECT COUNT(*) as count FROM restaurants
    WHERE location_id IS NOT NULL
    AND id NOT IN (SELECT restaurant_id FROM location_restaurants)
  `).get() as { count: number };

  if (missing.count > 0) {
    db.exec(`
      INSERT OR IGNORE INTO location_restaurants (location_id, restaurant_id, delivery_available, high_delivery_fee, status)
      SELECT location_id, id, delivery_available, high_delivery_fee, status
      FROM restaurants
      WHERE location_id IS NOT NULL
        AND id NOT IN (SELECT restaurant_id FROM location_restaurants)
    `);
    console.log(`Migration: Added ${missing.count} restaurants to location_restaurants`);
  }
} catch (e: any) {
  console.error('Migration error:', e.message);
}

// Migration: Add confirmation tracking columns to orders table
try {
  db.exec(`ALTER TABLE orders ADD COLUMN confirmation_number TEXT`);
  console.log('Migration: Added confirmation_number column to orders table');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.error('Migration error:', e.message);
  }
}

try {
  db.exec(`ALTER TABLE orders ADD COLUMN tracking_url TEXT`);
  console.log('Migration: Added tracking_url column to orders table');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.error('Migration error:', e.message);
  }
}

try {
  db.exec(`ALTER TABLE orders ADD COLUMN estimated_delivery TEXT`);
  console.log('Migration: Added estimated_delivery column to orders table');
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.error('Migration error:', e.message);
  }
}

// Location CRUD
export const locations = {
  getAll: () => db.prepare('SELECT * FROM locations ORDER BY created_at DESC').all(),

  getById: (id: number) => db.prepare('SELECT * FROM locations WHERE id = ?').get(id),

  getBySlug: (slug: string) => db.prepare('SELECT * FROM locations WHERE slug = ?').get(slug),

  create: (data: { name: string; address: string; type: 'hotel' | 'airbnb'; url?: string; slug?: string; image_url?: string; timezone?: string }) => {
    // Auto-generate slug from name if not provided
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const stmt = db.prepare('INSERT INTO locations (name, address, type, url, slug, image_url, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const result = stmt.run(data.name, data.address, data.type, data.url || null, slug, data.image_url || null, data.timezone || 'America/Los_Angeles');
    return { id: result.lastInsertRowid, slug, ...data };
  },

  update: (id: number, data: { name?: string; address?: string; type?: 'hotel' | 'airbnb'; url?: string; slug?: string; image_url?: string; timezone?: string }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name) { fields.push('name = ?'); values.push(data.name); }
    if (data.address) { fields.push('address = ?'); values.push(data.address); }
    if (data.type) { fields.push('type = ?'); values.push(data.type); }
    if (data.url !== undefined) { fields.push('url = ?'); values.push(data.url); }
    if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
    if (data.image_url !== undefined) { fields.push('image_url = ?'); values.push(data.image_url); }
    if (data.timezone !== undefined) { fields.push('timezone = ?'); values.push(data.timezone); }

    if (fields.length === 0) return null;

    values.push(id);
    const stmt = db.prepare(`UPDATE locations SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return locations.getById(id);
  },

  delete: (id: number) => {
    db.prepare('DELETE FROM locations WHERE id = ?').run(id);
    return { success: true };
  }
};

// Restaurant CRUD
export const restaurants = {
  getByLocation: (locationId: number) =>
    db.prepare('SELECT * FROM restaurants WHERE location_id = ? ORDER BY created_at DESC').all(locationId),

  getById: (id: number) => db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id),

  create: (data: { location_id: number; name: string; toast_url: string; delivery_available?: boolean; status?: string }) => {
    const stmt = db.prepare(`
      INSERT INTO restaurants (location_id, name, toast_url, delivery_available, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.location_id,
      data.name,
      data.toast_url,
      data.delivery_available ? 1 : 0,
      data.status || 'pending'
    );
    return { id: result.lastInsertRowid, ...data };
  },

  update: (id: number, data: { name?: string; delivery_available?: boolean; high_delivery_fee?: boolean; last_checked?: string; hours?: string; status?: string; image_url?: string }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name) { fields.push('name = ?'); values.push(data.name); }
    if (data.delivery_available !== undefined) { fields.push('delivery_available = ?'); values.push(data.delivery_available ? 1 : 0); }
    if (data.high_delivery_fee !== undefined) { fields.push('high_delivery_fee = ?'); values.push(data.high_delivery_fee ? 1 : 0); }
    if (data.last_checked !== undefined) { fields.push('last_checked = ?'); values.push(data.last_checked); }
    if (data.hours !== undefined) { fields.push('hours = ?'); values.push(data.hours); }
    if (data.status) { fields.push('status = ?'); values.push(data.status); }
    if (data.image_url !== undefined) { fields.push('image_url = ?'); values.push(data.image_url); }

    if (fields.length === 0) return null;

    values.push(id);
    const stmt = db.prepare(`UPDATE restaurants SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return restaurants.getById(id);
  },

  delete: (id: number) => {
    db.prepare('DELETE FROM restaurants WHERE id = ?').run(id);
    return { success: true };
  }
};

// Menu Items CRUD
export const menuItems = {
  getByRestaurant: (restaurantId: number) =>
    db.prepare('SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name').all(restaurantId),

  getById: (id: number) => db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id),

  create: (data: { restaurant_id: number; name: string; description?: string; base_price: number; category?: string; image_url?: string }) => {
    const stmt = db.prepare(`
      INSERT INTO menu_items (restaurant_id, name, description, base_price, category, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.restaurant_id,
      data.name,
      data.description || null,
      data.base_price,
      data.category || null,
      data.image_url || null
    );
    return { id: result.lastInsertRowid, ...data };
  },

  bulkCreate: (restaurantId: number, items: Array<{ name: string; description?: string; base_price: number; category?: string; image_url?: string }>) => {
    const stmt = db.prepare(`
      INSERT INTO menu_items (restaurant_id, name, description, base_price, category, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        stmt.run(restaurantId, item.name, item.description || null, item.base_price, item.category || null, item.image_url || null);
      }
    });

    insertMany(items);
    return menuItems.getByRestaurant(restaurantId);
  },

  update: (id: number, data: { enabled?: boolean; markup_percent?: number; markup_flat?: number; base_price?: number; description?: string }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
    if (data.markup_percent !== undefined) { fields.push('markup_percent = ?'); values.push(data.markup_percent); }
    if (data.markup_flat !== undefined) { fields.push('markup_flat = ?'); values.push(data.markup_flat); }
    if (data.base_price !== undefined) { fields.push('base_price = ?'); values.push(data.base_price); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }

    if (fields.length === 0) return null;

    values.push(id);
    const stmt = db.prepare(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return menuItems.getById(id);
  },

  setGlobalMarkup: (restaurantId: number, markupPercent: number) => {
    db.prepare('UPDATE menu_items SET markup_percent = ? WHERE restaurant_id = ?').run(markupPercent, restaurantId);
    return menuItems.getByRestaurant(restaurantId);
  },

  delete: (id: number) => {
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
    return { success: true };
  },

  deleteByRestaurant: (restaurantId: number) => {
    db.prepare('DELETE FROM menu_items WHERE restaurant_id = ?').run(restaurantId);
    return { success: true };
  }
};

// Modifier Groups CRUD
export const modifierGroups = {
  getByMenuItem: (menuItemId: number) =>
    db.prepare('SELECT * FROM modifier_groups WHERE menu_item_id = ? ORDER BY name').all(menuItemId),

  getByRestaurant: (restaurantId: number) =>
    db.prepare(`
      SELECT mg.* FROM modifier_groups mg
      JOIN menu_items mi ON mg.menu_item_id = mi.id
      WHERE mi.restaurant_id = ?
      ORDER BY mg.menu_item_id, mg.name
    `).all(restaurantId),

  create: (data: { menu_item_id: number; name: string; required?: boolean; min_selections?: number; max_selections?: number }) => {
    const stmt = db.prepare(`
      INSERT INTO modifier_groups (menu_item_id, name, required, min_selections, max_selections)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.menu_item_id,
      data.name,
      data.required ? 1 : 0,
      data.min_selections || 0,
      data.max_selections || 1
    );
    return { id: result.lastInsertRowid, ...data };
  },

  deleteByMenuItem: (menuItemId: number) => {
    db.prepare('DELETE FROM modifier_groups WHERE menu_item_id = ?').run(menuItemId);
    return { success: true };
  },

  getById: (id: number) => db.prepare('SELECT * FROM modifier_groups WHERE id = ?').get(id),

  update: (id: number, data: { required?: boolean; min_selections?: number; max_selections?: number }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.required !== undefined) { fields.push('required = ?'); values.push(data.required ? 1 : 0); }
    if (data.min_selections !== undefined) { fields.push('min_selections = ?'); values.push(data.min_selections); }
    if (data.max_selections !== undefined) { fields.push('max_selections = ?'); values.push(data.max_selections); }

    if (fields.length === 0) return null;

    values.push(id);
    db.prepare(`UPDATE modifier_groups SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM modifier_groups WHERE id = ?').get(id);
  }
};

// Modifiers CRUD
export const modifiers = {
  getByMenuItem: (menuItemId: number) =>
    db.prepare('SELECT * FROM modifiers WHERE menu_item_id = ? ORDER BY group_id, name').all(menuItemId),

  getByRestaurant: (restaurantId: number) =>
    db.prepare(`
      SELECT m.* FROM modifiers m
      JOIN menu_items mi ON m.menu_item_id = mi.id
      WHERE mi.restaurant_id = ?
      ORDER BY m.menu_item_id, m.group_id, m.name
    `).all(restaurantId),

  getByGroup: (groupId: number) =>
    db.prepare('SELECT * FROM modifiers WHERE group_id = ? ORDER BY name').all(groupId),

  bulkCreate: (menuItemId: number, items: Array<{ name: string; price: number; group_id?: number }>) => {
    const stmt = db.prepare('INSERT INTO modifiers (menu_item_id, group_id, name, price) VALUES (?, ?, ?, ?)');
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        stmt.run(menuItemId, item.group_id || null, item.name, item.price);
      }
    });
    insertMany(items);
    return modifiers.getByMenuItem(menuItemId);
  },

  getById: (id: number) => db.prepare('SELECT * FROM modifiers WHERE id = ?').get(id),

  update: (id: number, data: { enabled?: boolean; price?: number }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
    if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }

    if (fields.length === 0) return null;

    values.push(id);
    db.prepare(`UPDATE modifiers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM modifiers WHERE id = ?').get(id);
  },

  deleteByMenuItem: (menuItemId: number) => {
    db.prepare('DELETE FROM modifiers WHERE menu_item_id = ?').run(menuItemId);
    return { success: true };
  }
};

// Menu Library CRUD - for managing global restaurant library
export const menuLibrary = {
  // Get all restaurants in the library with stats
  getAll: () => {
    const rows = db.prepare(`
      SELECT
        r.*,
        COUNT(DISTINCT mi.id) as item_count,
        COUNT(DISTINCT lr.location_id) as location_count,
        GROUP_CONCAT(DISTINCT l.name) as location_names
      FROM restaurants r
      LEFT JOIN menu_items mi ON r.id = mi.restaurant_id
      LEFT JOIN location_restaurants lr ON r.id = lr.restaurant_id
      LEFT JOIN locations l ON lr.location_id = l.id
      GROUP BY r.id
      ORDER BY r.name
    `).all() as any[];
    // Convert location_names string to locations array
    return rows.map(row => ({
      ...row,
      locations: row.location_names ? row.location_names.split(',') : []
    }));
  },

  // Get a single restaurant with its delivery zones
  getById: (id: number) => {
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
    if (!restaurant) return null;

    const deliveryZones = db.prepare(`
      SELECT lr.*, l.name as location_name, l.address as location_address
      FROM location_restaurants lr
      JOIN locations l ON lr.location_id = l.id
      WHERE lr.restaurant_id = ?
    `).all(id);

    return { ...(restaurant as any), delivery_zones: deliveryZones };
  },

  // Search library by name
  search: (query: string) => db.prepare(`
    SELECT r.*, COUNT(mi.id) as item_count
    FROM restaurants r
    LEFT JOIN menu_items mi ON r.id = mi.restaurant_id
    WHERE r.name LIKE ? OR r.toast_url LIKE ?
    GROUP BY r.id
    ORDER BY r.name
  `).all(`%${query}%`, `%${query}%`),

  // Add new restaurant to library (without location)
  create: (data: { name: string; toast_url: string; image_url?: string }) => {
    // Check if restaurant with same toast_url already exists
    const existing = db.prepare('SELECT id FROM restaurants WHERE toast_url = ?').get(data.toast_url);
    if (existing) {
      return { id: (existing as any).id, existing: true };
    }

    const stmt = db.prepare('INSERT INTO restaurants (name, toast_url, location_id, image_url) VALUES (?, ?, NULL, ?)');
    const result = stmt.run(data.name, data.toast_url, data.image_url || null);
    return { id: result.lastInsertRowid as number, existing: false };
  },

  // Update last scraped timestamp
  updateLastScraped: (id: number) => {
    db.prepare('UPDATE restaurants SET last_scraped_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  // Get restaurants not yet assigned to a location
  getUnassignedForLocation: (locationId: number) => db.prepare(`
    SELECT r.*, COUNT(mi.id) as item_count
    FROM restaurants r
    LEFT JOIN menu_items mi ON r.id = mi.restaurant_id
    WHERE r.id NOT IN (
      SELECT restaurant_id FROM location_restaurants WHERE location_id = ?
    )
    GROUP BY r.id
    ORDER BY r.name
  `).all(locationId),

  // Find restaurant by Toast URL
  findByToastUrl: (toastUrl: string) => db.prepare('SELECT * FROM restaurants WHERE toast_url = ?').get(toastUrl)
};

// Location-Restaurant assignments CRUD
export const locationRestaurants = {
  // Get all restaurants for a location
  getByLocation: (locationId: number) => db.prepare(`
    SELECT lr.*, r.name, r.toast_url, r.hours, r.last_scraped_at,
      COUNT(mi.id) as menu_item_count
    FROM location_restaurants lr
    JOIN restaurants r ON lr.restaurant_id = r.id
    LEFT JOIN menu_items mi ON r.id = mi.restaurant_id
    WHERE lr.location_id = ?
    GROUP BY lr.id
    ORDER BY r.name
  `).all(locationId),

  // Get all locations for a restaurant
  getByRestaurant: (restaurantId: number) => db.prepare(`
    SELECT lr.*, l.name as location_name, l.address as location_address
    FROM location_restaurants lr
    JOIN locations l ON lr.location_id = l.id
    WHERE lr.restaurant_id = ?
  `).all(restaurantId),

  // Assign restaurant to location
  assign: (data: { location_id: number; restaurant_id: number }) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO location_restaurants (location_id, restaurant_id, status)
      VALUES (?, ?, 'pending')
    `);
    const result = stmt.run(data.location_id, data.restaurant_id);

    if (result.changes === 0) {
      // Already exists
      return db.prepare('SELECT * FROM location_restaurants WHERE location_id = ? AND restaurant_id = ?')
        .get(data.location_id, data.restaurant_id);
    }

    return { id: result.lastInsertRowid, ...data };
  },

  // Update delivery status for a location-restaurant pair
  updateDeliveryStatus: (locationId: number, restaurantId: number, data: {
    delivery_available?: boolean;
    high_delivery_fee?: boolean;
    status?: string;
  }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.delivery_available !== undefined) {
      fields.push('delivery_available = ?');
      values.push(data.delivery_available ? 1 : 0);
    }
    if (data.high_delivery_fee !== undefined) {
      fields.push('high_delivery_fee = ?');
      values.push(data.high_delivery_fee ? 1 : 0);
    }
    if (data.status) {
      fields.push('status = ?');
      values.push(data.status);
    }
    fields.push('delivery_verified_at = CURRENT_TIMESTAMP');

    if (fields.length === 1) return null; // Only timestamp, no real updates

    values.push(locationId, restaurantId);
    db.prepare(`
      UPDATE location_restaurants
      SET ${fields.join(', ')}
      WHERE location_id = ? AND restaurant_id = ?
    `).run(...values);

    return db.prepare('SELECT * FROM location_restaurants WHERE location_id = ? AND restaurant_id = ?')
      .get(locationId, restaurantId);
  },

  // Update markup for a location-restaurant pair
  updateMarkup: (locationId: number, restaurantId: number, markupPercent: number) => {
    db.prepare('UPDATE location_restaurants SET markup_percent = ? WHERE location_id = ? AND restaurant_id = ?')
      .run(markupPercent, locationId, restaurantId);
  },

  // Remove restaurant from location
  unassign: (locationId: number, restaurantId: number) => {
    db.prepare('DELETE FROM location_restaurants WHERE location_id = ? AND restaurant_id = ?')
      .run(locationId, restaurantId);
    return { success: true };
  },

  // Check if a restaurant is assigned to a location
  isAssigned: (locationId: number, restaurantId: number) => {
    const result = db.prepare('SELECT id FROM location_restaurants WHERE location_id = ? AND restaurant_id = ?')
      .get(locationId, restaurantId);
    return !!result;
  }
};

// Order Attempts CRUD
export const orderAttempts = {
  create: (data: {
    restaurant_id?: number;
    location_id?: number;
    status: 'pending' | 'in_progress' | 'success' | 'failed';
    stage?: string;
    items_json?: string;
    customer_json?: string;
    order_total?: number;
    dry_run?: boolean;
    retry_of?: number;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO order_attempts (restaurant_id, location_id, status, stage, items_json, customer_json, order_total, dry_run, retry_of)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.restaurant_id || null,
      data.location_id || null,
      data.status,
      data.stage || 'init',
      data.items_json || null,
      data.customer_json || null,
      data.order_total || null,
      data.dry_run ? 1 : 0,
      data.retry_of || null
    );
    return { id: result.lastInsertRowid as number, ...data };
  },

  updateStage: (id: number, stage: string) => {
    db.prepare('UPDATE order_attempts SET stage = ?, status = ? WHERE id = ?').run(stage, 'in_progress', id);
  },

  complete: (id: number, success: boolean, errorMessage?: string, errorType?: string, screenshotPath?: string) => {
    const stmt = db.prepare(`
      UPDATE order_attempts
      SET status = ?, error_message = ?, error_type = ?, screenshot_path = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(success ? 'success' : 'failed', errorMessage || null, errorType || null, screenshotPath || null, id);
  },

  getById: (id: number) => db.prepare('SELECT * FROM order_attempts WHERE id = ?').get(id),

  getRecent: (limit: number = 50) => db.prepare(`
    SELECT oa.*, r.name as restaurant_name, l.name as location_name
    FROM order_attempts oa
    LEFT JOIN restaurants r ON oa.restaurant_id = r.id
    LEFT JOIN locations l ON oa.location_id = l.id
    ORDER BY oa.created_at DESC
    LIMIT ?
  `).all(limit),

  getFailures: (filters?: { startDate?: string; endDate?: string; restaurantId?: number; errorType?: string; limit?: number }) => {
    let sql = `
      SELECT oa.*, r.name as restaurant_name, l.name as location_name
      FROM order_attempts oa
      LEFT JOIN restaurants r ON oa.restaurant_id = r.id
      LEFT JOIN locations l ON oa.location_id = l.id
      WHERE oa.status = 'failed'
    `;
    const params: any[] = [];

    if (filters?.startDate) {
      sql += ' AND oa.created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      sql += ' AND oa.created_at <= ?';
      params.push(filters.endDate);
    }
    if (filters?.restaurantId) {
      sql += ' AND oa.restaurant_id = ?';
      params.push(filters.restaurantId);
    }
    if (filters?.errorType) {
      sql += ' AND oa.error_type = ?';
      params.push(filters.errorType);
    }

    sql += ' ORDER BY oa.created_at DESC LIMIT ?';
    params.push(filters?.limit || 100);

    return db.prepare(sql).all(...params);
  },

  getMetrics: (period: 'today' | 'week' | 'month' = 'today') => {
    let dateFilter = '';
    if (period === 'today') {
      dateFilter = "date(created_at) = date('now')";
    } else if (period === 'week') {
      dateFilter = "created_at >= date('now', '-7 days')";
    } else {
      dateFilter = "created_at >= date('now', '-30 days')";
    }

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN status = 'success' THEN order_total ELSE NULL END) as avg_order_value
      FROM order_attempts
      WHERE ${dateFilter} AND dry_run = 0
    `).get() as any;

    const byStage = db.prepare(`
      SELECT stage, COUNT(*) as count
      FROM order_attempts
      WHERE ${dateFilter} AND status = 'failed' AND dry_run = 0
      GROUP BY stage
    `).all();

    const byRestaurant = db.prepare(`
      SELECT r.name as restaurant_name, oa.restaurant_id, COUNT(*) as order_count,
        SUM(CASE WHEN oa.status = 'success' THEN 1 ELSE 0 END) as successful
      FROM order_attempts oa
      LEFT JOIN restaurants r ON oa.restaurant_id = r.id
      WHERE ${dateFilter.replace('created_at', 'oa.created_at')} AND oa.dry_run = 0
      GROUP BY oa.restaurant_id
      ORDER BY order_count DESC
    `).all();

    const byLocation = db.prepare(`
      SELECT l.name as location_name, oa.location_id, COUNT(*) as order_count
      FROM order_attempts oa
      LEFT JOIN locations l ON oa.location_id = l.id
      WHERE ${dateFilter.replace('created_at', 'oa.created_at')} AND oa.dry_run = 0
      GROUP BY oa.location_id
      ORDER BY order_count DESC
    `).all();

    return {
      ...stats,
      success_rate: stats.total_orders > 0 ? (stats.successful / stats.total_orders * 100).toFixed(1) : 0,
      failure_by_stage: byStage,
      by_restaurant: byRestaurant,
      by_location: byLocation
    };
  },

  getRestaurantHealth: (restaurantId?: number) => {
    let sql = `
      SELECT
        r.id,
        r.name,
        COUNT(oa.id) as total_orders,
        SUM(CASE WHEN oa.status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN oa.status = 'failed' THEN 1 ELSE 0 END) as failed,
        MAX(CASE WHEN oa.status = 'success' THEN oa.created_at ELSE NULL END) as last_success,
        SUM(CASE WHEN oa.status = 'failed' AND oa.created_at >= date('now', '-1 day') THEN 1 ELSE 0 END) as failures_24h,
        SUM(CASE WHEN oa.created_at >= date('now', '-1 day') THEN 1 ELSE 0 END) as orders_24h
      FROM restaurants r
      LEFT JOIN order_attempts oa ON r.id = oa.restaurant_id AND oa.dry_run = 0
    `;

    if (restaurantId) {
      sql += ' WHERE r.id = ?';
    }

    sql += ' GROUP BY r.id ORDER BY failed DESC';

    const results = restaurantId
      ? db.prepare(sql).all(restaurantId)
      : db.prepare(sql).all();

    return (results as any[]).map(r => ({
      ...r,
      success_rate: r.total_orders > 0 ? (r.successful / r.total_orders * 100).toFixed(1) : null,
      failure_rate_24h: r.orders_24h > 0 ? (r.failures_24h / r.orders_24h * 100).toFixed(1) : null,
      needs_attention: r.orders_24h >= 3 && (r.failures_24h / r.orders_24h) > 0.2
    }));
  }
};

// Twilio Numbers CRUD
export const twilioNumbers = {
  getAll: () => db.prepare(`
    SELECT tn.*, l.name as location_name,
      (SELECT COUNT(*) FROM orders WHERE twilio_number_id = tn.id) as order_count
    FROM twilio_numbers tn
    LEFT JOIN locations l ON tn.location_id = l.id
    ORDER BY tn.created_at DESC
  `).all(),

  getById: (id: number) => db.prepare('SELECT * FROM twilio_numbers WHERE id = ?').get(id),

  getByPhoneNumber: (phoneNumber: string) =>
    db.prepare('SELECT * FROM twilio_numbers WHERE phone_number = ?').get(phoneNumber),

  getByLocation: (locationId: number) =>
    db.prepare('SELECT * FROM twilio_numbers WHERE location_id = ? AND active = 1').get(locationId),

  getAvailable: () =>
    db.prepare('SELECT * FROM twilio_numbers WHERE location_id IS NULL AND active = 1').all(),

  create: (data: { phone_number: string; friendly_name?: string }) => {
    const stmt = db.prepare('INSERT INTO twilio_numbers (phone_number, friendly_name) VALUES (?, ?)');
    const result = stmt.run(data.phone_number, data.friendly_name || null);
    return { id: result.lastInsertRowid as number, ...data };
  },

  assignToLocation: (id: number, locationId: number | null) => {
    db.prepare('UPDATE twilio_numbers SET location_id = ? WHERE id = ?').run(locationId, id);
    return twilioNumbers.getById(id);
  },

  updateLastUsed: (id: number) => {
    db.prepare('UPDATE twilio_numbers SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  setActive: (id: number, active: boolean) => {
    db.prepare('UPDATE twilio_numbers SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  },

  delete: (id: number) => {
    db.prepare('DELETE FROM twilio_numbers WHERE id = ?').run(id);
    return { success: true };
  }
};

// Orders CRUD (for order tracking system)
export const orders = {
  create: (data: {
    location_id: number;
    restaurant_id: number;
    guest_first_name: string;
    guest_last_name: string;
    guest_phone: string;
    guest_email?: string;
    generated_email: string;
    twilio_number_id?: number;
    items_json?: string;
    order_total?: number;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO orders (location_id, restaurant_id, guest_first_name, guest_last_name, guest_phone, guest_email, generated_email, twilio_number_id, items_json, order_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.location_id,
      data.restaurant_id,
      data.guest_first_name,
      data.guest_last_name,
      data.guest_phone,
      data.guest_email || null,
      data.generated_email,
      data.twilio_number_id || null,
      data.items_json || null,
      data.order_total || null
    );
    const orderId = result.lastInsertRowid as number;

    // Create initial status entry
    orderStatuses.create({
      order_id: orderId,
      status: 'pending',
      message: 'Order placed',
      source: 'system'
    });

    return { id: orderId, ...data };
  },

  getById: (id: number) => db.prepare(`
    SELECT o.*, r.name as restaurant_name, l.name as location_name, tn.phone_number as twilio_phone
    FROM orders o
    LEFT JOIN restaurants r ON o.restaurant_id = r.id
    LEFT JOIN locations l ON o.location_id = l.id
    LEFT JOIN twilio_numbers tn ON o.twilio_number_id = tn.id
    WHERE o.id = ?
  `).get(id),

  getAll: (filters?: { location_id?: number; restaurant_id?: number; status?: string; limit?: number }) => {
    let sql = `
      SELECT o.*, r.name as restaurant_name, l.name as location_name, tn.phone_number as twilio_phone
      FROM orders o
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN locations l ON o.location_id = l.id
      LEFT JOIN twilio_numbers tn ON o.twilio_number_id = tn.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.location_id) {
      sql += ' AND o.location_id = ?';
      params.push(filters.location_id);
    }
    if (filters?.restaurant_id) {
      sql += ' AND o.restaurant_id = ?';
      params.push(filters.restaurant_id);
    }
    if (filters?.status) {
      sql += ' AND o.status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT ?';
    params.push(filters?.limit || 100);

    return db.prepare(sql).all(...params);
  },

  getByTwilioNumber: (twilioNumberId: number, activeOnly: boolean = true) => {
    let sql = `
      SELECT o.*, r.name as restaurant_name, l.name as location_name
      FROM orders o
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN locations l ON o.location_id = l.id
      WHERE o.twilio_number_id = ?
    `;
    if (activeOnly) {
      sql += " AND o.status NOT IN ('delivered', 'failed')";
    }
    sql += ' ORDER BY o.created_at DESC LIMIT 1';
    return db.prepare(sql).get(twilioNumberId);
  },

  updateStatus: (id: number, status: string, message?: string, source: 'system' | 'sms' | 'manual' = 'system', rawSms?: string) => {
    // Update order status
    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);

    // Add to timeline
    orderStatuses.create({
      order_id: id,
      status,
      message: message || null,
      source,
      raw_sms: rawSms
    });

    return orders.getById(id);
  },

  linkOrderAttempt: (id: number, orderAttemptId: number) => {
    db.prepare('UPDATE orders SET order_attempt_id = ? WHERE id = ?').run(orderAttemptId, id);
  },

  setExternalOrderId: (id: number, externalOrderId: string) => {
    db.prepare('UPDATE orders SET external_order_id = ? WHERE id = ?').run(externalOrderId, id);
  },

  updateConfirmation: (id: number, data: {
    confirmation_number?: string;
    tracking_url?: string;
    estimated_delivery?: string;
    order_total?: number;
  }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.confirmation_number) {
      fields.push('confirmation_number = ?');
      values.push(data.confirmation_number);
    }
    if (data.tracking_url) {
      fields.push('tracking_url = ?');
      values.push(data.tracking_url);
    }
    if (data.estimated_delivery) {
      fields.push('estimated_delivery = ?');
      values.push(data.estimated_delivery);
    }
    if (data.order_total !== undefined) {
      fields.push('order_total = ?');
      values.push(data.order_total);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  },

  search: (query: string) => db.prepare(`
    SELECT o.*, r.name as restaurant_name, l.name as location_name
    FROM orders o
    LEFT JOIN restaurants r ON o.restaurant_id = r.id
    LEFT JOIN locations l ON o.location_id = l.id
    WHERE o.guest_first_name LIKE ? OR o.guest_last_name LIKE ? OR o.guest_phone LIKE ?
    ORDER BY o.created_at DESC
    LIMIT 50
  `).all(`%${query}%`, `%${query}%`, `%${query}%`)
};

// Order Statuses CRUD (timeline)
export const orderStatuses = {
  create: (data: {
    order_id: number;
    status: string;
    message?: string | null;
    source?: 'system' | 'sms' | 'manual';
    raw_sms?: string;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO order_statuses (order_id, status, message, source, raw_sms)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.order_id,
      data.status,
      data.message || null,
      data.source || 'system',
      data.raw_sms || null
    );
    return { id: result.lastInsertRowid as number, ...data };
  },

  getByOrder: (orderId: number) =>
    db.prepare('SELECT * FROM order_statuses WHERE order_id = ? ORDER BY created_at ASC').all(orderId),

  getTimeline: (orderId: number) => {
    const statuses = db.prepare(`
      SELECT status, message, source, created_at
      FROM order_statuses
      WHERE order_id = ?
      ORDER BY created_at ASC
    `).all(orderId);
    return statuses;
  }
};

// App Settings CRUD (key-value store)
export const appSettings = {
  get: (key: string): string | null => {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  },

  getMultiple: (keys: string[]): Record<string, string | null> => {
    const result: Record<string, string | null> = {};
    for (const key of keys) {
      result[key] = appSettings.get(key);
    }
    return result;
  },

  set: (key: string, value: string) => {
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `).run(key, value, value);
  },

  setMultiple: (entries: Record<string, string>) => {
    const upsert = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `);
    const transaction = db.transaction((entries: Record<string, string>) => {
      for (const [key, value] of Object.entries(entries)) {
        upsert.run(key, value, value);
      }
    });
    transaction(entries);
  },

  delete: (key: string) => {
    db.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
  }
};

// Guest Profiles CRUD
export const guestProfiles = {
  // Get all guest profiles with pagination and filters
  getAll: (filters?: {
    search?: string;
    hotelId?: number;
    hasAllergies?: boolean;
    hasDietary?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT DISTINCT gp.*,
        (SELECT COUNT(*) FROM orders o WHERE o.guest_phone = gp.phone) as order_count,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.guest_phone = gp.phone) as last_order_at
      FROM guest_profiles gp
      LEFT JOIN orders o ON o.guest_phone = gp.phone
      WHERE 1=1
    `;
    const countSql = `
      SELECT COUNT(DISTINCT gp.id) as total
      FROM guest_profiles gp
      LEFT JOIN orders o ON o.guest_phone = gp.phone
      WHERE 1=1
    `;
    const params: any[] = [];
    let whereClause = '';

    if (filters?.search) {
      whereClause += ` AND (gp.phone LIKE ? OR gp.first_name LIKE ? OR gp.last_name LIKE ? OR gp.email LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters?.hotelId) {
      whereClause += ` AND o.location_id = ?`;
      params.push(filters.hotelId);
    }

    if (filters?.hasAllergies) {
      whereClause += ` AND gp.allergies IS NOT NULL AND gp.allergies != ''`;
    }

    if (filters?.hasDietary) {
      whereClause += ` AND gp.dietary_preferences IS NOT NULL AND gp.dietary_preferences != ''`;
    }

    sql += whereClause + ` ORDER BY gp.updated_at DESC LIMIT ? OFFSET ?`;
    const queryParams = [...params, limit, offset];

    const guests = db.prepare(sql).all(...queryParams);
    const countResult = db.prepare(countSql + whereClause).get(...params) as { total: number };

    return {
      guests,
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit)
    };
  },

  getById: (id: number) => {
    const profile = db.prepare(`
      SELECT gp.*,
        (SELECT COUNT(*) FROM orders o WHERE o.guest_phone = gp.phone) as order_count,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.guest_phone = gp.phone) as last_order_at
      FROM guest_profiles gp
      WHERE gp.id = ?
    `).get(id);
    return profile;
  },

  getByPhone: (phone: string) => {
    return db.prepare('SELECT * FROM guest_profiles WHERE phone = ?').get(phone);
  },

  getOrderHistory: (guestId: number, limit: number = 10) => {
    const profile = guestProfiles.getById(guestId) as any;
    if (!profile) return [];

    return db.prepare(`
      SELECT o.*, r.name as restaurant_name, l.name as location_name
      FROM orders o
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN locations l ON o.location_id = l.id
      WHERE o.guest_phone = ?
      ORDER BY o.created_at DESC
      LIMIT ?
    `).all(profile.phone, limit);
  },

  create: (data: {
    phone: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    dietary_preferences?: string;
    allergies?: string;
    favorite_cuisines?: string;
    dislikes?: string;
    notes?: string;
    metadata?: string;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO guest_profiles (phone, first_name, last_name, email, dietary_preferences, allergies, favorite_cuisines, dislikes, notes, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.phone,
      data.first_name || null,
      data.last_name || null,
      data.email || null,
      data.dietary_preferences || null,
      data.allergies || null,
      data.favorite_cuisines || null,
      data.dislikes || null,
      data.notes || null,
      data.metadata || null
    );
    return { id: result.lastInsertRowid as number, ...data };
  },

  update: (id: number, data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    dietary_preferences?: string;
    allergies?: string;
    favorite_cuisines?: string;
    dislikes?: string;
    notes?: string;
    metadata?: string;
  }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.first_name !== undefined) { fields.push('first_name = ?'); values.push(data.first_name); }
    if (data.last_name !== undefined) { fields.push('last_name = ?'); values.push(data.last_name); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.dietary_preferences !== undefined) { fields.push('dietary_preferences = ?'); values.push(data.dietary_preferences); }
    if (data.allergies !== undefined) { fields.push('allergies = ?'); values.push(data.allergies); }
    if (data.favorite_cuisines !== undefined) { fields.push('favorite_cuisines = ?'); values.push(data.favorite_cuisines); }
    if (data.dislikes !== undefined) { fields.push('dislikes = ?'); values.push(data.dislikes); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
    if (data.metadata !== undefined) { fields.push('metadata = ?'); values.push(data.metadata); }

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    db.prepare(`UPDATE guest_profiles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return guestProfiles.getById(id);
  },

  // Create or update profile from order (called when orders are placed)
  upsertFromOrder: (data: {
    phone: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  }) => {
    const existing = guestProfiles.getByPhone(data.phone) as any;
    if (existing) {
      // Update name/email if provided and different
      const updates: any = {};
      if (data.first_name && !existing.first_name) updates.first_name = data.first_name;
      if (data.last_name && !existing.last_name) updates.last_name = data.last_name;
      if (data.email && !existing.email) updates.email = data.email;

      if (Object.keys(updates).length > 0) {
        return guestProfiles.update(existing.id, updates);
      }
      return existing;
    }

    return guestProfiles.create(data);
  },

  delete: (id: number) => {
    db.prepare('DELETE FROM guest_profiles WHERE id = ?').run(id);
    return { success: true };
  }
};

export default db;
