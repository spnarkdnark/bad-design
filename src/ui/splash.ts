/**
 * The opening splash is a drawing: `assets/splash/logo.bubbles.json`, drawn live in the
 * middle of the window. Clicking one of its elements opens `assets/splash/tutorial.bubbles.json`
 * (the logo plus notes about the app's features) at exactly the same place on screen, so
 * the logo stays put while the notes and the app fade in around it.
 *
 * Revising them: edit the logo in the app and Save As over `logo.bubbles.json`; build the
 * tutorial from that same file (so the logo keeps its coordinates) and save it over
 * `tutorial.bubbles.json`. Nothing else needs changing.
 */
import logoRaw from '../assets/splash/logo.bubbles.json?raw';
import tutorialRaw from '../assets/splash/tutorial.bubbles.json?raw';
import type { Bounds, Project } from '../model/types';
import { pxPerFt } from '../model/units';
import { parseProject } from '../io/projectFile';
import type { View } from '../store/uiStore';

let logo: Project | null = null;
/** The splash drawing (parsed once). */
export function splashLogo(): Project {
  return (logo ??= parseProject(logoRaw));
}

/** A fresh copy of the tutorial drawing. */
export function tutorialProject(): Project {
  return parseProject(tutorialRaw);
}

/** Largest on-screen size of the logo, px (about what the old logo image measured). */
const MAX_WIDTH_PX = 710;

/**
 * Where the logo sits: centered a little above the middle of the window, at most
 * MAX_WIDTH_PX wide (and narrower on small windows). Pan is window-relative.
 */
export function splashView(b: Bounds, scale: Project['settings']['scale'], win: { w: number; h: number }): View {
  const k = Math.min(Math.min(MAX_WIDTH_PX, win.w * 0.68) / (b.maxX - b.minX), (win.h * 0.55) / (b.maxY - b.minY));
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { zoom: k / pxPerFt(scale, 1), panX: win.w / 2 - cx * k, panY: win.h * 0.46 - cy * k };
}
