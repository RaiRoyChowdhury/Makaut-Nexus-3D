import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface State {
  hasError: boolean;
  message: string;
}

export class FirebaseErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    let parsedMsg = error.message || "Unexpected application error.";
    try {
      const json = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (json && json.error) {
        parsedMsg = `Cloud permission error (${json.operationType ?? "op"} on ${json.path ?? "unknown"}): ${json.error}`;
      }
    } catch {
      // keep plain message
    }
    return { hasError: true, message: parsedMsg };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#06080E] text-[#F4F7FB] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl bg-[#0D1322] border border-[#EF4444]/40 p-6 space-y-4 shadow-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-[#FCA5A5]">
              <AlertTriangle className="w-4 h-4" />
              <span>RUNTIME / FIRESTORE GUARD</span>
            </div>
            <h2 className="text-lg font-bold text-[#F4F7FB]">Something tripped a safety boundary</h2>
            <p className="text-xs font-mono text-[#CBD5E1] bg-[#090C14] border border-white/10 rounded-xl p-3 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: "" });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00F5D4] text-[#06080E] text-xs font-bold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
