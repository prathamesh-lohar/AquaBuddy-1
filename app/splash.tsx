import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/providers/auth-provider";

const { width, height } = Dimensions.get("window");

export default function SplashScreen() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnimations = () => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          })
        ),
      ]).start();
    };

    startAnimations();

    // Wait for animations and auth state to be ready
    const timer = setTimeout(() => {
      if (!isLoading) {
        if (!isAuthenticated) {
          router.replace("/auth");
        } else {
          router.replace("/(tabs)");
        }
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading]);

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0],
  });

  return (
    <LinearGradient
      colors={["#f8fafc", "#e2e8f0", "#cbd5e1"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.ripple,
              {
                transform: [{ scale: rippleScale }],
                opacity: rippleOpacity,
              },
            ]}
          />
          
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.droplet}>
              <Text style={styles.dropletText}>💧</Text>
            </View>
            <Text style={styles.title}>Smart Hydration</Text>
            <Text style={styles.subtitle}>Track • Remind • Achieve</Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ripple: {
    position: "absolute",
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(14, 165, 233, 0.2)",
  },
  logoContainer: {
    alignItems: "center",
  },
  droplet: {
    width: 80,
    height: 80,
    backgroundColor: "white",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  dropletText: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold" as const,
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    fontWeight: "500" as const,
  },
});