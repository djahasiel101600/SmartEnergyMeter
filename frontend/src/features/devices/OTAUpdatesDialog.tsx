import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../shared/ui/dialog";
import { Button } from "../../shared/ui/button";
import { Label } from "../../shared/ui/label";
import { Input } from "../../shared/ui/input";
import { api } from "../../shared/api/client";
import type { Device, FirmwareVersion, OTAUpdate } from "../../shared/types";
import { Upload, XCircle } from "lucide-react";

interface OTAUpdatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: Device | null;
}

export function OTAUpdatesDialog({
  open,
  onOpenChange,
  device,
}: OTAUpdatesDialogProps) {
  const [firmwares, setFirmwares] = useState<FirmwareVersion[]>([]);
  const [updates, setUpdates] = useState<OTAUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFirmwareId, setSelectedFirmwareId] = useState<string>("");

  useEffect(() => {
    if (open && device) {
      loadData();

      // Setup periodic polling for update status if there's a pending/running update
      const interval = setInterval(() => {
        api.getOTAUpdates(device.id).then((data) => {
          setUpdates(data);
        });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [open, device]);

  const loadData = async () => {
    if (!device) return;
    try {
      const fwData = await api.getFirmwareVersions();
      setFirmwares(fwData);
      const updatesData = await api.getOTAUpdates(device.id);
      setUpdates(updatesData);
    } catch (error) {
      console.error("Failed to load OTA data:", error);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const version = prompt("Enter firmware version (e.g. 1.0.1)");
    if (!version) return;

    const description = prompt("Enter description/changelog");
    if (!description) return;

    const formData = new FormData();
    formData.append("firmware_file", file);
    formData.append("version", version);
    formData.append("description", description);
    formData.append("is_stable", "true");
    formData.append("file_size", file.size.toString());

    // Generate a simple SHA-256 checksum using Web Crypto API
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    formData.append("checksum", hashHex);

    setLoading(true);
    try {
      await api.uploadFirmware(formData);
      await loadData();
    } catch (error) {
      console.error("Failed to upload firmware", error);
      alert("Failed to upload firmware.");
    } finally {
      setLoading(false);
    }
  };

  const triggerUpdate = async () => {
    if (!device || !selectedFirmwareId) return;
    setLoading(true);
    try {
      await api.createOTAUpdate(device.id, selectedFirmwareId);
      await loadData();
    } catch (error) {
      console.error("Failed to trigger update:", error);
      alert("Failed to trigger OTA update.");
    } finally {
      setLoading(false);
    }
  };

  const cancelUpdate = async (id: string) => {
    try {
      await api.cancelOTAUpdate(id);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const activeUpdate = updates.find((u) =>
    ["pending", "downloading", "installing"].includes(u.status),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>OTA Updates</DialogTitle>
          <DialogDescription>
            Manage firmware updates for {device?.name}. Current version:{" "}
            {device?.firmware_version || "Unknown"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Upload New Firmware Binary</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".bin"
                onChange={handleUpload}
                disabled={loading || !!activeUpdate}
              />
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label>Available Firmware Versions</Label>
            {firmwares.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No firmware available.
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedFirmwareId}
                  onChange={(e) => setSelectedFirmwareId(e.target.value)}
                  disabled={!!activeUpdate}
                >
                  <option value="">Select version...</option>
                  {firmwares.map((fw) => (
                    <option key={fw.id} value={fw.id}>
                      v{fw.version} ({fw.file_size_display})
                    </option>
                  ))}
                </select>
                <Button
                  onClick={triggerUpdate}
                  disabled={loading || !selectedFirmwareId || !!activeUpdate}
                >
                  <Upload className="h-4 w-4 mr-2" /> Update
                </Button>
              </div>
            )}
          </div>

          {activeUpdate && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="text-sm font-semibold flex items-center justify-between">
                Update in progress
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelUpdate(activeUpdate.id)}
                  className="h-6 text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </h4>
              <p className="text-sm mt-2 font-mono">
                Status: {activeUpdate.status_display}
              </p>
              <div className="w-full bg-secondary h-2 mt-2 rounded overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${activeUpdate.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {activeUpdate.progress}%
              </p>
            </div>
          )}

          {updates.filter((u) =>
            ["completed", "failed", "cancelled"].includes(u.status),
          ).length > 0 && (
            <div className="space-y-2 pt-4 border-t max-h-32 overflow-y-auto">
              <Label>Update History</Label>
              {updates
                .filter((u) =>
                  ["completed", "failed", "cancelled"].includes(u.status),
                )
                .map((u) => (
                  <div
                    key={u.id}
                    className="text-sm p-2 border rounded-md mb-1 bg-muted/30 flex justify-between"
                  >
                    <span>v{u.firmware_version_number}</span>
                    <span
                      className={
                        u.status === "completed"
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {u.status_display}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
