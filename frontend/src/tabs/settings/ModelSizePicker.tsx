import { Check } from 'lucide-react';
import { Badge } from '../../components/primitives';
import type { ModelSize } from '../../api/types';
import { MODEL_FACTS, RECOMMENDED_MODEL } from './modelStatus';
import type { ModelFacts, ModelStatus } from './modelStatus';
import { useT } from '../../i18n';

export interface ModelSizePickerProps {
  modelSizes: ModelSize[];
  value: ModelSize;
  onChange: (size: ModelSize) => void;
  /** Per-model install state (drives the "installed" trust mark). */
  statuses?: ModelStatus[];
}

const SIZE_LABEL: Partial<Record<ModelSize, string>> = {
  'large-v3': 'large-v3',
  medium: 'medium',
  small: 'small',
};

/** Key prefixes for the three known primary sizes whose facts are in i18n. */
const SIZE_FACTS_KEY: Partial<Record<ModelSize, string>> = {
  'large-v3': 'settings.facts.large',
  medium: 'settings.facts.medium',
  small: 'settings.facts.small',
};

/**
 * Model-size cards with VRAM + speed hints tuned for an 8 GB card.
 * Radiogroup semantics, full keyboard path, gold only on the chosen card.
 *
 * `modelSizes` is typed ModelSize[] but the backend may widen it to expose
 * turbo/tiny/base — sizes MODEL_FACTS does not carry. Each card is rendered
 * defensively: an unknown size still gets a minimal card (label + installed
 * mark) instead of throwing on `MODEL_FACTS[size].vramHint`.
 */
export function ModelSizePicker({ modelSizes, value, onChange, statuses }: ModelSizePickerProps) {
  const t = useT();
  const installedSet = new Set(
    (statuses ?? []).filter((s) => s.state === 'installed').map((s) => s.size),
  );

  return (
    <div className="al-msize" role="radiogroup" aria-label={t('settings.msize.ariaLabel')}>
      {modelSizes.map((size) => {
        const facts = MODEL_FACTS[size] as ModelFacts | undefined;
        const label = SIZE_LABEL[size] ?? String(size);
        const active = size === value;
        const recommended = size === RECOMMENDED_MODEL;
        const installed = installedSet.has(size);
        const factsPrefix = SIZE_FACTS_KEY[size];

        // All hint copy is localised via i18n. The three known primary sizes
        // carry a factsPrefix; unknown sizes (turbo/tiny/base) render the
        // numeric card without prose hints.
        const vramHint = factsPrefix ? t(`${factsPrefix}VramHint`) : undefined;
        const speedHint = factsPrefix ? t(`${factsPrefix}SpeedHint`) : undefined;
        const blurb = factsPrefix ? t(`${factsPrefix}Blurb`) : undefined;

        return (
          <button
            type="button"
            key={size}
            role="radio"
            aria-checked={active}
            className={`al-msize__card${active ? ' al-msize__card--active' : ''}`}
            onClick={() => onChange(size)}
          >
            <div className="al-msize__top">
              <span className="al-msize__name">{label}</span>
              {recommended && (
                <Badge tone="gold" title={t('settings.msize.recommendedTitle')}>
                  {t('settings.msize.recommended')}
                </Badge>
              )}
              {active && !recommended && <span className="al-msize__check"><Check size={14} /></span>}
            </div>
            {facts && (
              <>
                <div className="al-msize__row">
                  <span className="al-msize__k">VRAM</span>
                  <span className="al-msize__v">{vramHint}</span>
                </div>
                <div className="al-msize__row">
                  <span className="al-msize__k">{t('settings.msize.speed')}</span>
                  <span className="al-msize__v">{speedHint}</span>
                </div>
                <p className="al-msize__blurb">{blurb}</p>
              </>
            )}
            <div className="al-msize__foot">
              {facts && (
                <span className="al-msize__disk">{facts.diskGb.toFixed(1)} GB {t('settings.msize.onDisk')}</span>
              )}
              {installed ? (
                <span className="al-msize__tag al-msize__tag--on">
                  <Check size={11} /> {t('settings.msize.installed')}
                </span>
              ) : (
                <span className="al-msize__tag">{t('settings.msize.notDownloaded')}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
