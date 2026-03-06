"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createUserAction, deleteUserAction } from "./actions";

type UserItem = {
  id: string;
  username: string;
  displayNameAr: string;
  createdAt: string;
};

type Props = {
  currentUser?: { id: string; username: string | null };
  users: UserItem[];
  maxUsersReached?: boolean;
};

export function AdminClient({ currentUser, users, maxUsersReached }: Props) {
  const [state, formAction] = useActionState(createUserAction, {});

  return (
    <div className="flex flex-col min-h-[100dvh] max-w-[480px] mx-auto">
      {/* الهيدر */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-slate-900/95 backdrop-blur border-b border-white/5 safe-area-inset">
        <h1 className="text-lg font-semibold">إدارة المستخدمين</h1>
        <div className="flex items-center gap-2">
          {currentUser && (
            <span className="text-slate-400 text-sm hidden xs:inline">
              {currentUser.username ?? currentUser.id}
            </span>
          )}
          <Link
            href="/"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            الرئيسية
          </Link>
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-white"
          >
            الدخول
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 pb-8">
        {/* نموذج إنشاء مستخدم (مستخدمان فقط) */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-8">
          <h2 className="text-base font-semibold mb-4">إنشاء مستخدم جديد (حد أقصى مستخدمان)</h2>
          {maxUsersReached ? (
            <p className="text-slate-400 text-sm py-2">
              تم الوصول للحد الأقصى. لا يمكن إضافة المزيد من المستخدمين.
            </p>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              {state?.error && (
                <div className="rounded-xl bg-red-500/20 text-red-200 text-sm px-4 py-3 border border-red-500/30">
                  {state.error}
                </div>
              )}
              {state?.success && (
                <div className="rounded-xl bg-emerald-500/20 text-emerald-200 text-sm px-4 py-3 border border-emerald-500/30">
                  {state.success}
                </div>
              )}
              <div>
                <label htmlFor="username" className="block text-sm text-slate-400 mb-1">
                  اسم المستخدم (للدخول)
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="username"
                />
              </div>
              <div>
                <label htmlFor="displayNameAr" className="block text-sm text-slate-400 mb-1">
                  اسم المستخدم بالعربي
                </label>
                <input
                  id="displayNameAr"
                  name="displayNameAr"
                  type="text"
                  required
                  className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="الاسم الذي يظهر في الدردشة للطرف الآخر"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm text-slate-400 mb-1">
                  كلمة المرور (6 أحرف على الأقل)
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-400 active:scale-[0.98] transition"
              >
                إنشاء المستخدم
              </button>
            </form>
          )}
        </section>

        {/* قائمة المستخدمين */}
        <section>
          <h2 className="text-base font-semibold mb-4">
            المستخدمون ({users.length})
          </h2>
          {users.length === 0 ? (
            <p className="text-slate-500 text-sm py-8 text-center">
              لا يوجد مستخدمون بعد. أنشئ المستخدمين من النموذج أعلاه.
            </p>
          ) : (
            <ul className="space-y-3">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">
                      {user.displayNameAr || user.username}
                    </p>
                    <p className="text-slate-400 text-sm truncate">{user.username}</p>
                  </div>
                  <form action={deleteUserAction} className="flex-shrink-0">
                    <input type="hidden" name="userId" value={user.id} />
                    <button
                      type="submit"
                      className="rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 active:scale-95 transition"
                      title="حذف المستخدم"
                    >
                      حذف
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
