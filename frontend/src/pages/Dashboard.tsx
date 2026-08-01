// Dashboard.tsx
import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../shared/ui/card";
import { Button } from "../shared/ui/button";
import {
  formatCurrency,
  formatNumber,
  formatRelativeTime,
} from "../shared/lib/utils";
import { api } from "../shared/api/client";
import { useWebSocket } from "../shared/api/websocket";
import type { Device, WSMessage, WSEnergyUpdate } from "../shared/types";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Cpu,
  DollarSign,
  Download,
  Edit,
  Gauge,
  Monitor,
  Plus,
  Radio,
  RotateCcw,
  Settings,
  Trash2,
  Zap,
} from "lucide-react";
import { DeviceDialog } from "../features/devices/DeviceDialog";
import { ManageRatesDialog } from "../features/devices/ManageRatesDialog";
import { OTAUpdatesDialog } from "../features/devices/OTAUpdatesDialog";
import { LCDTemplateDialog } from "../features/devices/LCDTemplateDialog";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Voltage nominal thresholds — derived from device config at runtime
// Module-level defaults kept only as fallback when no device is selected
const DEFAULT_V_NOMINAL = 230; // Philippines standard
const FREQ_LOW = 49.5;
const FREQ_HIGH = 50.5;
const WEEKDAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function voltageColor(
  v: number | undefined,
  vLow: number,
  vHigh: number,
): string {
  if (!v) return "";
  return v < vLow || v > vHigh ? "text-orange-500" : "text-green-500";
}
function pfColor(pf: number | undefined): string {
  if (pf == null) return "";
  if (pf >= 0.9) return "text-green-500";
  if (pf >= 0.7) return "text-amber-500";
  return "text-red-500";
}
function pfLabel(pf: number | undefined): string {
  if (pf == null) return "";
  if (pf >= 0.9) return "Good";
  if (pf >= 0.7) return "Fair";
  return "Poor";
}

