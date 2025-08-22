import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lightbulb } from 'lucide-react-native';
import { Colors, Typography, BorderRadius, Shadow, Spacing } from '../constants/theme';

interface TipCardProps {
  tip: string;
}

export const TipCard: React.FC<TipCardProps> = ({ tip }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Lightbulb 
          size={20} 
          color={Colors.primary} 
          strokeWidth={2}
        />
        <Text style={styles.title}>Hydration Tip</Text>
      </View>
      <Text style={styles.tip}>{tip}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.white,
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    ...Shadow.small,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
  tip: {
    ...Typography.body,
    color: Colors.text.dark,
    lineHeight: 22,
  },
});