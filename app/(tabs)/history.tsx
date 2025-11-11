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

import { DayRecord, WaterIntake } from '../../types';
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
      
      let records = await StorageService.getWeekRecords(startOfWeek);
      
      // Add sample data if no records exist
      if (records.every(record => record.total === 0)) {
        records = generateSampleWeekData(startOfWeek);
        // Save sample data to storage
        for (const record of records) {
          await StorageService.saveDayRecord(record);
        }
      }
      
      setWeekData(records);
    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSampleWeekData = (startOfWeek: Date): DayRecord[] => {
    const sampleData: DayRecord[] = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      // Generate realistic water intake data
      const goal = 3000; // 3L daily goal
      const baseIntake = 2000 + Math.random() * 1500; // 2-3.5L variation
      const total = Math.floor(baseIntake);
      
      // Generate intake sessions throughout the day
      const intakes: WaterIntake[] = [];
      let currentTime = new Date(date);
      currentTime.setHours(7, 0, 0, 0); // Start at 7 AM
      
      let remainingWater = total;
      let sessionCount = 6 + Math.floor(Math.random() * 4); // 6-10 sessions per day
      
      for (let j = 0; j < sessionCount && remainingWater > 0; j++) {
        const sessionAmount = Math.min(
          remainingWater,
          100 + Math.random() * 400 // 100-500ml per session
        );
        
        intakes.push({
          id: `${dateString}-${j}`,
          amount: Math.floor(sessionAmount),
          timestamp: new Date(currentTime),
          date: dateString,
        });
        
        remainingWater -= sessionAmount;
        // Move to next session (1-3 hours later)
        currentTime.setHours(currentTime.getHours() + 1 + Math.random() * 2);
      }
      
      sampleData.push({
        date: dateString,
        total,
        goal,
        intakes,
        achieved: total >= goal * 0.8, // Achieved if >= 80% of goal
      });
    }
    
    return sampleData;
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
        colors={['#E3F2FD', '#FFFFFF']}
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
                <Text style={styles.statValue}>{(stats.totalConsumed / 1000).toFixed(1)}L</Text>
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

            {/* Additional weekly metrics */}
            <View style={styles.weeklyMetrics}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Best Day:</Text>
                <Text style={styles.metricValue}>
                  {weekData.length > 0 ? 
                    new Date(weekData.reduce((best, day) => 
                      day.total > best.total ? day : best
                    ).date).toLocaleDateString('en-US', { weekday: 'long' }) : 'N/A'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Consistency Score:</Text>
                <Text style={styles.metricValue}>{Math.round((stats.daysAchieved / 7) * 100)}%</Text>
              </View>
            </View>
          </View>

          {/* Insights */}
          <View style={styles.insightsContainer}>
            <Text style={styles.insightsTitle}>Personal Insights</Text>
            
            {stats.daysAchieved >= 5 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>
                  🎉 Excellent! You've achieved your daily goal {stats.daysAchieved} days this week. You're building a great hydration habit!
                </Text>
              </View>
            )}
            
            {stats.daysAchieved >= 3 && stats.daysAchieved < 5 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>
                  � Good progress! You've hit your goal {stats.daysAchieved} days this week. Try to be more consistent for better results.
                </Text>
              </View>
            )}
            
            {stats.daysAchieved < 3 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>
                  💪 Room for improvement! Set hourly reminders and keep a water bottle nearby to stay on track.
                </Text>
              </View>
            )}
            
            {stats.weeklyPercentage > 100 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>
                  🌟 Outstanding! You've exceeded your weekly hydration goal by {Math.round(stats.weeklyPercentage - 100)}%. Keep up the amazing work!
                </Text>
              </View>
            )}

            {stats.averageDaily > 0 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>
                  📊 Your daily average is {Math.round(stats.averageDaily)}ml. 
                  {stats.averageDaily >= 2500 
                    ? " That's great hydration!" 
                    : " Try to increase by 200-300ml daily for optimal health."}
                </Text>
              </View>
            )}

            <View style={styles.insightCard}>
              <Text style={styles.insightText}>
                💡 Tip: The best times to hydrate are upon waking, before meals, and during exercise. Spread your intake throughout the day for maximum benefit!
              </Text>
            </View>
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
  weeklyMetrics: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  metricLabel: {
    ...Typography.body,
    color: Colors.text.medium,
    fontWeight: '500',
  },
  metricValue: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
});