"""pipeline/hardware.py — Hardware detection + model recommendation.

Detects the machine's GPU, VRAM, CUDA version, CPU, and RAM; then recommends the
best Whisper model size and device (cuda / cpu) the machine can run well. The
first-run setup flow (SetupScreen / SetupBanner) uses this to (1) show the user's
config in plain language, (2) recommend a model + device, (3) let them pick the
recommended or a higher/other model, (4) download now or skip.

Design rules (same as all other pipeline submodules):
  * Import-safe: heavy deps (torch, psutil, ctypes) are imported inside
    try/except at call-time, never at import time. This module's import phase is
    pure data + pure functions and is always safe.
  * Never crashes: every probe is wrapped in try/except — a single failure only
    nulls its own field, and a CPU-safe recommendation is still returned. If
    torch is missing entirely, detection degrades to a CPU/small recommendation.
  * No network calls.

Public API (GET /api/hardware in app.py depends on this):
  detect_hardware()    -> full hardware + recommendation + tiers dict (schema below)
  get_hardware_info()  -> alias of detect_hardware() (kept for existing callers)
  recommend_model(...) -> {model, device, whisperSize, reasonCode}
  REASON_CODES         -> stable reasonCode set the frontend maps to localized text

detect_hardware() return schema (all JSON-safe):
  {
    "gpu": bool, "gpuName": str|None, "vramTotalMB": int|None, "vramFreeMB": int|None,
    "cuda": bool, "cudaVersion": str|None,
    "cpu": str, "cpuCount": int, "ramTotalMB": int|None,
    "recommended": {"model": str, "device": "cuda"|"cpu", "whisperSize": str, "reasonCode": str},
    "tiers": [ {"model": str, "whisperSize": str, "fits": bool}, ... ],
  }
"""

from __future__ import annotations

import logging
import os
import platform
from typing import Any, Optional

logger = logging.getLogger("autolyrics.hardware")


# --------------------------------------------------------------------------- #
# Stable reasonCodes — the frontend i18n maps each to a localized explanation.
# These strings are a CONTRACT: do not rename without updating the frontend
# hardware/setup namespace that looks them up.
# --------------------------------------------------------------------------- #
REASON_CODES: tuple[str, ...] = (
    "gpu_8gb",    # CUDA + VRAM >= ~7000MB  -> large-v3 (cuda)
    "gpu_4gb",    # CUDA + VRAM 4000–7000   -> medium   (cuda)
    "gpu_2gb",    # CUDA + VRAM 2000–4000   -> small    (cuda)
    "gpu_low",    # CUDA but VRAM < 2000    -> small    (cpu — GPU too small)
    "cpu_only",   # no CUDA, ordinary machine -> small  (cpu — slower)
    "cpu_weak",   # no CUDA, very weak machine -> base  (cpu)
)

# VRAM thresholds (MB). Set deliberately higher than raw download sizes: loading
# a large Whisper model plus its KV cache costs noticeably more VRAM than the
# weights alone, so large-v3 only sits comfortably on an ~8GB card (>= 7000MB).
_VRAM_LARGE = 7000   # >= -> large-v3 (cuda)
_VRAM_MEDIUM = 4000  # >= -> medium   (cuda)
_VRAM_SMALL = 2000   # >= -> small    (cuda)

# "Very weak" CPU heuristic (no GPU). Only when BOTH few cores AND little RAM do
# we drop to base, so we don't get overly conservative on otherwise-fine boxes.
_WEAK_CPU_COUNT = 4    # logical cores <= 4
_WEAK_RAM_MB = 6000    # RAM < ~6GB

