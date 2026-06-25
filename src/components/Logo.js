// RecipeNest brand mark — a woven nest with an egg.
// Source SVG per docs/design_handoff_recipenest/README.md "Logo / brand mark".
import Svg, { Path, Circle } from 'react-native-svg';

export default function LogoMark({ size = 16, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 11a9 6 0 0 0 18 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 11.8a5.5 3.4 0 0 0 11 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10.2} r={2.4} fill={color} />
    </Svg>
  );
}
