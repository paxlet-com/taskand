#!/usr/bin/env node
// proc://taskand.dev/hw/monitor/v1 — telemetria sprzętu: wyłącznie realne odczyty (null gdy brak źródła)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import os from 'node:os';

let i = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) i = JSON.parse(raw);
} catch {
  process.exit(2);
}

const TEMP_WARN_C = 85;
// Kolejność = wiarygodność jako "temperatura CPU"
const CPU_SENSOR_PRIORITY = [/^Package id/, /^x86_pkg_temp$/, /^Tctl$/, /^Tdie$/, /^cpu[-_]?thermal/i, /^Core \d+$/, /^soc[-_]?thermal/i];

function readSensorsCmd() {
  try {
    const out = execSync('sensors 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
    return out.split('\n')
      .map(line => line.match(/^([^:]+):\s*\+?([\d.]+)°C/))
      .filter(Boolean)
      .map(m => ({ sensor: m[1].trim(), temp_c: parseFloat(m[2]) }));
  } catch {
    return [];
  }
}

function readThermalZones() {
  const base = '/sys/class/thermal';
  if (!existsSync(base)) return [];
  return readdirSync(base).filter(f => f.startsWith('thermal_zone')).flatMap(f => {
    try {
      const temp_c = parseFloat(readFileSync(`${base}/${f}/temp`, 'utf8')) / 1000;
      const sensor = readFileSync(`${base}/${f}/type`, 'utf8').trim();
      return [{ sensor, temp_c }];
    } catch {
      return [];
    }
  });
}

function pickCpuTemp(sensors) {
  for (const re of CPU_SENSOR_PRIORITY) {
    const hits = sensors.filter(s => re.test(s.sensor));
    if (hits.length) return hits.reduce((a, b) => (b.temp_c > a.temp_c ? b : a));
  }
  return null;
}

function cpuTimes() {
  return os.cpus().reduce((acc, c) => {
    const t = c.times;
    acc.idle += t.idle;
    acc.total += t.user + t.nice + t.sys + t.idle + t.irq;
    return acc;
  }, { idle: 0, total: 0 });
}

async function cpuUsagePct() {
  const a = cpuTimes();
  await new Promise(r => setTimeout(r, 300));
  const b = cpuTimes();
  const total = b.total - a.total;
  return total > 0 ? Math.round((1 - (b.idle - a.idle) / total) * 1000) / 10 : null;
}

function diskFreeGb() {
  try {
    const parts = execSync('df -BG . 2>/dev/null | tail -1', { encoding: 'utf8', timeout: 5000 }).trim().split(/\s+/);
    return parts.length >= 4 ? parseFloat(parts[3]) : null;
  } catch {
    return null;
  }
}

function gpioChips() {
  try {
    return readdirSync('/sys/class/gpio').filter(f => f.startsWith('gpiochip'));
  } catch {
    return null;
  }
}

const fromCmd = readSensorsCmd();
const sensors = fromCmd.length ? fromCmd : readThermalZones();
const cpu = pickCpuTemp(sensors);
const hot = sensors.filter(s => s.temp_c >= TEMP_WARN_C);
const usage = await cpuUsagePct();

const summary = sensors.length === 0
  ? 'brak dostępnych czujników temperatury na tym węźle'
  : hot.length
    ? `UWAGA: ${hot.map(s => `${s.sensor} ${s.temp_c}°C`).join(', ')} ≥ ${TEMP_WARN_C}°C`
    : `temperatury poniżej ${TEMP_WARN_C}°C (max ${Math.max(...sensors.map(s => s.temp_c))}°C)`;

process.stdout.write(JSON.stringify({
  ok: true,
  device: i.device || os.hostname(),
  cpu_temp: cpu ? cpu.temp_c : null,
  cpu_temp_source: cpu ? cpu.sensor : null,
  sensors,
  cpu_usage_pct: usage,
  load_avg: os.loadavg(),
  disk_free_gb: diskFreeGb(),
  gpio_chips: gpioChips(),
  summary,
  ts: new Date().toISOString()
}) + '\n');
process.exit(0);
