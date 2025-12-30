/**
 * Brute-force fillet library for Manifold meshes.
 * 
 * Usage:
 * ```typescript
 * // Option 1: With full Manifold module
 * import ManifoldModule from 'manifold-3d';
 * import { createFillet } from '@cadit-app/brute-force-fillet';
 * 
 * const wasm = await ManifoldModule();
 * const { fillet } = createFillet(wasm.Manifold);
 * 
 * // Option 2: With Manifold class directly (e.g., manifoldcad.org)
 * import { Manifold } from 'manifold-3d/manifoldCAD';
 * import { createFillet } from '@cadit-app/brute-force-fillet';
 * 
 * const { fillet } = createFillet(Manifold);
 * ```
 */

import type { Manifold } from 'manifold-3d';
import { filletWithManifold, FilletOptions } from './fillet';
import { pipeAlongPath, pipeAlongPathExtended } from './pipeAlongPath';
import { buildWedge } from './wedgeBuilder';
import { 
  extractEdges, 
  selectEdges, 
  edgeDirection, 
  edgeInwardDirection, 
  sampleEdge,
  MeshEdge,
  EdgeSelection,
  PointEdgeSelection,
  AngleEdgeSelection
} from './edgeSelection';

export type { FilletOptions } from './fillet';
export type { 
  MeshEdge, 
  EdgeSelection, 
  PointEdgeSelection, 
  AngleEdgeSelection 
} from './edgeSelection';

/**
 * The Manifold class type with static constructors.
 * This is what you get from `manifold.Manifold` or `import { Manifold } from 'manifold-3d/manifoldCAD'`.
 */
export interface ManifoldStatic {
  cube: (size: [number, number, number] | number, center?: boolean) => Manifold;
  sphere: (radius: number, circularSegments?: number) => Manifold;
  cylinder: (height: number, radiusLow: number, radiusHigh?: number, circularSegments?: number, center?: boolean) => Manifold;
  hull: (manifolds: Manifold[] | [number, number, number][]) => Manifold;
  union: (manifolds: Manifold[]) => Manifold;
  intersection: (manifolds: Manifold[]) => Manifold;
  difference: (manifolds: Manifold[]) => Manifold;
}

/**
 * The fillet API returned by createFillet.
 */
export interface FilletAPI {
  /**
   * Apply fillet/round to selected edges of a Manifold.
   * 
   * @param mf - The Manifold shape to fillet
   * @param options - Fillet options (radius, selection, segments)
   * @returns A new Manifold with filleted edges
   */
  fillet: (mf: Manifold, options: FilletOptions) => Manifold;
  
  /**
   * Creates a tube along a polyline path using convex hulls of spheres.
   */
  pipeAlongPath: (
    path: [number, number, number][],
    radius: number,
    segments?: number
  ) => Manifold;
  
  /**
   * Creates a tube along an edge path with extended endpoints.
   */
  pipeAlongPathExtended: (
    path: [number, number, number][],
    radius: number,
    extensionFactor?: number,
    segments?: number
  ) => Manifold;
  
  /**
   * Creates a wedge solid along an edge.
   */
  buildWedge: (
    edge: MeshEdge,
    distance: number,
    inflate?: number
  ) => Manifold;
  
  /**
   * Extract edges from a Manifold mesh.
   */
  extractEdges: typeof extractEdges;
  
  /**
   * Select edges based on criteria.
   */
  selectEdges: typeof selectEdges;
  
  /**
   * Compute edge direction (normalized).
   */
  edgeDirection: typeof edgeDirection;
  
  /**
   * Compute inward direction perpendicular to edge.
   */
  edgeInwardDirection: typeof edgeInwardDirection;
  
  /**
   * Sample points along an edge.
   */
  sampleEdge: typeof sampleEdge;
}

/**
 * Creates a fillet API bound to a specific Manifold class.
 * 
 * @param Manifold - The Manifold class with static constructors (cube, sphere, hull, etc.)
 * @returns An object containing all fillet functions bound to the Manifold class
 * 
 * @example
 * ```typescript
 * // On manifoldcad.org:
 * import { Manifold } from 'manifold-3d/manifoldCAD';
 * import { createFillet } from '@cadit-app/brute-force-fillet';
 * 
 * const { fillet } = createFillet(Manifold);
 * const box = Manifold.cube([10, 10, 10], true);
 * const rounded = fillet(box, { radius: 1, selection: { type: 'angle', minAngle: 80 } });
 * 
 * // In Node.js:
 * import ManifoldModule from 'manifold-3d';
 * const wasm = await ManifoldModule();
 * const { fillet } = createFillet(wasm.Manifold);
 * ```
 */
export function createFillet(Manifold: ManifoldStatic): FilletAPI {
  return {
    fillet: (mf: Manifold, options: FilletOptions) => 
      filletWithManifold(Manifold, mf, options),
    
    pipeAlongPath: (path, radius, segments) => 
      pipeAlongPath(Manifold, path, radius, segments),
    
    pipeAlongPathExtended: (path, radius, extensionFactor, segments) => 
      pipeAlongPathExtended(Manifold, path, radius, extensionFactor, segments),
    
    buildWedge: (edge, distance, inflate) => 
      buildWedge(Manifold, edge, distance, inflate),
    
    // These don't need manifold instance
    extractEdges,
    selectEdges,
    edgeDirection,
    edgeInwardDirection,
    sampleEdge,
  };
}

// Re-export utility functions that don't need manifold instance
export { extractEdges, selectEdges, edgeDirection, edgeInwardDirection, sampleEdge };

// Export the raw function for advanced use cases
export { filletWithManifold } from './fillet';
export { pipeAlongPath, pipeAlongPathExtended } from './pipeAlongPath';
export { buildWedge } from './wedgeBuilder';

export { default } from './example'