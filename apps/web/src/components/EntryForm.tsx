import { FormEvent, useEffect, useRef, useState } from 'react';
import { ApiError, auth } from '../api';

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'number' | 'textarea' | 'select';
  options?: string[];
  wide?: boolean;
  placeholder?: string;
}

interface Props {
  title: string;
  fields: FieldDef[];
  initial: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}

/** 로그인한 관리자가 후기·위시를 적고 고치는 카드 모양 입력 칸. 값 검사는 서버가 하고, 오류 문구를 그대로 보여 줍니다. */
export function EntryForm({ title, fields, initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  // 아래쪽 카드의 수정을 눌러도 입력 칸이 화면에 보이도록 데려옵니다.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave(values);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? '로그인이 끝났습니다. 컬렉션 관리에서 다시 로그인해 주세요.' : (err as Error).message);
      setBusy(false);
    }
  };
  return (
    <form ref={ref} className="entry-form card" onSubmit={submit} aria-label={title}>
      <div className="lab entry-title">{title}</div>
      {fields.map((f) => {
        const common = { className: 'fld', value: values[f.key] ?? '', placeholder: f.placeholder, onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [f.key]: e.target.value })) };
        return (
          <label key={f.key} className={f.wide ? 'wide' : undefined}>
            <span className="lab">{f.label}</span>
            {f.type === 'textarea' ? (
              <textarea rows={3} {...common} />
            ) : f.type === 'select' ? (
              <select {...common}>{f.options!.map((o) => <option key={o} value={o}>{o || '미정'}</option>)}</select>
            ) : (
              <input type={f.type ?? 'text'} {...common} />
            )}
          </label>
        );
      })}
      {error && <div className="err wide" role="alert">{error}</div>}
      <div className="entry-actions wide">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>취소</button>
        <button type="submit" className="btn-gold" disabled={busy}>{busy ? '저장하는 중…' : '저장'}</button>
      </div>
    </form>
  );
}

/** 이 브라우저에 관리자 로그인이 남아 있는지. 만료된 토큰이면 저장할 때 401로 알려 줍니다. */
export const isAdmin = () => !!auth.get();
