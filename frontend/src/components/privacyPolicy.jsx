"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORE_NAME = "TRENDLAMA";
const SUPPORT_EMAIL = "juelr5351@gmail.com";
const LAST_UPDATED = "September 29, 2026";

const List = ({ items }) => (
  <ul className="mt-4 space-y-2.5">
    {items.map((item, idx) => (
      <li key={idx} className="flex items-start gap-3 text-slate-600">
        <span className="mt-1.5 flex h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />
        <span className="leading-relaxed">{item}</span>
      </li>
    ))}
  </ul>
);

const sections = [
  {
    id: "information-we-collect",
    title: "Information We Collect",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    body: (
      <>
        <p className="leading-relaxed text-slate-600">
          We collect only essential details necessary to maintain your account securely and process your transactions reliably.
        </p>
        <List
          items={[
            "Account details: your name, email address, phone number, and encrypted passwords.",
            "Order details: purchased items, delivery address, order history, and payment statuses.",
            "Support communications: records of inquiries submitted via contact forms or email.",
            "Device & telemetry data: browser profile, IP addresses, visited paths, and technical crash logs.",
          ]}
        />
        <div className="mt-4 rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 text-xs font-medium text-amber-900">
          <strong>Note:</strong> Sensitive payment credentials (credit cards, digital wallets) are securely handled directly by PCI-DSS compliant payment gateways. We never store raw card numbers.
        </div>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How We Use Your Information",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    body: (
      <List
        items={[
          "Authenticating access and managing user sessions securely.",
          "Fulfilling order processing, shipment tracking, and dispute management.",
          "Resolving customer support requests and incoming tickets efficiently.",
          "Dispatching critical service updates, transactional receipts, and security alerts.",
          "Preventing fraudulent activity, unauthorized access, and automated abuse.",
        ]}
      />
    ),
  },
  {
    id: "who-we-share-with",
    title: "Third-Party Data Sharing",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
    body: (
      <>
        <p className="leading-relaxed text-slate-600">
          We strictly do not sell, rent, or trade your personal data. Sharing is limited exclusively to vetted operational infrastructure partners:
        </p>
        <List
          items={[
            "Payment processors for secure transaction authorization and refunds.",
            "Logistics & shipping partners for fulfillment and address verification.",
            "Cloud infrastructure hosts and email dispatch providers.",
            "Legal entities or regulators strictly when compelled by legal mandates.",
          ]}
        />
      </>
    ),
  },
  {
    id: "cookies-and-sign-in",
    title: "Cookies & Storage Technologies",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    body: (
      <p className="leading-relaxed text-slate-600">
        We utilize essential HTTP cookies and local session storage to remember active shopping carts, preserve user authentication states, and analyze web performance. Disabling cookies in your browser preferences may restrict core capabilities such as account sign-in and checkout.
      </p>
    ),
  },
  {
    id: "your-choices",
    title: "Your Privacy Rights & Controls",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    body: (
      <>
        <p className="leading-relaxed text-slate-600">Depending on your region, you maintain specific legal entitlements concerning your data:</p>
        <List
          items={[
            "Request full export copies of all personal data linked to your identity.",
            "Request rectification of inaccurate or outdated contact profiles.",
            "Request permanent deletion of your customer account and associated records.",
            "Opt out of non-essential transactional communications and promotional digests.",
          ]}
        />
        <div className="mt-5 flex items-center gap-3">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Submit Data Request
          </a>
        </div>
      </>
    ),
  },
  {
    id: "contact",
    title: "Legal & Privacy Contact",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    body: (
      <p className="leading-relaxed text-slate-600">
        For inquiries concerning this document, data rights execution, or security reports, reach out directly through our{" "}
        <Link href="/contact" className="font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-500">
          Contact Portal
        </Link>{" "}
        or directly via email at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-indigo-600 underline underline-offset-4 hover:text-indigo-500">
          {SUPPORT_EMAIL}
        </a>.
      </p>
    ),
  },
];

export default function PrivacyPolicySection({ storeName = STORE_NAME, supportEmail = SUPPORT_EMAIL }) {
  const [activeId, setActiveId] = useState(sections[0].id);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  // Active section scroll tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredSections = sections.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="text-slate-900 antialiased">
      {/* Header Hero */}
      <header className="relative mb-10 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10 shadow-xl shadow-slate-200/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-500/10">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            Legal & Transparency
          </span>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Updated: {LAST_UPDATED}</span>
            <span className="text-slate-300">•</span>
            <span>4 min read</span>
          </div>
        </div>

        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">
          Detailed information regarding how {storeName} gathers, utilizes, and safeguards your digital identity.
        </p>

        {/* Quick Actions & Search Bar */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-6">
          <div className="relative w-full sm:max-w-xs">
            <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter policy topics..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-600/10"
            />
          </div>

          <button
            onClick={handleCopyLink}
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? "Link Copied!" : "Share Policy"}
          </button>
        </div>
      </header>

      {/* Content Layout */}
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Interactive Navigation Column */}
        <nav aria-label="Policy Navigation" className="lg:col-span-4 lg:sticky lg:top-8">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur-xl shadow-lg shadow-slate-200/40">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Contents
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {filteredSections.length} topics
              </span>
            </div>

            <div className="space-y-1">
              {filteredSections.map((s) => {
                const isActive = activeId === s.id;
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span className={`shrink-0 ${isActive ? "text-white" : "text-slate-400"}`}>
                      {s.icon}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Section Cards List */}
        <div className="lg:col-span-8 space-y-6">
          {filteredSections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              No policy topics match your search parameter.
            </div>
          ) : (
            filteredSections.map((s) => (
              <article
                key={s.id}
                id={s.id}
                className="scroll-mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-md shadow-slate-200/40 transition-shadow hover:shadow-xl"
              >
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    {s.icon}
                  </div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {s.title}
                  </h2>
                </div>
                <div className="text-sm">{s.body}</div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}