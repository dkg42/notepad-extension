// Vite ?raw query — imports any file as a raw string
declare module '*?raw' {
  const content: string;
  export default content;
}
