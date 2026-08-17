export default function PremiumWalletSvg({ className = "w-24 h-24" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="walletBodyGradient"
          x1="35"
          y1="38"
          x2="124"
          y2="129"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#B8F5D1" />
          <stop offset="45%" stopColor="#50D98E" />
          <stop offset="100%" stopColor="#07994A" />
        </linearGradient>

        <linearGradient
          id="walletFrontGradient"
          x1="52"
          y1="60"
          x2="135"
          y2="124"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#8DEDB9" />
          <stop offset="100%" stopColor="#05A84F" />
        </linearGradient>

        <linearGradient
          id="walletFlapGradient"
          x1="83"
          y1="42"
          x2="128"
          y2="84"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#DFFFF0" />
          <stop offset="100%" stopColor="#3FD67E" />
        </linearGradient>

        <radialGradient
          id="walletGlow"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(83 82) rotate(90) scale(78)"
        >
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        <filter
          id="walletShadow"
          x="18"
          y="18"
          width="130"
          height="130"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow
            dx="0"
            dy="14"
            stdDeviation="12"
            floodColor="#007A3D"
            floodOpacity="0.25"
          />
        </filter>

        <filter
          id="softInnerShadow"
          x="30"
          y="38"
          width="105"
          height="90"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="2"
            floodColor="#FFFFFF"
            floodOpacity="0.25"
          />
        </filter>
      </defs>

      {/* soft background glow */}
      <circle cx="80" cy="82" r="70" fill="url(#walletGlow)" />

      {/* rear cards */}
      <g opacity="0.85">
        <rect
          x="54"
          y="35"
          width="67"
          height="48"
          rx="10"
          transform="rotate(-15 54 35)"
          fill="url(#walletFlapGradient)"
        />
        <rect
          x="64"
          y="31"
          width="65"
          height="48"
          rx="10"
          transform="rotate(-8 64 31)"
          fill="#CFFFE3"
          opacity="0.82"
        />
      </g>

      {/* main wallet body */}
      <g filter="url(#walletShadow)">
        <rect
          x="32"
          y="55"
          width="100"
          height="76"
          rx="22"
          fill="url(#walletBodyGradient)"
        />

        {/* front pocket */}
        <path
          d="M50 77C50 70.373 55.373 65 62 65H122C128.627 65 134 70.373 134 77V113C134 119.627 128.627 125 122 125H62C55.373 125 50 119.627 50 113V77Z"
          fill="url(#walletFrontGradient)"
          filter="url(#softInnerShadow)"
        />

        {/* side clasp */}
        <path
          d="M112 84H137C143.075 84 148 88.925 148 95C148 101.075 143.075 106 137 106H112C105.925 106 101 101.075 101 95C101 88.925 105.925 84 112 84Z"
          fill="#07994A"
        />

        <path
          d="M113 87H137C141.418 87 145 90.582 145 95C145 99.418 141.418 103 137 103H113C108.582 103 105 99.418 105 95C105 90.582 108.582 87 113 87Z"
          fill="#20C769"
        />

        <circle cx="133" cy="95" r="6" fill="#EFFFF5" />

        {/* shine */}
        <path
          d="M46 66C50 60 57 59 68 59H105C116 59 124 61 128 68C119 65 106 64 91 64H67C57 64 50 65 46 66Z"
          fill="white"
          opacity="0.18"
        />

        {/* subtle bottom shade */}
        <path
          d="M35 111C44 122 60 128 82 128H112C123 128 130 124 132 116V119C132 125.627 126.627 131 120 131H54C41.85 131 32 121.15 32 109V98C33 103 33.8 107 35 111Z"
          fill="#007A3D"
          opacity="0.18"
        />
      </g>
    </svg>
  );
}
