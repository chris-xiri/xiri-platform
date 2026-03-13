/**
 * Centralized CORS origins for all Cloud Functions.
 * Single source of truth — update here when adding new deployment URLs.
 */
export const DASHBOARD_CORS = [
    "http://localhost:3001",     // Dashboard Dev
    "http://localhost:3000",     // Public Site Dev
    "http://localhost:3002",     // Public Site Dev (alt port)
    "https://xiri.ai",          // Public Site Production
    "https://www.xiri.ai",      // Public Site WWW
    "https://app.xiri.ai",      // Dashboard Production
    "https://xiri-dashboard.vercel.app",  // Dashboard Vercel
    "https://xiri-dashboard-git-develop-xiri-facility-solutions.vercel.app", // Vercel develop branch
    /https:\/\/xiri-dashboard-.*\.vercel\.app$/,  // All Vercel preview deployments
    "https://xiri-facility-solutions.web.app",     // Firebase Hosting
    "https://xiri-facility-solutions.firebaseapp.com"
];