# Whisper tiers this machine can run *well*. Each maps to a models.REGISTRY id.
# minVramMB are conservative load estimates (MB), in ascending order. Every size
# the frontend picker offers must appear here so the picker always has an
# authoritative fit indicator instead of silently defaulting to fits=True.
#
# cpuOk marks the sizes that are practical to run on CPU (no GPU). base/small are
# light enough to be usable on CPU; medium runs but is slow; the large sizes are
# too slow on CPU to recommend. _build_tiers() uses cpuOk when there is no CUDA
# (or the GPU is too small to use), and minVramMB when CUDA is in play.
_TIERS: list[dict[str, Any]] = [
    {"model": "whisper-base", "whisperSize": "base", "minVramMB": 0, "cpuOk": True},
    {"model": "whisper-small", "whisperSize": "small", "minVramMB": _VRAM_SMALL, "cpuOk": True},
    {"model": "whisper-medium", "whisperSize": "medium", "minVramMB": _VRAM_MEDIUM, "cpuOk": True},
    {"model": "whisper-large-v3-turbo", "whisperSize": "large-v3-turbo", "minVramMB": 4500, "cpuOk": False},
    {"model": "whisper-large-v3", "whisperSize": "large-v3", "minVramMB": _VRAM_LARGE, "cpuOk": False},
]


# --------------------------------------------------------------------------- #
# GPU / CUDA probes (torch — deferred import, never raises)
# --------------------------------------------------------------------------- #
def _bytes_to_mb(b: Any) -> Optional[int]:
    """bytes -> MB (int); invalid input -> None."""
    try:
        return int(float(b) // (1024 * 1024))
    except (TypeError, ValueError):
        return None


def _detect_gpu() -> dict[str, Any]:
    """Detect GPU / CUDA / VRAM. torch missing or no CUDA -> gpu=False, fields None.

    Returns {gpu, gpuName, vramTotalMB, vramFreeMB, cuda, cudaVersion}. Every
    sub-probe is independently guarded, so one failure doesn't sink the rest.
    """
    out: dict[str, Any] = {
        "gpu": False,
        "gpuName": None,
        "vramTotalMB": None,
        "vramFreeMB": None,
        "cuda": False,
        "cudaVersion": None,
    }
    try:
        import torch  # type: ignore
    except Exception as exc:  # noqa: BLE001 - torch absent is common & acceptable
        logger.debug("torch unavailable; hardware detection falls back to CPU-only: %r", exc)
        return out

    # CUDA build version (torch.version.cuda can have a value even without a
    # usable device, so probe it independently of cuda.is_available()).
    try:
        out["cudaVersion"] = getattr(getattr(torch, "version", None), "cuda", None) or None
    except Exception:  # noqa: BLE001
        out["cudaVersion"] = None

    # Is a usable CUDA device actually available?
    try:
        cuda_ok = bool(torch.cuda.is_available())
    except Exception:  # noqa: BLE001
        cuda_ok = False
    out["cuda"] = cuda_ok
    if not cuda_ok:
        out["cudaVersion"] = None  # no device -> the build version is irrelevant to UI
        return out

    # GPU name
    try:
        out["gpuName"] = str(torch.cuda.get_device_name(0))
    except Exception:  # noqa: BLE001
        out["gpuName"] = None

    # gpu=True only when we have a usable CUDA device with a name to show.
    out["gpu"] = out["gpuName"] is not None

    # Total VRAM
    try:
        props = torch.cuda.get_device_properties(0)
        out["vramTotalMB"] = _bytes_to_mb(props.total_memory)
    except Exception:  # noqa: BLE001
        out["vramTotalMB"] = None

    # Free VRAM — best-effort; some platforms/drivers don't support mem_get_info.
    try:
        free_bytes, _total_bytes = torch.cuda.mem_get_info(0)
        out["vramFreeMB"] = _bytes_to_mb(free_bytes)
    except Exception:  # noqa: BLE001
        out["vramFreeMB"] = None

    return out


# --------------------------------------------------------------------------- #
# CPU / RAM probes
# --------------------------------------------------------------------------- #
def _detect_cpu_name() -> str:
    """Best-effort CPU model string. Always returns a non-empty value."""
    try:
        name = platform.processor()
        if name:
            return name
    except Exception:  # noqa: BLE001
        pass
    # platform.processor() is empty on some Linux/Windows builds — try cpuinfo.
    try:
        with open("/proc/cpuinfo") as f:
            for line in f:
                if line.startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except Exception:  # noqa: BLE001
        pass
    try:
        return platform.machine() or "Unknown CPU"
    except Exception:  # noqa: BLE001
        return "Unknown CPU"


def _detect_cpu_count() -> int:
    try:
        return int(os.cpu_count() or 1)
    except Exception:  # noqa: BLE001
        return 1


def _detect_ram_mb() -> Optional[int]:
    """Total physical RAM in MB. psutil -> Windows GlobalMemoryStatusEx ->
    /proc/meminfo / sysconf. Returns None if every path fails."""
    # 1. psutil (cross-platform, if installed)
    try:
        import psutil  # type: ignore

        return _bytes_to_mb(psutil.virtual_memory().total)
    except Exception:  # noqa: BLE001
        pass

    # 2. Windows: ctypes GlobalMemoryStatusEx
    if platform.system() == "Windows":
        try:
            import ctypes

            class _MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            stat = _MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(_MEMORYSTATUSEX)
            ok = ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))  # type: ignore[attr-defined]
            if ok:
                return _bytes_to_mb(stat.ullTotalPhys)
        except Exception:  # noqa: BLE001
            pass

    # 3. POSIX: /proc/meminfo (Linux), then sysconf (Linux / macOS)
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    return int(line.split()[1]) // 1024  # kB -> MB
    except Exception:  # noqa: BLE001
        pass
    try:
        if hasattr(os, "sysconf"):
            names = getattr(os, "sysconf_names", {})
            if "SC_PAGE_SIZE" in names and "SC_PHYS_PAGES" in names:
                page_size = os.sysconf("SC_PAGE_SIZE")
                phys_pages = os.sysconf("SC_PHYS_PAGES")
                if page_size > 0 and phys_pages > 0:
                    return _bytes_to_mb(page_size * phys_pages)
    except Exception:  # noqa: BLE001
        pass

    return None


