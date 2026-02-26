import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                border: "var(--border)",
                input: "var(--input)",
                ring: "var(--ring)",
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: {
                    DEFAULT: "var(--primary)",
                    foreground: "var(--primary-foreground)",
                },
                secondary: {
                    DEFAULT: "var(--secondary)",
                    foreground: "var(--secondary-foreground)",
                },
                destructive: {
                    DEFAULT: "var(--destructive)",
                    foreground: "var(--destructive-foreground)",
                },
                muted: {
                    DEFAULT: "var(--muted)",
                    foreground: "var(--muted-foreground)",
                },
                accent: {
                    DEFAULT: "var(--accent)",
                    foreground: "var(--accent-foreground)",
                },
                popover: {
                    DEFAULT: "var(--popover)",
                    foreground: "var(--popover-foreground)",
                },
                card: {
                    DEFAULT: "var(--card)",
                    foreground: "var(--card-foreground)",
                },
                /* ── XIRI Brand Tokens ── */
                nav: {
                    section: "var(--nav-section)",
                    "section-active": "var(--nav-section-active)",
                    item: "var(--nav-item)",
                    "item-hover": "var(--nav-item-hover)",
                    "item-hover-bg": "var(--nav-item-hover-bg)",
                    "item-active": "var(--nav-item-active)",
                    "item-active-bg": "var(--nav-item-active-bg)",
                    "item-active-icon": "var(--nav-item-active-icon)",
                    icon: "var(--nav-icon)",
                    "sub-label": "var(--nav-sub-label)",
                },
                success: {
                    DEFAULT: "var(--success)",
                    bg: "var(--success-bg)",
                    border: "var(--success-border)",
                },
                warning: {
                    DEFAULT: "var(--warning)",
                    bg: "var(--warning-bg)",
                    border: "var(--warning-border)",
                },
                info: {
                    DEFAULT: "var(--info)",
                    bg: "var(--info-bg)",
                    border: "var(--info-border)",
                },
                danger: {
                    DEFAULT: "var(--danger)",
                    bg: "var(--danger-bg)",
                    border: "var(--danger-border)",
                },
                badge: {
                    "neutral-bg": "var(--badge-neutral-bg)",
                    "neutral-text": "var(--badge-neutral-text)",
                    "brand-bg": "var(--badge-brand-bg)",
                    "brand-text": "var(--badge-brand-text)",
                },
                "table-header-bg": "var(--table-header-bg)",
                "table-row-hover": "var(--table-row-hover)",
                "table-border": "var(--table-border)",
                "brand-logo": "var(--brand-logo)",
                "brand-logo-sub": "var(--brand-logo-sub)",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
        },
    },
    plugins: [],
};
export default config;
