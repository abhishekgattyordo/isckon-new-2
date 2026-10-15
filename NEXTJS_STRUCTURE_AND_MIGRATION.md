# 🚀 Aura Enterprise: Next.js 15 App Router Architecture & Migration Guide

> [!NOTE]
> **Why is `App.tsx` currently visible in the AI Studio file tree?**
> Google AI Studio's real-time web preview container currently executes within a live sandboxed React + Vite container engine. To render your interactive live preview inside the browser iframe here, the sandbox requires `src/App.tsx` and `src/main.tsx` as temporary boot shims.
> **When setting up or exporting to your real Next.js 15 repository, `App.tsx`, `main.tsx`, and `vite.config.ts` MUST NOT EXIST.** Follow the strict App Router structure documented below!

> [!IMPORTANT]
> **Strict Next.js 15 App Router Architecture (Mandatory Rule)**
> In your target **Next.js 15 App Router** repository, strictly DO NOT generate or include any of the following legacy or SPA-specific files/patterns:
> - ❌ `App.tsx` or `main.tsx` (Replaced by `src/app/page.tsx` and `src/app/layout.tsx`)
> - ❌ `index.html` or `vite.config.ts` (Replaced by Next.js compiler and `next.config.ts`)
> - ❌ `React Router`, `BrowserRouter`, or `HashRouter` (Replaced by Next.js file-system routing)
> - ❌ Custom Express backend servers for frontend routing (`server.ts` / SPA fallback)
> - ❌ Legacy Pages Router files (`_app.tsx`, `_document.tsx`, or `pages/` directory)

---

## 🏛️ 1. Core Architectural Principles

1. **Server-First Rendering by Default (React Server Components):**
   In Next.js 15, all components in the `src/app/` directory are **React Server Components (RSCs)** by default. They execute exclusively on the server, resulting in zero JavaScript bundle overhead sent to the client for static structure and layout formatting.
2. **Selective Client Hydration (`"use client"`):**
   Only add the `"use client"` directive at the very top of components that require client-side interactivity, such as:
   - State and lifecycle hooks (`useState`, `useReducer`, `useEffect`, `useCallback`, `useMemo`)
   - Browser event listeners (`onClick`, `onChange`, `onSubmit`, `onKeyDown`)
   - Browser DOM APIs (`window`, `localStorage`, `ResizeObserver`, audio playback)
   - React Context consumers (`useContext`, `useApp`)
3. **File-System Routing via `src/app/`:**
   Each route in your application is represented by a folder inside `src/app/` containing a `page.tsx` file:
   - `/` → `src/app/page.tsx` (Home / Executive Dashboard)
   - `/products` → `src/app/products/page.tsx` (Product Catalog & Pricing)
   - `/inventory` → `src/app/inventory/page.tsx` (Warehouse & Zones Telemetry)
   - `/inward` → `src/app/inward/page.tsx` (Material Inward / GRN Wizard)
   - `/pos` → `src/app/pos/page.tsx` (Point of Sale Checkout Terminal)
   - `/ai` → `src/app/ai/page.tsx` (AI Executive Strategy Consultant)
4. **Serverless API Route Handlers (`src/app/api/**/route.ts`):**
   All server-side backend logic and third-party API integrations (such as the **Google Gemini SDK** using `GEMINI_API_KEY`) reside in Route Handlers. They replace standalone Express endpoints.

---

## 📁 2. Target Next.js 15 Project Structure

When initializing or organizing your Next.js 15 repository (`npx create-next-app@latest aura-enterprise --typescript --tailwind --eslint --app`), maintain this exact directory tree:

```
aura-enterprise/
├── public/
│   ├── favicon.ico
│   └── branding/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   ├── strategy/route.ts       # Route Handler: POST /api/ai/strategy
│   │   │   │   └── chat/route.ts           # Route Handler: POST /api/ai/chat
│   │   │   ├── pos/
│   │   │   │   └── checkout/route.ts       # Route Handler: POST /api/pos/checkout
│   │   │   └── inventory/
│   │   │       └── sync/route.ts           # Route Handler: POST /api/inventory/sync
│   │   ├── ai/
│   │   │   └── page.tsx                    # Route: /ai (AI Executive Strategy)
│   │   ├── inventory/
│   │   │   └── page.tsx                    # Route: /inventory (Warehouse Telemetry)
│   │   ├── inward/
│   │   │   └── page.tsx                    # Route: /inward (GRN Material Inward)
│   │   ├── pos/
│   │   │   └── page.tsx                    # Route: /pos (POS Checkout Terminal)
│   │   ├── products/
│   │   │   └── page.tsx                    # Route: /products (Product Catalog & Pricing)
│   │   ├── globals.css                     # Global styling (@import "tailwindcss";)
│   │   ├── layout.tsx                      # Root Layout (Server Component + Client Providers)
│   │   └── page.tsx                        # Route: / (Executive Dashboard Home)
│   ├── components/
│   │   ├── dashboard/
│   │   │   └── ExecutiveDashboard.tsx      # Client Component ("use client")
│   │   ├── inventory/
│   │   │   └── InventoryDashboard.tsx      # Client Component ("use client")
│   │   ├── inward/
│   │   │   └── MaterialInwardWizard.tsx    # Client Component ("use client")
│   │   ├── layout/
│   │   │   ├── GlobalSearchModal.tsx       # Client Component ("use client")
│   │   │   ├── Header.tsx                  # Client Component ("use client")
│   │   │   └── Sidebar.tsx                 # Client Component ("use client" with Lucide icons)
│   │   └── products/
│   │       └── ProductManagement.tsx       # Client Component ("use client")
│   ├── context/
│   │   └── AppContext.tsx                  # Client Context Provider ("use client")
│   ├── data/
│   │   └── initialData.ts                  # Seed data & static mock catalogs
│   └── types/
│       └── index.ts                        # Shared TypeScript interfaces
├── .env.example                            # GEMINI_API_KEY=your_secret_key_here
├── .env.local                              # Local development secrets (git-ignored)
├── next.config.ts                          # Next.js 15 framework configuration
├── package.json                            # Dependencies (lucide-react, motion, recharts, @google/genai)
└── tsconfig.json                           # TypeScript compiler options
```

