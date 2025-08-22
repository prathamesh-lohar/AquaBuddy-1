import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, BorderRadius } from '../constants/theme';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 12,
  showPercentage = true,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <Animated.View
          style={[
            styles.progressContainer,
            {
              width: progressWidth,
              height,
              borderRadius: height / 2,
            },
          ]}
        >
          <LinearGradient
            colors={Colors.water.gradient}
            style={[styles.progress, { borderRadius: height / 2 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </View>
      
      {showPercentage && (
        <Text style={styles.percentage}>
          {Math.round(progress)}% of daily goal
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  track: {
    width: '100%',
    backgroundColor: Colors.background.light,
    overflow: 'hidden',
  },
  progressContainer: {
    overflow: 'hidden',
  },
  progress: {
    flex: 1,
  },
  percentage: {
    ...Typography.caption,
    color: Colors.text.medium,
    marginTop: 8,
  },
});