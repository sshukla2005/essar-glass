import React, { Component } from 'react'
import { Result, Button, Typography } from 'antd'

const { Paragraph, Text } = Typography

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary caught error]:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Result
            status="error"
            title="Something went wrong"
            subTitle={this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
            extra={[
              <Button type="primary" key="reload" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            ]}
          >
            {this.state.errorInfo?.componentStack && (
              <div style={{ textAlign: 'left', marginTop: 16 }}>
                <details style={{ whiteSpace: 'pre-wrap', cursor: 'pointer', background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <summary style={{ fontWeight: 600, color: '#e11d48' }}>Component Call Stack</summary>
                  <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12, fontFamily: 'monospace' }}>
                    {this.state.errorInfo.componentStack}
                  </Paragraph>
                </details>
              </div>
            )}
          </Result>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
