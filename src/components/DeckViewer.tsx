'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SlideMarker } from '../lib/openai';

interface DeckViewerProps {
  slideMarkers: SlideMarker[];
  currentPosition: number; // Current character position in transcript
  onSlideChange?: (slideNumber: number) => void;
}

export default function DeckViewer({
  slideMarkers,
  currentPosition,
  onSlideChange
}: DeckViewerProps) {
  const [currentSlide, setCurrentSlide] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [slideImages, setSlideImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine current slide based on transcript position
  useEffect(() => {
    if (slideMarkers.length === 0) return;

    let newSlide = 1;
    for (let i = slideMarkers.length - 1; i >= 0; i--) {
      if (currentPosition >= slideMarkers[i].position) {
        newSlide = slideMarkers[i].slide;
        break;
      }
    }

    if (newSlide !== currentSlide) {
      setCurrentSlide(newSlide);
      onSlideChange?.(newSlide);
    }
  }, [currentPosition, slideMarkers, currentSlide, onSlideChange]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert PDF/PPT to images (this is a simplified version)
      // In a real implementation, you'd use a library like pdf.js or pptxjs
      const images = await convertFileToImages(file);
      setSlideImages(images);
    } catch (err) {
      setError('Failed to load presentation slides');
      console.error('Error loading slides:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const convertFileToImages = async (file: File): Promise<string[]> => {
    // This is a placeholder implementation
    // In a real app, you'd use libraries like:
    // - pdf.js for PDFs
    // - pptxjs for PowerPoint files
    
    return new Promise((resolve) => {
      // For now, create placeholder slides based on slideMarkers
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const placeholders = slideMarkers.map((marker, index) => {
        return `data:image/svg+xml;base64,${btoa(`
          <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#f0f0f0"/>
            <text x="400" y="300" text-anchor="middle" font-size="24" fill="#333">
              Slide ${marker.slide}
            </text>
            <text x="400" y="330" text-anchor="middle" font-size="16" fill="#666">
              ${marker.title || 'Untitled'}
            </text>
          </svg>
        `)}`;
      });
      
      setTimeout(() => resolve(placeholders), 1000);
    });
  };

  const goToSlide = (slideNumber: number) => {
    if (slideNumber >= 1 && slideNumber <= slideMarkers.length) {
      setCurrentSlide(slideNumber);
      onSlideChange?.(slideNumber);
    }
  };

  const goToPreviousSlide = () => {
    if (currentSlide > 1) {
      goToSlide(currentSlide - 1);
    }
  };

  const goToNextSlide = () => {
    if (currentSlide < slideMarkers.length) {
      goToSlide(currentSlide + 1);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Presentation Slides</h3>
        
        {/* File Upload */}
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.ppt,.pptx"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Upload Presentation
          </button>
        </div>

        {/* Slide Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousSlide}
            disabled={currentSlide <= 1}
            className="bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 rounded"
          >
            ← Previous
          </button>
          
          <span className="text-sm text-gray-600">
            Slide {currentSlide} of {slideMarkers.length}
          </span>
          
          <button
            onClick={goToNextSlide}
            disabled={currentSlide >= slideMarkers.length}
            className="bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 rounded"
          >
            Next →
          </button>
        </div>

        {/* Slide Thumbnails */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
          {slideMarkers.map((marker, index) => (
            <button
              key={marker.slide}
              onClick={() => goToSlide(marker.slide)}
              className={`flex-shrink-0 w-16 h-12 rounded border-2 transition-colors ${
                currentSlide === marker.slide
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-xs text-center p-1">
                {marker.slide}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Current Slide Display */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="h-96 flex items-center justify-center bg-gray-100">
            <div className="text-gray-500">Loading slides...</div>
          </div>
        ) : error ? (
          <div className="h-96 flex items-center justify-center bg-red-50">
            <div className="text-red-500">{error}</div>
          </div>
        ) : slideImages.length > 0 ? (
          <div className="relative">
            <img
              src={slideImages[currentSlide - 1]}
              alt={`Slide ${currentSlide}`}
              className="w-full h-auto max-h-96 object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2">
              <div className="text-sm">
                Slide {currentSlide}: {slideMarkers[currentSlide - 1]?.title || 'Untitled'}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-96 flex items-center justify-center bg-gray-100">
            <div className="text-gray-500">
              Upload a presentation to view slides
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 