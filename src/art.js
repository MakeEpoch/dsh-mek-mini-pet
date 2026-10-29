// Original vector artwork; all styling stays inside the component's shadow root.
export const petArt = `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="ground" cx="100" cy="180" rx="47" ry="8" fill="#264b3e" opacity=".10"/>
  <g class="creature" stroke="#344b43" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
    <path class="ear left-ear" d="M64 76C39 50 46 18 60 22C74 25 79 52 80 72" fill="var(--pet-fill)"/>
    <path class="ear right-ear" d="M116 71C116 41 131 16 142 26C151 35 140 66 133 79" fill="var(--pet-fill)"/>
    <path d="M59 36L67 58M135 38L128 60" stroke="var(--pet-inner)" stroke-width="8"/>
    <path class="left-foot" d="M73 156C56 157 51 169 61 173C71 177 88 170 89 163" fill="var(--pet-fill)"/>
    <path class="right-foot" d="M112 163C116 174 135 178 140 170C145 162 131 155 125 157" fill="var(--pet-fill)"/>
    <path d="M56 86C60 68 77 64 91 67C92 58 105 56 109 67C136 62 153 80 154 105L158 132C159 157 135 168 102 168C67 168 44 155 46 131L50 107" fill="var(--pet-fill)"/>
    <path d="M78 142C78 122 122 122 125 143C129 160 77 164 78 142Z" fill="#fffdf5" stroke="none" opacity=".75"/>
    <path class="arm left-arm" d="M51 118C35 109 31 122 43 133L56 138" fill="var(--pet-fill)"/>
    <path class="arm right-arm" d="M150 118C166 108 170 122 157 134L146 139" fill="var(--pet-fill)"/>
    <g class="face">
      <g class="eyes" fill="#344b43" stroke="none"><ellipse cx="78" cy="105" rx="4.5" ry="6"/><ellipse cx="123" cy="105" rx="4.5" ry="6"/></g>
      <g class="sleep-eyes" stroke-width="3"><path d="M72 108Q78 112 84 108M117 108Q123 112 129 108"/></g>
      <ellipse cx="66" cy="119" rx="9" ry="5" fill="#efa2a0" stroke="none" opacity=".65"/>
      <ellipse cx="136" cy="119" rx="9" ry="5" fill="#efa2a0" stroke="none" opacity=".65"/>
      <path class="mouth" d="M93 118Q100 127 108 118" stroke-width="3"/>
    </g>
    <path class="leaf" d="M99 144C88 134 89 129 99 134C100 123 115 125 109 137Z" fill="#5a9678" stroke="none"/>
  </g>
  <text class="effect" x="153" y="66" fill="#719c85" font-size="26" font-family="sans-serif" stroke="none">✦</text>
</svg>`;
