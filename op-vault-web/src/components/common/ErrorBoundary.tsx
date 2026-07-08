import React from 'react';
import { Button } from '@/components/ui/button';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; msg?: string }> {
  state = { hasError: false, msg: undefined as string | undefined };
  static getDerivedStateFromError(err: Error) { return { hasError: true, msg: err.message }; }
  componentDidCatch(err: Error) { console.error('UI error:', err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="grid h-screen place-items-center p-6 text-center">
          <div>
            <h2 className="text-lg font-semibold">Something broke</h2>
            <p className="mt-1 text-sm text-muted-foreground">{this.state.msg}</p>
            <Button className="mt-4" onClick={() => location.reload()}>Reload</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
