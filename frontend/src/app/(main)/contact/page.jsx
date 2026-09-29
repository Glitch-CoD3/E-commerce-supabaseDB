"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/services/authContext";
// import { sendContactMessage } from "@/services/contact.service";

const TOPICS = [
  { value: "order", label: "Order issue" },
  { value: "payment", label: "Payment or refund" },
  { value: "product", label: "Product question" },
  { value: "account", label: "Account help" },
  { value: "other", label: "Something else" },
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-600/10";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPage() {
  const { user } = useAuth() ?? {};

  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: "order",
    orderNumber: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | success | error

  // Pre-fill for logged-in users
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      name: f.name || user.full_name || "",
      email: f.email || user.email || "",
    }));
  }, [user]);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const validate = () => {
    const er = {};
    if (!form.name.trim()) er.name = "Enter your full name.";
    if (!EMAIL_RE.test(form.email)) er.email = "Enter a valid email address.";
    if (form.message.trim().length < 10)
      er.message = "Please describe your message in at least 10 characters.";
    return er;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) return;

    setStatus("sending");
    try {
      await sendContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        topic: form.topic,
        order_number: form.orderNumber.trim() || undefined,
        message: form.message.trim(),
      });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const resetForm = () => {
    setForm((f) => ({ ...f, topic: "order", orderNumber: "", message: "" }));
    setStatus("idle");
  };

  const showOrderField = form.topic === "order" || form.topic === "payment";

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 antialiased">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        
        {/* Header Section */}
        <div className="mx-auto max-w-3xl text-center mb-12 sm:mb-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-500/10 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
            We&apos;re here to help
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Get in touch with us
          </h1>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Have a question about an order, payment, or product? Our support team is ready to assist you.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-12 lg:gap-12 items-start">
          
          {/* Left Column: Support Info */}
          <section className="lg:col-span-5 space-y-8">
            <div className="rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-xl p-6 sm:p-8 shadow-xl shadow-slate-200/50">
              <h2 className="text-xl font-bold text-slate-900">Contact Information</h2>
              <p className="mt-2 text-sm text-slate-600">
                Reach out directly or fill out the form—we&apos;ll resolve your query as quickly as possible.
              </p>

              <dl className="mt-8 space-y-6 text-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">Email us</dt>
                    <dd className="mt-0.5 text-slate-600">
                      <a href="mailto:support@yourstore.com" className="hover:text-indigo-600 transition-colors">
                        support@yourstore.com
                      </a>
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">Support hours</dt>
                    <dd className="mt-0.5 text-slate-600">Sat–Thu, 10:00 AM – 8:00 PM</dd>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">Response time</dt>
                    <dd className="mt-0.5 text-slate-600">Typically within 24 hours</dd>
                  </div>
                </div>
              </dl>
            </div>

            {/* Tip Card */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 text-sm text-indigo-900">
              <div className="flex items-center gap-2 font-semibold">
                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Order Support Tip
              </div>
              <p className="mt-1.5 leading-relaxed text-indigo-800/80">
                Including your order number helps us look up details immediately and speed up your response time.
              </p>
            </div>
          </section>

          {/* Right Column: Form Container */}
          <section className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-10">
              {status === "success" ? (
                <div role="status" className="py-8 text-center sm:py-12">
                  <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
                    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Message sent!</h2>
                  <p className="mx-auto mt-3 max-w-sm text-slate-600">
                    Thanks, <span className="font-semibold text-slate-900">{form.name.split(" ")[0] || "there"}</span>. We&apos;ve received your message and will reply to <span className="font-semibold text-slate-900">{form.email}</span> shortly.
                  </p>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="mt-8 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-600/20 active:scale-[0.99]"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-6">
                  {/* Topic Choice */}
                  <fieldset>
                    <legend className="mb-3 text-sm font-semibold text-slate-900">
                      What do you need help with?
                    </legend>
                    <div className="flex flex-wrap gap-2.5">
                      {TOPICS.map((t) => (
                        <div key={t.value}>
                          <input
                            id={`topic-${t.value}`}
                            type="radio"
                            name="topic"
                            value={t.value}
                            checked={form.topic === t.value}
                            onChange={set("topic")}
                            className="peer sr-only"
                          />
                          <label
                            htmlFor={`topic-${t.value}`}
                            className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-100 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:shadow-sm peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-600/20"
                          >
                            {t.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  {/* Name + Email */}
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Full name" error={errors.name} htmlFor="name">
                      <input
                        id="name"
                        type="text"
                        autoComplete="name"
                        value={form.name}
                        onChange={set("name")}
                        aria-invalid={!!errors.name}
                        className={`${inputClass} ${errors.name ? "!border-red-300 !bg-red-50/30 focus:!border-red-500 focus:!ring-red-500/10" : ""}`}
                        placeholder="e.g. Jane Doe"
                      />
                    </Field>

                    <Field label="Email address" error={errors.email} htmlFor="email">
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={set("email")}
                        aria-invalid={!!errors.email}
                        className={`${inputClass} ${errors.email ? "!border-red-300 !bg-red-50/30 focus:!border-red-500 focus:!ring-red-500/10" : ""}`}
                        placeholder="you@example.com"
                      />
                    </Field>
                  </div>

                  {/* Order Number Field */}
                  {showOrderField && (
                    <Field label="Order number (optional)" htmlFor="orderNumber">
                      <input
                        id="orderNumber"
                        type="text"
                        value={form.orderNumber}
                        onChange={set("orderNumber")}
                        className={inputClass}
                        placeholder="e.g. #10482"
                      />
                    </Field>
                  )}

                  {/* Message Field */}
                  <Field label="Message" error={errors.message} htmlFor="message">
                    <textarea
                      id="message"
                      rows={5}
                      value={form.message}
                      onChange={set("message")}
                      aria-invalid={!!errors.message}
                      className={`${inputClass} resize-y min-h-[120px] ${errors.message ? "!border-red-300 !bg-red-50/30 focus:!border-red-500 focus:!ring-red-500/10" : ""}`}
                      placeholder="Describe your issue or question in detail..."
                    />
                  </Field>

                  {/* Error Alert */}
                  {status === "error" && (
                    <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-800">
                      <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>We couldn&apos;t send your message. Please check your connection and try again.</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-600/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-600/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {status === "sending" && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    )}
                    {status === "sending" ? "Sending message…" : "Send message"}
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, htmlFor, error, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}