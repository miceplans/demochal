'use client';

import { useEffect, useState } from 'react';
import { adApi } from '@/lib/ad-api';
import {
  BizContent,
  SectionTitle,
  FieldInput,
  PrimaryButton,
  useBizHref,
} from '@/components/biz/BizShell';

export function BizProfileEditPage() {
  const hrefOf = useBizHref();
  const [id, setId] = useState('');
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  useEffect(() => {
    void adApi.businesses
      .me()
      .then((business) => {
        setId(business.id);
        setForm({
          name: business.name,
          address: business.address ?? '',
          phone: business.phone ?? '',
          email: business.email ?? '',
        });
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const save = async () => {
    setState('saving');
    try {
      await adApi.businesses.update(id, form);
      window.location.href = hrefOf('/profile');
    } catch {
      setState('error');
    }
  };
  if (state === 'loading')
    return (
      <BizContent>
        <p>기업 정보를 불러오는 중입니다.</p>
      </BizContent>
    );
  if (!id)
    return (
      <BizContent>
        <p>기업 정보를 불러오지 못했습니다.</p>
      </BizContent>
    );
  return (
    <BizContent>
      <SectionTitle>기업 프로필 수정</SectionTitle>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        style={{ display: 'grid', gap: 16, maxWidth: 520 }}
      >
        <label>
          기업명
          <FieldInput value={form.name} onChange={update('name')} required />
        </label>
        <label>
          주소
          <FieldInput value={form.address} onChange={update('address')} />
        </label>
        <label>
          전화번호
          <FieldInput value={form.phone} onChange={update('phone')} />
        </label>
        <label>
          이메일
          <FieldInput type="email" value={form.email} onChange={update('email')} />
        </label>
        {state === 'error' && <p>저장하지 못했습니다.</p>}
        <PrimaryButton type="submit" disabled={state === 'saving'}>
          {state === 'saving' ? '저장 중…' : '저장'}
        </PrimaryButton>
      </form>
    </BizContent>
  );
}