# --------------------------------------------------------------------------- #
# Recommendation
# --------------------------------------------------------------------------- #
def recommend_model(
    *,
    cuda: bool,
    vram_total_mb: Optional[int],
    cpu_count: int = 0,
    ram_total_mb: Optional[int] = None,
) -> dict[str, str]:
    """Derive {model, device, whisperSize, reasonCode} from the hardware.

    Rules (per GOAL):
      * CUDA + VRAM >= ~7000MB  -> large-v3 (cuda)        reasonCode=gpu_8gb
      * CUDA + VRAM 4000–7000   -> medium   (cuda)        reasonCode=gpu_4gb
      * CUDA + VRAM 2000–4000   -> small    (cuda)        reasonCode=gpu_2gb
      * CUDA but VRAM < 2000    -> small    (cpu, too small) reasonCode=gpu_low
      * no CUDA, ordinary box   -> small    (cpu, slower) reasonCode=cpu_only
      * no CUDA, very weak box   -> base    (cpu)         reasonCode=cpu_weak

    If cuda=True but VRAM is unreadable, conservatively recommend small (cuda).
    """
    if cuda:
        vram = vram_total_mb if vram_total_mb is not None else 0
        if vram >= _VRAM_LARGE:
            return {"model": "whisper-large-v3", "device": "cuda",
                    "whisperSize": "large-v3", "reasonCode": "gpu_8gb"}
        if vram >= _VRAM_MEDIUM:
            return {"model": "whisper-medium", "device": "cuda",
                    "whisperSize": "medium", "reasonCode": "gpu_4gb"}
        if vram >= _VRAM_SMALL:
            return {"model": "whisper-small", "device": "cuda",
                    "whisperSize": "small", "reasonCode": "gpu_2gb"}
        # CUDA present but VRAM unreadable or tiny.
        if vram_total_mb is None:
            # Couldn't read VRAM: assume a usable small/cuda; reuse gpu_2gb copy.
            return {"model": "whisper-small", "device": "cuda",
                    "whisperSize": "small", "reasonCode": "gpu_2gb"}
        # GPU genuinely too small (< 2000MB): small on CPU is steadier.
        return {"model": "whisper-small", "device": "cpu",
                "whisperSize": "small", "reasonCode": "gpu_low"}

    # No CUDA -> CPU path. Very weak machines drop to base; otherwise small.
    weak = (
        0 < cpu_count <= _WEAK_CPU_COUNT
        and ram_total_mb is not None
        and ram_total_mb < _WEAK_RAM_MB
    )
    if weak:
        return {"model": "whisper-base", "device": "cpu",
                "whisperSize": "base", "reasonCode": "cpu_weak"}
    return {"model": "whisper-small", "device": "cpu",
            "whisperSize": "small", "reasonCode": "cpu_only"}


