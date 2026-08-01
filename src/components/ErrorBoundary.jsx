import React from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('RFC UI section failed', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-panel">
          <AlertTriangle size={22} />
          <div>
            <h3>{this.props.title}</h3>
            <p>Please refresh this section and try again.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  title: PropTypes.string,
  children: PropTypes.node.isRequired
};

ErrorBoundary.defaultProps = {
  title: 'Something went wrong'
};
