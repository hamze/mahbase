import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MessageCircleQuestion } from 'lucide-react';
import { askQuestion } from '@/api/catalog';
import { questionsQuery } from '@/api/queries';
import { useAuth } from '@/lib/AuthContext';
import { formatJalali } from '@/lib/jalali';
import RichText from './RichText';

function AskForm({ productId }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      await askQuestion(productId, text);
      setText('');
      setResult({ ok: true, text: 'پرسش شما ثبت شد و پس از پاسخ‌گویی نمایش داده می‌شود.' });
    } catch (error) {
      setResult({ ok: false, text: error.messages?.[0] || 'ثبت پرسش انجام نشد.' });
    }
    setSending(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="پرسش خود را درباره این محصول بنویسید"
        rows={3}
        required
        className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
      />
      {result && <p className={result.ok ? 'rounded-xl bg-success/10 p-3 text-xs text-success' : 'rounded-xl bg-destructive/10 p-3 text-xs text-destructive'}>{result.text}</p>}
      <button type="submit" disabled={sending} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {sending && <Loader2 className="h-4 w-4 animate-spin" />} ثبت پرسش
      </button>
    </form>
  );
}

/** Answered questions (answers are sanitized HTML) and the ask form for signed-in customers. */
export default function ProductQuestions({ productId }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const questions = useQuery(questionsQuery(productId));
  const list = questions.data?.results || [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">پرسش و پاسخ</h2>
      {questions.isLoading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">هنوز پرسشی برای این محصول پاسخ داده نشده است.</p>
      ) : (
        <div className="space-y-3">
          {list.map((question) => (
            <div key={question.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {question.question_text}
              </p>
              <span className="text-xs text-muted-foreground">{formatJalali(question.created_at)}</span>
              <div className="mt-2 border-r-2 border-primary/30 pr-3">
                <RichText html={question.answer_text} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card p-4">
        {isAuthenticated ? (
          <AskForm productId={productId} />
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">
            برای ثبت پرسش ابتدا{' '}
            <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`} className="text-primary hover:underline">وارد حساب کاربری</Link>{' '}
            شوید.
          </p>
        )}
      </div>
    </div>
  );
}
