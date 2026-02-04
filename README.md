# Xiri Platform

A modern, mobile-responsive vendor recruitment platform built with Next.js, React, Tailwind CSS, and shadcn UI.

## 🚀 Features

- **Mobile-Responsive Design**: Optimized for all screen sizes
- **Modern UI**: Built with shadcn UI components and Tailwind CSS
- **Campaign Management**: Launch and manage vendor recruitment campaigns
- **Real-time Updates**: Live vendor pipeline with Firebase Firestore
- **AI-Powered**: Automated vendor qualification (coming soon)

## 📦 Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS v4, shadcn UI
- **Backend**: Next.js API Routes (serverless functions)
- **Database**: Firebase Firestore
- **Deployment**: Vercel

## 🛠️ Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file in `apps/xiri-web/`:
   ```bash
   cp apps/xiri-web/.env.example apps/xiri-web/.env.local
   ```
   Then fill in your Firebase credentials.

3. **Start the development server:**
   ```bash
   cd apps/xiri-web
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🚢 Deployment to Vercel

### Option 1: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will auto-detect Next.js and configure settings
6. Add your environment variables in the Vercel dashboard
7. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Environment Variables for Vercel

Add these in your Vercel project settings:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_ID=your-messaging-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## 📱 Mobile Responsiveness

The application is fully responsive with:
- Adaptive navigation (desktop nav bar, mobile menu)
- Responsive grid layouts
- Mobile-optimized table views (cards on mobile, table on desktop)
- Touch-friendly buttons and inputs

## 🏗️ Project Structure

```
xiri-platform/
├── apps/
│   └── xiri-web/              # Next.js application
│       ├── src/
│       │   ├── app/           # Next.js app router
│       │   │   ├── api/       # API routes (backend)
│       │   │   └── page.tsx   # Main page
│       │   ├── components/    # React components
│       │   │   ├── ui/        # shadcn UI components
│       │   │   ├── CampaignLauncher.tsx
│       │   │   └── VendorList.tsx
│       │   └── lib/           # Utilities
│       │       ├── firebase.ts
│       │       └── utils.ts
│       └── package.json
└── package.json               # Root package.json
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start dev server

# Production
npm run build            # Build for production
npm start                # Start production server

# Code Quality
npm run lint             # Run ESLint
```

## 📝 Notes

- **No Emulators**: This version does not use Firebase emulators
- **Serverless Backend**: Backend logic runs as Next.js API routes on Vercel
- **Clean Architecture**: Removed all legacy emulator-related code
- **Version**: Built from v1.0 stable release

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary and confidential.
