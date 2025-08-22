import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { DayRecord } from '../types';
import { Colors, Typography, BorderRadius, Shadow, Spacing } from '../constants/theme';

interface HistoryChartProps {
  weekData: DayRecord[];
}

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - (Spacing.lg * 2);
const barWidth = (chartWidth - (Spacing.sm * 6)) / 7;
const chartHeight = 200;

export const HistoryChart: React.FC<HistoryChartProps> = ({ weekData }) => {
  const maxGoal = Math.max(...weekData.map(day => day.goal));

  const getBarHeight = (total: number, goal: number) => {
    const percentage = total / Math.max(goal, maxGoal);
    return Math.max(percentage * chartHeight, 2);
  };

  const getDayLabel = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getStatusIcon = (achieved: boolean) => {
    return achieved ? '✅' : '⚠️';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Progress</Text>
      
      <View style={styles.chartContainer}>
        {weekData.map((day, index) => {
          const barHeight = getBarHeight(day.total, day.goal);
          const achievementPercentage = (day.total / day.goal) * 100;
          
          return (
            <View key={day.date} style={styles.barContainer}>
              <View style={[styles.barBackground, { height: chartHeight }]}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: day.achieved ? Colors.primary : Colors.warning,
                    },
                  ]}
                />
              </View>
              
              <Text style={styles.percentage}>
                {Math.round(achievementPercentage)}%
              </Text>
              
              <Text style={styles.dayLabel}>
                {getDayLabel(day.date)}
              </Text>
              
              <Text style={styles.statusIcon}>
                {getStatusIcon(day.achieved)}
              </Text>
            </View>
          );
        })}
      </View>
      
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>Goal Achieved</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: Colors.warning }]} />
          <Text style={styles.legendText}>In Progress</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.white,
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadow.small,
  },
  title: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: chartHeight + 80,
    marginBottom: Spacing.md,
  },
  barContainer: {
    alignItems: 'center',
    width: barWidth,
  },
  barBackground: {
    width: barWidth - 4,
    backgroundColor: Colors.background.light,
    borderRadius: 4,
    justifyContent: 'flex-end',
    marginBottom: Spacing.sm,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 2,
  },
  percentage: {
    ...Typography.small,
    color: Colors.text.medium,
    marginBottom: 2,
  },
  dayLabel: {
    ...Typography.caption,
    color: Colors.text.dark,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusIcon: {
    fontSize: 14,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  legendText: {
    ...Typography.caption,
    color: Colors.text.medium,
  },
});