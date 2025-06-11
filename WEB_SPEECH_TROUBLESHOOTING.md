# Web Speech API Troubleshooting Guide

## 🚨 **Network Error Solutions**

The "network" error in Web Speech API is common and can occur even with an active internet connection. Here are the solutions:

## 🔧 **Immediate Fixes**

### **1. Browser-Specific Solutions**

#### **Chrome/Edge:**
```javascript
// Add these settings to prevent network errors
recognition.maxAlternatives = 1;
recognition.serviceURI = ''; // Use default service
recognition.continuous = true;
recognition.interimResults = true;
```

#### **Firefox:**
```javascript
// Firefox requires HTTPS for Web Speech API
// Ensure you're running on https:// or localhost
```

#### **Safari:**
```javascript
// Safari has limited Web Speech API support
// Consider using a different browser for testing
```

### **2. Auto-Restart Implementation**

```javascript
recognition.onerror = (event) => {
  if (event.error === 'network') {
    console.log('Network error detected - auto-restarting...');
    setTimeout(() => {
      if (isListening) {
        recognition.start();
      }
    }, 2000);
  }
};
```

## 🌐 **Network Error Causes & Solutions**

### **Cause 1: HTTPS Requirement**
**Problem**: Web Speech API requires HTTPS in production
**Solution**: 
- Use `localhost` for development
- Deploy to HTTPS for production
- Use `http://localhost:3000` for local testing

### **Cause 2: Browser Security Settings**
**Problem**: Browser blocks speech recognition service
**Solution**:
1. Check browser settings for speech recognition
2. Allow microphone permissions
3. Disable ad blockers temporarily
4. Check privacy settings

### **Cause 3: Network Connectivity Issues**
**Problem**: Intermittent network connectivity
**Solution**:
```javascript
// Implement retry logic
let retryCount = 0;
const maxRetries = 3;

recognition.onerror = (event) => {
  if (event.error === 'network' && retryCount < maxRetries) {
    retryCount++;
    setTimeout(() => {
      recognition.start();
    }, 2000 * retryCount); // Exponential backoff
  }
};
```

### **Cause 4: Service Availability**
**Problem**: Speech recognition service temporarily unavailable
**Solution**:
```javascript
// Fallback to different language/locale
const fallbackLanguages = ['en-US', 'en-GB', 'en'];
let currentLanguageIndex = 0;

recognition.onerror = (event) => {
  if (event.error === 'network') {
    currentLanguageIndex = (currentLanguageIndex + 1) % fallbackLanguages.length;
    recognition.lang = fallbackLanguages[currentLanguageIndex];
    setTimeout(() => recognition.start(), 1000);
  }
};
```

## 🛠️ **Debugging Steps**

### **Step 1: Check Browser Support**
```javascript
// Test if Web Speech API is available
if (typeof window !== 'undefined') {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    console.log('Web Speech API supported');
  } else {
    console.log('Web Speech API not supported');
  }
}
```

### **Step 2: Check Microphone Permissions**
```javascript
// Test microphone access
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('Microphone access granted'))
  .catch(err => console.log('Microphone access denied:', err));
```

### **Step 3: Check Network Connectivity**
```javascript
// Test basic network connectivity
fetch('https://www.google.com', { mode: 'no-cors' })
  .then(() => console.log('Network connectivity OK'))
  .catch(() => console.log('Network connectivity issues'));
```

## 🔄 **Alternative Implementations**

### **1. Robust Web Speech API Implementation**
```javascript
class RobustSpeechRecognition {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;
      
      this.setupEventHandlers();
    }
  }

  setupEventHandlers() {
    this.recognition.onerror = (event) => {
      this.handleError(event.error);
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        this.restart();
      }
    };
  }

  handleError(error) {
    switch (error) {
      case 'network':
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          setTimeout(() => this.restart(), 2000 * this.retryCount);
        }
        break;
      case 'not-allowed':
        console.log('Microphone permission denied');
        break;
      default:
        console.log('Speech recognition error:', error);
    }
  }

  restart() {
    try {
      this.recognition.start();
    } catch (e) {
      console.log('Failed to restart speech recognition');
    }
  }

  start() {
    this.isListening = true;
    this.retryCount = 0;
    this.restart();
  }

  stop() {
    this.isListening = false;
    this.recognition.stop();
  }
}
```

### **2. Fallback to Audio Analysis**
```javascript
// If Web Speech API fails, use audio analysis for WPM estimation
class AudioWPMDetector {
  constructor() {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.isListening = false;
  }

  async start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
      
      this.analyser.fftSize = 2048;
      this.isListening = true;
      this.analyzeAudio();
    } catch (error) {
      console.log('Audio analysis failed:', error);
    }
  }

  analyzeAudio() {
    if (!this.isListening) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Simple speech rate estimation based on audio patterns
    const speechLevel = this.calculateSpeechLevel(dataArray);
    const estimatedWPM = this.estimateWPM(speechLevel);

    // Update teleprompter speed
    this.updateTeleprompterSpeed(estimatedWPM);

    requestAnimationFrame(() => this.analyzeAudio());
  }

  calculateSpeechLevel(dataArray) {
    return dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
  }

  estimateWPM(speechLevel) {
    // Rough estimation - can be calibrated
    return Math.round(speechLevel / 2);
  }
}
```

## 🧪 **Testing Checklist**

### **Before Testing:**
- [ ] Use HTTPS or localhost
- [ ] Allow microphone permissions
- [ ] Disable ad blockers
- [ ] Check browser console for errors
- [ ] Ensure stable internet connection

### **During Testing:**
- [ ] Speak clearly and consistently
- [ ] Monitor browser console for errors
- [ ] Check network tab for failed requests
- [ ] Test with different browsers

### **If Still Failing:**
- [ ] Try different browser (Chrome recommended)
- [ ] Check firewall/antivirus settings
- [ ] Test on different network
- [ ] Use fallback audio analysis method

## 🎯 **Quick Fix for Your Current Issue**

1. **Clear browser cache and cookies**
2. **Restart browser**
3. **Allow microphone permissions**
4. **Try in Chrome/Edge (best support)**
5. **Use localhost for testing**

The auto-restart logic I added should handle most network errors automatically. If the issue persists, try the fallback audio analysis method for WPM detection. 