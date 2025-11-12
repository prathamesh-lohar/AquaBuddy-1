import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useCaretakerAuth } from '../../providers/caretaker-auth-provider';
import { PatientDeviceCard } from '../../components/PatientDeviceCard';
import { Colors, Spacing } from '../../constants/theme';
import { Patient } from '../../types';

export default function CaretakerDashboard() {
  const { 
    caretaker, 
    patients, 
    activePatient,
    isLoading, 
    isCaretaker,
    refreshData,
    signOut,
    clearAllData,
    updatePatient,
    deletePatient,
    setActivePatient,
    addPatient
  } = useCaretakerAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);

  // Redirect if not authenticated as caretaker
  useEffect(() => {
    if (!isLoading && !isCaretaker) {
      router.replace('/caretaker/login');
    }
  }, [isLoading, isCaretaker]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out Confirmation',
      `${caretaker?.name}, are you sure you want to sign out of the caretaker portal?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel' 
        },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/caretaker/login');
            } catch (error) {
              Alert.alert('Sign Out Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handlePatientPress = (patient: Patient) => {
    // Navigate to patient details
    router.push(`/caretaker/patient/${patient.id}`);
  };

  const handleUpdatePatient = async (patientId: string, updates: Partial<Patient>) => {
    try {
      await updatePatient(patientId, updates);
    } catch (error) {
      console.error('Error updating patient:', error);
    }
  };

  const handleDeletePatient = (patient: Patient) => {
    Alert.alert(
      'Delete Patient',
      `Are you sure you want to delete ${patient.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePatient(patient.id);
              Alert.alert('Success', `${patient.name} has been deleted.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete patient.');
            }
          }
        }
      ]
    );
  };

  const handleAddPatient = () => {
    // Navigate to patient addition screen
    router.push('/caretaker/add-patient');
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Patient Data',
      'This will permanently delete all patients and their data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Success', 'All patient data has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Calculate stats
  const totalPatients = patients.length;
  const connectedPatients = patients.filter(patient => patient.isConnected).length;
  const activePatients = patients.filter(patient => {
    const today = new Date().toISOString().split('T')[0];
    const lastSync = patient.lastSync ? new Date(patient.lastSync) : null;
    return lastSync && lastSync.toISOString().split('T')[0] === today;
  }).length;

  // Calculate average hydration for connected patients
  const averageHydration = patients.length > 0 ? 
    Math.round(
      patients.reduce((sum, patient) => {
        const todayIntakes = patient.todayIntakes || [];
        const totalConsumed = todayIntakes.reduce((total, intake) => total + intake.amount, 0);
        const progress = (totalConsumed / (patient.dailyGoal || 2000)) * 100;
        return sum + Math.min(progress, 100);
      }, 0) / patients.length
    ) : 0;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isCaretaker || !caretaker) {
    return null; // Will redirect
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <LinearGradient
        colors={['#F0F9FF', '#FFFFFF']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              Welcome back, {caretaker.name} 👋
            </Text>
            <Text style={styles.subtitle}>Caretaker Dashboard</Text>
          </View>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <View style={styles.signOutContent}>
              <Text style={styles.signOutIcon}>🚪</Text>
              <Text style={styles.signOutText}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Stats */}
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>Quick Overview</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{totalPatients}</Text>
                <Text style={styles.statLabel}>Total Patients</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: connectedPatients > 0 ? '#4CAF50' : '#F44336' }]}>
                  {connectedPatients}
                </Text>
                <Text style={styles.statLabel}>Connected</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{activePatients}</Text>
                <Text style={styles.statLabel}>Active Today</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { 
                  color: averageHydration >= 80 ? '#4CAF50' : averageHydration >= 50 ? '#FF9800' : '#F44336' 
                }]}>
                  {averageHydration}%
                </Text>
                <Text style={styles.statLabel}>Avg Hydration</Text>
              </View>
            </View>
          </View>

          {/* Real-time Device Status */}
          {connectedPatients > 0 && (
            <View style={styles.deviceStatusContainer}>
              <Text style={styles.sectionTitle}>🟢 Real-time Device Status</Text>
              <View style={styles.deviceStatusCard}>
                <Text style={styles.deviceStatusText}>
                  {connectedPatients} device{connectedPatients !== 1 ? 's' : ''} connected and transmitting live data
                </Text>
                <Text style={styles.deviceStatusSubtext}>
                  Water levels are updating automatically from connected IoT bottles
                </Text>
              </View>
            </View>
          )}

          {/* Patients List with Real-time Data */}
          <View style={styles.patientsContainer}>
            <View style={styles.patientsHeader}>
              <Text style={styles.sectionTitle}>
                Patient Monitoring ({patients.length})
              </Text>
              <View style={styles.headerButtons}>
                {patients.length > 0 && (
                  <TouchableOpacity style={styles.clearButton} onPress={handleClearAllData}>
                    <Text style={styles.clearButtonText}>Clear All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.addPatientButton} onPress={handleAddPatient}>
                  <Text style={styles.addPatientButtonText}>+ Add Patient</Text>
                </TouchableOpacity>
              </View>
            </View>

            {patients.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>👥</Text>
                <Text style={styles.emptyStateText}>No patients added yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Add patients and connect their IoT devices to start monitoring hydration in real-time
                </Text>
                <TouchableOpacity style={styles.addFirstPatientButton} onPress={handleAddPatient}>
                  <Text style={styles.addFirstPatientButtonText}>Add First Patient</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.patientsGrid}>
                {patients.map(patient => (
                  <PatientDeviceCard
                    key={patient.id}
                    patient={patient}
                    onPatientPress={() => handlePatientPress(patient)}
                    onUpdatePatient={handleUpdatePatient}
                    onDeletePatient={() => handleDeletePatient(patient)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              💧 Real-time hydration monitoring • Last updated: {new Date().toLocaleTimeString()}
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: Colors.text.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? Spacing.md : Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.dark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  signOutButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  signOutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  signOutText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.dark,
    marginBottom: Spacing.md,
  },
  statsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Spacing.md,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.medium,
    textAlign: 'center',
    fontWeight: '500',
  },
  deviceStatusContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  deviceStatusCard: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  deviceStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  deviceStatusSubtext: {
    fontSize: 14,
    color: '#388E3C',
  },
  patientsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  patientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  clearButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  addPatientButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  addPatientButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.background.light,
    borderStyle: 'dashed',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyStateText: {
    fontSize: 18,
    color: Colors.text.medium,
    marginBottom: Spacing.xs,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.text.light,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
  addFirstPatientButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  addFirstPatientButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  patientsGrid: {
    gap: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.text.light,
    textAlign: 'center',
  },
});