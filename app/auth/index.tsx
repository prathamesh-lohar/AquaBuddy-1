import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/providers/auth-provider";
import { Eye, EyeOff, Mail, Lock, User, Droplets } from "lucide-react-native";

const { width } = Dimensions.get("window");

export default function AuthScreen() {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const toggleMode = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: isLogin ? -width : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsLogin(!isLogin);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await login({ email, password, name: isLogin ? undefined : name });
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Error", "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const fillSampleCredentials = () => {
    setEmail("sree@test.com");
    setPassword("sree123");
    if (!isLogin) {
      setName("sree User");
    }
  };

  return (
    <LinearGradient
      colors={["#f8fafc", "#e2e8f0"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Animated.View
              style={[
                styles.formContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            >
              <View style={styles.header}>
                <View style={styles.logoContainer}>
                  <View style={styles.logoCircle}>
                    <Droplets size={32} color="#0ea5e9" />
                  </View>
                  <Text style={styles.appName}>Smart Hydration</Text>
                </View>
                
                <Text style={styles.title}>
                  {isLogin ? "Welcome Back" : "Create Account"}
                </Text>
                <Text style={styles.subtitle}>
                  {isLogin 
                    ? "Sign in to continue your hydration journey" 
                    : "Start tracking your water intake today"
                  }
                </Text>
              </View>

              <View style={styles.form}>
                {!isLogin && (
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputContainer}>
                      <User size={20} color="#64748b" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        placeholderTextColor="#94a3b8"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                )}
                
                <View style={styles.inputWrapper}>
                  <View style={styles.inputContainer}>
                    <Mail size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor="#94a3b8"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor="#94a3b8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      {showPassword ? (
                        <EyeOff size={20} color="#64748b" />
                      ) : (
                        <Eye size={20} color="#64748b" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.sampleCredentialsContainer}>
                  <Text style={styles.sampleCredentialsTitle}>📋 Sample Login Credentials:</Text>
                  <Text style={styles.sampleCredentialsText}>Email: sree@test.com</Text>
                  <Text style={styles.sampleCredentialsText}>Password: sree123</Text>
                  <TouchableOpacity
                    style={styles.sampleButton}
                    onPress={fillSampleCredentials}
                  >
                    <Text style={styles.sampleButtonText}>
                      💡 Auto-fill Sample Credentials
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.authButton, loading && styles.authButtonDisabled]}
                  onPress={handleAuth}
                  disabled={loading}
                >
                  <Text style={styles.authButtonText}>
                    {loading ? "Please wait..." : (isLogin ? "Sign In" : "Create Account")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.switchButton}
                  onPress={toggleMode}
                >
                  <Text style={styles.switchButtonText}>
                    {isLogin 
                      ? "Don't have an account? " 
                      : "Already have an account? "
                    }
                    <Text style={styles.switchButtonTextBold}>
                      {isLogin ? "Sign Up" : "Sign In"}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  formContainer: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoCircle: {
    width: 64,
    height: 64,
    backgroundColor: "#e0f2fe",
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  appName: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: "#0ea5e9",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },
  form: {
    gap: 20,
  },
  inputWrapper: {
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
    fontWeight: "500" as const,
  },
  eyeIcon: {
    padding: 4,
  },
  sampleCredentialsContainer: {
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#0ea5e9",
    marginBottom: 8,
  },
  sampleCredentialsTitle: {
    color: "#0ea5e9",
    fontSize: 14,
    fontWeight: "700" as const,
    marginBottom: 8,
    textAlign: "center",
  },
  sampleCredentialsText: {
    color: "#0369a1",
    fontSize: 13,
    fontWeight: "500" as const,
    textAlign: "center",
    marginBottom: 2,
  },
  sampleButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginTop: 8,
  },
  sampleButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  authButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  switchButton: {
    alignItems: "center",
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
  },
  switchButtonText: {
    color: "#64748b",
    fontSize: 16,
  },
  switchButtonTextBold: {
    color: "#0ea5e9",
    fontSize: 16,
    fontWeight: "600" as const,
  },
});