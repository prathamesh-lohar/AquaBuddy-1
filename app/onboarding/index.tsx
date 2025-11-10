import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/providers/auth-provider";
import { OnboardingData } from "@/types";
import { 
  User, 
  Calendar, 
  Scale, 
  Ruler, 
  Activity, 
  Clock, 
  Heart, 
  Settings, 
  Target,
  UserCheck,
  CheckCircle,
  ChevronLeft,
  ChevronRight 
} from "lucide-react-native";

const { width } = Dimensions.get('window');

interface OnboardingStep {
  title: string;
  subtitle: string;
  component: React.ReactNode;
}

export default function OnboardingScreen() {
  const { completeOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Form data
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({
    name: "",
    birthDate: new Date(),
    sex: "male",
    weight: 70,
    height: 170,
    activityLevel: "moderate",
    sleepSchedule: { bedTime: "23:00", wakeTime: "07:00" },
    healthConditions: [],
    unit: "ml",
    notifications: true,
    reminderInterval: 2,
    role: "personal",
    dailyGoal: 2500
  });

  const steps: OnboardingStep[] = [
    {
      title: "Personal Information",
      subtitle: "Tell us about yourself",
      component: <PersonalInfoStep />
    },
    {
      title: "Lifestyle",
      subtitle: "Your daily habits",
      component: <LifestyleStep />
    },
    {
      title: "Preferences",
      subtitle: "Customize your experience",
      component: <PreferencesStep />
    },
    {
      title: "Role Selection",
      subtitle: "How will you use AquaBuddy?",
      component: <RoleStep />
    },
    {
      title: "Summary",
      subtitle: "Review your information",
      component: <SummaryStep />
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      Animated.timing(slideAnim, {
        toValue: -(currentStep + 1) * width,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      Animated.timing(slideAnim, {
        toValue: -(currentStep - 1) * width,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setCurrentStep(currentStep - 1);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0: // Personal Info
        return !!(onboardingData.name && onboardingData.name.trim().length >= 2);
      case 1: // Lifestyle
        return !!(onboardingData.activityLevel);
      case 2: // Preferences
        return true; // All preferences have defaults
      case 3: // Role
        return !!(onboardingData.role);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      Alert.alert("Incomplete Information", "Please fill in all required fields.");
      return;
    }
    nextStep();
  };

  const handleComplete = async () => {
    if (!validateCurrentStep()) {
      Alert.alert("Incomplete Information", "Please review your information.");
      return;
    }

    setIsLoading(true);
    try {
      // Calculate daily goal based on weight and activity level
      const calculateGoal = () => {
        if (onboardingData.weight && onboardingData.activityLevel) {
          const multipliers = {
            sedentary: 1.0,
            light: 1.1,
            moderate: 1.2,
            active: 1.3,
            very_active: 1.4
          };
          const multiplier = multipliers[onboardingData.activityLevel!] || 1.2;
          return Math.round(onboardingData.weight * 35 * multiplier);
        }
        return 2500;
      };

      // Prepare complete onboarding data
      const completeData = {
        ...onboardingData,
        dailyGoal: calculateGoal()
      };

      const result = await completeOnboarding(completeData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to complete onboarding');
      }
      // Navigation will be handled by auth state change
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to complete onboarding");
    } finally {
      setIsLoading(false);
    }
  };

  function PersonalInfoStep() {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.iconContainer}>
          <User size={32} color="#0ea5e9" />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={onboardingData.name}
              onChangeText={(text) => setOnboardingData(prev => ({ ...prev, name: text }))}
              placeholder="Enter your full name"
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
              autoComplete="name"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Birth Date</Text>
          <TouchableOpacity style={styles.dateButton}>
            <Calendar size={20} color="#64748b" />
            <Text style={styles.dateText}>
              {onboardingData.birthDate?.toLocaleDateString() || "Select date"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Sex</Text>
          <View style={styles.radioGroup}>
            {['male', 'female', 'other'].map((sex) => (
              <TouchableOpacity
                key={sex}
                style={[
                  styles.radioButton,
                  onboardingData.sex === sex && styles.radioButtonActive
                ]}
                onPress={() => setOnboardingData(prev => ({ ...prev, sex: sex as any }))}
              >
                <Text style={[
                  styles.radioText,
                  onboardingData.sex === sex && styles.radioTextActive
                ]}>
                  {sex.charAt(0).toUpperCase() + sex.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Weight (kg)</Text>
            <View style={styles.numberInputContainer}>
              <Scale size={20} color="#64748b" />
              <TextInput
                style={styles.numberInput}
                value={onboardingData.weight?.toString()}
                onChangeText={(text) => setOnboardingData(prev => ({ ...prev, weight: parseFloat(text) || 0 }))}
                keyboardType="numeric"
                placeholder="70"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
          
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Height (cm)</Text>
            <View style={styles.numberInputContainer}>
              <Ruler size={20} color="#64748b" />
              <TextInput
                style={styles.numberInput}
                value={onboardingData.height?.toString()}
                onChangeText={(text) => setOnboardingData(prev => ({ ...prev, height: parseFloat(text) || 0 }))}
                keyboardType="numeric"
                placeholder="170"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

  function LifestyleStep() {
    const activityLevels = [
      { key: 'sedentary', label: 'Sedentary', subtitle: 'Little to no exercise' },
      { key: 'light', label: 'Light', subtitle: 'Light exercise 1-3 days/week' },
      { key: 'moderate', label: 'Moderate', subtitle: 'Moderate exercise 3-5 days/week' },
      { key: 'active', label: 'Active', subtitle: 'Hard exercise 6-7 days/week' },
      { key: 'very_active', label: 'Very Active', subtitle: 'Very hard exercise, physical job' }
    ];

    return (
      <View style={styles.stepContainer}>
        <View style={styles.iconContainer}>
          <Activity size={32} color="#0ea5e9" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Activity Level</Text>
          {activityLevels.map((level) => (
            <TouchableOpacity
              key={level.key}
              style={[
                styles.optionCard,
                onboardingData.activityLevel === level.key && styles.optionCardActive
              ]}
              onPress={() => setOnboardingData(prev => ({ ...prev, activityLevel: level.key as any }))}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionTitle,
                  onboardingData.activityLevel === level.key && styles.optionTitleActive
                ]}>
                  {level.label}
                </Text>
                <Text style={[
                  styles.optionSubtitle,
                  onboardingData.activityLevel === level.key && styles.optionSubtitleActive
                ]}>
                  {level.subtitle}
                </Text>
              </View>
              {onboardingData.activityLevel === level.key && (
                <CheckCircle size={24} color="#0ea5e9" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Sleep Schedule</Text>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.subLabel}>Bed Time</Text>
              <View style={styles.timeInputContainer}>
                <Clock size={20} color="#64748b" />
                <TextInput
                  style={styles.timeInput}
                  value={onboardingData.sleepSchedule?.bedTime}
                  onChangeText={(text) => setOnboardingData(prev => ({ 
                    ...prev, 
                    sleepSchedule: { ...prev.sleepSchedule!, bedTime: text }
                  }))}
                  placeholder="23:00"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.subLabel}>Wake Time</Text>
              <View style={styles.timeInputContainer}>
                <Clock size={20} color="#64748b" />
                <TextInput
                  style={styles.timeInput}
                  value={onboardingData.sleepSchedule?.wakeTime}
                  onChangeText={(text) => setOnboardingData(prev => ({ 
                    ...prev, 
                    sleepSchedule: { ...prev.sleepSchedule!, wakeTime: text }
                  }))}
                  placeholder="07:00"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  function PreferencesStep() {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.iconContainer}>
          <Settings size={32} color="#0ea5e9" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Unit System</Text>
          <View style={styles.radioGroup}>
            {['ml', 'oz'].map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[
                  styles.radioButton,
                  onboardingData.unit === unit && styles.radioButtonActive
                ]}
                onPress={() => setOnboardingData(prev => ({ ...prev, unit: unit as any }))}
              >
                <Text style={[
                  styles.radioText,
                  onboardingData.unit === unit && styles.radioTextActive
                ]}>
                  {unit.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notifications</Text>
          <TouchableOpacity
            style={[
              styles.toggleCard,
              onboardingData.notifications && styles.toggleCardActive
            ]}
            onPress={() => setOnboardingData(prev => ({ ...prev, notifications: !prev.notifications }))}
          >
            <View style={styles.toggleContent}>
              <Text style={[
                styles.toggleTitle,
                onboardingData.notifications && styles.toggleTitleActive
              ]}>
                Enable Reminders
              </Text>
              <Text style={[
                styles.toggleSubtitle,
                onboardingData.notifications && styles.toggleSubtitleActive
              ]}>
                Get notified to drink water
              </Text>
            </View>
            <View style={[
              styles.toggle,
              onboardingData.notifications && styles.toggleActive
            ]}>
              <View style={[
                styles.toggleButton,
                onboardingData.notifications && styles.toggleButtonActive
              ]} />
            </View>
          </TouchableOpacity>
        </View>

        {onboardingData.notifications && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Reminder Interval</Text>
            <View style={styles.intervalContainer}>
              {[1, 2, 3, 4].map((hours) => (
                <TouchableOpacity
                  key={hours}
                  style={[
                    styles.intervalButton,
                    onboardingData.reminderInterval === hours && styles.intervalButtonActive
                  ]}
                  onPress={() => setOnboardingData(prev => ({ ...prev, reminderInterval: hours }))}
                >
                  <Text style={[
                    styles.intervalText,
                    onboardingData.reminderInterval === hours && styles.intervalTextActive
                  ]}>
                    {hours}h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  function RoleStep() {
    const roles = [
      {
        key: 'personal',
        icon: UserCheck,
        title: 'Personal User',
        subtitle: 'Track your own hydration'
      },
      {
        key: 'caretaker',
        icon: Heart,
        title: 'Caretaker',
        subtitle: 'Monitor others\' water intake'
      }
    ];

    return (
      <View style={styles.stepContainer}>
        <View style={styles.iconContainer}>
          <Target size={32} color="#0ea5e9" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>How will you use AquaBuddy?</Text>
          {roles.map((role) => {
            const IconComponent = role.icon;
            return (
              <TouchableOpacity
                key={role.key}
                style={[
                  styles.roleCard,
                  onboardingData.role === role.key && styles.roleCardActive
                ]}
                onPress={() => setOnboardingData(prev => ({ ...prev, role: role.key as any }))}
              >
                <View style={styles.roleIcon}>
                  <IconComponent 
                    size={24} 
                    color={onboardingData.role === role.key ? "#0ea5e9" : "#64748b"} 
                  />
                </View>
                <View style={styles.roleContent}>
                  <Text style={[
                    styles.roleTitle,
                    onboardingData.role === role.key && styles.roleTitleActive
                  ]}>
                    {role.title}
                  </Text>
                  <Text style={[
                    styles.roleSubtitle,
                    onboardingData.role === role.key && styles.roleSubtitleActive
                  ]}>
                    {role.subtitle}
                  </Text>
                </View>
                {onboardingData.role === role.key && (
                  <CheckCircle size={24} color="#0ea5e9" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  function SummaryStep() {
    const calculateGoal = () => {
      if (onboardingData.weight && onboardingData.activityLevel) {
        return Math.round(onboardingData.weight * 35 * getActivityMultiplier());
      }
      return 2500;
    };

    const getActivityMultiplier = () => {
      const multipliers = {
        sedentary: 1.0,
        light: 1.1,
        moderate: 1.2,
        active: 1.3,
        very_active: 1.4
      };
      return multipliers[onboardingData.activityLevel!] || 1.2;
    };

    return (
      <View style={styles.stepContainer}>
        <View style={styles.iconContainer}>
          <CheckCircle size={32} color="#0ea5e9" />
        </View>

        <Text style={styles.summaryTitle}>Review Your Profile</Text>
        
        <View style={styles.summaryCard}>
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <Text style={styles.summaryItem}>Name: {onboardingData.name}</Text>
            <Text style={styles.summaryItem}>
              Weight: {onboardingData.weight}kg, Height: {onboardingData.height}cm
            </Text>
            <Text style={styles.summaryItem}>Sex: {onboardingData.sex}</Text>
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Lifestyle</Text>
            <Text style={styles.summaryItem}>
              Activity Level: {onboardingData.activityLevel?.replace('_', ' ')}
            </Text>
            <Text style={styles.summaryItem}>
              Sleep: {onboardingData.sleepSchedule?.bedTime} - {onboardingData.sleepSchedule?.wakeTime}
            </Text>
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <Text style={styles.summaryItem}>Units: {onboardingData.unit?.toUpperCase()}</Text>
            <Text style={styles.summaryItem}>
              Notifications: {onboardingData.notifications ? 'Enabled' : 'Disabled'}
            </Text>
            {onboardingData.notifications && (
              <Text style={styles.summaryItem}>
                Reminder: Every {onboardingData.reminderInterval} hours
              </Text>
            )}
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Daily Goal</Text>
            <Text style={styles.goalText}>{calculateGoal()} {onboardingData.unit}</Text>
            <Text style={styles.goalSubtext}>
              Based on your weight and activity level
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#f8fafc", "#e2e8f0"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{steps[currentStep].title}</Text>
          <Text style={styles.headerSubtitle}>{steps[currentStep].subtitle}</Text>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${((currentStep + 1) / steps.length) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {currentStep + 1} of {steps.length}
            </Text>
          </View>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.stepsContainer,
              { transform: [{ translateX: slideAnim }] }
            ]}
          >
            {steps.map((step, index) => (
              <View key={index} style={styles.stepWrapper}>
                {step.component}
              </View>
            ))}
          </Animated.View>
        </ScrollView>

        {/* Navigation */}
        <View style={styles.navigation}>
          <TouchableOpacity
            style={[styles.navButton, currentStep === 0 && styles.navButtonDisabled]}
            onPress={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft size={20} color={currentStep === 0 ? "#94a3b8" : "#0ea5e9"} />
            <Text style={[
              styles.navButtonText,
              currentStep === 0 && styles.navButtonTextDisabled
            ]}>
              Back
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
            onPress={currentStep === steps.length - 1 ? handleComplete : handleNext}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading 
                ? "Setting up..." 
                : (currentStep === steps.length - 1 ? "Complete Setup" : "Next")
              }
            </Text>
            {currentStep < steps.length - 1 && (
              <ChevronRight size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
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
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: 'white',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  progressContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0ea5e9',
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  content: {
    flex: 1,
  },
  stepsContainer: {
    flexDirection: 'row',
    width: width * 5, // 5 steps
  },
  stepWrapper: {
    width: width,
  },
  stepContainer: {
    flex: 1,
    padding: 24,
  },
  iconContainer: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    backgroundColor: '#e0f2fe',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
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
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
    fontWeight: "500",
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  dateButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#1e293b',
    marginLeft: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  radioButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  radioButtonActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0ea5e9',
  },
  radioText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  radioTextActive: {
    color: '#0ea5e9',
  },
  row: {
    flexDirection: 'row',
  },
  numberInputContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    marginLeft: 12,
  },
  timeInputContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    marginLeft: 12,
  },
  optionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionCardActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0ea5e9',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  optionTitleActive: {
    color: '#0ea5e9',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  optionSubtitleActive: {
    color: '#0369a1',
  },
  toggleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleCardActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0ea5e9',
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  toggleTitleActive: {
    color: '#0ea5e9',
  },
  toggleSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  toggleSubtitleActive: {
    color: '#0369a1',
  },
  toggle: {
    width: 44,
    height: 24,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#0ea5e9',
  },
  toggleButton: {
    width: 20,
    height: 20,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  toggleButtonActive: {
    transform: [{ translateX: 20 }],
  },
  intervalContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  intervalButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  intervalButtonActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0ea5e9',
  },
  intervalText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  intervalTextActive: {
    color: '#0ea5e9',
  },
  roleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleCardActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0ea5e9',
  },
  roleIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  roleTitleActive: {
    color: '#0ea5e9',
  },
  roleSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  roleSubtitleActive: {
    color: '#0369a1',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summarySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0ea5e9',
    marginBottom: 8,
  },
  summaryItem: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  goalText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  goalSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  navigation: {
    flexDirection: 'row',
    padding: 24,
    backgroundColor: 'white',
    gap: 16,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: 'white',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0ea5e9',
    marginLeft: 4,
  },
  navButtonTextDisabled: {
    color: '#94a3b8',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    padding: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginRight: 4,
  },
});