import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Spinner } from '@/components/ui/spinner';

export function ProtectedRoute({ ownerOnly }: { ownerOnly?: boolean }) {
  // 1. Destructure 'slow' from the context
  const { user, loading, slow } = useAuth();
  
  if (loading) {
    return (
      // 2. Swapped to flex-col to stack the text neatly under the spinner
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Spinner className="size-6" />
        {/* 3. Render the waking text if 4 seconds have passed */}
        {slow && (
          <p className="text-sm text-muted-foreground animate-pulse text-center">
            Waking the server (this can take up to 50s)...
          </p>
        )}
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (ownerOnly && user.role !== 'OWNER') return <Navigate to="/" replace />;
  return <Outlet />;
}