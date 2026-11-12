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

  const shell = (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-canvas text-text-primary antialiased">
        {children}
      </body>
    </html>
  );

  if (!readiness.clerkPublishableConfigured) {
    return shell;
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#F97316",
          colorBackground: "#131519",
          colorInputBackground: "#1A1D23",
          colorInputText: "#F4F5F7",
          colorText: "#F4F5F7",
          colorTextSecondary: "#A1A7B4",
          borderRadius: "0.75rem",
        },
      }}
    >
      {shell}
    </ClerkProvider>
  );
}
