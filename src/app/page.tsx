'use client';
import React, { useState, useRef, useEffect } from 'react';
import HeroSection from '../components/HeroSection';
import TeleprompterInterface from '../components/TeleprompterInterface';
import CameraInterface from '../components/CameraInterface';
import DeckViewer from '../components/DeckViewer';
import { TranscriptResult } from '../lib/openai';

// Local type for SpeechRecognitionEvent (for browser compatibility)
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: Array<{ 0: { transcript: string }; isFinal: boolean }>;
};

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    `Teleprompter default speed: ${150} WPM`,
  ]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Teleprompter text
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(150); // WPM
  const teleprompterIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Video playback state
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string>('');

  // OpenAI Whisper API integration
  const [isWhisperActive, setIsWhisperActive] = useState(false);
  const [chunkStartTime, setChunkStartTime] = useState<number>(0);

  // Web Speech API integration
  const [useWebSpeech] = useState(true); // Manual switch: true = Web Speech, false = OpenAI
  const [isWebSpeechActive, setIsWebSpeechActive] = useState(false);
  const [webSpeechRecognition, setWebSpeechRecognition] = useState<unknown>(null);

  // Pitch deck and transcript state
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null);
  const [currentTranscriptPosition, setCurrentTranscriptPosition] = useState(0);
  const [isTeleprompterActive, setIsTeleprompterActive] = useState(false);

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
  }, []);

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

  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`Whisper.cpp result for chunk ${chunkIndex}:`, result);

      if (result.text && result.text.trim()) {
        const transcript = result.text.trim();
        const endTime = Date.now();
        const duration = (endTime - chunkStartTime) / 1000; // Convert to seconds
        const words = transcript.split(' ').length;
        const wpm = Math.round((words / duration) * 60);

        addLog(`Chunk ${chunkIndex}: "${transcript}" (${wpm} WPM)`);
        updateTeleprompterSpeed(wpm);
      }
    } catch (error) {
      console.error(`Error processing chunk ${chunkIndex}:`, error);
      addLog(`Error processing chunk ${chunkIndex}: ${error}`);
    }
  };

  const updateTeleprompterSpeed = (spokenWPM: number) => {
    // Adjust teleprompter speed based on spoken WPM
    const newSpeed = Math.max(30, Math.min(200, spokenWPM));
    setTeleprompterSpeed(newSpeed);
    addLog(`Teleprompter speed adjusted to ${newSpeed} WPM`);
  };

  const convertWebMToWav = async (webmBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const wavBuffer = audioBufferToWavBuffer(audioBuffer);
          const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
          resolve(wavBlob);
        } catch (error) {
          reject(error);
        }
      };

      fileReader.onerror = reject;
      fileReader.readAsArrayBuffer(webmBlob);
    });
  };

  const audioBufferToWavBuffer = (audioBuffer: AudioBuffer): ArrayBuffer => {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // WAV header
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

    // Convert audio data
    const channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setupAudioAnalyser(stream);
      addLog('Camera started successfully');

      // Start speech recognition
      if (useWebSpeech) {
        startWebSpeechRecognition();
      } else {
        startWhisperTranscription(stream);
      }
    } catch (error) {
      addLog(`Error starting camera: ${error}`);
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    stopAudioLevelMonitoring();
    stopWhisperTranscription();
    stopWebSpeechRecognition();
    setIsListening(false);
    addLog('Camera stopped');
  };

  const startRecording = () => {
    if (!mediaStream) {
      addLog('No media stream available');
      return;
    }

    try {
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus'
      };

      const mediaRecorder = new MediaRecorder(mediaStream, options);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        setRecordedChunks(chunks);
        addLog('Recording completed');
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      addLog('Recording started');
    } catch (error) {
      addLog(`Error starting recording: ${error}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      addLog('Recording stopped');
    }
  };

  const viewRecording = () => {
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      setIsPlayingRecording(true);
    }
  };

  const stopPlayback = () => {
    setIsPlayingRecording(false);
    setRecordingUrl('');
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const startWhisperTranscription = async (stream: MediaStream) => {
    try {
      setIsWhisperActive(true);
      addLog('OpenAI Whisper transcription started');

      const audioStream = stream.getAudioTracks()[0];
      if (!audioStream) {
        throw new Error('No audio track available');
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      let chunkIndex = 0;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          
          // Process chunks every 3 seconds
          if (chunks.length >= 3) {
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            const chunkStartTime = Date.now();
            
            try {
              const wavBlob = await convertWebMToWav(audioBlob);
              await sendToWhisperCpp(wavBlob, chunkIndex, chunkStartTime);
              chunkIndex++;
            } catch (error) {
              console.error('Error processing audio chunk:', error);
            }
            
            chunks.length = 0; // Clear the array
          }
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      addLog('Audio recording for Whisper started');

    } catch (error) {
      addLog(`Error starting Whisper transcription: ${error}`);
      setIsWhisperActive(false);
    }
  };

  const stopWhisperTranscription = () => {
    setIsWhisperActive(false);
    addLog('OpenAI Whisper transcription stopped');
  };

  const startWebSpeechRecognition = async () => {
    try {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        addLog('Web Speech API not supported in this browser');
        return;
      }

      const SpeechRecognition = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || 
                               (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
      const recognition = new (SpeechRecognition as new () => unknown)() as {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onstart: () => void;
        onresult: (event: SpeechRecognitionEvent) => void;
        onerror: (event: { error: string }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsWebSpeechActive(true);
        setIsListening(true);
        addLog('Web Speech API started');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }

        if (finalTranscript) {
          const words = finalTranscript.trim().split(' ').length;
          const endTime = Date.now();
          const duration = (endTime - chunkStartTime) / 1000;
          const wpm = Math.round((words / duration) * 60);

          addLog(`Web Speech: "${finalTranscript.trim()}" (${wpm} WPM)`);
          updateTeleprompterSpeed(wpm);
          setChunkStartTime(endTime);
        }
      };

      recognition.onerror = (event: { error: string }) => {
        console.error('Speech recognition error:', event.error);
        addLog(`Speech recognition error: ${event.error}`);
        
        // Auto-restart on certain errors
        if (['no-speech', 'audio-capture', 'network'].includes(event.error)) {
          setTimeout(() => {
            if (mediaStream) {
              recognition.start();
            }
          }, 1000);
        }
      };

      recognition.onend = () => {
        setIsWebSpeechActive(false);
        setIsListening(false);
        addLog('Web Speech API ended');
        
        // Auto-restart if camera is still active
        if (mediaStream) {
          setTimeout(() => {
            recognition.start();
          }, 1000);
        }
      };

      setWebSpeechRecognition(recognition);
      recognition.start();
      setChunkStartTime(Date.now());

    } catch (error) {
      addLog(`Error starting Web Speech API: ${error}`);
    }
  };

  const stopWebSpeechRecognition = () => {
    if (webSpeechRecognition) {
      (webSpeechRecognition as { stop: () => void }).stop();
      setIsWebSpeechActive(false);
      setIsListening(false);
      addLog('Web Speech API stopped');
    }
  };

  const handleStartRecording = () => {
    document.getElementById('teleprompter-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTranscriptGenerated = (result: TranscriptResult) => {
    setTranscriptResult(result);
    setLogs([`Transcript generated with ${result.slideMarkers.length} slides`]);
    addLog(`Ready to present: ${result.slideMarkers.length} slides loaded`);
  };

  const handleError = (error: string) => {
    addLog(`Error: ${error}`);
  };

  const startTeleprompter = () => {
    if (!transcriptResult) {
      addLog('No transcript available. Please upload a pitch deck first.');
      return;
    }

    setIsTeleprompterActive(true);
    setCurrentTranscriptPosition(0);
    addLog('Starting teleprompter presentation...');
  };

  const stopTeleprompter = () => {
    setIsTeleprompterActive(false);
    addLog('Teleprompter stopped');
  };

  const updateTeleprompterDisplay = () => {
    if (!transcriptResult || !isTeleprompterActive) return;

    // Calculate how much text to show based on current position
    const displayText = transcriptResult.transcript.substring(0, currentTranscriptPosition);
    setLogs([displayText]);

    // Auto-scroll to show current text
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  // Auto-advance transcript based on teleprompter speed
  useEffect(() => {
    if (!isTeleprompterActive || !transcriptResult) return;

    const intervalMs = 60000 / teleprompterSpeed; // Convert WPM to milliseconds per word
    const wordsPerInterval = 1; // Advance by 1 word at a time
    const charsPerWord = 5; // Average characters per word
    const charsPerInterval = wordsPerInterval * charsPerWord;

    const interval = setInterval(() => {
      setCurrentTranscriptPosition(prev => {
        const newPosition = prev + charsPerInterval;
        if (newPosition >= transcriptResult.transcript.length) {
          stopTeleprompter();
          return transcriptResult.transcript.length;
        }
        return newPosition;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isTeleprompterActive, teleprompterSpeed, transcriptResult]);

  // Update teleprompter display when position changes
  useEffect(() => {
    updateTeleprompterDisplay();
  }, [currentTranscriptPosition, isTeleprompterActive, transcriptResult]);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section - First Fold */}
      <HeroSection onStartRecording={handleStartRecording} />

      {/* Teleprompter Interface - Second Fold */}
      <div id="teleprompter-section" className="min-h-screen bg-gray-900">
        <TeleprompterInterface
          teleprompterSpeed={teleprompterSpeed}
          onSpeedChange={setTeleprompterSpeed}
          logs={logs}
          logContainerRef={logContainerRef}
        />

        {/* Teleprompter Controls */}
        <div className="bg-gray-900 p-4 text-center">
          {transcriptResult ? (
            <div className="space-x-4">
              <button
                onClick={startTeleprompter}
                disabled={isTeleprompterActive}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md transition-colors"
              >
                Start Presentation
              </button>
              <button
                onClick={stopTeleprompter}
                disabled={!isTeleprompterActive}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md transition-colors"
              >
                Stop Presentation
              </button>
            </div>
          ) : (
            <p className="text-gray-400">Upload a pitch deck to start presenting</p>
          )}
        </div>
      </div>

      {/* Camera and Deck Viewer Section - Side by Side */}
      <div className="bg-gray-900 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera Interface */}
          <div>
            <CameraInterface
              mediaStream={mediaStream}
              isRecording={isRecording}
              isPlayingRecording={isPlayingRecording}
              recordingUrl={recordingUrl}
              recordedChunks={recordedChunks}
              isListening={isListening}
              isWhisperActive={isWhisperActive}
              isWebSpeechActive={isWebSpeechActive}
              audioLevel={audioLevel}
              videoRef={videoRef}
              startCamera={startCamera}
              stopCamera={stopCamera}
              startRecording={startRecording}
              stopRecording={stopRecording}
              viewRecording={viewRecording}
              stopPlayback={stopPlayback}
              onTranscriptGenerated={handleTranscriptGenerated}
              onError={handleError}
            />
          </div>

          {/* Deck Viewer */}
          <div>
            {transcriptResult ? (
              <DeckViewer
                slideMarkers={transcriptResult.slideMarkers}
                currentPosition={currentTranscriptPosition}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-6 h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p className="text-lg font-medium mb-2">No Presentation Loaded</p>
                  <p className="text-sm">Upload a pitch deck in the camera interface to view slides here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}