import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-800 dark:text-slate-200 px-4">
      <h1 className="text-3xl font-bold mb-2">404 - Page Not Found</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6 text-center max-w-md text-sm">
        The requested module or resource was not found.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
      >
        Return to Command Center
      </Link>
    </div>
  );
}
