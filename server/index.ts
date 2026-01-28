import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { placeToastOrder, OrderRequest } from './order-agent-simple';
import { scrapeMenu, Menu } from './menu-scraper';
import { RESTAURANTS, getRestaurantById } from './restaurants';
import { locations, restaurants, menuItems, modifiers, modifierGroups, orderAttempts, menuLibrary, locationRestaurants, twilioNumbers, orders, orderStatuses, appSettings, guestProfiles } from './database';
import { checkDeliveryFee } from './delivery-checker';
import { generateOrderEmail } from './email-generator';
import { parseStatusFromSMS, extractETA } from './sms-parser';
import { sendSMS, isTwilioEnabled, getTwilioPhoneNumber } from './twilio-client';
import { getNotificationMessage, shouldNotifyGuest, getTrackingUrl } from './notification-templates';
import db from './database';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Twilio webhook

// In-memory cache for menus (in production, use Redis or similar)
const menuCache: Map<string, { menu: Menu; cachedAt: number }> = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// List available restaurants
app.get('/api/restaurants', (req, res) => {
  res.json(RESTAURANTS.map(r => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    image: r.image,
  })));
});

// Place order endpoint
app.post('/api/place-order', async (req, res) => {
  try {
    const orderRequest: OrderRequest = req.body;

    console.log('Received order request:', JSON.stringify(orderRequest, null, 2));

    // Validate required fields
    if (!orderRequest.restaurantUrl || !orderRequest.items || !orderRequest.customer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Substitute customer phone with Twilio number so Toast sends SMS updates to us
    const twilioPhone = getTwilioPhoneNumber();
    const originalPhone = orderRequest.customer.phone;
    if (twilioPhone) {
      console.log(`[Twilio] Substituting customer phone with Twilio number: ${twilioPhone}`);
      orderRequest.customer.phone = twilioPhone;
    }

    // Place the order via the bot
    const result = await placeToastOrder(orderRequest);

    // After successful order, send confirmation SMS to guest (fire-and-forget)
    if (result.success && originalPhone && twilioPhone) {
      const restaurantName = orderRequest.restaurantUrl.match(/\/order\/([^\/\?]+)/)?.[1]?.replace(/-/g, ' ') || 'the restaurant';
      const confirmationNumber = result.confirmation?.confirmationNumber || result.orderId || '';
      const message = `Simon InHouse: Your order from ${restaurantName} has been placed${confirmationNumber ? ` (Order #${confirmationNumber})` : ''}. We'll text you updates!`;
      sendSMS(originalPhone, twilioPhone, message).catch(err => {
        console.error('[Twilio] Failed to send confirmation SMS:', err);
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Order error:', error);
    res.status(500).json({
      error: 'Failed to place order',
      message: error.message
    });
  }
});

// Scrape menu endpoint with caching
app.get('/api/menu/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const forceRefresh = req.query.refresh === 'true';

    // Look up restaurant config
    const restaurant = getRestaurantById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Check cache
    const cached = menuCache.get(restaurantId);
    if (!forceRefresh && cached && (Date.now() - cached.cachedAt) < CACHE_TTL) {
      console.log(`Returning cached menu for ${restaurantId}`);
      return res.json(cached.menu);
    }

    console.log('Scraping menu for:', restaurant.toastUrl);
    const menu = await scrapeMenu(restaurant.toastUrl);

    // Cache the result
    menuCache.set(restaurantId, { menu, cachedAt: Date.now() });

    res.json(menu);
  } catch (error: any) {
    console.error('Menu scrape error:', error);
    res.status(500).json({
      error: 'Failed to scrape menu',
      message: error.message
    });
  }
});

// ============ ADMIN API ENDPOINTS ============

// --- Locations ---
app.get('/api/admin/locations', (req, res) => {
  try {
    res.json(locations.getAll());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/locations/:id', (req, res) => {
  try {
    const location = locations.getById(parseInt(req.params.id));
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/locations', (req, res) => {
  try {
    const { name, address, type, url } = req.body;
    if (!name || !address || !type) {
      return res.status(400).json({ error: 'Name, address, and type are required' });
    }
    if (!['hotel', 'airbnb'].includes(type)) {
      return res.status(400).json({ error: 'Type must be hotel or airbnb' });
    }
    const location = locations.create({ name, address, type, url });
    res.status(201).json(location);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/locations/:id', (req, res) => {
  try {
    const { name, address, type, url } = req.body;
    const location = locations.update(parseInt(req.params.id), { name, address, type, url });
    if (!location) {
      return res.status(404).json({ error: 'Location not found or no changes' });
    }
    res.json(location);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/locations/:id', (req, res) => {
  try {
    locations.delete(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Restaurants (per location) ---
app.get('/api/admin/locations/:locationId/restaurants', (req, res) => {
  try {
    const locationId = parseInt(req.params.locationId);
    res.json(restaurants.getByLocation(locationId));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/locations/:locationId/restaurants', async (req, res) => {
  try {
    const locationId = parseInt(req.params.locationId);
    const { toast_url } = req.body;

    if (!toast_url) {
      return res.status(400).json({ error: 'toast_url is required' });
    }

    // Verify location exists
    const location = locations.getById(locationId) as any;
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Extract restaurant name from URL or scrape it
    const slugMatch = toast_url.match(/\/order\/([^\/\?]+)/);
    const name = slugMatch ? slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown Restaurant';

    // Create restaurant with pending status
    const restaurant = restaurants.create({
      location_id: locationId,
      name,
      toast_url,
      status: 'pending'
    }) as any;

    // Return immediately, then scrape in background
    res.status(201).json(restaurant);

    // Quick scrape menu (no modifiers) and check delivery in background
    (async () => {
      const restaurantId = restaurant.id;
      try {
        console.log(`Quick-scraping menu for ${name}...`);

        // Quick scrape - just menu items, no modifiers (fast ~10 seconds)
        const menu = await scrapeMenu(toast_url, { skipModifiers: true });

        // Update restaurant info
        const updateData: any = {
          last_checked: new Date().toISOString()
        };
        if (menu.restaurantName && menu.restaurantName !== 'Unknown Restaurant') {
          updateData.name = menu.restaurantName;
        }
        if (menu.hours) {
          updateData.hours = JSON.stringify(menu.hours);
        }

        // Check delivery
        const deliveryInfo = await checkDeliveryFee(toast_url, location.address);
        updateData.delivery_available = deliveryInfo.delivery_available;
        updateData.high_delivery_fee = deliveryInfo.high_delivery_fee;
        updateData.status = deliveryInfo.delivery_available ? 'available' : 'unavailable';

        restaurants.update(restaurantId, updateData);

        // Save menu items (no modifiers yet)
        menuItems.deleteByRestaurant(restaurantId);
        const items = menu.items.map(item => ({
          name: item.name,
          description: item.description,
          base_price: item.price,
          category: item.category,
          image_url: item.image
        }));
        const savedItems = menuItems.bulkCreate(restaurantId, items) as any[];

        console.log(`✓ Quick-scraped ${savedItems.length} items for ${menu.restaurantName || name} (use Refresh Menu for modifiers)`);
      } catch (error: any) {
        console.error(`Failed to quick-scrape for ${name}:`, error.message);
        restaurants.update(restaurantId, {
          status: 'pending',
          last_checked: new Date().toISOString()
        });
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/restaurants/:id', (req, res) => {
  try {
    const restaurant = restaurants.getById(parseInt(req.params.id));
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(restaurant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/restaurants/:id', (req, res) => {
  try {
    const { name, delivery_available, delivery_fee, status } = req.body;
    const restaurant = restaurants.update(parseInt(req.params.id), { name, delivery_available, delivery_fee, status });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found or no changes' });
    }
    res.json(restaurant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/restaurants/:id', (req, res) => {
  try {
    restaurants.delete(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Menu Items ---
app.get('/api/admin/restaurants/:restaurantId/menu', (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    res.json(menuItems.getByRestaurant(restaurantId));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Scrape menu from Toast and save to database
app.post('/api/admin/restaurants/:restaurantId/scrape-menu', async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const restaurant = restaurants.getById(restaurantId) as any;

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    console.log(`Scraping menu for restaurant ${restaurant.name}...`);

    // Scrape the menu
    const menu = await scrapeMenu(restaurant.toast_url);

    // Update restaurant name, hours, and hero image if we got them
    const updateData: any = {};
    if (menu.restaurantName && menu.restaurantName !== 'Unknown Restaurant') {
      updateData.name = menu.restaurantName;
    }
    if (menu.hours) {
      updateData.hours = JSON.stringify(menu.hours);
    }
    if (menu.heroImage) {
      updateData.image_url = menu.heroImage;
    }
    if (Object.keys(updateData).length > 0) {
      restaurants.update(restaurantId, updateData);
    }

    // Clear existing menu items (cascade deletes modifiers)
    menuItems.deleteByRestaurant(restaurantId);

    // Insert new menu items
    const items = menu.items.map(item => ({
      name: item.name,
      description: item.description,
      base_price: item.price,
      category: item.category,
      image_url: item.image
    }));

    const savedItems = menuItems.bulkCreate(restaurantId, items) as any[];

    // Create a name->id map for matching scraped items to saved items
    const nameToId = new Map<string, number>();
    savedItems.forEach((item: any) => {
      nameToId.set(item.name, item.id);
    });

    // Save modifier groups and modifiers for each item - match by name not index
    let totalModifiers = 0;
    let totalRequiredGroups = 0;
    for (const scraped of menu.items) {
      const savedId = nameToId.get(scraped.name);
      if (!savedId) continue;

      // Save modifier groups first
      const groupNameToId = new Map<string, number>();
      if (scraped.modifierGroups && scraped.modifierGroups.length > 0) {
        for (const group of scraped.modifierGroups) {
          const savedGroup = modifierGroups.create({
            menu_item_id: savedId,
            name: group.name,
            required: group.required,
            min_selections: group.minSelections,
            max_selections: group.maxSelections
          });
          groupNameToId.set(group.name, savedGroup.id as number);
          if (group.required) totalRequiredGroups++;
        }
      }

      // Save modifiers with group associations
      if (scraped.modifiers && scraped.modifiers.length > 0) {
        const modifiersWithGroups = scraped.modifiers.map(mod => ({
          name: mod.name,
          price: mod.price,
          group_id: mod.groupName ? groupNameToId.get(mod.groupName) : undefined
        }));
        modifiers.bulkCreate(savedId, modifiersWithGroups);
        totalModifiers += scraped.modifiers.length;
      }
    }

    res.json({
      success: true,
      itemCount: savedItems.length,
      modifierCount: totalModifiers,
      requiredGroupCount: totalRequiredGroups,
      categories: menu.categories
    });
  } catch (error: any) {
    console.error('Menu scrape error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/menu-items/:id', (req, res) => {
  try {
    const { enabled, markup_percent, markup_flat } = req.body;
    const item = menuItems.update(parseInt(req.params.id), { enabled, markup_percent, markup_flat });
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found or no changes' });
    }
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all modifiers for a restaurant
app.get('/api/admin/restaurants/:restaurantId/modifiers', (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const allModifiers = modifiers.getByRestaurant(restaurantId);
    res.json(allModifiers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all modifier groups for a restaurant
app.get('/api/admin/restaurants/:restaurantId/modifier-groups', (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const groups = modifierGroups.getByRestaurant(restaurantId);
    res.json(groups);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle modifier enabled/disabled
app.put('/api/admin/modifiers/:id', (req, res) => {
  try {
    const { enabled } = req.body;
    const modifier = modifiers.update(parseInt(req.params.id), { enabled });
    if (!modifier) {
      return res.status(404).json({ error: 'Modifier not found or no changes' });
    }
    res.json(modifier);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set global markup for all items in a restaurant
app.post('/api/admin/restaurants/:restaurantId/global-markup', (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const { markup_percent } = req.body;

    if (markup_percent === undefined) {
      return res.status(400).json({ error: 'markup_percent is required' });
    }

    const items = menuItems.setGlobalMarkup(restaurantId, markup_percent);
    res.json({ success: true, itemCount: items.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check delivery availability for a restaurant
app.post('/api/admin/restaurants/:id/check-delivery', async (req, res) => {
  try {
    const restaurant = restaurants.getById(parseInt(req.params.id)) as any;
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Get the location to get the delivery address
    const location = locations.getById(restaurant.location_id) as any;
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    console.log(`Checking delivery for ${restaurant.name} to ${location.address}`);

    // Actually check delivery by scraping Toast
    const deliveryInfo = await checkDeliveryFee(restaurant.toast_url, location.address);

    // Update restaurant with delivery info
    restaurants.update(parseInt(req.params.id), {
      delivery_available: deliveryInfo.delivery_available,
      high_delivery_fee: deliveryInfo.high_delivery_fee,
      last_checked: new Date().toISOString(),
      status: deliveryInfo.delivery_available ? 'available' : 'unavailable'
    });

    res.json({
      delivery_available: deliveryInfo.delivery_available,
      high_delivery_fee: deliveryInfo.high_delivery_fee,
      last_checked: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Delivery check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ MENU LIBRARY ENDPOINTS ============

// Get all restaurants in the library
app.get('/api/admin/library', (req, res) => {
  try {
    const library = menuLibrary.getAll();
    res.json(library);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search library (must be before /:id to avoid matching "search" as id)
app.get('/api/admin/library/search', (req, res) => {
  try {
    const query = req.query.q as string || '';
    const results = menuLibrary.search(query);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get restaurants not assigned to a location (for "Add from Library")
app.get('/api/admin/library/available/:locationId', (req, res) => {
  try {
    const locationId = parseInt(req.params.locationId);
    const available = menuLibrary.getUnassignedForLocation(locationId);
    res.json(available);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single restaurant from library with delivery zones
app.get('/api/admin/library/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const restaurant = menuLibrary.getById(id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(restaurant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add restaurant to library (or find existing)
app.post('/api/admin/library', async (req, res) => {
  try {
    const { name, toast_url } = req.body;
    if (!name || !toast_url) {
      return res.status(400).json({ error: 'Name and toast_url are required' });
    }

    const result = menuLibrary.create({ name, toast_url });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Scrape menu for a library restaurant
app.post('/api/admin/library/:id/scrape', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const restaurant = restaurants.getById(id) as any;

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Clear existing menu
    menuItems.deleteByRestaurant(id);

    // Scrape new menu
    const menu = await scrapeMenu(restaurant.toast_url);

    // Save menu items
    for (const item of menu.items) {
      const savedItem = menuItems.create({
        restaurant_id: id,
        name: item.name,
        description: item.description,
        base_price: item.price,
        category: item.category,
        image_url: item.image
      });

      // Save modifiers
      if (item.modifierGroups && item.modifierGroups.length > 0) {
        for (const group of item.modifierGroups) {
          const savedGroup = modifierGroups.create({
            menu_item_id: savedItem.id as number,
            name: group.name,
            required: group.required,
            min_selections: group.minSelections,
            max_selections: group.maxSelections
          });

          for (const opt of group.options) {
            modifiers.bulkCreate(savedItem.id as number, [{
              name: opt.name,
              price: opt.price,
              group_id: savedGroup.id as number
            }]);
          }
        }
      }

      // Save flat modifiers (not in groups)
      if (item.modifiers) {
        const ungroupedMods = item.modifiers.filter(m => !m.groupName);
        if (ungroupedMods.length > 0) {
          modifiers.bulkCreate(savedItem.id as number, ungroupedMods.map(m => ({
            name: m.name,
            price: m.price
          })));
        }
      }
    }

    // Update last scraped timestamp
    menuLibrary.updateLastScraped(id);

    // Update restaurant hours if available
    if (menu.hours) {
      restaurants.update(id, { hours: JSON.stringify(menu.hours) });
    }

    const items = menuItems.getByRestaurant(id);
    const mods = modifiers.getByRestaurant(id);
    const groups = modifierGroups.getByRestaurant(id);

    res.json({
      success: true,
      itemCount: items.length,
      modifierCount: mods.length,
      requiredGroupCount: (groups as any[]).filter(g => g.required).length
    });
  } catch (error: any) {
    console.error('Scrape error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add restaurant from URL and scrape in one call
app.post('/api/admin/library/add-from-url', async (req, res) => {
  try {
    const { toast_url } = req.body;
    if (!toast_url) {
      return res.status(400).json({ error: 'toast_url is required' });
    }

    // Check if restaurant already exists
    const existing = menuLibrary.findByToastUrl(toast_url) as any;
    if (existing) {
      return res.status(409).json({ error: 'Restaurant already exists in library', existingId: existing.id });
    }

    // Scrape the menu to get the restaurant name
    const menu = await scrapeMenu(toast_url);
    if (!menu.restaurantName) {
      return res.status(400).json({ error: 'Could not scrape restaurant name from URL' });
    }

    // Create the restaurant with hero image
    const result = menuLibrary.create({
      name: menu.restaurantName,
      toast_url,
      image_url: menu.heroImage
    });
    const restaurantId = result.id as number;

    // Save menu items
    for (const item of menu.items) {
      const savedItem = menuItems.create({
        restaurant_id: restaurantId,
        name: item.name,
        description: item.description,
        base_price: item.price,
        category: item.category,
        image_url: item.image
      });

      // Save modifiers
      if (item.modifierGroups && item.modifierGroups.length > 0) {
        for (const group of item.modifierGroups) {
          const savedGroup = modifierGroups.create({
            menu_item_id: savedItem.id as number,
            name: group.name,
            required: group.required,
            min_selections: group.minSelections,
            max_selections: group.maxSelections
          });

          for (const opt of group.options) {
            modifiers.bulkCreate(savedItem.id as number, [{
              name: opt.name,
              price: opt.price,
              group_id: savedGroup.id as number
            }]);
          }
        }
      }

      // Save flat modifiers
      if (item.modifiers) {
        const ungroupedMods = item.modifiers.filter(m => !m.groupName);
        if (ungroupedMods.length > 0) {
          modifiers.bulkCreate(savedItem.id as number, ungroupedMods.map(m => ({
            name: m.name,
            price: m.price
          })));
        }
      }
    }

    // Update last scraped and hours
    menuLibrary.updateLastScraped(restaurantId);
    if (menu.hours) {
      restaurants.update(restaurantId, { hours: JSON.stringify(menu.hours) });
    }

    const items = menuItems.getByRestaurant(restaurantId);

    res.json({
      success: true,
      id: restaurantId,
      name: menu.restaurantName,
      itemCount: items.length
    });
  } catch (error: any) {
    console.error('Add from URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get locations for a restaurant (for assignment UI)
app.get('/api/admin/library/:id/locations', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const allLocations = locations.getAll() as any[];
    const assigned = locationRestaurants.getByRestaurant(id) as any[];
    const assignedIds = new Set(assigned.map(a => a.location_id));

    const result = allLocations.map(loc => ({
      id: loc.id,
      name: loc.name,
      assigned: assignedIds.has(loc.id)
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update restaurant location assignments
app.put('/api/admin/library/:id/locations', async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    const { locationIds } = req.body; // Array of location IDs to be assigned

    console.log(`Updating locations for restaurant ${restaurantId}:`, locationIds);

    if (!Array.isArray(locationIds)) {
      return res.status(400).json({ error: 'locationIds must be an array' });
    }

    // Get current assignments
    const current = locationRestaurants.getByRestaurant(restaurantId) as any[];
    const currentIds = new Set(current.map(c => c.location_id));
    const newIds = new Set(locationIds);

    console.log('Current assignments:', Array.from(currentIds));
    console.log('New assignments:', Array.from(newIds));

    // Remove assignments that are no longer in the list
    for (const curr of current) {
      if (!newIds.has(curr.location_id)) {
        console.log(`Removing location ${curr.location_id}`);
        locationRestaurants.unassign(curr.location_id, restaurantId);
      }
    }

    // Add new assignments
    for (const locId of locationIds) {
      if (!currentIds.has(locId)) {
        console.log(`Adding location ${locId}`);
        const result = locationRestaurants.assign({ location_id: locId, restaurant_id: restaurantId });
        console.log('Assign result:', result);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating locations:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ MENU EDITOR API ENDPOINTS ============

// Get full menu for editing (items with modifiers and groups)
app.get('/api/admin/library/:id/menu', (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    const restaurant = restaurants.getById(restaurantId) as any;
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const items = menuItems.getByRestaurant(restaurantId) as any[];
    const allModifiers = modifiers.getByRestaurant(restaurantId) as any[];
    const allGroups = modifierGroups.getByRestaurant(restaurantId) as any[];

    // Build a map of items with their modifiers and groups
    const menuData = items.map(item => {
      const itemModifiers = allModifiers.filter(m => m.menu_item_id === item.id);
      const itemGroups = allGroups.filter(g => g.menu_item_id === item.id);

      // Group modifiers by their group_id
      const groupedMods = itemGroups.map(group => ({
        ...group,
        modifiers: itemModifiers.filter(m => m.group_id === group.id)
      }));

      // Ungrouped modifiers
      const ungroupedMods = itemModifiers.filter(m => !m.group_id);

      return {
        ...item,
        modifierGroups: groupedMods,
        ungroupedModifiers: ungroupedMods
      };
    });

    // Group items by category
    const categories: Record<string, any[]> = {};
    for (const item of menuData) {
      const cat = item.category || 'Uncategorized';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }

    res.json({
      restaurant,
      categories,
      totalItems: items.length,
      enabledItems: items.filter(i => i.enabled).length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update menu item
app.put('/api/admin/library/items/:itemId', (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const { enabled, base_price, description } = req.body;

    const item = menuItems.update(itemId, { enabled, base_price, description });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update modifier
app.put('/api/admin/library/modifiers/:modifierId', (req, res) => {
  try {
    const modifierId = parseInt(req.params.modifierId);
    const { enabled, price } = req.body;

    const modifier = modifiers.update(modifierId, { enabled, price });
    if (!modifier) {
      return res.status(404).json({ error: 'Modifier not found' });
    }
    res.json(modifier);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update modifier group
app.put('/api/admin/library/modifier-groups/:groupId', (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { required, min_selections, max_selections } = req.body;

    const group = modifierGroups.update(groupId, { required, min_selections, max_selections });
    if (!group) {
      return res.status(404).json({ error: 'Modifier group not found' });
    }
    res.json(group);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk toggle items (enable/disable multiple items)
app.post('/api/admin/library/:id/menu/bulk-toggle', (req, res) => {
  try {
    const { itemIds, enabled } = req.body;
    if (!Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'itemIds must be an array' });
    }

    for (const itemId of itemIds) {
      menuItems.update(itemId, { enabled });
    }

    res.json({ success: true, updatedCount: itemIds.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ LOCATION-RESTAURANT ASSIGNMENT ENDPOINTS ============

// Get restaurants assigned to a location (using new junction table)
app.get('/api/admin/locations/:locationId/assigned-restaurants', (req, res) => {
  try {
    const locationId = parseInt(req.params.locationId);
    const assigned = locationRestaurants.getByLocation(locationId);
    res.json(assigned);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Assign restaurant from library to location
app.post('/api/admin/locations/:locationId/assign-restaurant', async (req, res) => {
  try {
    const locationId = parseInt(req.params.locationId);
    // Support both camelCase and snake_case for compatibility
    const restaurant_id = req.body.restaurantId || req.body.restaurant_id;
    const check_delivery = req.body.check_delivery;

    console.log(`Assigning restaurant ${restaurant_id} to location ${locationId}`, req.body);

    if (!restaurant_id) {
      return res.status(400).json({ error: 'restaurantId is required' });
    }

    // Assign restaurant to location
    const assignment = locationRestaurants.assign({
      location_id: locationId,
      restaurant_id
    });

    // Optionally check delivery availability
    if (check_delivery) {
      const restaurant = restaurants.getById(restaurant_id) as any;
      const location = locations.getById(locationId) as any;

      if (restaurant && location) {
        try {
          const deliveryInfo = await checkDeliveryFee(restaurant.toast_url, location.address);
          locationRestaurants.updateDeliveryStatus(locationId, restaurant_id, {
            delivery_available: deliveryInfo.delivery_available,
            high_delivery_fee: deliveryInfo.high_delivery_fee,
            status: deliveryInfo.delivery_available ? 'available' : 'out_of_range'
          });
        } catch (e) {
          console.error('Delivery check failed:', e);
        }
      }
    }

    res.json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check delivery for an assigned restaurant
app.post('/api/admin/locations/:locationId/restaurants/:restaurantId/check-delivery', async (req, res) => {
  try {
    const locationId = parseInt(req.params.locationId);
    const restaurantId = parseInt(req.params.restaurantId);

    const restaurant = restaurants.getById(restaurantId) as any;
    const location = locations.getById(locationId) as any;

    if (!restaurant || !location) {
      return res.status(404).json({ error: 'Restaurant or location not found' });
    }

    const deliveryInfo = await checkDeliveryFee(restaurant.toast_url, location.address);

    const updated = locationRestaurants.updateDeliveryStatus(locationId, restaurantId, {
      delivery_available: deliveryInfo.delivery_available,
      high_delivery_fee: deliveryInfo.high_delivery_fee,
      status: deliveryInfo.delivery_available ? 'available' : 'out_of_range'
    });

    res.json({
      ...updated,
      delivery_available: deliveryInfo.delivery_available,
      high_delivery_fee: deliveryInfo.high_delivery_fee
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Unassign restaurant from location
app.delete('/api/admin/locations/:locationId/restaurants/:restaurantId', (req, res) => {
  try {
    const locationId = parseInt(req.params.locationId);
    const restaurantId = parseInt(req.params.restaurantId);
    locationRestaurants.unassign(locationId, restaurantId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GUEST API ENDPOINTS ============

// Get location by slug (for guest ordering entry point)
app.get('/api/guest/locations/slug/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const location = locations.getBySlug(slug) as any;

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get restaurants for this location from location_restaurants junction
    const assigned = locationRestaurants.getByLocation(location.id) as any[];

    // Filter to only available restaurants with menus
    const availableRestaurants = assigned
      .filter(r => r.status === 'available' && r.enabled)
      .map(r => ({
        id: r.restaurant_id,
        name: r.name,
        menuItemCount: r.menu_item_count || 0,
        hours: r.hours ? JSON.parse(r.hours) : null,
        deliveryAvailable: !!r.delivery_available,
        highDeliveryFee: !!r.high_delivery_fee
      }))
      .filter(r => r.menuItemCount > 0);

    res.json({
      id: location.id,
      name: location.name,
      slug: location.slug,
      address: location.address,
      type: location.type,
      imageUrl: location.image_url,
      timezone: location.timezone || 'America/Los_Angeles',
      restaurants: availableRestaurants
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get restaurants available for a location (for guest ordering)
app.get('/api/guest/locations/:locationId/restaurants', (req, res) => {
  try {
    const locationId = parseInt(req.params.locationId);
    const assigned = locationRestaurants.getByLocation(locationId) as any[];

    // Only return enabled, available restaurants with menu items
    const availableRestaurants = assigned
      .filter(r => r.status === 'available' && r.enabled)
      .map(r => ({
        id: r.restaurant_id,
        name: r.name,
        itemCount: r.menu_item_count || 0,
        menuItemCount: r.menu_item_count || 0,
        hours: r.hours ? JSON.parse(r.hours) : null,
        deliveryAvailable: !!r.delivery_available,
        highDeliveryFee: !!r.high_delivery_fee
      }))
      .filter(r => r.itemCount > 0);

    res.json(availableRestaurants);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get restaurant details for ordering (including Toast URL)
app.get('/api/guest/restaurants/:restaurantId', (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const restaurant = restaurants.getById(restaurantId) as any;

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Get the location for the delivery address
    const location = locations.getById(restaurant.location_id) as any;

    res.json({
      id: restaurant.id,
      name: restaurant.name,
      toastUrl: restaurant.toast_url,
      deliveryAddress: location ? {
        street: location.address,
        city: 'Los Angeles', // TODO: parse from address or add to locations table
        state: 'CA',
        zip: '90291'
      } : null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get menu for guest (with markup prices applied)
app.get('/api/guest/restaurants/:restaurantId/menu', (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const restaurant = restaurants.getById(restaurantId) as any;

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const items = menuItems.getByRestaurant(restaurantId) as any[];
    const mods = modifiers.getByRestaurant(restaurantId) as any[];
    const groups = modifierGroups.getByRestaurant(restaurantId) as any[];

    // Only return enabled items with markup applied
    const menuWithMarkup = items
      .filter(item => item.enabled)
      .map(item => {
        // Calculate final price with markup
        const markup = item.base_price * (item.markup_percent / 100);
        const finalPrice = item.base_price + markup + item.markup_flat;

        // Get modifiers for this item
        const itemMods = mods.filter(m => m.menu_item_id === item.id && m.enabled);
        const itemGroups = groups.filter(g => g.menu_item_id === item.id);

        // Convert to guest format
        const modifierCategories = itemGroups.map(group => ({
          name: group.name,
          required: !!group.required,
          minSelections: group.min_selections,
          maxSelections: group.max_selections,
          options: itemMods
            .filter(m => m.group_id === group.id)
            .map(m => ({ name: m.name, price: m.price }))
        }));

        // Add ungrouped modifiers
        const ungroupedMods = itemMods.filter(m => !m.group_id);
        if (ungroupedMods.length > 0) {
          modifierCategories.push({
            name: 'Add-ons',
            required: false,
            minSelections: 0,
            maxSelections: ungroupedMods.length,
            options: ungroupedMods.map(m => ({ name: m.name, price: m.price }))
          });
        }

        return {
          id: item.id.toString(),
          name: item.name,
          description: item.description || '',
          price: Math.round(finalPrice * 100) / 100, // Round to 2 decimals
          category: item.category || 'Menu',
          image: item.image_url,
          modifiers: modifierCategories.length > 0 ? modifierCategories : undefined
        };
      });

    // Get unique categories in order
    const categories = [...new Set(menuWithMarkup.map(i => i.category))];

    res.json({
      restaurantName: restaurant.name,
      restaurantId: restaurant.id,
      items: menuWithMarkup,
      categories
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN METRICS & ERROR TRACKING ============

// Get order metrics
app.get('/api/admin/metrics', (req, res) => {
  try {
    const period = (req.query.period as 'today' | 'week' | 'month') || 'today';
    const metrics = orderAttempts.getMetrics(period);
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all metrics periods at once
app.get('/api/admin/metrics/all', (req, res) => {
  try {
    res.json({
      today: orderAttempts.getMetrics('today'),
      week: orderAttempts.getMetrics('week'),
      month: orderAttempts.getMetrics('month')
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get error log with filters
app.get('/api/admin/errors', (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      restaurantId: req.query.restaurantId ? parseInt(req.query.restaurantId as string) : undefined,
      errorType: req.query.errorType as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100
    };
    const errors = orderAttempts.getFailures(filters);
    res.json(errors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent order attempts (all statuses)
app.get('/api/admin/orders', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const orders = orderAttempts.getRecent(limit);
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order attempt details
app.get('/api/admin/orders/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = orderAttempts.getById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order attempt not found' });
    }
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Retry a failed order
app.post('/api/admin/orders/:id/retry', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const originalOrder = orderAttempts.getById(id) as any;

    if (!originalOrder) {
      return res.status(404).json({ error: 'Order attempt not found' });
    }

    if (originalOrder.status !== 'failed') {
      return res.status(400).json({ error: 'Can only retry failed orders' });
    }

    // Parse the original order data
    const items = JSON.parse(originalOrder.items_json || '[]');
    const customer = JSON.parse(originalOrder.customer_json || '{}');

    // Get restaurant URL
    const restaurant = restaurants.getById(originalOrder.restaurant_id) as any;
    if (!restaurant) {
      return res.status(400).json({ error: 'Restaurant not found' });
    }

    // Note: This would need actual payment/customer data to retry
    // For now, just create a new attempt record linked to original
    const newAttempt = orderAttempts.create({
      restaurant_id: originalOrder.restaurant_id,
      location_id: originalOrder.location_id,
      status: 'pending',
      items_json: originalOrder.items_json,
      customer_json: originalOrder.customer_json,
      order_total: originalOrder.order_total,
      retry_of: id
    });

    res.json({
      message: 'Retry initiated',
      originalAttemptId: id,
      newAttemptId: newAttempt.id
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get restaurant health metrics
app.get('/api/admin/restaurant-health', (req, res) => {
  try {
    const restaurantId = req.query.restaurantId ? parseInt(req.query.restaurantId as string) : undefined;
    const health = orderAttempts.getRestaurantHealth(restaurantId);
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve error screenshots
app.use('/api/admin/screenshots', express.static('server/screenshots'));

// ============ TWILIO NUMBERS MANAGEMENT ============

// Get all Twilio numbers
app.get('/api/admin/twilio-numbers', (req, res) => {
  try {
    const numbers = twilioNumbers.getAll();
    res.json(numbers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add new Twilio number to pool
app.post('/api/admin/twilio-numbers', (req, res) => {
  try {
    const { phone_number, friendly_name } = req.body;
    if (!phone_number) {
      return res.status(400).json({ error: 'phone_number is required' });
    }
    const number = twilioNumbers.create({ phone_number, friendly_name });
    res.status(201).json(number);
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Assign Twilio number to location
app.put('/api/admin/twilio-numbers/:id/assign', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { location_id } = req.body;
    const number = twilioNumbers.assignToLocation(id, location_id || null);
    if (!number) {
      return res.status(404).json({ error: 'Twilio number not found' });
    }
    res.json(number);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle Twilio number active status
app.put('/api/admin/twilio-numbers/:id/active', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { active } = req.body;
    twilioNumbers.setActive(id, active);
    res.json(twilioNumbers.getById(id));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Twilio number
app.delete('/api/admin/twilio-numbers/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    twilioNumbers.delete(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ORDER TRACKING SYSTEM ============

// Create new order (used by checkout)
app.post('/api/orders', async (req, res) => {
  try {
    const {
      location_id,
      restaurant_id,
      guest_first_name,
      guest_last_name,
      guest_phone,
      guest_email,
      items,
      order_total
    } = req.body;

    // Validate required fields
    if (!location_id || !restaurant_id || !guest_first_name || !guest_last_name || !guest_phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get Twilio number for this location (or any available)
    let twilioNumber = twilioNumbers.getByLocation(location_id) as any;
    if (!twilioNumber) {
      const available = twilioNumbers.getAvailable() as any[];
      twilioNumber = available[0] || null;
    }

    // Create order with generated email
    // We generate a placeholder email first, then update after we have the order ID
    const placeholderEmail = 'placeholder@simonorders.com';

    const order = orders.create({
      location_id,
      restaurant_id,
      guest_first_name,
      guest_last_name,
      guest_phone,
      guest_email,
      generated_email: placeholderEmail,
      twilio_number_id: twilioNumber?.id,
      items_json: JSON.stringify(items),
      order_total
    });

    // Now update with real generated email
    const generatedEmail = generateOrderEmail(order.id);
    const stmt = require('./database').default.prepare('UPDATE orders SET generated_email = ? WHERE id = ?');
    stmt.run(generatedEmail, order.id);

    // Update Twilio number last used
    if (twilioNumber) {
      twilioNumbers.updateLastUsed(twilioNumber.id);
    }

    // Get restaurant info for notification
    const restaurant = restaurants.getById(restaurant_id) as any;

    // Send initial SMS notification to guest
    if (twilioNumber && guest_phone) {
      const message = getNotificationMessage('pending', {
        restaurantName: restaurant?.name || 'the restaurant',
        orderId: order.id,
        guestFirstName: guest_first_name
      });

      await sendSMS(guest_phone, twilioNumber.phone_number, message);
    }

    res.status(201).json({
      id: order.id,
      generated_email: generatedEmail,
      twilio_phone: twilioNumber?.phone_number,
      tracking_url: getTrackingUrl(order.id)
    });
  } catch (error: any) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all orders (admin)
app.get('/api/admin/tracked-orders', (req, res) => {
  try {
    const filters = {
      location_id: req.query.location_id ? parseInt(req.query.location_id as string) : undefined,
      restaurant_id: req.query.restaurant_id ? parseInt(req.query.restaurant_id as string) : undefined,
      status: req.query.status as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100
    };
    const orderList = orders.getAll(filters);
    res.json(orderList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search orders (must be before :id route)
app.get('/api/admin/tracked-orders/search', (req, res) => {
  try {
    const query = req.query.q as string || '';
    const results = orders.search(query);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order with timeline (admin)
app.get('/api/admin/tracked-orders/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = orders.getById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const timeline = orderStatuses.getTimeline(id);
    res.json({ ...order, timeline });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manually update order status (admin)
app.post('/api/admin/tracked-orders/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, message } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const order = orders.getById(id) as any;
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update status
    orders.updateStatus(id, status, message || `Status manually updated to ${status}`, 'manual');

    // Send notification to guest
    if (shouldNotifyGuest(status) && order.guest_phone && order.twilio_phone) {
      const notificationMessage = getNotificationMessage(status, {
        restaurantName: order.restaurant_name,
        orderId: id,
        guestFirstName: order.guest_first_name
      });
      await sendSMS(order.guest_phone, order.twilio_phone, notificationMessage);
    }

    const updatedOrder = orders.getById(id);
    const timeline = orderStatuses.getTimeline(id);
    res.json({ ...updatedOrder, timeline });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update order with confirmation data from scraping and send SMS
app.post('/api/orders/:id/confirmation', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { confirmation_number, tracking_url, estimated_delivery, order_total } = req.body;

    const order = orders.getById(id) as any;
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order with confirmation data
    orders.updateConfirmation(id, {
      confirmation_number,
      tracking_url,
      estimated_delivery,
      order_total
    });

    // Update status to confirmed
    orders.updateStatus(id, 'confirmed', 'Order confirmed by restaurant', 'system');

    // Send confirmation SMS to guest
    if (order.guest_phone && order.twilio_phone) {
      const trackingUrl = getTrackingUrl(id);
      const message = `Simon InHouse: Order confirmed! ${order.restaurant_name} is preparing your order. Track here: ${trackingUrl}`;
      await sendSMS(order.guest_phone, order.twilio_phone, message);
      console.log(`[Order ${id}] Sent confirmation SMS to ${order.guest_phone}`);
    }

    res.json({ success: true, tracking_url: getTrackingUrl(id) });
  } catch (error: any) {
    console.error('Order confirmation update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ TWILIO SMS WEBHOOK ============

app.post('/api/tracking/incoming-sms', async (req, res) => {
  try {
    // Twilio sends form-encoded data
    const { From, To, Body } = req.body;

    console.log(`[SMS Webhook] From: ${From}, To: ${To}`);
    console.log(`[SMS Webhook] Body: ${Body}`);

    // Find the Twilio number that received this message
    const twilioNumber = twilioNumbers.getByPhoneNumber(To) as any;
    if (!twilioNumber) {
      console.log(`[SMS Webhook] Unknown Twilio number: ${To}`);
      return res.status(200).send('<Response></Response>'); // Always respond 200 to Twilio
    }

    // Find the most recent active order using this Twilio number
    const order = orders.getByTwilioNumber(twilioNumber.id) as any;
    if (!order) {
      console.log(`[SMS Webhook] No active order for Twilio number ${To}`);
      return res.status(200).send('<Response></Response>');
    }

    // Parse status from SMS
    const { status, message, confidence } = parseStatusFromSMS(Body);
    const eta = extractETA(Body);

    console.log(`[SMS Webhook] Parsed status: ${status} (${confidence}), message: ${message}`);

    if (status && confidence !== 'low') {
      // Update order status
      orders.updateStatus(order.id, status, message, 'sms', Body);

      // Send branded notification to guest
      if (shouldNotifyGuest(status)) {
        const notificationMessage = getNotificationMessage(status, {
          restaurantName: order.restaurant_name,
          orderId: order.id,
          guestFirstName: order.guest_first_name,
          eta: eta || undefined
        });

        await sendSMS(order.guest_phone, twilioNumber.phone_number, notificationMessage);
        console.log(`[SMS Webhook] Sent notification to guest: ${order.guest_phone}`);
      }
    } else {
      // Log unrecognized SMS for review
      orderStatuses.create({
        order_id: order.id,
        status: order.status, // Keep current status
        message: 'Unrecognized SMS received',
        source: 'sms',
        raw_sms: Body
      });
    }

    // Respond with empty TwiML (Twilio expects XML response)
    res.status(200).send('<Response></Response>');
  } catch (error: any) {
    console.error('[SMS Webhook] Error:', error);
    res.status(200).send('<Response></Response>'); // Always respond 200
  }
});

// ============ PUBLIC TRACKING API ============

// Get order status for tracking page (public, no auth)
app.get('/api/tracking/:orderId', (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const order = orders.getById(orderId) as any;

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get timeline
    const timeline = orderStatuses.getTimeline(orderId);

    // Parse items
    let items = [];
    try {
      items = JSON.parse(order.items_json || '[]');
    } catch (e) {
      // ignore parse errors
    }

    // Return public-safe order info (no guest phone/email)
    res.json({
      orderId: order.id,
      restaurant: order.restaurant_name,
      location: order.location_name,
      status: order.status,
      confirmationNumber: order.confirmation_number,
      trackingUrl: order.tracking_url,
      estimatedDelivery: order.estimated_delivery,
      items: items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      timeline: timeline.map((entry: any) => ({
        status: entry.status,
        message: entry.message,
        timestamp: entry.created_at
      })),
      orderTotal: order.order_total,
      createdAt: order.created_at,
      updatedAt: order.updated_at
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ TWILIO STATUS ============

app.get('/api/admin/twilio-status', (req, res) => {
  res.json({
    enabled: isTwilioEnabled(),
    twilioPhone: getTwilioPhoneNumber(),
    message: isTwilioEnabled()
      ? 'Twilio is configured and ready'
      : 'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables or via Settings.'
  });
});

// ============ APP SETTINGS (Twilio Credentials) ============

// Get Twilio credentials (mask sensitive values)
app.get('/api/admin/settings/twilio', (req, res) => {
  try {
    const sid = appSettings.get('twilio_account_sid') || '';
    const token = appSettings.get('twilio_auth_token') || '';
    const phone = appSettings.get('twilio_phone_number') || '';

    res.json({
      account_sid: sid ? `${sid.substring(0, 6)}...${sid.substring(sid.length - 4)}` : '',
      auth_token: token ? '••••••••' : '',
      phone_number: phone,
      has_account_sid: !!sid,
      has_auth_token: !!token,
      has_phone_number: !!phone,
      // Also report env var status
      env_account_sid: !!process.env.TWILIO_ACCOUNT_SID,
      env_auth_token: !!process.env.TWILIO_AUTH_TOKEN,
      env_phone_number: !!process.env.TWILIO_PHONE_NUMBER
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save Twilio credentials
app.put('/api/admin/settings/twilio', (req, res) => {
  try {
    const { account_sid, auth_token, phone_number } = req.body;

    const entries: Record<string, string> = {};
    if (account_sid !== undefined) entries['twilio_account_sid'] = account_sid;
    if (auth_token !== undefined) entries['twilio_auth_token'] = auth_token;
    if (phone_number !== undefined) entries['twilio_phone_number'] = phone_number;

    if (Object.keys(entries).length === 0) {
      return res.status(400).json({ error: 'No settings provided' });
    }

    appSettings.setMultiple(entries);

    res.json({ success: true, message: 'Twilio settings saved' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GUEST PROFILES ============

// Get all guest profiles with filters
app.get('/api/admin/guests', (req, res) => {
  try {
    const filters = {
      search: req.query.search as string,
      hotelId: req.query.hotelId ? parseInt(req.query.hotelId as string) : undefined,
      hasAllergies: req.query.hasAllergies === 'true',
      hasDietary: req.query.hasDietary === 'true',
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20
    };
    const result = guestProfiles.getAll(filters);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get guest profile by ID
app.get('/api/admin/guests/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const profile = guestProfiles.getById(id);
    if (!profile) {
      return res.status(404).json({ error: 'Guest profile not found' });
    }
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get guest order history
app.get('/api/admin/guests/:id/orders', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const orderHistory = guestProfiles.getOrderHistory(id, limit);
    res.json(orderHistory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update guest profile (admin)
app.put('/api/admin/guests/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { dietary_preferences, allergies, favorite_cuisines, dislikes, notes } = req.body;
    const updated = guestProfiles.update(id, {
      dietary_preferences,
      allergies,
      favorite_cuisines,
      dislikes,
      notes
    });
    if (!updated) {
      return res.status(404).json({ error: 'Guest profile not found or no changes' });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GUEST RECOMMENDATIONS ============

// Generate recommendations for a guest
app.get('/api/admin/guests/:id/recommendations', (req, res) => {
  try {
    const guestId = parseInt(req.params.id);
    const profile = guestProfiles.getById(guestId) as any;

    if (!profile) {
      return res.status(404).json({ error: 'Guest profile not found' });
    }

    // Get order history
    const orderHistory = guestProfiles.getOrderHistory(guestId, 50) as any[];

    // Build frequency map from past orders
    const itemFrequency: Map<string, number> = new Map();
    const orderedItemNames: Set<string> = new Set();

    for (const order of orderHistory) {
      try {
        const items = JSON.parse(order.items_json || '[]');
        for (const item of items) {
          const name = item.name?.toLowerCase() || '';
          if (name) {
            orderedItemNames.add(name);
            itemFrequency.set(name, (itemFrequency.get(name) || 0) + 1);
          }
        }
      } catch (e) {
        // skip parse errors
      }
    }

    // Parse preferences
    const allergies = (profile.allergies || '').toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);
    const dislikes = (profile.dislikes || '').toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);
    const favoriteCuisines = (profile.favorite_cuisines || '').toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);
    const dietaryPrefs = (profile.dietary_preferences || '').toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);

    // Get most recent location's available menu items
    const recentOrder = orderHistory[0];
    if (!recentOrder) {
      return res.json({ recommendations: [], cachedAt: new Date().toISOString() });
    }

    const locationId = recentOrder.location_id;
    const assignedRestaurants = db.prepare(`
      SELECT lr.restaurant_id, r.name as restaurant_name
      FROM location_restaurants lr
      JOIN restaurants r ON lr.restaurant_id = r.id
      WHERE lr.location_id = ? AND lr.status = 'available' AND lr.enabled = 1
    `).all(locationId) as any[];

    const recommendations: any[] = [];

    for (const rest of assignedRestaurants) {
      const items = db.prepare(`
        SELECT mi.*,
          (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = ? AND o.items_json LIKE '%' || mi.name || '%') as popularity
        FROM menu_items mi
        WHERE mi.restaurant_id = ? AND mi.enabled = 1
      `).all(rest.restaurant_id, rest.restaurant_id) as any[];

      for (const item of items) {
        const itemNameLower = item.name.toLowerCase();
        const itemDescLower = (item.description || '').toLowerCase();

        // Skip if contains allergens or dislikes
        let skipItem = false;
        for (const allergy of allergies) {
          if (itemNameLower.includes(allergy) || itemDescLower.includes(allergy)) {
            skipItem = true;
            break;
          }
        }
        for (const dislike of dislikes) {
          if (itemNameLower.includes(dislike) || itemDescLower.includes(dislike)) {
            skipItem = true;
            break;
          }
        }
        if (skipItem) continue;

        // Calculate score
        let score = 0;
        const reasoning: string[] = [];

        // Previously ordered (high weight)
        if (orderedItemNames.has(itemNameLower)) {
          score += 50;
          reasoning.push('ordered before');
        }

        // Similar to ordered items
        for (const orderedName of orderedItemNames) {
          if (itemNameLower.includes(orderedName.split(' ')[0]) || orderedName.includes(itemNameLower.split(' ')[0])) {
            score += 20;
            reasoning.push('similar to past orders');
            break;
          }
        }

        // Matches favorite cuisines
        for (const cuisine of favoriteCuisines) {
          if (itemNameLower.includes(cuisine) || itemDescLower.includes(cuisine) || (item.category || '').toLowerCase().includes(cuisine)) {
            score += 30;
            reasoning.push(`matches ${cuisine} preference`);
            break;
          }
        }

        // Matches dietary preferences
        for (const pref of dietaryPrefs) {
          if (itemNameLower.includes(pref) || itemDescLower.includes(pref)) {
            score += 25;
            reasoning.push(`${pref} friendly`);
            break;
          }
        }

        // Popular items
        if (item.popularity > 5) {
          score += 10;
          reasoning.push('popular');
        }

        if (score > 0 || item.popularity > 3) {
          recommendations.push({
            menuItemId: item.id,
            itemName: item.name,
            restaurantName: rest.restaurant_name,
            restaurantId: rest.restaurant_id,
            price: item.base_price,
            score: score + (item.popularity || 0),
            reasoning: [...new Set(reasoning)]
          });
        }
      }
    }

    // Sort by score and take top 10
    recommendations.sort((a, b) => b.score - a.score);
    const topRecommendations = recommendations.slice(0, 10);

    res.json({
      recommendations: topRecommendations,
      cachedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ANALYTICS ============

// Get analytics summary
app.get('/api/admin/analytics/summary', (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const hotelId = req.query.hotelId ? parseInt(req.query.hotelId as string) : undefined;

    let dateFilter = '';
    const params: any[] = [];

    if (startDate) {
      dateFilter += ' AND o.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND o.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }
    if (hotelId) {
      dateFilter += ' AND o.location_id = ?';
      params.push(hotelId);
    }

    const summary = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(o.order_total), 0) as total_revenue,
        COALESCE(AVG(o.order_total), 0) as avg_order_value,
        COUNT(DISTINCT o.guest_phone) as unique_guests
      FROM orders o
      WHERE 1=1 ${dateFilter}
    `).get(...params) as any;

    res.json({
      totalOrders: summary.total_orders,
      totalRevenue: Math.round(summary.total_revenue * 100) / 100,
      avgOrderValue: Math.round(summary.avg_order_value * 100) / 100,
      uniqueGuests: summary.unique_guests
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get orders time series
app.get('/api/admin/analytics/orders-time-series', (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const granularity = (req.query.granularity as string) || 'day';

    let dateFormat = '%Y-%m-%d';
    if (granularity === 'week') {
      dateFormat = '%Y-%W';
    } else if (granularity === 'month') {
      dateFormat = '%Y-%m';
    }

    let sql = `
      SELECT
        strftime('${dateFormat}', o.created_at) as date,
        COUNT(*) as orders,
        COALESCE(SUM(o.order_total), 0) as revenue
      FROM orders o
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      sql += ' AND o.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND o.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    sql += ` GROUP BY strftime('${dateFormat}', o.created_at) ORDER BY date ASC`;

    const data = db.prepare(sql).all(...params);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get orders by status
app.get('/api/admin/analytics/orders-by-status', (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let sql = `
      SELECT status, COUNT(*) as count
      FROM orders
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    sql += ' GROUP BY status';

    const data = db.prepare(sql).all(...params);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get top restaurants
app.get('/api/admin/analytics/top-restaurants', (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    let sql = `
      SELECT
        r.id as restaurant_id,
        r.name as restaurant_name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.order_total), 0) as revenue
      FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      sql += ' AND o.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND o.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    sql += ` GROUP BY r.id ORDER BY order_count DESC LIMIT ?`;
    params.push(limit);

    const data = db.prepare(sql).all(...params);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get top menu items
app.get('/api/admin/analytics/top-items', (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    // Parse items from orders and aggregate
    let sql = `SELECT o.items_json FROM orders o WHERE 1=1`;
    const params: any[] = [];

    if (startDate) {
      sql += ' AND o.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND o.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    const ordersWithItems = db.prepare(sql).all(...params) as any[];

    const itemCounts: Map<string, { quantity: number; revenue: number }> = new Map();

    for (const order of ordersWithItems) {
      try {
        const items = JSON.parse(order.items_json || '[]');
        for (const item of items) {
          const name = item.name || 'Unknown';
          const qty = item.quantity || 1;
          const price = item.price || 0;
          const existing = itemCounts.get(name) || { quantity: 0, revenue: 0 };
          itemCounts.set(name, {
            quantity: existing.quantity + qty,
            revenue: existing.revenue + (price * qty)
          });
        }
      } catch (e) {
        // skip parse errors
      }
    }

    const items = Array.from(itemCounts.entries())
      .map(([name, data]) => ({ itemName: name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);

    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get guest metrics
app.get('/api/admin/analytics/guest-metrics', (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let dateFilter = '';
    const params: any[] = [];

    if (startDate) {
      dateFilter += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    // New guests in period
    const newGuestsResult = db.prepare(`
      SELECT COUNT(DISTINCT guest_phone) as count
      FROM orders
      WHERE guest_phone NOT IN (
        SELECT DISTINCT guest_phone FROM orders WHERE created_at < ?
      ) ${dateFilter}
    `).get(startDate || '1970-01-01', ...params) as { count: number };

    // Returning guests (ordered before this period)
    const returningGuestsResult = db.prepare(`
      SELECT COUNT(DISTINCT guest_phone) as count
      FROM orders
      WHERE guest_phone IN (
        SELECT DISTINCT guest_phone FROM orders WHERE created_at < ?
      ) ${dateFilter}
    `).get(startDate || '1970-01-01', ...params) as { count: number };

    // Order frequency distribution
    const frequencyDist = db.prepare(`
      SELECT order_count, COUNT(*) as guest_count
      FROM (
        SELECT guest_phone, COUNT(*) as order_count
        FROM orders
        WHERE 1=1 ${dateFilter}
        GROUP BY guest_phone
      )
      GROUP BY order_count
      ORDER BY order_count
    `).all(...params);

    res.json({
      newGuests: newGuestsResult.count,
      returningGuests: returningGuestsResult.count,
      frequencyDistribution: frequencyDist
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ENHANCED ORDERS API ============

// Get orders with enhanced filters
app.get('/api/admin/orders/filtered', (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const hotelId = req.query.hotelId ? parseInt(req.query.hotelId as string) : undefined;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT o.*, r.name as restaurant_name, l.name as location_name, tn.phone_number as twilio_phone
      FROM orders o
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN locations l ON o.location_id = l.id
      LEFT JOIN twilio_numbers tn ON o.twilio_number_id = tn.id
      WHERE 1=1
    `;

    let countSql = `SELECT COUNT(*) as total FROM orders o WHERE 1=1`;
    const params: any[] = [];

    if (startDate) {
      sql += ' AND o.created_at >= ?';
      countSql += ' AND o.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND o.created_at <= ?';
      countSql += ' AND o.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }
    if (search) {
      const searchPattern = `%${search}%`;
      sql += ' AND (o.guest_first_name LIKE ? OR o.guest_last_name LIKE ? OR o.guest_phone LIKE ? OR CAST(o.id AS TEXT) LIKE ?)';
      countSql += ' AND (o.guest_first_name LIKE ? OR o.guest_last_name LIKE ? OR o.guest_phone LIKE ? OR CAST(o.id AS TEXT) LIKE ?)';
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    if (status) {
      sql += ' AND o.status = ?';
      countSql += ' AND o.status = ?';
      params.push(status);
    }
    if (hotelId) {
      sql += ' AND o.location_id = ?';
      countSql += ' AND o.location_id = ?';
      params.push(hotelId);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';

    const queryParams = [...params, limit, offset];
    const ordersData = db.prepare(sql).all(...queryParams);
    const countResult = db.prepare(countSql).get(...params) as { total: number };

    res.json({
      orders: ordersData,
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SERVE FRONTEND (production) ============
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

// Serve built Vite assets
app.use(express.static(distPath));

// SPA fallback: serve index.html for non-API, non-admin routes
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(distPath, 'admin.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(distPath, 'admin.html'));
});
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
