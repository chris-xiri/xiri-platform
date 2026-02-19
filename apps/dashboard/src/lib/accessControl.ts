export function canAccess(path: string, roles: string[]): boolean {
    const allowed = ACCESS_MAP[path];
    if (!allowed) {
        // If no explicit mapping, deny by default
        // But allow 'admin' to access everything
        return roles.includes('admin');
    }
    return roles.some(r => allowed.includes(r));
}

const ACCESS_MAP: Record<string, string[]> = {
    // Sales
    'sales/dashboard': ['admin', 'sales_exec', 'sales_mgr'],
    'sales/crm': ['admin', 'sales_exec', 'sales_mgr'],
    'sales/quotes': ['admin', 'sales_exec', 'sales_mgr'],

    // Supply
    'supply/recruitment': ['admin', 'recruiter', 'fsm'],
    'supply/crm': ['admin', 'recruiter', 'fsm'],

    // Operations (FSM)
    'operations/work-orders': ['admin', 'fsm'],
    'operations/contracts': ['admin', 'fsm', 'sales_mgr'],
    'operations/quotes:read': ['admin', 'fsm', 'sales_exec', 'sales_mgr'],

    // Night Manager
    'operations/audits': ['admin', 'fsm', 'night_mgr'],
    'operations/check-ins': ['admin', 'fsm', 'night_mgr'],

    // Accounting
    'accounting/invoices': ['admin', 'accounting', 'fsm'],

    // Admin
    'admin/settings': ['admin'],
    'admin/users': ['admin'],
    'admin/templates': ['admin'],
    'admin/agents': ['admin'],
};

export type Resource = string;
