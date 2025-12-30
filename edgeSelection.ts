/**
 * Edge selection types for fillet operations.
 * 
 * Point-based selection: Find edges nearest to a 3D point
 * Angle-based selection: Find all edges sharper than a threshold angle
 */

import { Manifold } from 'manifold-3d';

/** Point-based edge selection - fillet edge nearest to a point */
export interface PointEdgeSelection {
  type: 'point';
  point: [number, number, number];
  maxDistance?: number;
}

/** Angle-based edge selection - fillet all edges sharper than threshold */
export interface AngleEdgeSelection {
  type: 'angle';
  minAngle: number; // degrees (0-180, where 180 is flat)
}

export type EdgeSelection = PointEdgeSelection | AngleEdgeSelection;

/** 
 * Represents an edge in a mesh as a pair of vertex indices 
 * with associated face normals for dihedral angle calculation
 */
export interface MeshEdge {
  v0: number;
  v1: number;
  /** Vertex positions */
  p0: [number, number, number];
  p1: [number, number, number];
  /** Face normals of adjacent triangles */
  n0: [number, number, number];
  n1: [number, number, number];
  /** Dihedral angle in degrees (180 = flat, 90 = right angle) */
  dihedralAngle: number;
}

/**
 * Extracts edges from a Manifold mesh with dihedral angle information.
 * An edge is defined as a pair of vertices shared by exactly 2 triangles.
 */
export function extractEdges(mf: Manifold): MeshEdge[] {
  const mesh = mf.getMesh();
  const { triVerts, vertProperties, numProp } = mesh;
  const numTris = triVerts.length / 3;
  
  // Build edge -> triangles map
  // Key: "min_max" of vertex indices
  const edgeToTris = new Map<string, { tri: number; normal: [number, number, number] }[]>();
  
  const getVertex = (idx: number): [number, number, number] => {
    const offset = idx * numProp;
    return [
      vertProperties[offset],
      vertProperties[offset + 1],
      vertProperties[offset + 2]
    ];
  };
  
  const computeNormal = (v0: [number, number, number], v1: [number, number, number], v2: [number, number, number]): [number, number, number] => {
    // Edge vectors
    const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    // Cross product
    const n: [number, number, number] = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0]
    ];
    // Normalize
    const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
    if (len > 1e-12) {
      n[0] /= len;
      n[1] /= len;
      n[2] /= len;
    }
    return n;
  };
  
  // Process each triangle
  for (let t = 0; t < numTris; t++) {
    const i0 = triVerts[t * 3];
    const i1 = triVerts[t * 3 + 1];
    const i2 = triVerts[t * 3 + 2];
    
    const v0 = getVertex(i0);
    const v1 = getVertex(i1);
    const v2 = getVertex(i2);
    const normal = computeNormal(v0, v1, v2);
    
    // Add each edge of this triangle
    const edges = [
      [i0, i1],
      [i1, i2],
      [i2, i0]
    ];
    
    for (const [a, b] of edges) {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!edgeToTris.has(key)) {
        edgeToTris.set(key, []);
      }
      edgeToTris.get(key)!.push({ tri: t, normal });
    }
  }
  
  // Extract edges that have exactly 2 adjacent triangles (manifold edges)
  const meshEdges: MeshEdge[] = [];
  
  for (const [key, tris] of edgeToTris) {
    if (tris.length !== 2) continue; // Skip boundary or non-manifold edges
    
    const [aStr, bStr] = key.split('_');
    const v0 = parseInt(aStr);
    const v1 = parseInt(bStr);
    
    const p0 = getVertex(v0);
    const p1 = getVertex(v1);
    const n0 = tris[0].normal;
    const n1 = tris[1].normal;
    
    // Compute dihedral angle between face normals
    const dot = n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2];
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const dihedralAngle = Math.acos(clampedDot) * (180 / Math.PI);
    
    meshEdges.push({
      v0,
      v1,
      p0,
      p1,
      n0,
      n1,
      dihedralAngle
    });
  }
  
  return meshEdges;
}

