export const Colors = {
  primary: '#00C9FF',
  secondary: '#92FE9D',
  accent: '#0099CC',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  background: {
    light: '#E3F2FD',
    white: '#FFFFFF',
    gradient: ['#E3F2FD', '#FFFFFF'],
  },
  text: {
    dark: '#333333',
    medium: '#666666',
    light: '#999999',
  },
  water: {
    gradient: ['#00C9FF', '#92FE9D'],
    surface: '#E3F8FF',
  },
};

export const Typography = {
  header: {
    fontSize: 28,
    fontWeight: 'bold' as const,
  },
  title: {
    fontSize: 24,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  small: 8,
  medium: 12,
  large: 20,
  round: 50,
};

export const Shadow = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
};