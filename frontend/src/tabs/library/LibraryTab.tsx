import { useMemo, useState } from 'react';
import { Library as LibraryIcon, Trash2, ArrowDownUp } from 'lucide-react';
import './library.css';
import { Eyebrow } from '../../components/primitives';
import { RunRow } from './RunRow';
import { RunSearch } from './RunSearch';
import { LocalAssurance } from './LocalAssurance';
import { SAMPLE_RUNS } from './sampleRuns';
import { modeLabel, languageLabelT } from './runMeta';
import { useLibrary } from '../../state/useLibrary';
import { useResultStore } from '../../state/useResultStore';
import { useSettings } from '../../state/useSettings';
import { useT } from '../../i18n';
import type { RunRecord } from '../../state/useLibrary';
import type { Defaults } from '../../state/useSettings';
import type { ModelSize, Engine } from '../../api/types';
import type { TabKey } from '../../components/shell/tabs';

export interface LibraryTabProps {
  onNavigate: (tab: TabKey) => void;
}

type SortKey = 'recent' | 'title' | 'duration';

const VALID_MODELS: ModelSize[] = ['large-v3', 'medium', 'small'];
function asModelSize(v: string): ModelSize | undefined {
  return (VALID_MODELS as string[]).includes(v) ? (v as ModelSize) : undefined;
}
function asEngine(v: string): Engine | undefined {
  return v === 'whisper' ? 'whisper' : undefined;
}

/** Past-run list + search; reopen / re-export / duplicate-settings / delete. */
export function LibraryTab({ onNavigate }: LibraryTabProps) {
  const t = useT();

  const runs = useLibrary((s) => s.runs);
  const remove = useLibrary((s) => s.remove);
  const clearAll = useLibrary((s) => s.clear);
  const loadResult = useResultStore((s) => s.load);
  const setDefaults = useSettings((s) => s.set);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  // Sort options — computed inside render so labels follow the active language.
  const SORTS: { key: SortKey; label: string }[] = [
    { key: 'recent', label: t('library.sort.recent') },
    { key: 'title', label: t('library.sort.name') },
    { key: 'duration', label: t('library.sort.duration') },
  ];

  // The library is empty AND there's no real history → show built-in sample
  // rows so the tab is fully designable / visible offline (never blank).
  const usingSamples = runs.length === 0;
  const source: RunRecord[] = usingSamples ? SAMPLE_RUNS : runs;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? source.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            modeLabel(r.mode, t).toLowerCase().includes(q) ||
            r.mode.toLowerCase().includes(q) ||
            r.language.toLowerCase().includes(q) ||
            languageLabelT(r.language, t).toLowerCase().includes(q) ||
            r.modelSize.toLowerCase().includes(q) ||
            r.engine.toLowerCase().includes(q),
        )
      : source.slice();

    rows.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'duration') return b.durationSec - a.durationSec;
      return b.createdAt - a.createdAt; // recent
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, query, sort, t]);

  const open = (run: RunRecord) => {
    loadResult(run.result);
    onNavigate('editor');
  };
  const reExport = (run: RunRecord) => {
    loadResult(run.result);
    onNavigate('export');
  };
  const duplicate = (run: RunRecord) => {
    // Carry the run's settings forward so Transcribe opens pre-filled.
    const patch: Partial<Defaults> = {
      mode: run.mode,
      language: run.language || null,
    };
    const ms = asModelSize(run.modelSize);
    if (ms) patch.modelSize = ms;
    const eng = asEngine(run.engine);
    if (eng) patch.engine = eng;
    setDefaults(patch);
    onNavigate('transcribe');
  };

  const cycleSort = () => {
    const i = SORTS.findIndex((s) => s.key === sort);
    setSort(SORTS[(i + 1) % SORTS.length].key);
  };
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? '';

  const noMatches = filtered.length === 0;

  return (
    <div className="al-tabpage">
      <div className="al-tabpage__head">
        <h1 className="al-tabpage__title">{t('library.title')}</h1>
        <p className="al-tabpage__lede">{t('library.lede')}</p>
      </div>

      <div className="al-library">
        <div className="al-library__toolbar">
          <RunSearch
            value={query}
            onChange={setQuery}
            count={filtered.length}
            total={source.length}
          />
          <button
            type="button"
            className="al-library__sort"
            onClick={cycleSort}
            title={t('library.sortBtn.title')}
            aria-label={t('library.sortBtn.aria', { label: sortLabel })}
          >
            <ArrowDownUp size={14} />
            <span className="al-library__sort-label">{sortLabel}</span>
          </button>
          {!usingSamples && runs.length > 0 && (
            <button
              type="button"
              className="al-library__clear"
              onClick={() => {
                if (
                  window.confirm(
                    t('library.clearAll.confirm', { count: runs.length }),
                  )
                ) {
                  clearAll();
                }
              }}
              title={t('library.clearAll.title')}
            >
              <Trash2 size={14} />
              <span>{t('library.clearAll.label')}</span>
            </button>
          )}
        </div>

        {usingSamples && (
          <div className="al-library__samplenote">
            {t('library.sampleNote')}
          </div>
        )}

        {noMatches ? (
          <div className="al-library__empty">
            <LibraryIcon size={26} strokeWidth={1.25} aria-hidden="true" />
            <div className="al-library__empty-title">{t('library.empty.title')}</div>
            <div className="al-library__empty-sub">{t('library.empty.sub')}</div>
          </div>
        ) : (
          <div className="al-runlist" role="list">
            <div className="al-runhead" aria-hidden="true">
              <Eyebrow rule={false}>{t('library.col.title')}</Eyebrow>
              <Eyebrow rule={false}>{t('library.col.mode')}</Eyebrow>
              <Eyebrow rule={false}>{t('library.col.duration')}</Eyebrow>
              <Eyebrow rule={false}>{t('library.col.engine')}</Eyebrow>
              <Eyebrow rule={false}>{t('library.col.date')}</Eyebrow>
              <Eyebrow rule={false}>{t('library.col.status')}</Eyebrow>
              <span />
            </div>
            {filtered.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                sample={usingSamples}
                onOpen={open}
                onReExport={reExport}
                onDuplicate={duplicate}
                onDelete={remove}
              />
            ))}
          </div>
        )}

        <LocalAssurance />
      </div>
    </div>
  );
}
