import { ClerkProvider } from "@clerk/nextjs";
import { getEnvReadiness } from "@ember/shared";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ember — Personal Focus & Digital Wellbeing",
    template: "%s · Ember",
  },
  description:
    "Refine your study habits, protect your attention, and understand your digital behaviour with privacy-first tracking.",
};

export const viewport: Viewport = {
  themeColor: "#0B0C0E",
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
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-canvas text-text-primary antialiased">
        {readiness.clerkPublishableConfigured ? (
          <ClerkProvider
            publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
            appearance={{
              variables: {
                colorPrimary: "#F97316",
                colorBackground: "#131519",
                colorInput: "#1A1D23",
                colorInputForeground: "#F4F5F7",
                colorForeground: "#F4F5F7",
                colorMutedForeground: "#A1A7B4",
                borderRadius: "0.75rem",
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
