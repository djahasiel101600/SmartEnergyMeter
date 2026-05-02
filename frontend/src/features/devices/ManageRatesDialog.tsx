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
import type { Device, RateConfiguration } from "../../shared/types";
import { Trash2, CheckCircle } from "lucide-react";

interface ManageRatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: Device | null;
}

export function ManageRatesDialog({
  open,
  onOpenChange,
  device,
}: ManageRatesDialogProps) {
  const [rates, setRates] = useState<RateConfiguration[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    rate_per_kwh: "",
  });

  useEffect(() => {
    if (open && device) {
      loadRates();
    }
  }, [open, device]);

  const loadRates = async () => {
    if (!device) return;
    try {
      const data = await api.getRates(device.id);
      setRates(data);
    } catch (error) {
      console.error("Failed to load rates:", error);
    }
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;

    setLoading(true);
    try {
      await api.createRate({
        device: device.id,
        name: formData.name,
        rate_per_kwh: parseFloat(formData.rate_per_kwh),
        is_active: true,
      });
      setFormData({ name: "", rate_per_kwh: "" });
      await loadRates();
    } catch (error) {
      console.error("Failed to add rate:", error);
      alert("Failed to add rate configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rateId: string) => {
    try {
      await api.deleteRate(rateId);
      await loadRates();
    } catch (error) {
      console.error("Failed to delete rate", error);
    }
  };

  const handleSetDefault = async (rateId: string) => {
    try {
      await api.setDefaultRate(rateId);
      await loadRates();
    } catch (error) {
      console.error("Failed to set default rate", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Energy Rates</DialogTitle>
          <DialogDescription>
            Configure cost per kWh for {device?.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <form onSubmit={handleAddRate} className="flex gap-2 items-end mb-4">
            <div className="grid gap-2 flex-1">
              <Label htmlFor="rateName">Rate Name</Label>
              <Input
                id="rateName"
                placeholder="e.g. Standard"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="grid gap-2 w-24">
              <Label htmlFor="rateAmount">PHP/kWh</Label>
              <Input
                id="rateAmount"
                type="number"
                step="0.01"
                placeholder="12.50"
                value={formData.rate_per_kwh}
                onChange={(e) =>
                  setFormData({ ...formData, rate_per_kwh: e.target.value })
                }
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              Add
            </Button>
          </form>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Existing Rates</h4>
            {rates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rates configured yet.
              </p>
            ) : (
              rates.map((rate) => (
                <div
                  key={rate.id}
                  className="flex items-center justify-between p-2 rounded-md border text-sm"
                >
                  <div>
                    <span className="font-medium mr-2">{rate.name}</span>
                    <span className="text-muted-foreground">
                      ₱{rate.rate_per_kwh}/kWh
                    </span>
                    {rate.is_default && (
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!rate.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600"
                        onClick={() => handleSetDefault(rate.id)}
                        title="Set Default"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(rate.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
