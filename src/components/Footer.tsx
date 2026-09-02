export function Footer() {
  return (
    <footer className="foot">
      <p style={{ margin: "0 0 4px" }}>
        Parsing happens entirely in your browser — a loaded file, pasted JSON, or fetched URL is never sent anywhere. Active
        time is estimated by summing gaps between heartbeats no longer than the idle threshold, the same approach
        WakaTime-style trackers use.
      </p>
      <p style={{ margin: 0 }}>
        An unofficial, fan-made tool styled after{" "}
        <a href="https://hackclub.com" target="_blank" rel="noreferrer">
          Hack Club
        </a>
        's brand — not affiliated with or endorsed by Hack Club.
      </p>
    </footer>
  );
}
