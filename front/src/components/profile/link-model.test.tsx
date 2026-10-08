import { describe, expect, it } from 'vitest';
import {
  isGithubUrl,
  isSafeLinkUrl,
  linkDisplayText,
  linkIconName,
  normalizeLinkUrl,
} from './link-model';

describe('isGithubUrl', () => {
  it('github.com 도메인을 대소문자 구분 없이 판별한다', () => {
    expect(isGithubUrl('https://github.com/kim')).toBe(true);
    expect(isGithubUrl('HTTPS://GITHUB.COM/kim')).toBe(true);
    expect(isGithubUrl('https://example.com/github.com/x')).toBe(true);
    expect(isGithubUrl('https://blog.example.com')).toBe(false);
    expect(isGithubUrl(undefined)).toBe(false);
  });
});

describe('linkIconName', () => {
  it('깃허브 링크는 imgLink1Icon, 나머지는 imgLink2Icon을 쓴다', () => {
    expect(linkIconName('https://github.com/kim')).toBe('imgLink1Icon');
    expect(linkIconName('https://blog.example.com')).toBe('imgLink2Icon');
    expect(linkIconName(undefined)).toBe('imgLink2Icon');
  });
});

describe('linkDisplayText', () => {
  it('프로토콜과 끝 슬래시를 뗀 URL을 보여준다', () => {
    expect(linkDisplayText({ url: 'https://github.com/kim/' })).toBe('github.com/kim');
    expect(linkDisplayText({ url: 'http://blog.example.com' })).toBe('blog.example.com');
  });

  it('URL이 없으면 label을 보여준다', () => {
    expect(linkDisplayText({ url: '', label: 'GitHub' })).toBe('GitHub');
    expect(linkDisplayText({ label: '포트폴리오' })).toBe('포트폴리오');
  });
});

describe('isSafeLinkUrl', () => {
  it('http/https만 안전한 링크로 판정한다', () => {
    expect(isSafeLinkUrl('https://example.com')).toBe(true);
    expect(isSafeLinkUrl('http://example.com')).toBe(true);
    expect(isSafeLinkUrl('HTTPS://EXAMPLE.COM')).toBe(true);
    expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeLinkUrl('data:text/html,x')).toBe(false);
    expect(isSafeLinkUrl('ftp://example.com')).toBe(false);
    expect(isSafeLinkUrl('example.com')).toBe(false);
    expect(isSafeLinkUrl(undefined)).toBe(false);
  });
});

describe('normalizeLinkUrl', () => {
  it('http/https URL은 그대로 통과한다', () => {
    expect(normalizeLinkUrl('https://github.com/kim')).toBe('https://github.com/kim');
    expect(normalizeLinkUrl('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
  });

  it('스킴이 없으면 https://를 붙인다', () => {
    expect(normalizeLinkUrl('example.com')).toBe('https://example.com');
    expect(normalizeLinkUrl('  example.com/path  ')).toBe('https://example.com/path');
  });

  it('http/https가 아닌 스킴은 저장하지 않는다', () => {
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkUrl('data:text/html,x')).toBeNull();
    expect(normalizeLinkUrl('ftp://example.com')).toBeNull();
    expect(normalizeLinkUrl('JavaScript:alert(1)')).toBeNull();
  });

  it('형식이 잘못된 URL이나 빈 값은 null을 반환한다', () => {
    expect(normalizeLinkUrl('')).toBeNull();
    expect(normalizeLinkUrl('   ')).toBeNull();
    expect(normalizeLinkUrl('https://')).toBeNull();
  });
});
