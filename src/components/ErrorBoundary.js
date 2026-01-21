import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ ERRO CAPTURADO:', error);
    console.error('📍 Stack:', errorInfo.componentStack);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>😔 Algo deu errado!</Text>
          <Text style={styles.subtitle}>O app encontrou um erro:</Text>
          
          <ScrollView style={styles.errorBox}>
            <Text style={styles.errorText}>
              {this.state.error && this.state.error.toString()}
            </Text>
            
            {this.state.errorInfo && (
              <Text style={styles.stackText}>
                {this.state.errorInfo.componentStack}
              </Text>
            )}
          </ScrollView>
          
          <Text style={styles.hint}>
            💡 Veja os logs completos no Logcat
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e74c3c',
    maxHeight: 400,
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  stackText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  hint: {
    marginTop: 20,
    fontSize: 14,
    color: '#3498db',
    textAlign: 'center',
  },
});

export default ErrorBoundary;
