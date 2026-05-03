/**
 * hardware_check.ts — Nexus-402 Analyst Agent Hardware Detection
 *
 * WHY: The Analyst Agent targets a Raspberry Pi 5 + Hailo-8 NPU deployment.
 * This utility detects the Hailo-8 device, reads thermal state, and determines
 * the optimal inference backend (NPU → CPU fallback) before the agent starts.
 *
 * Run: npx ts-node agents/hardware_check.ts
 *
 * Outputs a HardwareReport that the Analyst Agent reads at startup to configure
 * its inference pipeline. Safe to run on any OS — returns graceful fallback on
 * non-Pi environments (x86, macOS, Windows via WSL).
 */

import * as fs from "fs";
import * as os from "os";
import { execSync, spawnSync } from "child_process";

// ─── Types ───────────────────────────────────────────────────────────────────

export type InferenceBackend = "hailo8_npu" | "onnx_cpu" | "onnx_gpu" | "mock";

export type HardwareReport = {
  timestamp: number;
  platform: NodeJS.Platform;
  arch: string;
  hostname: string;
  isRaspberryPi: boolean;
  isPi5: boolean;
  hailo8: Hailo8Status;
  cpu: CpuStatus;
  memory: MemoryStatus;
  recommendedBackend: InferenceBackend;
  warnings: string[];
  errors: string[];
};

export type Hailo8Status = {
  available: boolean;
  devicePath: string | null;       // e.g. /dev/hailo0
  deviceCount: number;
  driverVersion: string | null;    // from hailortcli fw-control --identify
  firmwareVersion: string | null;
  tops: number | null;             // Tera Operations Per Second (Hailo-8 = 26 TOPS)
  thermalState: "normal" | "warm" | "hot" | "critical" | "unknown";
  npuTemperatureCelsius: number | null;
};

export type CpuStatus = {
  model: string;
  cores: number;
  threads: number;
  temperatureCelsius: number | null;
  thermalState: "normal" | "warm" | "hot" | "critical" | "unknown";
  frequencyMhz: number | null;
  loadPercent: number | null;
};

