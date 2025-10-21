import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[70vh] grid place-items-center px-4">
      <section className="glass glass-border max-w-xl w-full mx-auto p-8 sm:p-10 text-center">
        <div className="mb-4">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[color-mix(in_oklab,var(--primary),white_20%)] text-white shadow-md">
            <span className="text-2xl font-bold">404</span>
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 neon-text">
          העמוד לא נמצא
        </h1>
        <p className="text-slate-600 mb-6 leading-relaxed">
          נראה שהגעתם לכתובת שאינה קיימת. ייתכן שהקישור שגוי או שהעמוד הועבר.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/login" className="btn-futuristic">
            חזרה לדף הראשי
          </Link>
        </div>
      </section>
    </main>
  );
}
