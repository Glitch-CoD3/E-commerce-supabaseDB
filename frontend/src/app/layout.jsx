import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "../services/cartContext"; // Adjust path if needed
import { AuthProvider } from "@/services/authContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "TRENDLAMA",
  description: "Trend Lama E-commerce site",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="font-sans" suppressHydrationWarning>
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}