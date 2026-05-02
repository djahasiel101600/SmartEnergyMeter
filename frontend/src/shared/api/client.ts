import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type {
  Device,
  EnergyReading,
  RateConfiguration,
  FirmwareVersion,
  OTAUpdate,
  DeviceStatistics,
  EnergyStatistics,
  CostProjection,
  UsagePattern,
  Anomaly,
  ApplianceDetection,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    const response = await this.client.get('/devices/')
    return response.data.results || response.data
  }

  async getDevice(id: string): Promise<Device> {
    const response = await this.client.get(`/devices/${id}/`)
    return response.data
  }

  async createDevice(data: Partial<Device>): Promise<Device> {
    const response = await this.client.post('/devices/', data)
    return response.data
  }

  async updateDevice(id: string, data: Partial<Device>): Promise<Device> {
    const response = await this.client.patch(`/devices/${id}/`, data)
    return response.data
  }

  async deleteDevice(id: string): Promise<void> {
    await this.client.delete(`/devices/${id}/`)
  }

  async getDeviceStatistics(id: string, hours: number = 24): Promise<any> {
    const response = await this.client.get(`/devices/${id}/statistics/`, {
      params: { hours },
    })
    return response.data
  }

  async getDeviceReadings(id: string, hours: number = 24): Promise<EnergyReading[]> {
    const response = await this.client.get(`/devices/${id}/readings/`, {
      params: { hours },
    })
    return response.data.results || response.data
  }

  async getAllDeviceStatistics(): Promise<DeviceStatistics> {
    const response = await this.client.get('/devices/statistics_all/')
    return response.data
  }

  // Analytics
  async getCostProjection(deviceId: string, hours: number = 24): Promise<CostProjection> {
    const response = await this.client.get(`/devices/${deviceId}/cost_projection/`, {
      params: { hours },
    })
    return response.data
  }

  async getUsagePattern(deviceId: string, type: 'hourly' | 'daily' = 'hourly', days: number = 7): Promise<UsagePattern> {
    const response = await this.client.get(`/devices/${deviceId}/usage_pattern/`, {
      params: { type, days },
    })
    return response.data
  }

  async detectAnomalies(deviceId: string, hours: number = 24): Promise<Anomaly> {
    const response = await this.client.get(`/devices/${deviceId}/detect_anomalies/`, {
      params: { hours },
    })
    return response.data
  }

  async detectAppliances(deviceId: string, hours: number = 1): Promise<ApplianceDetection> {
    const response = await this.client.get(`/devices/${deviceId}/detect_appliances/`, {
      params: { hours },
    })
    return response.data
  }

  async comparePeriods(deviceId: string, p1Start: string, p1End: string, p2Start: string, p2End: string): Promise<any> {
    const response = await this.client.post(`/devices/${deviceId}/compare_periods/`, {
      period1_start: p1Start,
      period1_end: p1End,
      period2_start: p2Start,
      period2_end: p2End,
    })
    return response.data
  }

  async pushLcdTemplates(deviceId: string, templates: Array<{ line1: string; line2: string }>): Promise<Device> {
    const response = await this.client.post(`/devices/${deviceId}/push_lcd_templates/`, {
      lcd_templates: templates,
    })
    return response.data
  }

  async resetEnergy(deviceId: string): Promise<{ status: string; device: string; message: string }> {
    const response = await this.client.post(`/devices/${deviceId}/reset_energy/`)
    return response.data
  }

  // Energy Readings
  async getReadings(params?: {
    device?: string
    hours?: number
    start_date?: string
    end_date?: string
  }): Promise<EnergyReading[]> {
    const response = await this.client.get('/readings/', { params })
    return response.data.results || response.data
  }

  async getReadingStatistics(params?: any): Promise<EnergyStatistics> {
    const response = await this.client.get('/readings/statistics/', { params })
    return response.data
  }

  // Rate Configurations
  async getRates(deviceId?: string): Promise<RateConfiguration[]> {
    const response = await this.client.get('/rates/', {
      params: deviceId ? { device: deviceId } : undefined,
    })
    return response.data.results || response.data
  }

  async createRate(data: Partial<RateConfiguration>): Promise<RateConfiguration> {
    const response = await this.client.post('/rates/', data)
    return response.data
  }

  async updateRate(id: string, data: Partial<RateConfiguration>): Promise<RateConfiguration> {
    const response = await this.client.patch(`/rates/${id}/`, data)
    return response.data
  }

  async deleteRate(id: string): Promise<void> {
    await this.client.delete(`/rates/${id}/`)
  }

  async setDefaultRate(id: string): Promise<RateConfiguration> {
    const response = await this.client.post(`/rates/${id}/set_default/`)
    return response.data
  }

  // Firmware
  async getFirmwareVersions(): Promise<FirmwareVersion[]> {
    const response = await this.client.get('/firmware/')
    return response.data.results || response.data
  }

  async getLatestFirmware(): Promise<FirmwareVersion> {
    const response = await this.client.get('/firmware/latest/')
    return response.data
  }

  async uploadFirmware(data: FormData): Promise<FirmwareVersion> {
    const response = await this.client.post('/firmware/', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  // OTA Updates
  async getOTAUpdates(deviceId?: string): Promise<OTAUpdate[]> {
    const response = await this.client.get('/ota-updates/', {
      params: deviceId ? { device: deviceId } : undefined,
    })
    return response.data.results || response.data
  }

  async createOTAUpdate(deviceId: string, firmwareVersionId: string): Promise<OTAUpdate> {
    const response = await this.client.post('/ota-updates/', {
      device: deviceId,
      firmware_version: firmwareVersionId,
    })
    return response.data
  }

  async cancelOTAUpdate(id: string): Promise<OTAUpdate> {
    const response = await this.client.post(`/ota-updates/${id}/cancel/`)
    return response.data
  }

  async retryOTAUpdate(id: string): Promise<OTAUpdate> {
    const response = await this.client.post(`/ota-updates/${id}/retry/`)
    return response.data
  }
}

export const api = new ApiClient()
export default api
