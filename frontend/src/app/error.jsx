'use client';

/** Shown when a page cannot be rendered (e.g. the backend is unreachable). */
export default function Error({ reset }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-bold text-foreground">بارگذاری صفحه انجام نشد</h1>
      <p className="mt-2 text-sm text-muted-foreground">لطفاً چند لحظه بعد دوباره تلاش کنید.</p>
      <button onClick={reset} className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">
        تلاش دوباره
      </button>
    </div>
  );
}
