import Link from "next/link";
import { BuildingBadge, BuildingMark, SendIcon, UserPlusIcon } from "./dashboard/icons";
import { ScrollReveal } from "./ScrollReveal";

const FEATURES = [
  {
    icon: <BuildingMark />,
    title: "Buildings & Rooms",
    description: "Floors, rooms, and live occupancy for every property you manage.",
  },
  {
    icon: <UserPlusIcon />,
    title: "Tenants",
    description: "Admit new or returning tenants, track profiles, end tenancies cleanly.",
  },
  {
    icon: <span className="text-base font-bold">₱</span>,
    title: "Payments",
    description: "Auto-generated monthly invoices with partial-payment and overdue tracking.",
  },
  {
    icon: <SendIcon />,
    title: "Announcements",
    description: "Scoped email announcements, plus automated overdue-rent reminders.",
  },
];

export default function HomePage() {
  return (
    <main className="bg-white">
      {/* Nav */}
      <div className="animate-hero-in mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <BuildingBadge size={32} />
          <span className="text-lg font-extrabold text-zinc-900">MyTenants</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-2 py-2 text-sm font-medium text-zinc-700 transition-colors hover:text-clay-700"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-clay-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-clay-700"
          >
            Get Started
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-6 py-10 lg:flex-row lg:items-center lg:py-14">
        <div className="animate-hero-in lg:flex-1" style={{ animationDelay: "60ms" }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-clay-200 bg-clay-50 px-3.5 py-1.5 text-[13px] font-semibold text-clay-700">
            Self-hosted · your data, your server
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.12] tracking-tight text-zinc-900 sm:text-5xl">
            Run your rental buildings
            <br />
            without the spreadsheet.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-zinc-600">
            Buildings, rooms, tenants, and payments in one dashboard — deployed on your own server with a single
            command. No per-unit fees, no vendor lock-in.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/signup"
              className="rounded-lg bg-clay-600 px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-clay-700"
            >
              Get Started Free
            </Link>
            <code className="text-sm text-zinc-500">git pull &amp;&amp; docker compose up -d</code>
          </div>
        </div>

        {/* Product preview */}
        <div
          className="animate-hero-in relative lg:flex-1"
          style={{ animationDelay: "120ms" }}
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl transition-shadow hover:shadow-[0_32px_70px_-20px_rgba(24,24,27,0.25)]">
            <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 px-5 py-3.5">
              <span className="h-2 w-2 rounded-full bg-zinc-200" />
              <span className="h-2 w-2 rounded-full bg-zinc-200" />
              <span className="h-2 w-2 rounded-full bg-zinc-200" />
            </div>
            <div className="p-6">
              <p className="mb-4 text-xs font-semibold text-zinc-500">Occupancy By Building</p>
              <div className="flex items-center gap-2.5 py-2">
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-clay-600" />
                <span className="flex-1 text-sm font-medium text-zinc-900">Sunrise Residences</span>
                <span className="text-[13px] text-zinc-400">5/5 rooms</span>
                <span className="w-12 text-right text-lg font-bold text-zinc-900">100%</span>
              </div>
              <div className="flex items-center gap-2.5 py-2">
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-clay-300" />
                <span className="flex-1 text-sm font-medium text-zinc-900">Birchwood Annex</span>
                <span className="text-[13px] text-zinc-400">3/4 rooms</span>
                <span className="w-12 text-right text-lg font-bold text-zinc-900">75%</span>
              </div>
              <div className="flex items-center gap-2.5 py-2">
                <span className="h-[7px] w-[7px] shrink-0 rounded-full border border-zinc-300 bg-white" />
                <span className="flex-1 text-sm font-medium text-zinc-400">Riverside Hall</span>
                <span className="text-[13px] text-zinc-400">0/4 rooms</span>
                <span className="w-12 text-right text-lg font-bold text-zinc-400">0%</span>
              </div>
              <div className="my-4 h-px bg-zinc-100" />
              <div className="flex gap-4">
                <div className="flex-1 rounded-lg border border-zinc-100 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase text-zinc-400">Total owed</p>
                  <p className="text-lg font-bold text-red-700">₱7,500.00</p>
                </div>
                <div className="flex-1 rounded-lg border border-zinc-100 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase text-zinc-400">Active tenants</p>
                  <p className="text-lg font-bold text-zinc-900">11</p>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-5 -left-6 hidden items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-xl sm:flex">
            <span className="h-2 w-2 shrink-0 rounded-full bg-clay-600" />
            <span className="text-[13px] font-semibold text-zinc-900">Rent reminder sent to 3 tenants</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <ScrollReveal className="border-y border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-lg">
            <p className="text-xs font-bold uppercase tracking-wider text-clay-700">What it handles</p>
            <h2 className="mt-2.5 text-3xl font-extrabold tracking-tight text-zinc-900">
              Everything between move-in and rent day.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-clay-50 text-clay-700">
                  {feature.icon}
                </div>
                <p className="mb-1.5 font-bold text-zinc-900">{feature.title}</p>
                <p className="text-[13.5px] leading-relaxed text-zinc-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* Positioning */}
      <ScrollReveal className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-20 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-clay-700">Why self-hosted</p>
          <h2 className="mt-2.5 text-3xl font-extrabold tracking-tight text-zinc-900">
            Your data stays on your server.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-600">
            No shared multi-tenant hosting to trust, no per-unit pricing that scales against you. One Docker Compose
            stack, one VPS, one command to update.
          </p>
        </div>
        <div className="flex flex-col gap-4 lg:flex-1">
          <div className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-clay-600" />
            <p className="text-[14.5px] text-zinc-700">
              <span className="font-bold">No per-unit fees</span> — one flat deployment, unlimited buildings and
              tenants.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-clay-600" />
            <p className="text-[14.5px] text-zinc-700">
              <span className="font-bold">No vendor lock-in</span> — your Postgres database, your backups, your
              export.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-clay-600" />
            <p className="text-[14.5px] text-zinc-700">
              <span className="font-bold">One command to update</span> —{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[13px]">
                git pull &amp;&amp; docker compose up -d --build
              </code>
            </p>
          </div>
        </div>
      </ScrollReveal>

      {/* Closing CTA */}
      <ScrollReveal className="bg-clay-600">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-3xl font-extrabold text-white">Deploy it on your own server today.</h2>
          <p className="mt-3 text-[15px] text-clay-100">Free, self-hosted, and ready for your first building.</p>
          <Link
            href="/signup"
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-[15px] font-bold text-clay-700 transition-colors hover:bg-clay-50"
          >
            Get Started
          </Link>
        </div>
      </ScrollReveal>

      {/* Footer */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <div className="flex items-center gap-2">
          <BuildingBadge size={22} />
          <span className="text-sm font-bold text-zinc-900">MyTenants</span>
        </div>
        <span className="text-[13px] text-zinc-400">Self-hosted property management.</span>
      </div>
    </main>
  );
}
