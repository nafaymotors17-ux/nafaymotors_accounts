# Module System Documentation

This project uses a modular architecture where each major feature (like Accounting) is organized as a separate module. The tab navigation system automatically displays all enabled modules.

## Project Structure

```
src/app/
├── modules.config.js          # Module configuration (add new modules here)
├── components/
│   └── TabNavigation.js        # Tab navigation component
├── accounting/                 # Accounting module
│   ├── page.js                 # Accounting page
│   └── components/             # Accounting-specific components
├── dashboard/                  # Dashboard module
│   └── page.js                 # Dashboard page
└── lib/                        # Shared libraries
    └── accounting-actions/     # Accounting-specific actions
```

## Adding a New Module/Tab

To add a new module (e.g., "Inventory"), follow these steps:

### 1. Register the Module

Edit `src/app/modules.config.js` and add your new module:

```javascript
export const modules = [
  // ... existing modules
  {
    id: 'inventory',
    name: 'Inventory',
    path: '/inventory',
    icon: '📦',
    enabled: true,
  },
];
```

### 2. Create the Module Route

Create a new directory for your module in `src/app/`:

```
src/app/inventory/
└── page.js
```

Example `page.js`:

```javascript
export default async function InventoryPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800">Inventory</h1>
        {/* Your inventory content here */}
      </div>
    </div>
  );
}
```

### 3. (Optional) Organize Module Code

If your module has multiple components or actions, you can organize them:

```
src/app/inventory/
├── page.js
├── components/
│   ├── InventoryTable.js
│   └── InventoryForm.js
└── actions/
    └── inventory-actions.js
```

Or keep shared actions in `src/app/lib/`:

```
src/app/lib/
└── inventory-actions/
    └── inventory.js
```

## Module Configuration Options

Each module in `modules.config.js` supports:

- `id`: Unique identifier (used internally)
- `name`: Display name in the tab
- `path`: Route path (must match your page route)
- `icon`: Optional emoji or icon (string)
- `enabled`: Boolean to enable/disable the module

## How It Works

1. **TabNavigation Component**: Reads from `modules.config.js` and displays all enabled modules as tabs
2. **Active State**: Automatically highlights the active tab based on the current route
3. **Layout Integration**: The tabs are displayed in the main layout, visible on all pages

## Example: Complete New Module

Here's a complete example for adding a "Sales" module:

1. **Add to modules.config.js**:
```javascript
{
  id: 'sales',
  name: 'Sales',
  path: '/sales',
  icon: '🛒',
  enabled: true,
},
```

2. **Create src/app/sales/page.js**:
```javascript
export default function SalesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800">Sales</h1>
        <p>Your sales content here</p>
      </div>
    </div>
  );
}
```

That's it! The tab will automatically appear in the navigation.

## Disabling a Module

To temporarily disable a module without deleting it, set `enabled: false` in `modules.config.js`:

```javascript
{
  id: 'inventory',
  name: 'Inventory',
  path: '/inventory',
  icon: '📦',
  enabled: false,  // Tab won't appear
},
```

## Best Practices

1. **Module Isolation**: Keep module-specific code within the module directory
2. **Shared Code**: Put shared utilities in `src/app/lib/`
3. **Naming**: Use consistent naming (kebab-case for directories, PascalCase for components)
4. **Icons**: Use emojis for simplicity, or integrate an icon library later

## Current Modules

- **Dashboard** (`/dashboard`): Main dashboard with overview
- **Accounting** (`/accounting`): Account management and transactions
