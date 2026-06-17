import Svg, { Path } from 'react-native-svg'

// Parqin brand mark (assets/logo_transparent.svg).
export const LOGO_VIEWBOX = '0 0 589 745'
export const LOGO_PATHS = [
  'M588.467 658.276L543.547 744.778C543.547 744.778 433.92 568.157 427.83 562.066C421.739 555.976 348.655 574.247 360.835 562.066C373.016 549.885 588.467 300.328 588.467 300.328V658.276Z',
  'M294.414 0C457.014 9.83623e-05 588.828 131.016 588.828 292.633C588.828 454.25 457.014 585.267 294.414 585.267C131.814 585.267 0 454.25 0 292.633C0.000165938 131.016 131.814 0 294.414 0ZM294.414 131.774C205.246 131.774 132.961 204.059 132.961 293.227C132.961 382.394 205.246 454.68 294.414 454.68C383.582 454.68 455.866 382.394 455.866 293.227C455.866 204.059 383.582 131.775 294.414 131.774Z',
]

export function LogoMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={(size * 745) / 589} viewBox={LOGO_VIEWBOX}>
      {LOGO_PATHS.map((d) => (
        <Path key={d} d={d} fill={color} />
      ))}
    </Svg>
  )
}
