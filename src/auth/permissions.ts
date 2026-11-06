export type UserRole = 'owner' | 'admin' | 'accountant' | 'cfo' | 'viewer';

export type Permission =
  | 'view:dashboards'
  | 'view:financials'
  | 'write:financials'
  | 'sync:connectors'
  | 'manage:connectors'
  | 'view:reports'
  | 'export:data'
  | 'manage:users'
  | 'manage:settings'
  | 'write:forecasts'
  | 'trigger:automations';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'view:dashboards',
    'view:financials',
    'write:financials',
    'sync:connectors',
    'manage:connectors',
    'view:reports',
    'export:data',
    'manage:users',
    'manage:settings',
    'write:forecasts',
    'trigger:automations',
  ],
  admin: [
    'view:dashboards',
    'view:financials',
    'write:financials',
    'sync:connectors',
    'manage:connectors',
    'view:reports',
    'export:data',
    'manage:users',
    'manage:settings',
    'write:forecasts',
  ],
  cfo: [
    'view:dashboards',
    'view:financials',
    'write:financials',
    'sync:connectors',
    'view:reports',
    'export:data',
    'write:forecasts',
    'trigger:automations',
  ],
  accountant: [
    'view:dashboards',
    'view:financials',
    'write:financials',
    'sync:connectors',
    'view:reports',
    'export:data',
  ],
  viewer: [
    'view:dashboards',
    'view:financials',
    'view:reports',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}
