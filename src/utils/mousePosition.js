import { readable } from 'svelte/store';

export const mousePosition = readable({ x: 0, y: 0 }, (set) => {
  const move = (event) => {set({ x: event.clientX, y: event.clientY, })};
  document.body.addEventListener("mousemove", move);
  return () => {
    document.body.removeEventListener("mousemove", move);
  };
});
