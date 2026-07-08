import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Spinner } from '@/components/ui/spinner';

export function ProtectedRoute({ ownerOnly }: { ownerOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid h-screen place-items-center"><Spinner className="size-6" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (ownerOnly && user.role !== 'OWNER') return <Navigate to="/" replace />;
  return <Outlet />;
}
