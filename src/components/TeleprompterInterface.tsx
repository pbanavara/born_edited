'use client';
import React, { useEffect } from 'react';

interface TeleprompterInterfaceProps {
  teleprompterSpeed: number;
  onSpeedChange: (speed: number) => void;
  logs: string[];
  logContainerRef: React.RefObject<HTMLDivElement | null>;
}

export default function TeleprompterInterface({
  teleprompterSpeed,
  onSpeedChange,
  logs,
  logContainerRef
}: TeleprompterInterfaceProps) {
  useEffect(() => {
    // Auto-scroll logs to bottom
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, logContainerRef]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Speed WPM
        </label>
        <input
          type="number"
          value={teleprompterSpeed}
          onChange={(e) => onSpeedChange(parseInt(e.target.value) || 150)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          min="30"
          max="200"
        />
      </div>
      
      <div className="space-y-4">
        <div
          ref={logContainerRef}
          className={`h-32 overflow-y-auto p-6 rounded-lg border border-gray-600 ${
            'text-green-400 font-mono text-xl leading-relaxed drop-shadow-lg bg-black bg-opacity-50'
          }`}
        >
          {logs.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 