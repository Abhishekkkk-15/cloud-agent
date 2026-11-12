import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect, Path, Circle, Line } from 'react-native-svg';

export interface BrandLogoProps {
  size?: number;
  showSquircle?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
  color?: string;
}

/**
 * Cloud Agent Official Brand Logo (Matching Web BrandLogo & Favicon SVG)
 *
 * Visual Components:
 * 1. Swiss Minimalist Ink Squircle Background (#111010) with subtle hairline border
 * 2. Cyberpunk Technical Alignment Crosshairs (Top-Left, Bottom-Left, Bottom-Right)
 * 3. Swiss Signal Red Active Telemetry Beacon with ring (#DC201E)
 * 4. Mathematically Centered Tactile Cloud Silhouette (#F8F3EC)
 * 5. Terminal Agent Execution Glyph (> in #111010, _ cursor in #DC201E)
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 32,
  showSquircle = true,
  style,
}) => {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
      >
        {showSquircle && (
          <>
            {/* Swiss Minimalist Ink Squircle Background */}
            <Rect width="32" height="32" rx="7" fill="#111010" />
            <Rect
              x="0.5"
              y="0.5"
              width="31"
              height="31"
              rx="6.5"
              fill="none"
              stroke="rgba(248, 243, 236, 0.16)"
              strokeWidth="1"
            />

            {/* Cyberpunk Technical Alignment Crosshairs */}
            <Path
              d="M3.5 6.5 H5.5 M4.5 5.5 V7.5"
              stroke="rgba(248, 243, 236, 0.35)"
              strokeWidth="0.8"
            />
            <Path
              d="M3.5 25.5 H5.5 M4.5 24.5 V26.5"
              stroke="rgba(248, 243, 236, 0.35)"
              strokeWidth="0.8"
            />
            <Path
              d="M26.5 25.5 H28.5 M27.5 24.5 V26.5"
              stroke="rgba(248, 243, 236, 0.35)"
              strokeWidth="0.8"
            />
          </>
        )}

        {/* Swiss Signal Red Active Telemetry Beacon (Top-Right) */}
        <Circle cx="25" cy="7" r="2.2" fill="#DC201E" />
        <Circle
          cx="25"
          cy="7"
          r="3.8"
          fill="none"
          stroke="#DC201E"
          strokeWidth="0.6"
          opacity={0.45}
        />

        {/* Mathematically Centered Cloud Silhouette */}
        <Path
          d="M 7.5 23.5 C 5.5 23.5 4 21.8 4 19.5 C 4 17.3 5.6 15.6 7.8 15.3 C 8.6 11.2 12 8 16 8 C 20 8 23.4 11.2 24.2 15.3 C 26.4 15.6 28 17.3 28 19.5 C 28 21.8 26.5 23.5 24.5 23.5 Z"
          fill="#F8F3EC"
        />

        {/* Terminal Agent Execution Glyph: >_ */}
        <Path
          d="M 11 16.5 L 14.5 18.5 L 11 20.5"
          fill="none"
          stroke="#111010"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line
          x1="17"
          y1="20.5"
          x2="21"
          y2="20.5"
          stroke="#DC201E"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

/**
 * Backward compatibility alias for CloudAgentLogo
 */
export const CloudAgentLogo = BrandLogo;
