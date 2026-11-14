import { ClerkProvider } from "@clerk/nextjs";
import { getEnvReadiness } from "@ember/shared";
import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ember — Personal Focus & Digital Wellbeing",
    template: "%s · Ember",
  },
  description:
    "Refine your study habits, protect your attention, and understand your digital behaviour with privacy-first tracking.",
};

export const viewport: Viewport = {
  themeColor: "#160B07",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const readiness = getEnvReadiness(process.env);

  return (
    <html lang="en" className={`dark ${poppins.variable}`}>
      <body className="min-h-dvh bg-canvas text-text-primary font-sans antialiased">
        {readiness.clerkPublishableConfigured ? (
          <ClerkProvider
            publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
            appearance={{
              variables: {
                colorPrimary: "#F36B2B",
                colorBackground: "#171311",
                colorInput: "#241812",
                colorInputForeground: "#FFF3E7",
                colorForeground: "#FFF3E7",
                colorMutedForeground: "#CBB9AA",
                borderRadius: "0.85rem",
              },
            }}
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
