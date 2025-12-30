/**
 * Generates a tube (pipe) along a path using hull of spheres.
 * This approach is reliable for curved paths and produces
 * smooth results with proper manifold topology.
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';

/**
 * Creates a tube along a polyline path using convex hulls of spheres.
 * 
 * @param manifold - The initialized Manifold WASM module
 * @param path Array of 3D points defining the path
 * @param radius Radius of the tube
 * @param segments Optional circular segments for sphere quality
 * @returns Manifold representing the tube
 */
export function pipeAlongPath(
  manifold: ManifoldToplevel,
  path: [number, number, number][],
  radius: number,
  segments?: number
): Manifold {
  
  if (path.length < 2) {
    throw new Error('Path must have at least 2 points');
  }
  
  // Create spheres at each path point
  const spheres: Manifold[] = [];
  
  for (const [x, y, z] of path) {
    const sphere = manifold.Manifold.sphere(radius, segments)
      .translate([x, y, z]);
    spheres.push(sphere);
  }
  
  // Hull adjacent spheres to create tube segments, then union
  const segments_: Manifold[] = [];
  
  for (let i = 0; i < path.length - 1; i++) {
    // Hull two adjacent spheres to form a tube segment
    const segment = manifold.Manifold.hull([spheres[i], spheres[i + 1]]);
    segments_.push(segment);
  }
  
  // Union all segments
  if (segments_.length === 1) {
    return segments_[0];
  }
  
  return manifold.Manifold.union(segments_);
}

/**
 * Creates a tube along an edge path that extends slightly beyond
 * the endpoints to ensure proper boolean overlap.
 * 
 * @param manifold - The initialized Manifold WASM module
 * @param path Path points
 * @param radius Tube radius  
 * @param extensionFactor How much to extend beyond endpoints (as fraction of radius)
 * @param segments Circular segments
 */
export function pipeAlongPathExtended(
  manifold: ManifoldToplevel,
  path: [number, number, number][],
  radius: number,
  extensionFactor: number = 0.1,
  segments?: number
): Manifold {
  if (path.length < 2) {
    throw new Error('Path must have at least 2 points');
  }
  
  // Compute extension vectors at start and end
  const start = path[0];
  const afterStart = path[1];
  const startDir = normalize([
    start[0] - afterStart[0],
    start[1] - afterStart[1],
    start[2] - afterStart[2]
  ]);
  
  const end = path[path.length - 1];
  const beforeEnd = path[path.length - 2];
  const endDir = normalize([
    end[0] - beforeEnd[0],
    end[1] - beforeEnd[1],
    end[2] - beforeEnd[2]
  ]);
  
  const ext = radius * extensionFactor;
  
  // Create extended path
  const extendedPath: [number, number, number][] = [
    [start[0] + startDir[0] * ext, start[1] + startDir[1] * ext, start[2] + startDir[2] * ext],
    ...path,
    [end[0] + endDir[0] * ext, end[1] + endDir[1] * ext, end[2] + endDir[2] * ext]
  ];
  
  return pipeAlongPath(manifold, extendedPath, radius, segments);
}

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-12) return [1, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}
