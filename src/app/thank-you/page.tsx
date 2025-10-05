import Link from "next/link";
import { Suspense } from "react";
import { ThankYouContent } from "./thankyou-content";

export const metadata = {
  title: "תודה | בחירת מתנה",
};

export default function ThankYouPage() {
  return (
    <div className="font-sans min-h-screen px-5 md:px-10 pb-20 pt-16" dir="rtl">
      <main className="max-w-3xl mx-auto text-center">
        <Suspense fallback={<div className="spinner mx-auto mt-20" />}>
          <ThankYouContent />
        </Suspense>
        <div className="mt-14 text-sm text-slate-600">
          <p>במידה וחלה שגיאה או שיש בעיה בבחירה שלך, אנא פנה לנציג האגודה.</p>
          <p className="mt-2">
            <Link
              href="/"
              className="underline text-slate-700 hover:text-[#3B7FC4] transition"
            >
              חזרה לדף הראשי
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
