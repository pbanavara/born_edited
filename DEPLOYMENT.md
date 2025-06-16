# Vercel Deployment Guide

This guide will help you deploy the Born Edited app to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **OpenAI API Key**: You'll need an OpenAI API key for the Whisper functionality

## Deployment Steps

### Option 1: Automatic Deployment (Recommended)

1. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Select the repository containing this code

2. **Configure Environment Variables**:
   - In the Vercel project settings, go to "Environment Variables"
   - Add the following variable:
     - Name: `NEXT_PUBLIC_OPENAI_API_KEY`
     - Value: Your OpenAI API key
     - Environment: Production, Preview, Development

3. **Deploy**:
   - Vercel will automatically detect it's a Next.js project
   - Click "Deploy"
   - Your app will be deployed and you'll get a URL

### Option 2: Manual Deployment with GitHub Actions

1. **Set up Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### Option 3: GitHub Actions (Automatic)

1. **Get Vercel Tokens**:
   - Go to Vercel Dashboard → Settings → Tokens
   - Create a new token
   - Go to your project settings to get Project ID and Org ID

2. **Add GitHub Secrets**:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `VERCEL_TOKEN`: Your Vercel token
     - `VERCEL_ORG_ID`: Your Vercel organization ID
     - `VERCEL_PROJECT_ID`: Your Vercel project ID
     - `NEXT_PUBLIC_OPENAI_API_KEY`: Your OpenAI API key

3. **Push to Main**:
   - The GitHub Actions workflow will automatically deploy on push to main/master

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_OPENAI_API_KEY` | OpenAI API key for Whisper transcription | Yes |

## Build Configuration

The app uses the following build settings:
- **Framework**: Next.js
- **Node Version**: 18.x
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

## Features Available in Production

✅ **Camera & Recording**: Full video recording capabilities
✅ **Teleprompter**: Text scrolling with WPM control
✅ **Web Speech API**: Real-time speech recognition (Safari compatible)
✅ **OpenAI Whisper**: Alternative transcription service
✅ **Video Playback**: View recorded videos in the app
✅ **Responsive Design**: Works on desktop and mobile

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Ensure all dependencies are in `package.json`
   - Check that environment variables are set correctly

2. **API Key Issues**:
   - Verify the OpenAI API key is valid
   - Check that the environment variable name matches exactly

3. **Camera Permissions**:
   - HTTPS is required for camera access in production
   - Users will need to grant camera permissions

### Support

If you encounter issues:
1. Check the Vercel deployment logs
2. Verify environment variables are set
3. Test locally with `npm run dev` first

## Performance Notes

- The app is optimized for modern browsers
- Web Speech API works best in Safari
- Video recording requires HTTPS in production
- Large video files may take time to process 