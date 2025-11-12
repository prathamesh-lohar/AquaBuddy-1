import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, ClipPath, Rect } from 'react-native-svg';
import { Colors } from '../constants/theme';

interface WaterBottleProps {
  progress: number; // 0-1
  size?: number;
  capacity?: number; // in ml for labeling
}

const { width: screenWidth } = Dimensions.get('window');

export const WaterBottle: React.FC<WaterBottleProps> = ({ 
  progress, 
  size = screenWidth * 0.4,
  capacity = 1000
}) => {
  const waterLevelAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Ensure progress is within valid range
  const validProgress = Math.min(Math.max(Number(progress) || 0, 0), 1);
  const validCapacity = Math.max(Number(capacity) || 1000, 100); // Minimum 100ml

  useEffect(() => {
    // Animate water level
    Animated.timing(waterLevelAnim, {
      toValue: validProgress,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    // Wave animation
    const waveAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    
    waveAnimation.start();

    return () => {
      waveAnimation.stop();
    };
  }, [validProgress]);

  const bottleHeight = size * 1.4;
  const bottleWidth = size;

  const waterHeight = waterLevelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '80%'],
    extrapolate: 'clamp',
  });

  const waveTranslateY = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  return (
    <View style={[styles.container, { width: bottleWidth, height: bottleHeight }]}>
      {/* SVG Bottle */}
      <Svg
        height={bottleHeight}
        width={bottleWidth}
        viewBox="0 0 120 180"
        style={styles.bottleSvg}
      >
        <Defs>
          <ClipPath id="bottleClip">
            {/* Bottle shape for clipping water */}
            <Path d="M30 30 L30 155 Q30 165 40 165 L80 165 Q90 165 90 155 L90 30 Q90 25 85 25 L75 25 L75 10 Q75 5 70 5 L50 5 Q45 5 45 10 L45 25 L35 25 Q30 25 30 30 Z" />
          </ClipPath>
        </Defs>
        
        {/* Bottle Outline */}
        <Path
          d="M30 30 L30 155 Q30 165 40 165 L80 165 Q90 165 90 155 L90 30 Q90 25 85 25 L75 25 L75 10 Q75 5 70 5 L50 5 Q45 5 45 10 L45 25 L35 25 Q30 25 30 30 Z"
          stroke={Colors.primary}
          strokeWidth="3"
          fill="rgba(173, 216, 230, 0.1)"
        />
        
        {/* Bottle Cap */}
        <Path
          d="M45 0 L75 0 Q78 0 78 3 L78 12 Q78 15 75 15 L45 15 Q42 15 42 12 L42 3 Q42 0 45 0 Z"
          fill={Colors.accent}
          stroke={Colors.accent}
          strokeWidth="2"
        />

        {/* Bottle Label */}
        <Rect
          x="35"
          y="80"
          width="50"
          height="30"
          rx="8"
          fill="rgba(255, 255, 255, 0.9)"
          stroke={Colors.primary}
          strokeWidth="1"
        />
      </Svg>

      {/* Water Fill with Animation */}
      <Animated.View
        style={[
          styles.waterFill,
          {
            height: waterHeight,
            width: bottleWidth * 0.48,
            bottom: bottleHeight * 0.1,
          }
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(30, 144, 255, 0.8)',
            'rgba(0, 191, 255, 0.9)',
            'rgba(135, 206, 250, 0.8)'
          ]}
          style={styles.gradient}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
        />
        
        {/* Water Surface Wave */}
        {validProgress > 0.05 && (
          <Animated.View
            style={[
              styles.waterWave,
              {
                transform: [{ translateY: waveTranslateY }],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.4)', 'rgba(30, 144, 255, 0.3)']}
              style={styles.waveFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </Animated.View>
        )}
      </Animated.View>

      {/* Bottle Info */}
      <View style={styles.bottleInfo}>
        <Text style={styles.capacityText}>{validCapacity}ml</Text>
        <Text style={styles.levelText}>{Math.round(validProgress * 100)}%</Text>
      </View>

     
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottleSvg: {
    position: 'absolute',
  },
  waterFill: {
    position: 'absolute',
    borderRadius: 15,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    borderRadius: 15,
  },
  waterWave: {
    position: 'absolute',
    top: -3,
    left: 0,
    right: 0,
    height: 6,
  },
  waveFill: {
    flex: 1,
    borderRadius: 8,
  },
  bottleInfo: {
    position: 'absolute',
    top: '45%',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  capacityText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  levelText: {
    fontSize: 12,
    color: Colors.text.medium,
    marginTop: 2,
  },
  iotIndicator: {
    position: 'absolute',
    top: 10,
    right: -25,
    alignItems: 'center',
  },
  iotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginBottom: 3,
  },
  iotText: {
    fontSize: 8,
    color: Colors.text.medium,
    fontWeight: '600',
  },
});