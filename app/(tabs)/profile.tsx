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
import { 
  User, 
  Settings, 
  Bell, 
  Target, 
  Download, 
  Palette,
  ChevronRight 
} from 'lucide-react-native';

import { useWaterTracking } from '../../hooks/useWaterTracking';
import { Colors, Typography, BorderRadius, Shadow, Spacing } from '../../constants/theme';

export default function ProfileScreen() {
  const { userProfile, updateUserProfile, currentTotal, streakCount } = useWaterTracking();
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(userProfile?.name || '');
  const [tempGoal, setTempGoal] = useState(userProfile?.dailyGoal?.toString() || '3000');

  const handleSaveProfile = async () => {
    if (!tempName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    const goal = parseInt(tempGoal, 10);
    if (isNaN(goal) || goal < 500 || goal > 10000) {
      Alert.alert('Error', 'Please enter a valid daily goal (500-10000ml)');
      return;
    }

    const success = await updateUserProfile({
      name: tempName.trim(),
      dailyGoal: goal,
    });

    if (success) {
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } else {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setTempName(userProfile?.name || '');
    setTempGoal(userProfile?.dailyGoal?.toString() || '3000');
    setIsEditing(false);
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    await updateUserProfile({ notifications: enabled });
  };

  const handleUnitToggle = async (unit: 'ml' | 'oz') => {
    await updateUserProfile({ unit });
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

  if (!userProfile) {
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
        colors={Colors.background.gradient}
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
                  {getInitials(userProfile.name)}
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
                <View style={styles.goalInputContainer}>
                  <TextInput
                    style={styles.goalInput}
                    value={tempGoal}
                    onChangeText={setTempGoal}
                    placeholder="Daily goal"
                    placeholderTextColor={Colors.text.medium}
                    keyboardType="numeric"
                  />
                  <Text style={styles.goalUnit}>ml</Text>
                </View>
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
                <Text style={styles.profileName}>{userProfile.name}</Text>
                <Text style={styles.profileEmail}>{userProfile.email}</Text>
                <Text style={styles.profileGoal}>
                  Daily Goal: {userProfile.dailyGoal}ml
                </Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setIsEditing(true)}
                >
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{Math.round(currentTotal / 1000 * 10) / 10}L</Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{streakCount}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {Math.round((currentTotal / userProfile.dailyGoal) * 100)}%
              </Text>
              <Text style={styles.statLabel}>Goal Progress</Text>
            </View>
          </View>

          {/* Settings */}
          <View style={styles.settingsContainer}>
            <Text style={styles.sectionTitle}>Settings</Text>
            
            {/* Notifications */}
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Bell size={20} color={Colors.primary} strokeWidth={2} />
                <Text style={styles.settingLabel}>Notifications</Text>
              </View>
              <Switch
                value={userProfile.notifications}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: Colors.background.light, true: Colors.primary }}
                thumbColor={Colors.background.white}
              />
            </View>

            {/* Units */}
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Target size={20} color={Colors.primary} strokeWidth={2} />
                <Text style={styles.settingLabel}>Units</Text>
              </View>
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    userProfile.unit === 'ml' && styles.activeUnitButton,
                  ]}
                  onPress={() => handleUnitToggle('ml')}
                >
                  <Text style={[
                    styles.unitButtonText,
                    userProfile.unit === 'ml' && styles.activeUnitButtonText,
                  ]}>ml</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    userProfile.unit === 'oz' && styles.activeUnitButton,
                  ]}
                  onPress={() => handleUnitToggle('oz')}
                >
                  <Text style={[
                    styles.unitButtonText,
                    userProfile.unit === 'oz' && styles.activeUnitButtonText,
                  ]}>oz</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Export Data */}
            <TouchableOpacity style={styles.settingItem} onPress={handleExportData}>
              <View style={styles.settingLeft}>
                <Download size={20} color={Colors.primary} strokeWidth={2} />
                <Text style={styles.settingLabel}>Export Data</Text>
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
});