export const ACCENTS = {
  teal: ['#5eead4', '#38bdf8'],
  blue: ['#60a5fa', '#818cf8'],
  purple: ['#c084fc', '#818cf8'],
  orange: ['#fdba74', '#fb7185'],
  pink: ['#f9a8d4', '#c084fc'],
};

export function applyAccent(name) {
  const [a, b] = ACCENTS[name] || ACCENTS.teal;
  document.documentElement.style.setProperty('--brand', a);
  document.documentElement.style.setProperty('--brand-2', b);
}
