---
description: Deploy the SEO agent to Cloud Run and set up Cloud Scheduler
---

# Deploy SEO Agent

## Prerequisites
- Google Cloud SDK (`gcloud`) installed and authenticated
- Project: `xiri-facility-solutions`

## Steps

// turbo-all

1. Set the GCP project:
```bash
gcloud config set project xiri-facility-solutions
```

2. Enable required APIs:
```bash
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com cloudbuild.googleapis.com
```

3. Build and deploy to Cloud Run:
```bash
cd tools/seo-agent
gcloud run deploy xiri-seo-agent \
  --source . \
  --region us-east1 \
  --platform managed \
  --allow-unauthenticated=false \
  --memory 2Gi \
  --timeout 900 \
  --set-env-vars "TARGET_URL=https://xiri.ai,GOOGLE_CHAT_WEBHOOK_URL=$GOOGLE_CHAT_WEBHOOK_URL,LLM_PROVIDER=ollama,FIREBASE_PROJECT_ID=xiri-facility-solutions"
```

4. Get the Cloud Run service URL:
```bash
gcloud run services describe xiri-seo-agent --region us-east1 --format 'value(status.url)'
```

5. Create the Cloud Scheduler job (weekly, every Monday at 9 AM EST):
```bash
gcloud scheduler jobs create http xiri-seo-weekly \
  --location us-east1 \
  --schedule "0 9 * * 1" \
  --time-zone "America/New_York" \
  --uri "$(gcloud run services describe xiri-seo-agent --region us-east1 --format 'value(status.url)')/run" \
  --http-method POST \
  --oidc-service-account-email $(gcloud iam service-accounts list --filter="displayName:Compute Engine default" --format='value(email)') \
  --headers "Content-Type=application/json"
```

6. Test the scheduled job manually:
```bash
gcloud scheduler jobs run xiri-seo-weekly --location us-east1
```
