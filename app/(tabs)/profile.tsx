import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router, useRouter } from 'expo-router';
import { 
  User, 
  Settings, 
  Bell, 
  Target, 
  Download, 
  ChevronRight,
  LogOut,
  Calendar,
  Activity,
  Scale,
  Ruler,
  Clock
} from 'lucide-react-native';

import { useAuth } from '@/providers/auth-provider';
import { Colors, Typography, BorderRadius, Shadow, Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  const { user, signOut, updateProfile } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(user?.name || '');

  const handleSaveProfile = async () => {
    if (!tempName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    try {
      await updateProfile({
        name: tempName.trim(),
      });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setTempName(user?.name || '');
    setIsEditing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Your hydration data will be exported to a CSV file.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => console.log('Export data') },
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <LinearGradient
        colors={["#f8fafc", "#e2e8f0"]}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Manage your account and preferences</Text>
          </View>

          {/* Profile Info */}
          <View style={styles.profileContainer}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(user.name)}
                </Text>
              </View>
            </View>

            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.input}
                  value={tempName}
                  onChangeText={setTempName}
                  placeholder="Enter your name"
                  placeholderTextColor={Colors.text.medium}
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={handleCancelEdit}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.saveButton]}
                    onPress={handleSaveProfile}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setIsEditing(true)}
                >
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Basic Information */}
          <View style={styles.infoContainer}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Calendar size={20} color="#0ea5e9" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Member since</Text>
                <Text style={styles.infoValue}>{formatDate(user.createdAt)}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <User size={20} color="#0ea5e9" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Onboarding Status</Text>
                <Text style={styles.infoValue}>
                  {user.onboardingCompleted ? 'Completed' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>

          {/* Onboarding Information (if completed) */}
          {user.onboardingCompleted && (
            <View style={styles.infoContainer}>
              <Text style={styles.sectionTitle}>Your Information</Text>
              
              {user.weight && (
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Scale size={20} color="#0ea5e9" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Weight</Text>
                    <Text style={styles.infoValue}>{user.weight} kg</Text>
                  </View>
                </View>
              )}

              {user.height && (
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Ruler size={20} color="#0ea5e9" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Height</Text>
                    <Text style={styles.infoValue}>{user.height} cm</Text>
                  </View>
                </View>
              )}

              {user.activityLevel && (
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Activity size={20} color="#0ea5e9" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Activity Level</Text>
                    <Text style={styles.infoValue}>
                      {user.activityLevel.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                  </View>
                </View>
              )}

              {user.sleepSchedule && (
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Clock size={20} color="#0ea5e9" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Sleep Schedule</Text>
                    <Text style={styles.infoValue}>
                      {user.sleepSchedule.bedTime} - {user.sleepSchedule.wakeTime}
                    </Text>
                  </View>
                </View>
              )}

              {user.dailyGoal && (
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Target size={20} color="#0ea5e9" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Daily Goal</Text>
                    <Text style={styles.infoValue}>
                      {user.dailyGoal} {user.unit || 'ml'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Stats - Basic placeholder */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>2.1L</Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>5</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>84%</Text>
              <Text style={styles.statLabel}>Goal Progress</Text>
            </View>
          </View>

          {/* Settings */}
          <View style={styles.settingsContainer}>
            <Text style={styles.sectionTitle}>Settings</Text>
            
            {/* Notifications */}
            {user.onboardingCompleted && (
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Bell size={20} color={Colors.primary} strokeWidth={2} />
                  <Text style={styles.settingLabel}>Notifications</Text>
                </View>
                <Text style={styles.settingValue}>
                  {user.notifications ? 'Enabled' : 'Disabled'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Units */}
            {user.onboardingCompleted && user.unit && (
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Target size={20} color={Colors.primary} strokeWidth={2} />
                  <Text style={styles.settingLabel}>Units</Text>
                </View>
                <Text style={styles.settingValue}>
                  {user.unit.toUpperCase()}
                </Text>
              </TouchableOpacity>
            )}

            {/* Export Data */}
            <TouchableOpacity style={styles.settingItem} onPress={handleExportData}>
              <View style={styles.settingLeft}>
                <Download size={20} color={Colors.primary} strokeWidth={2} />
                <Text style={styles.settingLabel}>Export Data</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.medium} strokeWidth={2} />
            </TouchableOpacity>

            {/* Sign Out */}
            <TouchableOpacity style={styles.settingItem} onPress={handleSignOut}>
              <View style={styles.settingLeft}>
                <LogOut size={20} color="#ef4444" strokeWidth={2} />
                <Text style={[styles.settingLabel, { color: '#ef4444' }]}>Sign Out</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.medium} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.white,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text.medium,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
  },
  title: {
    ...Typography.header,
    color: Colors.text.dark,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.medium,
    textAlign: 'center',
  },
  profileContainer: {
    backgroundColor: Colors.background.white,
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    ...Shadow.small,
  },
  avatarContainer: {
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...Typography.header,
    color: Colors.background.white,
    fontWeight: 'bold',
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    ...Typography.header,
    fontSize: 24,
    color: Colors.text.dark,
    marginBottom: 4,
  },
  profileEmail: {
    ...Typography.body,
    color: Colors.text.medium,
    marginBottom: 8,
  },
  profileGoal: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  editButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  editButtonText: {
    ...Typography.caption,
    color: Colors.background.white,
    fontWeight: '600',
  },
  editContainer: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    ...Typography.body,
    backgroundColor: Colors.background.light,
    borderRadius: BorderRadius.small,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    width: '100%',
    textAlign: 'center',
  },
  goalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.light,
    borderRadius: BorderRadius.small,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  goalInput: {
    ...Typography.body,
    flex: 1,
    padding: Spacing.md,
    textAlign: 'center',
  },
  goalUnit: {
    ...Typography.body,
    color: Colors.text.medium,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  cancelButton: {
    backgroundColor: Colors.background.light,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  cancelButtonText: {
    ...Typography.caption,
    color: Colors.text.medium,
    fontWeight: '600',
  },
  saveButtonText: {
    ...Typography.caption,
    color: Colors.background.white,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background.white,
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    alignItems: 'center',
    marginHorizontal: 4,
    ...Shadow.small,
  },
  statValue: {
    ...Typography.header,
    fontSize: 20,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.text.medium,
    marginTop: 4,
  },
  settingsContainer: {
    backgroundColor: Colors.background.white,
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadow.small,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.light,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    ...Typography.body,
    color: Colors.text.dark,
    marginLeft: Spacing.md,
  },
  settingValue: {
    ...Typography.caption,
    color: Colors.text.medium,
    fontWeight: '500',
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.background.light,
    borderRadius: BorderRadius.small,
    overflow: 'hidden',
  },
  unitButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  activeUnitButton: {
    backgroundColor: Colors.primary,
  },
  unitButtonText: {
    ...Typography.caption,
    color: Colors.text.medium,
    fontWeight: '600',
  },
  activeUnitButtonText: {
    color: Colors.background.white,
  },
  bottomSpacing: {
    height: Spacing.xxl,
  },
  infoContainer: {
    backgroundColor: Colors.background.white,
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadow.small,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.light,
  },
  infoContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  onboardingContainer: {
    backgroundColor: Colors.background.white,
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadow.small,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  infoCard: {
    backgroundColor: Colors.background.light,
    borderRadius: BorderRadius.small,
    padding: Spacing.md,
    width: '48%',
    alignItems: 'center',
  },
  infoIcon: {
    width: 32,
    height: 32,
    backgroundColor: Colors.background.white,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    ...Typography.caption,
    color: Colors.text.medium,
    textAlign: 'center',
    marginBottom: 2,
  },
  infoValue: {
    ...Typography.caption,
    color: Colors.text.dark,
    fontWeight: '600',
    textAlign: 'center',
  },
});