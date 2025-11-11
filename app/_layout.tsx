import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/providers/auth-provider";
import { HydrationProvider } from "@/providers/hydration-proider";
import { CaretakerAuthProvider } from "@/providers/caretaker-auth-provider";
import 'react-native-get-random-values';

// Set up global error handler for BLE and other uncaught promise rejections
const setupGlobalErrorHandlers = () => {
  // Handle unhandled promise rejections
  if (typeof global !== 'undefined' && !global.onunhandledrejection) {
    global.onunhandledrejection = (event) => {
      if (event && event.reason) {
        const error = event.reason;
        // Check if it's a BLE error
        if (typeof error === 'object' && error.name === 'BleError') {
          console.warn('🔄 BLE Error caught globally (suppressed):', error.message || error);
          // Prevent the error from crashing the app
          event.preventDefault?.();
          return;
        }
      }
      
      console.error('❌ Unhandled Promise rejection:', event?.reason);
    };
  }
  
  // For React Native console errors, filter out known BLE errors
  const originalError = console.error;
  console.error = (...args) => {
    const firstArg = args[0];
    if (typeof firstArg === 'string' && (
      firstArg.includes('BleError: Unknown error') ||
      firstArg.includes('Uncaught (in promise') && firstArg.includes('BleError')
    )) {
      console.warn('🔄 BLE Error (handled):', ...args);
      return;
    }
    // Call original console.error for all other errors
    originalError(...args);
  };
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        animation: 'slide_from_right'
      }}
      initialRouteName="splash"
    >
      <Stack.Screen 
        name="splash" 
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="auth" 
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="(tabs)" 
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="caretaker" 
        options={{
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Set up global error handlers for BLE errors
    setupGlobalErrorHandlers();
    
    // Keep splash screen visible while we fetch resources
    const prepare = async () => {
      try {
        // Pre-load fonts, make any API calls you need to do here
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        SplashScreen.hideAsync();
      }
    };

    prepare();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <HydrationProvider>
            <CaretakerAuthProvider>
              <RootLayoutNav />
            </CaretakerAuthProvider>
          </HydrationProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}