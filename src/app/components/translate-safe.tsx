"use client";

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class TranslateSafe extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    if (error.message?.includes("removeChild") || error.message?.includes("insertBefore") || error.message?.includes("not a child")) {
      return { hasError: true };
    }
    throw error;
  }

  componentDidCatch() {
    setTimeout(() => this.setState({ hasError: false }), 100);
  }

  render() {
    return this.props.children;
  }
}
