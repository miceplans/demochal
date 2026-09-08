import type { ReactNode } from 'react';

// Pages in this group (UserShell-based design pages) render their own
// header/footer/bottom-nav inside UserShell. This layout must stay a
// pass-through: any wrapper (extra header, flex-row main) would break the
// shell's vertical stacking (header → main(flex:1) → footer) and the
// footer's bottom alignment.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
