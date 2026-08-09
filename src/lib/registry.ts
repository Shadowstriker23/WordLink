export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  priority?: number;
}

export interface ModuleDefinition {
  id: string;
  label: string;
  description?: string;
  enabled?: boolean;
  routes?: string[];
  nav?: NavItem[];
}

const modules = new Map<string, ModuleDefinition>();

export function registerModule(def: ModuleDefinition) {
  modules.set(def.id, def);
}

export function getModules(): ModuleDefinition[] {
  return [...modules.values()].filter((m) => m.enabled !== false);
}

export function getNavItems(): NavItem[] {
  return getModules()
    .flatMap((m) => m.nav ?? [])
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

export function isModuleEnabled(id: string) {
  return modules.get(id)?.enabled !== false;
}
