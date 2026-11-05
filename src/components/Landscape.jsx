import React from "react";

// Drawn golf landscape used behind the hero until real photos are added.
// Drop a photo at public/images/hero.jpg and the Hero shows it instead.
export default function Landscape({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1b3e" />
          <stop offset=".55" stopColor="#3b5f8a" />
          <stop offset="1" stopColor="#f2c48d" />
        </linearGradient>
        <radialGradient id="ls-sun" cx="1180" cy="330" r="220" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffe7b0" stopOpacity=".95" />
          <stop offset=".25" stopColor="#ffd38a" stopOpacity=".5" />
          <stop offset="1" stopColor="#ffd38a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ls-fair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f9a4e" />
          <stop offset="1" stopColor="#2d6b35" />
        </linearGradient>
        <linearGradient id="ls-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f7a3a" />
          <stop offset="1" stopColor="#173f22" />
        </linearGradient>
        <pattern id="ls-stripes" width="80" height="700" patternUnits="userSpaceOnUse" patternTransform="skewX(-28)">
          <rect width="40" height="700" fill="#fff" opacity=".05" />
        </pattern>
      </defs>
      <rect width="1600" height="700" fill="url(#ls-sky)" />
      <circle cx="1180" cy="330" r="220" fill="url(#ls-sun)" />
      <circle cx="1180" cy="352" r="34" fill="#fff1cf" opacity=".9" />
      {/* distant tree line */}
      <path fill="#22402f" d="M0 380 C60 350 90 365 130 352 C170 338 200 360 250 348 C300 334 330 356 380 346 C430 336 470 352 520 340 C570 330 610 350 660 344 C720 338 760 356 820 348 C880 340 920 330 980 342 C1040 352 1080 336 1140 346 C1200 356 1250 338 1310 344 C1370 350 1420 334 1480 342 C1530 348 1570 340 1600 344 L1600 420 L0 420Z" />
      <path fill="#1b3527" opacity=".9" d="M0 398 C80 380 140 392 220 384 C320 374 400 394 500 386 C620 376 700 392 820 384 C940 376 1040 392 1160 386 C1280 380 1380 392 1480 384 C1540 380 1580 384 1600 386 L1600 430 L0 430Z" />
      {/* fairway */}
      <path fill="url(#ls-fair)" d="M0 430 C200 405 420 412 640 420 C860 428 1080 404 1300 410 C1440 414 1540 420 1600 418 L1600 700 L0 700Z" />
      <path fill="url(#ls-stripes)" d="M0 430 C200 405 420 412 640 420 C860 428 1080 404 1300 410 C1440 414 1540 420 1600 418 L1600 700 L0 700Z" />
      {/* green + bunker + flag */}
      <ellipse cx="1360" cy="470" rx="190" ry="34" fill="#6cbf5a" />
      <ellipse cx="1360" cy="468" rx="150" ry="22" fill="#7fcc68" />
      <path fill="#ecd9a8" d="M1130 500 C1160 482 1240 480 1270 494 C1295 506 1260 520 1210 522 C1160 524 1110 516 1130 500Z" />
      <line x1="1400" y1="470" x2="1400" y2="372" stroke="#f4f4f4" strokeWidth="3.5" />
      <path d="M1400 374 L1446 388 L1400 402Z" fill="#e0393e" />
      <ellipse cx="1400" cy="471" rx="8" ry="2.5" fill="#1d3a22" />
      {/* foreground rough */}
      <path fill="url(#ls-front)" d="M0 560 C220 520 420 548 640 556 C880 566 1060 530 1280 544 C1420 552 1520 566 1600 560 L1600 700 L0 700Z" />
      <path fill="#14301b" opacity=".7" d="M0 640 C260 610 520 636 800 640 C1080 644 1340 618 1600 630 L1600 700 L0 700Z" />
    </svg>
  );
}
