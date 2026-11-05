/** Shared kit for React widgets. See the Widgets section of CLAUDE.md for the rules these enforce. */
export { EventList, KpiRow, ScrollRegion, Slider, StepPlayer, Widget, type Kpi, type StepEvent, type Tone } from './controls'
export { ThemeCanvas, readTokens, type CanvasFrame, type Tokens } from './ThemeCanvas'
export { BarList, Legend, LineChart, SERIES, StackBar, TimeBars, type BarItem, type LineSeries, type StackSegment, type TimeBar } from './charts'
export { DataGate, DataSource, useProjectData, type DataReader, type ProjectData } from './dataset'
export { useNearViewport, useProject, useReducedMotion, useWidth } from './hooks'
export { fmt, pct } from './format'
