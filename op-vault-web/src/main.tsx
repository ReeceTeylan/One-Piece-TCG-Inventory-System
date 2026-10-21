import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/auth-context';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ImageViewerProvider } from '@/components/common/ImageViewer';
import { router } from '@/routes/router';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 } },
});

// On phones, toasts drop from the top so they never cover the bottom tab bar.
const toastPosition = window.matchMedia('(max-width: 767px)').matches ? 'top-center' : 'bottom-right';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ImageViewerProvider>
            <RouterProvider router={router} />
          </ImageViewerProvider>
          <Toaster position={toastPosition} richColors closeButton />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