def _build_tiers(*, cuda: bool, vram_total_mb: Optional[int]) -> list[dict[str, Any]]:
    """Return [{model, whisperSize, fits}] — can this machine run each size well?

    Device-aware so the tiers always AGREE with recommend_model():

      * Effective GPU path (CUDA present AND VRAM is unreadable or >= _VRAM_SMALL):
        fits = VRAM >= the tier's minVramMB. If VRAM is unreadable, mark all True
        and let the user decide; the recommendation still leads.
      * Effective CPU path (no CUDA, OR CUDA present but VRAM < _VRAM_SMALL so the
        recommendation itself dropped to CPU): fits = the tier's cpuOk flag —
        base/small/medium run on CPU (just slower), the large sizes don't.

    Mirroring the recommendation's CPU fallback here guarantees the recommended
    model's own tier never comes back fits=False (the gpu_low incoherence fix).
    """
    # When CUDA is present but VRAM is genuinely below the small threshold, the
    # recommendation moves to CPU — so the tiers must use the CPU rule too, or
    # the recommended size would be flagged "Needs more VRAM" against itself.
    use_cpu_rule = (not cuda) or (vram_total_mb is not None and vram_total_mb < _VRAM_SMALL)

    tiers: list[dict[str, Any]] = []
    for t in _TIERS:
        if use_cpu_rule:
            fits = bool(t.get("cpuOk"))
        else:
            fits = True if vram_total_mb is None else vram_total_mb >= int(t["minVramMB"])
        tiers.append({
            "model": t["model"],
            "whisperSize": t["whisperSize"],
            "fits": bool(fits),
        })
    return tiers


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def detect_hardware() -> dict[str, Any]:
    """Detect full hardware + recommendation + tiers. Never raises; worst case
    returns a CPU-safe default payload matching the documented schema."""
    try:
        gpu_info = _detect_gpu()
    except Exception as exc:  # noqa: BLE001
        logger.warning("GPU detection failed; falling back to CPU-only: %r", exc)
        gpu_info = {
            "gpu": False, "gpuName": None, "vramTotalMB": None,
            "vramFreeMB": None, "cuda": False, "cudaVersion": None,
        }

    try:
        cpu_name = _detect_cpu_name()
    except Exception as exc:  # noqa: BLE001
        logger.warning("CPU name detection failed: %r", exc)
        cpu_name = "Unknown CPU"

    try:
        cpu_count = _detect_cpu_count()
    except Exception as exc:  # noqa: BLE001
        logger.warning("CPU count detection failed: %r", exc)
        cpu_count = 1

    try:
        ram_mb = _detect_ram_mb()
    except Exception as exc:  # noqa: BLE001
        logger.warning("RAM detection failed: %r", exc)
        ram_mb = None

    cuda = bool(gpu_info.get("cuda"))
    vram_total = gpu_info.get("vramTotalMB")

    try:
        recommended = recommend_model(
            cuda=cuda,
            vram_total_mb=vram_total,
            cpu_count=cpu_count,
            ram_total_mb=ram_mb,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("recommendation failed; using CPU-safe default: %r", exc)
        recommended = {"model": "whisper-small", "device": "cpu",
                       "whisperSize": "small", "reasonCode": "cpu_only"}

    try:
        tiers = _build_tiers(cuda=cuda, vram_total_mb=vram_total)
    except Exception as exc:  # noqa: BLE001
        logger.warning("tier computation failed: %r", exc)
        tiers = []

    return {
        "gpu": bool(gpu_info.get("gpu")),
        "gpuName": gpu_info.get("gpuName"),
        "vramTotalMB": gpu_info.get("vramTotalMB"),
        "vramFreeMB": gpu_info.get("vramFreeMB"),
        "cuda": cuda,
        "cudaVersion": gpu_info.get("cudaVersion"),
        "cpu": cpu_name,
        "cpuCount": cpu_count,
        "ramTotalMB": ram_mb,
        "recommended": recommended,
        "tiers": tiers,
    }


# Backward-compatible alias: app.py's GET /api/hardware already imports this name.
def get_hardware_info() -> dict[str, Any]:
    """Alias of detect_hardware() — kept for the existing /api/hardware caller."""
    return detect_hardware()
