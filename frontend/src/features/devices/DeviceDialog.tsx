import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../shared/ui/dialog";
import { Input } from "../../shared/ui/input";
import { Label } from "../../shared/ui/label";
import { Button } from "../../shared/ui/button";
import { api } from "../../shared/api/client";
import type { Device } from "../../shared/types";

interface DeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: Device | null;
  onSuccess: () => void;
}

export function DeviceDialog({
  open,
  onOpenChange,
  device,
  onSuccess,
}: DeviceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [setupStep, setSetupStep] = useState(false);
  const [generatedDevice, setGeneratedDevice] = useState<Device | null>(null);
  const [refreshOnClose, setRefreshOnClose] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [formData, setFormData] = useState({
    name: "",
    firmware_version: "",
    nominal_voltage: 230,
  });

  useEffect(() => {
    if (device) {
      setFormData({
        name: device.name || "",
        firmware_version: device.firmware_version || "",
        nominal_voltage: device.nominal_voltage ?? 230,
      });
    } else {
      setFormData({
        name: "",
        firmware_version: "",
        nominal_voltage: 230,
      });
    }
  }, [device, open]);

  useEffect(() => {
    if (!open) {
      setSetupStep(false);
      setGeneratedDevice(null);
      setRefreshOnClose(false);
      setShowToken(false);
      setCopyStatus("idle");
    }
  }, [open]);

  const currentToken = generatedDevice?.token || device?.token || "";

  const handleCopyToken = async () => {
    if (!currentToken) return;
    try {
      await navigator.clipboard.writeText(currentToken);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("failed");
      setTimeout(() => setCopyStatus("idle"), 1800);
    }
  };

  const handleOpenChange = async (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen && refreshOnClose) {
      setRefreshOnClose(false);
      await onSuccess();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (device) {
        await api.updateDevice(device.id, formData);
        onSuccess();
        onOpenChange(false);
      } else {
        const response = (await api.createDevice({
          name: formData.name,

          firmware_version: formData.firmware_version,
        })) as Device;
        setGeneratedDevice(response);
        setSetupStep(true);
        setRefreshOnClose(true);
      }
    } catch (error) {
      console.error("Failed to save device:", error);
      alert(
        "Failed to save device. Please check that MAC address is unique and fields are valid.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        {!setupStep ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {device ? "Edit Device" : "Add New Device"}
              </DialogTitle>
              <DialogDescription>
                {device
                  ? "Update device configuration and details."
                  : "Register a new energy monitoring device."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Device Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Living Room Monitor"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="firmware_version">Firmware Version</Label>
                <Input
                  id="firmware_version"
                  placeholder="e.g., 1.0.0"
                  value={formData.firmware_version}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      firmware_version: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="nominal_voltage">Nominal Voltage (V)</Label>
                <Input
                  id="nominal_voltage"
                  type="number"
                  min={100}
                  max={480}
                  step={1}
                  placeholder="e.g., 230"
                  value={formData.nominal_voltage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nominal_voltage: parseFloat(e.target.value) || 230,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Standard: 230V (Philippines/EU) · 120V (US) · 220V (older PH)
                </p>
              </div>

              {device && (
                <div className="grid gap-2 rounded-md border bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="m-0">Device Token</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowToken((prev) => !prev)}
                      >
                        {showToken ? "Hide" : "Show"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyToken}
                        disabled={!currentToken}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="rounded border bg-background px-3 py-2 font-mono text-xs break-all">
                    {showToken
                      ? currentToken
                      : currentToken
                        ? "••••••••••••••••••••••••••••••••"
                        : "Token unavailable"}
                  </div>
                  {copyStatus === "copied" && (
                    <p className="text-xs text-green-600">Token copied.</p>
                  )}
                  {copyStatus === "failed" && (
                    <p className="text-xs text-destructive">
                      Failed to copy token.
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : device ? "Update" : "Add Device"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4 py-4">
            <DialogHeader>
              <DialogTitle>Device Setup Instructions</DialogTitle>
              <DialogDescription>
                Your device has been registered successfully. Follow these steps
                to configure your hardware.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm font-medium mb-2">Device Token</p>
              <div className="rounded border bg-black/10 px-3 py-2 font-mono text-xs break-all text-foreground mb-3">
                {currentToken || "ERROR_NO_TOKEN"}
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyToken}
                  disabled={!currentToken}
                >
                  Copy Token
                </Button>
                {copyStatus === "copied" && (
                  <span className="text-xs text-green-600">Copied.</span>
                )}
                {copyStatus === "failed" && (
                  <span className="text-xs text-destructive">Copy failed.</span>
                )}
              </div>
              <p className="text-sm font-medium mb-2">
                1. Open{" "}
                <code className="text-xs bg-black/10 px-1 py-0.5 rounded">
                  firmware/include/config.h
                </code>{" "}
                and update these values:
              </p>
              <pre className="text-xs bg-black/10 p-3 rounded-md overflow-x-auto text-foreground">
                {`#define WIFI_SSID "Your_Network"
#define WIFI_PASSWORD "Your_Password"

#define WS_SERVER "${window.location.hostname}"
#define WS_PORT 8000
#define WS_PATH "/ws/device/"

#define DEVICE_TOKEN "${generatedDevice?.token || "ERROR_NO_TOKEN"}"`}
              </pre>
            </div>
            <p className="text-sm text-muted-foreground">
              2. Save the file, compile, and upload the firmware to your
              ESP8266. The device should connect automatically.
            </p>
            <DialogFooter className="mt-4">
              <Button
                onClick={async () => {
                  setSetupStep(false);
                  await handleOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
