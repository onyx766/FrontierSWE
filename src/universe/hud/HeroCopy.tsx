import { profile } from '@/data/profile';
import { heroCaption, heroLines, hudCopy } from '@/data/universe';

/** The opening statement. Plain server-rendered markup: it must never wait for the scene. */
export function HeroCopy() {
  return (
    <div className="uh-hero">
      <h1 className="uh-hero-title">
        {heroLines.map((line) => (
          <span key={line} className="block">
            {line}{' '}
          </span>
        ))}
      </h1>
      <div className="uh-hero-rule" aria-hidden />
      <p className="uh-hero-caption">
        <span className="uh-hero-years">
          {profile.yearsExperience} {hudCopy.yearsUnit}
        </span>{' '}
        {heroCaption.map((line) => (
          <span key={line} className="uh-hero-of">
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}
