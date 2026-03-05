import { writable } from 'svelte/store';

function createThemeStore() {
	const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
	const prefersDark = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
	
	const initialDark = storedTheme === 'dark' || (!storedTheme && prefersDark);
	
	const { subscribe, set, update } = writable<boolean>(initialDark);

	return {
		subscribe,
		toggle: () => {
			update(isDark => {
				const newValue = !isDark;
				if (typeof window !== 'undefined') {
					localStorage.setItem('theme', newValue ? 'dark' : 'light');
					if (newValue) {
						document.documentElement.classList.add('dark');
					} else {
						document.documentElement.classList.remove('dark');
					}
				}
				return newValue;
			});
		},
		init: () => {
			if (typeof window !== 'undefined') {
				const stored = localStorage.getItem('theme');
				const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				const isDark = stored === 'dark' || (!stored && prefersDark);
				
				if (isDark) {
					document.documentElement.classList.add('dark');
				} else {
					document.documentElement.classList.remove('dark');
				}
				set(isDark);
			}
		},
		set: (value: boolean) => {
			if (typeof window !== 'undefined') {
				localStorage.setItem('theme', value ? 'dark' : 'light');
				if (value) {
					document.documentElement.classList.add('dark');
				} else {
					document.documentElement.classList.remove('dark');
				}
			}
			set(value);
		}
	};
}

export const themeStore = createThemeStore();
