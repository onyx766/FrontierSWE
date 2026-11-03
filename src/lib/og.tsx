import type { ReactElement } from 'react';

/**
 * Shared OpenGraph card renderer.
 *
 * Rendered by Satori (via `next/og`), which supports a flexbox subset of CSS —
 * no grid, no custom properties — so the design tokens are repeated literally
 * here rather than imported. Kept deliberately plain: a card has to be legible
 * as a 300px-wide thumbnail in a Slack message.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

const VOID = '#06070A';
const LINE = '#1E242F';
const PRIMARY = '#E8EBF0';
const BODY = '#9AA4B2';
const MUTED = '#5B6676';
const ACCENT = '#3DD68C';

interface OgCardProps {
  /** Small mono kicker, e.g. "CASE STUDY" or the role. */
  kicker: string;
  title: string;
  description?: string;
  /** Short mono chips along the bottom. */
  tags?: string[];
  /** Right-hand status line. */
  status?: string;
}

export function OgCard({ kicker, title, description, tags, status }: OgCardProps): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: VOID,
        // Satori supports linear-gradient backgrounds; this is the fine grid.
        backgroundImage: `linear-gradient(to right, ${LINE} 1px, transparent 1px), linear-gradient(to bottom, ${LINE} 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
        padding: '64px 72px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Top rule with accent tick */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', height: 2, width: '100%', backgroundColor: LINE }}>
          <div style={{ width: 80, height: 2, backgroundColor: ACCENT }} />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              letterSpacing: 6,
              color: MUTED,
              textTransform: 'uppercase',
            }}
          >
            {kicker}
          </div>
          {status ? (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 10,
                  backgroundColor: ACCENT,
                  marginRight: 14,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  fontSize: 20,
                  letterSpacing: 5,
                  color: ACCENT,
                  textTransform: 'uppercase',
                }}
              >
                {status}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 34 ? 72 : 92,
            lineHeight: 1.04,
            color: PRIMARY,
            letterSpacing: -3,
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              maxWidth: 940,
              fontSize: 30,
              lineHeight: 1.4,
              color: BODY,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderTop: `1px solid ${LINE}`,
          paddingTop: 28,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', maxWidth: 820 }}>
          {(tags ?? []).slice(0, 7).map((tag) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                border: `1px solid ${LINE}`,
                padding: '8px 14px',
                marginRight: 10,
                marginTop: 10,
                fontSize: 18,
                letterSpacing: 2,
                color: MUTED,
                textTransform: 'uppercase',
              }}
            >
              {tag}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 20,
            letterSpacing: 5,
            color: MUTED,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            paddingLeft: 24,
          }}
        >
          Ryan // Engineering Universe
        </div>
      </div>
    </div>
  );
}
