POMODORO — FOCUS TIMER (OffScript Focus)
======================

How to run
----------

No install required. Simply browse to index.html with any modern browser.

If you wish to have a proper local server:

  python3 -m http.server 3000

Then go to http://localhost:3000

No additional installation required: Python comes pre-installed in macOS and most Linux.
Otherwise, if you have Node:

  npx serve .


Features
--------

If you need a break, you can set up the focus / break cycle to 25 min / 5 min (configurable, set via settings)
- Start, pause, resume, reset, skip controls
- Circular progress that will run down as time passes
- Audible chime when session completes - Web Audio API (no audio files)
- Automatic focus <-> break transitions
- History stored on a calendar day and reset daily in localStorage
- Works on mobile (360px) and desktop (1440px+)
- Space: Start/Pause, Escape: Close Settings.


Files
-----

  index.html    Main app
  style.css     All styling
  data.json          Timer data, sounds, history
  README.txt    This file
  ANSWERS.docx  Assessment answers