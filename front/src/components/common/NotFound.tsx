import Link from 'next/link';

export function NotFound({
  homeHref = '/',
  buttonText = '홈으로',
}: {
  homeHref?: string;
  buttonText?: string;
}) {
  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 64,
          padding: '48px 24px',
        }}
      >
        <div>
          <img
            src="/assets/404.png"
            alt="404"
            width={598}
            height={228}
            style={{ width: 142, height: 'auto', display: 'block' }}
          />
          <p
            style={{
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.4,
              color: '#101010',
              textAlign: 'center',
              whiteSpace: 'pre-line',
              marginTop: 4,
            }}
          >
            {'앗, 여긴 아무것도 없어요. \n홈으로 돌아가실래요?'}
          </p>
        </div>
        <Link
          href={homeHref}
          style={{
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.4,
            background: '#006fff',
            color: '#ffffff',
            borderRadius: 8,
            padding: '11px 16px',
            textDecoration: 'none',
          }}
        >
          {buttonText}
        </Link>
      </div>
    </div>
  );
}
