# Xiri Platform - Vercel Deployment Guide

## 🎯 Overview

This guide will help you deploy the Xiri Platform to Vercel, hosting both the frontend and backend (API routes) in one place.

## 📋 Prerequisites

- GitHub account
- Vercel account (sign up at [vercel.com](https://vercel.com))
- Firebase project with Firestore enabled
- Your Firebase configuration credentials

## 🚀 Step-by-Step Deployment

### Step 1: Push Code to GitHub

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit - Clean Next.js build"

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/xiri-platform.git

# Push to GitHub
git push -u origin main
```

### Step 2: Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js configuration

### Step 3: Configure Build Settings

Vercel should auto-configure, but verify these settings:

- **Framework Preset**: Next.js
- **Root Directory**: `./` (leave as root)
- **Build Command**: `cd apps/xiri-web && npm run build`
- **Output Directory**: `apps/xiri-web/.next`
- **Install Command**: `npm install`

### Step 4: Add Environment Variables

In the Vercel project settings, add these environment variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

**Where to find these values:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon → Project settings
4. Scroll down to "Your apps" section
5. Click on your web app or create one
6. Copy the config values

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (usually 2-3 minutes)
3. Once deployed, you'll get a URL like `https://xiri-platform.vercel.app`

### Step 6: Configure Custom Domain (Optional)

1. In Vercel project settings, go to **"Domains"**
2. Add your custom domain
3. Follow Vercel's instructions to update your DNS records

## 🔄 Continuous Deployment

Once set up, Vercel will automatically deploy:
- **Production**: Every push to `main` branch
- **Preview**: Every pull request gets a preview URL

## 🧪 Testing Your Deployment

After deployment:

1. Visit your Vercel URL
2. Verify the homepage loads correctly
3. Test the Campaign Launcher (it will show a success message but won't create actual leads until you implement the backend logic)
4. Check mobile responsiveness by resizing your browser

## 🛠️ Backend API Routes

Your Next.js API routes are automatically deployed as serverless functions on Vercel:

- `/api/generate-leads` - Campaign lead generation endpoint

These run on Vercel's Edge Network with automatic scaling.

## 📱 Mobile Responsiveness

The app is fully responsive and tested on:
- Desktop (1920x1080)
- Tablet (768x1024)
- Mobile (375x812)

## 🔐 Security Best Practices

1. **Never commit `.env.local`** - It's in `.gitignore`
2. **Use Vercel Environment Variables** - They're encrypted at rest
3. **Firestore Security Rules** - Ensure your Firebase rules are properly configured
4. **API Route Protection** - Add authentication to your API routes in production

## 🐛 Troubleshooting

### Build Fails

**Problem**: Build fails with module not found errors
**Solution**: 
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Environment Variables Not Working

**Problem**: Firebase connection fails
**Solution**:
1. Verify all environment variables are set in Vercel
2. Make sure they start with `NEXT_PUBLIC_`
3. Redeploy after adding/changing environment variables

### API Routes Return 404

**Problem**: `/api/generate-leads` returns 404
**Solution**:
1. Verify the file exists at `apps/xiri-web/src/app/api/generate-leads/route.ts`
2. Check the build logs for any compilation errors
3. Ensure the route is exported correctly

## 📊 Monitoring

Vercel provides built-in monitoring:

1. **Analytics**: View page views, performance metrics
2. **Logs**: Real-time function logs
3. **Speed Insights**: Core Web Vitals tracking

Access these in your Vercel project dashboard.

## 🔄 Updating Your Deployment

To deploy updates:

```bash
# Make your changes
git add .
git commit -m "Your update message"
git push

# Vercel automatically deploys!
```

## 💡 Next Steps

1. **Implement Backend Logic**: Update `/api/generate-leads/route.ts` with actual lead generation
2. **Add Authentication**: Implement user authentication with Firebase Auth
3. **Set Up Firestore Rules**: Configure security rules for your database
4. **Add More Features**: Expand the CRM functionality

## 🆘 Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **Firebase Docs**: [firebase.google.com/docs](https://firebase.google.com/docs)

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Project imported to Vercel
- [ ] Environment variables configured
- [ ] First deployment successful
- [ ] Homepage loads correctly
- [ ] Mobile responsiveness verified
- [ ] API routes responding
- [ ] Custom domain configured (optional)
- [ ] Firestore security rules set up
- [ ] Monitoring enabled

---

**Congratulations!** 🎉 Your Xiri Platform is now live on Vercel!
