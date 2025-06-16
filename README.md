# Born Edited

A professional teleprompter and video recording application with real-time speech recognition and automatic speed adjustment.

## Features

🎥 **Camera & Recording**
- High-quality video recording with audio
- Real-time camera preview
- Video playback and download functionality

📝 **Teleprompter**
- Text scrolling with adjustable speed (WPM)
- Pause/resume functionality
- State preservation when paused
- Automatic speed adjustment based on speech rate

🎤 **Speech Recognition**
- **Web Speech API** (Safari compatible) - Ultra-low latency
- **OpenAI Whisper** - High-accuracy transcription
- Real-time WPM detection
- Automatic teleprompter speed adjustment

🎨 **Modern UI**
- Dark theme with responsive design
- Professional interface
- Real-time status indicators
- Smooth animations and transitions

## Quick Start

### Prerequisites
- Node.js 18+ 
- Modern browser with camera support
- OpenAI API key (optional, for Whisper functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd born_edited
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Create .env.local file
   echo "NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here" > .env.local
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Basic Workflow

1. **Start Camera**: Click the camera button to initialize camera and microphone
2. **Enter Script**: Type or paste your script in the text area
3. **Start Teleprompter**: Click "Send" to begin scrolling text
4. **Start Recording**: Click the record button to capture video
5. **Speak Naturally**: The app will detect your speaking rate and adjust teleprompter speed
6. **View Recording**: Click "View Recording" to playback your video

### Speech Recognition

The app supports two speech recognition methods:

**Web Speech API** (Default)
- ✅ Ultra-low latency (50-200ms)
- ✅ Works offline
- ✅ No API costs
- ✅ Best in Safari
- ❌ Limited browser support

**OpenAI Whisper**
- ✅ High accuracy
- ✅ Works in all browsers
- ✅ Advanced features
- ❌ Requires API key
- ❌ Network dependency

To switch between them, modify the `useWebSpeech` variable in the code.

### Teleprompter Controls

- **Speed**: Adjust WPM manually or let it auto-adjust
- **Pause/Resume**: Stop and continue from the same position
- **State Preservation**: Maintains scroll position when paused

## Deployment

### Vercel (Recommended)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy:**
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your OpenAI API key as an environment variable
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Camera Recording | ✅ | ✅ | ✅ | ✅ |
| Web Speech API | ✅ | ✅ | ✅ | ✅ |
| Video Playback | ✅ | ✅ | ✅ | ✅ |
| Teleprompter | ✅ | ✅ | ✅ | ✅ |

## API Keys

### OpenAI API Key
Required for Whisper transcription functionality:
1. Get your API key from [OpenAI](https://platform.openai.com/api-keys)
2. Add it to your environment variables as `NEXT_PUBLIC_OPENAI_API_KEY`

## Development

### Project Structure
```
born_edited/
├── src/
│   └── app/
│       └── page.tsx          # Main application component
├── public/                   # Static assets
├── .env.local               # Environment variables
├── vercel.json              # Vercel configuration
└── package.json             # Dependencies and scripts
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify your API keys are set correctly
3. Ensure you're using a supported browser
4. Check the [troubleshooting guide](./DEPLOYMENT.md#troubleshooting)

## Roadmap

- [ ] Multiple teleprompter themes
- [ ] Export to various video formats
- [ ] Cloud storage integration
- [ ] Collaborative features
- [ ] Mobile app version


