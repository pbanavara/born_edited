'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function Home() {
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
    { text: 'Welcome to the VLA Pipeline Interface', sender: 'system' }
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
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(60); // WPM
  const teleprompterIntervalRef = useRef<NodeJS.Timeout | null>(null);


  // Changes for recording audio
  const [recordingChunks, setRecordingChunks] = useState<Blob[]>([]);
  const [chunkInterval, setChunkInterval] = useState(5000); // 5 seconds

  const [whisperConfig, setWhisperConfig] = useState({
    endpoint: 'http://localhost:8080/inference',
    model: 'base',
    language: 'en',
    responseFormat: 'json'
  });

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
    let currentWordIndex = 0;
    setIsTeleprompterActive(true);
    setLogs(prev => [...prev.slice(0, -1)]); // Clear logs for teleprompter

    // Calculate interval: 60000ms per minute / words per minute
    const intervalMs = 60000 / teleprompterSpeed;

    teleprompterIntervalRef.current = setInterval(() => {
      if (currentWordIndex < words.length) {
        const displayText = words.slice(0, currentWordIndex + 1).join(' ');
        setLogs([displayText]);

        // Auto-scroll to show current text
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }

        currentWordIndex++;
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
    addLog('Teleprompter stopped');
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

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const sendMessage = () => {
    if (currentMessage.trim()) {
      setMessages(prev => [...prev, { text: currentMessage, sender: 'user' }]);
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

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          Born Edited
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-120px)]">
          {/* Left Side */}
          <div className="space-y-4">
            {/* Video/Camera Interface */}
            <div className="bg-white rounded-lg shadow-lg p-4 h-2/3">
              <h2 className="text-xl font-semibold mb-4">Camera & Recording</h2>

              <div className="relative bg-black rounded-lg mb-4 h-64">
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

                {/* Audio Level Indicator */}
                {isListening && (
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded p-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="text-white text-sm">Audio</div>
                      <div className="w-20 h-2 bg-gray-600 rounded">
                        <div
                          className="h-full bg-green-500 rounded transition-all duration-100"
                          style={{ width: `${audioLevel}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={startCamera}
                  disabled={!!mediaStream}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  Start Camera
                </button>
                <button
                  onClick={stopCamera}
                  disabled={!mediaStream}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
                >
                  Stop Camera
                </button>
                <button
                  onClick={startRecording}
                  disabled={!mediaStream || isRecording}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
                >
                  Start Recording
                </button>
                <button
                  onClick={stopRecording}
                  disabled={!isRecording}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400"
                >
                  Stop Recording
                </button>
                {recordedChunks.length > 0 && (
                  <button
                    onClick={downloadRecording}
                    className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                  >
                    Download
                  </button>
                )}
              </div>

              {/* Status Indicators */}
              <div className="space-y-2">
                {isRecording && (
                  <div className="flex items-center text-red-600">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse mr-2"></div>
                    Recording Video + Audio...
                  </div>
                )}

                {isListening && !isRecording && (
                  <div className="flex items-center text-green-600">
                    <div className="w-3 h-3 bg-green-600 rounded-full animate-pulse mr-2"></div>
                    Listening... (Audio Level: {Math.round(audioLevel)}%)
                  </div>
                )}
              </div>
            </div>
            
            {/* Teleprompter/Log View */}
            <div className="bg-white rounded-lg shadow-lg p-4 h-1/3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {isTeleprompterActive ? 'Teleprompter' : 'System Logs'}
                </h3>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-black">Speed:</label>
                  <input
                    type="number"
                    value={teleprompterSpeed}
                    onChange={(e) => setTeleprompterSpeed(Number(e.target.value))}
                    className="w-16 px-2 py-1 border rounded text-sm text-black"
                    min="30"
                    max="200"
                    disabled={isTeleprompterActive}
                  />
                  <span className="text-sm">WPM</span>
                  {isTeleprompterActive && (
                    <button
                      onClick={stopTeleprompter}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                    >
                      Stop
                    </button>
                  )}
                </div>
              </div>

              <div
                ref={logContainerRef}
                className={`h-32 overflow-y-auto p-3 rounded border ${isTeleprompterActive
                    ? 'bg-black text-green-400 font-mono text-lg leading-relaxed'
                    : 'bg-gray-50 font-mono text-sm'
                  }`}
              >
                {isTeleprompterActive ? (
                  <div className="whitespace-pre-wrap">
                    {logs[0] || ''}
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1 text-gray-700">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
            </div>
          {/* WPM Display */}
          <div className="mt-2 p-2 bg-blue-50 rounded">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Speech Analysis:</span>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-gray-600">Spoken WPM:</span>
                  <span className={`ml-1 font-bold ${spokenWPM > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {spokenWPM || '--'}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Teleprompter:</span>
                  <span className="ml-1 font-bold text-green-600">{teleprompterSpeed} WPM</span>
                </div>
              </div>
            </div>
            {transcriptBuffer.length > 0 && (
              <div className="mt-1 text-xs text-gray-500">
                Last {Math.min(5, transcriptBuffer.length)} chunks analyzed
              </div>
            )}
          </div> 
            
          {/* Right Side - Chat Interface */}
          <div className="bg-white rounded-lg shadow-lg p-4 flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Command Interface</h2>

            {/* Chat Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded border mb-4 space-y-3"
            >
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.sender === 'user'
                        ? 'bg-blue-500 text-black'
                        : 'bg-gray-200 text-gray-800'
                      }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="flex gap-2">
              <textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter your command here..."
                className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                rows={3}
              />
              <button
                onClick={sendMessage}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 self-end"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

