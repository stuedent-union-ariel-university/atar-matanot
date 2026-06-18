"use client"; // This ensures the component is only rendered on the client side

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { config, isSubmissionClosed } from "@/lib/config";
import type { Gift } from "@/lib/gifts";

export default function GiftGrid() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get("userId");

  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [isEligible, setIsEligible] = useState(false);
  // Blocking errors (not eligible / verification failed) replace the grid entirely.
  const [blockingError, setBlockingError] = useState<string | null>(null);
  // Submit errors are shown inline so the user can pick again (e.g. gift just ran out).
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [giftsLoading, setGiftsLoading] = useState(true);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);

  const isAfterDeadline = isSubmissionClosed();

  const fetchGifts = useCallback(async () => {
    try {
      const res = await fetch(config.API_GIFTS_URL, { cache: "no-store" });
      if (!res.ok) return; // silent fail; grid shows empty state
      const data = await res.json();
      setGifts(data.gifts || []);
    } catch {
      // ignore; grid shows empty state
    } finally {
      setGiftsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  useEffect(() => {
    if (!userId) {
      setCheckingEligibility(false);
      return;
    }

    let cancelled = false;
    const checkEligibility = async () => {
      try {
        const response = await fetch(
          `${config.API_CHECK_GIFT_URL}?userId=${encodeURIComponent(userId)}`,
        );
        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          throw new Error(data.error || "אירעה שגיאה");
        }
        setIsEligible(true);
      } catch (err) {
        if (!cancelled) {
          setBlockingError(err instanceof Error ? err.message : "אירעה שגיאה");
        }
      } finally {
        if (!cancelled) {
          setCheckingEligibility(false);
        }
      }
    };

    checkEligibility();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSubmit = async () => {
    if (!userId || !selectedGiftId) {
      setSubmitError("יש לבחור מתנה תחילה");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(config.API_SUBMIT_GIFT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, giftId: selectedGiftId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "אירעה שגיאה בשמירת הבחירה");
      }

      setSubmitError(null);

      // Redirect to thank you page with gift title (encode to be safe in URL)
      const chosenGift = gifts.find((g) => g.id === selectedGiftId);
      const giftTitle = chosenGift ? encodeURIComponent(chosenGift.title) : "";
      router.push(`/thank-you?gift=${giftTitle}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "אירעה שגיאה בשמירת הבחירה",
      );
      // Stock may have changed under us — refresh the list so the user
      // sees an up-to-date selection.
      setSelectedGiftId(null);
      fetchGifts();
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingEligibility || giftsLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto flex items-center justify-center min-h-50">
        <div className="spinner" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="alert alert-error text-rose-800 mb-6">
        מספר זהות לא נמצא בקישור
      </div>
    );
  }

  if (blockingError) {
    return (
      <div className="alert alert-error text-rose-800 mb-6">
        <span className="font-semibold text-rose-700">שגיאה:</span>{" "}
        {blockingError}
      </div>
    );
  }

  if (isAfterDeadline) {
    return (
      <div className="alert alert-error text-rose-800 mb-6 py-8" dir="rtl">
        <h2 className="text-xl font-bold mb-2">מועד בחירת המתנות הסתיים</h2>
        <p>ניתן היה לבחור מתנה עד ל-1 במרץ 2026 בחצות.</p>
      </div>
    );
  }

  if (!isEligible) {
    return null;
  }

  const inStockGifts = gifts.filter(
    (gift) => (gift.remaining ?? gift.stock ?? 0) > 0,
  );

  return (
    <div className="w-full max-w-5xl mx-auto text-center" dir="rtl">
      <div className="alert alert-success text-emerald-800 mb-8">
        <span className="font-semibold text-emerald-700">מזל טוב!</span> אתה
        זכאי לבחור מתנה. לאחר השליחה לא ניתן לשנות בחירה.
      </div>
      {submitError && (
        <div className="alert alert-error text-rose-800 mb-6" role="alert">
          <span className="font-semibold text-rose-700">שגיאה:</span>{" "}
          {submitError}
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {inStockGifts.map((gift) => {
          const selected = gift.id === selectedGiftId;
          return (
            <button
              key={gift.id}
              type="button"
              onClick={() => setSelectedGiftId(gift.id)}
              aria-pressed={selected}
              className={`relative group rounded-2xl border p-4 text-right transition shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B7FC4]/40 ${
                selected
                  ? "border-[#3B7FC4]/50 bg-[#3B7FC4]/10"
                  : "border-black/10 bg-white/60"
              }`}
              dir="rtl"
            >
              {selected && (
                <span className="absolute -top-2 -left-2 bg-[#3B7FC4] text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                  נבחר
                </span>
              )}
              {gift.image && (
                <div className="w-full relative mb-4 rounded-lg overflow-hidden bg-white/70 aspect-4/3">
                  <Image
                    src={gift.image}
                    alt={gift.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-contain object-center opacity-95 group-hover:opacity-100 transition-transform duration-300 group-hover:scale-[1.02]"
                    priority={false}
                  />
                </div>
              )}
              <h3 className="font-semibold text-lg mb-1 tracking-tight">
                {gift.title}
              </h3>
              {gift.description && (
                <p className="text-sm text-slate-600 leading-relaxed">
                  {gift.description}
                </p>
              )}
              {/* subtle primary glow on hover */}
              <span
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px rgba(59,127,196,0.12), 0 10px 22px -12px rgba(59,127,196,0.35)",
                }}
                aria-hidden="true"
              />
            </button>
          );
        })}
        {inStockGifts.length === 0 && (
          <div className="col-span-full text-slate-500 text-sm">
            לא נמצאו מתנות כרגע.
          </div>
        )}
      </div>
      <div className="mt-8 flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedGiftId}
          className="btn-futuristic min-w-40 disabled:opacity-40"
        >
          <span className="relative flex items-center justify-center gap-2">
            {submitting && (
              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {submitting ? "שולח..." : selectedGiftId ? "שלח בחירה" : "בחר מתנה"}
          </span>
        </button>
      </div>
    </div>
  );
}
