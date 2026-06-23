/* ──────────────────────────────────────────────────────────────────
   EditorBetaGate — the Editor (剪輯室) is being rebuilt, so it ships
   disabled behind a beta code. Enter "beta" to unlock it (remembered in
   localStorage). Until then this stands in place of the editor.
   ────────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { Scissors, Lock } from 'lucide-react';
import { useLang } from '../../i18n';
import { CutFlow } from './CutFlow';
import './cut.css';

const KEY = 'al-editor-beta';

export function EditorBetaGate() {
  const en = useLang() === 'en';
  const [unlocked, setUnlocked] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);

  if (unlocked) return <CutFlow />;

  const tryUnlock = () => {
    if (code.trim().toLowerCase() === 'beta') {
      try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ }
      setUnlocked(true);
    } else setErr(true);
  };

  return (
    <div className="al-tabpage al-betagate">
      <div className="al-tabpage__head">
        <h1 className="al-tabpage__title"><Scissors size={20} /> {en ? 'Editor — Beta' : '剪輯室 — Beta'}</h1>
        <p className="al-tabpage__lede">{en
          ? 'The in-app video editor is being rebuilt and is temporarily in beta. Enter the code to try it.'
          : '影片剪輯室正在重做中,暫時為 Beta、預設停用。輸入通關碼即可試用。'}</p>
      </div>
      <div className="al-betagate__box">
        <div className="al-betagate__lock"><Lock size={26} /></div>
        <div className="al-betagate__row">
          <input className="al-betagate__input" placeholder={en ? 'Enter code' : '輸入通關碼'} value={code}
                 onChange={(e) => { setCode(e.target.value); setErr(false); }}
                 onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock(); }} autoFocus />
          <button type="button" className="al-btn al-btn--primary" onClick={tryUnlock}>{en ? 'Unlock' : '解鎖'}</button>
        </div>
        {err && <span className="al-betagate__err">{en ? 'Wrong code — try again.' : '通關碼錯誤,再試一次。'}</span>}
        <span className="al-betagate__hint">{en ? 'Hint: the code is “beta”.' : '提示:通關碼就是「beta」。'}</span>
      </div>
    </div>
  );
}
