'use client';

import React, { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Check if error is a chunk load failure or loading error
    const isChunkError = 
      error?.name === 'ChunkLoadError' ||
      error?.message?.toLowerCase().includes('chunk') ||
      error?.message?.toLowerCase().includes('loading');

    if (isChunkError && typeof window !== 'undefined') {
      console.warn('ChunkLoadError detected, forcing page reload to retrieve the latest build...');
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAF9F6] dark:bg-slate-950 text-slate-800 dark:text-slate-200 px-4">
      <h1 className="text-3xl font-bold mb-2">Something went wrong!</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6 text-center max-w-md">
        {error?.message || 'An unexpected error occurred in the application.'}
      </p>
      <button
        onClick={() => reset()}
        className="px-5 py-2.5 bg-[#D97706] hover:bg-[#B45309] text-white font-medium rounded-xl transition-colors shadow-sm"
      >
        Try again
      </button>
    </div>
  );
}
