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
    'sales/crm': ['admin', 'sales', 'sales_exec', 'sales_mgr', 'qa'],
    'sales/quotes': ['admin', 'sales', 'sales_exec', 'sales_mgr', 'fsm', 'qa'],
    'sales/sourcing': ['admin', 'sales', 'sales_exec', 'sales_mgr', 'qa'],

    // Supply
    'supply/recruitment': ['admin', 'recruiter', 'fsm', 'qa'],
    'supply/crm': ['admin', 'recruiter', 'fsm', 'qa'],
    'supply/dashboard': ['admin', 'recruiter', 'fsm', 'qa'],

    // Operations (FSM)
    'operations/work-orders': ['admin', 'fsm', 'sales', 'sales_exec', 'sales_mgr', 'qa'],
    'operations/contracts': ['admin', 'fsm', 'sales', 'sales_exec', 'sales_mgr', 'qa'],
    'operations/quotes:read': ['admin', 'fsm', 'sales', 'sales_exec', 'sales_mgr', 'qa'],

    // Night Manager
    'operations/audits': ['admin', 'night_manager', 'night_mgr', 'qa'],
    'operations/check-ins': ['admin', 'fsm', 'night_manager', 'night_mgr', 'qa'],
    'operations/site-visits': ['admin', 'fsm', 'qa'],
    'operations/nfc-zones': ['admin', 'fsm', 'qa'],

    // Accounting
    'accounting/invoices': ['admin', 'accounting', 'fsm', 'qa'],
    'accounting/commissions': ['admin', 'accounting', 'qa'],
    'accounting/vendor-remittances': ['admin', 'accounting', 'fsm', 'qa'],

    // Admin (QA can view but not modify)
    'admin/settings': ['admin', 'qa'],
    'admin/company': ['admin', 'qa'],
    'admin/users': ['admin', 'qa'],
    'admin/agents': ['admin', 'qa'],
    'admin/email-templates': ['admin', 'qa'],
    'admin/profile': ['admin', 'sales', 'sales_exec', 'sales_mgr', 'fsm', 'night_manager', 'night_mgr', 'recruiter', 'accounting', 'qa'],
};

export type Resource = string;