function DeltaBadge({
  current,
  previous,
}: {
  current?: number;
  previous?: number;
}) {
  if (current == null || previous == null || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5)
    return <ArrowRight className="h-3 w-3 inline text-muted-foreground" />;
  if (pct > 0)
    return (
      <span className="text-xs text-red-500 font-medium flex items-center gap-0.5">
        <ArrowUp className="h-3 w-3" />
        {pct.toFixed(1)}%
      </span>
    );
  return (
    <span className="text-xs text-green-500 font-medium flex items-center gap-0.5">
      <ArrowDown className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [costProjection, setCostProjection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ratesDialogOpen, setRatesDialogOpen] = useState(false);
  const [otaDialogOpen, setOtaDialogOpen] = useState(false);
  const [lcdTemplateDialogOpen, setLcdTemplateDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [powerHistory, setPowerHistory] = useState<
    { time: string; power: number; voltage: number; current: number }[]
  >([]);
  const [monthlyPattern, setMonthlyPattern] = useState<any>(null);

  // Analytics state
  const [deviceStats, setDeviceStats] = useState<any>(null);
  const [hourlyPattern, setHourlyPattern] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any>(null);
  const [appliances, setAppliances] = useState<any>(null);
  const [periodComparison, setPeriodComparison] = useState<any>(null);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<
    "hourly" | "weekday" | "monthly"
  >("hourly");

  const selectedDeviceRef = useRef<Device | null>(null);
  const lastAnalyticsRefreshRef = useRef<number>(0);
  const prevSelectedDeviceIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  const refreshLiveAnalytics = async (deviceId: string) => {
    const [costData, anomalyData, applianceData] = await Promise.allSettled([
      api.getCostProjection(deviceId, 24),
      api.detectAnomalies(deviceId, 24),
      api.detectAppliances(deviceId, 1),
    ]);
    if (costData.status === "fulfilled") setCostProjection(costData.value);
    if (anomalyData.status === "fulfilled") setAnomalies(anomalyData.value);
    if (applianceData.status === "fulfilled")
      setAppliances(applianceData.value);
    lastAnalyticsRefreshRef.current = Date.now();
  };

  const { isConnected } = useWebSocket({
    onMessage: (message: WSMessage) => {
      if (message.type === "energy_update") {
        const update = message as WSEnergyUpdate;
        setDevices((prev) =>
          prev.map((d) =>
            d.id === update.device_id
              ? { ...d, status: "online" as const, last_seen: update.timestamp }
              : d,
          ),
        );
        if (selectedDeviceRef.current?.id === update.device_id) {
          setLiveData(update.data);
          setPowerHistory((prev) => {
            const now = new Date();
            const newPoint = {
              time: now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
              power: update.data.power,
              voltage: update.data.voltage,
              current: update.data.current,
            };
            return [...prev, newPoint].slice(-60);
          });
          // Refresh cost, anomalies, appliances every 30 s
          if (Date.now() - lastAnalyticsRefreshRef.current > 30_000) {
            refreshLiveAnalytics(update.device_id);
          }
        }
      } else if (message.type === "device_status") {
        setDevices((prev) =>
          prev.map((d) =>
            d.id === message.device_id
              ? { ...d, status: message.status, last_seen: message.timestamp }
              : d,
          ),
        );
      }
    },
  });

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      const idChanged = selectedDevice.id !== prevSelectedDeviceIdRef.current;
      prevSelectedDeviceIdRef.current = selectedDevice.id;
      if (idChanged) {
        // Only wipe live data and chart history when switching to a different device
        setLiveData(null);
        // Seed chart history from recent API readings so charts aren't blank on load
        api.getDeviceReadings(selectedDevice.id, 1).then((readings) => {
          const sorted = [...readings].reverse(); // API returns newest-first; chart needs oldest-first
          const seeded = sorted.slice(-60).map((r) => ({
            time: new Date(r.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            power: r.power,
            voltage: r.voltage,
            current: r.current,
          }));
          setPowerHistory(seeded);
        }).catch(() => {
          setPowerHistory([]);
        });
      }
      loadAllAnalytics();
    }
  }, [selectedDevice]);

  const loadAllAnalytics = async () => {
    if (!selectedDevice) return;
    const id = selectedDevice.id;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const now = new Date();

    const [
      costData,
      monthlyData,
      statsData,
      hourlyData,
      anomalyData,
      applianceData,
    ] = await Promise.allSettled([
      api.getCostProjection(id, 24),
      api.getUsagePattern(id, "daily", 30),
      api.getDeviceStatistics(id, 24),
      api.getUsagePattern(id, "hourly", 7),
      api.detectAnomalies(id, 24),
      api.detectAppliances(id, 1),
    ]);

    if (costData.status === "fulfilled") setCostProjection(costData.value);
    if (monthlyData.status === "fulfilled")
      setMonthlyPattern(monthlyData.value);
    if (statsData.status === "fulfilled") setDeviceStats(statsData.value);
    if (hourlyData.status === "fulfilled") setHourlyPattern(hourlyData.value);
    if (anomalyData.status === "fulfilled") setAnomalies(anomalyData.value);
    if (applianceData.status === "fulfilled")
      setAppliances(applianceData.value);

    try {
      const comparison = await api.comparePeriods(
        id,
        yesterdayStart.toISOString(),
        todayStart.toISOString(),
        todayStart.toISOString(),
        now.toISOString(),
      );
      setPeriodComparison(comparison);
    } catch {
      // comparison not critical
    }
  };

  const loadDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data);
      if (data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0]);
      }
    } catch (error) {
      console.error("Failed to load devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = () => {
    setEditingDevice(null);
    setDialogOpen(true);
  };
  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setDialogOpen(true);
  };
  const handleDeleteDevice = async (device: Device) => {
    if (!confirm(`Are you sure you want to delete "${device.name}"?`)) return;
    try {
      await api.deleteDevice(device.id);
      await loadDevices();
      if (selectedDevice?.id === device.id) setSelectedDevice(null);
    } catch {
      alert("Failed to delete device. Please try again.");
    }
  };
  const handleResetEnergy = async (device: Device) => {
    if (
      !confirm(
        `Reset the energy counter on "${device.name}"?\n\nThis will:\n• Clear the accumulated kWh value on the physical PZEM sensor\n• Delete ALL stored readings for this device from the database\n\nThis cannot be undone.`,
      )
    )
      return;
    try {
      await api.resetEnergy(device.id);
      // Clear local chart and live data so the UI reflects the fresh start
      setPowerHistory([]);
      setLiveData(null);
      setCostProjection(null);
      setAnomalies(null);
      setAppliances(null);
      setDeviceStats(null);
      setMonthlyPattern(null);
      setHourlyPattern(null);
      setPeriodComparison(null);
    } catch {
      alert("Failed to send reset command. Make sure the device is online.");
    }
  };
  const handleDialogSuccess = async () => {
    await loadDevices();
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const currentData = liveData || selectedDevice?.latest_reading;

  // Per-device nominal voltage thresholds (±10%)
  const vNominal = selectedDevice?.nominal_voltage ?? DEFAULT_V_NOMINAL;
  const vLow = vNominal * 0.9;
  const vHigh = vNominal * 1.1;

  const prevPower =
    powerHistory.length >= 2
      ? powerHistory[powerHistory.length - 2].power
      : undefined;
  const prevCurrent =
    powerHistory.length >= 2
      ? powerHistory[powerHistory.length - 2].current
      : undefined;

  // Spike times for ReferenceArea overlay
  const spikeTimestamps: string[] = (anomalies?.power_spikes ?? []).map(
    (s: any) => {
      const d = new Date(s.timestamp);
      return d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    },
  );

  // Hourly chart: object {0..23} → flat array
  const hourlyChartData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, "0")}:00`,
    avg_power: hourlyPattern?.hourly_averages?.[h]?.avg_power ?? 0,
    max_power: hourlyPattern?.hourly_averages?.[h]?.max_power ?? 0,
  }));
  const peakHoursSet = new Set<number>(
    (hourlyPattern?.peak_hours ?? []).map((p: any) => Number(p.hour)),
  );

  // Weekday chart
  const weekdayChartData = WEEKDAY_ORDER.map((day) => ({
    day: day.slice(0, 3),
    energy: monthlyPattern?.weekday_averages?.[day] ?? 0,
  }));

  // Monthly chart (backend key is daily_data)
  const monthlyChartData: any[] = monthlyPattern?.daily_data ?? [];

  // Period comparison chart
  const compChartData =
    periodComparison && !periodComparison.error
      ? [
          {
            metric: "Energy (kWh)",
            Yesterday: +(periodComparison.period1?.energy_kwh ?? 0).toFixed(4),
            Today: +(periodComparison.period2?.energy_kwh ?? 0).toFixed(4),
          },
          {
            metric: "Avg Power (W)",
            Yesterday: +(periodComparison.period1?.avg_power ?? 0).toFixed(1),
            Today: +(periodComparison.period2?.avg_power ?? 0).toFixed(1),
          },
          {
            metric: "Peak Power (W)",
            Yesterday: +(periodComparison.period1?.max_power ?? 0).toFixed(1),
            Today: +(periodComparison.period2?.max_power ?? 0).toFixed(1),
          },
        ]
      : [];

  const unusualConsumption = anomalies?.unusual_consumption;
  const showAnomalyBanner =
    unusualConsumption &&
    !unusualConsumption.error &&
    unusualConsumption.is_anomalous;

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "hsl(var(--background))",
      borderColor: "hsl(var(--border))",
      borderRadius: "8px",
    },
    itemStyle: { color: "hsl(var(--foreground))" },
  };

  // ── Loading / Empty states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center space-y-4 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium">Loading your devices...</p>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-6">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-2">
            <Zap className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <h2 className="text-2xl font-semibold tracking-tight">
              No Devices Configured
            </h2>
            <p className="text-muted-foreground">
              Get started by adding your first energy monitoring device to track
              power consumption.
            </p>
          </div>
          <Button onClick={handleAddDevice} size="lg" className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add First Device
          </Button>
        </div>
        <DeviceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          device={editingDevice}
          onSuccess={handleDialogSuccess}
        />
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-8">
        {/* ─── Anomaly Alert Banner ─── */}
        {showAnomalyBanner && (
          <div
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
              unusualConsumption.severity === "high"
                ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            }`}
          >
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {unusualConsumption.severity === "high" ? "High" : "Elevated"}{" "}
                Power Consumption Detected
              </p>
              <p className="text-xs mt-0.5 opacity-80">
                {unusualConsumption.message}
              </p>
            </div>
          </div>
        )}

        {/* ─── Header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Energy Monitor
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time power consumption and analytics.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border text-sm font-medium">
              <span className="relative flex h-2.5 w-2.5">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? "bg-emerald-500" : "bg-destructive"}`}
                />
              </span>
              <span className="text-muted-foreground">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <Button onClick={handleAddDevice} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Device
            </Button>
          </div>
        </div>

        {/* ─── Device Selector ─── */}
        {devices.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {devices.map((device) => (
              <button
                key={device.id}
                onClick={() => setSelectedDevice(device)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  selectedDevice?.id === device.id
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {device.name}
              </button>
            ))}
          </div>
        )}

        {/* ─── 6 Stat Cards ─── */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {/* Power */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Power
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">
                {currentData ? formatNumber(currentData.power) : "---"}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  W
                </span>
              </div>
              <div className="mt-1 min-h-[1.25rem]">
                <DeltaBadge current={currentData?.power} previous={prevPower} />
                {!prevPower && (
                  <p className="text-xs text-muted-foreground">Live</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Voltage */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Voltage
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className={`text-xl font-bold ${voltageColor(currentData?.voltage, vLow, vHigh)}`}
              >
                {currentData ? formatNumber(currentData.voltage) : "---"}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  V
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {currentData?.voltage
                  ? currentData.voltage < vLow || currentData.voltage > vHigh
                    ? "⚠ Out of range"
                    : "Nominal"
                  : "No data"}
              </p>
            </CardContent>
          </Card>

          {/* Current */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Current
              </CardTitle>
              <Radio className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">
                {currentData ? formatNumber(currentData.current, 3) : "---"}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  A
                </span>
              </div>
              <div className="mt-1 min-h-[1.25rem]">
                <DeltaBadge
                  current={currentData?.current}
                  previous={prevCurrent}
                />
                {!prevCurrent && (
                  <p className="text-xs text-muted-foreground">Live</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Energy */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Energy
              </CardTitle>
              <button
                title="Reset energy counter on PZEM sensor"
                onClick={() =>
                  selectedDevice && handleResetEnergy(selectedDevice)
                }
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">
                {currentData ? formatNumber(currentData.energy, 3) : "---"}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  kWh
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {costProjection && !costProjection.error
                  ? `≈ ${formatCurrency(costProjection.daily)}/day`
                  : "Cumulative"}
              </p>
            </CardContent>
          </Card>

          {/* Power Factor */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Power Factor
              </CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className={`text-xl font-bold ${pfColor(liveData?.power_factor)}`}
              >
                {liveData?.power_factor != null
                  ? liveData.power_factor.toFixed(2)
                  : "---"}
              </div>
              <p className={`text-xs mt-1 ${pfColor(liveData?.power_factor)}`}>
                {pfLabel(liveData?.power_factor) || "No data"}
              </p>
            </CardContent>
          </Card>

          {/* Frequency */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Frequency
              </CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className={`text-xl font-bold ${
                  liveData?.frequency != null &&
                  (liveData.frequency < FREQ_LOW ||
                    liveData.frequency > FREQ_HIGH)
                    ? "text-orange-500"
                    : ""
                }`}
              >
                {liveData?.frequency != null
                  ? liveData.frequency.toFixed(1)
                  : "---"}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  Hz
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {liveData?.frequency != null
                  ? liveData.frequency < FREQ_LOW ||
                    liveData.frequency > FREQ_HIGH
                    ? "⚠ Unstable"
                    : "Stable"
                  : "No data"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ─── Real-time Charts ─── */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Power */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm font-medium">Live Power</CardTitle>
              <CardDescription className="text-xs">
                Watts — last 60 readings
                {deviceStats?.average_power
                  ? ` · avg ${deviceStats.average_power.toFixed(1)} W`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={powerHistory}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="time"
                      stroke="#888"
                      tick={{ fontSize: 9 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#888"
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10 }}
                      width={42}
                    />
                    <Tooltip {...tooltipStyle} />
                    {deviceStats?.average_power && (
                      <ReferenceLine
                        y={deviceStats.average_power}
                        stroke="#9ca3af"
                        strokeDasharray="4 2"
                        label={{
                          value: "avg",
                          position: "insideTopRight",
                          fontSize: 9,
                          fill: "#9ca3af",
                        }}
                      />
                    )}
                    {spikeTimestamps.map((t) => (
                      <ReferenceArea
                        key={t}
                        x1={t}
                        x2={t}
                        fill="#ef4444"
                        fillOpacity={0.18}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="power"
                      name="Power (W)"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Voltage */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm font-medium">
                Live Voltage
              </CardTitle>
              <CardDescription className="text-xs">
                Volts — {vNominal}V nominal
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={powerHistory}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="time"
                      stroke="#888"
                      tick={{ fontSize: 9 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#888"
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10 }}
                      width={42}
                    />
                    <Tooltip {...tooltipStyle} />
                    <ReferenceLine
                      y={vNominal}
                      stroke="#3b82f6"
                      strokeDasharray="4 2"
                      label={{
                        value: `${vNominal}V`,
                        position: "insideTopRight",
                        fontSize: 9,
                        fill: "#3b82f6",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="voltage"
                      name="Voltage (V)"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Current */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm font-medium">
                Live Current
              </CardTitle>
              <CardDescription className="text-xs">Amperes</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={powerHistory}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="time"
                      stroke="#888"
                      tick={{ fontSize: 9 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#888"
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10 }}
                      width={42}
                    />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="current"
                      name="Current (A)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Power Quality Row ─── */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4" /> Power Factor Quality
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current PF</span>
                <span
                  className={`font-semibold ${pfColor(liveData?.power_factor)}`}
                >
                  {liveData?.power_factor != null
                    ? liveData.power_factor.toFixed(2)
                    : "---"}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({pfLabel(liveData?.power_factor) || "–"})
                  </span>
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    liveData?.power_factor == null
                      ? "bg-muted-foreground/30"
                      : liveData.power_factor >= 0.9
                        ? "bg-green-500"
                        : liveData.power_factor >= 0.7
                          ? "bg-amber-500"
                          : "bg-red-500"
                  }`}
                  style={{ width: `${(liveData?.power_factor ?? 0) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Ideal: ≥ 0.90 · Fair: 0.70–0.89 · Poor: &lt; 0.70
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" /> Voltage Stability
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {(() => {
                const v = currentData?.voltage;
                const deviation =
                  v != null
                    ? Math.abs(((v - vNominal) / vNominal) * 100)
                    : null;
                const isGood = deviation !== null && deviation <= 5;
                return (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Deviation from {vNominal}V
                      </span>
                      <span
                        className={`font-semibold ${v != null && (v < vLow || v > vHigh) ? "text-orange-500" : "text-green-500"}`}
                      >
                        {deviation != null ? `${deviation.toFixed(2)}%` : "---"}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          (
                          {deviation != null
                            ? isGood
                              ? "Stable"
                              : "Check"
                            : "–"}
                          )
                        </span>
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isGood ? "bg-green-500" : "bg-orange-500"}`}
                        style={{
                          width: `${Math.min((deviation ?? 0) * 5, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Safe range: {vLow.toFixed(0)}V – {vHigh.toFixed(0)}V (±10%
                      of {vNominal}V nominal)
                    </p>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* ─── Analytics Tabs ─── */}
        <Card>
          <CardHeader className="border-b pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-4">
              <div>
                <CardTitle className="text-lg">Usage Analytics</CardTitle>
                <CardDescription>
                  Energy consumption breakdown by time period
                </CardDescription>
              </div>
              <div className="flex rounded-lg border overflow-hidden text-sm">
                {(["hourly", "weekday", "monthly"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveAnalyticsTab(tab)}
                    className={`px-4 py-1.5 font-medium transition-colors ${
                      activeAnalyticsTab === tab
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                {activeAnalyticsTab === "hourly" ? (
                  <BarChart data={hourlyChartData} barSize={18}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="hour"
                      stroke="#888"
                      tick={{ fontSize: 9 }}
                      interval={1}
                    />
                    <YAxis stroke="#888" tick={{ fontSize: 10 }} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: any) => [
                        `${Number(v).toFixed(1)} W`,
                        "Avg Power",
                      ]}
                    />
                    <Bar
                      dataKey="avg_power"
                      name="Avg Power (W)"
                      radius={[3, 3, 0, 0]}
                    >
                      {hourlyChartData.map((entry, idx) => {
                        const h = parseInt(entry.hour);
                        return (
                          <Cell
                            key={idx}
                            fill={peakHoursSet.has(h) ? "#4f46e5" : "#a5b4fc"}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                ) : activeAnalyticsTab === "weekday" ? (
                  <BarChart data={weekdayChartData} barSize={36}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      stroke="#888"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis stroke="#888" tick={{ fontSize: 10 }} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: any) => [
                        `${Number(v).toFixed(4)} kWh`,
                        "Avg Energy",
                      ]}
                    />
                    <Bar
                      dataKey="energy"
                      name="Avg Energy (kWh)"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                ) : (
                  <BarChart data={monthlyChartData} barSize={10}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#888"
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis stroke="#888" tick={{ fontSize: 10 }} />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(l) => new Date(l).toLocaleDateString()}
                      formatter={(v: any) => [
                        `${Number(v).toFixed(4)} kWh`,
                        "Energy",
                      ]}
                    />
                    <Bar
                      dataKey="energy_kwh"
                      name="Energy (kWh)"
                      fill="#6366f1"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {activeAnalyticsTab === "hourly" && hourlyPattern?.peak_hours && (
              <p className="text-xs text-muted-foreground mt-3">
                <span className="font-medium">Peak hours</span> (darker bars):{" "}
                {hourlyPattern.peak_hours
                  .map(
                    (p: any) =>
                      `${String(p.hour).padStart(2, "0")}:00 (${p.avg_power.toFixed(0)} W)`,
                  )
                  .join("  ·  ")}
              </p>
            )}
            {activeAnalyticsTab === "monthly" &&
              monthlyPattern?.highest_day && (
                <p className="text-xs text-muted-foreground mt-3">
                  <span className="font-medium">Highest:</span>{" "}
                  {monthlyPattern.highest_day.date} (
                  {monthlyPattern.highest_day.energy_kwh.toFixed(4)} kWh)
                  {" · "}
                  <span className="font-medium">Lowest:</span>{" "}
                  {monthlyPattern.lowest_day?.date} (
                  {monthlyPattern.lowest_day?.energy_kwh.toFixed(4)} kWh)
                </p>
              )}
          </CardContent>
        </Card>

        {/* ─── Insights Row ─── */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Cost Projections */}
          {costProjection && !costProjection.error ? (
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Cost Projections
                </CardTitle>
                <CardDescription className="text-xs">
                  Confidence:{" "}
                  <span className="font-semibold text-foreground capitalize">
                    {costProjection.confidence}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {[
                  { label: "Daily", value: costProjection.daily },
                  { label: "Weekly", value: costProjection.weekly },
                  { label: "Monthly", value: costProjection.monthly },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-1 border-b last:border-0"
                  >
                    <span className="text-sm text-muted-foreground">
                      {label}
                    </span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(value)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="flex items-center justify-center min-h-[160px]">
              <p className="text-xs text-muted-foreground">No cost data yet</p>
            </Card>
          )}

          {/* Anomaly Alerts */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Anomaly
                Alerts
              </CardTitle>
              <CardDescription className="text-xs">
                Power spikes detected in last 24 h
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              {!anomalies || anomalies.power_spikes?.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  ✓ No spikes detected — all clear.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {anomalies.power_spikes.map((spike: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 text-xs rounded-md border px-2.5 py-1.5"
                    >
                      <div>
                        <span className="font-medium">
                          {spike.power.toFixed(0)} W
                        </span>
                        <span className="text-muted-foreground ml-1.5">
                          {new Date(spike.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${
                          spike.severity === "high"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {spike.severity?.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appliance Detection */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-500" /> Appliance Detection
              </CardTitle>
              <CardDescription className="text-xs">
                Based on current power signature
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              {!appliances || appliances.likely_appliances?.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No appliances identified yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {appliances.likely_appliances.map((app: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 text-xs rounded-md border px-2.5 py-1.5"
                    >
                      <div>
                        <span className="font-medium">{app.appliance}</span>
                        <span className="text-muted-foreground ml-1.5">
                          {app.power_range}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${app.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground w-6 text-right">
                          {(app.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Period Comparison: Today vs Yesterday ─── */}
        {compChartData.length > 0 && (
          <Card>
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg">Today vs Yesterday</CardTitle>
                  <CardDescription>
                    Energy, average power, and peak power comparison
                  </CardDescription>
                </div>
                {periodComparison?.verdict && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      periodComparison.verdict === "increased"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    }`}
                  >
                    {periodComparison.verdict === "increased"
                      ? "↑ More than yesterday"
                      : "↓ Less than yesterday"}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={compChartData}
                    barCategoryGap="30%"
                    barGap={4}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="metric"
                      stroke="#888"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis stroke="#888" tick={{ fontSize: 10 }} />
                    <Tooltip {...tooltipStyle} />
                    <Bar
                      dataKey="Yesterday"
                      fill="#94a3b8"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar dataKey="Today" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {periodComparison?.changes && (
                <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
                  <span>
                    Energy:{" "}
                    <span
                      className={
                        periodComparison.changes.energy_pct > 0
                          ? "text-red-500 font-semibold"
                          : "text-green-500 font-semibold"
                      }
                    >
                      {periodComparison.changes.energy_pct > 0 ? "+" : ""}
                      {periodComparison.changes.energy_pct.toFixed(1)}%
                    </span>
                  </span>
                  <span>
                    Avg Power:{" "}
                    <span
                      className={
                        periodComparison.changes.avg_power_pct > 0
                          ? "text-red-500 font-semibold"
                          : "text-green-500 font-semibold"
                      }
                    >
                      {periodComparison.changes.avg_power_pct > 0 ? "+" : ""}
                      {periodComparison.changes.avg_power_pct.toFixed(1)}%
                    </span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── Device Information ─── */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-xl">Device Information</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedDevice && setRatesDialogOpen(true)}
                >
                  <Settings className="h-4 w-4 mr-1.5" /> Rates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedDevice && setOtaDialogOpen(true)}
                >
                  <Download className="h-4 w-4 mr-1.5" /> OTA Update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    selectedDevice && setLcdTemplateDialogOpen(true)
                  }
                >
                  <Monitor className="h-4 w-4 mr-1.5" /> LCD Templates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    selectedDevice && handleResetEnergy(selectedDevice)
                  }
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Reset Energy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    selectedDevice && handleEditDevice(selectedDevice)
                  }
                >
                  <Edit className="h-4 w-4 mr-1.5" /> Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    selectedDevice && handleDeleteDevice(selectedDevice)
                  }
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {[
                { label: "Name", value: selectedDevice?.name, mono: false },
                {
                  label: "MAC Address",
                  value: selectedDevice?.mac_address || "N/A",
                  mono: true,
                },
                {
                  label: "Firmware",
                  value: selectedDevice?.firmware_version || "Unknown",
                  mono: false,
                },
              ].map(({ label, value, mono }) => (
                <div
                  key={label}
                  className="flex flex-col space-y-1 p-3 rounded-lg border bg-card"
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    {label}
                  </span>
                  <span
                    className={`text-base font-semibold ${mono ? "font-mono" : ""}`}
                  >
                    {value}
                  </span>
                </div>
              ))}
              <div className="flex flex-col space-y-1 p-3 rounded-lg border bg-card">
                <span className="text-sm font-medium text-muted-foreground">
                  Status
                </span>
                <span
                  className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    selectedDevice?.status === "online"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : selectedDevice?.status === "offline"
                        ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {selectedDevice?.status?.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col space-y-1 p-3 rounded-lg border bg-card sm:col-span-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Last Seen
                </span>
                <span className="text-base">
                  {selectedDevice?.last_seen
                    ? formatRelativeTime(selectedDevice.last_seen)
                    : "Never"}
                </span>
              </div>
            </div>

            {/* 24-hour stats summary */}
            {deviceStats && (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 mt-4 pt-4 border-t">
                {[
                  {
                    label: "Avg Power (24h)",
                    value: `${(deviceStats.average_power ?? 0).toFixed(1)} W`,
                  },
                  {
                    label: "Peak Power (24h)",
                    value: `${(deviceStats.peak_power ?? 0).toFixed(1)} W`,
                  },
                  {
                    label: "Avg Voltage (24h)",
                    value: `${(deviceStats.average_voltage ?? 0).toFixed(1)} V`,
                  },
                  {
                    label: "Total Readings",
                    value: (deviceStats.total_readings ?? 0).toString(),
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex flex-col space-y-0.5 p-3 rounded-lg bg-muted/40"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      {label}
                    </span>
                    <span className="text-sm font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <DeviceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          device={editingDevice}
          onSuccess={handleDialogSuccess}
        />
        <ManageRatesDialog
          open={ratesDialogOpen}
          onOpenChange={setRatesDialogOpen}
          device={selectedDevice}
        />
        <OTAUpdatesDialog
          open={otaDialogOpen}
          onOpenChange={setOtaDialogOpen}
          device={selectedDevice}
        />
        <LCDTemplateDialog
          open={lcdTemplateDialogOpen}
          onOpenChange={setLcdTemplateDialogOpen}
          device={selectedDevice}
          onSuccess={(updated) => {
            setDevices((prev) =>
              prev.map((d) => (d.id === updated.id ? updated : d)),
            );
            setSelectedDevice(updated);
          }}
        />
      </div>
    </div>
  );
}
