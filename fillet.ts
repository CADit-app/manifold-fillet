/**
 * Fillet/Round operations for Manifold meshes.
 * 
 * Implements the "dirty nasty (but working)" CSG approach from:
 * https://github.com/elalish/manifold/discussions/1411
 * 
 * Algorithm:
 * 1. Create a tube (cylinder) tangent to the inner faces of the corner
 * 2. Create a wedge (prism) that covers the corner tip but fits inside the tube's "back" side
 * 3. Subtract tube from wedge → cutting tool (just the corner tip)
 * 4. Subtract cutting tool from original → rounded edge
 */

import type { Manifold } from 'manifold-3d';
import type { ManifoldStatic } from './index';
import { 
  EdgeSelection, 
  MeshEdge, 
  extractEdges, 
  selectEdges
} from './edgeSelection';

export interface FilletOptions {
  /** Fillet radius */
  radius: number;
  /** Edge selection criteria */
  selection: EdgeSelection;
  /** Number of segments for circular profiles (default: 16) */
  segments?: number;
}

/**
 * Apply fillet/round to selected edges of a Manifold.
 * 
 * @param Manifold - The Manifold class with static constructors
 * @param mf - The Manifold shape to fillet
 * @param options - Fillet options (radius, selection, segments)
 * @returns A new Manifold with filleted edges
 */
export function filletWithManifold(Manifold: ManifoldStatic, mf: Manifold, options: FilletOptions): Manifold {
  const { radius, selection, segments = 16 } = options;
  
  if (radius <= 0) {
    throw new Error('Fillet radius must be positive');
  }
  
  // Extract all edges from mesh
  const allEdges = extractEdges(mf);
  
  if (allEdges.length === 0) {
    console.warn('fillet: No edges found in mesh');
    return mf;
  }
  
  // Select edges based on criteria
  const selectedEdges = selectEdges(allEdges, selection);
  
  if (selectedEdges.length === 0) {
    console.warn('fillet: No edges matched selection criteria');
    return mf;
  }
  
  console.log('fillet: Found', selectedEdges.length, 'edges to fillet');
  
  let result = mf;
  
  // Process convex edges
  // We can union all tools for a single subtraction if they don't overlap
  const cuttingTools: Manifold[] = [];

  for (const edge of selectedEdges) {
    // Only handling convex edges (standard fillets)
    // Filter out flat edges (dihedral angle approx 0) which are just triangulation artifacts
    if (edge.dihedralAngle > 5 && edge.dihedralAngle < 175) {
      const tool = createFilletCuttingTool(Manifold, edge, radius, segments);
      if (tool && tool.volume() > 1e-9) {
        cuttingTools.push(tool);
      }
    }
  }
  
  // Subtract tools sequentially to avoid memory spikes from large unions
  if (cuttingTools.length > 0) {
    // Sort by volume or position might help stability, but just sequential is fine for now
    console.log(`fillet: Subtracting ${cuttingTools.length} tools sequentially`);
    for (const tool of cuttingTools) {
      result = result.subtract(tool);
    }
  }
  
  return result;
}

/**
 * Create a fillet cutting tool using the wedge-minus-tube approach.
 */
function createFilletCuttingTool(
  Manifold: ManifoldStatic,
  edge: MeshEdge,
  radius: number,
  segments: number
): Manifold | null {
  
  // Edge endpoints
  const [x0, y0, z0] = edge.p0;
  const [x1, y1, z1] = edge.p1;
  const ex = x1 - x0, ey = y1 - y0, ez = z1 - z0;
  const edgeLen = Math.sqrt(ex * ex + ey * ey + ez * ez);
  if (edgeLen < 1e-9) return null;
  const edgeDir: [number, number, number] = [ex / edgeLen, ey / edgeLen, ez / edgeLen];
  const [n0x, n0y, n0z] = edge.n0;
  const [n1x, n1y, n1z] = edge.n1;

  // 1. TUBE: Positioned INWARD (tangent to faces)
  // Center = Edge - radius*n0 - radius*n1 (for 90 degree edges)
  // Note: For non-90 degree, this approximation works for small fillets but
  // true bisector logic should be used. Using the sum offset for now as it handles 90 deg.
  const ext = radius * 0.1;
  const tubeStart: [number, number, number] = [
    x0 - n0x * radius - n1x * radius - edgeDir[0] * ext,
    y0 - n0y * radius - n1y * radius - edgeDir[1] * ext,
    z0 - n0z * radius - n1z * radius - edgeDir[2] * ext
  ];
  const tubeEnd: [number, number, number] = [
    x1 - n0x * radius - n1x * radius + edgeDir[0] * ext,
    y1 - n0y * radius - n1y * radius + edgeDir[1] * ext,
    z1 - n0z * radius - n1z * radius + edgeDir[2] * ext
  ];
  
  const sphere0 = Manifold.sphere(radius, segments).translate(tubeStart);
  const sphere1 = Manifold.sphere(radius, segments).translate(tubeEnd);
  const tube = Manifold.hull([sphere0, sphere1]);

  // 2. WEDGE: Triangular prism extending INWARD
  // CRITICAL: The wedge depth must be limited so it is completely contained
  // within the tube on the "back" side. If deeper than the tube, subtracting
  // the tube leaves "internal debris" which carves holes in the solid.
  // For 90 degree corners, radius*1.0 is safe (reaches tube center).
  const wedgeDepth = radius * 1.1; 
  
  const wedgePoints: [number, number, number][] = [];
  
  // At start
  const sX = x0 - edgeDir[0] * ext, sY = y0 - edgeDir[1] * ext, sZ = z0 - edgeDir[2] * ext;
  wedgePoints.push([sX, sY, sZ]); // Edge
  wedgePoints.push([sX - n0x * wedgeDepth, sY - n0y * wedgeDepth, sZ - n0z * wedgeDepth]);
  wedgePoints.push([sX - n1x * wedgeDepth, sY - n1y * wedgeDepth, sZ - n1z * wedgeDepth]);
  
  // At end
  const eX = x1 + edgeDir[0] * ext, eY = y1 + edgeDir[1] * ext, eZ = z1 + edgeDir[2] * ext;
  wedgePoints.push([eX, eY, eZ]); // Edge
  wedgePoints.push([eX - n0x * wedgeDepth, eY - n0y * wedgeDepth, eZ - n0z * wedgeDepth]);
  wedgePoints.push([eX - n1x * wedgeDepth, eY - n1y * wedgeDepth, eZ - n1z * wedgeDepth]);
  
  const wedge = Manifold.hull(wedgePoints);

  // 3. CUTTING TOOL: Wedge - Tube
  // Since wedge is small, wedge - tube leaves only the corner tip.
  return wedge.subtract(tube);
}

// Re-export types for convenience
export type { EdgeSelection, PointEdgeSelection, AngleEdgeSelection } from './edgeSelection';
