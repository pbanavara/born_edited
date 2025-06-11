'use client';
import React, { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    'System initialized',
    'Ready to start recording',
    'Waiting for user input...'
  ]);
  const [messages, setMessages] = useState<Array<{ text: string, sender: 'user' | 'system' }>>([
    { text: 'Welcome', sender: 'system' }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [spokenWPM, setSpokenWPM] = useState(0);
  const [chunkStartTimes, setChunkStartTimes] = useState<Map<number, number>>(new Map());
  const [transcriptBuffer, setTranscriptBuffer] = useState<Array<{ text: string, duration: number, wordCount: number }>>([]);

  //Teleprompter text
  const [teleprompterText, setTeleprompterText] = useState('');
  const [isTeleprompterActive, setIsTeleprompterActive] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(150); // WPM
  const [currentWordIndex, setCurrentWordIndex] = useState(0); // Track current word position
  const teleprompterIntervalRef = useRef<NodeJS.Timeout | null>(null);


  // Changes for recording audio
  const [recordingChunks, setRecordingChunks] = useState<Blob[]>([]);
  const [chunkInterval, setChunkInterval] = useState(5000); // 5 seconds

  // Video playback state
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string>('');

  const [whisperConfig, setWhisperConfig] = useState({
    endpoint: 'http://localhost:8080/inference',
    model: 'base',
    language: 'en',
    responseFormat: 'json'
  });

  // OpenAI Whisper API integration
  const [isWhisperActive, setIsWhisperActive] = useState(false);
  const [whisperInterval, setWhisperInterval] = useState<NodeJS.Timeout | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [chunkStartTime, setChunkStartTime] = useState<number>(0);

  // Web Speech API integration
  const [useWebSpeech, setUseWebSpeech] = useState(true); // Manual switch: true = Web Speech, false = OpenAI
  const [isWebSpeechActive, setIsWebSpeechActive] = useState(false);
  const [webSpeechRecognition, setWebSpeechRecognition] = useState<any>(null);

  useEffect(() => {
    // Auto-scroll logs to bottom
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    // Auto-scroll chat to bottom
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (teleprompterIntervalRef.current) {
        clearInterval(teleprompterIntervalRef.current);
      }
    };
  }, []);

  const startTeleprompter = (text: string) => {
    if (teleprompterIntervalRef.current) {
      clearInterval(teleprompterIntervalRef.current);
    }

    const words = text.split(' ');
    // Use preserved word index or start from beginning if new text
    const startIndex = text === teleprompterText ? currentWordIndex : 0;
    let wordIndex = startIndex;
    
    setIsTeleprompterActive(true);
    
    // If resuming, show current progress; if new text, clear logs
    if (text === teleprompterText && startIndex > 0) {
      const displayText = words.slice(0, startIndex).join(' ');
      setLogs([displayText]);
    } else {
      setLogs(prev => [...prev.slice(0, -1)]); // Clear logs for teleprompter
      setCurrentWordIndex(0); // Reset index for new text
      wordIndex = 0;
    }

    // Calculate interval: 60000ms per minute / words per minute
    const intervalMs = 60000 / teleprompterSpeed;

    teleprompterIntervalRef.current = setInterval(() => {
      if (wordIndex < words.length) {
        const displayText = words.slice(0, wordIndex + 1).join(' ');
        setLogs([displayText]);
        setCurrentWordIndex(wordIndex + 1); // Update the preserved index

        // Auto-scroll to show current text
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }

        wordIndex++;
      } else {
        // Finished
        stopTeleprompter();
      }
    }, intervalMs);
  };

  const stopTeleprompter = () => {
    if (teleprompterIntervalRef.current) {
      clearInterval(teleprompterIntervalRef.current);
      teleprompterIntervalRef.current = null;
    }
    setIsTeleprompterActive(false);
    addLog('Teleprompter paused');
  };


  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      startAudioLevelMonitoring();
      addLog('Audio analyser setup complete');
    } catch (error) {
      addLog(`Error setting up audio analyser: ${error}`);
    }
  };

  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average audio level
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(100, (average / 255) * 100);

      setAudioLevel(normalizedLevel);

      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();
  };

  const stopAudioLevelMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
  };


  const sendToWhisperCpp = async (wavBlob: Blob, chunkIndex: number, chunkStartTime: number) => {
    try {
      const formData = new FormData();
      formData.append('file', wavBlob, `chunk_${chunkIndex}_${Date.now()}.wav`);
      formData.append('model', 'base');
      formData.append('language', 'en');
      formData.append('response_format', 'json');

      console.log(`Sending chunk ${chunkIndex} to whisper.cpp...`);

      const response = await fetch('http://localhost:8080/inference', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const transcription = result.text || result.transcription || '';
        const chunkEndTime = Date.now();

        if (transcription.trim()) {
          // Calculate WPM for this chunk
          const chunkDurationMs = chunkEndTime - chunkStartTime;
          const chunkDurationMin = chunkDurationMs / (1000 * 60);
          const wordCount = transcription.trim().split(/\s+/).length;
          const chunkWPM = Math.round(wordCount / chunkDurationMin);

          console.log(`Chunk ${chunkIndex} - Words: ${wordCount}, Duration: ${chunkDurationMin.toFixed(2)}min, WPM: ${chunkWPM}`);

          // Add to transcript buffer
          setTranscriptBuffer(prev => [...prev, {
            text: transcription,
            duration: chunkDurationMin,
            wordCount: wordCount
          }]);

          // Calculate rolling average WPM (last 5 chunks)
          const recentChunks = transcriptBuffer.slice(-4).concat([{
            text: transcription,
            duration: chunkDurationMin,
            wordCount: wordCount
          }]);

          const totalWords = recentChunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
          const totalDuration = recentChunks.reduce((sum, chunk) => sum + chunk.duration, 0);
          const averageWPM = totalDuration > 0 ? Math.round(totalWords / totalDuration) : 0;

          setSpokenWPM(averageWPM);

          // Update UI
          console.log(`Current spoken WPM: ${averageWPM}`);
          addLog(`Chunk ${chunkIndex}: "${transcription}" (${chunkWPM} WPM, avg: ${averageWPM} WPM)`);

          setMessages(prev => [...prev, {
            text: `🎤 ${transcription} [${chunkWPM} WPM]`,
            sender: 'system'
          }]);

          // Update teleprompter speed based on spoken WPM
          updateTeleprompterSpeed(averageWPM);
        }
      } else {
        console.error(`Whisper.cpp error for chunk ${chunkIndex}:`, response.statusText);
      }

    } catch (error) {
      console.error(`Network error sending to whisper.cpp:`, error);
    }
  };

  const updateTeleprompterSpeed = (spokenWPM: number) => {
    if (spokenWPM > 0) {
      // Adjust teleprompter speed to match spoken rate
      // Add a small buffer (10-20 WPM faster) so teleprompter stays ahead
      const adjustedSpeed = spokenWPM + 15;
      setTeleprompterSpeed(adjustedSpeed);

      // If teleprompter is active, restart it with new speed
      if (isTeleprompterActive && teleprompterText) {
        stopTeleprompter();
        setTimeout(() => {
          startTeleprompter(teleprompterText);
        }, 100);
      }

      addLog(`Teleprompter speed adjusted to ${adjustedSpeed} WPM (spoken: ${spokenWPM} WPM)`);
    }
  };


  const convertWebMToWav = async (webmBlob: Blob): Promise<Blob> => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Convert blob to array buffer
      const arrayBuffer = await webmBlob.arrayBuffer();

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create WAV blob
      const wavBuffer = audioBufferToWavBuffer(audioBuffer);
      return new Blob([wavBuffer], { type: 'audio/wav' });

    } catch (error) {
      console.error('WAV conversion error:', error);
      throw error;
    }
  };

  const audioBufferToWavBuffer = (audioBuffer: AudioBuffer): ArrayBuffer => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // Helper function to write string to buffer
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // WAV file header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Convert audio data to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  };
  

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Setup audio analysis
      setupAudioAnalyser(stream);
      setIsListening(true);

      // Start transcription based on manual switch
      if (useWebSpeech) {
        await startWebSpeechRecognition(stream);
      } else {
        await startWhisperTranscription(stream);
      }

      addLog('Camera and microphone started successfully');
    } catch (error) {
      addLog(`Error starting camera/microphone: ${error}`);
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Stop audio monitoring
      stopAudioLevelMonitoring();
      setIsListening(false);

      // Stop transcription based on manual switch
      if (useWebSpeech) {
        stopWebSpeechRecognition();
      } else {
        stopWhisperTranscription();
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
        analyserRef.current = null;
      }

      addLog('Camera and microphone stopped');
    }
  };

  const startRecording = () => {
    if (!mediaStream) {
      addLog('No media stream available');
      return;
    }

    const mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: 'video/webm;codecs=vp9,opus'
    });
    mediaRecorderRef.current = mediaRecorder;

    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
        setRecordingChunks(prev => [...prev, event.data]);
        addLog(`Chunk recorded: ${Math.round(event.data.size / 1024)} KB`);
        const chunkIndex = chunks.length;

        const chunkStartTime = Date.now();
        // Store when this chunk started
        setChunkStartTimes(prev => new Map(prev).set(chunkIndex, chunkStartTime));

        try {
          // Convert WebM chunk to WAV
          console.log(`Converting chunk ${chunkIndex} to WAV...`);
          const wavBlob = await convertWebMToWav(event.data);
          console.log(`WAV conversion complete: ${Math.round(wavBlob.size / 1024)} KB`);

          // Send to whisper.cpp
          await sendToWhisperCpp(wavBlob, chunkIndex, chunkStartTime);

        } catch (error) {
          console.error(`Error processing chunk ${chunkIndex}:`, error);
        }
      }
    };

    mediaRecorder.onstop = () => {
      setRecordedChunks(chunks);
      addLog(`Recording stopped. Recorded ${chunks.length} chunks`);

      // Create download link for recorded video
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      addLog(`Recording available for download: ${Math.round(blob.size / 1024)} KB`);
    };

    mediaRecorder.start(chunkInterval); // Record in 1-second chunks
    setIsRecording(true);
    addLog('Recording started (video + audio)');
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };


  const downloadRecording = () => {
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${new Date().toISOString().slice(0, 19)}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog('Recording downloaded');
    }
  };

  const viewRecording = () => {
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      setIsPlayingRecording(true);
      addLog('Recording playback started');
    } else {
      addLog('No recording available to view');
    }
  };

  const stopPlayback = () => {
    setIsPlayingRecording(false);
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl('');
    }
    addLog('Recording playback stopped');
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const sendMessage = () => {
    if (currentMessage.trim()) {
      setMessages(prev => [...prev, { text: currentMessage, sender: 'user' }]);
      
      // If this is new text, reset the word index
      if (currentMessage !== teleprompterText) {
        setCurrentWordIndex(0);
      }
      
      setTeleprompterText(currentMessage);
      startTeleprompter(currentMessage);
      setCurrentMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // OpenAI Whisper API functions
  const startWhisperTranscription = async (stream: MediaStream) => {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      addLog('OpenAI API key not found in environment variables. Please check your .env.local file.');
      return;
    }

    console.log('OpenAI API Key found:', apiKey.substring(0, 10) + '...');

    try {
      setIsWhisperActive(true);
      setChunkStartTime(Date.now());
      setAudioChunks([]);

      // Extract only audio tracks from the full stream
      const audioStream = new MediaStream(stream.getAudioTracks());
      console.log('Audio tracks extracted:', audioStream.getTracks().length);
      console.log('Original stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
      console.log('Audio stream tracks:', audioStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));

      // Create MediaRecorder for audio chunks
      let mediaRecorder: MediaRecorder = new MediaRecorder(audioStream); // Default fallback
      
      // Try different audio formats for compatibility
      const audioFormats = [
        'audio/webm;codecs=opus',
      ];

      for (const format of audioFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          try {
            mediaRecorder = new MediaRecorder(audioStream, { mimeType: format });
            console.log('Using audio format:', format);
            break;
          } catch (e) {
            console.warn('Failed to create MediaRecorder with format:', format, e);
          }
        }
      }

      // Verify MediaRecorder is audio-only
      console.log('MediaRecorder details:', {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state,
        audioTracks: audioStream.getAudioTracks().length,
        videoTracks: audioStream.getVideoTracks().length
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
          
          // Process chunk for transcription
          await processAudioChunk(event.data);
        }
      };

      // Start recording in 3-second chunks
      mediaRecorder.start(3000);
      addLog('OpenAI Whisper transcription started (3s chunks)');

      // Store mediaRecorder reference for cleanup
      (window as any).whisperMediaRecorder = mediaRecorder;

    } catch (error) {
      console.error('Error starting Whisper transcription:', error);
      addLog(`Error starting Whisper: ${error}`);
    }
  };

  const stopWhisperTranscription = () => {
    if ((window as any).whisperMediaRecorder) {
      (window as any).whisperMediaRecorder.stop();
      (window as any).whisperMediaRecorder = null;
    }
    setIsWhisperActive(false);
    setAudioChunks([]);
    addLog('OpenAI Whisper transcription stopped');
  };

  const processAudioChunk = async (audioBlob: Blob) => {
    try {
      // Verify this is actually audio data
      if (!audioBlob.type.startsWith('audio/')) {
        console.warn('Skipping non-audio blob:', audioBlob.type);
        addLog(`Warning: Skipping non-audio data (${audioBlob.type})`);
        return;
      }

      // Determine file extension based on MIME type
      let fileExtension = 'webm';
      if (audioBlob.type.includes('mp4')) {
        fileExtension = 'mp4';
      } else if (audioBlob.type.includes('ogg')) {
        fileExtension = 'ogg';
      }
      
      //const audioFile = new Blob([audioBlob], { type: audioBlob.type });
      const audioFile = new File([audioBlob], 'chunk.webm', { type: 'audio/webm' });
      
      // Verify this is actually audio data
      console.log('Audio chunk details:', {
        originalBlobType: audioBlob.type,
        originalBlobSize: audioBlob.size,
        fileType: audioFile.type,
        fileSize: audioFile.size,
        extension: fileExtension,
        isAudio: audioBlob.type.startsWith('audio/'),
        hasVideo: audioBlob.type.includes('video')
      });

      const formData = new FormData();
      formData.append('file', audioFile, `audio.${fileExtension}`);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');

      console.log('Sending audio chunk to OpenAI:', {
        size: audioFile.size,
        type: audioFile.type,
        extension: fileExtension,
        duration: '3s'
      });

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        const transcription = result.text || '';
        
        if (transcription.trim()) {
          const chunkEndTime = Date.now();
          const chunkDurationMs = chunkEndTime - chunkStartTime;
          const chunkDurationMin = chunkDurationMs / (1000 * 60);
          const wordCount = transcription.trim().split(/\s+/).length;
          const chunkWPM = Math.round(wordCount / chunkDurationMin);

          console.log(`Whisper chunk - Words: ${wordCount}, Duration: ${chunkDurationMin.toFixed(2)}min, WPM: ${chunkWPM}`);

          // Update spoken WPM
          setSpokenWPM(chunkWPM);

          // Update teleprompter speed
          updateTeleprompterSpeed(chunkWPM);

          // Add to messages
          setMessages(prev => [...prev, {
            text: `🎤 ${transcription} [${chunkWPM} WPM]`,
            sender: 'system'
          }]);

          addLog(`Whisper: "${transcription}" (${chunkWPM} WPM)`);
        }

        // Reset for next chunk
        setChunkStartTime(Date.now());
      } else {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        addLog(`OpenAI API error ${response.status}: ${errorText}`);
      }

    } catch (error) {
      console.error('Error processing audio chunk:', error);
      addLog(`Whisper processing error: ${error}`);
    }
  };

  // Web Speech API functions
  const startWebSpeechRecognition = async (stream: MediaStream) => {
    try {
      // Check if Web Speech API is supported
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        addLog('Web Speech API not supported in this browser');
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      // Configure recognition
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      let startTime = Date.now();
      let wordCount = 0;
      let lastTranscription = '';

      recognition.onstart = () => {
        setIsWebSpeechActive(true);
        startTime = Date.now();
        wordCount = 0;
        addLog('Web Speech API started');
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Process final results
        if (finalTranscript && finalTranscript !== lastTranscription) {
          const currentTime = Date.now();
          const durationMs = currentTime - startTime;
          const durationMin = durationMs / (1000 * 60);
          
          // Count new words
          const newWords = finalTranscript.trim().split(/\s+/).length;
          wordCount += newWords;
          
          const wpm = Math.round(wordCount / durationMin);

          console.log(`Web Speech - Words: ${newWords}, Total: ${wordCount}, Duration: ${durationMin.toFixed(2)}min, WPM: ${wpm}`);

          // Update spoken WPM
          setSpokenWPM(wpm);

          // Update teleprompter speed
          updateTeleprompterSpeed(wpm);

          // Add to messages
          setMessages(prev => [...prev, {
            text: `🎤 ${finalTranscript} [${wpm} WPM]`,
            sender: 'system'
          }]);

          addLog(`Web Speech: "${finalTranscript}" (${wpm} WPM)`);
          
          lastTranscription = finalTranscript;
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Web Speech API error:', event.error);
        addLog(`Web Speech API error: ${event.error}`);
        
        // Auto-restart on network errors
        if (event.error === 'network') {
          setTimeout(() => {
            if (isWebSpeechActive) {
              addLog('Restarting Web Speech API after network error...');
              recognition.start();
            }
          }, 1000);
        }
      };

      recognition.onend = () => {
        setIsWebSpeechActive(false);
        addLog('Web Speech API ended');
        
        // Auto-restart if still active
        if (isWebSpeechActive) {
          setTimeout(() => {
            addLog('Restarting Web Speech API...');
            recognition.start();
          }, 100);
        }
      };

      setWebSpeechRecognition(recognition);
      recognition.start();

    } catch (error) {
      console.error('Error starting Web Speech API:', error);
      addLog(`Error starting Web Speech API: ${error}`);
    }
  };

  const stopWebSpeechRecognition = () => {
    if (webSpeechRecognition) {
      webSpeechRecognition.stop();
      setWebSpeechRecognition(null);
    }
    setIsWebSpeechActive(false);
    addLog('Web Speech API stopped');
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6 text-white">
          Born Edited
        </h1>

        {/* Teleprompter Display - Centered below title */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-black bg-opacity-75 rounded-lg p-4 border border-gray-600">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-white drop-shadow-lg">
                Teleprompter
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-xs text-white drop-shadow-lg">Speed:</label>
                <input
                  type="number"
                  value={teleprompterSpeed}
                  onChange={(e) => setTeleprompterSpeed(Number(e.target.value))}
                  className="w-12 px-1 py-1 border border-gray-400 rounded text-xs text-white bg-black bg-opacity-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="30"
                  max="200"
                  disabled={isTeleprompterActive}
                />
                <span className="text-xs text-white drop-shadow-lg">WPM</span>
                {isTeleprompterActive && (
                  <button
                    onClick={stopTeleprompter}
                    className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                  >
                    Pause
                  </button>
                )}
                {!isTeleprompterActive && teleprompterText && currentWordIndex > 0 && (
                  <button
                    onClick={() => startTeleprompter(teleprompterText)}
                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                  >
                    Resume
                  </button>
                )}
              </div>
            </div>

            <div
              ref={logContainerRef}
              className={`h-16 overflow-y-auto p-3 rounded border border-gray-600 ${isTeleprompterActive
                ? 'text-green-400 font-mono text-lg leading-relaxed drop-shadow-lg bg-black bg-opacity-50'
                : 'font-mono text-sm text-white drop-shadow-lg bg-gray-900 bg-opacity-75'
                }`}
            >
              {isTeleprompterActive ? (
                <div className="whitespace-pre-wrap">
                  {logs[0] || ''}
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-10px)]">
          {/* Left Side */}
          <div className="space-y-2 lg:col-span-2">
            {/* Video/Camera Interface */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-4 h-2/3 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-white">Camera & Recording</h2>

              <div className="relative bg-black rounded-lg mb-2 h-[80%]">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full h-full object-cover rounded-lg"
                />
                {!mediaStream && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <span>Camera not started</span>
                  </div>
                )}
              </div>

              {/* Recording Playback Area */}
              {isPlayingRecording && recordingUrl && (
                <div className="relative bg-black rounded-lg mb-2 h-64">
                  <video
                    src={recordingUrl}
                    controls
                    autoPlay
                    className="w-full h-full object-contain rounded-lg"
                    onEnded={stopPlayback}
                  />
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={stopPlayback}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={mediaStream ? stopCamera : startCamera}
                  className={`px-4 py-2 text-white rounded transition-colors flex items-center gap-2 ${
                    mediaStream 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {mediaStream ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                      Stop Camera
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Start Camera
                    </>
                  )}
                </button>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={!mediaStream}
                  className={`px-6 py-2 rounded-full transition-colors flex items-center gap-2 ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600 disabled:text-gray-400'
                  }`}
                >
                  {isRecording ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                  {isRecording ? 'Stop' : 'Record'}
                </button>
                {recordedChunks.length > 0 && (
                  <button
                    onClick={isPlayingRecording ? stopPlayback : viewRecording}
                    className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                      isPlayingRecording 
                        ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {isPlayingRecording ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {isPlayingRecording ? 'Stop Playback' : 'View Recording'}
                  </button>
                )}
              </div>

              {/* Status Indicators */}
              <div className="space-y-2">
                {isListening && !isRecording && (
                  <div className="flex items-center text-green-400">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-2"></div>
                    Listening... (Audio Level: {Math.round(audioLevel)}%)
                  </div>
                )}
                {isWhisperActive && (
                  <div className="flex items-center text-blue-400">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                    OpenAI Whisper Active - Detecting WPM
                  </div>
                )}
                {isWebSpeechActive && (
                  <div className="flex items-center text-purple-400">
                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse mr-2"></div>
                    Web Speech API Active - Detecting WPM
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* WPM Display */}
          {/* WPM Display - Small and scrollable */}


          {/* Right Side - Chat Interface */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 flex flex-col border border-gray-700 h-2/3 lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4 text-white">Script Interface</h2>

            {/* Chat Messages - Fixed Height with Scroll */}
            <div
              ref={chatContainerRef}
              className="overflow-y-auto bg-gray-900 p-4 rounded border border-gray-600 mb-4 space-y-3"
              style={{ height: '400px' }}
            >
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                      }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area - Fixed Height */}
            <div className="flex gap-2" style={{ height: '150px' }}>
              <textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter your script here..."
                className="flex-1 p-3 border border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-white bg-gray-700 placeholder-gray-400"
                style={{ 
                  height: '150px',
                  scrollBehavior: 'smooth',
                  overflowY: 'auto'
                }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={sendMessage}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 self-end transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}