import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Widget rendering fault.' };
  }

  componentDidCatch(error: Error): void {
    console.error('[FirstPrinciples Widget ErrorBoundary]', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-6 border border-[#B45309] bg-white text-[#111315]">
          <p className="font-mono-lab text-xs uppercase text-[#B45309] mb-1">Calculation Fault Isolated</p>
          <p className="text-sm mb-3">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="px-3 py-1.5 bg-[#1D4ED8] text-white text-xs font-mono-lab cursor-pointer"
          >
            Reset Widget
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
