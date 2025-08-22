import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius, Shadow, Spacing } from '../constants/theme';

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  color = Colors.primary,
}) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.white,
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    ...Shadow.small,
  },
  value: {
    ...Typography.title,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  label: {
    ...Typography.caption,
    color: Colors.text.medium,
    textAlign: 'center',
  },
});