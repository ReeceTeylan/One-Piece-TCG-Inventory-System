import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import { apiError } from '@/lib/api';

const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Password required') });
type Form = z.infer<typeof schema>;

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);

  // After ~4s of waiting, assume the free-tier server may be waking from sleep.
  useEffect(() => {
    if (!loading) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [loading]);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema), defaultValues: { email: 'owner@opvault.ph', password: '' },
  });
  if (user) navigate('/', { replace: true });

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try { await login(data.email, data.password); navigate('/', { replace: true }); }
    catch (e) {
      const msg = apiError(e).message;
      const looksNetwork = /network|timeout|failed to fetch/i.test(msg);
      toast.error(looksNetwork
        ? 'Couldn’t reach the server. It may be waking up after inactivity — please try again in a moment.'
        : msg);
    }
    finally { setLoading(false); }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-5">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-4 grid size-12 place-items-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-900 text-xl font-extrabold text-white">OP</div>
        <h1 className="text-xl font-bold">OP-Vault</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">One Piece TCG inventory & sales control</p>
        <div className="space-y-3">
          <div><Label htmlFor="email">Email</Label><Input id="email" autoComplete="username" {...register('email')} className="mt-1.5" />{errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}</div>
          <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" {...register('password')} className="mt-1.5" />{errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}</div>
        </div>
        <Button type="submit" className="mt-5 h-10 w-full" disabled={loading}>
          {loading ? (slow ? 'Waking the server…' : 'Signing in…') : 'Sign in'}
        </Button>
        {slow && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            The server may be waking up after inactivity. This can take up to a minute on the first try.
          </p>
        )}
      </form>
    </div>
  );
}