---

## 🛠️ 3. Next.js 15 App Router Implementation Blueprints

### A. Root Layout (`src/app/layout.tsx` — Server Component)
This file replaces `index.html` and global root wrappers. It defines metadata on the server while mounting client providers for UI state.

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { GlobalSearchModal } from '@/components/layout/GlobalSearchModal';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Aura Enterprise | Warehouse & POS Command Center',
  description: 'Next.js 15 App Router executive dashboard, real-time inventory telemetry, and POS checkout.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${jakarta.variable} ${mono.variable} font-sans bg-slate-950 text-slate-100 antialiased`}>
        <AppProvider>
          <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Modular Sidebar with Colorful Icons */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                {children}
              </main>
            </div>

            {/* Command Palette Modal */}
            <GlobalSearchModal />
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
```

---

### B. Home Page Route (`src/app/page.tsx` — Server Component)
In App Router, the page acts as the structural entry for `/`. It imports client-interactive dashboard modules cleanly.

```tsx
// src/app/page.tsx
import React from 'react';
import { ExecutiveDashboard } from '@/components/dashboard/ExecutiveDashboard';

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <ExecutiveDashboard />
    </div>
  );
}
```

---

### C. Module Route Example (`src/app/products/page.tsx` — Server Component)
Instead of SPA tab switching in a monolithic component, each functional module gets its own dedicated URL route in App Router:

```tsx
// src/app/products/page.tsx
import type { Metadata } from 'next';
import { ProductManagement } from '@/components/products/ProductManagement';

export const metadata: Metadata = {
  title: 'Product Catalog & Pricing | Aura Enterprise',
  description: 'Manage SKU inventory, barcode labels, and automated reorder thresholds.',
};

export default function ProductsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <ProductManagement />
    </div>
  );
}
```

---

### D. Serverless AI Route Handler (`src/app/api/ai/strategy/route.ts`)
Route Handlers execute securely on the server (Node.js or Edge runtime), keeping your Gemini API credentials completely isolated from the browser.

```ts
// src/app/api/ai/strategy/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY environment variable is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { prompt, lowStockItems } = body;

    const ai = new GoogleGenAI({ apiKey });
    
    // Generate executive recommendations using Gemini 2.5 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are Aura Executive AI, a senior supply chain advisor. Analyze this query:\n\nPrompt: ${prompt}\n\nCritical Low Stock SKUs: ${JSON.stringify(lowStockItems)}`
            }
          ]
        }
      ]
    });

    return NextResponse.json({
      insight: response.text || 'No strategy recommendations generated.',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('AI Strategy API Route Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error during AI generation.' },
      { status: 500 }
    );
  }
}
```

---

### E. Framework Configuration (`next.config.ts`)

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* Enable React Strict Mode and modern bundler optimization */
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
```

---

## ⚡ 4. Export & Migration Checklist

When moving your code from AI Studio to a standalone Next.js 15 environment:
1. Initialize your project: `npx create-next-app@latest aura-enterprise --typescript --tailwind --eslint --app`
2. Install required visual and AI dependencies:
   ```bash
   npm install lucide-react motion recharts @google/genai clsx tailwind-merge
   ```
3. Copy `/src/components/`, `/src/context/`, `/src/data/`, and `/src/types/` directly into your Next.js `src/` folder.
4. **Do not copy** `App.tsx`, `main.tsx`, `index.html`, `server.ts`, or `vite.config.ts`.
5. Ensure all interactive UI widgets (such as charts, modals, and wizards) start with the `'use client';` directive at line 1.
6. Run `npm run dev` to launch the Next.js 15 App Router server!
