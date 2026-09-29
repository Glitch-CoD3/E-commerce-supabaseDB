import Link from "next/link";

export const metadata = {
    title: "Access denied",
};

export default function Unauthorized() {
    return (
        <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8 text-slate-900 sm:px-6">
            <section
                aria-labelledby="unauth-title"
                className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:max-w-lg"
            >
                {/* Warning tape */}
                <div
                    aria-hidden="true"
                    className="h-3 bg-[repeating-linear-gradient(-45deg,#f2c230_0_14px,#1b2430_14px_28px)] sm:h-4"
                />

                <div className="p-6 sm:p-8 md:p-10">
                    <svg
                        className="mb-4 h-10 w-10 text-slate-900 sm:h-12 sm:w-12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <rect x="4" y="10.5" width="16" height="10" rx="2" />
                        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
                        <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
                    </svg>

                    <h1
                        id="unauth-title"
                        className="text-2xl font-bold tracking-tight sm:text-3xl"
                    >
                        Admin access only
                    </h1>

                    <p className="mt-3 max-w-prose text-sm leading-relaxed text-slate-600 sm:text-base">
                        Your account doesn&apos;t have permission to open the
                        dashboard. If you think this is a mistake, ask an admin
                        to update your role.
                    </p>

                    <div className="mt-7 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <Link
                            href="/"
                            className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-5 py-2.5 font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 sm:w-auto"
                        >
                            Back to store
                        </Link>

                        <span className="text-center text-sm text-slate-500 sm:text-right">
                            Error 403
                        </span>
                    </div>
                </div>
            </section>
        </main>
    );
}
