/**
 * Builds a wedge solid along an edge for fillet operations.
 * 
 * The wedge is formed by offsetting from the edge along the
 * adjacent face normals. This creates a triangular prism that,
 * when the tube is subtracted, leaves the fillet surface.
 */

import type { Manifold } from 'manifold-3d';
import type { ManifoldStatic } from './index';
import { MeshEdge, edgeDirection } from './edgeSelection';

/**
 * Creates a wedge solid along an edge.
 * 
 * The wedge spans:
 * - Along the edge direction (with small extension)
 * - From the edge outward along both face normals
 * 
 * @param Manifold - The Manifold class with static constructors
 * @param edge The edge to build wedge for
 * @param distance How far to offset along face normals
 * @param inflate Extra inflation for boolean overlap (typically 2× precision)
 * @returns Manifold representing the wedge
 */
export function buildWedge(
  Manifold: ManifoldStatic,
  edge: MeshEdge,
  distance: number,
  inflate: number = 0.001
): Manifold {
  
  // Edge vector and direction
  const edgeVec: [number, number, number] = [
    edge.p1[0] - edge.p0[0],
    edge.p1[1] - edge.p0[1],
    edge.p1[2] - edge.p0[2]
  ];
  const dir = edgeDirection(edge);
  
  // Compute offset directions perpendicular to edge, along face normals
  // We need vectors in the plane of each face, perpendicular to the edge
  const offsetA = crossAndNormalize(edge.n0, dir);
  const offsetB = crossAndNormalize(edge.n1, dir);
  
  // Ensure offset directions point "outward" from the edge (same side as normals)
  // This aligns them with how the fillet should remove material
  const dotA = dot(offsetA, edge.n0);
  const dotB = dot(offsetB, edge.n1);
  
  if (dotA < 0) {
    offsetA[0] = -offsetA[0];
    offsetA[1] = -offsetA[1];
    offsetA[2] = -offsetA[2];
  }
  if (dotB < 0) {
    offsetB[0] = -offsetB[0];
    offsetB[1] = -offsetB[1];
    offsetB[2] = -offsetB[2];
  }
  
  // Create wedge vertices
  // The wedge is a triangular prism along the edge
  const d = distance + inflate;
  const ext = inflate; // Small extension along edge
  
  // Start cap vertices (at p0 - ext along edge)
  const s0: [number, number, number] = [
    edge.p0[0] - dir[0] * ext,
    edge.p0[1] - dir[1] * ext,
    edge.p0[2] - dir[2] * ext
  ];
  const sA: [number, number, number] = [
    s0[0] + offsetA[0] * d,
    s0[1] + offsetA[1] * d,
    s0[2] + offsetA[2] * d
  ];
  const sB: [number, number, number] = [
    s0[0] + offsetB[0] * d,
    s0[1] + offsetB[1] * d,
    s0[2] + offsetB[2] * d
  ];
  
  // End cap vertices (at p1 + ext along edge)
  const e0: [number, number, number] = [
    edge.p1[0] + dir[0] * ext,
    edge.p1[1] + dir[1] * ext,
    edge.p1[2] + dir[2] * ext
  ];
  const eA: [number, number, number] = [
    e0[0] + offsetA[0] * d,
    e0[1] + offsetA[1] * d,
    e0[2] + offsetA[2] * d
  ];
  const eB: [number, number, number] = [
    e0[0] + offsetB[0] * d,
    e0[1] + offsetB[1] * d,
    e0[2] + offsetB[2] * d
  ];
  
  // Build the wedge as a convex hull of these 6 points
  // This guarantees a valid manifold
  const points = [s0, sA, sB, e0, eA, eB];
  
  return Manifold.hull(points);
}

/**
 * Cross product of two vectors, normalized.
 */
function crossAndNormalize(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  const c: [number, number, number] = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  
  const len = Math.sqrt(c[0] ** 2 + c[1] ** 2 + c[2] ** 2);
  if (len < 1e-12) return [0, 0, 1];
  
  return [c[0] / len, c[1] / len, c[2] / len];
}

/**
 * Dot product of two vectors.
 */
function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
