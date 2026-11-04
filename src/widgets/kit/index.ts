/** Shared kit for React widgets. See the Widgets section of CLAUDE.md for the rules these enforce. */
export { Widget, Slider, KpiRow, StepPlayer, type Kpi, type Tone } from './controls'
export { ThemeCanvas, readTokens, type CanvasFrame, type Tokens } from './ThemeCanvas'
export { BarList, Legend, LineChart, SERIES, type BarItem, type LineSeries } from './charts'
export { DataGate, DataSource, useProjectData, type DataReader, type ProjectData } from './dataset'
export { useNearViewport, useProject, useReducedMotion, useWidth } from './hooks'
export { fmt, pct } from './format'
