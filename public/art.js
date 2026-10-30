// Original line-art illustrations and the live chamber seating chart.
window.Art = (() => {
  const NAVY = '#1d2b4d', GOLD = '#b8892b', SOFT = '#c9d1e2';
  const wrap = (bg, inner, vb = '0 0 160 80') => ({ bg, svg: `<svg viewBox="${vb}" fill="none" stroke="${NAVY}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>` });

  // Seat chart: seats laid out in concentric arcs, filled left-to-right by party.
  function hemicycle(seats, { width = 560, rows = null } = {}) {
    const n = seats.length;
    if (!n) return '';
    const R = width / 2 - 8, r0 = R * 0.38;
    const nRows = rows || Math.max(3, Math.round(Math.sqrt(n / 4.5)));
    const radii = Array.from({ length: nRows }, (_, i) => r0 + (R - r0) * (i / (nRows - 1 || 1)));
    const total = radii.reduce((a, b) => a + b, 0);
    const perRow = radii.map(r => Math.round(n * r / total));
    perRow[perRow.length - 1] += n - perRow.reduce((a, b) => a + b, 0);
    const pts = [];
    radii.forEach((r, i) => {
      const k = perRow[i];
      for (let j = 0; j < k; j++) {
        const a = Math.PI - (k === 1 ? Math.PI / 2 : (Math.PI * j) / (k - 1));
        pts.push({ x: width / 2 + r * Math.cos(a), y: R + 8 - r * Math.sin(a), a });
      }
    });
    pts.sort((p, q) => q.a - p.a);
    const dotR = Math.max(3, Math.min(9, (R - r0) / nRows * 0.36));
    const color = { D: '#2f6fd0', R: '#cf3f2e', I: '#7a7f87', V: '#d8d1c2' };
    const dots = pts.map((p, i) => {
      const s = seats[i];
      const stroke = s.player ? `stroke="${GOLD}" stroke-width="2.2"` : '';
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${dotR.toFixed(1)}" fill="${color[s.party] || color.V}" ${stroke}><title>${s.label || ''}</title></circle>`;
    }).join('');
    return `<svg viewBox="0 0 ${width} ${(R + 12 + dotR).toFixed(0)}" role="img" aria-label="Seating chart">${dots}</svg>`;
  }

  const icons = {
    rally: wrap('#eaf1f8', `<path d="M30 70 V46 M30 46 l12-8 v24 l-12-8"/><path d="M42 42 q10 8 0 16"/><circle cx="80" cy="34" r="8"/><path d="M80 42 v20 M70 50 h20 M74 76 l6-14 6 14"/><g stroke="${GOLD}"><circle cx="118" cy="60" r="5"/><circle cx="134" cy="62" r="5"/><path d="M110 76 q8-10 16 0 M126 78 q8-10 16 0"/></g>`),
    tv_ad: wrap('#f3eee2', `<rect x="45" y="18" width="70" height="46" rx="5"/><path d="M68 64 l-8 12 M92 64 l8 12 M58 76 h44"/><path d="M60 50 l10-14 10 8 12-16 8 6" stroke="${GOLD}"/>`),
    targeted_ad: wrap('#eef5ee', `<circle cx="80" cy="42" r="26"/><circle cx="80" cy="42" r="16"/><circle cx="80" cy="42" r="5" fill="${GOLD}" stroke="${GOLD}"/><path d="M118 14 l-34 26 M118 14 v10 M118 14 h-10"/>`),
    canvass: wrap('#eaf1f8', `<path d="M40 70 V36 l22-16 22 16 v34 z"/><rect x="55" y="50" width="14" height="20"/><circle cx="110" cy="38" r="7"/><path d="M110 45 v18 M110 63 l-7 13 M110 63 l7 13 M110 52 l-12 4"/><rect x="92" y="52" width="10" height="12" stroke="${GOLD}"/>`),
    attack_ad: wrap('#fbeceb', `<rect x="40" y="16" width="80" height="50" rx="4"/><path d="M60 30 l40 24 M100 30 l-40 24" stroke="#cf3f2e"/><path d="M70 76 h20"/>`),
    poll: wrap('#f3eee2', `<path d="M40 70 h80"/><rect x="50" y="44" width="12" height="26"/><rect x="72" y="28" width="12" height="42" stroke="${GOLD}"/><rect x="94" y="52" width="12" height="18"/><path d="M48 22 h22"/>`),
    fundraiser: wrap('#eef5ee', `<rect x="46" y="22" width="68" height="40" rx="4"/><circle cx="80" cy="42" r="10"/><path d="M80 36 v12 M77 39 q3-3 6 0 M77 45 q3 3 6 0" stroke="${GOLD}"/><path d="M56 70 h48"/>`),
    dark_money: wrap('#ecebf1', `<path d="M50 30 h60 l-6 40 h-48 z"/><path d="M62 30 q18-18 36 0"/><path d="M70 50 h20" stroke="${GOLD}"/><path d="M40 18 l80 56" stroke="#7a7f87" stroke-dasharray="4 5"/>`),
    town_hall: wrap('#eaf1f8', `<path d="M36 34 l44-18 44 18"/><path d="M42 34 h76 M48 34 v34 M64 34 v34 M96 34 v34 M112 34 v34 M40 70 h80"/><circle cx="80" cy="52" r="6" stroke="${GOLD}"/>`),
    press_conference: wrap('#f3eee2', `<rect x="62" y="44" width="36" height="30" rx="3"/><path d="M80 44 v-8 M72 30 l8 6 8-6"/><circle cx="48" cy="24" r="6" stroke="${GOLD}"/><circle cx="112" cy="24" r="6" stroke="${GOLD}"/><path d="M54 26 l14 10 M106 26 l-14 10"/>`),
    oppo_research: wrap('#ecebf1', `<rect x="42" y="18" width="46" height="56" rx="3"/><path d="M52 32 h26 M52 42 h26 M52 52 h16"/><circle cx="102" cy="48" r="14" stroke="${GOLD}"/><path d="M112 58 l14 14" stroke="${GOLD}"/>`),
    leak: wrap('#fbeceb', `<rect x="44" y="22" width="56" height="44" rx="3"/><path d="M54 34 h36 M54 44 h36 M54 54 h20"/><path d="M104 30 q14 10 0 20 q14 10 0 20" stroke="#cf3f2e"/>`),
    department_initiative: wrap('#eef5ee', `<path d="M40 70 h80 M46 70 V40 h68 v30 M56 40 v30 M70 40 v30 M90 40 v30 M104 40 v30"/><path d="M42 40 l38-20 38 20"/><path d="M80 12 v8" stroke="${GOLD}"/>`),
    investigate: wrap('#ecebf1', `<path d="M60 18 h40 l8 10 v46 h-56 v-46 z"/><path d="M66 40 h28 M66 50 h28 M66 60 h16"/><path d="M118 20 l-8 8" stroke="${GOLD}"/><circle cx="80" cy="28" r="4" fill="${GOLD}" stroke="${GOLD}"/>`),
  };

  const capitol = `<svg viewBox="0 0 400 150" fill="none" stroke="${NAVY}" stroke-width="2.2" stroke-linejoin="round">
    <path d="M200 10 v14"/><circle cx="200" cy="8" r="3" fill="${GOLD}" stroke="${GOLD}"/>
    <path d="M168 62 q32-46 64 0"/><path d="M160 62 h80 M164 62 v18 M236 62 v18"/>
    <path d="M150 80 h100 M156 80 v42 M244 80 v42"/>${[170, 185, 200, 215, 230].map(x => `<path d="M${x} 86 v36"/>`).join('')}
    <path d="M40 100 h110 M250 100 h110 M46 100 v22 M354 100 v22"/>${[60, 80, 100, 120, 280, 300, 320, 340].map(x => `<path d="M${x} 104 v18"/>`).join('')}
    <path d="M20 122 h360 M10 134 h380" stroke="${SOFT}"/></svg>`;

  const mansion = `<svg viewBox="0 0 400 150" fill="none" stroke="${NAVY}" stroke-width="2.2" stroke-linejoin="round">
    <path d="M140 54 l60-30 60 30 z"/><path d="M140 54 h120"/>${[150, 172, 194, 216, 238, 252].map(x => `<path d="M${x} 58 v58"/>`).join('')}
    <path d="M60 64 h80 M260 64 h80 M60 64 v52 M340 64 v52"/>${[80, 100, 120, 280, 300, 320].map(x => `<rect x="${x - 6}" y="76" width="12" height="16"/>`).join('')}
    <path d="M196 8 v16"/><path d="M196 8 h14 l-3 4 3 4 h-14" stroke="${GOLD}"/>
    <path d="M40 116 h320 M30 130 h340" stroke="${SOFT}"/></svg>`;

  const court = `<svg viewBox="0 0 400 150" fill="none" stroke="${NAVY}" stroke-width="2.2" stroke-linejoin="round">
    <path d="M100 46 l100-34 100 34 z"/><path d="M96 46 h208 M100 54 h200"/>
    ${[114, 140, 166, 192, 218, 244, 270, 288].map(x => `<path d="M${x} 58 v52"/>`).join('')}
    <path d="M92 112 h216 M84 122 h232 M76 132 h248"/><circle cx="200" cy="34" r="5" stroke="${GOLD}"/></svg>`;

  const mark = `<svg viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="2"><path d="M16 3 v4"/><path d="M8 15 q8-12 16 0"/><path d="M6 15 h20 M8 15 v10 M24 15 v10 M12 17 v8 M16 17 v8 M20 17 v8 M4 27 h24"/><circle cx="16" cy="3" r="1.5" fill="#b8892b" stroke="#b8892b"/></svg>`;

  return { hemicycle, icons, capitol, mansion, court, mark };
})();
