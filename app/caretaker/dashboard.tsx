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
import { AddPatientModal } from '../../components/AddPatientModal';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { PatientUser, HydrationAlert } from '../../types/caretaker';

export default function CaretakerDashboard() {
  const { 
    caretaker, 
    managedUsers, 
    alerts, 
    isLoading, 
    isCaretaker,
    refreshData,
    signOut,
    acknowledgeAlert
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
      `${caretaker?.name}, are you sure you want to sign out of the caretaker portal? All unsaved changes will be lost.`,
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

  const handleAlertPress = async (alert: HydrationAlert) => {
    Alert.alert(
      'Alert Details',
      alert.message,
      [
        { text: 'Dismiss', style: 'cancel' },
        {
          text: 'Acknowledge',
          onPress: async () => {
            try {
              await acknowledgeAlert(alert.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to acknowledge alert');
            }
          }
        }
      ]
    );
  };

  const handleAddPatient = () => {
    setShowAddPatientModal(true);
  };

  const handleAddPatientSuccess = async () => {
    setShowAddPatientModal(false);
    // Refresh the dashboard data
    await onRefresh();
  };

  // Calculate stats
  const totalPatients = managedUsers.length;
  const criticalAlerts = alerts.filter(alert => alert.severity === 'CRITICAL' || alert.severity === 'HIGH').length;
  const activePatients = managedUsers.filter(user => user.isActive).length;

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
            <Text style={styles.role}>{caretaker.role}</Text>
            {caretaker.facilityName && (
              <Text style={styles.facility}>{caretaker.facilityName}</Text>
            )}
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
                <Text style={styles.statNumber}>{activePatients}</Text>
                <Text style={styles.statLabel}>Active Today</Text>
              </View>
              <View style={[styles.statCard, criticalAlerts > 0 && styles.criticalCard]}>
                <Text style={[styles.statNumber, criticalAlerts > 0 && styles.criticalText]}>
                  {criticalAlerts}
                </Text>
                <Text style={[styles.statLabel, criticalAlerts > 0 && styles.criticalText]}>
                  Critical Alerts
                </Text>
              </View>
            </View>
          </View>

          {/* Active Alerts */}
          {alerts.filter(alert => !alert.acknowledged).length > 0 && (
            <View style={styles.alertsContainer}>
              <Text style={styles.sectionTitle}>Active Alerts</Text>
              {alerts.filter(alert => !alert.acknowledged).slice(0, 3).map(alert => (
                <TouchableOpacity
                  key={alert.id}
                  style={[
                    styles.alertItem,
                    alert.severity === 'CRITICAL' && styles.criticalAlert,
                    alert.severity === 'HIGH' && styles.highAlert
                  ]}
                  onPress={() => handleAlertPress(alert)}
                >
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>
                      {alert.alertType.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                    <Text style={styles.alertTime}>
                      {alert.createdAt.toLocaleTimeString()}
                    </Text>
                  </View>
                  <View style={[
                    styles.severityBadge,
                    alert.severity === 'CRITICAL' && styles.criticalBadge,
                    alert.severity === 'HIGH' && styles.highBadge
                  ]}>
                    <Text style={styles.severityText}>{alert.severity}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {alerts.filter(alert => !alert.acknowledged).length > 3 && (
                <TouchableOpacity style={styles.viewAllButton}>
                  <Text style={styles.viewAllText}>
                    View All Alerts ({alerts.filter(alert => !alert.acknowledged).length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Patients List */}
          <View style={styles.patientsContainer}>
            <View style={styles.patientsHeader}>
              <Text style={styles.sectionTitle}>Your Patients</Text>
              <TouchableOpacity style={styles.addPatientHeaderButton} onPress={handleAddPatient}>
                <Text style={styles.addPatientHeaderButtonText}>+ Add Patient</Text>
              </TouchableOpacity>
            </View>
            {managedUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No patients assigned yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Connect IoT devices to patients to start monitoring their hydration
                </Text>
                <TouchableOpacity style={styles.addPatientButton} onPress={handleAddPatient}>
                  <Text style={styles.addPatientButtonText}>Add First Patient</Text>
                </TouchableOpacity>
              </View>
            ) : (
              managedUsers.map(patient => (
                <PatientCard key={patient.id} patient={patient} />
              ))
            )}
          </View>

          
        </ScrollView>

        {/* Add Patient Modal */}
        <AddPatientModal
          visible={showAddPatientModal}
          onClose={() => setShowAddPatientModal(false)}
          onSuccess={handleAddPatientSuccess}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

// Patient Card Component
const PatientCard: React.FC<{ patient: PatientUser }> = ({ patient }) => {
  const getHydrationStatus = () => {
    // This would calculate based on today's consumption
    // For now, returning mock data
    const percentage = Math.floor(Math.random() * 100);
    return {
      percentage,
      color: percentage >= 80 ? '#4CAF50' : percentage >= 50 ? '#FF9800' : '#F44336',
      status: percentage >= 80 ? 'Good' : percentage >= 50 ? 'Fair' : 'Poor'
    };
  };

  const hydration = getHydrationStatus();

  const handlePatientPress = () => {
    router.push(`/caretaker/patient/${patient.id}`);
  };

  return (
    <TouchableOpacity style={styles.patientCard} onPress={handlePatientPress}>
      <View style={styles.patientHeader}>
        <View>
          <Text style={styles.patientName}>{patient.name}</Text>
          <Text style={styles.patientDetails}>
            Age: {patient.age} {patient.roomNumber && `• Room: ${patient.roomNumber}`}
          </Text>
        </View>
        <View style={styles.patientCardRight}>
          <View style={[styles.statusDot, { backgroundColor: hydration.color }]} />
          <Text style={styles.tapToView}>Tap to view details</Text>
        </View>
      </View>
      
      <View style={styles.hydrationBar}>
        <View style={styles.hydrationLabel}>
          <Text style={styles.hydrationText}>Hydration: {hydration.percentage}%</Text>
          <Text style={[styles.hydrationStatus, { color: hydration.color }]}>
            {hydration.status}
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${hydration.percentage}%`, backgroundColor: hydration.color }
            ]} 
          />
        </View>
      </View>

      {patient.lastSeen && (
        <Text style={styles.lastSeen}>
          Last active: {patient.lastSeen.toLocaleTimeString()}
        </Text>
      )}
    </TouchableOpacity>
  );
};

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
    flexWrap: 'wrap',
  },
  role: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  facility: {
    fontSize: 12,
    color: Colors.text.medium,
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
    minWidth: 80,
    maxWidth: 100,
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
  criticalCard: {
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  criticalText: {
    color: '#DC2626',
  },
  statLabel: {
    fontSize: 14,
    color: Colors.text.medium,
    textAlign: 'center',
  },
  alertsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  alertItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  criticalAlert: {
    borderLeftColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  highAlert: {
    borderLeftColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.dark,
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 14,
    color: Colors.text.medium,
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 12,
    color: Colors.text.light,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    alignSelf: 'flex-start',
  },
  criticalBadge: {
    backgroundColor: '#DC2626',
  },
  highBadge: {
    backgroundColor: '#F59E0B',
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  viewAllButton: {
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  viewAllText: {
    color: Colors.primary,
    fontWeight: '600',
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
  addPatientHeaderButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  addPatientHeaderButtonText: {
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
  emptyStateText: {
    fontSize: 16,
    color: Colors.text.medium,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.text.light,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
  addPatientButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  addPatientButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  patientCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  patientCardRight: {
    alignItems: 'flex-end',
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.dark,
    marginBottom: 2,
  },
  patientDetails: {
    fontSize: 14,
    color: Colors.text.medium,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  tapToView: {
    fontSize: 12,
    color: Colors.text.light,
    fontStyle: 'italic',
  },
  hydrationBar: {
    marginBottom: Spacing.sm,
  },
  hydrationLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  hydrationText: {
    fontSize: 14,
    color: Colors.text.dark,
    fontWeight: '500',
  },
  hydrationStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  lastSeen: {
    fontSize: 12,
    color: Colors.text.light,
  },
  actionsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: Spacing.sm,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.dark,
    textAlign: 'center',
  },
});