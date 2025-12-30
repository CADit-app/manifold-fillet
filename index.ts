/**
 * Brute-force fillet library for Manifold meshes.
 * 
 * Usage:
 * ```typescript
 * import ManifoldModule from 'manifold-3d';
 * import { createFillet } from '@cadit-app/brute-force-fillet';
 * 
 * const manifold = await ManifoldModule();
 * const { fillet } = createFillet(manifold);
 * 
 * const box = manifold.Manifold.cube([10, 10, 10], true);
 * const rounded = fillet(box, { radius: 1, selection: { type: 'angle', minAngle: 80 } });
 * ```
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
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

export type { ManifoldToplevel } from './context';
export type { FilletOptions } from './fillet';
export type { 
  MeshEdge, 
  EdgeSelection, 
  PointEdgeSelection, 
  AngleEdgeSelection 
} from './edgeSelection';

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
 * Creates a fillet API bound to a specific Manifold instance.
 * 
 * @param manifold - The initialized Manifold WASM module (from `await ManifoldModule()`)
 * @returns An object containing all fillet functions bound to the manifold instance
 * 
 * @example
 * ```typescript
 * import ManifoldModule from 'manifold-3d';
 * import { createFillet } from '@cadit-app/brute-force-fillet';
 * 
 * const manifold = await ManifoldModule();
 * const { fillet } = createFillet(manifold);
 * 
 * const box = manifold.Manifold.cube([10, 10, 10], true);
 * const rounded = fillet(box, { 
 *   radius: 1, 
 *   selection: { type: 'angle', minAngle: 80 } 
 * });
 * ```
 */
export function createFillet(manifold: ManifoldToplevel): FilletAPI {
  return {
    fillet: (mf: Manifold, options: FilletOptions) => 
      filletWithManifold(manifold, mf, options),
    
    pipeAlongPath: (path, radius, segments) => 
      pipeAlongPath(manifold, path, radius, segments),
    
    pipeAlongPathExtended: (path, radius, extensionFactor, segments) => 
      pipeAlongPathExtended(manifold, path, radius, extensionFactor, segments),
    
    buildWedge: (edge, distance, inflate) => 
      buildWedge(manifold, edge, distance, inflate),
    
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