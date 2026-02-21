import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#b91c1c' }}>Something went wrong</h1>
          <pre style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', overflow: 'auto' }}>
            {this.state.error?.message}
          </pre>
          <p>Check the browser console for details.</p>
        </div>
      )
    }
    return this.props.children
  }
}
