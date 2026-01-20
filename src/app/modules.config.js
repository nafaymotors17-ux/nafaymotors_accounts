/**
 * Module Configuration
 * Add new modules here to automatically create tabs in the navigation
 * 
 * Each module should have:
 * - id: unique identifier (used in URL)
 * - name: display name in the tab
 * - path: route path (e.g., '/accounting')
 * - icon: optional icon component or string
 * - enabled: whether the module is active
 */

export const modules = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/dashboard',
    icon: '📊',
    enabled: true,
  },
  {
    id: 'accounting',
    name: 'Accounting',
    path: '/accounting',
    icon: '💰',
    enabled: true,
  },
  // Add more modules here:
  {
    id: 'carriers',
    name: 'Carriers & Companies',
    path: '/carriers',
    icon: '📦',
    enabled: true,
  },
  // {
  //   id: 'sales',
  //   name: 'Sales',
  //   path: '/sales',
  //   icon: '🛒',
  //   enabled: true,
  // },
];

/**
 * Get enabled modules
 */
export function getEnabledModules() {
  return modules.filter(module => module.enabled);
}

/**
 * Get module by ID
 */
export function getModuleById(id) {
  return modules.find(module => module.id === id);
}

/**
 * Get module by path
 */
export function getModuleByPath(path) {
  return modules.find(module => module.path === path);
}
