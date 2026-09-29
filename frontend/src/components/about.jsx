import Image from "next/image";
import Link from "next/link";

const STORE_NAME = "Your Store";

const STATS = [
  { value: "50K+", label: "Happy Customers" },
  { value: "99.4%", label: "Satisfaction Rate" },
  { value: "24/7", label: "Dedicated Support" },
  { value: "100%", label: "Authentic Items" },
];

const VALUES = [
  {
    title: "Curated Quality",
    description:
      "Every product in our catalog undergoes rigorous quality checks to ensure only high-grade materials reach your doorstep.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    title: "Transparent Pricing",
    description:
      "No hidden fees or unexpected checkout surges. We offer fair, direct-to-consumer pricing year-round.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Sustainability First",
    description:
      "We partner with eco-conscious suppliers and utilize minimal, recyclable packaging materials to lower our carbon footprint.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a2.5 2.5 0 002.5-2.5V11.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 5H12a2 2 0 00-2 2v1.5a.5.5 0 01-.5.5H8z" />
      </svg>
    ),
  },
];

export default function AboutSection({ storeName = STORE_NAME }) {
  // Schema.org Structured Data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `About ${storeName}`,
    description:
      "Learn about our mission, values, and commitment to delivering premium products.",
    publisher: {
      "@type": "Organization",
      name: storeName,
      logo: {
        "@type": "ImageObject",
        url: "/featured.png",
      },
    },
  };

  return (
    <section className="w-full bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 antialiased">
      {/* Inject Structured Data JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 space-y-12">
        
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10 shadow-xl shadow-slate-200/50 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-500/10 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
            Our Story & Mission
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Redefining Modern E-Commerce
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg leading-relaxed">
            Founded with a vision to streamline online shopping, {storeName} blends premium craftsmanship, transparent ethics, and effortless digital navigation.
          </p>

          {/* Stat Grid */}
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-slate-100 pt-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="p-2">
                <p className="text-2xl font-black text-indigo-600 sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Banner Section */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-900 shadow-xl shadow-slate-200/50">
          <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full min-h-[260px]">
            <Image
              src="/featured.png"
              alt={`${storeName} brand showcase`}
              fill
              priority
              className="object-cover opacity-85 transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
              <span className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Built for you</span>
              <h2 className="mt-1 text-xl sm:text-2xl font-bold">Crafted with precision. Delivered with care.</h2>
            </div>
          </div>
        </div>

        {/* Mission Statement & Values */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Why Shop With Us?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              The foundational principles driving our daily operations and product selection.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {VALUES.map((val) => (
              <div
                key={val.title}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
                  {val.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900">{val.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{val.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Support CTA */}
        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent p-6 sm:p-10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Have questions or feedback?</h3>
            <p className="mt-1 text-sm text-slate-600">
              Our customer success team is ready to answer any questions about our products or process.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-600/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-600/30 active:scale-95"
          >
            Get in Touch
          </Link>
        </div>

      </div>
    </section>
  );
}