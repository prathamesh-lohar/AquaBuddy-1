import React, { useRef } from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  Animated,
  Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Droplet } from 'lucide-react-native';
import { Colors, Typography, BorderRadius, Shadow } from '../constants/theme';

interface QuickAddButtonProps {
  amount: number;
  onPress: (amount: number) => void;
  unit?: 'ml' | 'oz';
}

export const QuickAddButton: React.FC<QuickAddButtonProps> = ({
  amount,
  onPress,
  unit = 'ml',
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress(amount);
  };

  const displayAmount = unit === 'oz' ? Math.round(amount * 0.033814) : amount;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
        style={styles.container}
      >
        <LinearGradient
          colors={Colors.water.gradient}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Droplet 
            size={20} 
            color={Colors.background.white} 
            strokeWidth={2}
            style={styles.icon}
          />
          <Text style={styles.text}>
            +{displayAmount}{unit}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.large,
    overflow: 'hidden',
    ...Shadow.medium,
  },
  gradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    ...Typography.caption,
    color: Colors.background.white,
    fontWeight: '600',
  },
});