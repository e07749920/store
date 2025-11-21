import { UserRole } from '../types';

export type Permission = 'read' | 'create' | 'update' | 'delete';
export type Module =
  | 'dashboard'
  | 'inventory'
  | 'purchase'
  | 'opname'
  | 'transactions'
  | 'users'
  | 'intelligence'
  | 'settings'
  | 'profile';

interface RolePermissions {
  [key: string]: {
    canAccess: boolean;
    permissions: Permission[];
  };
}

const PERMISSIONS_MATRIX: Record<UserRole, RolePermissions> = {
  ADMIN: {
    dashboard: { canAccess: true, permissions: ['read', 'create', 'update', 'delete'] },
    inventory: { canAccess: true, permissions: ['read', 'create', 'update', 'delete'] },
    purchase: { canAccess: true, permissions: ['read', 'create', 'update', 'delete'] },
    opname: { canAccess: true, permissions: ['read', 'create', 'update', 'delete'] },
    transactions: { canAccess: true, permissions: ['read', 'create', 'update', 'delete'] },
    users: { canAccess: true, permissions: ['read', 'create', 'update', 'delete'] },
    intelligence: { canAccess: true, permissions: ['read', 'create', 'update', 'delete'] },
    settings: { canAccess: true, permissions: ['read', 'create', 'update', 'delete'] },
    profile: { canAccess: true, permissions: ['read', 'update'] },
  },
  STAFF: {
    dashboard: { canAccess: true, permissions: ['read', 'create', 'update'] },
    inventory: { canAccess: true, permissions: ['read', 'create', 'update', 'delete'] },
    purchase: { canAccess: true, permissions: ['read', 'create', 'update'] },
    opname: { canAccess: true, permissions: ['read', 'create', 'update'] },
    transactions: { canAccess: true, permissions: ['read', 'create'] },
    users: { canAccess: false, permissions: [] },
    intelligence: { canAccess: false, permissions: [] },
    settings: { canAccess: false, permissions: [] },
    profile: { canAccess: true, permissions: ['read', 'update'] },
  },
  USER: {
    dashboard: { canAccess: true, permissions: ['read'] },
    inventory: { canAccess: true, permissions: ['read'] },
    purchase: { canAccess: false, permissions: [] },
    opname: { canAccess: false, permissions: [] },
    transactions: { canAccess: true, permissions: ['read'] },
    users: { canAccess: false, permissions: [] },
    intelligence: { canAccess: false, permissions: [] },
    settings: { canAccess: false, permissions: [] },
    profile: { canAccess: true, permissions: ['read', 'update'] },
  },
};

export const canAccessModule = (role: UserRole, module: Module): boolean => {
  return PERMISSIONS_MATRIX[role]?.[module]?.canAccess ?? false;
};

export const hasPermission = (
  role: UserRole,
  module: Module,
  permission: Permission
): boolean => {
  const modulePerms = PERMISSIONS_MATRIX[role]?.[module];
  if (!modulePerms || !modulePerms.canAccess) return false;
  return modulePerms.permissions.includes(permission);
};

export const canCreate = (role: UserRole, module: Module): boolean => {
  return hasPermission(role, module, 'create');
};

export const canUpdate = (role: UserRole, module: Module): boolean => {
  return hasPermission(role, module, 'update');
};

export const canDelete = (role: UserRole, module: Module): boolean => {
  return hasPermission(role, module, 'delete');
};

export const canRead = (role: UserRole, module: Module): boolean => {
  return hasPermission(role, module, 'read');
};

export const getModulePermissions = (role: UserRole, module: Module) => {
  return PERMISSIONS_MATRIX[role]?.[module] ?? { canAccess: false, permissions: [] };
};

export const getAllowedModules = (role: UserRole): Module[] => {
  const modules = Object.keys(PERMISSIONS_MATRIX[role]) as Module[];
  return modules.filter(module => PERMISSIONS_MATRIX[role][module].canAccess);
};