export type MemoryStatus = {
  totalMb: number;
  freeMb: number;
  usedMb: number;
  usagePercent: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const HAILO8_DEVICE_PATHS = ["/dev/hailo0", "/dev/hailo1", "/dev/hailo2"];
const THERMAL_BASE_PATH = "/sys/class/thermal";
const CPU_THERMAL_ZONE = `${THERMAL_BASE_PATH}/thermal_zone0/temp`;
const CPU_FREQ_PATH = "/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq";
const RASPBERRY_PI_MODEL_PATH = "/proc/device-tree/model";

// Temperature thresholds in Celsius
const TEMP_WARN_C = 70;
const TEMP_HOT_C = 80;
const TEMP_CRITICAL_C = 85;

// ─── Raspberry Pi Detection ────────────────────────────────────────────────

function detectRaspberryPi(): { isRpi: boolean; isPi5: boolean; model: string | null } {
  if (os.platform() !== "linux") {
    return { isRpi: false, isPi5: false, model: null };
  }

  try {
    if (!fs.existsSync(RASPBERRY_PI_MODEL_PATH)) {
      return { isRpi: false, isPi5: false, model: null };
    }
    const model = fs.readFileSync(RASPBERRY_PI_MODEL_PATH, "utf8").replace(/\0/g, "").trim();
    const isRpi = model.toLowerCase().includes("raspberry pi");
    const isPi5 = isRpi && model.toLowerCase().includes("raspberry pi 5");
    return { isRpi, isPi5, model };
  } catch {
    return { isRpi: false, isPi5: false, model: null };
  }
}

// ─── Hailo-8 Detection ────────────────────────────────────────────────────

function detectHailo8(): Hailo8Status {
  const warnings: string[] = [];

  // Check for Hailo device files
  const foundDevices = HAILO8_DEVICE_PATHS.filter((p) => fs.existsSync(p));
  const deviceCount = foundDevices.length;
  const primaryDevice = foundDevices[0] ?? null;

  if (deviceCount === 0) {
    return {
      available: false,
      devicePath: null,
      deviceCount: 0,
      driverVersion: null,
      firmwareVersion: null,
      tops: null,
      thermalState: "unknown",
      npuTemperatureCelsius: null,
    };
  }

  // Try to read firmware/driver version via hailortcli
  let driverVersion: string | null = null;
  let firmwareVersion: string | null = null;
  let npuTemperatureCelsius: number | null = null;

  try {
    const result = spawnSync("hailortcli", ["fw-control", "identify"], {
      timeout: 5000,
      encoding: "utf8",
    });
    if (result.status === 0 && result.stdout) {
      const out = result.stdout;
      const fwMatch = out.match(/Firmware version:\s*([\d.]+)/i);
      const drvMatch = out.match(/Driver version:\s*([\d.]+)/i);
      firmwareVersion = fwMatch?.[1] ?? null;
      driverVersion = drvMatch?.[1] ?? null;
    }
  } catch {
    warnings.push("hailortcli not found — cannot read NPU firmware version");
  }

  // Try to read NPU temperature from Hailo sysfs
  try {
    const hailoThermalPaths = [
      "/sys/class/hailo_chardev/hailo0/thermal_zone_temp",
      "/sys/bus/pci/drivers/hailo/*/thermal_zone",
    ];
    for (const tPath of hailoThermalPaths) {
      if (fs.existsSync(tPath)) {
        const raw = fs.readFileSync(tPath, "utf8").trim();
        const milliC = parseInt(raw, 10);
        if (!isNaN(milliC)) {
          npuTemperatureCelsius = milliC > 1000 ? milliC / 1000 : milliC;
          break;
        }
      }
    }
  } catch {
    // Temperature sysfs not available — not critical
  }

  const thermalState = classifyThermalState(npuTemperatureCelsius);

  return {
    available: true,
    devicePath: primaryDevice,
    deviceCount,
    driverVersion,
    firmwareVersion,
    tops: 26,               // Hailo-8 rated performance
    thermalState,
    npuTemperatureCelsius,
  };
}

// ─── CPU Status ───────────────────────────────────────────────────────────

function getCpuStatus(): CpuStatus {
  const cpus = os.cpus();
  const model = cpus[0]?.model ?? "Unknown";
  const cores = cpus.length;

  // Linux: physical cores from /proc/cpuinfo
  let physicalCores = cores;
  try {
    if (fs.existsSync("/proc/cpuinfo")) {
      const cpuinfo = fs.readFileSync("/proc/cpuinfo", "utf8");
      const matches = cpuinfo.match(/^physical id\s*:\s*(\d+)/gm) ?? [];
      const uniquePhysical = new Set(matches.map((m) => m.split(":")[1]?.trim()));
      if (uniquePhysical.size > 0) physicalCores = uniquePhysical.size * 4; // approximate
    }
  } catch { /* non-Linux */ }

  // CPU temperature from sysfs
  let temperatureCelsius: number | null = null;
  try {
    if (fs.existsSync(CPU_THERMAL_ZONE)) {
      const raw = fs.readFileSync(CPU_THERMAL_ZONE, "utf8").trim();
      const milliC = parseInt(raw, 10);
      if (!isNaN(milliC)) {
        temperatureCelsius = milliC / 1000;
      }
    }
  } catch { /* not available */ }

  // CPU frequency
  let frequencyMhz: number | null = null;
  try {
    if (fs.existsSync(CPU_FREQ_PATH)) {
      const raw = fs.readFileSync(CPU_FREQ_PATH, "utf8").trim();
      const khz = parseInt(raw, 10);
      if (!isNaN(khz)) frequencyMhz = Math.round(khz / 1000);
    }
  } catch { /* not available */ }

  // CPU load (1-minute average from /proc/loadavg on Linux)
  let loadPercent: number | null = null;
  try {
    const load = os.loadavg()[0]; // 1-minute load average
    loadPercent = Math.round((load / cores) * 100);
  } catch { /* not available */ }

  const thermalState = classifyThermalState(temperatureCelsius);

  return {
    model,
    cores,
    threads: cores,
    temperatureCelsius,
    thermalState,
    frequencyMhz,
    loadPercent,
  };
}

// ─── Memory Status ────────────────────────────────────────────────────────

function getMemoryStatus(): MemoryStatus {
  const totalMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMb = Math.round(os.freemem() / 1024 / 1024);
  const usedMb = totalMb - freeMb;
  const usagePercent = Math.round((usedMb / totalMb) * 100);
  return { totalMb, freeMb, usedMb, usagePercent };
}

// ─── Thermal State Classification ────────────────────────────────────────

function classifyThermalState(
  tempC: number | null
): "normal" | "warm" | "hot" | "critical" | "unknown" {
  if (tempC === null) return "unknown";
  if (tempC >= TEMP_CRITICAL_C) return "critical";
  if (tempC >= TEMP_HOT_C) return "hot";
  if (tempC >= TEMP_WARN_C) return "warm";
  return "normal";
}

// ─── Backend Recommendation ───────────────────────────────────────────────

function recommendBackend(
  hailo8: Hailo8Status,
  cpu: CpuStatus,
  warnings: string[],
  errors: string[]
): InferenceBackend {
  if (hailo8.available) {
    if (hailo8.thermalState === "critical") {
      warnings.push(
        `Hailo-8 NPU is in CRITICAL thermal state (${hailo8.npuTemperatureCelsius}°C). ` +
        `Falling back to CPU. Add a heatsink or reduce ambient temperature.`
      );
      return "onnx_cpu";
    }
    if (hailo8.thermalState === "hot") {
      warnings.push(
        `Hailo-8 NPU is HOT (${hailo8.npuTemperatureCelsius}°C). ` +
        `NPU will be used but inference time may increase by 50%.`
      );
    }
    return "hailo8_npu";
  }

  // No NPU — check if we're in a test/dev environment
  if (os.platform() !== "linux") {
    warnings.push(
      "Non-Linux platform detected. Using mock backend for development. " +
      "Deploy to Raspberry Pi 5 + Hailo-8 for production inference."
    );
    return "mock";
  }

  // Linux without NPU — use ONNX CPU
  if ((cpu.loadPercent ?? 0) > 90) {
    warnings.push(
      `CPU load is ${cpu.loadPercent}%. Inference may be slow. ` +
      `Consider reducing other processes or deploying the Hailo-8 NPU.`
    );
  }

  return "onnx_cpu";
}

// ─── Main: Full Hardware Report ────────────────────────────────────────────

export async function runHardwareCheck(): Promise<HardwareReport> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const piInfo = detectRaspberryPi();
  const hailo8 = detectHailo8();
  const cpu = getCpuStatus();
  const memory = getMemoryStatus();

  // Warn if not on Pi 5 but user expects NPU support
  if (hailo8.available && !piInfo.isPi5) {
    warnings.push(
      "Hailo-8 NPU detected on a non-Pi 5 host. This is supported but untested. " +
      "Ensure the HailoRT driver version matches the NPU firmware."
    );
  }

  // Warn if Pi 5 but no Hailo-8
  if (piInfo.isPi5 && !hailo8.available) {
    warnings.push(
      "Raspberry Pi 5 detected but no Hailo-8 NPU found at /dev/hailo0. " +
      "Check M.2 HAT installation: `lspci | grep Hailo` and `ls /dev/hailo*`."
    );
  }

  // Memory check for FinBERT (base model ~440MB, quantized ~110MB)
  if (memory.freeMb < 512) {
    warnings.push(
      `Low free memory: ${memory.freeMb}MB. FinBERT requires ~512MB free. ` +
      `Consider closing other processes. NPU inference is less memory-intensive.`
    );
  }

  // CPU thermal check
  if (cpu.thermalState === "critical") {
    errors.push(
      `CPU is in CRITICAL thermal state (${cpu.temperatureCelsius}°C). ` +
      `Agent startup aborted. Cool the system and retry.`
    );
  } else if (cpu.thermalState === "hot") {
    warnings.push(
      `CPU temperature is ${cpu.temperatureCelsius}°C. ` +
      `Performance may be degraded. Monitor during inference.`
    );
  }

  const recommendedBackend = recommendBackend(hailo8, cpu, warnings, errors);

  return {
    timestamp: Date.now(),
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    isRaspberryPi: piInfo.isRpi,
    isPi5: piInfo.isPi5,
    hailo8,
    cpu,
    memory,
    recommendedBackend,
    warnings,
    errors,
  };
}

