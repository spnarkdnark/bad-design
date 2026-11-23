/**
 * Keeps one broken part of the UI from blanking the whole app: a render error inside shows a
 * small notice with "Try again" (re-mounts the part) instead. Work is autosaved, so a reload
 * never loses it. Wraps the canvas, the selection bar and each wing separately (App.tsx).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** what this part is, for the notice ("the drawing", "the tools") */
  name: string;
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`B.A.D.: ${this.props.name} failed to draw`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-notice" role="alert">
        <strong>Something went wrong showing {this.props.name}.</strong>
        <span>Your drawing is autosaved.</span>
        <span className="error-actions">
          <button className="btn small" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button className="btn small" onClick={() => window.location.reload()}>
            Reload
          </button>
        </span>
      </div>
    );
  }
}
