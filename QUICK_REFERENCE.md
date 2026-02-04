# Quick Reference Guide

## 🚀 Common Commands

### Development

```bash
# Start development server
cd apps/xiri-web
npm run dev
# Open http://localhost:3000

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Deployment

```bash
# Deploy to Vercel (first time)
npx vercel

# Deploy to production
npx vercel --prod

# Check deployment status
npx vercel ls
```

### Git Commands

```bash
# Check current status
git status

# Add all changes
git add .

# Commit changes
git commit -m "Your message"

# Push to GitHub
git push

# Create new branch
git checkout -b feature/your-feature

# Switch branches
git checkout main
```

### Firebase

```bash
# Login to Firebase
firebase login

# Initialize Firebase (if needed)
firebase init

# Deploy Firestore rules
firebase deploy --only firestore:rules
```

## 📁 Important Files

| File | Purpose |
|------|---------|
| `apps/xiri-web/src/app/page.tsx` | Main homepage |
| `apps/xiri-web/src/components/CampaignLauncher.tsx` | Campaign form |
| `apps/xiri-web/src/components/VendorList.tsx` | Vendor table/list |
| `apps/xiri-web/src/app/api/generate-leads/route.ts` | Backend API |
| `apps/xiri-web/src/lib/firebase.ts` | Firebase config |
| `apps/xiri-web/.env.local` | Environment variables (create this) |
| `.env.example` | Environment template |

## 🔧 Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_ID=your-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## 🐛 Troubleshooting

### Port already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Clear cache and reinstall
```bash
rm -rf node_modules package-lock.json .next
npm install
```

### TypeScript errors
```bash
# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

## 📱 Testing Responsive Design

### In Browser DevTools:
1. Open DevTools (F12)
2. Click device toolbar icon (Cmd+Shift+M)
3. Select device or enter custom dimensions

### Recommended Test Sizes:
- Mobile: 375x812 (iPhone)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080

## 🔗 Useful Links

- **Local Dev**: http://localhost:3000
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Firebase Console**: https://console.firebase.google.com
- **Next.js Docs**: https://nextjs.org/docs
- **Tailwind Docs**: https://tailwindcss.com/docs
- **shadcn UI**: https://ui.shadcn.com

## 💡 Tips

1. **Hot Reload**: Changes auto-refresh in dev mode
2. **API Routes**: Test at `http://localhost:3000/api/generate-leads`
3. **Console Logs**: Check browser console for errors
4. **Network Tab**: Monitor API calls in DevTools
5. **Vercel Logs**: View function logs in Vercel dashboard

## ⚡ Quick Fixes

### "Module not found"
```bash
npm install
```

### "Port 3000 in use"
```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

### "Firebase not initialized"
Check `.env.local` exists and has correct values

### "Build failed"
```bash
npm run lint
# Fix any errors shown
npm run build
```

## 📦 Adding New Components

```bash
# Add shadcn component
npx shadcn@latest add [component-name]

# Example: Add dialog
npx shadcn@latest add dialog
```

## 🎯 Next Steps Checklist

- [ ] Set up `.env.local` with Firebase credentials
- [ ] Test locally with `npm run dev`
- [ ] Push code to GitHub
- [ ] Deploy to Vercel
- [ ] Configure environment variables in Vercel
- [ ] Test production deployment
- [ ] Set up custom domain (optional)
- [ ] Implement backend logic in API routes
- [ ] Add authentication
- [ ] Configure Firestore security rules