// ─── Pretty Print ────────────────────────────────────────────────────────

function printReport(report: HardwareReport): void {
  const divider = "─".repeat(60);
  console.log(`\n${divider}`);
  console.log(`  Nexus-402 Hardware Check`);
  console.log(`  ${new Date(report.timestamp).toISOString()}`);
  console.log(divider);

  console.log(`\n  Platform:     ${report.platform} / ${report.arch}`);
  console.log(`  Hostname:     ${report.hostname}`);
  console.log(`  Raspberry Pi: ${report.isRaspberryPi ? `✓ ${report.isPi5 ? "Pi 5" : "Other"}` : "✗"}`);

  console.log(`\n  ─ Hailo-8 NPU ─`);
  if (report.hailo8.available) {
    console.log(`  Status:       ✓ AVAILABLE (${report.hailo8.deviceCount} device(s))`);
    console.log(`  Device:       ${report.hailo8.devicePath}`);
    console.log(`  Firmware:     ${report.hailo8.firmwareVersion ?? "unknown"}`);
    console.log(`  Driver:       ${report.hailo8.driverVersion ?? "unknown"}`);
    console.log(`  Performance:  ${report.hailo8.tops ?? 26} TOPS`);
    console.log(
      `  Temperature:  ${
        report.hailo8.npuTemperatureCelsius != null
          ? `${report.hailo8.npuTemperatureCelsius.toFixed(1)}°C`
          : "unknown"
      } [${report.hailo8.thermalState.toUpperCase()}]`
    );
  } else {
    console.log(`  Status:       ✗ NOT FOUND`);
    console.log(`  Checked:      ${HAILO8_DEVICE_PATHS.join(", ")}`);
  }

  console.log(`\n  ─ CPU ─`);
  console.log(`  Model:        ${report.cpu.model}`);
  console.log(`  Cores:        ${report.cpu.cores}`);
  console.log(`  Frequency:    ${report.cpu.frequencyMhz ?? "unknown"} MHz`);
  console.log(`  Load:         ${report.cpu.loadPercent ?? "unknown"}%`);
  console.log(
    `  Temperature:  ${
      report.cpu.temperatureCelsius != null
        ? `${report.cpu.temperatureCelsius.toFixed(1)}°C`
        : "unknown"
    } [${report.cpu.thermalState.toUpperCase()}]`
  );

  console.log(`\n  ─ Memory ─`);
  console.log(`  Total:        ${report.memory.totalMb} MB`);
  console.log(`  Free:         ${report.memory.freeMb} MB`);
  console.log(`  Usage:        ${report.memory.usagePercent}%`);

  console.log(`\n  ─ Inference Backend ─`);
  const backendEmoji: Record<InferenceBackend, string> = {
    hailo8_npu: "🚀",
    onnx_gpu: "⚡",
    onnx_cpu: "🖥️",
    mock: "🎭",
  };
  console.log(
    `  Recommended:  ${backendEmoji[report.recommendedBackend]} ${report.recommendedBackend.toUpperCase()}`
  );

  if (report.warnings.length > 0) {
    console.log(`\n  ─ Warnings ─`);
    report.warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
  }

  if (report.errors.length > 0) {
    console.log(`\n  ─ Errors ─`);
    report.errors.forEach((e) => console.log(`  ❌ ${e}`));
  }

  console.log(`\n${divider}\n`);
}

// ─── Entry Point ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const report = await runHardwareCheck();
  printReport(report);

  // Output machine-readable JSON for programmatic use
  const jsonOutput = JSON.stringify(report, null, 2);
  const outputPath = "./hardware_report.json";

  try {
    fs.writeFileSync(outputPath, jsonOutput, "utf8");
    console.log(`  Report saved to: ${outputPath}\n`);
  } catch (e) {
    // Non-critical: JSON output is optional
  }

  // Exit with error code if critical errors found
  if (report.errors.length > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((err) => {
    console.error("Hardware check failed:", err);
    process.exit(1);
  });
}
