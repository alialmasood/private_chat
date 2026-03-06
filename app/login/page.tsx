"use client";

import { useActionState } from "react";
import Image from "next/image";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, {});

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 safe-area-inset">
        <div className="w-full max-w-[360px]">
          {/* الشعار والعنوان */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-6 shadow-lg overflow-hidden">
              <Image
                src="/icon.jpg"
                alt="شعار التطبيق"
                width={64}
                height={64}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <p className="text-slate-400 text-sm mt-2">سجّل الدخول للمتابعة</p>
          </div>

          {/* نموذج الدخول */}
          <form
            action={formAction}
            className="flex flex-col gap-5"
            noValidate
          >
            {state?.error && (
              <div
                className="rounded-xl bg-red-500/20 text-red-200 text-sm px-4 py-3 border border-red-500/30"
                role="alert"
              >
                {state.error}
              </div>
            )}

            <div>
              <label
                htmlFor="login"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                اسم المستخدم
              </label>
              <input
                id="login"
                name="login"
                type="text"
                autoComplete="username"
                placeholder="أدخل اسم المستخدم"
                required
                className="w-full h-13 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 px-4 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                كلمة المرور
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className="w-full h-13 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 px-4 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full h-13 rounded-xl bg-emerald-500 text-white font-semibold text-base shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-[0.98] transition"
            >
              تسجيل الدخول
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
