+++
title = '002 - Simple camera movement'
+++

### Goal

Understand `camera movement`.

### Notes

Fundamentally, this is a change of coordinate system: we want to convert points
from world coordinates to camera coordinates. The camera is defined by its
position, a target point, and an approximate up direction. From these inputs,
we construct an orthonormal basis that represents the camera coordinate system.
We define the camera coordinate system using the following basis vectors:

- \(\hat{n}\): A unit vector pointing from the target toward the camera. This
corresponds to the local +z axis of the camera coordinate system.

- \(\hat{r}\): A unit vector pointing to the right of the viewing direction.
  This corresponds to the local +x axis of the camera coordinate system. We
  choose \(\hat{r}\) to be perpendicular to \(\hat{n}\)

- \(\hat{u}\): A unit vector perpendicular to both \(\hat{r}\) and \(\hat{n}\),
  pointing approximately in the direction of the world up vector. This
  corresponds to the local +y axis of the camera coordinate system.

Together, these vectors form an orthonormal basis that fully defines the
camera’s orientation. Conceptually, this defines a transformation that maps
points from camera space into world space. However, for rendering, we need the
opposite: we must transform world-space points into camera space. This requires
the inverse of the camera transform, commonly called the view matrix.

### Resources

- [Week 4: Dot and Cross Product/LookAt](https://web.cs.swarthmore.edu/~adanner/cs40/f20/notes/week04.html)
