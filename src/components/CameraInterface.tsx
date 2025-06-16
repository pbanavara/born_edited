'use client';
import React from 'react';

interface CameraInterfaceProps {
  mediaStream: MediaStream | null;
  isRecording: boolean;
  isPlayingRecording: boolean;
  recordingUrl: string;
  recordedChunks: Blob[];
  isListening: boolean;
  isWhisperActive: boolean;
  isWebSpeechActive: boolean;
  audioLevel: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startCamera: () => void;
  stopCamera: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  viewRecording: () => void;
  stopPlayback: () => void;
}

export default function CameraInterface({
  mediaStream,
  isRecording,
  isPlayingRecording,
  recordingUrl,
  recordedChunks,
  isListening,
  isWhisperActive,
  isWebSpeechActive,
  audioLevel,
  videoRef,
  startCamera,
  stopCamera,
  startRecording,
  stopRecording,
  viewRecording,
  stopPlayback
}: CameraInterfaceProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 h-2/3 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-white">
            Camera Interface
          </h2>

          <div className="relative bg-black rounded-lg mb-2 h-[80%]">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-full object-cover rounded-lg"
            />
            {!mediaStream && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <span>Start camera to enable dynamic teleprompter</span>
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

            {/* Upload Pitch Deck Section */}
            <div className="flex items-center gap-3 bg-gray-700 rounded-lg px-3 py-2">
              <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition-colors flex items-center gap-2 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Deck
              </button>
              
              <div className="text-xs text-gray-300">
                Generate script
              </div>

              {/* Circular Progress Wheel */}
              <div className="relative w-6 h-6">
                <svg className="w-6 h-6 transform -rotate-90" viewBox="0 0 32 32">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    className="text-gray-600"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 14}`}
                    strokeDashoffset={`${2 * Math.PI * 14 * (1 - 0 / 100)}`}
                    strokeLinecap="round"
                    className="text-blue-500 transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-blue-400 font-medium">0%</span>
                </div>
              </div>
            </div>

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
    </div>
  );
} 