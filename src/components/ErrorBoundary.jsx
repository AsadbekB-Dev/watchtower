import { Component } from 'react';

// Keeps one broken screen from taking down the whole app
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[watchtower] ${this.props.name || 'view'} crashed:`, error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, () => this.setState({ error: null }));
    return (
      <div className="crash">
        <b>{this.props.name || 'This screen'} hit a problem.</b>
        <span>{String(this.state.error.message || this.state.error)}</span>
        <button className="btn" onClick={() => this.setState({ error: null })}>Reload this screen</button>
      </div>
    );
  }
}
