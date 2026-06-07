/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // ── New Premium Palette ──────────────────────────────
        'w-rose':    '#E11D48',   // Rosé vibrante — primária
        'w-rose-lt': '#FFF1F5',   // Rosé claro — backgrounds ativos
        'w-rose-md': '#FCE4EA',   // Rosé médio — hover states
        'w-gold':    '#F59E0B',   // Dourado moderno
        'w-gold-lt': '#FFFBEB',   // Dourado claro
        'w-green':   '#22C55E',   // Verde sucesso
        'w-green-lt':'#F0FDF4',   // Verde claro
        'w-red':     '#EF4444',   // Vermelho alerta
        'w-red-lt':  '#FEF2F2',   // Vermelho claro
        'w-surface': '#FBFAF8',   // Fundo principal
        'w-card':    '#FFFFFF',   // Cards / modais
        'w-border':  '#F0EBE6',   // Borda suave
        'w-border-md':'#E5DDD8',  // Borda média
        'w-text':    '#18181B',   // Texto principal
        'w-muted':   '#71717A',   // Texto secundário
        'w-faint':   '#A1A1AA',   // Texto levíssimo

        // ── Compat aliases (manter pages antigas funcionando) ─
        'event-rose':      '#E11D48',
        'event-champagne': '#FCE4EA',
        'event-offwhite':  '#FBFAF8',
        'event-white':     '#FFFFFF',
        'event-text':      '#18181B',
        'event-border':    '#F0EBE6',
        'event-success':   '#22C55E',
        'event-pending':   '#F59E0B',
        'event-danger':    '#EF4444',
        rosew: {
          50:  '#FBFAF8',
          100: '#FFF1F5',
          200: '#FCE4EA',
          300: '#F9C8D4',
          400: '#F08098',
          500: '#E11D48',
        },
        champagne: '#FCE4EA',
        goldsoft:  '#F59E0B',
        olivew:    '#22C55E',
        ink:       '#18181B',
      },
      boxShadow: {
        'soft':  '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
        'card':  '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        'float': '0 4px 16px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.08)',
        'glass': '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        'rose':  '0 4px 16px rgba(225,29,72,0.25)',
      },
      borderRadius: {
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      backdropBlur: {
        xs: '4px',
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-up':  'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
        'scale-in':  'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)',
        'shimmer':   'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 },                   to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.96)' },      to: { opacity: 1, transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};
