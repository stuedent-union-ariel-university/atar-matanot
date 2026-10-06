"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";

export default function LoginPage() {
    const [userId, setUserId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const validateId = (id: string) => /^[0-9]{7,10}$/.test(id.trim());

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmed = userId.trim();
        if (!validateId(trimmed)) {
            setError("נא להזין מספר זהות חוקי (7-10 ספרות)");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            // The ID goes in the request body, and the server answers with a session cookie.
            const res = await fetch(config.API_VERIFY_ID_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "שגיאת אימות");
            }
            router.push("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "שגיאת אימות");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="font-sans min-h-screen px-5 md:px-10 pb-20 pt-20"
            dir="rtl"
        >
            <main className="max-w-md mx-auto">
                <section className="text-center mb-10">
                    <h1 className="text-3xl md:text-4xl font-bold mb-4">
                        אימות זהות
                    </h1>
                    <p className="text-slate-600">
                        אנא הזינו מספר זהות לצורך אימות זכאות.
                    </p>
                </section>

                <div className="relative">
                    <div
                        className="absolute -inset-6 rounded-[28px] bg-gradient-to-br from-[#3B7FC4]/20 via-transparent to-[#3B7FC4]/5 blur-2xl pointer-events-none"
                        aria-hidden="true"
                    />
                    <form
                        onSubmit={handleSubmit}
                        className="rise-in relative glass glass-border p-6 md:p-8"
                    >
                        <label
                            htmlFor="userId"
                            className="block text-sm font-medium mb-2"
                        >
                            מספר זהות
                        </label>
                        <input
                            id="userId"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={10}
                            autoComplete="one-time-code"
                            className="w-full rounded-lg border px-4 py-2 text-right"
                            placeholder="לדוגמה: 123456789"
                            value={userId}
                            onChange={(e) =>
                                setUserId(e.target.value.replace(/[^0-9]/g, ""))
                            }
                        />

                        {error && (
                            <div className="mt-3 text-rose-700 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || userId.length === 0}
                            className="btn-futuristic mt-6 w-full disabled:opacity-40"
                        >
                            <span className="relative flex items-center justify-center gap-2">
                                {loading && (
                                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                )}
                                {loading ? "מאמת..." : "המשך לבחירת מתנה"}
                            </span>
                        </button>
                    </form>
                </div>

                <p className="mt-10 text-center text-base text-slate-600">
                    לא נמצאתם ברשימה? 🤔
                    <br />
                    <a
                        href="https://forms.monday.com/forms/3b6ab2ac8ef46b225891cd0fec26c84c?r=use1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 font-semibold text-[#3B7FC4] underline underline-offset-4 hover:opacity-80"
                    >
                        כתבו לנו כאן ונבדוק ביחד 💙
                    </a>
                </p>
            </main>
        </div>
    );
}
