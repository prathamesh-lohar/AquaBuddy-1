import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

import { DayRecord } from '../../types';
import { StorageService } from '../../utils/storage';
import { HistoryChart } from '../../components/HistoryChart';
import { Colors, Typography, Spacing } from '../../constants/theme';

export default function HistoryScreen() {
  const [weekData, setWeekData] = useState<DayRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWeekData = async () => {
    try {
      setIsLoading(true);
      
      // Get current week's start (Monday)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() + mondayOffset);
      
      const records = await StorageService.getWeekRecords(startOfWeek);
      setWeekData(records);
    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWeekData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWeekData();
    setRefreshing(false);
  };

  const calculateWeeklyStats = () => {
    const totalConsumed = weekData.reduce((sum, day) => sum + day.total, 0);
    const totalGoal = weekData.reduce((sum, day) => sum + day.goal, 0);
    const daysAchieved = weekData.filter(day => day.achieved).length;
    const averageDaily = weekData.length > 0 ? totalConsumed / weekData.length : 0;
    
    return {
      totalConsumed,
      totalGoal,
      daysAchieved,
      averageDaily,
      weeklyPercentage: totalGoal > 0 ? (totalConsumed / totalGoal) * 100 : 0,
    };
  };

  const stats = calculateWeeklyStats();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading history...</Text>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Hydration History</Text>
            <Text style={styles.subtitle}>Track your progress over time</Text>
          </View>

          {/* Weekly Chart */}
          <HistoryChart weekData={weekData} />

          {/* Weekly Stats */}
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>This Week's Summary</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{Math.round(stats.totalConsumed / 1000)}L</Text>
                <Text style={styles.statLabel}>Total Consumed</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.daysAchieved}/7</Text>
                <Text style={styles.statLabel}>Goals Achieved</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{Math.round(stats.averageDaily)}ml</Text>
                <Text style={styles.statLabel}>Daily Average</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{Math.round(stats.weeklyPercentage)}%</Text>
                <Text style={styles.statLabel}>Weekly Goal</Text>
              </View>
            </View>
          </View>

          {/* Insights */}
          <View style={styles.insightsContainer}>
            <Text style={styles.insightsTitle}>Insights</Text>
            
            {stats.daysAchieved >= 5 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>
                  🎉 Great job! You've achieved your daily goal {stats.daysAchieved} days this week.
                </Text>
              </View>
            )}
            
            {stats.daysAchieved < 3 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>
                  💪 You can do better! Try setting reminders to drink water throughout the day.
                </Text>
              </View>
            )}
            
            {stats.weeklyPercentage > 100 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>
                  🌟 Amazing! You've exceeded your weekly hydration goal. Keep it up!
                </Text>
              </View>
            )}
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
  },
  statsContainer: {
    backgroundColor: Colors.background.white,
    borderRadius: 16,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statsTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  statValue: {
    ...Typography.header,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.text.medium,
    textAlign: 'center',
    marginTop: 4,
  },
  insightsContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  insightsTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  insightCard: {
    backgroundColor: Colors.background.white,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  insightText: {
    ...Typography.body,
    color: Colors.text.dark,
    lineHeight: 22,
  },
  bottomSpacing: {
    height: Spacing.xxl,
  },
});