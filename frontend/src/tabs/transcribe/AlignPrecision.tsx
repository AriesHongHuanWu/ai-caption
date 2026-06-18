import { Magnet } from 'lucide-react';
import { Pill, SelectField } from '../../components/primitives';
import { useT } from '../../i18n';

export interface AlignPrecisionProps {
  /** Onset-snap: snap word boundaries to detected vocal onsets. */
  refine: boolean;
  onRefineChange: (v: boolean) => void;
  /** Demucs model: "htdemucs" | "htdemucs_ft". Only shown when separation is on. */
  demucsModel: string;
  onDemucsModelChange: (v: string) => void;
  /** Whether Demucs separation is currently enabled (controls demucs picker visibility). */
  separateEnabled: boolean;
  /** Whether Demucs is available at all on this machine. */
  demucsAvailable: boolean;
}

/**
 * Compact precision options for Forced-Align mode.
 *
 * - Onset-snap pill: always shown in align mode; snaps word starts to
 *   the nearest detected vocal onset, which tightens timing on fast rap
 *   and rapid articulation.
 * - Demucs model selector: shown only when vocal separation is enabled.
 *   Lets the user pick standard (htdemucs) vs. high-quality fine-tuned
 *   (htdemucs_ft, ~2× slower) without surfacing it outside align mode.
 */
export function AlignPrecision({
  refine,
  onRefineChange,
  demucsModel,
  onDemucsModelChange,
  separateEnabled,
  demucsAvailable,
}: AlignPrecisionProps) {
  const t = useT();
  const showDemucs = demucsAvailable && separateEnabled;

  return (
    <div className="al-align-precision">
      {/* Onset-snap toggle */}
      <div className="al-align-precision__row">
        <Pill
          active={refine}
          onClick={() => onRefineChange(!refine)}
          icon={<Magnet size={12} strokeWidth={2} />}
          title={t('transcribe.precision.onsetSnapTitle')}
        >
          {t('transcribe.precision.onsetSnapLabel')}
        </Pill>
      </div>

      {/* Demucs model — only when separation is on */}
      {showDemucs && (
        <div className="al-align-precision__row al-align-precision__row--select">
          <SelectField
            label={t('transcribe.precision.demucsModelLabel')}
            value={demucsModel}
            onChange={(e) => onDemucsModelChange(e.target.value)}
            hint={t('transcribe.precision.demucsModelHint')}
          >
            <option value="htdemucs">
              {t('transcribe.precision.demucsModelStandard')}
            </option>
            <option value="htdemucs_ft">
              {t('transcribe.precision.demucsModelFt')}
            </option>
          </SelectField>
        </div>
      )}
    </div>
  );
}
