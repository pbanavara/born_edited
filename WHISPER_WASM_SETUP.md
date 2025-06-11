# Whisper.wasm Setup Guide

## Overview

Whisper.wasm is a WebAssembly port of OpenAI's Whisper model that runs entirely in the browser. It provides offline transcription capabilities with privacy benefits, but comes with performance trade-offs.

## Performance Summary

**❌ Whisper.wasm is NOT faster than OpenAI Whisper API**

| Metric | OpenAI API | Whisper.wasm | Winner |
|--------|------------|--------------|---------|
| **Latency** | 200-500ms | 1-3 seconds | OpenAI |
| **Initial Load** | 0 seconds | 15-30 seconds | OpenAI |
| **Memory Usage** | 0MB | 100-200MB | OpenAI |
| **Cost** | $0.006/min | Free | Whisper.wasm |
| **Privacy** | Data sent to server | Completely local | Whisper.wasm |
| **Offline** | No | Yes | Whisper.wasm |

## Installation

### 1. Install Dependencies
```bash
npm install @xenova/transformers
```

### 2. Add to package.json
```json
{
  "dependencies": {
    "@xenova/transformers": "^2.15.0"
  }
}
```

### 3. Configure Next.js (if needed)
Add to `next.config.ts`:
```typescript
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
};
```

## Usage in Your App

### 1. Select Whisper.wasm Provider
In the application dropdown, select "Whisper.wasm (Offline)"

### 2. Initial Model Loading
- First time: 15-30 seconds to download model (150MB+)
- Subsequent loads: 5-10 seconds (cached)
- Progress indicator shows loading status

### 3. Transcription
- Processing time: 1-3 seconds per chunk
- No internet required after initial load
- Audio never leaves your device

## Performance Characteristics

### Model Sizes
- **Base model**: ~150MB
- **Small model**: ~75MB (faster, less accurate)
- **Medium model**: ~500MB (slower, more accurate)

### Browser Requirements
- **WebAssembly support** required
- **Modern browsers** (Chrome 57+, Firefox 52+, Safari 11+)
- **Sufficient memory** (2GB+ recommended)

### Memory Usage
- **Model loading**: 100-200MB
- **Processing**: Additional 50-100MB
- **Total**: 150-300MB during transcription

## Troubleshooting

### Common Issues

#### 1. Model Loading Fails
```javascript
// Error: Failed to load model
```
**Solutions:**
- Check internet connection for initial download
- Clear browser cache and retry
- Try different browser
- Check browser console for errors

#### 2. Out of Memory
```javascript
// Error: Out of memory
```
**Solutions:**
- Close other browser tabs
- Restart browser
- Use smaller model (base instead of medium)
- Reduce chunk size

#### 3. Slow Performance
```javascript
// Very slow transcription
```
**Solutions:**
- Use smaller model
- Reduce audio quality
- Check browser performance
- Consider hosted alternatives

### Browser Compatibility

| Browser | Version | Support | Notes |
|---------|---------|---------|-------|
| **Chrome** | 57+ | ✅ Full | Best performance |
| **Firefox** | 52+ | ✅ Full | Good performance |
| **Safari** | 11+ | ✅ Full | Slower than Chrome |
| **Edge** | 79+ | ✅ Full | Good performance |
| **Mobile** | Varies | ⚠️ Limited | May be very slow |

## When to Use Whisper.wasm

### ✅ Good Use Cases
- **Privacy-critical applications** (medical, legal, confidential)
- **Offline requirements** (no internet after deployment)
- **Cost-sensitive projects** (free transcription)
- **Development/testing** (no API keys needed)
- **Educational projects** (learning WebAssembly)

### ❌ Poor Use Cases
- **Real-time applications** (teleprompter, live streaming)
- **High-volume transcription** (performance bottleneck)
- **Mobile applications** (memory constraints)
- **Production systems** requiring low latency
- **Applications with internet connectivity**

## Alternatives for Better Performance

### For Privacy + Better Performance
1. **Local whisper.cpp** - Faster than wasm, still private
2. **Self-hosted Whisper** - Full control, better hardware
3. **Hybrid approach** - Use hosted for speed, wasm for privacy

### For Best Performance
1. **OpenAI Whisper API** - Fastest overall
2. **AssemblyAI** - Good for real-time
3. **Deepgram** - Best cost/performance ratio

## Cost-Benefit Analysis

### Whisper.wasm Costs
- **Development time**: High (complex setup)
- **User experience**: Poor (long loading times)
- **Performance**: Poor (1-3s latency)
- **Maintenance**: Medium (browser compatibility)

### Whisper.wasm Benefits
- **Privacy**: Perfect (no data leaves device)
- **Cost**: Free (no API charges)
- **Offline**: Yes (after initial load)
- **Control**: Full (no external dependencies)

## Conclusion

**Whisper.wasm is NOT faster than OpenAI Whisper API.** It's 3-6x slower but provides privacy and offline benefits.

**Recommendation**: Use Whisper.wasm only when privacy/offline requirements outweigh performance needs. For most applications, hosted providers offer better user experience. 