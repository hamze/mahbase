/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx}"],
    theme: {
    	extend: {
    		opacity: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [i, `${i / 100}`])),
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		colors: {
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			success: {
    				DEFAULT: 'hsl(var(--success))',
    				foreground: 'hsl(var(--success-foreground))'
    			},
    			warning: {
    				DEFAULT: 'hsl(var(--warning))',
    				foreground: 'hsl(var(--warning-foreground))'
    			},
    			info: {
    				DEFAULT: 'hsl(var(--info))',
    				foreground: 'hsl(var(--info-foreground))'
    			},
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			sidebar: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))',
    				primary: 'hsl(var(--primary))',
    				'primary-foreground': 'hsl(var(--primary-foreground))',
    				accent: 'hsl(var(--accent))',
    				'accent-foreground': 'hsl(var(--accent-foreground))',
    				border: 'hsl(var(--border))',
    				ring: 'hsl(var(--ring))'
    			}
    		},
    		fontFamily: {
    			heading: ['var(--font-heading)'],
    			body: ['var(--font-body)'],
    			display: ['var(--font-display)'],
    			mono: ['var(--font-mono)']
    		},
    		keyframes: {
    			'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
    			'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
    			'slide-in-right': { from: { transform: 'translateX(100%)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
    			'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
    			'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } }
    		},
    		animation: {
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out',
    			'slide-in-right': 'slide-in-right 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
    			'fade-in': 'fade-in 0.3s ease-out',
    			'fade-up': 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
    		}
    	}
    },
    plugins: [require("tailwindcss-animate")],
}
