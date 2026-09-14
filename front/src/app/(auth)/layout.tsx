import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  // Auth pages render their own UserShell (header → main). Wrapping that
  // shell in a flex <main> makes the header and page body sibling flex items.
  return <>{children}</>;
}
