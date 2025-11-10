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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/providers/auth-provider";
import { Eye, EyeOff, Mail, Lock, User, Droplets } from "lucide-react-native";

const { width } = Dimensions.get("window");

export default function AuthScreen() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const [isLogin, setIsLogin] = useState(true); // Start with login by default
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const toggleMode = () => {
    setForgotPasswordMode(false);
    setIsLogin(!isLogin);
    setPassword("");
    setConfirmPassword("");
    setName("");
  };

  const validateForm = () => {
    if (!email || !email.includes('@')) {
      Alert.alert("Error", "Please enter a valid email address");
      return false;
    }

    if (forgotPasswordMode) {
      return true;
    }

    if (!password) {
      Alert.alert("Error", "Please enter a password");
      return false;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password should be at least 6 characters long");
      return false;
    }

    if (!isLogin) {
      if (!name || name.trim().length < 2) {
        Alert.alert("Error", "Please enter your full name");
        return false;
      }

      if (password !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return false;
      }
    }

    return true;
  };

  const handleAuth = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (forgotPasswordMode) {
        const result = await sendPasswordReset(email);
        if (result.success) {
          Alert.alert(
            "Password Reset Sent",
            "Check your email for password reset instructions.",
            [{ text: "OK", onPress: () => setForgotPasswordMode(false) }]
          );
        } else {
          Alert.alert("Error", result.error || "Failed to send reset email");
        }
        return;
      }

      if (isLogin) {
        const result = await signIn(email, password);
        if (!result.success && result.error) {
          Alert.alert("Error", result.error);
          return;
        }
      } else {
        const result = await signUp(name, email, password);
        if (!result.success && result.error) {
          Alert.alert("Error", result.error);
          return;
        }
      }

      // Navigation will be handled by the auth provider
    } catch (error: any) {
      Alert.alert("Error", error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#f8fafc", "#e2e8f0"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <View style={styles.formContainer}>
                <View style={styles.header}>
                  <View style={styles.logoContainer}>
                    <View style={styles.logoCircle}>
                      <Droplets size={32} color="#0ea5e9" />
                    </View>
                    <Text style={styles.appName}>AquaBuddy</Text>
                  </View>
                  
                  <Text style={styles.title}>
                    {forgotPasswordMode 
                      ? "Reset Password" 
                      : (isLogin ? "Welcome Back" : "Create Account")
                    }
                  </Text>
                  <Text style={styles.subtitle}>
                    {forgotPasswordMode 
                      ? "Enter your email to receive reset instructions"
                      : (isLogin 
                        ? "Sign in to continue your hydration journey" 
                        : "Start tracking your water intake today"
                      )
                    }
                  </Text>
                </View>

                <View style={styles.form}>
                  {!isLogin && !forgotPasswordMode && (
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
                          autoComplete="name"
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
                        autoComplete="email"
                      />
                    </View>
                  </View>

                  {!forgotPasswordMode && (
                    <>
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
                            autoComplete={isLogin ? "current-password" : "new-password"}
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

                      {!isLogin && (
                        <View style={styles.inputWrapper}>
                          <View style={styles.inputContainer}>
                            <Lock size={20} color="#64748b" style={styles.inputIcon} />
                            <TextInput
                              style={styles.input}
                              placeholder="Confirm Password"
                              placeholderTextColor="#94a3b8"
                              value={confirmPassword}
                              onChangeText={setConfirmPassword}
                              secureTextEntry={!showConfirmPassword}
                              autoComplete="new-password"
                            />
                            <TouchableOpacity
                              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                              style={styles.eyeIcon}
                            >
                              {showConfirmPassword ? (
                                <EyeOff size={20} color="#64748b" />
                              ) : (
                                <Eye size={20} color="#64748b" />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </>
                  )}

                  {isLogin && !forgotPasswordMode && (
                    <TouchableOpacity
                      style={styles.forgotPasswordButton}
                      onPress={() => setForgotPasswordMode(true)}
                    >
                      <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.authButton, loading && styles.authButtonDisabled]}
                    onPress={handleAuth}
                    disabled={loading}
                  >
                    <Text style={styles.authButtonText}>
                      {loading 
                        ? "Please wait..." 
                        : (forgotPasswordMode 
                          ? "Send Reset Email" 
                          : (isLogin ? "Sign In" : "Create Account")
                        )
                      }
                    </Text>
                  </TouchableOpacity>

                  {forgotPasswordMode ? (
                    <TouchableOpacity
                      style={styles.switchButton}
                      onPress={() => setForgotPasswordMode(false)}
                    >
                      <Text style={styles.switchButtonText}>
                        Back to <Text style={styles.switchButtonTextBold}>Sign In</Text>
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <>
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
                    </>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
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
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: "#0ea5e9",
    fontSize: 14,
    fontWeight: "600" as const,
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