/**
 * Selects edges based on selection criteria.
 */
export function selectEdges(edges: MeshEdge[], selection: EdgeSelection): MeshEdge[] {
  if (selection.type === 'point') {
    return selectByPoint(edges, selection);
  } else {
    return selectByAngle(edges, selection);
  }
}

/**
 * Find the edge closest to a point.
 */
function selectByPoint(edges: MeshEdge[], selection: PointEdgeSelection): MeshEdge[] {
  const [px, py, pz] = selection.point;
  const maxDist = selection.maxDistance ?? Infinity;
  
  let closestEdge: MeshEdge | null = null;
  let closestDist = Infinity;
  
  for (const edge of edges) {
    const dist = pointToSegmentDistance(
      [px, py, pz],
      edge.p0,
      edge.p1
    );
    
    if (dist < closestDist && dist <= maxDist) {
      closestDist = dist;
      closestEdge = edge;
    }
  }
  
  return closestEdge ? [closestEdge] : [];
}

/**
 * Find all edges sharper than a threshold angle.
 * A dihedral angle of 180° is flat (faces are coplanar).
 * A dihedral angle of 90° is a right-angle edge.
 * 
 * @param minAngle Minimum angle to consider "sharp" (e.g., 80 means edges < 100° dihedral)
 */
function selectByAngle(edges: MeshEdge[], selection: AngleEdgeSelection): MeshEdge[] {
  // minAngle represents how sharp the edge is
  // 180 - dihedralAngle gives us the "sharpness" angle
  const threshold = 180 - selection.minAngle;
  
  return edges.filter(edge => edge.dihedralAngle <= threshold);
}

/**
 * Compute distance from point to line segment.
 */
function pointToSegmentDistance(
  p: [number, number, number],
  a: [number, number, number],
  b: [number, number, number]
): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  
  const abLenSq = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  if (abLenSq < 1e-12) {
    // Degenerate segment
    return Math.sqrt(ap[0] * ap[0] + ap[1] * ap[1] + ap[2] * ap[2]);
  }
  
  // Project point onto line, clamped to segment
  const t = Math.max(0, Math.min(1, 
    (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / abLenSq
  ));
  
  // Closest point on segment
  const closest = [
    a[0] + t * ab[0],
    a[1] + t * ab[1],
    a[2] + t * ab[2]
  ];
  
  // Distance
  const dx = p[0] - closest[0];
  const dy = p[1] - closest[1];
  const dz = p[2] - closest[2];
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Sample points along an edge for tube generation.
 */
export function sampleEdge(edge: MeshEdge, numSamples: number = 10): [number, number, number][] {
  const samples: [number, number, number][] = [];
  
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    samples.push([
      edge.p0[0] + t * (edge.p1[0] - edge.p0[0]),
      edge.p0[1] + t * (edge.p1[1] - edge.p0[1]),
      edge.p0[2] + t * (edge.p1[2] - edge.p0[2])
    ]);
  }
  
  return samples;
}

/**
 * Compute the edge direction (normalized).
 */
export function edgeDirection(edge: MeshEdge): [number, number, number] {
  const dx = edge.p1[0] - edge.p0[0];
  const dy = edge.p1[1] - edge.p0[1];
  const dz = edge.p1[2] - edge.p0[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  if (len < 1e-12) return [1, 0, 0];
  return [dx / len, dy / len, dz / len];
}

/**
 * Compute the "inward" direction perpendicular to the edge,
 * pointing into the solid (average of face normals, negated).
 */
export function edgeInwardDirection(edge: MeshEdge): [number, number, number] {
  // Average of face normals points "outward" from the edge
  // For fillet, we want direction toward the solid interior
  const n: [number, number, number] = [
    (edge.n0[0] + edge.n1[0]) / 2,
    (edge.n0[1] + edge.n1[1]) / 2,
    (edge.n0[2] + edge.n1[2]) / 2
  ];
  
  const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
  if (len < 1e-12) return [0, 0, 1];
  
  // Negate to point inward
  return [-n[0] / len, -n[1] / len, -n[2] / len];
}
