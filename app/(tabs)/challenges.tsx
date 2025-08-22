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

import { Challenge } from '../../types';
import { ChallengeCard } from '../../components/ChallengeCard';
import { useWaterTracking } from '../../hooks/useWaterTracking';
import { Colors, Typography, Spacing } from '../../constants/theme';

export default function ChallengesScreen() {
  const { currentTotal, streakCount } = useWaterTracking();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const initializeChallenges = () => {
    const challengesList: Challenge[] = [
      {
        id: '1',
        title: '7-Day Streak',
        description: 'Achieve your daily goal for 7 consecutive days',
        target: 7,
        progress: streakCount,
        completed: streakCount >= 7,
        reward: '100 Points + Streak Master Badge',
        icon: 'calendar',
      },
      {
        id: '2',
        title: 'Hydration Hero',
        description: 'Drink 3 liters of water today',
        target: 3000,
        progress: currentTotal,
        completed: currentTotal >= 3000,
        reward: '50 Points + Hero Badge',
        icon: 'trophy',
      },
      {
        id: '3',
        title: 'Morning Booster',
        description: 'Drink 500ml within 2 hours of waking up',
        target: 500,
        progress: Math.min(currentTotal, 500), // Simplified for demo
        completed: currentTotal >= 500,
        reward: '25 Points + Early Bird Badge',
        icon: 'target',
      },
      {
        id: '4',
        title: 'Weekly Warrior',
        description: 'Complete 21 liters this week (3L/day × 7 days)',
        target: 21000,
        progress: currentTotal * 7, // Simplified calculation for demo
        completed: (currentTotal * 7) >= 21000,
        reward: '200 Points + Warrior Badge',
        icon: 'trophy',
      },
      {
        id: '5',
        title: 'Consistency Champion',
        description: 'Log water intake 5 times in one day',
        target: 5,
        progress: 3, // Mock data - would track actual intake count
        completed: false,
        reward: '30 Points + Champion Badge',
        icon: 'target',
      },
    ];

    setChallenges(challengesList);
  };

  useEffect(() => {
    initializeChallenges();
  }, [currentTotal, streakCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    initializeChallenges();
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleChallengePress = (challenge: Challenge) => {
    // Could navigate to challenge details or show more info
    console.log('Challenge pressed:', challenge.title);
  };

  const completedChallenges = challenges.filter(c => c.completed);
  const activeChallenges = challenges.filter(c => !c.completed);
  const totalPoints = completedChallenges.length * 50; // Simplified point calculation

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
            <Text style={styles.title}>Daily Challenges</Text>
            <Text style={styles.subtitle}>Complete challenges to earn rewards</Text>
          </View>

          {/* Points Summary */}
          <View style={styles.pointsContainer}>
            <View style={styles.pointsCard}>
              <Text style={styles.pointsValue}>{totalPoints}</Text>
              <Text style={styles.pointsLabel}>Total Points</Text>
            </View>
            <View style={styles.pointsCard}>
              <Text style={styles.pointsValue}>{completedChallenges.length}</Text>
              <Text style={styles.pointsLabel}>Completed</Text>
            </View>
            <View style={styles.pointsCard}>
              <Text style={styles.pointsValue}>{streakCount}</Text>
              <Text style={styles.pointsLabel}>Day Streak</Text>
            </View>
          </View>

          {/* Active Challenges */}
          {activeChallenges.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Challenges</Text>
              {activeChallenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onPress={handleChallengePress}
                />
              ))}
            </View>
          )}

          {/* Completed Challenges */}
          {completedChallenges.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Completed Today</Text>
              {completedChallenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onPress={handleChallengePress}
                />
              ))}
            </View>
          )}

          {/* Motivation Section */}
          <View style={styles.motivationContainer}>
            <Text style={styles.motivationTitle}>🎯 Keep Going!</Text>
            <Text style={styles.motivationText}>
              Every drop counts towards your hydration goals. 
              Complete challenges to unlock achievements and stay motivated!
            </Text>
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
  pointsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  pointsCard: {
    flex: 1,
    backgroundColor: Colors.background.white,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  pointsValue: {
    ...Typography.header,
    fontSize: 24,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  pointsLabel: {
    ...Typography.caption,
    color: Colors.text.medium,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.md,
  },
  motivationContainer: {
    backgroundColor: Colors.background.white,
    borderRadius: 16,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  motivationTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.sm,
  },
  motivationText: {
    ...Typography.body,
    color: Colors.text.medium,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSpacing: {
    height: Spacing.xxl,
  },
});