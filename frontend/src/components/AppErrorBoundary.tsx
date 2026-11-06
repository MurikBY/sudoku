import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export function FatalErrorScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <p className="font-mono text-sm tracking-wide text-primary">Something went wrong.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="border border-primary px-3 py-2 font-mono text-sm tracking-wide text-primary"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <FatalErrorScreen />;
    }
    return this.props.children;
  }
}
