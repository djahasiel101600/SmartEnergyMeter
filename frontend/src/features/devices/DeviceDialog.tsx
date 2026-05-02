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
        onSuccess(); // Refresh dashboard list in background
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                onClick={() => {
                  setSetupStep(false);
                  onOpenChange(false);
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
