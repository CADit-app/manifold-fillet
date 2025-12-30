/**
 * Example usage of the fillet library.
 * 
 * Works on both manifoldcad.org and CADit.
 */
import { Manifold } from 'manifold-3d/manifoldCAD';
import type { Manifold as ManifoldType } from 'manifold-3d';
import { createFillet } from './index';

// Create fillet API bound to the Manifold class
const { fillet } = createFillet(Manifold);

const box = Manifold.cube([20, 20, 20], true);

// Fillet the edge at position (10, 10, 0)
const rounded = fillet(box, {
  radius: 2,
  selection: { 
    type: 'point', 
    point: [10, 10, 0],
    maxDistance: 5  // optional: limit search radius
  },
  segments: 50
});

const box1 = Manifold.cube([20, 20, 20], true);

// Fillet all sharp edges (dihedral angle < 100°)
const fullyRounded = fillet(box1, {
  radius: 2,
  selection: { 
    type: 'angle', 
    minAngle: 80  // edges sharper than 80° from flat
  },
  segments: 50
})
.translate([30, 0, 0]);

export default [rounded, fullyRounded] as ManifoldType[];
