import Svg, { Path } from 'react-native-svg'

// sPark brand mark (assets/logo_transparent.svg).
export const LOGO_VIEWBOX = '0 0 318 421'
export const LOGO_PATHS = [
  'M237.25 149.5H312.822C312.822 52 232.859 1 156.859 1C80.8585 1 5 73.5 5 149.5C5.00015 193.5 10.3674 218 33.7501 258.5H198.25C200.459 258.5 202.212 260.293 201.566 262.405C196.773 278.074 168.161 310.133 158.861 316.536C157.684 317.346 156.238 316.983 155.213 315.987C150.167 311.087 146.102 307.78 139.322 301H57.7132C65.5664 318.492 136.785 404.249 155.895 411.68C156.549 411.935 157.117 411.95 157.771 411.694C179.964 402.989 312.822 272.311 312.822 192H74.2501V149.5C74.2501 112.5 112.358 68.5 156.859 68.5C196.859 68.5 237.25 105.5 237.25 149.5Z',
]

export function LogoMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={(size * 421) / 318} viewBox={LOGO_VIEWBOX}>
      {LOGO_PATHS.map((d) => (
        <Path key={d} d={d} fill={color} />
      ))}
    </Svg>
  )
}
