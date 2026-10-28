// tesseract.js가 기본값으로 런타임에 CDN에서 받아오는 워커 스크립트·WASM 코어·학습데이터를
// same-origin(public/)으로 자체 호스팅한다. front/next.config.ts의 CSP가 외부 CDN을
// 허용하지 않으므로 'self'로 커버되는 경로에 복사한 뒤 poster-ocr.ts가 이 경로를 명시한다.
// dev/build 전에 실행되며(pnpm pre 훅), 원본이 없으면 실패해 자산 누락을 조용히 넘기지 않는다.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// tesseract.js-core는 tesseract.js의 중첩 의존이라 tesseract.js 기준으로 resolve한다.
const tesseractRequire = createRequire(require.resolve('tesseract.js/package.json'));

const frontRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(frontRoot, 'public', 'tesseract');

const resolveSource = (specifier) =>
  specifier.startsWith('tesseract.js-core/')
    ? tesseractRequire.resolve(specifier)
    : require.resolve(specifier);

// [npm 패키지 내 원본, public/tesseract 아래 복사 위치]
// 코어는 LSTM 전용(기본 OEM)·SIMD 변형 3종 — getCore가 지원 여부에 따라 그 중 하나를 고른다.
const assets = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm', 'core/tesseract-core-lstm.wasm'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm', 'core/tesseract-core-simd-lstm.wasm'],
  [
    'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
    'core/tesseract-core-relaxedsimd-lstm.wasm.js',
  ],
  [
    'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm',
    'core/tesseract-core-relaxedsimd-lstm.wasm',
  ],
  ['@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz', 'lang-data/kor.traineddata.gz'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang-data/eng.traineddata.gz'],
];

for (const [from, to] of assets) {
  const target = join(outDir, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolveSource(from), target);
}

console.log(`tesseract.js 자체 호스팅 자산 ${assets.length}개를 ${outDir}에 복사했습니다.`);
