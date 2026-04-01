import React from 'react';

export class ErrorBoundary extends React.Component<any, any> {
  public state: any;
  public props: any;

  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong. Please try again later.";
      
      try {
        const errorMsg = this.state.error?.message || "";
        if (errorMsg.startsWith('{')) {
          const parsedError = JSON.parse(errorMsg);
          if (parsedError.error && parsedError.operationType) {
            errorMessage = `Firestore Error: ${parsedError.error} during ${parsedError.operationType} operation.`;
          }
        }
      } catch (e) {
        if (this.state.error?.message) {
          errorMessage = this.state.error.message;
        }
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50">
          <div className="p-8 bg-white rounded-2xl shadow-xl max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Application Error</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
