import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Trophy, Target, Calendar } from 'lucide-react-native';
import { Challenge } from '../types';
import { Colors, Typography, BorderRadius, Shadow, Spacing } from '../constants/theme';

interface ChallengeCardProps {
  challenge: Challenge;
  onPress?: (challenge: Challenge) => void;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  onPress,
}) => {
  const progressPercentage = (challenge.progress / challenge.target) * 100;
  
  const getIconComponent = () => {
    switch (challenge.icon) {
      case 'trophy':
        return <Trophy size={24} color={Colors.primary} strokeWidth={2} />;
      case 'target':
        return <Target size={24} color={Colors.primary} strokeWidth={2} />;
      case 'calendar':
        return <Calendar size={24} color={Colors.primary} strokeWidth={2} />;
      default:
        return <Trophy size={24} color={Colors.primary} strokeWidth={2} />;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        challenge.completed && styles.completedContainer,
      ]}
      onPress={() => onPress?.(challenge)}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          {getIconComponent()}
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{challenge.title}</Text>
          <Text style={styles.description}>{challenge.description}</Text>
        </View>
        {challenge.completed && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✓</Text>
          </View>
        )}
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(progressPercentage, 100)}%`,
                backgroundColor: challenge.completed ? Colors.success : Colors.primary,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {challenge.progress}/{challenge.target}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.reward}>🎁 {challenge.reward}</Text>
        <Text style={[
          styles.status,
          { color: challenge.completed ? Colors.success : Colors.primary }
        ]}>
          {challenge.completed ? 'Completed!' : `${Math.round(progressPercentage)}%`}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.white,
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.small,
  },
  completedContainer: {
    borderWidth: 2,
    borderColor: Colors.success,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...Typography.title,
    fontSize: 18,
    color: Colors.text.dark,
    marginBottom: 4,
  },
  description: {
    ...Typography.caption,
    color: Colors.text.medium,
    lineHeight: 18,
  },
  completedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedText: {
    color: Colors.background.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.background.light,
    borderRadius: 4,
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.text.medium,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reward: {
    ...Typography.caption,
    color: Colors.text.dark,
  },
  status: {
    ...Typography.caption,
    fontWeight: '600',
  },
});