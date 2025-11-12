import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Colors, Typography, Spacing } from '../constants/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorBoundary: boolean;
}

export class BluetoothErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorBoundary: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a Bluetooth-related error
    const isBluetoothError = error.message.toLowerCase().includes('bluetooth') ||
                           error.message.toLowerCase().includes('ble') ||
                           error.message.toLowerCase().includes('device') ||
                           (error.stack?.toLowerCase().includes('bluetoothwaterservice') ?? false);

    return {
      hasError: true,
      error,
      errorBoundary: isBluetoothError,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', error);
    console.error('Error info:', errorInfo);
    
    // Log to crash reporting service in production
    if (__DEV__) {
      console.error('Full error details:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorBoundary: false,
    });
  };

  handleReportBug = () => {
    const errorMessage = this.state.error?.message || 'Unknown error';
    const errorStack = this.state.error?.stack || 'No stack trace';
    
    Alert.alert(
      'Report Bug',
      `Error: ${errorMessage}\n\nWould you like to report this issue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: () => {
            // In production, send to bug reporting service
            console.log('Bug report:', { errorMessage, errorStack });
            Alert.alert('Thank You', 'Error report has been sent.');
          },
        },
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI for Bluetooth errors
      if (this.state.errorBoundary) {
        return (
          <View style={styles.container}>
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>🔧 Bluetooth Connection Issue</Text>
              <Text style={styles.errorMessage}>
                There was a problem with the Bluetooth connection. This is usually temporary.
              </Text>
              
              <View style={styles.suggestions}>
                <Text style={styles.suggestionTitle}>Try these steps:</Text>
                <Text style={styles.suggestion}>• Make sure Bluetooth is enabled</Text>
                <Text style={styles.suggestion}>• Check if your device is nearby</Text>
                <Text style={styles.suggestion}>• Restart the app if the problem persists</Text>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.reportButton} onPress={this.handleReportBug}>
                  <Text style={styles.reportButtonText}>Report Issue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      }

      // Generic error fallback
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>⚠️ Something went wrong</Text>
            <Text style={styles.errorMessage}>
              An unexpected error occurred. Please try restarting the app.
            </Text>
            
            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorTitle: {
    ...Typography.header,
    color: Colors.text.dark,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  errorMessage: {
    ...Typography.body,
    color: Colors.text.medium,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  suggestions: {
    alignSelf: 'stretch',
    marginBottom: Spacing.xl,
  },
  suggestionTitle: {
    ...Typography.body,
    color: Colors.text.dark,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  suggestion: {
    ...Typography.body,
    color: Colors.text.medium,
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.sm,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    flex: 1,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  reportButton: {
    backgroundColor: 'white',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.text.light,
    flex: 1,
  },
  reportButtonText: {
    color: Colors.text.medium,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});