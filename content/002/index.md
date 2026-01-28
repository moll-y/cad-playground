+++
title = '002 - Simple camera movement'
+++

### Goal

Understand camera movement.

### Notes

The concept behind camera movement is called `Change of Basis`. Using this
concept we can convert vectors from the world coordinate system to the camera
coordinate system. In this simulation we change the basis from world:
\(\text{right} = ((1,0,0)\), \(\text{up} = (0,1,0)\), and \(\text{forward} =
(0,0,1)\). To camera: \(\text{right} = (-1,0,0)\), \(\text{up} = (0,0,1)\), and
\(\text{forward} = (0,-1,0)\). This way, the camera is placed (in world space)
at \((0,1,0)\) and looks at \((0,0,0)\)

