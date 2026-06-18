import { Cpu, Sparkles, Wand2 } from 'lucide-react';
import { Segmented } from './Segmented';
import type { SegmentedOption } from './Segmented';
import type { Device } from '../../api/types';
import { useT } from '../../i18n';

export interface DevicePickerProps {
  value: Device;
  onChange: (device: Device) => void;
  /** From meta.gpu — GPU option disables when no CUDA device is present. */
  gpuAvailable: boolean;
}

/**
 * Compute-device selector: Auto / GPU (CUDA) / CPU. The GPU segment is
 * gated on `meta.gpu`; Auto prefers GPU when one exists, else CPU.
 */
export function DevicePicker({ value, onChange, gpuAvailable }: DevicePickerProps) {
  const t = useT();
  const options: SegmentedOption<Device>[] = [
    {
      value: 'auto',
      label: 'Auto',
      hint: gpuAvailable ? t('settings.device.autoHintGpu') : t('settings.device.autoHintCpu'),
      icon: <Wand2 size={14} strokeWidth={1.75} />,
    },
    {
      value: 'cuda',
      label: 'GPU',
      hint: gpuAvailable ? t('settings.device.cudaHintAvail') : t('settings.device.cudaHintNone'),
      icon: <Sparkles size={14} strokeWidth={1.75} />,
      disabled: !gpuAvailable,
    },
    {
      value: 'cpu',
      label: 'CPU',
      hint: t('settings.device.cpuHint'),
      icon: <Cpu size={14} strokeWidth={1.75} />,
    },
  ];

  return <Segmented<Device> label={t('settings.device.label')} value={value} options={options} onChange={onChange} />;
}
