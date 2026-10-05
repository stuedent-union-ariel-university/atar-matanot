// src/app/page.tsx

import { Suspense } from "react";
import { redirect } from "next/navigation";
import GiftGrid from "@/components/GiftGrid";
import { getSessionUserId } from "@/lib/session";

export default async function Home() {
  // No verified session cookie: send the user to log in first.
  if (!(await getSessionUserId())) {
    redirect("/login");
  }
  return (
    <div className="font-sans min-h-screen px-5 md:px-10 pb-20 pt-20">
      <main className="max-w-6xl mx-auto">
        <section className="text-center mb-12 md:mb-16 relative">
          <div className="mx-auto max-w-3xl">
            <h1 className="fancy-underline neon-text text-4xl md:text-5xl font-bold mb-5 leading-tight">
              בחר/י את המתנה שלך
            </h1>
            <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-600 leading-relaxed">
              לחץ/י על המתנה שברצונך לבחור. כל מתנה ניתנת לבחירה פעם אחת בלבד.
              אנחנו משתמשים באימות כדי להבטיח הוגנות ושקיפות.
            </p>
          </div>

          {/* soft gradient halo */}
          <div
            className="pointer-events-none absolute -inset-x-10 -bottom-6 top-1/2 bg-linear-to-b from-transparent via-[#3B7FC4]/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
        </section>

        <div className="relative">
          <div
            className="absolute -inset-6 rounded-[28px] bg-linear-to-br from-[#3B7FC4]/20 via-transparent to-[#3B7FC4]/5 blur-2xl pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative glass glass-border p-6 md:p-10">
            <Suspense
              fallback={
                <div className="flex justify-center py-14">
                  <div className="spinner" />
                </div>
              }
            >
              <GiftGrid />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
