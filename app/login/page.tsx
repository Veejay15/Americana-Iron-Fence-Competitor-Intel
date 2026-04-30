import { redirect } from 'next/navigation';
import Image from 'next/image';
import { isAuthenticated } from '@/lib/session';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const authed = await isAuthenticated();
  const { next, error } = await searchParams;

  if (authed) {
    redirect(next || '/');
  }

  return (
    <div className="flex items-center justify-center py-16 min-h-[70vh]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/americana-logo.png"
            alt="Americana Iron Works"
            width={180}
            height={42}
            priority
            className="h-10 w-auto mx-auto"
          />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            Competitor Intelligence
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to access weekly reports and analytics
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <LoginForm next={next} initialError={error} />
        </div>
      </div>
    </div>
  );
}
