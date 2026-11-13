import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      borderRadius: {
        xl: '0.875rem',
        lg: 'var(--radius, 0.75rem)',
        md: 'calc(var(--radius, 0.75rem) - 2px)',
        sm: 'calc(var(--radius, 0.75rem) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        // Business Intelligence & Executive Design System Tokens
        bi: {
          header: '#171827',
          bg: '#F1F2F7',
          card: '#FFFFFF',
          border: '#E5E7EF',
          secondary: '#59658F',
          highlight: '#B5D7E8',
          text: '#55596A',
          darkBg: '#0F101A',
          darkCard: '#171827',
          darkBorder: '#232538',
        },
        // Semantic shadcn & design tokens mapped to CSS variables
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        brand: 'hsl(var(--brand))',
        'brand-light': 'hsl(var(--brand-light))',
        'brand-mid': 'hsl(var(--brand-mid))',
        chart: {
          '1': 'hsl(var(--chart-1, 221 83% 53%))',
          '2': 'hsl(var(--chart-2, 226 70% 55%))',
          '3': 'hsl(var(--chart-3, 213 94% 68%))',
          '4': 'hsl(var(--chart-4, 228 23% 45%))',
          '5': 'hsl(var(--chart-5, 200 45% 80%))',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(23, 24, 39, 0.05), 0 1px 2px -1px rgba(23, 24, 39, 0.05)',
        'card-hover': '0 4px 12px 0 rgba(23, 24, 39, 0.08), 0 2px 4px -2px rgba(23, 24, 39, 0.04)',
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        executive: '0 8px 24px -4px rgba(23, 24, 39, 0.12)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
