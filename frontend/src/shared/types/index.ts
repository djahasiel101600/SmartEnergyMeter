// Device types
export interface Device {
  id: string
  name: string
  token: string
  mac_address: string | null
  status: 'online' | 'offline' | 'error'
  last_seen: string | null
  firmware_version: string
  lcd_enabled: boolean
  lcd_rotation_interval: number
  lcd_templates: Array<{ line1: string; line2: string }>
  nominal_voltage: number
  is_online: boolean
  total_readings: number
  latest_reading: LatestReading | null
  created_at: string
  updated_at: string
}

export interface LatestReading {
  timestamp: string
  power: number
  energy: number
  voltage: number
  current: number
}

// Energy Reading types
export interface EnergyReading {
  id: string
  device: string
  device_name: string
  voltage: number
  current: number
  power: number
  energy: number
  frequency: number
  power_factor: number
  timestamp: string
  cost: number | null
  created_at: string
}

// Rate Configuration types
export interface RateConfiguration {
  id: string
  device: string
  device_name: string
  rate_per_kwh: number
  name: string
  description: string
  start_time: string | null
  end_time: string | null
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

// Firmware types
export interface FirmwareVersion {
  id: string
  version: string
  description: string
  firmware_file: string
  file_size: number
  file_size_display: string
  checksum: string
  is_stable: boolean
  is_latest: boolean
  min_compatible_version: string
  download_url: string | null
  created_at: string
  updated_at: string
}

// OTA Update types
export interface OTAUpdate {
  id: string
  device: string
  device_name: string
  firmware_version: string
  firmware_version_number: string
  status: 'pending' | 'downloading' | 'installing' | 'completed' | 'failed' | 'cancelled'
  status_display: string
  progress: number
  error_message: string
  initiated_at: string
  started_at: string | null
  completed_at: string | null
  previous_version: string
  duration: number | null
}

// Statistics types
export interface DeviceStatistics {
  total_devices: number
  online_devices: number
  offline_devices: number
  error_devices: number
}

export interface EnergyStatistics {
  total_energy: number
  total_cost: number
  average_power: number
  peak_power: number
  total_readings: number
  date_range: {
    start: string | null
    end: string | null
  }
}

// Analytics types
export interface CostProjection {
  daily: number
  weekly: number
  monthly: number
  currency: string
  confidence: 'low' | 'medium' | 'high'
  hourly_kwh?: number
  daily_kwh?: number
  rate_per_kwh?: number
  data_points?: number
  period_hours?: number
  message?: string
}

export interface UsagePattern {
  hourly_averages?: Record<number, {
    avg_power: number
    max_power: number
    min_power: number
    sample_count: number
  }>
  peak_hours?: Array<{ hour: number; avg_power: number }>
  low_hours?: Array<{ hour: number; avg_power: number }>
  daily_data?: Array<{
    date: string
    energy_kwh: number
    avg_power: number
    max_power: number
    day_of_week: string
  }>
  avg_daily_energy?: number
  weekday_averages?: Record<string, number>
  highest_day?: any
  lowest_day?: any
  analysis_period_days?: number
  error?: string
}

export interface Anomaly {
  power_spikes: Array<{
    timestamp: string
    power: number
    voltage: number
    current: number
    deviation_pct: number
    severity: 'medium' | 'high'
  }>
  unusual_consumption: {
    is_anomalous: boolean
    severity: 'normal' | 'medium' | 'high'
    current_rate_kwh_per_hour: number
    historical_rate_kwh_per_hour: number
    deviation_pct: number
    message: string
  } | { error: string }
}

export interface ApplianceDetection {
  likely_appliances: Array<{
    appliance: string
    confidence: number
    power_range: string
    current_power: number
  }>
  recent_events: Array<{
    timestamp: string
    event_type: 'device_on' | 'device_off'
    power_change: number
    power_before: number
    power_after: number
  }>
}

// WebSocket message types
export interface WSEnergyUpdate {
  type: 'energy_update'
  device_id: string
  device_name: string
  reading_id: string
  data: {
    voltage: number
    current: number
    power: number
    energy: number
    frequency: number
    power_factor: number
    cost: number | null
    currency: string
  }
  timestamp: string
}

export interface WSDeviceStatus {
  type: 'device_status'
  device_id: string
  device_name: string
  status: 'online' | 'offline' | 'error'
  timestamp: string
}

export interface WSNotification {
  type: 'notification'
  notification_type: string
  device_id?: string
  device_name?: string
  message: string
  timestamp: string
}

export interface WSPong {
  type: 'pong'
}

export type WSMessage = WSEnergyUpdate | WSDeviceStatus | WSNotification | WSPong
