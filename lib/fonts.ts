import { Anek_Devanagari, Anek_Gurmukhi, Anek_Latin, IBM_Plex_Mono, Martel } from "next/font/google";

export const martel = Martel({
  weight: ["400", "700", "800"],
  subsets: ["latin", "devanagari"],
  variable: "--font-martel",
  display: "swap",
});

export const anekLatin = Anek_Latin({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-anek-latin",
  display: "swap",
});

export const anekDeva = Anek_Devanagari({
  weight: ["400", "500", "600", "700"],
  subsets: ["devanagari", "latin"],
  variable: "--font-anek-deva",
  display: "swap",
});

export const anekGuru = Anek_Gurmukhi({
  weight: ["400", "500", "600", "700"],
  subsets: ["gurmukhi", "latin"],
  variable: "--font-anek-guru",
  display: "swap",
});

export const plex = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const fontVariables = [martel, anekLatin, anekDeva, anekGuru, plex].map((font) => font.variable).join(" ");
