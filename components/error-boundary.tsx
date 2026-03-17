'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4" dir="rtl">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-navy mb-1">משהו השתבש</h3>
            <p className="text-sm text-grey max-w-xs">
              {this.state.error?.message || 'אירעה שגיאה בלתי צפויה. נסה לרענן את הדף.'}
            </p>
          </div>
          <Button
            onClick={() => this.setState({ hasError: false })}
            variant="outline"
            className="gap-2 rounded-xl"
          >
            <RefreshCw className="h-4 w-4" />
            נסה שוב
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
