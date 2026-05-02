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
import { Input } from "../../shared/ui/input";
import { Label } from "../../shared/ui/label";
import { api } from "../../shared/api/client";
import type { Device } from "../../shared/types";
import { Plus, Trash2, Monitor, Info } from "lucide-react";

// ── Variable tokens the user can insert ──────────────────────────────────────
const TOKENS = [
  { label: "{v}", title: "Voltage (V)", example: "220.5" },
  { label: "{i}", title: "Current (A)", example: "1.23" },
  { label: "{p}", title: "Power (W)", example: "272" },
  { label: "{e}", title: "Energy (kWh)", example: "1.45" },
  { label: "{f}", title: "Frequency (Hz)", example: "60.0" },
  { label: "{pf}", title: "Power Factor", example: "0.99" },
  { label: "{cost}", title: "Cost (PHP)", example: "17.40" },
  { label: "{status}", title: "Online / Offline", example: "Online" },
];

// ── Default templates shown when device has none ─────────────────────────────
const DEFAULT_TEMPLATES: Template[] = [
  { line1: "{v}V  {i}A", line2: "Power: {p}W" },
  { line1: "E: {e}kWh", line2: "PHP {cost}" },
  { line1: "PF:{pf} {f}Hz", line2: "{status}" },
];

// ── LCD preview renderer ──────────────────────────────────────────────────────
const PREVIEW_VALUES: Record<string, string> = {
  "{v}": "220.5",
  "{i}": "1.230",
  "{p}": "271.5",
  "{e}": "1.452",
  "{f}": "60.0",
  "{pf}": "0.99",
  "{cost}": "17.40",
  "{status}": "Online",
};

function renderPreview(text: string): string {
  let out = text;
  for (const [token, val] of Object.entries(PREVIEW_VALUES)) {
    out = out.replaceAll(token, val);
  }
  // Pad/truncate to exactly 16 chars for authentic LCD feel
  return out.substring(0, 16).padEnd(16, " ");
}

interface Template {
  line1: string;
  line2: string;
}

interface LCDTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: Device | null;
  onSuccess: (updated: Device) => void;
}

export function LCDTemplateDialog({
  open,
  onOpenChange,
  device,
  onSuccess,
}: LCDTemplateDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewIdx, setPreviewIdx] = useState(0);

  // Sync from device when dialog opens
  useEffect(() => {
    if (open && device) {
      const t =
        device.lcd_templates && device.lcd_templates.length > 0
          ? device.lcd_templates
          : DEFAULT_TEMPLATES;
      setTemplates(JSON.parse(JSON.stringify(t))); // deep clone
      setError("");
      setPreviewIdx(0);
    }
  }, [open, device]);

  // Cycle preview automatically
  useEffect(() => {
    if (!open || templates.length === 0) return;
    const id = setInterval(() => {
      setPreviewIdx((i) => (i + 1) % templates.length);
    }, 2500);
    return () => clearInterval(id);
  }, [open, templates.length]);

  const addTemplate = () => {
    if (templates.length >= 8) return; // sensible hard cap
    setTemplates((prev) => [...prev, { line1: "", line2: "" }]);
  };

  const removeTemplate = (idx: number) => {
    setTemplates((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateField = (
    idx: number,
    field: "line1" | "line2",
    value: string,
  ) => {
    setTemplates((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
    );
  };

  const insertToken = (
    idx: number,
    field: "line1" | "line2",
    token: string,
  ) => {
    const inputId = `lcd-${idx}-${field}`;
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    const pos = el?.selectionStart ?? templates[idx][field].length;
    const current = templates[idx][field];
    updateField(idx, field, current.slice(0, pos) + token + current.slice(pos));
    // Restore focus & caret after React re-renders
    requestAnimationFrame(() => {
      el?.focus();
      const newPos = pos + token.length;
      el?.setSelectionRange(newPos, newPos);
    });
  };

  const handleSave = async () => {
    if (!device) return;
    const invalid = templates.find(
      (t) => t.line1.trim() === "" && t.line2.trim() === "",
    );
    if (invalid) {
      setError("Each template must have at least one non-empty line.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const updated = await api.pushLcdTemplates(device.id, templates);
      onSuccess(updated);
      onOpenChange(false);
    } catch {
      setError("Failed to save templates. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const current = templates[previewIdx] ?? { line1: "", line2: "" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            LCD Template Editor
          </DialogTitle>
          <DialogDescription>
            Design what appears on the physical 16×2 LCD screen. Use tokens like{" "}
            <code className="bg-muted px-1 rounded text-xs">{"{v}"}</code> for
            live sensor values. Screens rotate automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── LCD Simulator ── */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Live Preview — Screen {previewIdx + 1} / {templates.length || 1}
            </p>
            <div
              className="font-mono text-sm bg-[#3a4a1e] text-[#c8e6a0] rounded-md p-3 w-[280px] shadow-inner border border-[#5a7a2e] select-none"
              style={{
                fontFamily: "'Courier New', monospace",
                letterSpacing: "0.08em",
              }}
            >
              <div className="flex gap-[1px] mb-1">
                {renderPreview(current.line1)
                  .split("")
                  .map((ch, i) => (
                    <span key={i} className="inline-block w-[14px] text-center">
                      {ch}
                    </span>
                  ))}
              </div>
              <div className="flex gap-[1px]">
                {renderPreview(current.line2)
                  .split("")
                  .map((ch, i) => (
                    <span key={i} className="inline-block w-[14px] text-center">
                      {ch}
                    </span>
                  ))}
              </div>
            </div>
            <div className="flex gap-1">
              {templates.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === previewIdx ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* ── Token Reference ── */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" /> Available tokens
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TOKENS.map((t) => (
                <span
                  key={t.label}
                  title={`${t.title} · e.g. ${t.example}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border text-xs font-mono cursor-default"
                >
                  {t.label}
                  <span className="text-muted-foreground text-[10px] font-sans">
                    {t.title}
                  </span>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Each line is limited to 16 characters on the physical display.
              Click a token button in each template row to insert it at the
              cursor.
            </p>
          </div>

          {/* ── Template Rows ── */}
          <div className="space-y-4">
            {templates.map((tmpl, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    Screen {idx + 1}
                  </span>
                  <button
                    onClick={() => removeTemplate(idx)}
                    disabled={templates.length <= 1}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {(["line1", "line2"] as const).map((field, lineIdx) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Row {lineIdx + 1}
                    </Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id={`lcd-${idx}-${field}`}
                        value={tmpl[field]}
                        onChange={(e) =>
                          updateField(idx, field, e.target.value)
                        }
                        maxLength={32}
                        placeholder={`e.g. ${lineIdx === 0 ? "{v}V  {i}A" : "Power: {p}W"}`}
                        className={`font-mono text-sm flex-1 ${
                          tmpl[field].length > 16
                            ? "border-amber-500 focus-visible:ring-amber-500"
                            : ""
                        }`}
                      />
                      <span
                        className={`text-xs w-8 text-right shrink-0 ${
                          tmpl[field].length > 16
                            ? "text-amber-500 font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {tmpl[field].length}/16
                      </span>
                    </div>
                    {/* Quick-insert token buttons */}
                    <div className="flex flex-wrap gap-1">
                      {TOKENS.map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => insertToken(idx, field, t.label)}
                          title={t.title}
                          className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-xs font-mono transition-colors"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* ── Add Screen Button ── */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addTemplate}
            disabled={templates.length >= 8}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Screen {templates.length >= 8 ? "(max 8)" : ""}
          </Button>

          {error && (
            <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !device}>
            {loading ? "Saving…" : "Save & Push to Device"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
