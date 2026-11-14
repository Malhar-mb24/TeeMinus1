import { auth } from "@clerk/nextjs/server";
import { getEnvReadiness } from "@ember/shared";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Flame,
  Headphones,
  Laptop,
  Moon,
  Play,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { EmberLogo } from "@/components/ember-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const readiness = getEnvReadiness(process.env);
  let isSignedIn = false;

  if (readiness.clerkConfigured) {
    try {
      const { userId } = await auth();
      isSignedIn = Boolean(userId);
    } catch {
      isSignedIn = false;
    }
  }

  return (
    <div className="relative min-h-dvh bg-canvas text-text-primary overflow-x-hidden selection:bg-flame/30 selection:text-text-primary">
      {/* Taste Skill Ambient Hearth Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_70%_55%_at_50%_-15%,rgba(243,107,43,0.24),rgba(185,71,22,0.12),transparent_75%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-40 -left-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(255,180,92,0.12),transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-96 -right-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(243,107,43,0.14),transparent_70%)] blur-3xl"
      />

      {/* Floating Pill Navigation Header */}
      <header className="sticky top-4 z-50 mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between rounded-full border border-border-subtle/80 bg-surface/85 px-4 sm:px-6 backdrop-blur-xl shadow-[0_12px_32px_-10px_rgba(22,11,7,0.7),inset_0_1px_0_0_rgba(255,243,231,0.06)]">
          <Link href="/" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-flame">
            <EmberLogo />
          </Link>

          <nav
            aria-label="Product navigation"
            className="hidden md:flex items-center gap-6 text-xs font-medium text-text-secondary"
          >
            <a href="#focus-engine" className="hover:text-text-primary transition-colors">
              Focus Engine
            </a>
            <a href="#sanctuary" className="hover:text-text-primary transition-colors">
              Sanctuary World
            </a>
            <a href="#habits" className="hover:text-text-primary transition-colors">
              Habit Grids
            </a>
            <a href="#wellbeing" className="hover:text-text-primary transition-colors">
              Digital Wellbeing
            </a>
            <a href="#insights" className="hover:text-text-primary transition-colors">
              Insights
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {isSignedIn ? (
              <Button asChild variant="ember" size="sm" className="rounded-full shadow-md">
                <Link href="/dashboard">
                  Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="rounded-full text-xs text-text-secondary hover:text-text-primary">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild variant="ember" size="sm" className="rounded-full shadow-md text-xs font-semibold">
                  <Link href="/sign-up">
                    Get started
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section (Taste Skill Typography & Atmosphere) */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-20 sm:pb-28">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <Badge
            variant="flame"
            className="mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber" />
            <span>Taste Skill × Amber House · A Digital Sanctuary</span>
          </Badge>

          <h1 className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-6xl lg:text-7xl leading-[1.06]">
            Make focus your <span className="bg-gradient-to-r from-amber via-flame to-flame-burnt bg-clip-text text-transparent">favourite place.</span>
          </h1>

          {/* Heading validated by E2E suite */}
          <h2 className="text-lg font-medium text-text-secondary sm:text-2xl tracking-[-0.015em] max-w-2xl mx-auto leading-snug">
            Build consistent study habits without noise or gimmicks.
          </h2>

          <p className="mx-auto max-w-2xl text-sm text-text-muted sm:text-base leading-relaxed">
            Ember unites timestamp-anchored Pomodoro timers, living habit contribution
            heatmaps, plan-versus-actual study queues, and a cozy interactive Threeui-inspired
            sanctuary with privacy-first cross-device tracking.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-3">
            {isSignedIn ? (
              <Button asChild variant="ember" size="lg" className="w-full sm:w-auto rounded-full px-8 shadow-xl">
                <Link href="/dashboard">
                  Enter Your Sanctuary
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ember" size="lg" className="w-full sm:w-auto rounded-full px-8 shadow-xl text-base font-semibold">
                  <Link href="/sign-up">
                    Create your workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto rounded-full px-6"
                >
                  <Link href="/dashboard" prefetch={false}>
                    Preview Protected Shell
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Product Showcase: Live Interactive Hearth Interface Preview */}
        <section
          aria-labelledby="product-preview-heading"
          className="mt-14 sm:mt-20 overflow-hidden rounded-3xl border border-border-subtle bg-surface/90 p-4 sm:p-8 shadow-[0_24px_64px_-16px_rgba(22,11,7,0.85),inset_0_1px_0_0_rgba(255,243,231,0.06)] backdrop-blur-xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-border-subtle/80">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-flame animate-pulse" />
              <div>
                <h3 id="product-preview-heading" className="text-sm font-semibold tracking-tight text-text-primary">
                  The Ember Workspace Interface
                </h3>
                <p className="text-xs text-text-muted">
                  Warm espresso surfaces · Real-time timestamp recovery · Privacy-first
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="emerald" className="text-[11px]">
                <CheckCircle2 className="h-3 w-3" />
                Database Connected
              </Badge>
              <Badge variant="flame" className="text-[11px]">
                Level 4 · 640 XP
              </Badge>
            </div>
          </div>

          {/* Genuine Component Preview Bento */}
          <div className="mt-6 grid gap-4 lg:grid-cols-12">
            {/* Focus Dial Showcase */}
            <div className="lg:col-span-5 rounded-2xl border border-border-subtle bg-surface-elevated p-6 flex flex-col items-center justify-center text-center space-y-4 shadow-inner">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-flame-soft">
                Focus Engine
              </span>
              <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-2 border-border-subtle bg-canvas shadow-[0_0_40px_-10px_rgba(243,107,43,0.3)]">
                <div className="absolute inset-2 rounded-full border border-flame/40 bg-[radial-gradient(circle_at_50%_50%,rgba(243,107,43,0.18),transparent)]" />
                <div className="relative text-center">
                  <div className="text-4xl font-extrabold tracking-tight font-mono text-text-primary">
                    25:00
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-amber font-medium">
                    Pomodoro Focus
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ember" className="rounded-full px-5 text-xs">
                  <Play className="h-3 w-3" /> Start Session
                </Button>
                <Button size="sm" variant="outline" className="rounded-full text-xs">
                  <Headphones className="h-3 w-3 text-flame" /> FlowTunes
                </Button>
              </div>
            </div>

            {/* Companion & Habit Matrix Showcase */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-4">
              {/* Flame Hearth Card */}
              <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-5 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-flame/30 bg-[radial-gradient(circle_at_50%_65%,rgba(243,107,43,0.25),rgba(23,19,17,0.95))] shadow-[0_0_20px_-5px_rgba(243,107,43,0.5)]">
                  <Flame className="h-9 w-9 text-flame animate-ember-happy" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">Ember Companion</span>
                    <Badge variant="flame" className="text-[10px] py-0 px-2 font-medium">
                      Hearth Sanctum
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary">
                    &ldquo;Ready for a calm, focused study block whenever you are.&rdquo;
                  </p>
                  <p className="text-[11px] text-text-muted">
                    6-day study streak · 1h 25m recorded today
                  </p>
                </div>
              </div>

              {/* Habit Matrix & Screen Time Balance */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-text-primary">Morning Deep Work</span>
                    <Badge variant="emerald" className="text-[10px] py-0">Done</Badge>
                  </div>
                  <div className="grid grid-cols-7 gap-1 pt-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                      <div
                        key={day}
                        className={`h-5 rounded-md ${
                          day <= 6 ? "bg-flame/80 border border-flame" : "bg-surface border border-border-subtle"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-text-muted block">6-day streak · Work block</span>
                </div>

                <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-text-primary">Digital Wellbeing</span>
                    <span className="text-emerald font-semibold">69% Productive</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-canvas overflow-hidden flex">
                    <div className="bg-emerald h-full w-[69%]" />
                    <div className="bg-sky h-full w-[18%]" />
                    <div className="bg-rose h-full w-[13%]" />
                  </div>
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>2h 37m tracked</span>
                    <span>Chrome MV3 &amp; Windows</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Narrative Feature Showcase Sections (Taste Skill Visual Storytelling) */}
        <section id="sanctuary" className="mt-24 sm:mt-32 space-y-16">
          {/* Section 1: The Personal World / Sanctuary */}
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5 space-y-4">
              <Badge variant="flame" className="text-xs">
                <Compass className="h-3.5 w-3.5" />
                Threeui Amber House Inspiration
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-4xl">
                Your personal digital sanctuary.
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed sm:text-base">
                Step into an interactive isometric world. Move seamlessly between the
                <strong> Focus Study</strong> for deep work blocks, the <strong>Planning Atelier</strong> for tasks,
                the <strong>Living Hearth</strong> with your flame companion, and the <strong>Rest Haven</strong> for
                daily wind-down consistency.
              </p>
              <ul className="space-y-2 text-xs text-text-secondary pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-flame" />
                  Day and Night ambient lighting controls.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-flame" />
                  Synthesized cozy hearth soundscape (zero external audio dependencies).
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-flame" />
                  Real contextual user statistics reflected live in each room.
                </li>
              </ul>
            </div>

            <div className="lg:col-span-7 rounded-3xl border border-border-subtle bg-surface-elevated/70 p-6 sm:p-8 shadow-xl">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-2xl border border-flame/30 bg-surface p-4 space-y-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-flame/15 text-flame">
                    <Timer className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm font-semibold text-text-primary">Focus Study</h4>
                  <p className="text-xs text-text-muted leading-normal">
                    Walnut desk with glowing monitor, warm light cone, and direct Pomodoro launch.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber/30 bg-surface p-4 space-y-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber/15 text-amber">
                    <Workflow className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm font-semibold text-text-primary">Planning Atelier</h4>
                  <p className="text-xs text-text-muted leading-normal">
                    Architecture whiteboard with active sticky tasks and planned study hours.
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald/30 bg-surface p-4 space-y-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald/15 text-emerald">
                    <Flame className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm font-semibold text-text-primary">Living Hearth</h4>
                  <p className="text-xs text-text-muted leading-normal">
                    Warm fireplace where the Ember companion rests with rising glowing embers.
                  </p>
                </div>

                <div className="rounded-2xl border border-sky/30 bg-surface p-4 space-y-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky/15 text-sky">
                    <Moon className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm font-semibold text-text-primary">Rest Haven</h4>
                  <p className="text-xs text-text-muted leading-normal">
                    Cozy platform bed with warm nightstand lamp for daily consistency &amp; rest.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Focus Engine & FlowTunes */}
          <div id="focus-engine" className="grid gap-8 lg:grid-cols-12 lg:items-center pt-8">
            <div className="lg:col-span-6 rounded-3xl border border-border-subtle bg-surface-elevated/70 p-6 sm:p-8 space-y-4 shadow-xl order-2 lg:order-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-flame-soft">Session Engine</span>
                  <Badge variant="emerald">Live Recovery</Badge>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-flame/15 text-flame">
                      <Headphones className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">FlowTunes Soundspace</p>
                      <p className="text-xs text-text-muted">Lo-Fi Beats, Rain, Synthwave presets</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-full text-xs">
                    Try Sound
                  </Button>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Timestamp Anchoring</p>
                    <p className="text-xs text-text-muted">Zero drift across page refreshes or device sleep</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-emerald" />
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4 order-1 lg:order-2">
              <Badge variant="flame" className="text-xs">
                <Timer className="h-3.5 w-3.5" />
                Timestamp-Anchored Timers
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-4xl">
                Deep work that never loses your place.
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed sm:text-base">
                Timers in Ember are calculated from server timestamps rather than client intervals.
                Refresh your browser, close the laptop, or change workspaces—your active focus block
                recovers with mathematical accuracy every time.
              </p>
            </div>
          </div>

          {/* Section 3: Digital Wellbeing & Privacy */}
          <div id="wellbeing" className="grid gap-8 lg:grid-cols-12 lg:items-center pt-8">
            <div className="lg:col-span-6 space-y-4">
              <Badge variant="flame" className="text-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald" />
                Privacy-First Tracking
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-4xl">
                Know where your attention goes, without invasive surveillance.
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed sm:text-base">
                Ember pairs with a Chrome Manifest V3 extension and a lightweight Windows desktop
                tracker. It records only top-level hostnames (e.g. <code>github.com</code>)—never full URLs,
                never search queries, and never private window activity. Opt-in sync only.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="neutral" className="text-xs">
                  <Laptop className="h-3.5 w-3.5" /> Windows CLI App
                </Badge>
                <Badge variant="neutral" className="text-xs">
                  Chrome MV3 Extension
                </Badge>
                <Badge variant="neutral" className="text-xs">
                  Idle Detection (60s)
                </Badge>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-3xl border border-border-subtle bg-surface-elevated/70 p-6 sm:p-8 space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs text-text-muted pb-2">
                <span>Domain Hostname</span>
                <span>Category</span>
                <span>Active Today</span>
              </div>
              {[
                { domain: "github.com", cat: "Productive", time: "40m", color: "text-emerald" },
                { domain: "typescriptlang.org", cat: "Productive", time: "21m", color: "text-emerald" },
                { domain: "youtube.com", cat: "Distracting", time: "11m", color: "text-flame" },
              ].map((item) => (
                <div
                  key={item.domain}
                  className="rounded-xl border border-border-subtle bg-surface p-3 flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-text-primary">{item.domain}</span>
                  <span className={item.color}>{item.cat}</span>
                  <span className="font-semibold text-text-primary">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ready to Begin Call to Action */}
        <section className="mt-24 sm:mt-32 rounded-3xl border border-flame/30 bg-[radial-gradient(ellipse_at_center,rgba(243,107,43,0.18),#171311_80%)] p-8 sm:p-14 text-center space-y-6 shadow-2xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-flame/40 bg-flame/20 text-flame shadow-[0_0_30px_rgba(243,107,43,0.4)]">
            <Flame className="h-7 w-7" />
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
            Step into your personal focus sanctuary.
          </h2>
          <p className="mx-auto max-w-xl text-sm text-text-secondary sm:text-base leading-relaxed">
            Join Ember today. Clean espresso aesthetics, reliable timers, living habit matrices,
            and honest privacy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button asChild variant="ember" size="lg" className="rounded-full px-8 shadow-xl text-base font-semibold">
              <Link href="/sign-up">
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="rounded-full text-text-secondary hover:text-text-primary">
              <Link href="/sign-in">Member Portal</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Taste Skill Warm Footer */}
      <footer className="border-t border-border-subtle/80 bg-surface px-4 py-8 text-center text-xs text-text-muted space-y-2">
        <div className="flex items-center justify-center gap-4 text-text-secondary">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <Link href="/sign-up" className="hover:text-text-primary transition-colors">Workspace</Link>
          <a href="/api/health" className="hover:text-text-primary transition-colors">System Health</a>
        </div>
        <p>© 2026 Ember · Personal Focus &amp; Digital Wellbeing · Taste Skill × Amber House</p>
      </footer>
    </div>
  );
}
