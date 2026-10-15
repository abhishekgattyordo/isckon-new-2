import type { Metadata } from 'next';
import './globals.css';
import { ERPProvider } from '@/context/ERPContext';
import { LayoutWrapper } from '@/components/layout/LayoutWrapper';

export const metadata: Metadata = {
  title: 'ISKCON Retail ERP',
  description: "Enterprise Retail ERP suite for ISKCON temple gift shops and Govinda's stores featuring POS Checkout, Inventory & Barcode Management, Material Inward Notes (GRN), and Sales Events.",
  openGraph: {
    title: 'ISKCON Retail ERP',
    description: "Enterprise Retail ERP suite for ISKCON temple gift shops and Govinda's stores featuring POS Checkout, Inventory & Barcode Management, Material Inward Notes (GRN), and Sales Events.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <ERPProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </ERPProvider>
      </body>
    </html>
  );
}
