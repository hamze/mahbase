'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Smartphone, ArrowRight } from 'lucide-react';
import { requestLoginCode } from '@/api/auth';
import { useAuth } from '@/lib/AuthContext';
import { faNum } from '@/lib/format';
import { useStoreSettings } from '@/hooks/use-site-content';
import { BrandMark } from '@/components/store/Header';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const CODE_LENGTH = 6;

/** Same-origin path only: a single leading "/", no protocol-relative "//" and no backslashes. */
function safeReturnTo(value) {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  return '/account';
}

/** Seconds left until ``until`` (ms timestamp), refreshed every second. */
function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

const formatSeconds = (seconds) =>
  `${faNum(Math.floor(seconds / 60))}:${faNum(seconds % 60).padStart(2, '۰')}`;

export default function Login() {
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const settings = useStoreSettings();

  const [step, setStep] = useState('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState(null);
  const secondsLeft = useCountdown(resendAt);

  const signedIn = isAuthenticated && !loading;
  useEffect(() => {
    if (signedIn) router.replace(returnTo);
  }, [signedIn, returnTo, router]);
  if (signedIn) return null;

  const sendCode = async () => {
    setError('');
    setLoading(true);
    try {
      const { resend_in: resendIn } = await requestLoginCode(mobile.trim());
      setResendAt(Date.now() + resendIn * 1000);
      setCode('');
      setStep('code');
    } catch (err) {
      setError(err.messages?.join(' ') || 'ارسال کد انجام نشد. دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (value = code) => {
    setError('');
    setLoading(true);
    try {
      await login(mobile.trim(), value);
      router.replace(returnTo);
    } catch (err) {
      setError(err.messages?.join(' ') || 'ورود انجام نشد. دوباره تلاش کنید.');
      setLoading(false);
    }
  };

  const onCodeChange = (value) => {
    setCode(value);
    if (value.length === CODE_LENGTH && !loading) verify(value);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex justify-center">
          <BrandMark settings={settings} />
        </Link>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          {step === 'mobile' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendCode();
              }}
              className="space-y-4"
            >
              <div className="text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Smartphone className="h-6 w-6" />
                </div>
                <h1 className="text-lg font-bold text-foreground">ورود یا ثبت‌نام</h1>
                <p className="mt-1 text-sm text-muted-foreground">شماره موبایل خود را وارد کنید تا کد ورود برایتان پیامک شود.</p>
              </div>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                dir="ltr"
                placeholder="09xxxxxxxxx"
                className="h-12 w-full rounded-xl border border-border bg-background px-4 text-center text-base tracking-wider outline-none focus:border-primary"
                required
              />
              {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" className="h-12 w-full gap-2 rounded-xl" disabled={loading || !mobile.trim()}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} دریافت کد ورود
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={() => {
                  setStep('mobile');
                  setError('');
                }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
              >
                <ArrowRight className="h-4 w-4" /> ویرایش شماره
              </button>
              <div className="text-center">
                <h1 className="text-lg font-bold text-foreground">کد تایید</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  کد ارسال‌شده به شماره <span dir="ltr" className="font-medium text-foreground">{mobile}</span> را وارد کنید.
                </p>
              </div>
              <div className="flex justify-center" dir="ltr">
                <InputOTP maxLength={CODE_LENGTH} value={code} onChange={onCodeChange} autoFocus disabled={loading}>
                  <InputOTPGroup>
                    {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} className="h-11 w-11 text-base" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" className="h-12 w-full gap-2 rounded-xl" disabled={loading || code.length < CODE_LENGTH}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} ورود
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                {secondsLeft > 0 ? (
                  <span>ارسال مجدد کد تا {formatSeconds(secondsLeft)} دیگر</span>
                ) : (
                  <button type="button" onClick={sendCode} disabled={loading} className="text-primary hover:underline">
                    ارسال مجدد کد
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
