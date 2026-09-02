const CURRENT_YEAR = new Date().getFullYear();

/**
 * The official Hack Club "torn flag" year banner — see hackclub.com/banner.
 * Same asset (`assets.hackclub.com/banners/{year}.svg`), link target, and
 * top-left placement as the `@hackclub/banner` npm package; reimplemented
 * directly rather than installed, since that package currently targets React
 * 19 as a peer dependency and this app is on React 18.
 */
export function HackClubBanner() {
  return (
    <a className="hc-banner" href="https://hackclub.com/" target="_blank" rel="noopener noreferrer" aria-label="Hack Club">
      <img src={`https://assets.hackclub.com/banners/${CURRENT_YEAR}.svg`} alt="Hack Club" width={534} height={207} />
    </a>
  );
}
