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
    'sales/dashboard': ['admin', 'sales', 'sales_exec', 'sales_mgr'],
    'sales/crm': ['admin', 'sales', 'sales_exec', 'sales_mgr'],
    'sales/quotes': ['admin', 'sales', 'sales_exec', 'sales_mgr'],
    'sales/sourcing': ['admin', 'sales', 'sales_exec', 'sales_mgr'],

    // Supply
    'supply/recruitment': ['admin', 'recruiter', 'fsm'],
    'supply/crm': ['admin', 'recruiter', 'fsm'],
    'supply/dashboard': ['admin', 'recruiter', 'fsm'],

    // Operations (FSM)
    'operations/work-orders': ['admin', 'fsm', 'sales', 'sales_exec', 'sales_mgr'],
    'operations/contracts': ['admin', 'fsm', 'sales', 'sales_exec', 'sales_mgr'],
    'operations/quotes:read': ['admin', 'fsm', 'sales', 'sales_exec', 'sales_mgr'],

    // Night Manager
    'operations/audits': ['admin', 'fsm', 'night_manager', 'night_mgr'],
    'operations/check-ins': ['admin', 'fsm', 'night_manager', 'night_mgr'],
    'operations/site-visits': ['admin', 'fsm'],

    // Accounting
    'accounting/invoices': ['admin', 'accounting', 'fsm'],
    'accounting/commissions': ['admin', 'accounting'],
    'accounting/vendor-remittances': ['admin', 'accounting', 'fsm'],

    // Admin
    'admin/settings': ['admin'],
    'admin/users': ['admin'],
    'admin/templates': ['admin'],
    'admin/agents': ['admin'],
};

export type Resource = string;
